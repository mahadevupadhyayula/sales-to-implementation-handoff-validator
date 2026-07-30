import { describe, expect, it } from "vitest";
import { createControlledOutput } from "../../src/server/decisions/controlled-output.js";
import { openDatabase } from "../../src/server/db/database.js";
import { persistDecisionPackage } from "../../src/server/db/deal-state-repository.js";

const citation = {
  id: "cite-1",
  sourceId: "source-1",
  location: { section: "Scope", jsonPointer: "/content/scope", excerpt: "Synthetic scope" },
};
const base = {
  dealId: "deal-1",
  rationale: "The reviewed evidence supports this controlled outcome.",
  reviewerId: "reviewer-1",
  reviewerName: "Avery Morgan",
  reviewerRole: "Implementation Manager",
  findings: [
    {
      id: "finding-1",
      summary: "Contracted scope conflicts with the proposed design",
      originalSummary: "Contracted scope conflicts with the proposed design",
      explanation: "The synthetic sources conflict.",
      recommendedNextAction: "Resolve the scope conflict.",
      severity: "critical",
      workstream: "scope",
      state: "conflict",
      citations: [citation],
      owner: "Solution architect",
      reviewed: true,
      reviewNote: "",
    },
    {
      id: "finding-2",
      summary: "Customer owner is unresolved",
      originalSummary: "Customer owner is unresolved",
      explanation: "No customer owner is named.",
      recommendedNextAction: "Name a customer owner.",
      severity: "high",
      workstream: "governance",
      state: "unresolved",
      citations: [{ ...citation, id: "cite-2" }],
      owner: "Sales owner",
      reviewed: true,
      reviewNote: "",
    },
  ],
} as const;
const decidedAt = "2026-07-30T12:00:00.000Z";

describe("human decision and controlled output", () => {
  it.each([
    ["accept", 0],
    ["accept_with_conditions", 2],
    ["return_for_clarification", 1],
    ["escalate", 2],
  ] as const)("generates an approved simulated package for %s", (outcome, expectedTaskCount) => {
    const result = createControlledOutput({ ...base, outcome }, decidedAt);
    expect(result.decision.outcome).toBe(outcome);
    expect(result.output.status).toBe("approved");
    expect(result.output.transmission).toBe("simulated_only");
    expect(result.output.clarificationTasks).toHaveLength(expectedTaskCount);
    expect(result.output.kickoffBrief.disposition).toBe(outcome);
    expect(result.output.baseline.unresolvedItems).toHaveLength(2);
  });

  it("rejects consequential output before required human review", () => {
    expect(() => createControlledOutput({
      ...base,
      outcome: "escalate",
      findings: base.findings.map((finding, index) => ({ ...finding, reviewed: index !== 0 })),
    }, decidedAt)).toThrow(/must be reviewed/);
  });

  it("rejects a forged approval record and an output without a matching human decision", () => {
    const database = openDatabase();
    try {
      expect(() => persistDecisionPackage(database, {
        id: "decision-forged",
        dealId: "deal-1",
        outcome: "accept",
        rationale: "Forged approval.",
        reviewerId: "reviewer-1",
        decidedAt,
        explicitlyApproved: false,
      }, {})).toThrow();

      const result = createControlledOutput({ ...base, outcome: "accept" }, decidedAt);
      expect(() => persistDecisionPackage(database, result.decision, {
        ...result.output,
        decisionId: "decision-other",
      })).toThrow(/does not match/);
    } finally {
      database.close();
    }
  });

  it("requires rationale and owners for non-accept outcomes", () => {
    expect(() => createControlledOutput({ ...base, outcome: "return_for_clarification", rationale: "" }, decidedAt)).toThrow(/requires a rationale/);
    expect(() => createControlledOutput({
      ...base,
      outcome: "escalate",
      findings: base.findings.map((finding) => ({ ...finding, owner: "Unassigned" })),
    }, decidedAt)).toThrow(/assigned owner/);
  });

  it("persists the accountable decision before its controlled output", () => {
    const database = openDatabase();
    const result = createControlledOutput({ ...base, outcome: "accept" }, decidedAt);
    persistDecisionPackage(database, result.decision, result.output);
    expect(database.prepare("SELECT reviewer_id, outcome FROM reviewer_decisions").get()).toEqual({
      reviewer_id: "reviewer-1",
      outcome: "accept",
    });
    expect(database.prepare("SELECT decision_id FROM approved_baseline_outputs").get()).toEqual({
      decision_id: result.decision.id,
    });
    database.close();
  });
});
