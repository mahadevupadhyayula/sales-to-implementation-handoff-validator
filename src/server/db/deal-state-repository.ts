import "server-only";
import type Database from "better-sqlite3";
import { normalizedDealStateSchema, type NormalizedDealState } from "../../domain/schemas/deal-room";
import type { Citation } from "../../domain/schemas/evidence";
import { identifierSchema } from "../../domain/schemas/common";
import { approvedBaselineOutputSchema, reviewerDecisionSchema } from "../../domain/schemas/workflow";

type RecordWithId = { id: string; dealId: string };
type SqlValue = string | number | bigint | null | Uint8Array;

function insertPayload(database: Database.Database, table: string, columns: string[], values: SqlValue[], record: RecordWithId): void {
  database.prepare(`INSERT INTO ${table} (id, deal_id, ${columns.join(", ")}, payload_json) VALUES (?, ?, ${columns.map(() => "?").join(", ")}, ?)`)
    .run(record.id, record.dealId, ...values, JSON.stringify(record));
}

function insertCitations(database: Database.Database, kind: "fact" | "finding" | "readiness", ownerId: string, citations: Citation[]): void {
  const statement = database.prepare("INSERT INTO citations (id, owner_kind, owner_id, source_id, location_json) VALUES (?, ?, ?, ?, ?)");
  for (const citation of citations) statement.run(citation.id, kind, ownerId, citation.sourceId, JSON.stringify(citation.location));
}

export function replaceDealState(database: Database.Database, input: unknown): NormalizedDealState {
  const state = normalizedDealStateSchema.parse(input);
  database.exec("BEGIN IMMEDIATE");
  try {
    for (const table of ["citations", "approved_baseline_outputs", "prompt_runs", "reviewer_decisions", "clarification_tasks", "readiness_workstreams", "findings", "extracted_facts", "sources"]) {
      const dealColumn = table === "citations" ? "owner_id IN (SELECT id FROM extracted_facts WHERE deal_id = ?) OR owner_id IN (SELECT id FROM findings WHERE deal_id = ?) OR owner_id IN (SELECT id FROM readiness_workstreams WHERE deal_id = ?)" : "deal_id = ?";
      const statement = database.prepare(`DELETE FROM ${table} WHERE ${dealColumn}`);
      if (table === "citations") statement.run(state.dealId, state.dealId, state.dealId); else statement.run(state.dealId);
    }
    for (const source of state.sources) insertPayload(database, "sources", ["authority_level", "title"], [source.authorityLevel, source.title], source);
    for (const fact of state.facts) { insertPayload(database, "extracted_facts", ["epistemic_state", "field"], [fact.state, fact.field], fact); insertCitations(database, "fact", fact.id, fact.citations); }
    for (const finding of state.findings) { insertPayload(database, "findings", ["epistemic_state", "severity"], [finding.state, finding.severity], finding); insertCitations(database, "finding", finding.id, finding.citations); }
    for (const readiness of state.readiness) { insertPayload(database, "readiness_workstreams", ["status"], [readiness.status], readiness); insertCitations(database, "readiness", readiness.id, readiness.citations); }
    for (const task of state.clarificationTasks) insertPayload(database, "clarification_tasks", ["status"], [task.status], task);
    for (const decision of state.decisions) insertPayload(database, "reviewer_decisions", ["outcome", "reviewer_id", "decided_at", "explicitly_approved"], [decision.outcome, decision.reviewerId, decision.decidedAt, 1], decision);
    for (const output of state.approvedOutputs) insertPayload(database, "approved_baseline_outputs", ["decision_id", "approved_by", "approved_at"], [output.decisionId, output.approvedBy, output.approvedAt], output);
    for (const run of state.promptRuns) insertPayload(database, "prompt_runs", ["prompt_id", "prompt_version", "adapter_mode", "model", "input_reference", "status", "started_at", "completed_at"], [run.promptId, run.promptVersion, run.adapterMode, run.model, run.inputReference, run.status, run.startedAt, run.completedAt], run);
    database.exec("COMMIT");
    return state;
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

function readPayloads(database: Database.Database, table: string, dealId: string): unknown[] {
  return database.prepare(`SELECT payload_json FROM ${table} WHERE deal_id = ? ORDER BY id`).all(dealId).map((row) => JSON.parse((row as { payload_json: string }).payload_json));
}

export function readDealState(database: Database.Database, dealId: string): NormalizedDealState {
  dealId = identifierSchema.parse(dealId);
  return normalizedDealStateSchema.parse({ dealId, sources: readPayloads(database, "sources", dealId), facts: readPayloads(database, "extracted_facts", dealId), findings: readPayloads(database, "findings", dealId), readiness: readPayloads(database, "readiness_workstreams", dealId), clarificationTasks: readPayloads(database, "clarification_tasks", dealId), decisions: readPayloads(database, "reviewer_decisions", dealId), approvedOutputs: readPayloads(database, "approved_baseline_outputs", dealId), promptRuns: readPayloads(database, "prompt_runs", dealId) });
}

export function persistDecisionPackage(database: Database.Database, rawDecision: unknown, rawOutput: unknown): void {
  const decision = reviewerDecisionSchema.parse(rawDecision);
  const output = approvedBaselineOutputSchema.parse(rawOutput);
  if (output.dealId !== decision.dealId || output.decisionId !== decision.id || output.approvedBy !== decision.reviewerId) {
    throw new Error("Controlled output does not match its approved reviewer decision");
  }
  database.transaction(() => {
    insertPayload(database, "reviewer_decisions", ["outcome", "reviewer_id", "decided_at", "explicitly_approved"], [decision.outcome, decision.reviewerId, decision.decidedAt, 1], decision);
    insertPayload(database, "approved_baseline_outputs", ["decision_id", "approved_by", "approved_at"], [output.decisionId, output.approvedBy, output.approvedAt], output);
  })();
}
