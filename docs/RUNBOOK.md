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

Never record or commit private keys, payment signatures/payloads, quote tokens,
CDP JWTs/API secrets, vendor API keys, input claims/context, full verdicts, or
raw Worker tails. Transaction hashes, chain/network, amount, public asset/payee,
payer, request id, deployment id, and sanitized extension status are acceptable
operational evidence.

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

## Controlled Bazaar rehearsal

Use this procedure once to close the Phase 2 gate. The production testnet MCP
endpoint is **`https://veristat.grant-23a.workers.dev/mcp`**.

### Prerequisites

- x402 packages resolve to 2.18.x for core, EVM, and extensions.
- Wrangler is authenticated and the Worker has its panel, quote, and CDP
  secrets. Do not read or copy those secret values.
- `BUYER_PRIVATE_KEY` is already present in the operator's secure shell and is
  a funded, throwaway Base Sepolia wallet. Do not inline it in a command.
- Only one controlled paid call will be made. Stop if preflight fails.

### 1. Pin and verify the deployment

Obtain the active version id using Wrangler, then use that exact value:

```sh
npx wrangler deployments status

npm run typecheck && npm test

EXPECTED_VERSION=<active-version-id> \
VERISTAT_URL=https://veristat.grant-23a.workers.dev/mcp \
  node scripts/smoke.mjs

VERISTAT_URL=https://veristat.grant-23a.workers.dev/mcp \
  npm run bazaar:preflight
```

The preflight must report `BAZAAR PREFLIGHT OK`. It validates the MCP-internal
unpaid challenge; this is more relevant than a generic validator that expects a
top-level HTTP 402 response.

### 2. Capture only sanitized facilitator status

In a separate terminal, start a server-side-filtered tail:

```sh
npx wrangler tail veristat \
  --format pretty \
  --search '[x402] extension responses:'
```

The installed x402 client sanitizes these messages to status/reason fields.
Retain only the verify/settle lines for this isolated call; do not retain or
commit the raw tail. `"rejected"` is a hard failure. `"processing"` is accepted
but nonterminal and does not prove indexing. An absent header is inconclusive.

### 3. Make one paid call and write narrow evidence

```sh
VERISTAT_URL=https://veristat.grant-23a.workers.dev/mcp \
NETWORK=eip155:84532 \
ENABLE_PAID_CALL=1 \
EVIDENCE_FILE=docs/session-logs/<timestamp>-bazaar-rehearsal.json \
  node scripts/paid-call.mjs "Controlled Bazaar discovery rehearsal"
```

Stop the filtered tail after this call. Inspect the JSON before adding it to
git. It must contain only the sanitized fields listed in the Secrets section.
Delete/redact the artifact rather than committing it if any excluded field is
present.

### 4. Join receipt, chain, and D1 evidence

Open the evidence file's Sepolia BaseScan URL and confirm the transaction. Then
query by its request id:

```sh
npx wrangler d1 execute veristat --remote --command \
  "SELECT request_id, tx_hash, amount_usd, network, tool, created_at FROM settlements WHERE request_id = '<request-id>'"

npx wrangler d1 execute veristat --remote --command \
  "SELECT request_id, tool, prompt_version, synthesis_version, degraded, created_at FROM requests WHERE request_id = '<request-id>'"
```

The transaction, settlement row, request row, amount, network, and request id
must agree. A settlement without its request/verdict is a release blocker.

### 5. Check discovery at +10, +30, and +60 minutes

Run this same command at each checkpoint and record the timestamp/result in the
session note:

```sh
RESOURCE_URL=https://veristat.grant-23a.workers.dev/mcp \
PAY_TO_ADDRESS=0x86CdAe1A22458442BaB9E10216a7E96b606d3635 \
NETWORK=eip155:84532 \
  npm run bazaar:check
```

The script checks the merchant endpoint, semantic search, then the full catalog
for an exact normalized URL. Do not treat same-host output or `processing` as a
pass. CDP documents up to ten minutes of catalog caching; the later checkpoints
distinguish cache delay from the silent-indexing class tracked in issue #2112.

### 6. Escalate or close the gate

If listed, mark Phase 2 complete and link the sanitized artifact/session note.
If absent at +60 minutes, do not buy another probe. Add a sanitized report to
https://github.com/x402-foundation/x402/issues/2112 containing:

- exact resource URL, public payee, network/asset/amount
- transaction hash and UTC settle/check timestamps
- deployment id and x402 package versions
- sanitized Bazaar input type/tool/transport and extension statuses
- merchant, search, and full-scan results

Mainnet stays blocked unless the operator records the explicit listing-gate
waiver defined in `docs/ROADMAP.md`. The waiver cannot bypass Workers Paid,
receiver-wallet, payment-integrity, or auditable-evidence gates.

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

## CI/CD

`.github/workflows/ci.yml` has two jobs. **There is no auto-deploy** —
deploys are always the manual `npx wrangler deploy` in the Deploy section
below; CI only gates and (optionally) smoke-tests against a live URL.

| Job | Trigger | What it runs | Secrets/vars |
|---|---|---|---|
| `test` | every push + PR | `npm run typecheck` + `npm test` (full 402→verify→settle cycle vs `test/mock_facilitator.ts`) | none — no real money, no vendor keys |
| `testnet-e2e` | manual `workflow_dispatch` with `run_paid_testnet_e2e=true` | `ENABLE_PAID_CALL=1 NETWORK=eip155:84532 node scripts/e2e.mjs` against the deployed testnet worker | repo var `TESTNET_VERISTAT_URL`, repo secret `TESTNET_BUYER_PRIVATE_KEY` (throwaway testnet key); panel API keys already live in the Worker |

Kept manual on purpose: `testnet-e2e` spends faucet USDC and makes real
model calls, so it's unsuitable to run on every push (`docs/TESTING.md`).
Dispatch it from the Actions tab with the paid checkbox selected, or run
`gh workflow run ci.yml -f run_paid_testnet_e2e=true`. A default manual
dispatch runs only the credential-free test job. Run the paid job before a
deploy, or after any change under `src/payments/`, `src/mcp/`, or `scripts/`.

Before adding an auto-deploy job: it would need `CLOUDFLARE_API_TOKEN` (or
OIDC) as a repo secret, and should never target mainnet without the Phase 3
gate below — treat any future CD job as testnet-only until that gate clears.

## Deploy

```sh
npm run typecheck && npm test        # gate
npx wrangler deploy
EXPECTED_VERSION=<deployed-version-id> \
VERISTAT_URL=https://veristat.grant-23a.workers.dev/mcp \
  node scripts/smoke.mjs
```

Mainnet config changes go through the Phase 3 checklist in `docs/ROADMAP.md`
— never flip `NETWORK` casually.
