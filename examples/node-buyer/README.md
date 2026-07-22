# Veristat Node buyer example — no payment

This copyable example connects to the public MCP endpoint, lists the public
tools, retrieves the free sample verdict, and deliberately stops after it
receives the unpaid x402 challenge. It has no wallet, signer, payment client,
or secret configuration; this default path cannot spend money.

Use only the committed synthetic request. Veristat's privacy and retention
policy is still being decided, so real-content guidance is intentionally not
published yet. Do not substitute customer, proprietary, or sensitive content.

## Requirements and install

- Node.js 22 or later.
- No Anthropic, OpenAI, Google, Coinbase, Cloudflare, or wallet credentials.

Copy this whole directory into a fresh folder, then run:

```sh
npm ci
npm run unpaid
```

The committed lockfile pins this example's two runtime dependencies. A clean
temporary-directory `npm ci` is part of its verification path.

The public rehearsal Worker currently serves an older public price-card
contract than this source tree. Until the release-truth gate in
`docs/context/current-state.md` is closed, the example is expected to reject
that mismatch instead of silently accepting stale terms.

To use a local development server instead of the public rehearsal endpoint:

```sh
VERISTAT_URL=http://127.0.0.1:8787/mcp npm run unpaid
```

The public default is a Base Sepolia rehearsal target, not a mainnet launch
endpoint. This example never retries the challenge with payment.

## What the output proves

| Step | What happens | Can it spend? |
|---|---|---|
| Initialize and list tools | Completes the MCP handshake and checks the two buyer tools | No |
| Free sample | Reads the published verdict class, current fulfilled panel size, and price | No |
| Unpaid `consensus_check` | Receives and validates the x402 402 contract | No |

The output is an allowlisted summary only: tool names, the sample verdict
class/three-panel/$0.50 summary, and public payment requirement fields
(scheme, network, amount, asset, payee, resource URL, and Bazaar transport).
It does not print the signed quote token, payment material, or the synthetic
request.

Today Veristat uses three vendors in its fulfilled panel. `panel_size: 5` is
accepted for compatibility but is still fulfilled and priced as the current
three-panel service. Inputs over roughly 8k tokens receive a $0.50 surcharge;
the committed small synthetic request must instead quote $0.50.

## Why the local dispatcher matters

`mcp-fetch.mjs` uses a dedicated `undici` dispatcher. Do not replace it with
global `fetch`: on affected Node versions, an open MCP SSE stream can deadlock
a same-origin request. The example's local dispatcher avoids that failure.
