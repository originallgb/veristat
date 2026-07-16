# x402 Bazaar listing mechanics

Fetched 2026-07-12 and refreshed 2026-07-16 from
https://docs.cdp.coinbase.com/x402/bazaar (+ CDP API reference,
x402-foundation GitHub, installed SDK behavior, and live endpoint probes).

## The mechanism

- **No registration step.** The CDP facilitator catalogs a service the first
  time it **settles** a payment for that endpoint. Verify alone is not enough.
- Resource servers must point verify/settle at the CDP facilitator:
  `https://api.cdp.coinbase.com/platform/v2/x402`. CDP API keys are required
  for verify/settle; discovery *read* endpoints need no keys.
- The server registers the Bazaar extension (`bazaarResourceServerExtension`
  in the reference SDK, `@x402/extensions`) and declares discovery metadata
  per discoverable route (`declareDiscoveryExtension`). MCP declarations carry
  the tool name, transport, input schema/example, and output metadata.
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
- `{"bazaar":{"status":"processing"}}` means accepted for asynchronous
  processing, not indexed. It has no documented terminal follow-up channel and
  must be paired with discovery reads.
- CDP now provides `POST /v2/x402/validate`, a read-only preflight for ordinary
  HTTP 402 endpoints. Veristat's paid challenge is inside an MCP tool result,
  so `scripts/bazaar-preflight.mjs` validates the actual MCP wire shape instead
  of assuming that the generic HTTP probe models it correctly.
- **30-day recency filter**: resources with at least one historical call but
  no activity in the last 30 days are excluded from discovery results. A
  monthly canary call keeps the listing alive.

## Testnet rehearsal

- Base Sepolia (and Solana Devnet) work through the CDP facilitator with the
  same API keys; the same discovery endpoints surface the service after a
  settled testnet payment.
- CDP's current documentation says the independent x402.org facilitator keeps
  a separate test catalog at
  `https://x402.org/facilitator/discovery/resources`. Live probes on both
  2026-07-12 and 2026-07-16 returned 404 while `/supported` returned 200. Treat
  the catalog claim as documentation/runtime drift; use CDP for rehearsal.
- Buyer wallets need **USDC only, no gas** — the exact scheme is EIP-3009
  `transferWithAuthorization`; the facilitator submits and pays gas.
  Faucet: https://faucet.circle.com (20 USDC / address / 2h, Base Sepolia).

## Corrected market calibration (2026-07-12, live probe)

The strategy session's "~100 Bazaar listings" figure was **one page of an
offset-paginated API**, not the total. Live probe of
`GET /v2/x402/discovery/resources`:

- `pagination.total` = **25,481 resources** at the original probe
  (limit/offset pagination; current documented maximum page size is 1,000)
- items carry a `quality` field — CDP is already ranking listings
- live x402.org probes exposed no discovery catalog (only /verify, /settle,
  /supported; the documented test-catalog path returned 404), so testnet
  listing rehearsal currently goes through the CDP facilitator + keys.

Consequences: shelf space is far more crowded than the thesis assumed;
discoverability will depend on search/quality ranking and the registry-facing
description, not on being one of a hundred. The demand-side ship gate
(10 organic wallets/30d) is unchanged — it was designed to answer exactly
this uncertainty.

## July 16 operational update

- The exact production MCP resource is
  `https://veristat.grant-23a.workers.dev/mcp` and its live unpaid challenge
  advertises x402 v2, exact/Base Sepolia/USDC, the absolute resource URL, and a
  schema-valid `type: "mcp"` Bazaar declaration for `consensus_check` over
  `streamable-http`.
- `@x402/core`, `@x402/evm`, and `@x402/extensions` are aligned at 2.18.x to
  avoid duplicate/mixed protocol implementations.
- Issue #2112 remains open. Field reports now show that ordinary external EOAs
  can index, so a CDP-provisioned payee is neither necessary nor sufficient.
  Other reports show declaration-carrying resources indexing within minutes,
  while individual conforming-looking routes can still be silently skipped.
- Therefore the next diagnostic is one isolated settlement plus joined
  evidence, not wallet churn or repeated paid probes. Check the payee-specific
  merchant endpoint and semantic search first, then the full catalog at +10,
  +30, and +60 minutes. Escalate the sanitized package at +60.
- That controlled diagnostic completed on 2026-07-16: both extension responses
  were `processing`, the chain/D1 evidence was coherent, and exact discovery
  remained empty through +60 minutes. Evidence was attached after the issue
  closed as [x402-foundation/x402#2112 comment 4993727120](https://github.com/x402-foundation/x402/issues/2112#issuecomment-4993727120).

The controlled evidence may retain public URL/chain/catalog identifiers and
sanitized extension status. It excludes private keys, payment signatures or
payloads, quote tokens, JWT/API secrets, vendor keys, prompts/content, full
verdicts, and raw Worker logs.

## Discovery consumption (how buyers find us)

- Machine-readable catalog + an MCP endpoint on the discovery API
  (`GET /v2/x402/discovery/mcp` — `search_resources`, `proxy_tool_call`), so
  agents can find and call listed services without bespoke integration.
- x402scan independently indexes x402 traffic on Base.

Sources:
- https://docs.cdp.coinbase.com/x402/bazaar
- https://docs.cdp.coinbase.com/api-reference/v2/rest-api/x402-facilitator/validate-x402-endpoint
- https://x402.gitbook.io/x402/core-concepts/bazaar-discovery-layer
- https://github.com/x402-foundation/x402/issues/2112
- https://faucet.circle.com
