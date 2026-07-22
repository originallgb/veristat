# TESTING — strategy, wallets, and x402 transaction verification

The product moves real money per request. The test suite's first job is the
payment invariants; the panel is second.

## Invariants (release blockers if violated)

1. **A failed tool never charges.** Settlement happens only after the tool
   callback succeeds (`src/payments/x402.ts`). A settlement row in D1 without
   a matching verdict is a bug, never a flake.
2. **The settled amount is the quoted amount.** Pricing is deterministic from
   args (`src/payments/quoting.ts`); the retry re-derives the same price.
3. **Quotes expire.** 5-minute HMAC-signed quote tokens; expired or tampered
   quotes are re-challenged, not settled.
4. **Discovery declaration stays schema-valid.** An invalid declaration makes
   the Bazaar silently never list us (`docs/ROADMAP.md`).
5. **Rehearsals are auditable without becoming secret stores.** A paid canary
   must join deployment id, sanitized challenge shape, extension status,
   receipt, chain transaction, D1 rows, and discovery checks. It must not
   persist signing material, prompts, payment payloads, or raw logs.

## Test pyramid

| Layer | Runner | Facilitator | Money | When |
|---|---|---|---|---|
| Unit: quoting, schemas, synthesis parsing | vitest | none | none | every commit (CI) |
| Integration: full 402→verify→settle cycle + negative paths | vitest | `test/mock_facilitator.ts` | none | every commit (CI) |
| Deployed Bazaar preflight | `scripts/bazaar-preflight.mjs` | none (unpaid MCP call) | none | before any paid rehearsal/canary |
| Testnet e2e: real settlement over streamable HTTP | `scripts/e2e.mjs` | x402.org → CDP (base-sepolia) | exactly $0.50 faucet USDC | operator-approved manual CI dispatch only |
| Mainnet canary | future operator-approved procedure; current scripts refuse mainnet | CDP mainnet | real USDC | blocked on every Phase 3 gate |

## x402 transaction test matrix (vitest, `test/x402.test.ts`)

Positive:
- unpaid call → well-formed 402 payload (`_meta["x402/error"]`, correct atomic
  USDC amount, recipient, quote extension)
- dynamic pricing: 3-panel $0.50, large-input surcharge $1.00, (5-panel $1.50
  once un-stubbed)
- pay → verify → execute → settle → receipt in `_meta["x402/payment-response"]`
  + `onSettled` fired

Negative (each maps to an invariant above):
- tool failure → **no settle call**, buyer keeps funds
- facilitator declines verify → no execution, no settle
- facilitator 500/failure on settle after successful tool → error result, no
  receipt logged, no silent charge
- expired quote token → `QUOTE_EXPIRED` re-challenge
- tampered quote (price or request hash mismatch) → re-challenge
- payment for wrong network (mainnet payment against testnet config) → rejected
- replayed payment payload → not settled twice (facilitator-enforced on chain;
  mock asserts the server never double-settles a single call)
- degraded panel (2/3) → verdict carries `panel_degraded: true` + refund note

Discovery (`test/discovery.test.ts`):
- the Bazaar declaration for `consensus_check` validates against its own
  declared JSON Schema, and stays in sync with the zod input schema.
- the declaration identifies an MCP tool using `streamable-http`, includes
  input/output examples, and survives the client echo into the settled payload.

Dependency condition: keep `@x402/core`, `@x402/evm`, and
`@x402/extensions` on the same 2.18.x minor. A mixed install can load two core
implementations and makes discovery/echo behavior harder to reason about.

## Wallets — creation & funding runbook

Four roles. **Never mix them**; the ship-gate metric depends on knowing which
addresses are ours.

| # | Role | Source | Funds | Notes |
|---|---|---|---|---|
| 1 | Seller / receiving (`PAY_TO_ADDRESS`) | **USER** for mainnet (Coinbase account addr or hardware wallet). Generated addr OK for testnet. | receives USDC | current address is the throwaway Base Sepolia receiver in `wrangler.jsonc` |
| 2 | Buyer test wallets (testnet) | `node scripts/make-test-wallet.mjs` → gitignored `.wallets/` | Circle faucet USDC | https://faucet.circle.com — 20 USDC / address / 2h on Base Sepolia |
| 3 | "Organic-sim" wallet | same generator, separate key | faucet USDC | rehearses the ship gate: a paid call from a wallet that is not the deployer's |
| 4 | Mainnet canary buyer | **USER**, ~$5 USDC on Base | real USDC | first real settlement = Bazaar cataloging trigger; flag in D1 `known_wallets` |

**No ETH is ever needed in buyer wallets.** The x402 exact scheme uses EIP-3009
`transferWithAuthorization`: the buyer signs an authorization off-chain and the
facilitator submits the transaction and pays gas.

Key handling: generated keys live in `.wallets/` (gitignored, also denied to
Claude via `.claude/settings.json`). Testnet keys are throwaway — regenerate
freely. Never put a mainnet private key in the repo, `.dev.vars`, or CI.

## Controlled Bazaar rehearsal evidence

The testnet production endpoint is
`https://veristat.grant-23a.workers.dev/mcp`. Before spending:

