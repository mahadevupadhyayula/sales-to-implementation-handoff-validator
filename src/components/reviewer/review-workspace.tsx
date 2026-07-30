"use client";

import { useMemo, useState, useTransition } from "react";
import type { ApprovedBaselineOutput, Finding, ReviewerDecision } from "@/domain/schemas/workflow";
import type { TelemetryFixtureBundle, TelemetrySource } from "@/domain/schemas/telemetry-fixture";
import { approveHandoffDecision } from "@/app/handoffs/[dealId]/actions";
import { ArrowIcon, CheckIcon, FileIcon, ShieldIcon, SparkIcon, XIcon } from "./icons";

type View = "overview" | "report" | "decision";
type FindingDraft = Finding & { owner: string; reviewed: boolean; reviewNote: string };

const workstreamOrder: Finding["workstream"][] = ["scope", "technical", "security", "data", "delivery", "governance"];
const sourceTypeLabel: Record<TelemetrySource["sourceType"], string> = {
  crm_opportunity: "CRM opportunity",
  executed_commercial_document: "Executed agreement",
  solution_design: "Solution design",
  security_data_requirement: "Security requirements",
  discovery_call_summary: "Discovery summary",
  sales_handoff_note: "Sales handoff",
  implementation_readiness_checklist: "Readiness checklist",
};
const workstreamCopy: Record<Finding["workstream"], string> = {
  scope: "Contracted services and commitments",
  technical: "Architecture, integrations, and environments",
  security: "Identity, logging, and data residency",
  data: "Migration scope and data requirements",
  delivery: "Schedule, milestones, and support",
  governance: "Ownership and success measures",
};
const ownerOptions = ["Unassigned", "Implementation lead", "Solution architect", "Security lead", "Sales owner", "Customer sponsor"];
const outcomeOptions = [
  ["accept", "Accept", "Proceed with the delivery baseline."],
  ["accept_with_conditions", "Accept with conditions", "Proceed with named conditions and owners."],
  ["return_for_clarification", "Return for clarification", "Send the unresolved evidence questions back."],
  ["escalate", "Escalate", "Route a material scope, security, or commercial issue."],
] as const;

