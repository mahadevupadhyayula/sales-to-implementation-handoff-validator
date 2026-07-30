import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { telemetryFixtureBundleSchema } from "../../src/domain/schemas/telemetry-fixture.js";
import { loadTelemetryFixture } from "../../src/server/fixtures/load.js";

const fixtureDirectory = resolve("fixtures/deal-rooms/northstar-telemetry");

describe("northstar telemetry fixture boundary", () => {
  it("validates the manifest, sources, seeded gaps, expected findings, and citations together", async () => {
    const bundle = await loadTelemetryFixture(fixtureDirectory);
    expect(bundle.sources).toHaveLength(7);
    expect(bundle.expectedFindings.findings).toHaveLength(12);
  });

  it("rejects an expected finding citation to an unknown source", async () => {
    const bundle = await loadTelemetryFixture(fixtureDirectory);
    const invalid: unknown = structuredClone(bundle);
    (invalid as typeof bundle).expectedFindings.findings[0]!.citations[0]!.sourceId = "unknown-source";
    expect(() => telemetryFixtureBundleSchema.parse(invalid)).toThrow(/cites unknown source/);
  });
});
