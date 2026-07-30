import "server-only";
import type Database from "better-sqlite3";
import {
  evidenceExtractionInputSchema,
  evidenceExtractionOutputSchema,
  type EvidenceExtractionInput,
  type EvidenceExtractionOutput,
} from "../../domain/schemas/ai.js";
import type { TelemetryFixtureBundle, TelemetrySource } from "../../domain/schemas/telemetry-fixture.js";
import type { ReconciliationResult } from "../reconciliation/telemetry.js";
import { evidenceExtractionJsonSchema, evidenceExtractionPrompt } from "./prompts/registry.js";
import { persistPromptRun } from "./prompt-runs.js";

export type AdapterMode = "mock" | "openai";

export type EvidenceExtractionRun = {
  output: EvidenceExtractionOutput;
  runId: string;
  mode: AdapterMode;
};

type AdapterOptions = {
  database: Database.Database;
  mode?: AdapterMode;
  apiKey?: string;
  now?: () => string;
  fetch?: typeof globalThis.fetch;
};

function pointer(source: TelemetrySource, path: string): unknown {
  let current: unknown = source;
  for (const segment of path.slice(1).split("/")) {
    if (typeof current !== "object" || current === null || !(segment in current)) return undefined;
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

function cite(id: string, source: TelemetrySource, path: string) {
  const value = pointer(source, path);
  return {
    id,
    sourceId: source.sourceId,
    location: {
      section: source.title,
      jsonPointer: path,
      excerpt: typeof value === "string" ? value : JSON.stringify(value),
    },
  };
}

function mockExtraction(fixture: TelemetryFixtureBundle, reconciliation: ReconciliationResult): EvidenceExtractionOutput {
  const sources = new Map(fixture.sources.map((source) => [source.sourceId, source]));
  const discovery = sources.get("src-discovery-summary")!;
  const handoff = sources.get("src-sales-handoff")!;
  const finding = (id: string) => reconciliation.findings.find((item) => item.id === id)!;

  return evidenceExtractionOutputSchema.parse({
    schemaVersion: "1.0.0",
    dealId: fixture.manifest.dealId,
    extractedEvidence: [
      {
        id: "ai-evidence-business-goal",
        field: "business_goal",
        value: String(pointer(discovery, "/content/businessGoals/0")),
        evidenceBasis: "direct",
        confidence: 0.99,
        citations: [cite("ai-cite-business-goal", discovery, "/content/businessGoals/0")],
      },
      {
        id: "ai-evidence-schedule-risk",
        field: "delivery_risk",
        value: "The verbally targeted schedule may not align with the binding delivery schedule.",
        evidenceBasis: "inference",
        confidence: 0.86,
        uncertainty: "The narrative does not show that the customer accepted a revised schedule.",
        citations: [
          cite("ai-cite-schedule-narrative", handoff, "/content/dealSummary"),
          ...finding("fnd-001").citations.map((citation, index) => ({ ...citation, id: `ai-cite-schedule-${index + 1}` })),
        ],
      },
    ],
    uncertainties: [
      {
        id: "ai-uncertainty-owner",
        topic: "Accountable customer implementation owner",
        reason: "No named accountable implementation owner is present in the supplied sources.",
        searchedSourceIds: fixture.sources.map(({ sourceId }) => sourceId).sort(),
      },
    ],
    clarificationQuestions: [
      {
        id: "ai-question-owner",
        question: "Who is the accountable day-to-day customer implementation owner before kickoff?",
        rationale: finding("fnd-006").explanation,
        relatedFindingIds: ["fnd-006"],
        citations: finding("fnd-006").citations.map((citation, index) => ({ ...citation, id: `ai-cite-owner-${index + 1}` })),
      },
      {
        id: "ai-question-success",
        question: "What baseline, target, owner, and acceptance test will define implementation success?",
        rationale: finding("fnd-012").explanation,
        relatedFindingIds: ["fnd-012"],
        citations: finding("fnd-012").citations.map((citation, index) => ({ ...citation, id: `ai-cite-success-${index + 1}` })),
      },
    ],
    kickoffBrief: {
      summary: "Draft for reviewer editing. Deterministic findings remain authoritative.",
      goals: [{
        id: "ai-brief-goal",
        text: String(pointer(discovery, "/content/businessGoals/0")),
        evidenceBasis: "direct",
        confidence: 0.99,
        citations: [cite("ai-cite-brief-goal", discovery, "/content/businessGoals/0")],
      }],
      scope: [{
        id: "ai-brief-scope",
        text: "FleetAxis synchronization is discussed, but field coverage and cadence require validation.",
        evidenceBasis: "inference",
        confidence: 0.84,
        uncertainty: "The supplied evidence does not confirm connector field coverage or synchronization cadence.",
        citations: finding("fnd-008").citations.map((citation, index) => ({ ...citation, id: `ai-cite-brief-scope-${index + 1}` })),
      }],
      risks: [{
        id: "ai-brief-risk",
        text: String(pointer(handoff, "/content/risks/0")),
        evidenceBasis: "direct",
        confidence: 0.98,
        citations: [cite("ai-cite-brief-risk", handoff, "/content/risks/0")],
      }],
    },
    authority: "ai_suggestion",
  });
}

function validateOutputReferences(
  output: EvidenceExtractionOutput,
  fixture: TelemetryFixtureBundle,
  reconciliation: ReconciliationResult,
): void {
  if (output.dealId !== fixture.manifest.dealId) throw new Error("Extraction output deal ID does not match its input");
  const sources = new Map(fixture.sources.map((source) => [source.sourceId, source]));
  const findingIds = new Set(reconciliation.findings.map(({ id }) => id));
  for (const uncertainty of output.uncertainties) {
    if (uncertainty.searchedSourceIds.some((id) => !sources.has(id))) {
      throw new Error(`Uncertainty ${uncertainty.id} references a source that was not searched`);
    }
  }
  for (const question of output.clarificationQuestions) {
    if (question.relatedFindingIds.some((id) => !findingIds.has(id))) {
      throw new Error(`Clarification question ${question.id} references a non-authoritative finding`);
    }
  }
  const cited = [
    ...output.extractedEvidence.flatMap(({ citations }) => citations),
    ...output.clarificationQuestions.flatMap(({ citations }) => citations),
    ...output.kickoffBrief.goals.flatMap(({ citations }) => citations),
    ...output.kickoffBrief.scope.flatMap(({ citations }) => citations),
    ...output.kickoffBrief.risks.flatMap(({ citations }) => citations),
  ];
  for (const citation of cited) {
    const source = sources.get(citation.sourceId);
    if (!source || !citation.location.jsonPointer) throw new Error(`Citation ${citation.id} does not resolve to a supplied source`);
    const value = pointer(source, citation.location.jsonPointer);
    const excerpt = typeof value === "string" ? value : JSON.stringify(value);
    if (value === undefined || excerpt !== citation.location.excerpt) throw new Error(`Citation ${citation.id} excerpt does not match its source`);
  }
}

async function openAiExtraction(input: EvidenceExtractionInput, apiKey: string, fetcher: typeof globalThis.fetch): Promise<string> {
  const response = await fetcher("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({
      model: evidenceExtractionPrompt.model,
      temperature: evidenceExtractionPrompt.modelSettings.temperature,
      max_output_tokens: evidenceExtractionPrompt.modelSettings.maxOutputTokens,
      instructions: evidenceExtractionPrompt.instructions,
      input: JSON.stringify(input),
      text: { format: { type: "json_schema", name: "implementation_evidence_extraction", strict: true, schema: evidenceExtractionJsonSchema() } },
    }),
  });
  if (!response.ok) throw new Error(`OpenAI response failed with status ${response.status}`);
  const body = await response.json() as {
    output_text?: string;
    output?: Array<{ content?: Array<{ type?: string; text?: string }> }>;
  };
  const outputText = body.output_text ?? body.output
    ?.flatMap(({ content = [] }) => content)
    .find(({ type, text }) => type === "output_text" && text)?.text;
  if (!outputText) throw new Error("OpenAI response did not include structured output text");
  return outputText;
}

