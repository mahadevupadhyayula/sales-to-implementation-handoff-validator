# Deterministic reconciliation policy

The reconciliation layer ranks source types from strongest to weakest as follows:

1. Executed commercial document
2. Approved solution design
3. Customer security and data requirements
4. Implementation readiness checklist
5. Discovery evidence
6. CRM record
7. Informal sales handoff note

Authority is used to explain and order evidence, never to discard a contradictory claim. Conflicts retain citations to every material source.

Recency is a tie-breaker only between records at the same authority level; the newest `recordedAt` value sorts first. A newer lower-authority record does not override a stronger source. Explicit customer requirements are represented by their dedicated authority level and remain visible when they conflict with an approved design or executed agreement.

Required-field, conflict, dependency, and checklist rules are deterministic and credential-free. The expected-findings fixture is evaluation-only and is not read by individual rules when deciding whether to emit a finding.