function severityRank(severity: Finding["severity"]) {
  return { blocker: 0, critical: 0, high: 1, warning: 2, medium: 2, low: 3, info: 4 }[severity];
}
function isRequired(finding: Finding) {
  return finding.severity === "critical" || finding.severity === "high" || finding.severity === "blocker";
}
function pointerValue(source: TelemetrySource, pointer?: string): unknown {
  if (!pointer) return undefined;
  let current: unknown = source;
  for (const raw of pointer.slice(1).split("/")) {
    const part = raw.replaceAll("~1", "/").replaceAll("~0", "~");
    if (current === null || typeof current !== "object" || !(part in current)) return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}
function humanDate(value: string) {
  return new Intl.DateTimeFormat("en", { day: "numeric", month: "short", year: "numeric" }).format(new Date(value));
}

function StatusPill({ state }: { state: Finding["state"] }) {
  return <span className={`status-pill state-${state}`}>{state.replace("_", " ")}</span>;
}

export function ReviewWorkspace({ fixture, findings }: { fixture: TelemetryFixtureBundle; findings: Finding[] }) {
  const [view, setView] = useState<View>("overview");
  const [drafts, setDrafts] = useState<Record<string, FindingDraft>>(() => Object.fromEntries(findings.map((finding) => [
    finding.id,
    { ...finding, owner: "Unassigned", reviewed: false, reviewNote: "" },
  ])));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<string>("");
  const [rationale, setRationale] = useState("");
  const [approved, setApproved] = useState<{ decision: ReviewerDecision; output: ApprovedBaselineOutput } | null>(null);
  const [approvalError, setApprovalError] = useState("");
  const [isApproving, startApproval] = useTransition();
  const [showOnlyOpen, setShowOnlyOpen] = useState(false);
  const sources = useMemo(() => new Map(fixture.sources.map((source) => [source.sourceId, source])), [fixture.sources]);
  const allDrafts = Object.values(drafts).sort((a, b) => severityRank(a.severity) - severityRank(b.severity) || a.id.localeCompare(b.id));
  const required = allDrafts.filter(isRequired);
  const reviewedRequired = required.filter((finding) => finding.reviewed).length;
  const openRequired = required.length - reviewedRequired;
  const reviewedTotal = allDrafts.filter((finding) => finding.reviewed).length;
  const selected = selectedId ? drafts[selectedId] : undefined;
  const decisionUnlocked = openRequired === 0;
  const rationaleRequired = outcome !== "" && outcome !== "accept";
  const taskCandidate = (finding: FindingDraft) => outcome === "accept_with_conditions"
    ? finding.state !== "confirmed"
    : outcome === "return_for_clarification"
      ? finding.state === "unresolved" || finding.state === "assumption"
      : outcome === "escalate"
        ? isRequired(finding) || finding.state === "conflict"
        : false;
  const unassignedTaskCount = allDrafts.filter((finding) => taskCandidate(finding) && finding.owner === "Unassigned").length;
  const canApprove = decisionUnlocked && Boolean(outcome) && (!rationaleRequired || Boolean(rationale.trim())) && unassignedTaskCount === 0 && !approved;

  function patchFinding(id: string, patch: Partial<FindingDraft>) {
    setDrafts((current) => ({ ...current, [id]: { ...current[id]!, ...patch } }));
  }
  function openFinding(id: string) {
    setSelectedId(id);
  }
  function approveDecision() {
    setApprovalError("");
    startApproval(async () => {
      try {
        const result = await approveHandoffDecision({
          dealId: fixture.manifest.dealId,
          outcome,
          rationale,
          reviewerId: "avery-morgan",
          reviewerName: "Avery Morgan",
          reviewerRole: "Implementation Manager",
          findings: allDrafts.map((finding) => ({
            id: finding.id,
            summary: finding.summary,
            explanation: finding.explanation,
            recommendedNextAction: finding.recommendedNextAction,
            severity: finding.severity,
            workstream: finding.workstream,
            state: finding.state,
            citations: finding.citations,
            owner: finding.owner,
            reviewed: finding.reviewed,
            originalSummary: findings.find(({ id }) => id === finding.id)?.summary ?? finding.summary,
            reviewNote: finding.reviewNote,
          })),
        });
        setApproved(result);
      } catch (error) {
        setApprovalError(error instanceof Error ? error.message : "The decision could not be approved.");
      }
    });
  }

  return (
    <div className="min-h-screen bg-[#f3f1ea] text-[#18342f]">
      <header className="border-b border-[#d9d8cf] bg-[#f3f1ea]/95">
        <div className="mx-auto flex max-w-[1480px] items-center justify-between px-6 py-4 lg:px-9">
          <button onClick={() => setView("overview")} className="flex items-center gap-3 text-left">
            <span className="grid size-9 place-items-center rounded-lg bg-[#18342f] text-white"><ShieldIcon /></span>
            <span>
              <span className="block text-[10px] font-bold uppercase tracking-[0.18em] text-[#b6573b]">Implementation</span>
              <span className="block text-sm font-semibold">Intelligence</span>
            </span>
          </button>
          <div className="flex items-center gap-3">
            <span className="hidden rounded-full border border-[#d4d3c8] px-3 py-1.5 text-xs font-medium text-[#67736f] sm:inline">Synthetic prototype</span>
            <span className="grid size-9 place-items-center rounded-full bg-[#dce6df] text-xs font-bold">AM</span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1480px] px-6 pb-20 pt-8 lg:px-9">
        <div className="flex flex-col justify-between gap-6 border-b border-[#d9d8cf] pb-7 lg:flex-row lg:items-end">
          <div>
            <div className="flex items-center gap-2 text-xs font-medium text-[#77817d]">
              <span>Closed won</span><span>·</span><span>{fixture.manifest.dealId}</span>
            </div>
            <h1 className="mt-3 font-serif text-4xl leading-none tracking-[-0.025em] sm:text-5xl">Northstar Harbor Logistics</h1>
            <p className="mt-3 text-sm text-[#61706b]">OrbitSignal enterprise rollout · Review as of {humanDate(fixture.manifest.asOf)}</p>
          </div>
          <div className="flex min-w-[310px] items-center gap-4 rounded-2xl border border-[#d7d5ca] bg-white/55 px-5 py-4">
            <div className="relative grid size-12 place-items-center rounded-full bg-[#eee1d7] text-sm font-bold text-[#a84d32]">
              {reviewedRequired}/{required.length}
            </div>
            <div className="flex-1">
              <div className="flex justify-between text-xs font-semibold"><span>Required review</span><span>{openRequired} open</span></div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#dcdcd3]"><div className="h-full bg-[#b6573b] transition-all" style={{ width: `${required.length ? reviewedRequired / required.length * 100 : 100}%` }} /></div>
            </div>
          </div>
        </div>

        <nav aria-label="Review sections" className="flex gap-8 border-b border-[#d9d8cf]">
          {([["overview", "Deal overview"], ["report", "Readiness report"], ["decision", "Decision & output"]] as const).map(([id, label]) => (
            <button key={id} onClick={() => setView(id)} className={`nav-tab ${view === id ? "active" : ""}`}>
              {label}{id === "report" && <span className="ml-2 rounded-full bg-[#e4e3da] px-2 py-0.5 text-[10px]">{allDrafts.length}</span>}
            </button>
          ))}
        </nav>

        {view === "overview" && (
          <section className="pt-8">
            <div className="grid gap-5 lg:grid-cols-[1.45fr_0.8fr]">
              <div className="panel">
                <div className="panel-heading">
                  <div><p className="eyebrow">Source status</p><h2 className="mt-2 text-xl font-semibold">Deal room processed</h2></div>
                  <span className="flex items-center gap-1.5 text-xs font-semibold text-[#39715e]"><CheckIcon className="size-4" /> {fixture.sources.length} of {fixture.sources.length} available</span>
                </div>
                <div className="divide-y divide-[#e3e2da]">
                  {fixture.sources.map((source, index) => (
                    <div key={source.sourceId} className="grid grid-cols-[auto_1fr_auto] items-center gap-4 py-4">
                      <span className="grid size-9 place-items-center rounded-lg bg-[#edede7] text-[#63736e]"><FileIcon className="size-4" /></span>
                      <div>
                        <p className="text-sm font-semibold">{source.title}</p>
                        <p className="mt-1 text-xs text-[#7b8581]">{sourceTypeLabel[source.sourceType]} · v{source.version} · {humanDate(source.recordedAt)}</p>
                      </div>
                      <div className="text-right">
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#39715e]"><span className="size-1.5 rounded-full bg-[#4c8a74]" /> Processed</span>
                        <p className="mt-1 font-mono text-[10px] text-[#929994]">Rank {index + 1}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="space-y-5">
                <div className="rounded-2xl bg-[#18342f] p-6 text-white">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#a9c6bd]">Proposed disposition</p>
                  <h2 className="mt-5 font-serif text-3xl">Escalate before kickoff</h2>
                  <p className="mt-3 text-sm leading-6 text-[#c6d5d0]">Three critical conflicts affect contracted scope, schedule, and Canadian data residency.</p>
                  <button onClick={() => setView("report")} className="mt-7 flex items-center gap-2 text-sm font-semibold">Review material findings <ArrowIcon className="size-4" /></button>
                </div>
                <div className="panel">
                  <p className="eyebrow">Accountable reviewer</p>
                  <div className="mt-5 flex items-center gap-3">
                    <span className="grid size-11 place-items-center rounded-full bg-[#dce6df] text-xs font-bold">AM</span>
                    <div><p className="text-sm font-semibold">Avery Morgan</p><p className="text-xs text-[#7d8783]">Implementation Manager</p></div>
                  </div>
                  <div className="mt-6 border-t border-[#e2e1d9] pt-5">
                    <div className="flex justify-between text-xs"><span className="text-[#74807b]">Workflow status</span><span className="font-semibold">Human review in progress</span></div>
                    <div className="mt-3 flex justify-between text-xs"><span className="text-[#74807b]">Evidence mode</span><span className="font-semibold">Deterministic reconciliation</span></div>
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-5 panel">
              <div className="panel-heading">
                <div><p className="eyebrow">Readiness at a glance</p><h2 className="mt-2 text-xl font-semibold">Six workstreams need attention</h2></div>
                <button onClick={() => setView("report")} className="text-xs font-bold text-[#a84d32]">Open full report →</button>
              </div>
              <div className="grid gap-px overflow-hidden rounded-xl border border-[#dfded5] bg-[#dfded5] sm:grid-cols-2 xl:grid-cols-6">
                {workstreamOrder.map((workstream) => {
                  const streamFindings = allDrafts.filter((finding) => finding.workstream === workstream);
                  const critical = streamFindings.some((finding) => finding.severity === "critical");
                  return (
                    <button key={workstream} onClick={() => setView("report")} className="bg-[#faf9f5] p-4 text-left hover:bg-white">
                      <span className={`block size-2 rounded-full ${critical ? "bg-[#b6573b]" : "bg-[#d08b4d]"}`} />
                      <p className="mt-7 text-sm font-bold capitalize">{workstream}</p>
                      <p className="mt-1 text-xs text-[#7c8581]">{streamFindings.length} findings</p>
                    </button>
                  );
                })}
              </div>
            </div>
          </section>
        )}

        {view === "report" && (
          <section className="pt-8">
            <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
              <div><p className="eyebrow">Implementation readiness report</p><h2 className="mt-2 font-serif text-4xl">Evidence, organized for a decision.</h2></div>
              <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold">
                <input type="checkbox" checked={showOnlyOpen} onChange={(event) => setShowOnlyOpen(event.target.checked)} className="accent-[#b6573b]" /> Show open reviews only
              </label>
            </div>
            <div className="space-y-5">
              {workstreamOrder.map((workstream) => {
                const streamFindings = allDrafts.filter((finding) => finding.workstream === workstream && (!showOnlyOpen || !finding.reviewed));
                if (!streamFindings.length) return null;
                const requiredOpen = streamFindings.filter((finding) => isRequired(finding) && !finding.reviewed).length;
                return (
                  <div key={workstream} className="panel !p-0">
                    <div className="flex flex-col justify-between gap-3 border-b border-[#e0dfd7] px-6 py-5 sm:flex-row sm:items-center">
                      <div>
                        <div className="flex items-center gap-3"><h3 className="text-lg font-bold capitalize">{workstream}</h3><span className={`readiness-pill ${requiredOpen ? "not-ready" : "conditional"}`}>{requiredOpen ? "Not ready" : "Reviewed"}</span></div>
                        <p className="mt-1 text-xs text-[#7b8580]">{workstreamCopy[workstream]}</p>
                      </div>
                      <span className="text-xs font-semibold text-[#6f7a76]">{streamFindings.length} finding{streamFindings.length === 1 ? "" : "s"}</span>
                    </div>
                    <div className="divide-y divide-[#e5e4dc]">
                      {streamFindings.map((finding) => (
                        <button key={finding.id} onClick={() => openFinding(finding.id)} className="finding-row">
                          <div className={`severity-marker severity-${finding.severity}`} />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-mono text-[10px] font-bold uppercase text-[#929a96]">{finding.id}</span>
                              <span className={`severity-label severity-text-${finding.severity}`}>{finding.severity}</span>
                              <StatusPill state={finding.state} />
                              {isRequired(finding) && <span className="text-[10px] font-bold uppercase tracking-wider text-[#a84d32]">Required</span>}
                            </div>
                            <p className="mt-2 text-sm font-semibold leading-5">{finding.summary}</p>
                            <p className="mt-1 line-clamp-1 text-xs text-[#7a8580]">{finding.explanation}</p>
                          </div>
                          <div className="hidden min-w-36 text-left md:block">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-[#9a9f9c]">Owner</p>
                            <p className="mt-1 text-xs font-semibold">{finding.owner}</p>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="hidden text-xs text-[#79837f] sm:inline">{finding.citations.length} source{finding.citations.length === 1 ? "" : "s"}</span>
                            <span className={`review-check ${finding.reviewed ? "done" : ""}`}>{finding.reviewed && <CheckIcon className="size-3.5" />}</span>
                            <ArrowIcon className="size-4 text-[#8b9490]" />
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="sticky bottom-5 mt-7 flex items-center justify-between rounded-2xl border border-[#d2d1c6] bg-[#faf9f5]/95 px-5 py-4 shadow-[0_14px_40px_rgba(24,52,47,0.12)] backdrop-blur">
              <div><p className="text-sm font-bold">{reviewedTotal} of {allDrafts.length} findings reviewed</p><p className="mt-0.5 text-xs text-[#79837f]">{openRequired ? `${openRequired} required reviews remain` : "All required findings are ready for decision"}</p></div>
              <button disabled={!decisionUnlocked} onClick={() => setView("decision")} className="primary-button">Continue to decision <ArrowIcon className="size-4" /></button>
            </div>
          </section>
        )}

        {view === "decision" && (
          <section className="pt-8">
            <div className="grid gap-5 xl:grid-cols-[0.92fr_1.08fr]">
              <div className="panel">
                <p className="eyebrow">Human decision</p>
                <h2 className="mt-3 font-serif text-4xl">Choose the handoff outcome.</h2>
                {!decisionUnlocked && (
                  <div className="mt-6 flex gap-3 rounded-xl border border-[#e1bcae] bg-[#fbede6] p-4 text-[#8f402b]">
                    <ShieldIcon className="mt-0.5 shrink-0" />
                    <div><p className="text-sm font-bold">Decision controls are locked</p><p className="mt-1 text-xs leading-5">{openRequired} critical or high-severity finding{openRequired === 1 ? "" : "s"} still require review. No outcome can be approved until they are complete.</p></div>
                  </div>
                )}
                <div className="mt-7 space-y-3">
                  {outcomeOptions.map(([id, label, copy]) => (
                    <button key={id} aria-label={label} disabled={!decisionUnlocked || Boolean(approved)} onClick={() => setOutcome(id)} className={`decision-option ${outcome === id ? "selected" : ""}`}>
                      <span className="decision-radio"><span /></span>
                      <span><span className="block text-sm font-bold">{label}</span><span className="mt-1 block text-xs text-[#74807b]">{copy}</span></span>
                    </button>
                  ))}
                </div>
                <label className="mt-7 block text-xs font-bold">Decision rationale <span className="font-normal text-[#87908c]">({rationaleRequired ? "required for this outcome" : "optional for acceptance"})</span>
                  <textarea value={rationale} onChange={(event) => setRationale(event.target.value)} disabled={!decisionUnlocked || Boolean(approved)} className="mt-2 min-h-28 w-full resize-none rounded-xl border border-[#d5d5cc] bg-[#faf9f5] p-3 text-sm font-normal outline-none focus:border-[#6d8e83] disabled:cursor-not-allowed disabled:opacity-55" placeholder="Record the evidence and reasoning behind this decision…" />
                </label>
                <button disabled={!canApprove || isApproving} onClick={approveDecision} className="primary-button mt-5 w-full justify-center">{isApproving ? "Approving…" : approved ? "Decision approved" : "Approve decision & prepare output"}</button>
                {unassignedTaskCount > 0 && <p className="mt-3 text-center text-xs font-semibold text-[#a96922]">{unassignedTaskCount} resulting task{unassignedTaskCount === 1 ? "" : "s"} need an owner before approval.</p>}
                {approvalError && <p role="alert" className="mt-3 text-center text-xs font-semibold text-[#a64029]">{approvalError}</p>}
                <p className="mt-3 text-center text-[11px] leading-4 text-[#858e8a]">Approval is an explicit human action. This prototype does not transmit or create records in any external system.</p>
              </div>
              <div className="panel !bg-[#ebe9e0]">
                <div className="flex items-start justify-between gap-4">
                  <div><p className="eyebrow">Controlled-output preview</p><h2 className="mt-3 text-xl font-bold">Implementation handoff package</h2></div>
                  <span className={`rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-wider ${approved ? "border-[#8eb3a4] bg-[#dcebe4] text-[#306c56]" : "border-[#c8c8bd] bg-white/60"}`}>{approved ? "Approved · simulated" : "Draft · not approved"}</span>
                </div>
                <div className="mt-6 rounded-xl border border-[#d8d6ca] bg-[#faf9f5] p-5">
                  <div className="flex items-center gap-2 text-[#a84d32]"><SparkIcon className="size-4" /><span className="text-[10px] font-bold uppercase tracking-wider">Internal kickoff brief</span></div>
                  <h3 className="mt-4 font-serif text-2xl">Northstar Harbor Logistics</h3>
                  <p className="mt-2 text-xs leading-5 text-[#727d78]">Prepared from the reviewed evidence set. Final language and task inclusion remain controlled by the implementation manager.</p>
                  <div className="mt-5 grid gap-3 sm:grid-cols-3">
                    {[["Disposition", outcome ? outcomeOptions.find(([id]) => id === outcome)?.[1] : "Awaiting decision"], ["Clarification tasks", String(approved?.output.clarificationTasks.length ?? 0)], ["Evidence", `${fixture.sources.length} source records`]].map(([label, value]) => (
                      <div key={label} className="rounded-lg bg-[#eeede7] p-3"><p className="text-[9px] font-bold uppercase tracking-wider text-[#8d9490]">{label}</p><p className="mt-1.5 text-xs font-bold">{value}</p></div>
                    ))}
                  </div>
                  {!approved ? (
                    <div className="mt-6 rounded-lg border border-dashed border-[#c9c8bd] p-5 text-center text-xs leading-5 text-[#78827e]">Complete the required review, choose an outcome, and explicitly approve it to generate the controlled package.</div>
                  ) : (
                    <div className="mt-6 space-y-5">
                      <div><p className="output-label">Decision record</p><p className="mt-2 text-xs leading-5"><strong>{outcomeOptions.find(([id]) => id === approved.decision.outcome)?.[1]}</strong> · Avery Morgan · {new Date(approved.decision.decidedAt).toLocaleString()}</p><p className="mt-1 text-xs leading-5 text-[#727d78]">{approved.decision.rationale}</p></div>
                      <div><p className="output-label">Approved baseline</p><p className="mt-2 text-xs leading-5">{approved.output.baseline.workstreams.length} reviewed workstreams · {approved.output.baseline.assumptions.length} assumptions · {approved.output.baseline.unresolvedItems.length} unresolved/conflicting items retained</p></div>
                      <div><p className="output-label">Clarification tasks & owners</p>{approved.output.clarificationTasks.length === 0 ? <p className="mt-2 text-xs text-[#727d78]">No clarification tasks are required for this outcome.</p> : <ul className="mt-2 space-y-2">{approved.output.clarificationTasks.map((task) => <li key={task.id} className="flex justify-between gap-4 border-b border-[#e0dfd7] pb-2 text-xs"><span>{task.question}</span><span className="shrink-0 font-semibold text-[#76817c]">{task.ownerRole}</span></li>)}</ul>}</div>
                      <div><p className="output-label">Internal kickoff brief</p><p className="mt-2 text-xs leading-5">{approved.output.kickoffBrief.summary}</p><ul className="mt-2 space-y-1">{approved.output.kickoffBrief.conditionsAndRisks.slice(0, 4).map((item) => <li key={item} className="text-xs leading-5">• {item}</li>)}</ul></div>
                    </div>
                  )}
                </div>
                <div className="mt-4 flex items-center gap-2 text-xs text-[#7c8581]"><ShieldIcon className="size-4" /> {approved ? "Approved preview only. Nothing was sent to an external system." : "Preview only. Output remains locked until explicit approval."}</div>
              </div>
            </div>
          </section>
        )}
      </main>

      {selected && (
        <div className="fixed inset-0 z-50 flex justify-end bg-[#102c27]/35 backdrop-blur-[2px]" role="dialog" aria-modal="true" aria-label={`Review finding ${selected.id}`}>
          <button className="absolute inset-0 cursor-default" onClick={() => setSelectedId(null)} aria-label="Close finding detail" />
          <aside className="relative h-full w-full max-w-[660px] overflow-y-auto bg-[#f8f7f2] shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[#deddd4] bg-[#f8f7f2]/95 px-6 py-4 backdrop-blur">
              <div className="flex items-center gap-2"><span className="font-mono text-xs font-bold">{selected.id}</span><span className={`severity-label severity-text-${selected.severity}`}>{selected.severity}</span><StatusPill state={selected.state} /></div>
              <button onClick={() => setSelectedId(null)} className="grid size-9 place-items-center rounded-full hover:bg-[#e9e8e0]" aria-label="Close"><XIcon /></button>
            </div>
            <div className="px-6 py-7 sm:px-8">
              <p className="eyebrow">Finding review</p>
              <h2 className="mt-3 font-serif text-4xl leading-[1.04]">{selected.summary}</h2>
              <p className="mt-5 text-sm leading-6 text-[#63706b]">{selected.explanation}</p>
              <div className="mt-8 grid gap-4 sm:grid-cols-2">
                <label className="text-xs font-bold">Assigned owner
                  <select value={selected.owner} onChange={(event) => patchFinding(selected.id, { owner: event.target.value })} className="form-control">
                    {ownerOptions.map((owner) => <option key={owner}>{owner}</option>)}
                  </select>
                </label>
                <div><p className="text-xs font-bold">Workstream</p><div className="form-control capitalize">{selected.workstream}</div></div>
              </div>
              <label className="mt-5 block text-xs font-bold">Reviewer-edited finding
                <textarea value={selected.summary} onChange={(event) => patchFinding(selected.id, { summary: event.target.value })} className="form-control min-h-24 resize-none font-normal leading-5" />
              </label>
              <label className="mt-5 block text-xs font-bold">Reviewer note
                <textarea value={selected.reviewNote} onChange={(event) => patchFinding(selected.id, { reviewNote: event.target.value })} className="form-control min-h-20 resize-none font-normal leading-5" placeholder="Optional context for the decision record…" />
              </label>
              <div className="mt-8">
                <div className="flex items-end justify-between"><div><p className="eyebrow">Supporting evidence</p><h3 className="mt-2 text-lg font-bold">{selected.citations.length} cited source{selected.citations.length === 1 ? "" : "s"}</h3></div><span className="text-[10px] font-bold uppercase tracking-wider text-[#72807b]">Source-linked</span></div>
                <div className="mt-4 space-y-3">
                  {selected.citations.map((citation, index) => {
                    const source = sources.get(citation.sourceId);
                    const value = source ? pointerValue(source, citation.location.jsonPointer) : undefined;
                    return (
                      <div key={citation.id} className="rounded-xl border border-[#d8d7ce] bg-white p-4">
                        <div className="flex items-start gap-3">
                          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-[#edf0eb] text-[#527064]"><FileIcon className="size-4" /></span>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap justify-between gap-2"><p className="text-xs font-bold">{source?.title ?? citation.sourceId}</p><span className="font-mono text-[9px] text-[#929995]">Evidence {index + 1}</span></div>
                            <p className="mt-1 break-all font-mono text-[10px] text-[#89918d]">{citation.location.jsonPointer}</p>
                            <blockquote className="mt-3 border-l-2 border-[#c46d50] pl-3 text-xs leading-5 text-[#586762]">“{value === null ? "Not provided" : String(value ?? citation.location.excerpt)}”</blockquote>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="mt-6 rounded-xl bg-[#ebeae3] p-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#89918d]">Recommended next action</p>
                <p className="mt-2 text-sm leading-6">{selected.recommendedNextAction}</p>
              </div>
            </div>
            <div className="sticky bottom-0 flex items-center justify-between gap-4 border-t border-[#deddd4] bg-[#f8f7f2]/95 px-6 py-4 backdrop-blur sm:px-8">
              <p className="text-xs text-[#77817d]">{selected.reviewed ? "Review complete" : isRequired(selected) ? "Required before decision" : "Optional review"}</p>
              <button onClick={() => { patchFinding(selected.id, { reviewed: !selected.reviewed }); setSelectedId(null); }} className={selected.reviewed ? "secondary-button" : "primary-button"}>
                {selected.reviewed ? "Reopen review" : <><CheckIcon className="size-4" /> Mark reviewed</>}
              </button>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
