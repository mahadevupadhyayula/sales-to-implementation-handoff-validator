import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { evaluateDemo } from "../../evals/evaluate-demo.js";
import { openDatabase } from "../../src/server/db/database.js";
import { createEvidenceExtractionAdapter } from "../../src/server/ai/adapter.js";
import { loadTelemetryFixture } from "../../src/server/fixtures/load.js";
import { reconcileTelemetryFixture } from "../../src/server/reconciliation/telemetry.js";

describe("prospect demo acceptance evaluation", () => {
  it("detects every seeded finding with valid evidence and no unsupported confirmed facts", async () => {
    const fixture = await loadTelemetryFixture(resolve("fixtures/deal-rooms/northstar-telemetry"));
    const reconciliation = reconcileTelemetryFixture(fixture);
    const database = openDatabase();
    try {
      const { output, mode } = await createEvidenceExtractionAdapter({
        database,
        mode: "mock",
        now: () => fixture.manifest.asOf,
      }).extract({ fixture, reconciliation });
      const result = evaluateDemo(fixture, reconciliation, output);

      expect(mode).toBe("mock");
      expect(result.seededGapsFound).toHaveLength(fixture.expectedFindings.findingCount);
      expect(result.missedSeededGaps).toEqual([]);
      expect(result.falsePositiveFindings).toEqual([]);
      expect(result.mismatchedFindings).toEqual([]);
      expect(result.citationCoverage).toBe(1);
      expect(result.uncitedMaterialItems).toEqual([]);
      expect(result.invalidCitations).toEqual([]);
      expect(result.unsupportedConfirmedAssertions).toEqual([]);
    } finally {
      database.close();
    }
  });
});
