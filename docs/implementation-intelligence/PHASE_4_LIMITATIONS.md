# Phase 4 workflow-source status

The **Prompt Registry and Evals** and **Workflow Evidence Reconciliation** skills were applied to the bounded server-side extraction adapter, structured output contract, prompt registration, prompt-run audit, citation validation, deterministic mock mode, and authority boundary.

The authoritative documents listed in `README.md` were recovered from two byte-identical local source sets and imported on 2026-07-30. Phase 4 was reviewed against those documents.

## Phase 4 conformance

- Uses only the bounded synthetic deal-room sources defined by the workflow.
- Extracts structured evidence, uncertainty, clarification questions, and an internal kickoff-brief draft.
- Preserves source IDs and field-level locations for every material AI-generated claim.
- Distinguishes direct evidence from inference and requires uncertainty for inference.
- Treats deterministic, source-ranked reconciliation as authoritative.
- Produces only `ai_suggestion` output and cannot create a reviewer decision.
- Uses one server-only adapter, with deterministic mock operation when credentials are absent.
- Persists prompt identity, version, fixture version, model settings, raw and parsed results, validation status, mode, and timestamps.
- Registers both the prompt input and output schemas as versioned contracts.
- Enforces explicit uncertainty for every inferred extracted-evidence and kickoff-brief item.
- Runs a credential-free synthetic evaluation gate against the registered thresholds.
- Performs no live write-back, customer communication, legal interpretation, or autonomous implementation action.

The controlled `northstar-telemetry` evaluation currently reports schema validity `1.0`, citation coverage `1.0`, seeded-finding recall `1.0`, unsupported assertions `0`, reviewer correction rate `0`, and false-positive findings `0`. These are synthetic fixture results, not customer outcomes.

The repository does not yet contain the planned reviewer UI from Phases 5–6. Phase 4 exposes validated structured extraction for that future interface and verifies it at the server/workflow boundary; it does not add an out-of-sequence UI.
