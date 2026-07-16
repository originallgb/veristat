# ADR-0001: Close or explicitly waive Bazaar discovery before mainnet

## Status

Accepted

## Date

2026-07-16

## Context

Veristat completed two successful Base Sepolia settlements through the CDP
facilitator. Both returned a sanitized Bazaar extension status of `processing`,
but the resource remained absent from merchant lookup and repeated full-catalog
scans well beyond CDP's documented cache window. The unpaid MCP challenge is
SDK-valid and includes the expected absolute resource URL and MCP discovery
metadata.

Moving directly to mainnet would spend real USDC without knowing whether the
primary automatic distribution channel can catalog this MCP resource. It would
also make payment and indexing changes harder to distinguish.

## Decision

Keep `NETWORK=eip155:84532` until one controlled diagnostic settlement has:

1. run on an x402 dependency-aligned deployment;
2. produced a sanitized challenge/receipt evidence file;
3. captured the facilitator's sanitized extension status;
4. been checked through merchant, semantic-search, and exact catalog paths at
   10, 30, and 60 minutes; and
5. either appeared in the Bazaar or been escalated upstream with reproducible,
   secret-free evidence.

The operator may waive this gate explicitly. A waiver must be recorded in the
roadmap/session log and acknowledge that the mainnet canary may settle without
creating a Bazaar listing.

## Alternatives considered

### Continue waiting without another settlement

Rejected. The previous wait already exceeded the documented cache interval and
does not distinguish stale deployment code from downstream indexing failure.

### Switch to mainnet and use the first real payment as the diagnostic

Rejected by default. It introduces real-funds risk before the cheaper testnet
diagnostic has been made reproducible.

### Treat `processing` as confirmation of listing

Rejected. `processing` means the facilitator accepted asynchronous extension
work; it is not proof that a catalog record was written.

## Consequences

- Mainnet cutover remains intentionally gated.
- The next testnet call is singular and evidence-producing, not repeated
  trial-and-error spending.
- Bazaar outages do not become an indefinite blocker: a documented operator
  waiver is available after the evidence is escalated.
- Secrets and payment payloads stay out of tracked artifacts.
