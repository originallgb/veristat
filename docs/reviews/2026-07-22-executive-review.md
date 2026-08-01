# Veristat Executive Review

**Project, current state, outstanding issues, and paths to launch**
**Prepared:** 22 July 2026
**Review basis:** repository `main`, live Cloudflare Worker, D1 operating data, Coinbase Bazaar discovery, GitHub issues and CI, and upstream x402 issue evidence.

## Executive judgment

Veristat has crossed the line from prototype to credible testnet product. The core service works: a buyer can receive a valid x402 payment challenge, pay with Base Sepolia USDC, invoke a cross-vendor three-model panel, receive a structured verdict, and leave coherent on-chain and D1 evidence. The payment design is unusually disciplined for an MVP: the panel runs before settlement, paid operator scripts fail closed, discovery metadata is schema-validated, and the current test suite exercises the principal payment failure branches.

It is not yet launch-ready in the commercial sense. The live Worker is an older release than the code now on `main`; the current public price contract is therefore inconsistent with the reviewed source. The service retains full customer submissions, panel output, and verdicts indefinitely and can join them to payer wallets through the request ID. Coinbase Bazaar has accepted three discovery-bearing settlements, including a controlled diagnostic, but still does not list the MCP resource. The account has not been confirmed ready for Workers Paid, the mainnet receiving and canary wallets have not been supplied, no registry publication has occurred, and there are no organic buyers.

The central decision is no longer whether the technology works. It is whether to keep waiting for Bazaar MCP indexing, waive only that listing gate and launch through the official MCP registry plus direct distribution, or add a separate x402 HTTP facade that the Bazaar is more likely to index. The recommended course is to finish the internal gates now, impose a short decision deadline on the external Bazaar dependency, and then use a narrow waiver to run the 30-day demand test unless Bazaar support is confirmed. That is the fastest route to learning whether anyone will pay without turning an upstream indexing defect into an indefinite project hold.

## Decision summary

| Dimension | Executive assessment | Evidence as of 22 July 2026 |
|---|---|---|
| Product thesis | Coherent but commercially unproven | Independent cross-vendor verification for $0.50; zero organic payers |
| Core implementation | Strong MVP | Three vendors, schema-enforced synthesis, deterministic quoting, settlement after successful execution |
| Payment integrity | Testnet-proven | Four settled calls, $2.00 total, one known test payer, no degraded requests |
| Release readiness | Blocked | Reviewed source is 22 commits newer than the active Worker; the no-spend buyer example rejects the stale live contract |
| Privacy readiness | Blocked | Raw input, raw panel output, and verdicts are retained with no expiry and are joinable to payer wallets |
| Bazaar distribution | Externally blocked | Exact resource absent from merchant, search, and full catalog checks; 24,875 resources scanned on 22 July |
| Registry readiness | Prepared, not published | `server.json` validates and publication automation exists; live endpoint truth does not yet match source |
| Quality evidence | Useful regression evidence, not market proof | 20 synthetic cases: 95% synthesis labels, 30% naive majority, 100% required-finding recall, zero schema failures |
| Security and dependencies | Needs prelaunch triage | Seven production advisories: two high and five moderate; one high-severity transitive fix is open in PR #13 |
| Commercial validation | Not started | Four test settlements, no organic wallets, no public launch, no 30-day experiment |

## What the project is

Veristat is a remote MCP service on Cloudflare Workers. Its paid `consensus_check` tool sends a claim, plan, answer, or code change to one model each from Anthropic, OpenAI, and Google. A separate synthesis model returns a structured verdict containing agreements, contradictions, dissent, and a confidence-oriented consensus score. Buyers pay per request through x402 in USDC and do not need separate vendor accounts.

The current product is deliberately narrow:

- `consensus_check` is live as a three-vendor, three-model service.
- `get_sample_verdict` is free and provides a trust and discovery path.
- `panel_size: 5` is accepted for compatibility but is still fulfilled by three models.
- `research_fanout` and `get_research_result` are registered stubs that return `NOT_AVAILABLE`.
- Automatic refunds, live five-panel execution, a web dashboard, and alternate payment rails are not part of the MVP.

