---
name: verify-paid-call
description: Drive a full x402 402→pay→verdict cycle against veristat to verify payment-layer changes end-to-end. Use after changing anything under src/payments/, src/mcp/, or scripts/, or before a deploy.
---

# Verify a paid call end-to-end

Three rungs, cheapest first. Climb only as far as the change demands.

## 1. Unit/integration (no server, no keys, no money)

```sh
npm run typecheck && npm test
```

`test/x402.test.ts` exercises the full 402 → verify → settle cycle against
`test/mock_facilitator.ts`, including the negative paths (expired quote,
tampered amount, wrong network, replay, facilitator failure, settle-only-
after-tool-success). If a payment-layer change isn't covered by an existing
test, add one here first.

## 2. Local live server (mock money, real transport)

```sh
cp .dev.vars.example .dev.vars   # fill panel keys only if testing the live panel
npm run db:migrate:local
npm run dev                      # :8787
node scripts/smoke.mjs           # free tool + unpaid 402 challenge shape — no creds needed
```

`smoke.mjs` passing proves: MCP handshake over streamable HTTP, tool listing,
free `get_sample_verdict`, and that an unpaid `consensus_check` returns a
well-formed 402 payload in `_meta["x402/error"]`.

## 3. Testnet e2e (real x402 settlement, faucet money)

Needs: deployed worker (or `wrangler dev` with real panel keys) and a funded
base-sepolia buyer wallet — generate with `node scripts/make-test-wallet.mjs`,
fund at https://faucet.circle.com (USDC only; no ETH needed, the facilitator
pays gas).

```sh
VERISTAT_URL=https://<worker-url>/mcp node scripts/e2e.mjs
```

`e2e.mjs` runs the full matrix: free tool, 402 challenge shape, paid call with
`withX402Client` (the same client real buyers use), wrong-amount rejection,
and (with `CHECK_D1=1`) the settlement receipt row. Exits nonzero on any
failure.

Cross-check settlement on chain: tx hash from the output or
`node scripts/dashboard.mjs` → https://sepolia.basescan.org/tx/<hash>.

## Gotchas

- All MCP-over-HTTP scripts must import `scripts/mcp-fetch.mjs` — bare Node
  fetch deadlocks once the SSE GET stream is open.
- A failed panel must never charge: if you see a settlement row without a
  matching verdict, that is a release-blocking bug, not a flake.
- Never run e2e against mainnet config casually; mainnet cutover is the
  gated checklist in docs/ROADMAP.md Phase 3.
