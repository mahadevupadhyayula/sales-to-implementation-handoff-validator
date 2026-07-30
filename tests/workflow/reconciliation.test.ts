import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { loadTelemetryFixture } from "../../src/server/fixtures/load.js";
import { compareTelemetrySourceAuthority, reconcileTelemetryFixture, reconciliationAuthorityOrder } from "../../src/server/reconciliation/telemetry.js";

const fixtureDirectory = resolve("fixtures/deal-rooms/northstar-telemetry");

describe("telemetry ingestion to deterministic finding generation", () => {
  it("finds every seeded gap with cited evidence across every deterministic check class", async () => {
    const bundle = await loadTelemetryFixture(fixtureDirectory);
    const result = reconcileTelemetryFixture(bundle);
    const actualIds = result.findings.map(({ id }) => id.toUpperCase());

    expect(actualIds).toEqual(bundle.seededGaps.seededFindingIds);
    expect(result.findings.every((finding) =>
      finding.citations.length > 0 &&
      finding.explanation.length > 0 &&
      finding.recommendedNextAction.length > 0 &&
      finding.workstream.length > 0
    )).toBe(true);
    expect(result.facts.length).toBeGreaterThan(result.findings.length);
    expect(result.findings.every((finding) => finding.relatedFactIds.length === finding.citations.length)).toBe(true);
    expect(result.checksRun.required_field).toBeGreaterThan(0);
    expect(result.checksRun.conflict).toBeGreaterThan(0);
    expect(result.checksRun.dependency).toBeGreaterThan(0);
    expect(result.checksRun.checklist).toBeGreaterThan(0);

    for (const expected of bundle.expectedFindings.findings) {
      const actual = result.findings.find(({ id }) => id.toUpperCase() === expected.findingId);
      expect(actual, expected.findingId).toBeDefined();
      expect(actual).toMatchObject({
        category: expected.category,
        severity: expected.severity,
        state: expected.epistemicState,
        summary: expected.title,
      });
      expect(actual?.citations.map(({ sourceId, location }) => ({
        sourceId,
        location: location.jsonPointer,
        excerpt: location.excerpt,
      }))).toEqual(expected.citations);
    }
  });

  it("preserves conflicting claims and their source locations", async () => {
    const bundle = await loadTelemetryFixture(fixtureDirectory);
    const conflict = reconcileTelemetryFixture(bundle).findings.find(({ id }) => id === "fnd-003");

    expect(conflict?.state).toBe("conflict");
    expect(conflict?.citations.map(({ sourceId }) => sourceId)).toEqual([
      "src-security-requirements",
      "src-approved-solution-design",
    ]);
    expect(conflict?.citations.every(({ location }) => location.jsonPointer)).toBe(true);
  });

  it("does not mistake absent evidence for the exact seeded claim", async () => {
    const bundle = await loadTelemetryFixture(fixtureDirectory);
    const mutated = structuredClone(bundle);
    const crm = mutated.sources.find(({ sourceId }) => sourceId === "src-crm-opportunity")!;
    delete crm.content.customerImplementationOwner;

    expect(reconcileTelemetryFixture(mutated).findings.some(({ id }) => id === "fnd-006")).toBe(false);
  });

  it("publishes a stable strongest-to-weakest authority order", () => {
    expect(reconciliationAuthorityOrder[0]).toBe("executed_commercial_document");
    expect(reconciliationAuthorityOrder.at(-1)).toBe("sales_handoff_note");
  });

  it("uses recency only as a tie-breaker within the same authority level", async () => {
    const bundle = await loadTelemetryFixture(fixtureDirectory);
    const source = bundle.sources.find(({ sourceId }) => sourceId === "src-sales-handoff")!;
    const older = { ...source, sourceId: "src-sales-handoff-older", recordedAt: "2027-01-01T00:00:00Z" };
    expect([older, source].sort(compareTelemetrySourceAuthority).map(({ sourceId }) => sourceId)).toEqual([
      "src-sales-handoff",
      "src-sales-handoff-older",
    ]);
  });
});