The business thesis is that a neutral cross-vendor verdict can command $0.50 when a builder would otherwise manage several model accounts and build a verification subsystem. The declared operating test is intentionally unforgiving: reach 10 distinct organic paying wallets within 30 days of listing, excluding all operator and canary wallets. If the gate fails, the demand thesis has failed and the project should stop rather than expand the feature set.

## Current project state

### Repository and release state

The reviewed work is on GitHub `main` at merge commit `e734219`. PR #12, containing the payment hardening, evaluation expansion, buyer example, registry preparation, and updated handoff documentation, is merged and its CI passed. A later documentation PR also passed CI. The local working branch is clean but four commits behind `origin/main` and has no unique commits.

The active Worker is version `7874ca15-2abf-4006-af13-d27fbdb54b47`, deployed from commit `8328f3c` on 16 July. Current `main` is 22 commits beyond that deployment. This is not merely a documentation gap. The active `/price` endpoint still advertises `$1.50` for `panel_size: 5` while explicitly routing it to a three-model panel. Current source instead treats both accepted panel sizes as the existing $0.50 three-panel service. The reviewed Node buyer example correctly fails closed against the stale live free-sample contract.

The active endpoint should therefore be treated as a rehearsal service, not as a public commercial offer. It must be redeployed from reviewed `main` and its root, `/price`, `/health`, free sample, and unpaid 402 contract verified before registry publication or buyer outreach.

### Verification and operating evidence

The current source passes:

- TypeScript type checking.
- All 80 Vitest tests across nine test files.
- Offline MCP registry validation.
- The credential-free 20-case evaluation suite.
- Live no-payment Bazaar preflight against the exact production testnet endpoint.
- Live unpaid MCP end-to-end checks for tool listing, free sample, x402 challenge, signed quote, and discovery metadata.

The D1 operating dashboard currently reports:

- 4 settlements.
- $2.00 gross testnet value.
- 1 distinct payer, correctly marked as a known test wallet.
- 0 organic payers.
- 4 request rows, 0 degraded requests, and average recorded latency of about 21.7 seconds.

This proves system operation, not customer demand. All paid traffic is controlled test traffic.

### Bazaar state

The controlled 16 July diagnostic settled successfully and its Base Sepolia receipt, D1 settlement row, and D1 request row agreed. CDP returned Bazaar status `processing` for both verify and settle, not `rejected`. The resource was still absent at baseline, +10, +30, and +60 minutes. The reproduction was added to x402-foundation/x402 issue #2112.

The stronger current hypothesis is that the Bazaar accepts MCP discovery declarations but does not publish `input.type=mcp` resources. Base Sepolia resources exist in the catalog, while earlier checks showed HTTP resources and no MCP resources. The upstream issue is closed and there has been no authoritative response to the project's follow-up. A fresh read-only scan on 22 July again found zero merchant matches, zero search matches, and no exact Veristat resource across 24,875 catalog entries.

No further paid diagnostic should be made without a new operator decision. The evidence is already sufficient to show that repeated testnet spending is unlikely to clarify the backend capability gap.

## Outstanding issues

### P0: must be resolved before any commercial launch

1. **Choose the Bazaar position.** Issue #4 remains open. Either obtain explicit CDP confirmation and a visible listing, or record the narrow waiver permitted by ADR-0001. The waiver applies only to Bazaar visibility; it does not waive payment safety, Workers Paid, wallet separation, evidence, privacy, or mainnet canary requirements.

2. **Choose and implement privacy and retention.** Issue #5 is the most important internal blocker. The service currently stores full submitted content, optional context and question, every raw panel response, and the full verdict with no automatic expiry. The request row is joinable to the public payer wallet in `settlements`. There is no buyer opt-out, purge job, request deletion command, historical-row decision, or production-data-use rule. A policy decision, migration, tested purge/deletion path, historical remediation, fail-safe rollback, and buyer-facing disclosure are required.

3. **Deploy reviewed `main` and close the release-truth gap.** The current Worker serves stale and economically misleading five-panel pricing. Deployment requires explicit authorization, followed by version-aware verification of `/health`, root and `/price`, free sample, and unpaid 402 behavior. This is a testnet release update, not permission to switch to mainnet or make a paid call.

