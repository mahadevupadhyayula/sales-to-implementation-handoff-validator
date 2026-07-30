# Repository Build Map

This map defines the intended implementation footprint. It does not introduce application behavior.

## Primary reviewer route

- `/handoffs/[dealId]`: reviewer workspace for summary, source evidence, reconciled facts, findings, clarification questions, decision controls, and controlled-output preview.
- `/`: a minimal entry point that lists the synthetic scenarios or redirects to the default scenario; it is not a chat surface.

## Planned files and responsibilities

| Area | Planned location | Responsibility |
| --- | --- | --- |
| App shell | `src/app/layout.tsx`, `src/app/page.tsx` | Global layout and synthetic-scenario entry point. |
| Reviewer workspace | `src/app/handoffs/[dealId]/page.tsx` | Server-rendered reviewer-first route. |
| Mutations | `src/app/handoffs/[dealId]/actions.ts` | Zod-validated reviewer edits and approval-gated decisions. |
| UI | `src/components/reviewer/` | Evidence viewer, fact labels, finding editor, decision panel, and output preview. |
| Domain contracts | `src/domain/schemas/` | Zod schemas for sources, facts, findings, citations, decisions, AI results, and audit records. |
| Synthetic deal rooms | `fixtures/deal-rooms/<scenario-id>/` | Human-readable source JSON, scenario manifest, seeded gaps, and expected findings. |
| Fixture loader | `src/server/fixtures/` | Validated loading of synthetic scenarios only. |
| SQLite | `src/server/db/`, `migrations/` | Connection, migrations, repositories, and deterministic seed workflow. |
| Reconciliation | `src/server/reconciliation/` | Source authority, fact labels, conflict preservation, citations, and deterministic rules. |
| AI boundary | `src/server/ai/adapter.ts` | Single server-side interface with deterministic mock and optional OpenAI implementation. |
| Prompt registry | `src/server/ai/prompts/registry.ts` | Stable prompt IDs, versions, structured-output Zod schemas, and acceptance thresholds. |
| Prompt audit | `src/server/ai/prompt-runs.ts` | Persist inputs by reference, parsed results/failures, mode/model, and prompt metadata. |
| Unit/workflow tests | `tests/unit/`, `tests/workflow/` | Schemas, reconciliation, citation coverage, and approval gates. |
| Browser tests | `tests/e2e/reviewer-decision.spec.ts` | Credential-free mock-mode reviewer decision path. |
| Evaluation | `evals/` | Seeded-finding recall, citation coverage, unsupported assertions, reviewer agreement, and readiness thresholds. |
| CI | `.github/workflows/ci.yml` | Type, schema, fixture, test, mock browser, build, and evaluation gates. |

## Planned normalized records

SQLite will store normalized source references, facts, findings, citations, unresolved conflicts, reviewer decisions/edits, controlled-output approval state, and prompt-run audit records. Migrations will encode the separation among confirmed facts, assumptions, unresolved items, conflicts, and AI suggestions.

## Approval flow

1. Load and validate a synthetic deal-room fixture.
2. Reconcile evidence deterministically without discarding conflicts.
3. Optionally obtain typed suggestions through the one server-side AI adapter.
4. Present findings with inspectable citations and editable labels/content.
5. Require an explicit reviewer choice and approval action.
6. Persist the reviewed decision and expose only an approved controlled-output preview; never send it to an external system.

## Validation plan

```bash
npm run lint
npm run typecheck
npm run validate:fixtures
npm run test
npm run test:e2e
npm run eval
npm run build
```

CI will execute the same checks in deterministic mock mode and without OpenAI credentials.
