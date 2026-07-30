import { describe, expect, it } from "vitest";
import { approvedBaselineOutputSchema, promptRunAuditSchema, reviewerDecisionSchema } from "../../src/domain/schemas/index.js";

describe("approval and audit boundaries", () => {
  it("rejects a decision without explicit human approval", () => {
    const result = reviewerDecisionSchema.safeParse({ id: "decision-1", dealId: "deal-1", outcome: "accept", rationale: "Evidence reviewed", reviewerId: "reviewer-1", decidedAt: "2026-06-01T12:00:00Z", relevantEdits: [], conditions: [], explicitlyApproved: false });
    expect(result.success).toBe(false);
  });

  it("only represents controlled baseline output as approved", () => {
    expect(approvedBaselineOutputSchema.safeParse({ id: "output-1", dealId: "deal-1", decisionId: "decision-1", version: 1, status: "preview", approvedBy: "reviewer-1", approvedAt: "2026-06-01T12:00:00Z", baseline: { scope: [], assumptions: [], unresolvedItems: [], workstreams: [] } }).success).toBe(false);
  });

  it("requires failures or parsed outputs according to prompt status", () => {
    const base = { id: "run-1", dealId: "deal-1", promptId: "extract-facts", promptVersion: "1.0.0", adapterMode: "mock", model: "deterministic-mock-v1", inputReference: "fixture:deal-1", startedAt: "2026-06-01T12:00:00Z", completedAt: "2026-06-01T12:00:01Z" };
    expect(promptRunAuditSchema.safeParse({ ...base, status: "succeeded" }).success).toBe(false);
    expect(promptRunAuditSchema.safeParse({ ...base, status: "failed", failure: "schema validation failed" }).success).toBe(true);
  });
});
