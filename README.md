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
wallet runbook) · `docs/RUNBOOK.md` (ops, incl. CI/CD)
· `docs/ARCHITECTURE.md` (Cloudflare architecture + payment-flow diagrams)
· `docs/context/current-state.md` (compact current-session handoff).

## Current deployment

As of 2026-07-16, veristat is deployed for a **Base Sepolia rehearsal**:

- MCP endpoint: `https://veristat.grant-23a.workers.dev/mcp`
- Network: `eip155:84532`
- Facilitator: `https://api.cdp.coinbase.com/platform/v2/x402`
- D1 database: `veristat` (`63379492-64ce-48a0-b39a-82aa54726dae`)
- Testnet receiver: `0x86CdAe1A22458442BaB9E10216a7E96b606d3635`
- Active Worker version: `7874ca15-2abf-4006-af13-d27fbdb54b47`

Three discovery-bearing testnet payments have settled. The final controlled
diagnostic returned `{"bazaar":{"status":"processing"}}` on both verify and
settle, but the resource remained absent from merchant lookup, semantic search,
and the full Bazaar catalog through +60 minutes. Sanitized evidence is attached
to x402-foundation/x402#2112. That remains the Phase 2 blocker unless the
operator explicitly records the narrow listing waiver in `docs/ROADMAP.md`.

## Tools

| Tool | Price | Status |
|---|---|---|
| `consensus_check` | $0.50 for the current fulfilled 3-panel check + $0.50 large-input surcharge; exact price quoted in the 402 | **live** (`panel_size: 5` is accepted for compatibility but fulfilled and quoted as 3-panel) |
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
  interface (`src/payments/x402.ts`). The deployed Base Sepolia rehearsal and
  planned mainnet launch use Coinbase CDP; x402.org remains available for plain
  testnet payment testing, and Cloudflare's Monetization Gateway is a later
  constructor-level swap. Tests inject `test/mock_facilitator.ts`.
- **Panel**: parallel fan-out, 60s ceiling, degrades gracefully at 2/3 with
  `panel_degraded: true` + refund note (automatic refunds remain post-launch).
- **Synthesis**: one schema-enforced model call; prompts versioned in
  `src/prompts/`, version logged per request.
- **Logging**: D1 — `settlements` (tx hash, payer, amount = demand proof) and
  `requests` (request/response pairs minus payer identity = eval flywheel).

## Deployment configuration

| What | Where | How |
|---|---|---|
| USDC receiving wallet | `PAY_TO_ADDRESS` in `wrangler.jsonc` | configured to the throwaway testnet receiver above; **USER** must supply a real Base mainnet address before cutover |
| Public endpoint URL | `PUBLIC_URL` in `wrangler.jsonc` | configured to `https://veristat.grant-23a.workers.dev/mcp` — the URL the Bazaar must catalog |
| CDP API keys | `CDP_API_KEY_ID` / `CDP_API_KEY_SECRET` Worker secrets | configured for the rehearsal; provision separately for a new environment and never commit their values |
| Panel API keys | `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GOOGLE_API_KEY` | local: `.dev.vars` (copy `.dev.vars.example`); prod: `npx wrangler secret put <NAME>` |
| Quote signing secret | `QUOTE_SIGNING_KEY` | `openssl rand -hex 32`, same channels as above |
| D1 database id | `database_id` in `wrangler.jsonc` | configured to the live `veristat` database shown above |
| Buyer test wallet | `BUYER_PRIVATE_KEY` env for `scripts/paid-call.mjs` | any wallet with base-sepolia USDC from https://faucet.circle.com — must not be the deployer's |
| Registry metadata | `server.json` | finalized as `io.github.originallgb/veristat`, version `1.0.0`, using the public endpoint above |

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
npx wrangler d1 migrations apply veristat --remote
npx wrangler secret put ANTHROPIC_API_KEY # …and OPENAI_API_KEY, GOOGLE_API_KEY, QUOTE_SIGNING_KEY
npx wrangler deploy
EXPECTED_VERSION=<version-id-from-deploy> \
  VERISTAT_URL=https://veristat.grant-23a.workers.dev/mcp \
  node scripts/smoke.mjs
```

Cloudflare version metadata is active in `/health`. The smoke command must
report the same version ID that `wrangler deploy` created; the current verified
value is the active Worker version shown above.

`scripts/smoke.mjs` defaults to `localhost:8787`. A stale
`wrangler dev --remote` process there can make a production check appear to fail or validate
the wrong code. For deployment verification, always set the explicit public
`VERISTAT_URL`; inspect the listener with `lsof -nP -iTCP:8787 -sTCP:LISTEN`
before using localhost.

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
- **Endpoint**: `https://veristat.grant-23a.workers.dev/mcp` (x402, USDC on Base, exact scheme)
- **Discovery**: free `get_sample_verdict` tool returns a real verdict, methodology, and price card.
