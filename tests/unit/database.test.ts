import { describe, expect, it } from "vitest";
import { openDatabase } from "../../src/server/db/database.js";
import { readDealState, replaceDealState } from "../../src/server/db/deal-state-repository.js";

describe("normalized SQLite state", () => {
  it("validates database ingress and egress and preserves evidence", () => {
    const database = openDatabase();
    const citation = { id: "cite-1", sourceId: "source-1", location: { section: "Scope", jsonPointer: "/scope", excerpt: "Aurora intake workflow" } };
    replaceDealState(database, {
      dealId: "deal-1",
      sources: [{ id: "source-1", dealId: "deal-1", title: "Agreement", sourceType: "agreement", authorityLevel: "executed_agreement", recordDate: "2026-05-01", content: { scope: "Aurora intake workflow" }, synthetic: true }],
      facts: [{ id: "fact-1", dealId: "deal-1", field: "scope", value: "Aurora intake workflow", state: "confirmed", citations: [citation], extractedAt: "2026-06-01T12:00:00Z" }],
      findings: [], readiness: [], clarificationTasks: [], decisions: [], approvedOutputs: [], promptRuns: [],
    });
    expect(readDealState(database, "deal-1").facts[0]?.citations).toEqual([citation]);
    expect(database.prepare("SELECT COUNT(*) AS count FROM citations").get()).toEqual({ count: 1 });
    database.close();
  });
});
