# Approved solution design v3

> **Synthetic record.** Approved for the fictional commercial proposal.

**Record:** `src-approved-solution-design` · **Approved:** January 8, 2027

## Architecture

A single OrbitSignal production tenant uses US-hosted primary storage. All
tenant data—including Canadian operations data—is stored and processed in the
United States. SAML SSO uses the customer identity provider, with a local
break-glass administrator retained.

| System | Pattern | Direction | Cadence |
| --- | --- | --- | --- |
| FleetAxis | Standard connector | Bidirectional | Every 15 minutes |
| ClearLedger | Managed SFTP export | Outbound | Nightly |

Only a **Production** environment is listed. The migration design covers 24
months and approximately 1.2 million records, supplied as one cleansed customer
extract.

## Assumptions

- The FleetAxis standard connector supports all required dispatch fields.
- The customer identity team can configure SAML within five business days.
- The customer will provide one consolidated, cleansed historical extract.
