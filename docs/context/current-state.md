# Current state — 2026-07-16

This is the compact pickup document for humans and agents. Operational truth
lives here, in `docs/ROADMAP.md`, and in `wrangler.jsonc`; `docs/SPEC.md`
remains the historical product/build decision record.

## Live system

- Endpoint: `https://veristat.grant-23a.workers.dev/mcp`
- Active network: Base Sepolia (`eip155:84532`)
- Facilitator: Coinbase CDP
  (`https://api.cdp.coinbase.com/platform/v2/x402`)
- Testnet receiving address:
  `0x86CdAe1A22458442BaB9E10216a7E96b606d3635`
- D1 database: `veristat`, id `63379492-64ce-48a0-b39a-82aa54726dae`
- Active Worker version: `7874ca15-2abf-4006-af13-d27fbdb54b47`, deployed
  from Git commit `8328f3cd9ab7c910d82469e2b3b8286a52c2fc20` at
  `2026-07-16T14:31:08.654414Z`.
- Mainnet is not enabled. The test receiver is not the operator's mainnet
  receiving address.

## Verified in this session

- Stopped the orphaned `wrangler dev --remote --port 8787` process that had
  occupied localhost for roughly 13 hours.
- Aligned `@x402/core`, `@x402/evm`, and `@x402/extensions` on `2.18.0`.
- `npm run typecheck` passes.
- All 57 Vitest tests pass.
- Production unpaid E2E passes and exposes the correct absolute resource,
  Base Sepolia USDC requirement, and MCP Bazaar declaration.
- `npm run bazaar:preflight` passes against production without making a
  payment or printing the signed quote token.
- The single operator-authorized `$0.50` Base Sepolia diagnostic settled
  successfully. Its chain receipt and D1 settlement/request rows agree, and
  both filtered Bazaar extension responses were `processing`, not `rejected`.
- CDP merchant lookup, semantic search, and catalog checks still return no
  exact Veristat listing through the +60-minute checkpoint.
- The sanitized reproduction is attached to x402-foundation/x402#2112 as
  [comment 4993727120](https://github.com/x402-foundation/x402/issues/2112#issuecomment-4993727120).

## Current gate

Do not switch to mainnet until the Phase 2 diagnostic closeout in
`docs/ROADMAP.md` is complete or the operator explicitly records a waiver.
Do not make another paid probe. The controlled evidence sequence and upstream
escalation are complete, but the listing is still absent. The next decision is
operator-only: keep Base Sepolia blocked while awaiting upstream visibility,
or explicitly record the narrow Bazaar-listing waiver. Never include wallet
private keys, CDP secrets, payment signatures/payloads, quote tokens, prompts,
or verdict bodies.

## Repository state conventions

- Agent instructions are tracked in `AGENTS.md`, `CLAUDE.md`, `.agents/`,
  `.claude/`, and `.codex/`.
- Live nested worktree checkouts are Git runtime state and are not added to
  the parent repository as embedded gitlinks. Their durable branch/commit
  references are recorded in `docs/context/worktrees.md`.
- `.claude/settings.local.json`, `.wallets/`, `.dev.vars`, raw logs, and
  `.remember/tmp` remain ignored because they can contain credentials or
  machine-local runtime state.
- Curated context and session evidence belongs under `docs/context/` and
  `docs/session-logs/`.

## Resume commands

```sh
npm run typecheck
npm test
VERISTAT_URL=https://veristat.grant-23a.workers.dev/mcp npm run bazaar:preflight
VERISTAT_URL=https://veristat.grant-23a.workers.dev/mcp \
  NETWORK=eip155:84532 E2E_UNPAID_ONLY=1 node scripts/e2e.mjs
```

See `docs/session-logs/2026-07-16-bazaar-controlled-rehearsal.md` for the paid
diagnostic evidence and `docs/decisions/0001-bazaar-before-mainnet.md` for the
gate rationale.
