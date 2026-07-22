# Unblocked prelaunch backlog

Status: implementation plan. This document does not authorize a deployment,
registry publication, paid call, mainnet change, or privacy-policy choice.

## Purpose and boundary

Bazaar discovery is the current external blocker, but it does not block work
that improves publication readiness, proves product quality, makes data
handling explicit, reduces buyer integration friction, or prepares launch
materials. These tracks can proceed while the Phase 2/3 gate in
`docs/ROADMAP.md` remains closed.

The ordering is intentional:

1. Align the public contract and make registry publication repeatable.
2. Establish a quality baseline against naive majority voting.
3. Make an explicit privacy/retention decision before wider distribution.
4. Build and test the buyer integration path.
5. Prepare launch materials without submitting or sending them.

## Dependency map

| Track | Can start now | Depends on | Operator decision |
|---|---|---|---|
| Registry and public contract | Yes | Current remote endpoint and repository metadata | Approval before publication |
| Quality evaluation | Yes | Existing v1 panel, synthesis, and verdict schema | Credentials only for opt-in live runs |
| Privacy and retention | Design and tests can start | Data inventory in `docs/plans/privacy-and-retention.md` | Policy, window, opt-out, and historical-data treatment |
| Buyer integration pack | Design and unpaid path can start | Dedicated undici dispatcher and stable three-panel contract | Approval before any paid smoke |
| Launch-material preparation | Drafting can start | Stable public copy and privacy disclosure | Approval before any external submission or outreach |

## GitHub issue ledger

