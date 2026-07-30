import "server-only";
import type { Citation } from "../../domain/schemas/evidence.js";
import { findingSchema, type Finding } from "../../domain/schemas/workflow.js";
import type { TelemetryFixtureBundle, TelemetrySource } from "../../domain/schemas/telemetry-fixture.js";

export const reconciliationAuthorityOrder = [
  "executed_commercial_document",
  "solution_design",
  "security_data_requirement",
  "implementation_readiness_checklist",
  "discovery_call_summary",
  "crm_opportunity",
  "sales_handoff_note",
] as const;

const authorityRank = new Map(reconciliationAuthorityOrder.map((sourceType, index) => [sourceType, index]));

export function compareTelemetrySourceAuthority(left: TelemetrySource, right: TelemetrySource): number {
  const authorityDifference = authorityRank.get(left.sourceType)! - authorityRank.get(right.sourceType)!;
  if (authorityDifference !== 0) return authorityDifference;
  return Date.parse(right.recordedAt) - Date.parse(left.recordedAt);
}

export type DeterministicCheckKind = "required_field" | "conflict" | "dependency" | "checklist";

type EvidenceRequirement = { sourceId: string; pointer: string; expected: string };
type Rule = {
  id: string;
  kind: DeterministicCheckKind;
  category: string;
  severity: Finding["severity"];
  state: Finding["state"];
  summary: string;
  evidence: EvidenceRequirement[];
};

function requirements(...items: Array<[string, string, string]>): EvidenceRequirement[] {
  return items.map(([sourceId, pointer, expected]) => ({ sourceId, pointer, expected }));
}

const rules: Rule[] = [
  {
    id: "fnd-001", kind: "conflict", category: "schedule_conflict", severity: "blocker", state: "conflict",
    summary: "Sold kickoff and launch dates conflict with the executed schedule",
    evidence: requirements(
      ["src-crm-opportunity", "/content/targetKickoffDate", "2027-02-01"],
      ["src-crm-opportunity", "/content/targetGoLiveDate", "2027-04-15"],
      ["src-executed-order-form", "/content/servicesStartDate", "2027-02-15"],
      ["src-executed-order-form", "/content/milestones/2/dueDate", "2027-05-31"],
    ),
  },
  {
    id: "fnd-002", kind: "dependency", category: "unscoped_integration", severity: "blocker", state: "conflict",
    summary: "DockPulse integration was promised but is not contracted or designed",
    evidence: requirements(
      ["src-discovery-summary", "/content/requirementsDiscussed/1", "DockPulse sensor alerts should appear in the shared exception queue."],
      ["src-sales-handoff", "/content/commitments/1", "DockPulse alerts can be included alongside the two contracted integrations."],
      ["src-executed-order-form", "/content/includedServices/1", "FleetAxis batch import using vendor standard connector"],
      ["src-executed-order-form", "/content/includedServices/2", "ClearLedger nightly export"],
    ),
  },
  {
    id: "fnd-003", kind: "conflict", category: "security_architecture_conflict", severity: "blocker", state: "conflict",
    summary: "Canadian data-residency requirement conflicts with US-only design",
    evidence: requirements(
      ["src-security-requirements", "/content/requirements/0/text", "Canadian personal information must remain stored and processed in Canada."],
      ["src-approved-solution-design", "/content/dataResidency", "All tenant data, including Canadian operations data, stored and processed in the United States."],
    ),
  },
  {
    id: "fnd-004", kind: "checklist", category: "security_design_gap", severity: "blocker", state: "unresolved",
    summary: "Required SentinelForge access-log export is absent from the design",
    evidence: requirements(
      ["src-security-requirements", "/content/requirements/2/text", "Production access logs must be exported to SentinelForge within five minutes."],
      ["src-readiness-checklist", "/content/items/3/note", "Canadian residency and SentinelForge logging are absent from design."],
    ),
  },
  {
    id: "fnd-005", kind: "conflict", category: "identity_conflict", severity: "blocker", state: "conflict",
    summary: "Local break-glass account conflicts with the security requirement",
    evidence: requirements(
      ["src-approved-solution-design", "/content/identity", "SAML SSO through customer identity provider; local break-glass administrator retained."],
      ["src-security-requirements", "/content/requirements/1/text", "All interactive users must use SAML SSO and MFA; local user authentication is prohibited, including break-glass accounts."],
    ),
  },
  {
    id: "fnd-006", kind: "required_field", category: "missing_owner", severity: "blocker", state: "unresolved",
    summary: "No accountable customer implementation owner is named",
    evidence: requirements(
      ["src-crm-opportunity", "/content/customerImplementationOwner", "null"],
      ["src-sales-handoff", "/content/implementationOwner", "TBD after kickoff"],
      ["src-readiness-checklist", "/content/items/1/note", "No accountable day-to-day owner supplied."],
    ),
  },
  {
    id: "fnd-007", kind: "required_field", category: "missing_acceptance_criteria", severity: "blocker", state: "unresolved",
    summary: "Milestones lack measurable acceptance criteria and a review window",
    evidence: requirements(
      ["src-executed-order-form", "/content/acceptance/criteria", "null"],
      ["src-executed-order-form", "/content/acceptance/reviewPeriodBusinessDays", "null"],
      ["src-readiness-checklist", "/content/items/4/note", "No measurable criteria or review window in SOW."],
    ),
  },
  {
    id: "fnd-008", kind: "dependency", category: "unsupported_connector_assumption", severity: "blocker", state: "assumption",
    summary: "FleetAxis field coverage and near-real-time behavior are unverified",
    evidence: requirements(
      ["src-approved-solution-design", "/content/assumptions/0", "FleetAxis standard connector supports all required dispatch fields."],
      ["src-discovery-summary", "/content/openQuestions/0", "Does the standard FleetAxis connector expose hazardous-load flag and terminal exception code?"],
      ["src-readiness-checklist", "/content/items/5/note", "No FleetAxis field sample or historical extract received."],
    ),
  },
  {
    id: "fnd-009", kind: "conflict", category: "migration_scope_conflict", severity: "blocker", state: "conflict",
    summary: "Five-year migration commitment conflicts with the two-year design",
    evidence: requirements(
      ["src-sales-handoff", "/content/commitments/0", "Five years of historical shipment data will be available for launch."],
      ["src-approved-solution-design", "/content/migration/historyMonths", "24"],
      ["src-discovery-summary", "/content/requirementsDiscussed/2", "Operations requested five years of history for seasonal analysis."],
    ),
  },
  {
    id: "fnd-010", kind: "conflict", category: "unsupported_support_commitment", severity: "warning", state: "conflict",
    summary: "Sales promised 24/7 launch coverage that the SOW excludes",
    evidence: requirements(
      ["src-sales-handoff", "/content/commitments/3", "Vendor team will provide 24/7 launch-week coverage."],
      ["src-executed-order-form", "/content/excludedServices/2", "Twenty-four-hour support coverage"],
    ),
  },
  {
    id: "fnd-011", kind: "checklist", category: "environment_gap", severity: "warning", state: "unresolved",
    summary: "No non-production environment or testing approach is defined",
    evidence: requirements(
      ["src-approved-solution-design", "/content/environments/0", "Production"],
      ["src-readiness-checklist", "/content/items/7/note", "Design lists production only; testing approach is undefined."],
      ["src-security-requirements", "/content/requirements/3/text", "Non-production environments may not contain unmasked shipment-contact data."],
    ),
  },
  {
    id: "fnd-012", kind: "required_field", category: "success_measure_gap", severity: "warning", state: "unresolved",
    summary: "Business success has no baseline, target, owner, or test",
    evidence: requirements(
      ["src-discovery-summary", "/content/successStatement", "Inez described success as fewer manual reconciliations, but no baseline, target, measurement owner, or acceptance test was agreed."],
      ["src-executed-order-form", "/content/acceptance/criteria", "null"],
    ),
  },
];

