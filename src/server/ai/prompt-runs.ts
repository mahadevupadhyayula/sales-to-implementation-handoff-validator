import "server-only";
import type Database from "better-sqlite3";
import { promptRunAuditSchema, type PromptRunAudit } from "../../domain/schemas/audit";

export function persistPromptRun(database: Database.Database, input: unknown): PromptRunAudit {
  const run = promptRunAuditSchema.parse(input);
  database.prepare(`
    INSERT INTO prompt_runs (
      id, deal_id, prompt_id, prompt_version, adapter_mode, model, input_reference,
      status, started_at, completed_at, payload_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    run.id, run.dealId, run.promptId, run.promptVersion, run.adapterMode, run.model,
    run.inputReference, run.status, run.startedAt, run.completedAt, JSON.stringify(run),
  );
  return run;
}
