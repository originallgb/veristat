# Current state — 2026-07-22

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

## Registry/public-contract release gate

The checked-in registry/public-contract source is newer than the active Worker.
In particular, the current source and `server.json` describe the compatibility
contract where accepted `panel_size: 5` is fulfilled and quoted as the current
three-panel `$0.50` service. The active Worker still returns the earlier public
`/price` contract: `panel_5_usd: 1.5` and a price-card note that five is routed
to a three-model panel. Static registry validation therefore proves source
consistency, not that the remote named by `server.json` serves that contract.

**Do not publish the registry entry or tag a release for this source until an
operator authorizes a deployment and verifies the exact public endpoint.** The
required verification is `/health` deployment identity plus the root/`/price`,
free-sample, and unpaid-402 price-card/tool contract. This is a release-truth
gate only; it does not authorize a deployment, registry publication, paid call,
or any Phase 2/3 change.

## Verified in this session

- Stopped the orphaned `wrangler dev --remote --port 8787` process that had
  occupied localhost for roughly 13 hours.
- Aligned `@x402/core`, `@x402/evm`, and `@x402/extensions` on `2.18.0`.
- `npm run typecheck` passes.
- The combined suite passes all 80 current Vitest tests.
- `server.json` uses the current `2025-12-11` schema, runtime/package/registry
  versions are aligned at `1.0.0`, the offline registry validator passes, and
  the current official `mcp-publisher validate server.json` reports valid.
- The credential-free 20-case synthetic evaluation passes: 19/20 synthesis
  labels, 6/20 naive-majority labels, all required findings, and zero schema
  failures. These fixture metrics are regression evidence, not a live-provider
  quality claim; `docs/EVALS.md` defines the operator-gated live baseline.
- A clean temporary copy of `examples/node-buyer` completed `npm ci`. Its
  no-wallet public run then failed closed on the documented stale Worker price
  contract, which is the expected release-gate behavior until deployment.
- Paid operator scripts now require explicit enablement, reject non-Sepolia
  networks and any challenge drift, cap the approved synthetic call at exactly
  $0.50, and run in CI only after the credential-free test job passes.
- Wrangler's deployment dry run bundles successfully. No Worker deployment,
  registry publication, paid call, project-secret access, or Phase 2/3 gate
  change was made during the prelaunch-proof sprint.
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
- A follow-up suggested the remaining gate was either Base Sepolia or
  `input.type=mcp`. Live checks found Base Sepolia resources in search,
  25,387 HTTP catalog entries, and zero MCP entries. The evidence and request
  for CDP confirmation are in
  [comment 4994040237](https://github.com/x402-foundation/x402/issues/2112#issuecomment-4994040237).
- The 2026-07-17 read-only recheck remained negative: zero merchant results,
  zero semantic-search matches, and no exact resource match across 25,542 CDP
  catalog entries. This supersedes the earlier catalog-count snapshot only; it
  does not authorize another paid diagnostic.

## Current gate

Do not switch to mainnet until the Phase 2 diagnostic closeout in
`docs/ROADMAP.md` is complete or the operator explicitly records a waiver.
Do not publish the official MCP registry entry while the source-versus-live
public-contract gate above remains open.
Do not make another paid probe. The controlled evidence sequence and upstream
escalation are complete, but the listing is still absent. The next decision is
operator-only: keep Base Sepolia blocked while awaiting CDP confirmation of
MCP indexing support, or explicitly record the narrow Bazaar-listing waiver.
Do not run the suggested mainnet-MCP or Sepolia-HTTP paid A/B probes without a
new operator decision. Never include wallet private keys, CDP secrets, payment
signatures/payloads, quote tokens, prompts, or verdict bodies.

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
npm run registry:validate
npm run eval
VERISTAT_URL=https://veristat.grant-23a.workers.dev/mcp npm run bazaar:preflight
VERISTAT_URL=https://veristat.grant-23a.workers.dev/mcp \
  NETWORK=eip155:84532 E2E_UNPAID_ONLY=1 node scripts/e2e.mjs
```

See `docs/session-logs/2026-07-16-bazaar-controlled-rehearsal.md` for the paid
diagnostic evidence and `docs/decisions/0001-bazaar-before-mainnet.md` for the
gate rationale. `docs/plans/prelaunch-unblocked-backlog.md` records the next
unblocked slices, including the privacy/retention decision and buyer pack.
