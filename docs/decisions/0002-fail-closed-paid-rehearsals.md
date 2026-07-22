# ADR-0002: Fail closed on every operator-triggered paid rehearsal

## Status

Accepted

## Date

2026-07-22

## Context

The original `scripts/e2e.mjs`, `scripts/paid-call.mjs`, and manual CI job could
construct a signer whenever a buyer key was present. They accepted a configurable
network, allowed up to $3, and did not validate every field of the exact challenge
used by the payment wrapper. A stale or changed challenge could therefore spend
outside the intended controlled Base Sepolia rehearsal contract.

## Decision

Every operator-triggered paid rehearsal must:

1. require `ENABLE_PAID_CALL=1` before reading the buyer key or connecting;
2. reject every network except `eip155:84532`;
3. validate the exact challenge observed by the payment wrapper, including x402
   version, resource, scheme, amount, Base Sepolia USDC asset, receiver, Bazaar
   metadata, and signed quote;
4. cap the approved synthetic call at exactly 500,000 atomic USDC ($0.50);
5. revalidate retry requirements before approving a signature; and
6. run the manual paid CI job only after the credential-free test job succeeds.

The no-spend buyer example remains a separate path and contains no signer or
payment client.

## Alternatives considered

### Rely only on the client payment cap

Rejected. A cap limits amount but does not validate network, asset, receiver,
resource, discovery metadata, or the exact challenge that will be signed.

### Treat possession of a buyer key as authorization

Rejected. Ambient credentials must not imply approval to spend.

### Keep the $3 cap for future pricing flexibility

Rejected for the controlled rehearsal. Future prices require a reviewed policy
change rather than unused spend headroom.

## Consequences

- Existing shorthand paid commands now fail until explicitly enabled.
- Mainnet execution through these operator scripts is intentionally impossible.
- Any change to the test receiver, asset, price, or discovery contract requires
  a reviewed source and test update.
- This ADR does not authorize a paid call.
