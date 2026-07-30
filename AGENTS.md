# Sales-to-Implementation Handoff Validator Operating Manual

## Mission and decision boundary

Build a reviewer-first, synthetic-data demonstration that helps an implementation manager choose one of four outcomes for a sales handoff: **accept**, **accept with conditions**, **return for clarification**, or **escalate**. This repository is a prototype for implementation intelligence, not a production integration or an autonomous decision maker.

## Required reading and phase discipline

Before changing a phase, read the local source material in `docs/implementation-intelligence/` and the build map in `docs/implementation-intelligence/BUILD_MAP.md`. Before starting a phase, also read and apply the named workflow skill from the build plan:

- Phase 0: Prompt Registry and Evals.
- Phase 1: Workflow Demo Scenario Fixtures.
- Phases 2–4: Workflow Evidence Reconciliation (plus Workflow Test Suite in Phases 2–3 and Prompt Registry and Evals in Phase 4).
- Phases 5–6: Workflow Human Review UI (plus Workflow Test Suite in Phase 6).
- Phase 7: Prompt Registry and Evals, Workflow Test Suite, Workflow Demo Evaluation, and Workflow CI.

If a named skill or source document is unavailable in the environment, record that limitation rather than inventing its contents. Do not silently weaken the requirements below.

## Non-negotiable product rules

1. **Human approval is mandatory.** AI and deterministic rules may propose facts, findings, questions, and a decision, but no downstream output may be marked approved until a human reviewer explicitly approves it. Persist the reviewer identity, decision, timestamp, and relevant edits.
2. **Synthetic data only.** Fixtures and seeded databases must contain fictional organizations, people, deals, and evidence. Never add real customer, employee, CRM, contract, email, or project data.
3. **Evidence is required.** Every material finding and extracted fact must retain source-record and source-location citations. Preserve contradictory evidence; never collapse a conflict into an unsupported assertion.
4. **Keep epistemic states separate.** Confirmed facts, assumptions, unresolved items, conflicts, and AI suggestions must be separately typed, stored, and presented. AI suggestions are never displayed as confirmed facts.
5. **Validate every boundary.** Use Zod for JSON fixtures, database ingress/egress, server actions and route handlers, AI inputs, and AI structured outputs. Reject invalid data explicitly.
6. **Version and evaluate prompts.** Store prompts in `src/server/ai/prompts/registry.ts` with stable prompt IDs, explicit versions, Zod output schemas, and acceptance thresholds. Record every prompt run (including deterministic mock runs), model/adapter mode, prompt ID/version, input reference, parsed output or failure, and timestamps in SQLite.
7. **Test gates are part of the product.** Schema, fixture, reconciliation, citation, approval-gate, mock-mode browser-flow, and evaluation-threshold tests must pass before demo readiness is claimed.

## Technical constraints

- Next.js App Router and TypeScript.
- Tailwind CSS for a reviewer-first workspace; do not make chat the primary interface.
- Human-readable JSON source fixtures under `fixtures/` and local SQLite for normalized facts, findings, decisions, and prompt-run audit records.
- One server-only AI adapter under `src/server/ai/`; browser code must never call an AI provider.
- The adapter must provide a deterministic, credential-free mock mode. Any OpenAI-backed mode is optional and server-side only.
- Zod at every data and AI boundary, Vitest for unit/workflow coverage, and Playwright for the reviewer decision path.

## Scope exclusions

Do not add Supabase, a live CRM, live enterprise-system integrations, contract execution, project-management writes, customer-email sending, legal interpretation, autonomous approvals, or autonomous downstream execution. Controlled outputs are previews until a human approves them, and the demo must not transmit them externally.

## Repository conventions

- Keep server-only code in `src/server/` and mark sensitive modules with `server-only` where appropriate.
- Keep domain schemas in `src/domain/`; reuse inferred TypeScript types instead of duplicating boundary shapes.
- Keep fixture source records readable and immutable. Derived/normalized state belongs in SQLite, not back in source JSON.
- Prefer deterministic IDs, clocks, and ordering in fixtures, mock AI output, reconciliation, and tests.
- Treat citations and approval checks as domain invariants, not UI-only validation.
- Database files, Playwright artifacts, coverage, secrets, and `.env*` files must not be committed. Commit fixture JSON and migrations.

## Expected validation commands

Once the corresponding project scripts exist, run all of the following before declaring the implementation ready:

```bash
npm run lint
npm run typecheck
npm run validate:fixtures
npm run test
npm run test:e2e
npm run eval
npm run build
```

Phase 0 changes documentation and planning only. Do not add application behavior during Phase 0.
