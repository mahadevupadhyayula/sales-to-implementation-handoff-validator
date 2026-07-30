import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { z } from "zod";
import { openDatabase } from "../src/server/db/database.js";
import { evidenceExtractionOutputSchema } from "../src/domain/schemas/ai.js";
import { createEvidenceExtractionAdapter } from "../src/server/ai/adapter.js";
import { evidenceExtractionPrompt } from "../src/server/ai/prompts/registry.js";
import { loadTelemetryFixture } from "../src/server/fixtures/load.js";
import { reconcileTelemetryFixture } from "../src/server/reconciliation/telemetry.js";

const evaluationDatasetSchema = z.object({
  schemaVersion: z.literal("1.0.0"),
  promptId: z.literal("implementation.evidence-extraction"),
  promptVersion: z.literal("1.0.0"),
  fixtureDirectory: z.string().min(1),
  synthetic: z.literal(true),
  reviewCriteria: z.object({
    minimumExtractedEvidence: z.number().int().nonnegative(),
    minimumClarificationQuestions: z.number().int().nonnegative(),
    requiredUncertaintyTopics: z.array(z.string().min(1)),
    requiredKickoffSections: z.array(z.enum(["goals", "scope", "risks"])),
    forbiddenOutputFields: z.array(z.string().min(1)),
  }),
});

type Citation = {
  sourceId: string;
  location: { jsonPointer?: string; excerpt: string };
};

function resolvePointer(value: unknown, path: string): unknown {
  let current = value;
  for (const rawSegment of path.slice(1).split("/")) {
    const segment = rawSegment.replaceAll("~1", "/").replaceAll("~0", "~");
    if (typeof current !== "object" || current === null || !(segment in current)) return undefined;
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

function displayValue(value: unknown): string {
  if (value === null) return "null";
  return typeof value === "string" ? value : JSON.stringify(value);
}

const datasetPath = resolve("evals/implementation-evidence-extraction.dataset.json");
const dataset = evaluationDatasetSchema.parse(JSON.parse(await readFile(datasetPath, "utf8")));
const fixture = await loadTelemetryFixture(resolve(dataset.fixtureDirectory));
const reconciliation = reconcileTelemetryFixture(fixture);
const database = openDatabase();

try {
  const { output } = await createEvidenceExtractionAdapter({
    database,
    mode: "mock",
    now: () => fixture.manifest.asOf,
  }).extract({ fixture, reconciliation });

  const parsed = evidenceExtractionOutputSchema.safeParse(output);
  const materialItems = [
    ...output.extractedEvidence,
    ...output.clarificationQuestions,
    ...output.kickoffBrief.goals,
    ...output.kickoffBrief.scope,
    ...output.kickoffBrief.risks,
  ];
  const citations: Citation[] = materialItems.flatMap(({ citations: itemCitations }) => itemCitations);
  const sources = new Map(fixture.sources.map((source) => [source.sourceId, source]));
  const unsupportedAssertions = citations.filter((citation) => {
    const source = sources.get(citation.sourceId);
    const pointer = citation.location.jsonPointer;
    if (!source || !pointer) return true;
    const resolved = resolvePointer(source, pointer);
    return resolved === undefined || displayValue(resolved) !== citation.location.excerpt;
  }).length;
  const expectedFindingIds = new Set(fixture.expectedFindings.findings.map(({ findingId }) => findingId.toLowerCase()));
  const actualFindingIds = new Set(reconciliation.findings.map(({ id }) => id));
  const foundExpected = [...expectedFindingIds].filter((id) => actualFindingIds.has(id)).length;
  const reviewFailures = [
    output.extractedEvidence.length < dataset.reviewCriteria.minimumExtractedEvidence,
    output.clarificationQuestions.length < dataset.reviewCriteria.minimumClarificationQuestions,
    ...dataset.reviewCriteria.requiredUncertaintyTopics.map((topic) =>
      !output.uncertainties.some((uncertainty) => uncertainty.topic === topic)
    ),
    ...dataset.reviewCriteria.requiredKickoffSections.map((section) => output.kickoffBrief[section].length === 0),
    ...dataset.reviewCriteria.forbiddenOutputFields.map((field) => field in output),
  ].filter(Boolean).length;

  const metrics = {
    schemaValidity: parsed.success ? 1 : 0,
    citationCoverage: materialItems.length === 0
      ? 0
      : materialItems.filter(({ citations: itemCitations }) => itemCitations.length > 0).length / materialItems.length,
    seededFindingRecall: expectedFindingIds.size === 0 ? 1 : foundExpected / expectedFindingIds.size,
    unsupportedAssertions,
    reviewerCorrectionRate: reviewFailures === 0 ? 0 : reviewFailures / (
      2 +
      dataset.reviewCriteria.requiredUncertaintyTopics.length +
      dataset.reviewCriteria.requiredKickoffSections.length +
      dataset.reviewCriteria.forbiddenOutputFields.length
    ),
    falsePositiveFindings: [...actualFindingIds].filter((id) => !expectedFindingIds.has(id)).length,
    unresolvedItemsFound: output.uncertainties.length,
  };
  const thresholds = evidenceExtractionPrompt.acceptanceThresholds;
  const failures = [
    metrics.schemaValidity < thresholds.schemaValidity && "schemaValidity",
    metrics.citationCoverage < thresholds.citationCoverage && "citationCoverage",
    metrics.seededFindingRecall < thresholds.seededFindingRecall && "seededFindingRecall",
    metrics.unsupportedAssertions > thresholds.unsupportedAssertions && "unsupportedAssertions",
    metrics.reviewerCorrectionRate > thresholds.reviewerCorrectionRate && "reviewerCorrectionRate",
  ].filter((name): name is string => Boolean(name));

  console.log(JSON.stringify({
    evaluation: `${dataset.promptId}@${dataset.promptVersion}`,
    fixture: fixture.manifest.scenarioId,
    synthetic: true,
    metrics,
    thresholds,
    status: failures.length === 0 ? "passed" : "failed",
    failedThresholds: failures,
  }, null, 2));

  if (failures.length > 0) process.exitCode = 1;
} finally {
  database.close();
}
