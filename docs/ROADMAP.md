# ROADMAP — testnet MVP → live on the x402 Bazaar

Status legend: `[x]` done · `[ ]` open · **USER** = needs an operator-supplied
account/wallet/decision; everything else is agent-executable.

The one-line goal: **listed and selling in the Coinbase x402 Bazaar and the
official MCP registry, with instrumentation that can answer the ship gate
(10 organic paying wallets in 30 days — `docs/STRATEGY.md`).**

## Execution issue map

GitHub [issue #3](https://github.com/originallgb/veristat/issues/3) is the
idea/backlog index. Delivery is sliced into the focused issues below; roadmap
checkboxes remain the source of phase order and the issues hold implementation
discussion and evidence.

| Order | Issue | Outcome | Start condition |
|---|---|---|---|
| P0 | [#4](https://github.com/originallgb/veristat/issues/4) | Resolve Bazaar MCP indexing or record the narrow listing waiver | External confirmation or operator decision |
| P0 | [#5](https://github.com/originallgb/veristat/issues/5) | Choose and implement privacy/retention | Operator chooses policy inputs |
| P1 | [#6](https://github.com/originallgb/veristat/issues/6) | Expand evaluation to 20–30 deep cases | Unblocked now; live run remains optional |
| P1 | [#7](https://github.com/originallgb/veristat/issues/7) | Ship the safe Node buyer integration pack | Implementation can start; real-content quickstart waits for #5 |
| P1 | [#8](https://github.com/originallgb/veristat/issues/8) | Prepare and execute registry/distribution launch | Draft now; external actions wait for #4, #5, #7 and Phase 3 |
| P2 | [#9](https://github.com/originallgb/veristat/issues/9) | Decide whether operations need more than the CLI dashboard | Post-launch operational evidence |
| P2 | [#10](https://github.com/originallgb/veristat/issues/10) | Rank panel, response, trust, and research product expansions | Day-30 demand gate |
| P2 | [#11](https://github.com/originallgb/veristat/issues/11) | Evaluate trial, pricing, and payment-model experiments | Observed conversion or payment-friction problem |

## How Bazaar listing actually works (read before Phase 2/3)

There is **no registration form**. The CDP facilitator auto-catalogs an
endpoint the first time it **settles** a payment that carries the Bazaar
discovery extension. Requirements (verified against CDP docs, July 2026):

1. Verify/settle must go through the CDP facilitator
   (`https://api.cdp.coinbase.com/platform/v2/x402`, CDP API keys required).
2. The 402 payment requirements must carry the discovery declaration
   (MCP tool/transport metadata + JSON Schema for the input) — served by
   `bazaarResourceServerExtension` / `declareDiscoveryExtension` from
   `@x402/extensions`.
3. `paymentPayload.resource` must be populated so CDP knows what to catalog.
4. The declaration undergoes **strict JSON Schema validation**; a `"rejected"`
   status in the `EXTENSION-RESPONSES` verify/settle response header means the
   service silently never lists. `"processing"` means the declaration was
   accepted for asynchronous work; it is **not** a terminal status and does not
   prove the resource is visible. The header can also be absent
   (x402-foundation/x402#2112), so discovery reads remain authoritative.
5. Recency filter: resources with no settled activity in 30 days drop out of
   results — listing is not permanent; organic or canary traffic keeps it live.

Testnet rehearsal is supported (Base Sepolia through the CDP facilitator with
the same keys). CDP documentation currently describes a separate x402.org
catalog, but live probes on 2026-07-12 and 2026-07-16 returned 404 for that
path while `/supported` remained healthy. Bazaar rehearsal therefore uses CDP;
x402.org remains fine for plain payment testing. Note the CDP catalog is
~25,500 resources, not the ~100 the strategy session read
(`docs/research/bazaar-listing.md`).

---

## Phase 0 — Agentic engineering init + docs

- [x] Restore CLAUDE.md (was deleted by accident in `e5eeaf5`), extend with
      deploy state + client-script SSE gotcha + docs pointers
- [x] `.claude/settings.json` permissions allowlist + SessionStart hook
      (npm install + local D1 migrations) + `verify-paid-call` skill
- [x] `docs/`: SPEC, STRATEGY, ROADMAP, TESTING, RUNBOOK, research notes
- [x] **USER** (optional): approve one Readwise MCP call in a Claude session so
      saved x402/MCP docs can be distilled into `docs/research/`

## Phase 1 — Test hardening (see docs/TESTING.md for the full matrix)

- [x] Negative-path x402 tests vs mock facilitator: expired quote, tampered
      amount, wrong network, replay, facilitator 500 on settle, degraded panel
- [x] `test/discovery.test.ts`: discovery declaration validates against its own
      JSON Schema (guards the silent-rejection failure mode)
- [x] `scripts/make-test-wallet.mjs` — generate buyer test wallets (gitignored)
- [x] `scripts/e2e.mjs` — full paid-call matrix against any VERISTAT_URL
- [x] `scripts/check-bazaar.mjs` — poll facilitator discovery catalog for us
      (validated against the live CDP catalog, both directions)
- [x] `scripts/bazaar-preflight.mjs` — read-only validation of the deployed
      unpaid challenge, exact `resource.url`, payment fields, and MCP Bazaar
      declaration before spending faucet or real USDC
- [x] Pin the payment/discovery stack to one compatible minor:
      `@x402/core`, `@x402/evm`, and `@x402/extensions` 2.18.x
- [x] Version-aware production smoke: `/health` exposes the Cloudflare version
      metadata id and `scripts/smoke.mjs` accepts `EXPECTED_VERSION`
- [x] `scripts/dashboard.mjs` — D1 settlements/requests with organic split
- [x] GitHub Actions CI: typecheck + vitest on every push/PR
- [x] **USER**: fund generated testnet wallets at https://faucet.circle.com
      (20 USDC / address / 2h on Base Sepolia; no ETH needed)
- [x] Testnet e2e green from a funded non-deployer wallet (ship-gate rehearsal)
      (2026-07-12: E2E OK, tx 0x342e61d0…, $0.50 settled to testnet payto wallet)

## Phase 2 — Bazaar discovery extension + CDP facilitator

- [x] Discovery declaration in the 402 (`@x402/extensions` bazaar, input JSON
      Schema derived from the zod source of truth — `src/payments/discovery.ts`),
      echo-validated against tampering; settle-time echo covered by tests
- [x] `paymentPayload.resource` = `PUBLIC_URL` var (client echoes the 402's
      `resource` — set it to the real workers.dev /mcp URL before rehearsal)
- [x] CDP facilitator auth (`CDP_API_KEY_ID`/`CDP_API_KEY_SECRET` secrets →
      JWT bearer via `@coinbase/cdp-sdk/auth`) — `src/payments/cdp.ts`, selected
      automatically when `FACILITATOR_URL` is api.cdp.coinbase.com
- [x] `EXTENSION-RESPONSES` from verify/settle is decoded and logged by
      @x402/core ("[x402] extension responses: ..." — grep Worker logs for
      `"status":"rejected"`); `check-bazaar.mjs` is the authoritative check
- [x] **USER**: create CDP account + API key pair (portal.cdp.coinbase.com)
      — `CDP_API_KEY_ID`/`CDP_API_KEY_SECRET` set as Worker secrets and
      validated live against `GET /supported` on the CDP facilitator
- [x] Testnet rehearsal: `FACILITATOR_URL` → CDP (base-sepolia), `PUBLIC_URL`
      set, two paid e2e runs settled cleanly (tx `0x4470d78f7a…`,
      tx `0x1a2cca2486…`). `EXTENSION-RESPONSES` shows
      `{"bazaar":{"status":"processing"}}` (accepted for asynchronous
      processing, not proof of listing).
- [ ] Confirm listing via `scripts/check-bazaar.mjs` ([#4](https://github.com/originallgb/veristat/issues/4)) — the controlled final
      rehearsal remained NOT LISTED at baseline, +10, +30, and +60 minutes.
      Sanitized evidence was attached to x402-foundation/x402#2112 in
      [comment 4993727120](https://github.com/x402-foundation/x402/issues/2112#issuecomment-4993727120).
      A community reply proposed Sepolia versus MCP as the remaining
      differential. Live discovery already contains Base Sepolia resources,
      while `type=http` reports 25,387 entries and `type=mcp` reports zero.
      The MCP-indexing question is posted in
      [comment 4994040237](https://github.com/x402-foundation/x402/issues/2112#issuecomment-4994040237).
      Await CDP confirmation; do not spend on the suggested paid A/B probes
      without a new operator decision. This item remains open unless the
      operator records the narrow waiver.

### Phase 2 exit gate — one controlled, auditable rehearsal

Production testnet target: **`https://veristat.grant-23a.workers.dev/mcp`**.
Run this sequence once, in order; `docs/RUNBOOK.md` contains the commands and
secret-handling rules.

1. [x] Dependencies aligned on x402 2.18.x; the commands below re-run the
       typecheck and tests before any payment.
2. [x] Record the deployed Worker version, then pass version-aware smoke and
       the read-only Bazaar preflight against the exact production URL.
3. [x] Start a Worker tail filtered to the SDK's already-sanitized
       `[x402] extension responses:` messages.
4. [x] Make **one** Base Sepolia paid call with `EVIDENCE_FILE` set to a
       tracked JSON path under `docs/session-logs/`.
5. [x] Join the evidence across the payment receipt, BaseScan transaction,
       D1 settlement/request rows, and filtered verify/settle extension status.
6. [x] Run `scripts/check-bazaar.mjs` at +10, +30, and +60 minutes. It checks
       the payee-specific merchant endpoint, semantic search, then the full
       catalog for an exact resource URL match.
7. [x] If still absent at +60 minutes, append the sanitized evidence to
       x402-foundation/x402#2112 before spending another canary payment.

The evidence file may contain public chain/catalog identifiers: target URL,
network, asset, payee, amount, transaction hash, payer, and request id. It must
never contain a private key, payment signature/payload, quote token, CDP JWT or
API secret, panel vendor key, input claim/context, full verdict, or raw Worker
tail. `docs/TESTING.md` defines the record boundary.

## Phase 3 — Mainnet cutover (ordered; do not skip ahead)

**Gate:** do not flip to mainnet until the Phase 2 controlled rehearsal has a
successful receipt and coherent D1/on-chain evidence, and the exact resource
is visible in Bazaar discovery. If the call is sound but Bazaar remains absent
after +60 minutes and issue #2112 has been updated, only the operator may waive
the listing part of the gate. Record that explicit waiver, rationale, accepted
risk, and rollback decision in `docs/session-logs/`; a waiver never bypasses
Workers Paid, receiver-wallet, payment-integrity, or evidence requirements.

1. [ ] **USER**: upgrade Workers plan to Paid ($5/mo) — *before* any mainnet
       call (free-plan 10ms CPU cap can kill a request *after* settlement =
       charging a wallet and returning nothing)
2. [ ] **USER**: real `PAY_TO_ADDRESS` (Base mainnet USDC receiving address —
       Coinbase account address or hardware wallet; replaces the throwaway
       Base Sepolia receiver)
3. [ ] Config flip: `NETWORK=eip155:8453`, `FACILITATOR_URL` → CDP mainnet,
       secrets via `wrangler secret put`, deploy
4. [ ] **USER**: canary buyer wallet, ~$5 USDC on Base mainnet, *not* the
       deployer's wallet
5. [ ] Version-aware smoke + read-only Bazaar preflight against the exact
       deployed mainnet URL, then one canary paid call with sanitized evidence
6. [ ] Confirm the exact resource via merchant/search/full checks at +10, +30,
       and +60 minutes, plus x402scan and BaseScan; escalate or record the
       operator waiver before continuing
7. [ ] Insert canary/test wallet addresses into D1 `known_wallets` (organic
       split instrumentation)

## Unblocked prelaunch work — parallel to the closed Phase 2/3 gate

This work can proceed while Bazaar indexing remains externally blocked. It
does not weaken the Phase 2 exit criteria, authorize another paid probe, or
permit any Phase 3 step. The prioritized implementation slices and explicit
deferrals are in
[`docs/plans/prelaunch-unblocked-backlog.md`](plans/prelaunch-unblocked-backlog.md).

- [x] Registry/public-contract readiness: align registry schema, versions,
      three-panel pricing/copy, offline validation, and operator-controlled
      GitHub OIDC publication automation
- [x] Quality-evaluation baseline: deterministic labelled fixtures, synthesis
      versus naive-majority metrics, and an opt-in no-x402 live runner
- [x] Expand the stable baseline to 20–30 deep, labelled verification cases
      ([#6](https://github.com/originallgb/veristat/issues/6))
      across factual, code/review, migration, ambiguous, and adversarial work
      (20 credential-free synthetic cases; live comparison remains optional)
- [x] Document the current D1 storage truth and the bounded-retention,
      caller-control, and aggregate-only alternatives in
      [`docs/plans/privacy-and-retention.md`](plans/privacy-and-retention.md)
- [ ] **USER**: choose the retention default/window, caller control,
      historical-row treatment, deletion promise, and production-data-use rule
      ([#5](https://github.com/originallgb/veristat/issues/5))
- [ ] Implement the selected policy, tested purge/deletion path, migration and
      fail-safe rollback, and accurate pre-submission buyer disclosure
- [x] Specify the safe Node buyer path (initialize/list, free sample, unpaid
      402, optional Base Sepolia retry through the dedicated dispatcher) in
      [`docs/plans/buyer-integration-pack.md`](plans/buyer-integration-pack.md)
- [ ] Implement and fresh-environment-test the buyer integration pack
      ([#7](https://github.com/originallgb/veristat/issues/7)); the
      synthetic-only unpaid slice now has mocked coverage, a standalone
      lockfile, and a verified clean install. Its public smoke fails closed on
      the documented source-versus-Worker contract mismatch; the optional
      paid buyer path remains. The default path must be unable to spend
- [ ] Draft registry/directory copy, first-user harnesses, outreach text, and a
      launch checklist; do not submit, publish, post, or send without operator
      approval ([#8](https://github.com/originallgb/veristat/issues/8))
- [ ] **USER**: approve the public claims, privacy disclosure, publication
      action, submissions, and outreach batches

Explicitly deferred: additional paid Bazaar probes, mainnet changes,
five-panel execution, automatic refunds, `research_fanout`, and Workers AI.
Their resume conditions are recorded in the linked backlog; none is part of
this prelaunch track.

## Phase 4 — Official MCP registry

- [x] Finalize `server.json`: `io.github.originallgb/veristat`, real
      workers.dev URL
- [ ] Release-truth gate: current registry/public-contract source is newer
      than the active Worker at that URL. Before registry login, tagging, or
      publication, an operator must authorize a deployment and verify the
      public root/`/price`, free sample, and unpaid-402 contract against the
      exact deployed endpoint. This does not authorize a mainnet change or
      paid call.
- [ ] **USER**: `mcp-publisher login github` (device-code flow)
- [ ] `mcp-publisher publish` (run `mcp-publisher validate server.json` first;
      `publish --dry-run` is obsolete)
- [x] GitHub Action for re-publish on version bump (GitHub OIDC, no secrets)

## Phase 5 — Distribution + the 30-day experiment

- [ ] x402scan listing confirmed (automatic once settling on Base mainnet)
- [ ] awesome-x402 PR; Smithery / Glama / PulseMCP submissions
- [ ] **USER**: join Cloudflare Monetization Gateway waitlist (announcement
      post); pitch CF-native launch-partner/case-study angle. Do not block on it.
- [ ] Outreach — the first-ten list from the spec:
  - [ ] ottoai + peer crypto-signal operators on the Bazaar (pre-trade check)
  - [ ] Virtuals ecosystem agent builders
  - [ ] ElizaOS / Daydreams — PR adding veristat as a verification plugin
  - [ ] Cloudflare Agents SDK example PR (their docs need non-crypto x402 demos)
  - [ ] LangGraph template contribution
  - [ ] CrewAI tool directory
  - [ ] Claude Code skill/plugin calling consensus_check before risky commits
  - [ ] x402 community Discord
  - [ ] Two consulting-client harnesses (dogfood, flagged non-organic)
  - [ ] Deep-research power users on X (research_fanout tier pitch)
- [ ] `scripts/dashboard.mjs` weekly review: distinct organic payers vs day-30
      gate
- [ ] Day 30: gate met (≥10 organic wallets) → invest (research_fanout pipeline,
      refunds, 5-panel live). Gate failed → **stop; write the postmortem**
      (`docs/STRATEGY.md`, kill condition).

## Post-launch backlog

- [ ] Decide whether the existing CLI/D1 dashboard is sufficient or a redacted
      activity/admin surface is justified
      ([#9](https://github.com/originallgb/veristat/issues/9)).
- [ ] After the day-30 demand gate, rank additional panels, domain modes,
      response modes, model tracking, human review, signed certificates,
      scenario tooling, and `research_fanout`; implement only the strongest
      evidence-backed slice
      ([#10](https://github.com/originallgb/veristat/issues/10)).
- [ ] Evaluate trial quotas, alternative payment rails/facilitators, and price
      experiments only after observed acquisition or conversion friction
      ([#11](https://github.com/originallgb/veristat/issues/11)).
- [ ] Workers AI for eval graders / cheap tier / AI Gateway — feasibility in
      `docs/research/workers-ai-models.md`; do not touch the paid panel.
- [ ] Coding-tool plugin distribution: Cloudflare's [pay-from-coding-tools](
      https://developers.cloudflare.com/agents/tools/payments/x402/pay-with-tool-plugins/)
      lets Claude Code / OpenCode call x402 endpoints directly from tool
      plugins — a zero-integration channel for coding agents to call
      `consensus_check` mid-session. Evaluate after the Bazaar/registry
      channels in Phase 5 are running (`docs/STRATEGY.md` Distribution).

## Standing constraints

- Settlement only after tool success — a failed panel never charges. Any
  settlement row without a matching verdict is a release blocker.
- Pricing/tool surface/platform are settled (`docs/SPEC.md`) — don't re-litigate.
- Prompts are versioned files; never edit in place.
- Keep Bazaar listing alive: at least one settled call every 30 days.
