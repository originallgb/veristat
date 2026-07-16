# Privacy and retention decision plan

Status: decision and implementation plan. No policy is selected by this
document, and the current runtime behavior is unchanged.

## Current implementation truth

The current `consensus_check` path writes a request row to D1 after successful
panel and synthesis work. There is no scheduled retention job, expiry column,
buyer opt-out, administrative deletion command, or aggregate-only mode.
Absent a manual database operation, the raw fields have no defined deletion
date.

The stored data is:

| Table/field | Current content | Privacy consequence |
|---|---|---|
| `requests.input_json` | Full submitted `content`, plus optional `context` and `question` when provided | Can contain confidential claims, code, plans, or business context |
| `requests.panel_json` | Every panel result, including vendor/model, raw successful output, failure detail, and latency | Retains model-derived analysis of the submitted material |
| `requests.verdict_json` | Full schema-validated synthesized verdict body | Retains the final assessment and supporting details |
| `requests` metadata | Request ID, tool, mode, fulfilled panel size, prompt/synthesis versions, degradation, latency, timestamp | Supports evaluation and operations |
| `settlements` | The same request ID plus transaction hash, payer wallet address, amount, network, tool, and timestamp | The shared request ID can link a raw request row to a public payer address |

Therefore, describing `requests` as merely “minus payer identity” is
incomplete. The payer is stored separately, but `settlements.request_id` and
`requests.request_id` make the records joinable. A wallet address is not
necessarily a person's name, but it is a persistent public identifier and may
be correlatable elsewhere.

Operational evidence rules already prohibit committing input, context, raw
panel output, or full verdict bodies to the repository. Those rules do not
change the fact that the application currently stores those values in D1.

## Decision principles

- Tell a buyer what is stored before a paid call, not only in an operator
  runbook.
- Collect the least raw data needed for an explicitly chosen product purpose.
- Make deletion behavior testable and observable without logging deleted
  content.
- Do not treat separation into two joinable tables as anonymization.
- Never silently repurpose production inputs as public evaluation cases,
  training data, marketing examples, or support artifacts.
- A privacy change must preserve settlement auditability and the ship-gate
  organic-wallet count unless the operator explicitly changes those needs.

## Policy alternatives

The alternatives can be combined, but the operator must choose the default.

### A. Bounded raw retention, then aggregate

Store current raw request fields for a fixed window, then delete them while
retaining only non-content metrics needed for operations and evaluation (for
example category labels created with consent, verdict class, degradation,
latency, prompt versions, and timestamp buckets).

Benefits:

- Preserves a limited debugging/evaluation window.
- Reduces indefinite exposure and makes the promise easy to state.
- Can preserve settlement and aggregate demand evidence.

Costs and open questions:

- The operator must select a window and deletion SLA.
- Aggregation must be defined so free text cannot leak into retained fields.
- Backups, exports, and D1 recovery behavior must be included in the policy;
  deleting the live row alone is not a complete promise if copies exist.

### B. Per-request opt-out (or explicit opt-in)

Allow the caller to request no raw retention, or invert the default and retain
raw material only with explicit consent. The setting must be part of the
documented MCP contract and discovery schema so the caller can reason about it
before payment.

Benefits:

- Gives buyers control for sensitive calls.
- Allows consented examples to support the evaluation flywheel.

Costs and open questions:

- A default-on opt-out still leaves uninformed buyers exposed unless the
  disclosure is prominent.
- The request setting and actual stored row must be testably consistent.
- Pricing, discovery metadata, existing clients, and missing/invalid setting
  behavior require compatibility tests.

### C. Aggregate-only by default

Never persist raw input, panel output, or full verdict. Keep only settlement
evidence and non-content operational metrics. Build the quality corpus from
public/synthetic or separately consented inputs.

Benefits:

- Smallest sensitive-data footprint and simplest buyer promise.
- Removes a join from payer addresses to raw submitted content.

Costs and open questions:

- Gives up the automatic raw-data evaluation flywheel.
- Makes some production debugging impossible after the response completes.
- Requires a deliberate, separate consent path for any retained example.

## Decisions the operator must record

Before implementation, write an ADR that answers all of the following:

1. Which default applies: bounded raw retention, aggregate-only, or another
   explicitly described default?
2. If raw retention exists, what exact duration and deletion SLA apply?
3. Is caller control opt-out or opt-in, and what is the behavior when omitted?
4. Are panel outputs and verdicts governed by the same duration as inputs?
5. What aggregate fields remain after deletion?
6. What happens to raw rows already present when the policy becomes active:
   purge immediately, apply the new window retroactively, or retain under a
   separately disclosed legacy rule?
7. What request-ID-based deletion/support process is promised, who can invoke
   it, and how is requester authority assessed?
