# Security and data requirements addendum

> **Synthetic record.** Fictional security requirements for demo use only.

**Record:** `src-security-requirements` · **Status:** Conditional approval

Shipment contacts may contain personal information. The following controls are
required:

1. **SEC-01:** Canadian personal information must remain stored and processed
   in Canada.
2. **SEC-02:** Every interactive user must use SAML SSO and MFA. Local
   authentication—including break-glass accounts—is prohibited.
3. **SEC-03:** Production access logs must reach SentinelForge within five
   minutes.
4. **SEC-04:** Non-production environments may not contain unmasked
   shipment-contact data.

Approval remains conditional pending architecture evidence for SEC-01 and
SEC-03. Before production, the customer requires a data-flow diagram, residency
attestation, and logging-integration test evidence.