4. **Confirm Workers Paid before mainnet.** The project requires the paid plan before any real payment. The free-plan CPU limit creates the unacceptable possibility that settlement succeeds and the Worker is terminated before returning the verdict.

5. **Provide separate mainnet wallets.** The operator must supply a real Base USDC receiving address and a separate canary buyer wallet with a small balance. The current receiving address is a throwaway Base Sepolia address and must not be reused.

6. **Complete and evidence the mainnet cutover.** Change the network to `eip155:8453`, retain the CDP facilitator, deploy, run version-aware smoke and no-spend preflight, make exactly one canary payment, verify BaseScan/x402 evidence and D1 joins, add canary addresses to `known_wallets`, and confirm or waive discovery before wider traffic.

7. **Triage production dependency advisories.** The current production audit reports two high and five moderate advisories. PR #13 is green and fixes the high-severity `fast-uri` advisory. The remaining high advisory is in Axios through the Coinbase CDP SDK; the moderate set includes the MCP SDK, Cloudflare Agents/codemode, and the Hono Node adapter. Some may not be reachable in the Worker bundle, but that must be demonstrated rather than assumed. Resolve, upgrade, constrain, or record a specific risk acceptance before mainnet.

### P1: complete for a controlled launch

8. **Finish the buyer integration pack.** Issue #7 is partially delivered. The self-contained no-spend Node example, dedicated dispatcher, lockfile, mocked tests, and clean install are complete. Its public run will remain failed closed until the Worker is updated. The optional Base Sepolia paid example and human confirmation flow are not implemented. The paid example is useful but not required for the first no-spend quickstart; a deliberate decision should either finish it or defer it explicitly.

9. **Finish launch assets and approvals.** Issue #8 remains open. Registry and directory descriptions, channel-specific examples, support path, privacy statement, launch checklist, correction procedure, and outreach batches have not been completed and approved. No external publication, post, directory submission, or outreach is authorized yet.

10. **Publish the official MCP registry entry.** The source metadata validates, but publication is blocked until the live contract matches it. After that, the operator must choose GitHub OIDC or device login, authorize publication, validate once more, and publish.

11. **Reconcile the issue tracker with delivered work.** All project issues #3 through #11 remain open. Issue #6's core deliverable is already complete at 20 deterministic cases, but its optional live evaluation has not been authorized or explicitly deferred in the issue. Issue #7 is materially partial. Issue #3 still presents delivered items as open. The tracker should distinguish done, deferred by decision, blocked, and genuinely unstarted work.

12. **Decide whether to run a live quality and cost baseline.** The 95% fixture result is valuable regression evidence but cannot support a claim about current vendor performance, latency, or economics. The provider clients do not currently retain token usage or calculate actual per-request model cost. A small operator-authorized live synthetic evaluation and a cost measurement would strengthen launch claims and test the assumed gross margin. It should not use production content and does not need x402 payment.

### P2: acceptable to defer, but disclose or plan explicitly

13. **Manual refunds only.** A degraded two-of-three verdict is flagged, but the promised refund is not automatic. The incident process is manual. Launch copy must not imply automatic refunds.

14. **Operational history is fragmented.** Issue #9 records that tests, CI, evals, rehearsals, Worker logs, and D1 requests do not share a unified run ID or durable run index. The existing CLI and D1 dashboard are adequate for a small 30-day experiment if that is an explicit decision; a speculative admin UI should not become a launch blocker.

15. **No permanent Bazaar listing.** Catalog visibility can lapse after 30 days without settled activity. If Bazaar indexing starts working, a known canary or organic traffic must refresh it, and canary activity must remain excluded from the demand metric.

16. **Stubbed and compatibility features remain constrained.** `research_fanout` and result retrieval are unavailable; five-panel execution is not live; alternative response modes, human review, signed certificates, scenario tools, Workers AI, alternate payment rails, and trial pricing are deferred. These belong in issues #10 and #11 only after demand evidence.

17. **The business has no demand evidence yet.** The project has proven payment and execution, not willingness to pay. No revenue or margin narrative should count the $2.00 of testnet rehearsal value as sales.

## GitHub issue status in executive terms

