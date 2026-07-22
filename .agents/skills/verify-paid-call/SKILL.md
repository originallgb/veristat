---
name: verify-paid-call
description: Drive a full x402 402→pay→verdict cycle against veristat, including the read-only Bazaar preflight and sanitized one-call evidence workflow. Use after changing src/payments/, src/mcp/, scripts/, or before a deploy.
---

# Verify a paid call end-to-end

Four rungs, cheapest first. Climb only as far as the change demands. Mainnet is
gated by `docs/ROADMAP.md`; never waive a gate implicitly.

## 1. Unit/integration (no server, no keys, no money)

```sh
npm run typecheck && npm test
```

`test/x402.test.ts` exercises the full 402 → verify → settle cycle against
`test/mock_facilitator.ts`, including expired/tampered quotes, wrong network,
replay, facilitator failure, and settle-only-after-tool-success. Discovery
tests pin the MCP Bazaar shape and settled-payload echo. Keep `@x402/core`,
`@x402/evm`, and `@x402/extensions` aligned on 2.18.x.

## 2. Local live server (mock money, real transport)

```sh
cp .dev.vars.example .dev.vars   # fill panel keys only if testing the live panel
npm run db:migrate:local
npm run dev                      # :8787
node scripts/smoke.mjs           # deployment identity + free tool + unpaid 402
```

All MCP-over-HTTP scripts must use `scripts/mcp-fetch.mjs`; bare Node fetch can
deadlock after the SSE stream opens.

## 3. Deployed Bazaar preflight (no keys, no money)

The production testnet endpoint is exact, not a placeholder:

```sh
npx wrangler deployments status

EXPECTED_VERSION=<active-version-id> \
VERISTAT_URL=https://veristat.grant-23a.workers.dev/mcp \
  node scripts/smoke.mjs

VERISTAT_URL=https://veristat.grant-23a.workers.dev/mcp \
  npm run bazaar:preflight
```

Do not pay unless both pass. The preflight validates the MCP-internal unpaid
challenge: absolute resource URL, x402 v2 payment fields, schema-valid Bazaar
metadata, `consensus_check`, `streamable-http`, examples, and signed quote.

## 4. One controlled testnet settlement (faucet money)

Prerequisites: the deployed Worker uses CDP on Base Sepolia; the operator has
securely exported a funded throwaway `BUYER_PRIVATE_KEY`. Never print, read,
copy, or inline the key.

Start a separate filtered tail:

```sh
npx wrangler tail veristat \
  --format pretty \
  --search '[x402] extension responses:'
```

Then make exactly one call:

```sh
VERISTAT_URL=https://veristat.grant-23a.workers.dev/mcp \
NETWORK=eip155:84532 \
EVIDENCE_FILE=docs/session-logs/<timestamp>-bazaar-rehearsal.json \
  node scripts/paid-call.mjs "Controlled Bazaar discovery rehearsal"
```

Stop the tail. Retain only its sanitized verify/settle extension lines.
`rejected` fails the gate; `processing` is accepted but nonterminal and does
not prove listing. Never commit a raw tail.

Cross-check the evidence transaction on Sepolia BaseScan and join its request
id to both D1 tables (`docs/RUNBOOK.md`). Then check discovery at +10, +30, and
+60 minutes:

```sh
RESOURCE_URL=https://veristat.grant-23a.workers.dev/mcp \
PAY_TO_ADDRESS=0x86CdAe1A22458442BaB9E10216a7E96b606d3635 \
NETWORK=eip155:84532 \
  npm run bazaar:check
```

The pass condition is an exact resource URL match. The script tries merchant
lookup, semantic search, then the full catalog. If absent at +60 minutes, stop
spending and add the sanitized package to
https://github.com/x402-foundation/x402/issues/2112.

## Evidence boundary

Allowed: target URL, deployment id, network, asset, public payee, amount,
transaction hash, payer, request id, timestamps, package versions, sanitized
extension status, and merchant/search/catalog outcomes.

Forbidden: private keys, payment signatures/payloads, quote tokens, CDP JWTs
or API secrets, vendor API keys, claims/context/prompts, full verdicts, or raw
Worker logs. Inspect generated evidence before adding it to git.

## Mainnet gate

Do not run this workflow against `eip155:8453` until Phase 3 prerequisites in
`docs/ROADMAP.md` are satisfied. Only the operator may explicitly waive the
Bazaar-listing portion after a coherent testnet receipt, chain/D1 evidence,
three discovery checkpoints, and issue #2112 escalation. A waiver cannot
bypass Workers Paid, receiver-wallet, payment-integrity, or evidence gates.
