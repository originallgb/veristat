# Security policy

veristat takes payments (x402, USDC on Base) and forwards submissions to
third-party model providers, so security reports are welcome.

## Scope

The service currently runs on the Base Sepolia **testnet** only. No mainnet
funds are handled. In scope:

- the Worker source in `src/` and its payment flow (`src/payments/`)
- the deployed testnet endpoint `https://veristat.grant-23a.workers.dev/mcp`
- the example buyer and operator scripts in `examples/` and `scripts/`

## Reporting

Please report vulnerabilities privately through GitHub's
[private vulnerability reporting](../../security/advisories/new) for this
repository. Do not open a public issue.

Please do not run load tests or high-volume paid calls against the live
endpoint. Each paid call spends real model-provider credit.

## Known limitations

- **No rate limiting.** The endpoint relies on the x402 payment gate. Unpaid
  calls never reach the model panel.
- **Panel runs before settlement.** By design, a buyer is charged only after
  the panel succeeds. A single payment authorisation replayed across
  concurrent sessions could trigger more than one panel run before settlement
  fails for the duplicates. The buyer cannot be charged twice (the facilitator
  enforces this on-chain), but the operator's model spend is exposed. Provider
  spend caps are the current mitigation.
- **Moderate dependency advisories** remain in transitive dependencies; see
  `docs/plans/2026-08-01-dependency-advisory-triage.md`.