| Issue | Executive status | Launch relevance |
|---|---|---|
| #3 Backlog index | Open and partly stale | Governance cleanup |
| #4 Bazaar MCP indexing or waiver | Blocked on CDP or operator decision | P0 |
| #5 Privacy and retention | Decision and implementation not started | P0 |
| #6 20-30 case evaluation | Core deliverable complete; live run undecided | Close or narrow |
| #7 Safe Node buyer pack | No-spend path complete; paid path incomplete; live smoke blocked by stale Worker | P1 |
| #8 Registry and distribution launch | Preparation and execution outstanding | P1 |
| #9 Operational visibility | Deferred until operating evidence | Post-launch |
| #10 Product evolution | Deferred until the day-30 demand gate | Post-launch |
| #11 Pricing and payment experiments | Deferred until observed conversion friction | Post-launch |

## Paths to launch

### Path A: wait for native Bazaar MCP support

Finish all internal work while holding mainnet and public launch until CDP confirms MCP indexing and Veristat appears in the Bazaar.

**Advantages:** preserves the original distribution thesis; avoids launching without the intended discovery channel; requires no new public interface.
**Disadvantages:** timeline is controlled by an unresponsive external dependency; the upstream issue is closed; waiting does not produce demand evidence.
**Use when:** Bazaar listing is a non-negotiable definition of launch and delay is acceptable.

### Path B: narrow Bazaar waiver, then controlled MCP launch - recommended

Complete privacy, dependency triage, the reviewed testnet deploy, Workers Paid, wallet separation, and the mainnet canary. Record the narrow Bazaar waiver, publish to the official MCP registry, distribute the no-spend buyer example, and recruit the first buyers directly through a few approved channels. Continue read-only Bazaar monitoring in parallel.

**Advantages:** fastest path to the actual business question; preserves the existing architecture and payment safety; avoids further diagnostic spending; creates a real 30-day demand window.
**Disadvantages:** removes the strongest automatic discovery channel from the first experiment; acquisition becomes manual; the result tests product plus outbound execution rather than Bazaar-native demand alone.
**Use when:** the priority is learning whether buyers will pay, not waiting for perfect channel availability.

The waiver record should state the accepted risk, monitoring plan, rollback trigger, and the fact that a successful mainnet payment may still not create a Bazaar listing.

### Path C: add a bounded x402 HTTP facade for Bazaar discovery

Expose the same verification pipeline through a separately documented paid HTTP resource while retaining MCP as the primary integration and official registry entry. The Bazaar currently contains HTTP resources, so this may create a catalogable entry without pretending the MCP record is indexed.

**Advantages:** preserves access to the Bazaar channel; may fit the existing population of x402 buyers better; leaves MCP available for agent clients.
**Disadvantages:** adds a new public contract, duplicate integration and test burden, privacy and documentation work, and potential payment-path risk; indexing is plausible, not guaranteed.
**Use when:** Bazaar visibility is essential enough to justify a bounded product-surface addition.

This path should have a hard scope: one HTTP route, the same three-panel service and price, shared validation and logging, complete negative-path tests, and no new paid probe until the no-spend contract passes. It should not become a general API rewrite.

### Path D: remain on testnet as a private integration beta

Deploy reviewed `main` to the Base Sepolia rehearsal endpoint, finish the no-spend buyer quickstart, and invite a small set of known testers without enabling mainnet or calling the exercise a commercial launch.

**Advantages:** lowest financial and privacy exposure; useful for integration feedback; buys time for CDP and privacy decisions.
**Disadvantages:** produces little evidence about willingness to pay; faucet-funded behavior is not commercial behavior; delays the 30-day gate.
**Use when:** the operator is not ready to select a privacy policy, supply mainnet wallets, or authorize publication.

### Path not recommended: more ad hoc paid diagnostics

A mainnet MCP payment or a Sepolia HTTP payment could isolate indexing behavior, but the existing read-only differential already points to MCP indexing. More spending without a launch decision adds cost and risk while postponing the privacy, release, and wallet work that is required under every path.

## Recommended launch sequence

### 1. Close the internal release gates

