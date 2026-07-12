# veristat

x402-paid multi-model verification MCP server on Cloudflare Workers.

An agent submits a claim, plan, or draft; veristat fans it to a heterogeneous
panel of frontier models (Anthropic + OpenAI + Google — never two from the same
vendor), synthesizes a structured verdict (consensus, agreements, contradictions,
dissent), and returns it. Payment per call via x402 (USDC on Base). The payment
is the credential — buyers need no vendor accounts.

## Docs

`docs/SPEC.md` (decided build spec) · `docs/STRATEGY.md` (why + kill condition)
· `docs/ROADMAP.md` (launch phases + status) · `docs/TESTING.md` (test pyramid,
wallet runbook) · `docs/RUNBOOK.md` (ops).

## Tools

| Tool | Price | Status |
|---|---|---|
| `consensus_check` | $0.50 (3-panel) / $1.50 (5-panel) + $0.50 large-input surcharge; exact price quoted in the 402 | **live** (MVP routes to 3-panel) |
| `get_sample_verdict` | free | live |
| `research_fanout` / `get_research_result` | $12–25 dynamic | stub — returns `NOT_AVAILABLE` |

## Architecture

- **MCP**: `agents` SDK `McpAgent`, streamable HTTP at `/mcp`.
- **Payments**: x402 v2 exact scheme via `@x402/core`, MCP-transport handshake
  (`_meta["x402/error"]` / `_meta["x402/payment"]`) compatible with
  `withX402Client` from `agents/x402`. Dynamic per-request quoting with signed,
  5-minute quote tokens (`src/payments/quoting.ts`). Settlement happens only
  after the tool succeeds — a failed panel never charges the buyer.
- **Facilitator**: abstracted behind `@x402/core`'s `FacilitatorClient`
  interface (`src/payments/x402.ts`). Default: `FACILITATOR_URL` var
  (x402.org for testnet; point at Coinbase CDP for mainnet; swap to
  Cloudflare's Monetization Gateway when off waitlist — constructor arg, not a
  rewrite). Tests inject `test/mock_facilitator.ts`.
- **Panel**: parallel fan-out, 60s ceiling, degrades gracefully at 2/3 with
  `panel_degraded: true` + refund note (auto-refund is Phase 2).
- **Synthesis**: one schema-enforced model call; prompts versioned in
  `src/prompts/`, version logged per request.
- **Logging**: D1 — `settlements` (tx hash, payer, amount = demand proof) and
  `requests` (request/response pairs minus payer identity = eval flywheel).

## What you must supply (placeholders in the code)

| What | Where | How |
|---|---|---|
| USDC receiving wallet | `PAY_TO_ADDRESS` in `wrangler.jsonc` (currently `0x0000…`) | your address on Base |
| Public endpoint URL | `PUBLIC_URL` in `wrangler.jsonc` (currently empty) | the deployed `/mcp` URL — what the Bazaar catalogs |
| CDP API keys | `CDP_API_KEY_ID` / `CDP_API_KEY_SECRET` secrets | portal.cdp.coinbase.com — required once `FACILITATOR_URL` is the CDP facilitator (Bazaar rehearsal + mainnet) |
| Panel API keys | `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GOOGLE_API_KEY` | local: `.dev.vars` (copy `.dev.vars.example`); prod: `npx wrangler secret put <NAME>` |
| Quote signing secret | `QUOTE_SIGNING_KEY` | `openssl rand -hex 32`, same channels as above |
| D1 database id | `database_id` in `wrangler.jsonc` (currently `REPLACE_WITH_D1_DATABASE_ID`) | printed by `npx wrangler d1 create veristat` |
| Buyer test wallet | `BUYER_PRIVATE_KEY` env for `scripts/paid-call.mjs` | any wallet with base-sepolia USDC from https://faucet.circle.com — must not be the deployer's |
| Registry handles | `server.json`, `REPLACE_WITH_*` | your GitHub user / workers.dev subdomain |

## Run it

```sh
npm install
npm test                                  # 402→verify→settle cycle + negative paths vs mock facilitator
cp .dev.vars.example .dev.vars            # then fill in real keys
npx wrangler d1 migrations apply veristat --local
npm run dev                               # http://localhost:8787 (/mcp, /health, /price)
node scripts/smoke.mjs                    # free tool + unpaid 402 challenge (no keys needed)
E2E_UNPAID_ONLY=1 node scripts/e2e.mjs    # full unpaid matrix, exits nonzero on failure
node scripts/make-test-wallet.mjs         # buyer key → .wallets/, prints Circle faucet link
BUYER_PRIVATE_KEY=$(cat .wallets/buyer.key) node scripts/e2e.mjs   # paid e2e (needs panel keys too)
```

Full testing strategy (wallet roles, negative-path matrix, Bazaar listing
verification): `docs/TESTING.md`. Ops: `docs/RUNBOOK.md`
(`node scripts/dashboard.mjs` is the dashboard,
`node scripts/check-bazaar.mjs` answers "are we actually listed").

## Deploy (testnet first)

```sh
npx wrangler d1 create veristat           # paste id into wrangler.jsonc
npx wrangler d1 migrations apply veristat --remote
npx wrangler secret put ANTHROPIC_API_KEY # …and OPENAI_API_KEY, GOOGLE_API_KEY, QUOTE_SIGNING_KEY
npx wrangler deploy
VERISTAT_URL=https://<worker-url>/mcp node scripts/smoke.mjs
```

**Mainnet checklist (spec §8):** upgrade to Workers Paid ($5/mo) *before* the
first mainnet call (free-plan 10ms CPU cap can kill a request after settlement);
set `NETWORK=eip155:8453`; point `FACILITATOR_URL` at the Coinbase CDP
facilitator; real `PAY_TO_ADDRESS`; list in the Coinbase x402 Bazaar and the
official MCP registry (`server.json`).

## Dashboard

There is no dashboard. The logs are the dashboard:

```sh
npx wrangler d1 execute veristat --remote --command \
  "SELECT created_at, tool, amount_usd, tx_hash, payer FROM settlements ORDER BY id DESC LIMIT 20"
npx wrangler d1 execute veristat --remote --command \
  "SELECT count(*) requests, sum(degraded) degraded FROM requests"
```

## Bazaar listing metadata

- **Name**: veristat
- **Category**: verification / evaluation
- **One-liner**: An independent second opinion a model cannot give itself, in one paid call with zero account setup.
- **Endpoint**: `https://veristat.<subdomain>.workers.dev/mcp` (x402, USDC on Base, exact scheme)
- **Discovery**: free `get_sample_verdict` tool returns a real verdict, methodology, and price card.