```sh
npm run typecheck && npm test

EXPECTED_VERSION=<wrangler-version-id> \
VERISTAT_URL=https://veristat.grant-23a.workers.dev/mcp \
  node scripts/smoke.mjs

VERISTAT_URL=https://veristat.grant-23a.workers.dev/mcp \
  npm run bazaar:preflight
```

The smoke fails if `/health` is not the expected deployment. The preflight is
read-only and fails unless the live unpaid challenge has the exact target URL,
x402 v2 payment fields, a schema-valid MCP Bazaar declaration, and a signed
Veristat quote.

For the paid step, preload `BUYER_PRIVATE_KEY` through the operator's secure
shell/session; never put its value in the command, evidence path, or chat. Both
operator scripts fail before reading that variable or opening an MCP connection
unless `ENABLE_PAID_CALL=1` is present, and they refuse every network except
Base Sepolia. Start a separate filtered tail as documented in
`docs/RUNBOOK.md`, then run:

```sh
VERISTAT_URL=https://veristat.grant-23a.workers.dev/mcp \
ENABLE_PAID_CALL=1 \
NETWORK=eip155:84532 \
EVIDENCE_FILE=docs/session-logs/<timestamp>-bazaar-rehearsal.json \
  node scripts/paid-call.mjs "Controlled Bazaar discovery rehearsal"
```

The JSON intentionally contains only public/sanitized challenge and settlement
fields. Although `paid-call.mjs` prints the verdict interactively, the evidence
file excludes the claim, context, quote token, payment payload/signature, full
verdict, all private keys, CDP JWT/API credentials, and vendor API keys. Store
only the filtered extension-status lines alongside it; never commit a raw
Worker tail. `"processing"` means accepted for asynchronous work, not listed.

At +10, +30, and +60 minutes, run the exact-match check:

```sh
RESOURCE_URL=https://veristat.grant-23a.workers.dev/mcp \
PAY_TO_ADDRESS=0x86CdAe1A22458442BaB9E10216a7E96b606d3635 \
NETWORK=eip155:84532 \
  npm run bazaar:check
```

The script tries merchant lookup, semantic search, then a full catalog scan.
An exact normalized resource URL is the pass condition. At +60 minutes, stop
spending and escalate the sanitized record to x402-foundation/x402#2112.

## Tooling

- **`scripts/e2e.mjs`** — unpaid checks run against any `VERISTAT_URL`; paid
  mode is hard-locked to the current Base Sepolia USDC asset, test receiver,
  exact target resource, and `500000` atomic-unit quote. It requires
  `ENABLE_PAID_CALL=1`, validates the challenge before signer construction, and
  revalidates the retry requirements before approving payment. Uses
  `withX402Client` from `agents/x402`, so passing e2e is also x402 wire-format
  compliance. Exits nonzero on any mismatch.
- **`scripts/bazaar-preflight.mjs`** — no-money validation of the exact live
  MCP payment challenge and Bazaar declaration. It never defaults to localhost.
- **`scripts/paid-call.mjs` + `EVIDENCE_FILE`** — one paid call plus a
  deliberately narrow JSON evidence record; the signing/payment material and
  content/verdict are excluded.
- **`scripts/make-test-wallet.mjs`** — viem key generation + faucet
  instructions.
- **`scripts/check-bazaar.mjs`** — exact-match merchant lookup, semantic
  search, then 1,000-item-page full catalog fallback. CDP discovery reads need
  no auth. Run at +10/+30/+60 after the controlled call and after mainnet.
- **`scripts/dashboard.mjs`** — D1 settlements/requests summary with
  organic/non-organic split and distinct-payer count (the ship-gate readout).
- **On-chain cross-check** — every settlement's tx hash should resolve:
  testnet https://sepolia.basescan.org/tx/<hash>, mainnet
  https://basescan.org/tx/<hash>; x402scan indexes Base x402 traffic.

## CI (GitHub Actions)

- `ci.yml`: typecheck + vitest on every push/PR. No secrets required (mock
  facilitator only).
- Testnet smoke: manual `workflow_dispatch` job running `scripts/e2e.mjs`
  against the deployed testnet worker only when the required
  `run_paid_testnet_e2e` boolean input is explicitly set to `true`. The workflow
  fixes `NETWORK=eip155:84532` and `ENABLE_PAID_CALL=1`. Secrets:
  `BUYER_PRIVATE_KEY` (throwaway testnet key); panel API keys already live in
  the Worker. A default manual dispatch does not run the paid job.

## Local quick reference

```sh
npm test                                   # unit + integration (no keys, no money)
npm run dev                                # :8787 — needs .dev.vars
EXPECTED_VERSION=<id> VERISTAT_URL=https://veristat.grant-23a.workers.dev/mcp \
  node scripts/smoke.mjs                   # deployment identity + free/402 shape
VERISTAT_URL=https://veristat.grant-23a.workers.dev/mcp \
  npm run bazaar:preflight                 # schema-valid live challenge, no money
node scripts/make-test-wallet.mjs          # buyer key → .wallets/, prints faucet link
# with BUYER_PRIVATE_KEY already securely exported:
ENABLE_PAID_CALL=1 NETWORK=eip155:84532 \
  VERISTAT_URL=https://veristat.grant-23a.workers.dev/mcp \
  node scripts/e2e.mjs                      # approved $0.50 testnet paid matrix
```
