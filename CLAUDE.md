# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

An x402-paid multi-model verification MCP server on Cloudflare Workers. Agents call `consensus_check` (paid, USDC via x402), which fans the input to a cross-vendor panel of frontier models (Anthropic + OpenAI + Google) and returns a synthesized structured verdict. The build spec is committed at `docs/SPEC.md`; key decided constraints: pricing model, tool surface, and platform are settled — do not re-litigate.

Start here when picking up work:

- `docs/ROADMAP.md` — launch phases, current status checkboxes, and which items are blocked on operator-supplied accounts/wallets.
- `docs/TESTING.md` — test pyramid, wallet setup runbook, x402 negative-path matrix.
- `docs/RUNBOOK.md` — ops: secrets, D1 dashboard queries, facilitator swap, incidents, CI/CD.
- `docs/STRATEGY.md` — why this exists, pricing rationale, the kill condition.
- `docs/ARCHITECTURE.md` — Cloudflare architecture diagram + payment-flow sequence diagram (happy path + tested failure branches).
- `docs/context/current-state.md` — compact live handoff: deployment identity,
  validated evidence, Bazaar blocker, and exact next action.

## Deploy state

Deployed for a **Base Sepolia rehearsal** at
`https://veristat.grant-23a.workers.dev/mcp` (`NETWORK=eip155:84532`) using the
Coinbase CDP facilitator. D1 `veristat` is wired to
`63379492-64ce-48a0-b39a-82aa54726dae`; `PAY_TO_ADDRESS` is the throwaway
testnet receiver `0x86CdAe1A22458442BaB9E10216a7E96b606d3635`, not the future
mainnet receiver. The active Worker version is
`7874ca15-2abf-4006-af13-d27fbdb54b47`.

Three discovery-bearing payments settled. The final controlled diagnostic
returned Bazaar status `processing` twice, but the resource remained absent
from merchant/search/full-catalog checks through +60 minutes. Evidence is on
x402-foundation/x402#2112. Phase 3 still requires an explicit operator waiver;
do not flip `NETWORK` to `eip155:8453` ad hoc.

## Commands

```sh
npm test                    # vitest — full 402→verify→settle cycle vs mock facilitator
npx vitest run test/x402.test.ts -t "settle"   # single test
npm run typecheck           # tsc (noEmit)
npm run dev                 # wrangler dev on :8787 (needs .dev.vars, see .dev.vars.example)
npm run db:migrate:local    # apply D1 migrations locally (required before first dev run)
node scripts/smoke.mjs      # against a running server: free tool + unpaid 402 challenge (no creds needed)
# with BUYER_PRIVATE_KEY already securely exported:
ENABLE_PAID_CALL=1 NETWORK=eip155:84532 node scripts/paid-call.mjs "claim"   # approved $0.50 Base Sepolia paid e2e
npm run deploy              # wrangler deploy
```

## Architecture

The payment layer and the product pipeline are deliberately decoupled:

- **`src/payments/x402.ts` — `PaymentGate`.** A custom paid-tool wrapper (the agents SDK's `paidTool` only supports static prices; this one computes the price per request). Wire-compatible with `withX402Client` from `agents/x402`: unpaid calls return an `isError` result carrying the 402 payload in `_meta["x402/error"]`; clients retry with a signed payment in `_meta["x402/payment"]`. **Settlement happens only after the tool callback succeeds** — a failed panel must never charge the buyer. The facilitator is injected via `@x402/core`'s `FacilitatorClient` interface: Coinbase CDP is active for the Base Sepolia rehearsal and planned mainnet launch; x402.org remains a plain-testnet option and Cloudflare Gateway is later. Tests inject `test/mock_facilitator.ts`. Receipt logging hooks in via `onSettled`.
- **`src/payments/quoting.ts`** — deterministic pricing from args (the MVP fulfills and quotes both accepted panel sizes as the $0.50 three-panel service, +$0.50 over ~8k tokens) plus HMAC-signed 5-minute quote tokens returned in the 402 `extensions`. Pricing must stay deterministic: the retry re-derives the same amount from the same args.
- **`src/mcp/server.ts` — `VeristatMCP` (McpAgent / Durable Object)** wires tools to the gate. MVP accepts `panel_size: 5` and `mode: adversarial` but hard-routes quoting to 3-panel. `research_fanout`/`get_research_result` are intentional stubs returning `NOT_AVAILABLE`.
- **`src/panel/`** — `providers.ts` (raw fetch clients; vendor diversity is mandatory — never two models from one vendor), `orchestrator.ts` (parallel fan-out, 60s ceiling, degrades at 2/3 with `panel_degraded` flag), `synthesis.ts` (one extra model call, output parsed against `verdictSchema`).
- **`src/prompts/`** — versioned prompt modules; the version string is logged with every request. New prompt = new file (`panel_v2.ts`), never edit-in-place.
- **`src/logging.ts` + `migrations/`** — D1: `settlements` (demand proof, including payer) and `requests` (full submission/panel/verdict for the eval flywheel). The shared request ID makes the tables joinable; see the unresolved privacy/retention plan. Logging must never fail a paid request; errors are swallowed.
- **`src/index.ts`** — Hono for `/`, `/health`, `/price`; `/mcp` is routed to the McpAgent before Hono.

## Deployment

- Cloudflare version metadata is active in `/health`. Verify its `version`
  equals the version ID printed by `wrangler deploy`, preferably with
  `EXPECTED_VERSION=<id> VERISTAT_URL=https://veristat.grant-23a.workers.dev/mcp node scripts/smoke.mjs`.
- `scripts/smoke.mjs` defaults to localhost. A stale `wrangler dev --remote`
  listener on port 8787 can validate the wrong deployment or produce a
  misleading failure. For production checks, always pass the public
  `VERISTAT_URL`; inspect localhost first with
  `lsof -nP -iTCP:8787 -sTCP:LISTEN`.

## Constraints & placeholders

- The testnet D1 ID, public URL, CDP facilitator, and throwaway receiver are
  configured. The operator still supplies the real mainnet `PAY_TO_ADDRESS`, a
  separate canary wallet, and all secrets. Never invent or hardcode real keys.
- Workers Paid plan is required before any mainnet paid call (free-plan 10ms CPU cap can kill a request *after* settlement). Don't put payment-critical work in `ctx.waitUntil`.
- `withX402Client` mutates the client in place — tests exercise the unpaid path via a raw `client.request` (see `test/x402.test.ts`).
- Network IDs are CAIP-2 (`eip155:84532` testnet, `eip155:8453` mainnet), set via the `NETWORK` var.
- **Node client scripts must use a dedicated undici dispatcher** (`scripts/mcp-fetch.mjs`): Node 26's global fetch stalls same-origin requests while an SSE stream is open, deadlocking streamable HTTP after the standalone GET stream connects. Any new script that talks MCP over HTTP goes through `mcp-fetch.mjs`, not bare `fetch`.
- Bazaar listing is settlement-triggered: the CDP facilitator catalogs the endpoint on its first *settled* payment carrying the discovery extension (`docs/ROADMAP.md` Phase 2/3). A `"rejected"` status in the `EXTENSION-RESPONSES` verify/settle header means the discovery declaration failed schema validation and the service will silently never list — it is surfaced in logs; never ignore it.
