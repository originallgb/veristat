# ADR-0003: Verify the live public contract before registry publication

## Status

Accepted

## Date

2026-07-22

## Context

The checked-in registry and public-contract source now describe both accepted
`panel_size` values as the current three-vendor, three-panel $0.50 service. The
active Worker version `7874ca15-2abf-4006-af13-d27fbdb54b47` predates that
change and still serves the older five-panel price-card wording. Offline schema
validation therefore cannot prove that the remote URL in `server.json` serves
the contract being published.

The clean no-spend Node buyer example confirmed this gap by rejecting the stale
free-sample contract on the public rehearsal Worker.

## Decision

Do not tag or publish the official MCP registry entry until an operator:

1. authorizes deployment of the reviewed source;
2. verifies the exact Worker version through `/health`;
3. verifies root and `/price` contract copy;
4. verifies the free sample, methodology, version, and price card; and
5. verifies the unpaid 402 challenge against the exact public `/mcp` endpoint.

This gate is independent of the Bazaar/mainnet gate in ADR-0001.

## Alternatives considered

### Publish because `server.json` validates offline

Rejected. Registry metadata would point buyers at a remote serving different
terms.

### Weaken the source contract to match the stale Worker

Rejected. The current source accurately describes the implemented fulfillment
and quoting behavior; the remote should be brought forward deliberately.

## Consequences

- Registry publication remains blocked despite passing schema validation.
- An operator-approved deployment is the next step, but this ADR does not
  authorize that deployment.
- The buyer example is expected to fail closed against the stale Worker until
  this gate is satisfied.
