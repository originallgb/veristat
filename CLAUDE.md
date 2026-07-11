# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

An x402-paid multi-model verification MCP server on Cloudflare Workers. Agents call `consensus_check` (paid, USDC via x402), which fans the input to a cross-vendor panel of frontier models (Anthropic + OpenAI + Google) and returns a synthesized structured verdict. The build spec lives in the original planning session; key decided constraints: pricing model, tool surface, and platform are settled — do not re-litigate.

## Commands

```sh
npm test                    # vitest — full 402→verify→settle cycle vs mock facilitator
npx vitest run test/x402.test.ts -t "settle"   # single test
npm run typecheck           # tsc (noEmit)
npm run dev                 # wrangler dev on :8787 (needs .dev.vars, see .dev.vars.example)
npm run db:migrate:local    # apply D1 migrations locally (required before first dev run)
node scripts/smoke.mjs      # against a running server: free tool + unpaid 402 challenge (no creds needed)
BUYER_PRIVATE_KEY=0x... node scripts/paid-call.mjs "claim"   # paid e2e (funded base-sepolia wallet + panel API keys)
npm run deploy              # wrangler deploy
```

## Architecture

The payment layer and the product pipeline are deliberately decoupled:

- **`src/payments/x402.ts` — `PaymentGate`.** A custom paid-tool wrapper (the agents SDK's `paidTool` only supports static prices; this one computes the price per request). Wire-compatible with `withX402Client` from `agents/x402`: unpaid calls return an `isError` result carrying the 402 payload in `_meta["x402/error"]`; clients retry with a signed payment in `_meta["x402/payment"]`. **Settlement happens only after the tool callback succeeds** — a failed panel must never charge the buyer. The facilitator is injected via `@x402/core`'s `FacilitatorClient` interface: `HTTPFacilitatorClient(FACILITATOR_URL)` in prod (x402.org testnet → Coinbase CDP mainnet → Cloudflare Gateway later), `test/mock_facilitator.ts` in tests. Receipt logging hooks in via `onSettled`.
- **`src/payments/quoting.ts`** — deterministic pricing from args ($0.50/3-panel, $1.50/5-panel, +$0.50 over ~8k tokens) plus HMAC-signed 5-minute quote tokens returned in the 402 `extensions`. Pricing must stay deterministic: the retry re-derives the same amount from the same args.
- **`src/mcp/server.ts` — `VeristatMCP` (McpAgent / Durable Object)** wires tools to the gate. MVP accepts `panel_size: 5` and `mode: adversarial` but hard-routes quoting to 3-panel. `research_fanout`/`get_research_result` are intentional stubs returning `NOT_AVAILABLE`.
- **`src/panel/`** — `providers.ts` (raw fetch clients; vendor diversity is mandatory — never two models from one vendor), `orchestrator.ts` (parallel fan-out, 60s ceiling, degrades at 2/3 with `panel_degraded` flag), `synthesis.ts` (one extra model call, output parsed against `verdictSchema`).
- **`src/prompts/`** — versioned prompt modules; the version string is logged with every request. New prompt = new file (`panel_v2.ts`), never edit-in-place.
- **`src/logging.ts` + `migrations/`** — D1: `settlements` (demand proof) and `requests` (eval flywheel, no payer identity). Logging must never fail a paid request; errors are swallowed.
- **`src/index.ts`** — Hono for `/`, `/health`, `/price`; `/mcp` is routed to the McpAgent before Hono.

## Constraints & placeholders

- Placeholders the operator supplies: `PAY_TO_ADDRESS` + `database_id` in `wrangler.jsonc`; secrets `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GOOGLE_API_KEY`, `QUOTE_SIGNING_KEY` (`.dev.vars` locally, `wrangler secret put` in prod). Never invent or hardcode real keys.
- Workers Paid plan is required before any mainnet paid call (free-plan 10ms CPU cap can kill a request *after* settlement). Don't put payment-critical work in `ctx.waitUntil`.
- `withX402Client` mutates the client in place — tests exercise the unpaid path via a raw `client.request` (see `test/x402.test.ts`).
- Network IDs are CAIP-2 (`eip155:84532` testnet, `eip155:8453` mainnet), set via the `NETWORK` var.