8. Which backups, exports, analytics copies, and recovery windows exist, and
   when is deletion considered complete across them?
9. May any production request be used for evaluation, model improvement,
   support, or marketing? If yes, what separate consent and redaction apply?
10. Where will buyers see the disclosure before they submit content or pay?

## Implementation slices

### Slice 1 — Data inventory and policy ADR

- Confirm every application, dashboard, export, log, backup, and support path
  that can contain request content or a payer/request join.
- Record the chosen policy, purpose, lawful/contractual basis as appropriate,
  retention window, deletion semantics, historical-data treatment, and owner.
- Treat this document as engineering input, not legal advice; obtain qualified
  review if the launch audience or jurisdictions require it.

Acceptance criteria:

- The inventory names each raw and aggregate field and every copy location.
- The ADR resolves all ten operator decisions above.
- No implementation begins with an unspecified retention window or legacy-row
  rule.

### Slice 2 — Schema and write-path changes

- Add forward-only migrations for any retention mode, expiry timestamp,
  aggregate table, consent marker, or deletion audit metadata selected by the
  ADR.
- Update `logRequest` so each mode writes exactly the allowed fields. Never
  log raw content as a fallback when a D1 write fails.
- If caller control is selected, update the input schema, Bazaar discovery
  declaration, quote/retry consistency tests, and buyer documentation.
- Keep `settlements` sufficient for payment reconciliation and the organic
  wallet gate, but document the remaining wallet/request linkage.

Acceptance criteria:

- Aggregate-only/no-retention mode cannot write `input_json`, raw panel output,
  or full verdict by construction.
- Bounded-retention rows have an unambiguous expiry derived from one policy
  constant, not ad hoc caller input.
- Existing clients receive the documented default when the setting is absent.
- A failed privacy-related write does not cause settlement of a failed tool or
  expose content in Worker logs.

### Slice 3 — Purge and request deletion

- Implement an idempotent, bounded-batch purge for expired raw rows.
- Add an operator command/runbook to delete by request ID without printing the
  raw row.
- Record only non-content deletion evidence such as counts, policy version,
  completion time, and failure status.
- Define retry, partial-failure, and concurrency behavior. A purge failure must
  alert the operator and must not silently extend retention.

Acceptance criteria:

- Running purge twice produces the same final state.
- Tests cover boundary timestamps, empty batches, multiple batches, partial
  failure/retry, and preservation of the approved aggregates/settlement data.
- The administrative path proves the target raw fields are absent afterward
  without echoing them to stdout or logs.
- Monitoring can show the oldest unexpired row and overdue-row count without
  selecting raw content.

### Slice 4 — Disclosure and buyer controls

- Put concise pre-submission disclosure in README/integration documentation
  and expose a stable detailed policy URL in the public service metadata or
  free sample response.
- State the fields, purpose, duration, payer linkage, opt-in/opt-out behavior,
  deletion path, and policy effective date/version.
- Explain that model providers receive the request to perform the panel and
  synthesis; provider-specific handling must be verified and linked before
  making a promise about it.
- Update launch copy and the buyer integration pack to match the implemented
  policy exactly.

Acceptance criteria:

- A new buyer can learn the policy before entering content or approving a
  payment.
- No copy says data is anonymous merely because payer identity is in another
  table.
- Tool/README/policy/example descriptions agree on the default and duration.

### Slice 5 — Migration, rollback, and historical remediation

- Rehearse the migration and purge against local D1 with synthetic rows only.
- Measure row counts by age without retrieving raw bodies, then apply the ADR's
  approved historical-data rule.
- Define application rollback separately from data rollback. A code rollback
  must not re-enable indefinite raw storage. Data promised as deleted must not
  be restored merely to reverse a release.
- Provide a forward fix for schema errors and a tested way to disable new raw
  writes while preserving the paid request path.

Acceptance criteria:

- Local migration and rollback/fail-safe rehearsal is documented and passes.
- The production runbook has preflight, row-count-only evidence, stop
  conditions, and post-checks.
- The operator explicitly authorizes any remote D1 mutation; implementation
  work alone performs none.
- Historical remediation completion is recorded without raw content.

## Required tests and verification

Add focused tests for the selected policy, then run the existing payment suite
to protect the settlement invariant.

```sh
npm run db:migrate:local
npx vitest run test/logging.test.ts test/privacy.test.ts test/x402.test.ts
npm run typecheck
npm test
```

Documentation consistency checks must search for contradictory claims about
anonymity, retention duration, opt-out/default behavior, and production-data
use. Secret/content hygiene review must cover fixtures and migration evidence
as well as source code.

## Release gate

Do not start broad registry/distribution outreach until the operator has
selected the policy, the implementation and historical remediation are
verified, and the buyer-facing disclosure is live. This privacy gate does not
authorize mainnet or waive any Phase 2/3 requirement.
