import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { z } from "zod";
import { openDatabase } from "../src/server/db/database.js";
import { evidenceExtractionOutputSchema } from "../src/domain/schemas/ai.js";
import { createEvidenceExtractionAdapter } from "../src/server/ai/adapter.js";
import { evidenceExtractionPrompt } from "../src/server/ai/prompts/registry.js";
import { loadTelemetryFixture } from "../src/server/fixtures/load.js";
import { reconcileTelemetryFixture } from "../src/server/reconciliation/telemetry.js";
import { evaluateDemo } from "./evaluate-demo.js";

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
  const demo = evaluateDemo(fixture, reconciliation, output);
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
    citationCoverage: demo.citationCoverage,
    seededFindingRecall: fixture.expectedFindings.findingCount === 0
      ? 1
      : demo.seededGapsFound.length / fixture.expectedFindings.findingCount,
    unsupportedAssertions: demo.invalidCitations.length + demo.unsupportedConfirmedAssertions.length,
    reviewerCorrectionRate: reviewFailures === 0 ? 0 : reviewFailures / (
      2 +
      dataset.reviewCriteria.requiredUncertaintyTopics.length +
      dataset.reviewCriteria.requiredKickoffSections.length +
      dataset.reviewCriteria.forbiddenOutputFields.length
    ),
    falsePositiveFindings: demo.falsePositiveFindings.length,
    unresolvedItemsFound: output.uncertainties.length,
  };
  const thresholds = evidenceExtractionPrompt.acceptanceThresholds;
  const failures = [
    metrics.schemaValidity < thresholds.schemaValidity && "schemaValidity",
    metrics.citationCoverage < thresholds.citationCoverage && "citationCoverage",
    metrics.seededFindingRecall < thresholds.seededFindingRecall && "seededFindingRecall",
    metrics.unsupportedAssertions > thresholds.unsupportedAssertions && "unsupportedAssertions",
    metrics.reviewerCorrectionRate > thresholds.reviewerCorrectionRate && "reviewerCorrectionRate",
    (demo.falsePositiveFindings.length > 0 || demo.mismatchedFindings.length > 0) && "expectedFindingParity",
  ].filter((name): name is string => Boolean(name));

  console.log(JSON.stringify({
    evaluation: `${dataset.promptId}@${dataset.promptVersion}`,
    fixture: fixture.manifest.scenarioId,
    fixtureVersion: `${fixture.manifest.scenarioId}@${fixture.manifest.schemaVersion}`,
    synthetic: true,
    prompt: {
      id: evidenceExtractionPrompt.id,
      version: evidenceExtractionPrompt.version,
      model: "deterministic-mock",
      settings: evidenceExtractionPrompt.modelSettings,
    },
    seededGaps: {
      expected: fixture.expectedFindings.findingCount,
      found: demo.seededGapsFound,
      missed: demo.missedSeededGaps,
      falsePositives: demo.falsePositiveFindings,
      mismatches: demo.mismatchedFindings,
    },
    citations: {
      coverage: demo.citationCoverage,
      uncitedMaterialItems: demo.uncitedMaterialItems,
      invalid: demo.invalidCitations,
    },
    unsupportedAssertions: demo.unsupportedConfirmedAssertions,
    reviewerEdits: [],
    reviewerEditNote: "No reviewer corrections were required by the deterministic mock evaluation.",
    metrics,
    thresholds,
    status: failures.length === 0 ? "passed" : "failed",
    failedThresholds: failures,
  }, null, 2));

  if (failures.length > 0) process.exitCode = 1;
} finally {
  database.close();
}