The original idea dump is retained as the index in
[#3](https://github.com/originallgb/veristat/issues/3). Work is merged into
the smallest set of slices with distinct outcomes and gates:

| Issue | Slice | Dependency |
|---|---|---|
| [#4](https://github.com/originallgb/veristat/issues/4) | Bazaar MCP indexing or narrow waiver | CDP confirmation or operator decision |
| [#5](https://github.com/originallgb/veristat/issues/5) | Privacy/retention decision and implementation | Operator policy choices |
| [#6](https://github.com/originallgb/veristat/issues/6) | 20–30-case quality corpus | Unblocked; live run optional |
| [#7](https://github.com/originallgb/veristat/issues/7) | Safe Node buyer integration | Real-content path depends on #5 |
| [#8](https://github.com/originallgb/veristat/issues/8) | Registry/distribution launch | #4, #5, #7 and Phase 3 gates |
| [#9](https://github.com/originallgb/veristat/issues/9) | Operational visibility decision | Post-launch evidence |
| [#10](https://github.com/originallgb/veristat/issues/10) | Verification product evolution | Day-30 demand gate |
| [#11](https://github.com/originallgb/veristat/issues/11) | Pricing/access experiments | Observed conversion problem |

## Track 1 — Registry and public-contract readiness

### Objective

Make `server.json`, runtime MCP metadata, package metadata, pricing copy, and
the current three-panel behavior describe one consistent public service. Make
validation and publication repeatable without storing a long-lived registry
publishing secret.

### Implementation tasks

- Update `server.json` to the current official schema, a description within
  the schema's 100-character limit, the public streamable-HTTP remote, and the
  repository metadata.
- Define one runtime version constant and align it with `package.json` and
  `server.json`.
- State that the MVP fulfills and quotes every accepted `panel_size` as a
  three-vendor, three-panel check. Keep `panel_size: 5` input compatibility,
  but do not advertise live five-panel execution or a five-panel price.
- Keep the public price at `$0.50` for the current three-panel service, plus
  the documented large-input surcharge.
- Add credential-free consistency tests and `npm run registry:validate`.
- Add a GitHub OIDC publication workflow with `id-token: write` and no
  long-lived publishing secret. It must run tests and validation before it can
  publish, and it must not deploy the Worker.
- Keep publication operator-controlled. For a manual publication, run
  `mcp-publisher validate server.json` before login and publish; do not use the
  obsolete `publish --dry-run` instruction.

### Acceptance criteria

- Registry schema, description, remote, repository, and all version sources
  pass an offline test.
- Runtime tool copy, README pricing, and the free sample price card make the
  fulfilled three-panel behavior unambiguous.
- The publication workflow has no registry token or wallet/provider secret,
  and only an explicit workflow dispatch or version tag can invoke it.
- No registry publication or Worker deployment occurs during implementation.

### Verification

```sh
npm run registry:validate
npm run typecheck
npm test
```

Before a later operator-approved manual publication:

```sh
mcp-publisher validate server.json
mcp-publisher login github
mcp-publisher publish
```

### Explicit operator decisions

- Approve the final public description and release version.
- Choose the first publication path: GitHub OIDC workflow or manual device
  login.
- Authorize the actual registry publication. Passing validation is not that
  authorization.

## Track 2 — Verification quality evaluation ([#6](https://github.com/originallgb/veristat/issues/6))

### Objective

Measure whether the synthesized verdict is better than a single judgment or
naive panel majority, rather than relying on the product thesis alone.

### Implementation tasks

- Land a credential-free baseline with at least 12 public or synthetic,
  labelled cases covering factual claims, code/review findings, migration
  safety, ambiguous evidence, and adversarial content. Include supported,
  contested, refuted, and insufficient outcomes.
- Expand the launch-quality corpus to 20–30 well-scoped cases after the
  baseline harness is stable. Prefer deeper cases with required findings over
  a large shallow catalogue.
- Compare v1 synthesis with naive majority voting and, where fixtures support
  it, a single-model judgment.
- Report verdict accuracy, required-finding/contradiction recall, schema
  failures, degraded-panel count, calibration evidence where labels permit it,
  latency, and estimated provider cost where available.
- Add deterministic fixture regression tests and an opt-in live runner. The
  live runner may use operator-exported vendor keys, but must not call MCP,
  invoke x402, settle a payment, write D1, read credential files, or print
  secrets.
- Treat the committed v1 fixture result as a baseline. Any later prompt change
  must use new `panel_v2.ts`/`synthesis_v2.ts` files and beat the agreed
  baseline before rollout; v1 prompts are never edited in place.

### Acceptance criteria

- `npm run eval` is deterministic, credential-free, and exits nonzero for
  malformed/missing cases, schema failures, or a regression below the
  committed baseline.
- Results include both synthesis and naive-majority metrics, plus required
  finding recall.
- `npm run eval:live` fails closed when required environment variables are
  absent and prints aggregate/per-case status without raw secrets.
- Evaluation documentation distinguishes fixture regression checks from
  vendor-token-costing live runs.

### Verification

```sh
npm run eval
npx vitest run test/eval.test.ts
npm run typecheck
npm test
```

### Explicit operator decisions

- Approve the minimum metric improvement required for a future v2 rollout.
- Decide whether live evaluation may be run and accept its vendor-token cost.
- Approve any production-derived case only after privacy policy, consent, and
  redaction requirements are settled.

## Track 3 — Privacy and retention ([#5](https://github.com/originallgb/veristat/issues/5))

The current D1 implementation stores complete submitted input fields, raw
panel results, and the synthesized verdict with no automatic retention job.
The request ID also permits linkage to the payer address stored in the
settlement table. The implementation plan, alternatives, decision points, and
test requirements are in
[`privacy-and-retention.md`](privacy-and-retention.md).

### Acceptance criteria

- The operator chooses and records a policy before wider distribution.
- Buyer-facing disclosure accurately describes what is stored, for how long,
  for what purpose, and how deletion/opt-out works.
- Implementation includes tested deletion, migration, rollback, and
  historical-data handling rather than only updated prose.

## Track 4 — Buyer integration pack ([#7](https://github.com/originallgb/veristat/issues/7))

Build a copyable Node example that initializes the MCP session, lists tools,
calls the free sample, verifies the unpaid 402, and optionally retries with a
payment using the dedicated undici dispatcher. Full tasks and safeguards are
in [`buyer-integration-pack.md`](buyer-integration-pack.md).

### Acceptance criteria

- The default example cannot spend money.
- The optional paid path is Base Sepolia-only, requires explicit enablement,
  uses a caller-supplied throwaway wallet, and enforces a payment cap.
- A fresh-environment smoke proves the documented install and unpaid flow.

## Track 5 — Launch-material preparation ([#8](https://github.com/originallgb/veristat/issues/8))

### Objective

Prepare the assets needed to publish and recruit the first users so launch is
not delayed after the external gate clears. This track drafts assets only; it
does not submit listings, open pull requests, post publicly, or contact people.

### Implementation tasks

- Draft one consistent short description, long description, capability list,
  current price, privacy disclosure, Base network statement, and support path
  for the official MCP registry, x402scan, awesome-x402, Smithery, Glama, and
  PulseMCP.
- Prepare a buyer-facing quickstart that links to the Node integration pack
  and makes the free/unpaid/paid boundaries obvious.
- Turn the Phase 5 first-ten list into a small number of channel-specific
  harness examples and outreach drafts: pre-trade verification, risky-code
  review, research-claim checking, and consulting-client dogfood. Flag owned
  test/consulting traffic as non-organic.
- Prepare a launch checklist containing owners, destination URLs, required
  assets, proof links, and rollback/correction steps.
- Ensure every asset describes the current three-panel service and does not
  promise `research_fanout`, live five-panel execution, or automatic refunds.

### Dependencies

- Final registry/public-contract copy.
- Operator-selected privacy and retention disclosure.
- A stable buyer example and quality baseline that can support factual claims.

### Acceptance criteria

- Every destination has a draft conforming to its field/length requirements.
- Claims about quality, price, panel size, network, and retention point to
  repository evidence and are mutually consistent.
- No material contains secrets, production input, full verdict bodies, or raw
  logs.
- All external actions remain unchecked and require operator approval.

### Verification

- Run a terminology search for old five-panel pricing, unavailable features,
  stale registry commands, and conflicting network claims.
- Review all links and copy in a clean Markdown render.
- Compare quality claims against the committed evaluation output.
- Perform a secret-shaped-material scan before committing drafts.

### Explicit operator decisions

- Approve the claims, tone, support path, and privacy disclosure.
- Choose which channels launch first.
- Authorize each submission, pull request, public post, or outreach batch.

## Track 6 — Operational visibility decision ([#9](https://github.com/originallgb/veristat/issues/9))

The existing `scripts/dashboard.mjs` and documented D1 queries are the MVP
operations surface. Do not turn the brainstormed live-activity and admin views
into two speculative UIs. First define the public-demo questions, operator
actions, data classification, authentication, redaction, freshness, and cost.

The run evidence is currently fragmented: local tests and smoke checks print
to the terminal, GitHub Actions retains unstructured job logs without uploaded
artifacts, fixture evaluation data is committed under `eval/`, live evaluation
summaries are stdout-only, controlled paid rehearsals write sanitized evidence
under `docs/session-logs/`, production requests and settlements live in D1,
and raw Worker tails are intentionally transient. There is no unified run ID,
run index, durable test-report archive, or cross-path trace store.

Before implementing another operations surface:

- Define a common run envelope covering run kind, environment, commit/Worker
  version, start/end time, status, duration, checks or metrics, degradation,
  and pointers to permitted evidence.
- Map Vitest/typecheck, smoke/preflight, fixture/live evaluation, paid
  rehearsal, Bazaar checks, and production requests onto that envelope.
- Classify fields and define retention/deletion before selecting D1, GitHub
  Actions artifacts, R2, tracked sanitized evidence, or terminal-only output.
- Correlate run IDs with request IDs, transaction hashes, commits, deployments,
  and CI runs without duplicating prompts, raw panel output, verdict bodies, or
  payment material.
- Keep production request retention governed by the privacy decision in
  [#5](https://github.com/originallgb/veristat/issues/5); observability must not
  become a second uncontrolled copy of sensitive data.
- Preserve the invariant that failed observability writes cannot charge a
  buyer or fail an otherwise successful request.

### Exit criteria

- Document the current storage matrix and one versioned run-envelope schema.
- Make retention, redaction, correlation, and failure behavior testable.
- Record that CLI plus structured run history is sufficient through the
  experiment; or produce one bounded UI specification and a separately
  estimated implementation issue, with sensitive fields prohibited by default.

## Track 7 — Evidence-gated product and commercial discovery

Two post-launch epics retain the longer-range ideas without mixing them into
launch-critical implementation:

- [#10](https://github.com/originallgb/veristat/issues/10) merges panel shapes,
  domain modes, response variants, model behavior tracking, human review,
  signed certificates, scenario building, and research fanout into one ranked
  product-discovery decision. Resume after the day-30 demand gate.
- [#11](https://github.com/originallgb/veristat/issues/11) merges payment
  alternatives, trial/free quotas, and pricing experiments. Resume only when
  usage or buyer feedback identifies a concrete conversion or payment-friction
  problem.

Each epic must produce at most one recommended implementation slice with
explicit economics, privacy impact, public-contract changes, success measures,
and rollback criteria. It may also conclude that no expansion is justified.

## Explicit deferrals

These items are not workarounds for the current blocker and are not part of
the unblocked sprint:

| Deferred item | Resume condition |
|---|---|
| Additional paid Bazaar probes, including Sepolia-HTTP or mainnet-MCP A/B calls | New explicit operator authorization after reviewing issue #2112 evidence |
| Mainnet cutover or canary payment | Every Phase 3 gate, including operator-supplied wallet/plan decisions, is satisfied or the narrow listing gate is formally waived |
| Live five-panel execution and pricing | Post-launch demand gate and a separately approved design/economic review |
| Automatic refunds | Post-launch demand gate and a payment-safe refund design |
| `research_fanout` / `get_research_result` implementation | Post-launch demand gate; current stubs remain `NOT_AVAILABLE` |
| Workers AI graders, cheap tier, or paid-panel changes | After the Bazaar/registry channels and v1 evaluation baseline are operating |

The standing settlement invariant is unchanged: a failed panel must never
charge the buyer, and payment-critical work must not move to `ctx.waitUntil`.
