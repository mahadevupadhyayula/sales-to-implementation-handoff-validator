import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { authorityLevels, compareAuthority, extractedFactSchema, sourceFixtureSchema } from "../../src/domain/schemas/index.js";

describe("source authority", () => {
  it("orders authoritative sources from strongest to weakest", () => {
    expect([...authorityLevels].sort(compareAuthority)).toEqual([
      "executed_agreement", "approved_solution_design", "security_customer_requirements",
      "discovery_evidence", "crm", "informal_notes",
    ]);
    expect(compareAuthority("executed_agreement", "crm")).toBeLessThan(0);
  });

  it("validates the readable synthetic source fixture", () => {
    const fixture: unknown = JSON.parse(readFileSync("fixtures/deal-rooms/northstar-health/source-records.json", "utf8"));
    expect(sourceFixtureSchema.parse(fixture).sources).toHaveLength(6);
  });

  it("rejects material facts without a citation", () => {
    expect(() => extractedFactSchema.parse({ id: "fact-1", dealId: "deal-1", field: "launch", value: "2026-10-15", state: "confirmed", citations: [], extractedAt: "2026-06-01T12:00:00Z" })).toThrow(/requires evidence/);
  });
});