export function createEvidenceExtractionAdapter(options: AdapterOptions) {
  return {
    async extract(rawInput: unknown): Promise<EvidenceExtractionRun> {
      const input = evidenceExtractionInputSchema.parse(rawInput);
      const startedAt = (options.now ?? (() => new Date().toISOString()))();
      const runId = `prompt-run-${input.fixture.manifest.scenarioId}-${startedAt.replaceAll(/[^0-9]/g, "").toLowerCase()}`;
      const requestedMode = options.mode ?? (options.apiKey ? "openai" : "mock");
      const mode: AdapterMode = requestedMode === "openai" && options.apiKey ? "openai" : "mock";
      let rawOutput: string | undefined;
      try {
        const candidate = mode === "openai"
          ? JSON.parse(rawOutput = await openAiExtraction(input, options.apiKey!, options.fetch ?? globalThis.fetch))
          : mockExtraction(input.fixture, input.reconciliation);
        const output = evidenceExtractionOutputSchema.parse(candidate);
        validateOutputReferences(output, input.fixture, input.reconciliation);
        rawOutput ??= JSON.stringify(output);
        persistPromptRun(options.database, {
          id: runId, dealId: input.fixture.manifest.dealId,
          promptId: evidenceExtractionPrompt.id, promptVersion: evidenceExtractionPrompt.version,
          adapterMode: mode, model: mode === "mock" ? "deterministic-mock" : evidenceExtractionPrompt.model,
          modelSettings: evidenceExtractionPrompt.modelSettings,
          fixtureVersion: evidenceExtractionPrompt.fixtureVersion,
          inputReference: `${input.fixture.manifest.scenarioId}@${input.fixture.manifest.schemaVersion}`,
          status: "succeeded", rawOutput, parsedOutput: output, validationResult: "valid",
          startedAt, completedAt: (options.now ?? (() => new Date().toISOString()))(),
        });
        return { output, runId, mode };
      } catch (error) {
        persistPromptRun(options.database, {
          id: runId, dealId: input.fixture.manifest.dealId,
          promptId: evidenceExtractionPrompt.id, promptVersion: evidenceExtractionPrompt.version,
          adapterMode: mode, model: mode === "mock" ? "deterministic-mock" : evidenceExtractionPrompt.model,
          modelSettings: evidenceExtractionPrompt.modelSettings,
          fixtureVersion: evidenceExtractionPrompt.fixtureVersion,
          inputReference: `${input.fixture.manifest.scenarioId}@${input.fixture.manifest.schemaVersion}`,
          status: "failed", ...(rawOutput ? { rawOutput } : {}), validationResult: "invalid",
          failure: error instanceof Error ? error.message : "Unknown extraction failure",
          startedAt, completedAt: (options.now ?? (() => new Date().toISOString()))(),
        });
        throw error;
      }
    },
  };
}
