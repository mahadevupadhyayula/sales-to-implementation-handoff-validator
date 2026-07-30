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
  for (const collection of collections) {
    const ids = new Set<string>();
    for (const record of collection) {
      if (record.dealId !== state.dealId) context.addIssue({ code: "custom", message: `Record ${record.id} belongs to a different deal` });
      if (ids.has(record.id)) context.addIssue({ code: "custom", message: `Duplicate record ID ${record.id}` });
      ids.add(record.id);
    }
  }
  const sourceIds = new Set(state.sources.map(({ id }) => id));
  const citedRecords: Array<{ citations: Array<{ id: string; sourceId: string }> }> = [...state.facts, ...state.findings, ...state.readiness];
  for (const output of state.approvedOutputs) {
    for (const item of [...output.baseline.scope, ...output.baseline.assumptions, ...output.baseline.unresolvedItems]) citedRecords.push(item);
    for (const workstream of output.baseline.workstreams) {
      if (workstream.dealId !== state.dealId) context.addIssue({ code: "custom", message: `Output workstream ${workstream.id} belongs to a different deal` });
      citedRecords.push(workstream);
    }
  }
  for (const record of citedRecords) for (const citation of record.citations) {
    if (!sourceIds.has(citation.sourceId)) context.addIssue({ code: "custom", message: `Citation ${citation.id} references an unknown source` });
  }
  const factIds = new Set(state.facts.map(({ id }) => id));
  const findingIds = new Set(state.findings.map(({ id }) => id));
  for (const finding of state.findings) for (const factId of finding.relatedFactIds) {
    if (!factIds.has(factId)) context.addIssue({ code: "custom", message: `Finding ${finding.id} references unknown fact ${factId}` });
  }
  for (const readiness of state.readiness) for (const findingId of readiness.findingIds) {
    if (!findingIds.has(findingId)) context.addIssue({ code: "custom", message: `Readiness ${readiness.id} references unknown finding ${findingId}` });
  }
  for (const task of state.clarificationTasks) for (const findingId of task.relatedFindingIds) {
    if (!findingIds.has(findingId)) context.addIssue({ code: "custom", message: `Clarification task ${task.id} references unknown finding ${findingId}` });
  }
  const decisions = new Map(state.decisions.map((decision) => [decision.id, decision]));
  for (const output of state.approvedOutputs) {
    const decision = decisions.get(output.decisionId);
    if (!decision?.explicitlyApproved) {
      context.addIssue({ code: "custom", message: `Approved output ${output.id} requires an approved reviewer decision` });
      continue;
    }
    if (output.approvedBy !== decision.reviewerId) {
      context.addIssue({ code: "custom", message: `Approved output ${output.id} approver must match the reviewer decision` });
    }
    if (Date.parse(output.approvedAt) < Date.parse(decision.decidedAt)) {
      context.addIssue({ code: "custom", message: `Approved output ${output.id} cannot predate its reviewer decision` });
    }
  }
});
export type SourceFixture = z.infer<typeof sourceFixtureSchema>;
export type NormalizedDealState = z.infer<typeof normalizedDealStateSchema>;
