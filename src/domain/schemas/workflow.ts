import { z } from "zod";
import { identifierSchema, nonEmptyTextSchema, timestampSchema } from "./common";
import { citationSchema, epistemicStateSchema } from "./evidence";

export const findingSchema = z.object({
  id: identifierSchema, dealId: identifierSchema,
  category: identifierSchema,
  severity: z.enum(["critical", "high", "medium", "low", "info", "warning", "blocker"]),
  workstream: z.enum(["scope", "technical", "security", "data", "delivery", "governance"]),
  state: epistemicStateSchema,
  summary: nonEmptyTextSchema,
  explanation: nonEmptyTextSchema,
  recommendedNextAction: nonEmptyTextSchema,
  citations: z.array(citationSchema).min(1, "Every finding requires evidence"),
  relatedFactIds: z.array(identifierSchema).default([]),
});

export const baselineEvidenceItemSchema = z.object({
  text: nonEmptyTextSchema,
  state: epistemicStateSchema,
  citations: z.array(citationSchema).min(1, "Every baseline item requires evidence"),
});

export const readinessStatusSchema = z.enum(["ready", "ready_with_conditions", "not_ready", "unknown"]);
export const workstreamReadinessSchema = z.object({
  id: identifierSchema, dealId: identifierSchema,
  workstream: z.enum(["scope", "technical", "security", "data", "delivery", "governance"]),
  status: readinessStatusSchema,
  rationale: nonEmptyTextSchema,
  findingIds: z.array(identifierSchema).min(1),
  citations: z.array(citationSchema).min(1),
});

export const clarificationTaskSchema = z.object({
  id: identifierSchema, dealId: identifierSchema,
  question: nonEmptyTextSchema, ownerRole: nonEmptyTextSchema,
  status: z.enum(["open", "answered", "cancelled"]),
  dueAt: timestampSchema.optional(),
  relatedFindingIds: z.array(identifierSchema).min(1),
  answer: nonEmptyTextSchema.optional(),
}).superRefine((task, context) => {
  if (task.status === "answered" && !task.answer) context.addIssue({ code: "custom", path: ["answer"], message: "Answered tasks require an answer" });
});

export const decisionOutcomeSchema = z.enum(["accept", "accept_with_conditions", "return_for_clarification", "escalate"]);
export const reviewedFindingInputSchema = z.object({
  id: identifierSchema,
  summary: nonEmptyTextSchema,
  explanation: nonEmptyTextSchema,
  recommendedNextAction: nonEmptyTextSchema,
  severity: findingSchema.shape.severity,
  workstream: findingSchema.shape.workstream,
  state: epistemicStateSchema,
  citations: z.array(citationSchema).min(1),
  owner: nonEmptyTextSchema,
  reviewed: z.boolean(),
  originalSummary: nonEmptyTextSchema,
  reviewNote: z.string().trim().max(2_000),
});

export const decisionSubmissionSchema = z.object({
  dealId: identifierSchema,
  outcome: decisionOutcomeSchema,
  rationale: z.string().trim().max(4_000),
  reviewerId: identifierSchema,
  reviewerName: nonEmptyTextSchema,
  reviewerRole: nonEmptyTextSchema,
  findings: z.array(reviewedFindingInputSchema).min(1),
}).superRefine((submission, context) => {
  if (submission.outcome !== "accept" && !submission.rationale) {
    context.addIssue({ code: "custom", path: ["rationale"], message: "This decision requires a rationale" });
  }
  const openRequired = submission.findings.filter((finding) =>
    ["critical", "high", "blocker"].includes(finding.severity) && !finding.reviewed);
  if (openRequired.length > 0) {
    context.addIssue({ code: "custom", path: ["findings"], message: "Every critical and high-severity finding must be reviewed before a decision" });
  }
  const taskCandidates = submission.findings.filter((finding) => {
    if (submission.outcome === "accept") return false;
    if (submission.outcome === "accept_with_conditions") return finding.state !== "confirmed";
    if (submission.outcome === "return_for_clarification") return finding.state === "unresolved" || finding.state === "assumption";
    return ["critical", "high", "blocker"].includes(finding.severity) || finding.state === "conflict";
  });
  if (taskCandidates.some((finding) => finding.owner.toLowerCase() === "unassigned")) {
    context.addIssue({ code: "custom", path: ["findings"], message: "Every generated clarification task requires an assigned owner" });
  }
});

export const reviewerDecisionSchema = z.object({
  id: identifierSchema, dealId: identifierSchema,
  outcome: decisionOutcomeSchema,
  rationale: nonEmptyTextSchema,
  reviewerId: identifierSchema,
  decidedAt: timestampSchema,
  relevantEdits: z.array(z.object({ field: nonEmptyTextSchema, previousValue: z.unknown(), newValue: z.unknown() })).default([]),
  conditions: z.array(nonEmptyTextSchema).default([]),
  explicitlyApproved: z.literal(true),
}).superRefine((decision, context) => {
  if (decision.outcome === "accept_with_conditions" && decision.conditions.length === 0) context.addIssue({ code: "custom", path: ["conditions"], message: "Conditional acceptance requires conditions" });
});

export const approvedBaselineOutputSchema = z.object({
  id: identifierSchema, dealId: identifierSchema, decisionId: identifierSchema,
  version: z.number().int().positive(),
  status: z.literal("approved"),
  approvedBy: identifierSchema, approvedAt: timestampSchema,
  baseline: z.object({
    scope: z.array(baselineEvidenceItemSchema),
    assumptions: z.array(baselineEvidenceItemSchema),
    unresolvedItems: z.array(baselineEvidenceItemSchema),
    workstreams: z.array(workstreamReadinessSchema),
  }),
  clarificationTasks: z.array(clarificationTaskSchema),
  owners: z.array(z.object({
    role: nonEmptyTextSchema,
    taskIds: z.array(identifierSchema),
  })),
  kickoffBrief: z.object({
    title: nonEmptyTextSchema,
    disposition: decisionOutcomeSchema,
    summary: nonEmptyTextSchema,
    approvedScope: z.array(nonEmptyTextSchema),
    conditionsAndRisks: z.array(nonEmptyTextSchema),
    nextSteps: z.array(nonEmptyTextSchema),
  }),
  transmission: z.literal("simulated_only"),
});

export type Finding = z.infer<typeof findingSchema>;
export type WorkstreamReadiness = z.infer<typeof workstreamReadinessSchema>;
export type ClarificationTask = z.infer<typeof clarificationTaskSchema>;
export type ReviewerDecision = z.infer<typeof reviewerDecisionSchema>;
export type ApprovedBaselineOutput = z.infer<typeof approvedBaselineOutputSchema>;
export type DecisionSubmission = z.infer<typeof decisionSubmissionSchema>;
