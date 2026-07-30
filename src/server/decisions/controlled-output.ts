import "server-only";
import {
  approvedBaselineOutputSchema,
  decisionSubmissionSchema,
  reviewerDecisionSchema,
  type ApprovedBaselineOutput,
  type DecisionSubmission,
  type ReviewerDecision,
  type WorkstreamReadiness,
} from "../../domain/schemas/workflow";

const requiredSeverity = new Set(["critical", "high", "blocker"]);

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 54);
}

function includedForTasks(outcome: DecisionSubmission["outcome"], finding: DecisionSubmission["findings"][number]): boolean {
  if (outcome === "accept") return false;
  if (outcome === "accept_with_conditions") return finding.state !== "confirmed";
  if (outcome === "return_for_clarification") return finding.state === "unresolved" || finding.state === "assumption";
  return requiredSeverity.has(finding.severity) || finding.state === "conflict";
}

export function createControlledOutput(
  rawSubmission: unknown,
  decidedAt: string,
): { decision: ReviewerDecision; output: ApprovedBaselineOutput } {
  const submission = decisionSubmissionSchema.parse(rawSubmission);
  const decisionId = `decision-${submission.dealId}-${decidedAt.replace(/[^0-9]/g, "").slice(0, 17)}`;
  const relevantEdits = submission.findings.flatMap((finding) => [
    ...(finding.summary === finding.originalSummary ? [] : [{
      field: `finding.${finding.id}.summary`,
      previousValue: finding.originalSummary,
      newValue: finding.summary,
    }]),
    ...(finding.owner === "Unassigned" ? [] : [{
      field: `finding.${finding.id}.owner`,
      previousValue: "Unassigned",
      newValue: finding.owner,
    }]),
    ...(!finding.reviewNote ? [] : [{
      field: `finding.${finding.id}.reviewNote`,
      previousValue: "",
      newValue: finding.reviewNote,
    }]),
  ]);
  const conditions = submission.outcome === "accept_with_conditions"
    ? submission.findings.filter((finding) => finding.state !== "confirmed").map((finding) => finding.summary)
    : [];
  const decision = reviewerDecisionSchema.parse({
    id: decisionId,
    dealId: submission.dealId,
    outcome: submission.outcome,
    rationale: submission.rationale || "All required findings were reviewed and the handoff was accepted.",
    reviewerId: submission.reviewerId,
    decidedAt,
    relevantEdits,
    conditions,
    explicitlyApproved: true,
  });

  const tasks = submission.findings.filter((finding) => includedForTasks(submission.outcome, finding)).map((finding, index) => ({
    id: `task-${index + 1}-${slug(finding.id)}`,
    dealId: submission.dealId,
    question: finding.recommendedNextAction,
    ownerRole: finding.owner,
    status: "open" as const,
    relatedFindingIds: [finding.id],
  }));
  const ownerMap = new Map<string, string[]>();
  for (const task of tasks) ownerMap.set(task.ownerRole, [...(ownerMap.get(task.ownerRole) ?? []), task.id]);

  const workstreams = [...new Set(submission.findings.map((finding) => finding.workstream))].map((workstream): WorkstreamReadiness => {
    const streamFindings = submission.findings.filter((finding) => finding.workstream === workstream);
    const hasBlocking = streamFindings.some((finding) => requiredSeverity.has(finding.severity));
    return {
      id: `readiness-${submission.dealId}-${workstream}`,
      dealId: submission.dealId,
      workstream,
      status: hasBlocking ? "ready_with_conditions" : "ready",
      rationale: hasBlocking ? "Material findings were reviewed and retained as controlled conditions or follow-up." : "Reviewed evidence supports this workstream.",
      findingIds: streamFindings.map((finding) => finding.id),
      citations: streamFindings.flatMap((finding) => finding.citations).slice(0, 8),
    };
  });
  const baselineItems = submission.findings.map((finding) => ({
    text: finding.summary,
    state: finding.state,
    citations: finding.citations,
  }));
  const output = approvedBaselineOutputSchema.parse({
    id: `output-${decisionId}`,
    dealId: submission.dealId,
    decisionId,
    version: 1,
    status: "approved",
    approvedBy: submission.reviewerId,
    approvedAt: decidedAt,
    baseline: {
      scope: baselineItems.filter((item) => item.state === "confirmed"),
      assumptions: baselineItems.filter((item) => item.state === "assumption"),
      unresolvedItems: baselineItems.filter((item) => item.state !== "confirmed" && item.state !== "assumption"),
      workstreams,
    },
    clarificationTasks: tasks,
    owners: [...ownerMap].map(([role, taskIds]) => ({ role, taskIds })),
    kickoffBrief: {
      title: "Northstar Harbor Logistics — internal implementation kickoff",
      disposition: submission.outcome,
      summary: `${submission.reviewerName} (${submission.reviewerRole}) approved the ${submission.outcome.replaceAll("_", " ")} decision after reviewing all material findings.`,
      approvedScope: baselineItems.filter((item) => item.state === "confirmed").map((item) => item.text),
      conditionsAndRisks: submission.findings.filter((finding) => finding.state !== "confirmed").map((finding) => finding.summary),
      nextSteps: tasks.map((task) => `${task.ownerRole}: ${task.question}`),
    },
    transmission: "simulated_only",
  });
  return { decision, output };
}
