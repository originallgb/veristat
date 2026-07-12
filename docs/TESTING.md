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

## Test pyramid

| Layer | Runner | Facilitator | Money | When |
|---|---|---|---|---|
| Unit: quoting, schemas, synthesis parsing | vitest | none | none | every commit (CI) |
| Integration: full 402→verify→settle cycle + negative paths | vitest | `test/mock_facilitator.ts` | none | every commit (CI) |
| Testnet e2e: real settlement over streamable HTTP | `scripts/e2e.mjs` | x402.org → CDP (base-sepolia) | faucet USDC | before deploys; manual CI dispatch |
| Mainnet canary | `scripts/e2e.mjs` vs prod | CDP mainnet | ~$2 real USDC | launch + monthly keep-alive |

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

## Wallets — creation & funding runbook

Four roles. **Never mix them**; the ship-gate metric depends on knowing which
addresses are ours.

| # | Role | Source | Funds | Notes |
|---|---|---|---|---|
| 1 | Seller / receiving (`PAY_TO_ADDRESS`) | **USER** for mainnet (Coinbase account addr or hardware wallet). Generated addr OK for testnet. | receives USDC | currently the `0x0000…` placeholder |
| 2 | Buyer test wallets (testnet) | `node scripts/make-test-wallet.mjs` → gitignored `.wallets/` | Circle faucet USDC | https://faucet.circle.com — 20 USDC / address / 2h on Base Sepolia |
| 3 | "Organic-sim" wallet | same generator, separate key | faucet USDC | rehearses the ship gate: a paid call from a wallet that is not the deployer's |
| 4 | Mainnet canary buyer | **USER**, ~$5 USDC on Base | real USDC | first real settlement = Bazaar cataloging trigger; flag in D1 `known_wallets` |

**No ETH is ever needed in buyer wallets.** The x402 exact scheme uses EIP-3009
`transferWithAuthorization`: the buyer signs an authorization off-chain and the
facilitator submits the transaction and pays gas.

Key handling: generated keys live in `.wallets/` (gitignored, also denied to
Claude via `.claude/settings.json`). Testnet keys are throwaway — regenerate
freely. Never put a mainnet private key in the repo, `.dev.vars`, or CI.

## Tooling

- **`scripts/e2e.mjs`** — the paid-call matrix against any `VERISTAT_URL`
  (local `wrangler dev` or deployed): free tool works, unpaid 402 challenge has
  the right shape, paid call returns a verdict with a settlement receipt,
  underpayment is rejected. Uses `withX402Client` from `agents/x402` — the
  same client real agent buyers use, so passing e2e is also x402 wire-format
  compliance. Exits nonzero on any failure.
- **`scripts/make-test-wallet.mjs`** — viem key generation + faucet
  instructions.
- **`scripts/check-bazaar.mjs`** — polls the facilitator discovery catalog
  (CDP or x402.org, no auth for reads) for our resource URL: the "are we
  actually listed" test. Run after every settle-path change and after the
  mainnet canary.
- **`scripts/dashboard.mjs`** — D1 settlements/requests summary with
  organic/non-organic split and distinct-payer count (the ship-gate readout).
- **On-chain cross-check** — every settlement's tx hash should resolve:
  testnet https://sepolia.basescan.org/tx/<hash>, mainnet
  https://basescan.org/tx/<hash>; x402scan indexes Base x402 traffic.

## CI (GitHub Actions)

- `ci.yml`: typecheck + vitest on every push/PR. No secrets required (mock
  facilitator only).
- Testnet smoke: manual `workflow_dispatch` job running `scripts/e2e.mjs`
  against the deployed testnet worker. Secrets: `BUYER_PRIVATE_KEY` (throwaway
  testnet key), panel API keys already live in the Worker. Keep it manual —
  faucet balances and live model calls make it unsuitable for every push.

## Local quick reference

```sh
npm test                                   # unit + integration (no keys, no money)
npm run dev                                # :8787 — needs .dev.vars
node scripts/smoke.mjs                     # free tool + 402 shape, no creds
node scripts/make-test-wallet.mjs          # buyer key → .wallets/, prints faucet link
VERISTAT_URL=http://localhost:8787/mcp BUYER_PRIVATE_KEY=$(cat .wallets/buyer.key) \
  node scripts/e2e.mjs                     # full paid matrix
```
