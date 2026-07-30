import { describe, expect, it } from "vitest";
import { approvedBaselineOutputSchema, baselineEvidenceItemSchema, normalizedDealStateSchema, promptRunAuditSchema, reviewerDecisionSchema } from "../../src/domain/schemas/index.js";

describe("approval and audit boundaries", () => {
  it("rejects a decision without explicit human approval", () => {
    const result = reviewerDecisionSchema.safeParse({ id: "decision-1", dealId: "deal-1", outcome: "accept", rationale: "Evidence reviewed", reviewerId: "reviewer-1", decidedAt: "2026-06-01T12:00:00Z", relevantEdits: [], conditions: [], explicitlyApproved: false });
    expect(result.success).toBe(false);
  });

  it("only represents controlled baseline output as approved", () => {
    expect(approvedBaselineOutputSchema.safeParse({ id: "output-1", dealId: "deal-1", decisionId: "decision-1", version: 1, status: "preview", approvedBy: "reviewer-1", approvedAt: "2026-06-01T12:00:00Z", baseline: { scope: [], assumptions: [], unresolvedItems: [], workstreams: [] } }).success).toBe(false);
  });

  it("requires evidence on every material baseline item", () => {
    expect(baselineEvidenceItemSchema.safeParse({ text: "Launch in May", state: "confirmed", citations: [] }).success).toBe(false);
  });

  it("rejects cross-record references that do not resolve", () => {
    const state = {
      dealId: "deal-1",
      sources: [],
      facts: [],
      findings: [{
        id: "finding-1", dealId: "deal-1", category: "scope", severity: "warning", workstream: "scope", state: "unresolved",
        summary: "Unknown dependency", explanation: "Required dependency is not confirmed.", recommendedNextAction: "Confirm the dependency.",
        citations: [{ id: "cite-1", sourceId: "source-1", location: { section: "Scope", jsonPointer: "/scope", excerpt: "Unknown" } }],
        relatedFactIds: ["missing-fact"],
      }],
      readiness: [], clarificationTasks: [], decisions: [], approvedOutputs: [], promptRuns: [],
    };
    const result = normalizedDealStateSchema.safeParse(state);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues.map(({ message }) => message).join(" ")).toMatch(/unknown source|unknown fact/);
  });

  it("requires an output approver and timestamp consistent with the human decision", () => {
    const decision = {
      id: "decision-1", dealId: "deal-1", outcome: "accept", rationale: "Reviewed",
      reviewerId: "reviewer-1", decidedAt: "2026-06-01T12:00:00Z",
      relevantEdits: [], conditions: [], explicitlyApproved: true,
    };
    const output = {
      id: "output-1", dealId: "deal-1", decisionId: "decision-1", version: 1, status: "approved",
      approvedBy: "reviewer-2", approvedAt: "2026-06-01T11:00:00Z",
      baseline: { scope: [], assumptions: [], unresolvedItems: [], workstreams: [] },
      clarificationTasks: [],
      owners: [],
      kickoffBrief: {
        title: "Internal kickoff", disposition: "accept", summary: "Reviewed handoff.",
        approvedScope: [], conditionsAndRisks: [], nextSteps: [],
      },
      transmission: "simulated_only",
    };
    const result = normalizedDealStateSchema.safeParse({
      dealId: "deal-1", sources: [], facts: [], findings: [], readiness: [],
      clarificationTasks: [], decisions: [decision], approvedOutputs: [output], promptRuns: [],
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues.map(({ message }) => message).join(" ")).toMatch(/approver.*reviewer|cannot predate/);
  });

  it("requires failures or parsed outputs according to prompt status", () => {
    const base = {
      id: "run-1", dealId: "deal-1", promptId: "extract-facts", promptVersion: "1.0.0",
      adapterMode: "mock", model: "deterministic-mock-v1", modelSettings: { temperature: 0 },
      fixtureVersion: "fixture@1.0.0", inputReference: "fixture:deal-1",
      startedAt: "2026-06-01T12:00:00Z", completedAt: "2026-06-01T12:00:01Z",
    };
    expect(promptRunAuditSchema.safeParse({ ...base, status: "succeeded" }).success).toBe(false);
    expect(promptRunAuditSchema.safeParse({
      ...base, status: "failed", validationResult: "invalid", failure: "schema validation failed",
    }).success).toBe(true);
  });
});
