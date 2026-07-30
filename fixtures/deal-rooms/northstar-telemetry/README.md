# Northstar Telemetry synthetic deal room

This fixture is a wholly fictional, closed-won enterprise deal created for the
Implementation Intelligence demo. Names, organizations, dates, commercial
terms, systems, and requirements are synthetic and must not be treated as real
customer data.

The source of truth for machine-readable evidence is `sources/*.json`. Matching
documents in `documents/*.md` make the same controlled source set easy for a
human reviewer to read. `expected-findings.json` is evaluation-only ground
truth; an implementation workflow must not expose it as customer evidence.

## Scenario

Fictional customer **Northstar Harbor Logistics** purchased the fictional
**OrbitSignal Operations Cloud** from fictional vendor **Cindercone Systems**.
The deal is closed-won, but the handoff deliberately contains twelve material
gaps and contradictions that should be resolved before implementation begins.

## Phase 1 limitations

The required **Workflow Demo Scenario Fixtures** skill was not installed in the
execution environment. The three source documents named in
`docs/implementation-intelligence/README.md` were also unavailable. This fixture
therefore applies the repository operating manual and build map without
inventing the missing materials' contents.
