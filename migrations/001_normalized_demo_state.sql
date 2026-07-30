PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS sources (
  id TEXT PRIMARY KEY, deal_id TEXT NOT NULL, authority_level TEXT NOT NULL,
  title TEXT NOT NULL, payload_json TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS extracted_facts (
  id TEXT PRIMARY KEY, deal_id TEXT NOT NULL, epistemic_state TEXT NOT NULL,
  field TEXT NOT NULL, payload_json TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS findings (
  id TEXT PRIMARY KEY, deal_id TEXT NOT NULL, epistemic_state TEXT NOT NULL,
  severity TEXT NOT NULL, payload_json TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS readiness_workstreams (
  id TEXT PRIMARY KEY, deal_id TEXT NOT NULL, status TEXT NOT NULL, payload_json TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS clarification_tasks (
  id TEXT PRIMARY KEY, deal_id TEXT NOT NULL, status TEXT NOT NULL, payload_json TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS reviewer_decisions (
  id TEXT PRIMARY KEY, deal_id TEXT NOT NULL, outcome TEXT NOT NULL,
  reviewer_id TEXT NOT NULL, decided_at TEXT NOT NULL, explicitly_approved INTEGER NOT NULL CHECK (explicitly_approved = 1),
  payload_json TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS approved_baseline_outputs (
  id TEXT PRIMARY KEY, deal_id TEXT NOT NULL, decision_id TEXT NOT NULL UNIQUE,
  approved_by TEXT NOT NULL, approved_at TEXT NOT NULL, payload_json TEXT NOT NULL,
  FOREIGN KEY (decision_id) REFERENCES reviewer_decisions(id)
);
CREATE TABLE IF NOT EXISTS prompt_runs (
  id TEXT PRIMARY KEY, deal_id TEXT NOT NULL, prompt_id TEXT NOT NULL, prompt_version TEXT NOT NULL,
  adapter_mode TEXT NOT NULL, model TEXT NOT NULL, input_reference TEXT NOT NULL,
  status TEXT NOT NULL, started_at TEXT NOT NULL, completed_at TEXT NOT NULL, payload_json TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS citations (
  id TEXT NOT NULL, owner_kind TEXT NOT NULL CHECK (owner_kind IN ('fact', 'finding', 'readiness')),
  owner_id TEXT NOT NULL, source_id TEXT NOT NULL, location_json TEXT NOT NULL,
  PRIMARY KEY (owner_kind, owner_id, id), FOREIGN KEY (source_id) REFERENCES sources(id)
);
CREATE INDEX IF NOT EXISTS sources_deal_idx ON sources(deal_id);
CREATE INDEX IF NOT EXISTS facts_deal_idx ON extracted_facts(deal_id);
CREATE INDEX IF NOT EXISTS findings_deal_idx ON findings(deal_id);
CREATE INDEX IF NOT EXISTS prompt_runs_deal_idx ON prompt_runs(deal_id);
