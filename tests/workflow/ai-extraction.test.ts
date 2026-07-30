import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { createEvidenceExtractionAdapter } from "../../src/server/ai/adapter.js";
import { evidenceExtractionPrompt } from "../../src/server/ai/prompts/registry.js";
import { openDatabase } from "../../src/server/db/database.js";
import { loadTelemetryFixture } from "../../src/server/fixtures/load.js";
import { reconcileTelemetryFixture } from "../../src/server/reconciliation/telemetry.js";

const fixtureDirectory = resolve("fixtures/deal-rooms/northstar-telemetry");

describe("bounded AI-assisted extraction", () => {
  it("returns useful cited suggestions in deterministic mock mode and audits the run", async () => {
    const fixture = await loadTelemetryFixture(fixtureDirectory);
    const database = openDatabase();
    const now = () => "2027-01-15T12:00:00Z";
    const adapter = createEvidenceExtractionAdapter({ database, mode: "mock", now });
    const result = await adapter.extract({ fixture, reconciliation: reconcileTelemetryFixture(fixture) });

    expect(result.mode).toBe("mock");
    expect(result.output.authority).toBe("ai_suggestion");
    expect(result.output.extractedEvidence.some(({ evidenceBasis }) => evidenceBasis === "direct")).toBe(true);
    expect(result.output.extractedEvidence.some(({ evidenceBasis, uncertainty }) => evidenceBasis === "inference" && uncertainty)).toBe(true);
    expect(result.output.uncertainties.some(({ topic }) => topic.includes("owner"))).toBe(true);
    expect(result.output.clarificationQuestions.length).toBeGreaterThan(0);
    expect(result.output.kickoffBrief.goals.length).toBeGreaterThan(0);
    expect(result.output.kickoffBrief.scope.every(({ evidenceBasis, uncertainty }) =>
      evidenceBasis !== "inference" || Boolean(uncertainty)
    )).toBe(true);
    expect("reviewerDecision" in result.output).toBe(false);

    const run = database.prepare("SELECT payload_json FROM prompt_runs").get() as { payload_json: string };
    expect(JSON.parse(run.payload_json)).toMatchObject({
      promptId: "implementation.evidence-extraction",
      promptVersion: "1.0.0",
      adapterMode: "mock",
      fixtureVersion: "northstar-telemetry@1.0.0",
      validationResult: "valid",
      status: "succeeded",
    });
    database.close();
  });

  it("falls back to mock mode when OpenAI mode has no credentials", async () => {
    const fixture = await loadTelemetryFixture(fixtureDirectory);
    const database = openDatabase();
    const result = await createEvidenceExtractionAdapter({
      database, mode: "openai", now: () => "2027-01-15T12:00:01Z",
    }).extract({ fixture, reconciliation: reconcileTelemetryFixture(fixture) });
    expect(result.mode).toBe("mock");
    database.close();
  });

  it("registers immutable model settings, fixture version, schema, and thresholds", () => {
    expect(evidenceExtractionPrompt).toMatchObject({
      id: "implementation.evidence-extraction",
      version: "1.0.0",
      fixtureVersion: "northstar-telemetry@1.0.0",
      modelSettings: { temperature: 0 },
      acceptanceThresholds: { schemaValidity: 1, citationCoverage: 1, unsupportedAssertions: 0 },
    });
    expect(evidenceExtractionPrompt.inputSchema).toBeDefined();
    expect(evidenceExtractionPrompt.outputSchema).toBeDefined();
  });
});
