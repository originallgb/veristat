# x402 Bazaar listing mechanics

Fetched 2026-07-12 from https://docs.cdp.coinbase.com/x402/bazaar (+ x402
GitBook, x402-foundation GitHub).

## The mechanism

- **No registration step.** The CDP facilitator catalogs a service the first
  time it **settles** a payment for that endpoint. Verify alone is not enough.
- Resource servers must point verify/settle at the CDP facilitator:
  `https://api.cdp.coinbase.com/platform/v2/x402`. CDP API keys are required
  for verify/settle; discovery *read* endpoints need no keys.
- The server registers the Bazaar extension (`bazaarResourceServerExtension`
  in the reference SDK, `@x402/extensions`) and declares discovery metadata
  per discoverable route (`declareDiscoveryExtension`, `discoverable: true`).
  HTTP method is inferred from the route key.
- `paymentPayload.resource` must be present so CDP knows which resource to
  catalog.

## Validation & pitfalls

- The declared `schema.properties.input` undergoes **strict JSON Schema
  validation**. Failure → `"rejected"` status in the `EXTENSION-RESPONSES`
  header on verify/settle responses — and the service silently never lists.
- Known issue (x402-foundation/x402#2112): the CDP facilitator sometimes never
  emits the documented `EXTENSION-RESPONSES` header, so rejection can be
  invisible. Mitigation: poll the discovery endpoint after settling
  (`scripts/check-bazaar.mjs`) rather than trusting the header alone.
- **30-day recency filter**: resources with at least one historical call but
  no activity in the last 30 days are excluded from discovery results. A
  monthly canary call keeps the listing alive.

## Testnet rehearsal

- Base Sepolia (and Solana Devnet) work through the CDP facilitator with the
  same API keys; the same discovery endpoints surface the service after a
  settled testnet payment.
- The independent x402.org facilitator keeps a separate test catalog:
  `https://x402.org/facilitator/discovery/resources`.
- Buyer wallets need **USDC only, no gas** — the exact scheme is EIP-3009
  `transferWithAuthorization`; the facilitator submits and pays gas.
  Faucet: https://faucet.circle.com (20 USDC / address / 2h, Base Sepolia).

## Corrected market calibration (2026-07-12, live probe)

The strategy session's "~100 Bazaar listings" figure was **one page of an
offset-paginated API**, not the total. Live probe of
`GET /v2/x402/discovery/resources`:

- `pagination.total` = **25,481 resources** (limit/offset pagination,
  default page 20, max observed 100)
- items carry a `quality` field — CDP is already ranking listings
- x402.org's facilitator exposes **no public discovery catalog** (only
  /verify, /settle, /supported — the documented test-catalog path 404s), so
  testnet listing rehearsal must go through the CDP facilitator + keys.

Consequences: shelf space is far more crowded than the thesis assumed;
discoverability will depend on search/quality ranking and the registry-facing
description, not on being one of a hundred. The demand-side ship gate
(10 organic wallets/30d) is unchanged — it was designed to answer exactly
this uncertainty.

## Discovery consumption (how buyers find us)

- Machine-readable catalog + an MCP endpoint on the discovery API
  (`GET /v2/x402/discovery/mcp` — `search_resources`, `proxy_tool_call`), so
  agents can find and call listed services without bespoke integration.
- x402scan independently indexes x402 traffic on Base.

Sources:
- https://docs.cdp.coinbase.com/x402/bazaar
- https://x402.gitbook.io/x402/core-concepts/bazaar-discovery-layer
- https://github.com/x402-foundation/x402/issues/2112
- https://faucet.circle.com
