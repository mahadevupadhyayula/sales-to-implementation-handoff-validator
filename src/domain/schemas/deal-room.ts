import { z } from "zod";
import { identifierSchema, nonEmptyTextSchema } from "./common.js";
import { extractedFactSchema, sourceSchema } from "./evidence.js";
import { approvedBaselineOutputSchema, clarificationTaskSchema, findingSchema, reviewerDecisionSchema, workstreamReadinessSchema } from "./workflow.js";
import { promptRunAuditSchema } from "./audit.js";

export const sourceFixtureSchema = z.object({
  schemaVersion: z.literal(1), dealId: identifierSchema, organization: nonEmptyTextSchema,
  synthetic: z.literal(true), sources: z.array(sourceSchema).min(1),
}).superRefine((fixture, context) => fixture.sources.forEach((source, index) => {
  if (source.dealId !== fixture.dealId) context.addIssue({ code: "custom", path: ["sources", index, "dealId"], message: "Source dealId must match fixture" });
}));

export const normalizedDealStateSchema = z.object({
  dealId: identifierSchema, sources: z.array(sourceSchema), facts: z.array(extractedFactSchema), findings: z.array(findingSchema),
  readiness: z.array(workstreamReadinessSchema), clarificationTasks: z.array(clarificationTaskSchema), decisions: z.array(reviewerDecisionSchema),
  approvedOutputs: z.array(approvedBaselineOutputSchema), promptRuns: z.array(promptRunAuditSchema),
}).superRefine((state, context) => {
  const collections = [state.sources, state.facts, state.findings, state.readiness, state.clarificationTasks, state.decisions, state.approvedOutputs, state.promptRuns];
  for (const collection of collections) for (const record of collection) {
    if (record.dealId !== state.dealId) context.addIssue({ code: "custom", message: `Record ${record.id} belongs to a different deal` });
  }
  const sourceIds = new Set(state.sources.map(({ id }) => id));
  for (const record of [...state.facts, ...state.findings, ...state.readiness]) for (const citation of record.citations) {
    if (!sourceIds.has(citation.sourceId)) context.addIssue({ code: "custom", message: `Citation ${citation.id} references an unknown source` });
  }
  const approvedDecisionIds = new Set(state.decisions.filter(({ explicitlyApproved }) => explicitlyApproved).map(({ id }) => id));
  for (const output of state.approvedOutputs) if (!approvedDecisionIds.has(output.decisionId)) {
    context.addIssue({ code: "custom", message: `Approved output ${output.id} requires an approved reviewer decision` });
  }
});
export type SourceFixture = z.infer<typeof sourceFixtureSchema>;
export type NormalizedDealState = z.infer<typeof normalizedDealStateSchema>;
