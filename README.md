# Sales-to-Implementation Handoff Validator

A reviewer-first demonstration using wholly synthetic data. It detects seeded handoff gaps, preserves source citations and epistemic states, and requires an implementation manager to approve one of four controlled outcomes. Nothing is transmitted to an external system.

## Run the synthetic scenario

Requires Node.js 22+.

```bash
npm ci
npm run dev
```

Open `http://localhost:3000/handoffs/deal-nhl-2027-001`. Review every critical and high finding, inspect its evidence, assign owners, continue to the decision view, and approve a disposition. The resulting baseline, tasks, and kickoff brief are simulated previews only.

No credentials are needed. The AI adapter uses deterministic mock mode when no API key is provided; CI explicitly selects mock mode.

## Validate demo readiness

```bash
npm run typecheck
npm run lint
npm run validate:fixtures
npm run test:reconciliation
npm run test:approval-gate
npm run test
npm run eval
npm run build
npm run test:e2e
```

`npm run eval` compares reconciliation output with `fixtures/deal-rooms/northstar-telemetry/expected-findings.json`. It fails unless seeded-finding recall and citation coverage are 100%, unsupported confirmed assertions and reviewer corrections are zero, and all structured output is valid. The report includes seeded gaps, citation validity, prompt ID/version, deterministic model settings, fixture version, reviewer edits, and the final validation result.

Pull requests run these deterministic checks plus the complete mock-mode browser decision flow. CI uses only synthetic fixtures and does not validate live integrations, production data, or customer outcomes.
