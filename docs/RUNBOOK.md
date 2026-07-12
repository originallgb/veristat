# RUNBOOK — operating veristat

## Secrets

| Secret | Purpose | Rotate by |
|---|---|---|
| `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` / `GOOGLE_API_KEY` | panel + synthesis | vendor console → `npx wrangler secret put NAME` → redeploy not required |
| `QUOTE_SIGNING_KEY` | HMAC on quote tokens | `openssl rand -hex 32` → `wrangler secret put`. In-flight quotes (≤5 min) fail closed to a fresh 402 — harmless. |
| `CDP_API_KEY_ID` / `CDP_API_KEY_SECRET` | CDP facilitator auth (Phase 2+) | portal.cdp.coinbase.com → `wrangler secret put` |

Local dev mirrors these in `.dev.vars` (never committed). Vars (not secrets)
live in `wrangler.jsonc`: `NETWORK`, `FACILITATOR_URL`, `PAY_TO_ADDRESS`,
panel model ids.

## Dashboard (D1 is the dashboard)

`node scripts/dashboard.mjs` wraps these; raw queries:

```sh
# latest settlements
npx wrangler d1 execute veristat --remote --command \
  "SELECT created_at, tool, amount_usd, tx_hash, payer FROM settlements ORDER BY id DESC LIMIT 20"

# request volume + degradation rate
npx wrangler d1 execute veristat --remote --command \
  "SELECT count(*) requests, sum(degraded) degraded FROM requests"

# ship-gate: distinct organic payers (exclude known wallets)
npx wrangler d1 execute veristat --remote --command \
  "SELECT count(DISTINCT payer) FROM settlements WHERE payer NOT IN (SELECT address FROM known_wallets)"
```

## Facilitator swap procedure

The facilitator is a constructor argument (`FacilitatorClient` seam in
`src/payments/x402.ts`), not a rewrite:

1. Change `FACILITATOR_URL` in `wrangler.jsonc` (+ set CDP secrets if moving
   to CDP).
2. Deploy; run `node scripts/smoke.mjs` (402 shape unchanged) then a paid
   `scripts/e2e.mjs` call.
3. Check `EXTENSION-RESPONSES` in logs — `"rejected"` = discovery declaration
   failed validation on the new facilitator.
4. Confirm listing persistence: `node scripts/check-bazaar.mjs`.

Order of facilitators: x402.org (testnet dev) → CDP base-sepolia (rehearsal)
→ CDP mainnet (launch) → Cloudflare Monetization Gateway (when off waitlist).

## Incidents

**"Settled but no verdict" (charged a buyer, returned nothing).** The one
unacceptable failure. Should be impossible by construction (settle runs only
after tool success), so any occurrence means a code regression or a Worker
kill between settle and response (CPU cap — confirm Workers Paid plan and
`limits.cpu_ms: 30000`). Find the payer in `settlements`, note tx hash;
refunds are manual in MVP: send USDC back from the receiving wallet, log it in
the incident note. File the bug before redeploying anything.

**Panel degradation spike.** `requests.degraded` climbing = one vendor
failing/slow. Check vendor status pages; consider swapping the model id var
for that vendor. Degraded verdicts carry a refund note (auto-refund is
Phase 2) — expect support pings.

**Bazaar delisting.** 30-day recency filter — no settled calls in 30 days
drops the listing. Fix: one canary paid call (flagged wallet), confirm with
`check-bazaar.mjs`. Schedule: run the canary monthly until organic volume
covers it.

**Quote disputes.** Every 402 includes an HMAC-signed quote token with price +
request hash + expiry. A buyer claiming overcharge: compare their echoed quote
against the settlement row amount; the deterministic pricing function
(`computePriceUSD`) is the arbiter.

## Deploy

```sh
npm run typecheck && npm test        # gate
npx wrangler deploy
VERISTAT_URL=https://<worker-url>/mcp node scripts/smoke.mjs
```

Mainnet config changes go through the Phase 3 checklist in `docs/ROADMAP.md`
— never flip `NETWORK` casually.