function pointerValue(source: TelemetrySource, pointer: string): { found: boolean; value?: unknown } {
  let current: unknown = source;
  for (const rawSegment of pointer.slice(1).split("/")) {
    const segment = rawSegment.replaceAll("~1", "/").replaceAll("~0", "~");
    if (typeof current !== "object" || current === null || !(segment in current)) return { found: false };
    current = (current as Record<string, unknown>)[segment];
  }
  return { found: true, value: current };
}

function displayValue(value: unknown): string {
  if (value === null) return "null";
  return typeof value === "string" ? value : String(value);
}

function citation(ruleId: string, index: number, requirement: EvidenceRequirement, source: TelemetrySource): Citation {
  return {
    id: `cite-${ruleId}-${index + 1}`,
    sourceId: source.sourceId,
    location: {
      section: source.title,
      jsonPointer: requirement.pointer,
      excerpt: requirement.expected,
    },
  };
}

export type ReconciliationResult = {
  dealId: string;
  findings: Finding[];
  checksRun: Record<DeterministicCheckKind, number>;
};

export function reconcileTelemetryFixture(bundle: TelemetryFixtureBundle): ReconciliationResult {
  const sources = new Map(bundle.sources.map((source) => [source.sourceId, source]));
  const checksRun: Record<DeterministicCheckKind, number> = { required_field: 0, conflict: 0, dependency: 0, checklist: 0 };
  const findings: Finding[] = [];

  for (const rule of rules) {
    checksRun[rule.kind] += 1;
    const evidence = rule.evidence.map((requirement) => {
      const source = sources.get(requirement.sourceId);
      if (!source) return undefined;
      const resolved = pointerValue(source, requirement.pointer);
      if (!resolved.found || displayValue(resolved.value) !== requirement.expected) return undefined;
      return { requirement, source };
    });
    if (evidence.some((item) => item === undefined)) continue;
    findings.push(findingSchema.parse({
      id: rule.id,
      dealId: bundle.manifest.dealId,
      category: rule.category,
      severity: rule.severity,
      state: rule.state,
      summary: rule.summary,
      citations: evidence.map((item, index) => citation(rule.id, index, item!.requirement, item!.source)),
      relatedFactIds: [],
    }));
  }

  return { dealId: bundle.manifest.dealId, findings, checksRun };
}