1. Choose the privacy default and record it in an ADR. The strongest buyer-trust default is aggregate-only storage, with raw retention available only through separate explicit consent. If a bounded raw window is chosen instead, specify the exact duration, deletion SLA, historical-row treatment, and provider-data disclosure.
2. Implement the policy, migrations, purge and targeted deletion paths, historical remediation, rollback protection, and pre-submission disclosure.
3. Merge or otherwise apply the `fast-uri` fix, triage the remaining production advisories, and record any narrow risk acceptance.
4. Update GitHub issues so #6 reflects completion, #7 reflects partial delivery, and #3 matches the actual roadmap.
5. Authorize a testnet deployment of current `main`, then verify the exact deployed version and public contract. Rerun the no-spend buyer example until it passes against the public endpoint.

### 2. Make the distribution decision

Set a short explicit deadline for a CDP answer while the internal work is being completed. If CDP confirms MCP support, verify the listing and proceed. If it does not, choose between:

- Path B, the narrow waiver and controlled MCP launch, as the default; or
- Path C, a bounded HTTP facade, only if Bazaar discoverability is strategically mandatory.

Do not leave the project in an undefined wait state.

### 3. Execute the controlled mainnet cutover

1. Confirm Workers Paid.
2. Supply the mainnet receiving address and separate canary buyer wallet.
3. Deploy Base mainnet configuration from reviewed source.
4. Run version-aware smoke and no-spend preflight.
5. Make one approved canary payment and reconcile the receipt, chain transaction, request row, and settlement row.
6. Mark all operator and canary wallets in D1 before measuring demand.
7. Publish the official MCP registry entry only after the live contract matches.

### 4. Launch in controlled batches

Start with a few high-fit channels rather than every directory at once:

- Trading and crypto-agent builders who can tie a verification call to trade risk.
- Coding-agent builders who need a pre-commit or migration sanity check.
- Research users who need independent claim verification.
- Two known consulting or dogfood integrations, clearly excluded from the organic metric.

Publish the no-spend quickstart first. Add the optional paid buyer example only after its confirmation and cap behavior are complete and reviewed.

### 5. Enforce the experiment

Start the 30-day clock from the first genuine public availability date. Review distinct organic payer wallets weekly. Do not count test, operator, canary, or owned consulting wallets. At day 30:

- 10 or more organic paying wallets: continue, interview buyers, and choose at most one evidence-backed expansion.
- Fewer than 10: stop expansion, write the postmortem, and treat the result as a failed demand thesis rather than an engineering failure.

## Decisions required from the operator

The project can progress only after the following explicit decisions:

1. Bazaar: keep waiting, record the narrow waiver, or authorize a bounded HTTP-facade design.
2. Privacy: aggregate-only, bounded raw retention, or another precise policy; include historical rows and production-data-use rules.
3. Deployment: authorize updating the Base Sepolia Worker from current `main`.
4. Security: define the acceptable treatment of unresolved dependency advisories before mainnet.
5. Mainnet: confirm Workers Paid and provide separate seller and canary wallets.
6. Quality: authorize or defer a small live synthetic evaluation and cost baseline.
7. Publication: approve public claims, registry publication, directory submissions, and each outreach batch.

## Final assessment

Veristat is much closer to launch than its open issue count suggests, but farther from launch than its successful testnet settlements suggest. The hard engineering problem - making a paid multi-model MCP call settle safely and return a structured result - is substantially solved. The remaining work is release truth, privacy, dependency risk, distribution, and commercial proof.

The project should not spend another cycle adding panels, research tools, dashboards, payment variants, or pricing experiments. It should close the privacy and release gates, choose a Bazaar position, launch the narrow three-panel service, and let the 30-day payer test decide whether Veristat deserves further investment.

## Evidence references

- `docs/context/current-state.md`
- `docs/ROADMAP.md`
- `docs/STRATEGY.md`
- `docs/RUNBOOK.md`
- `docs/EVALS.md`
- `docs/plans/privacy-and-retention.md`
- `docs/plans/buyer-integration-pack.md`
- `docs/plans/prelaunch-unblocked-backlog.md`
- `docs/session-logs/2026-07-22-project-up-to-speed.md`
- GitHub issues #3-#11 in `originallgb/veristat`
- x402-foundation/x402 issue #2112, including Veristat evidence comments 4993727120 and 4994040237

This review distinguishes verified current evidence from planned work. It made no deployment, paid call, registry publication, secret-store change, privacy decision, mainnet change, or external post.
