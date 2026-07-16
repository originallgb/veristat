# Verification quality evaluations

The evaluation harness gives Veristat a repeatable quality gate that is separate
from payment and deployment testing. It exercises the same panel prompt,
three-vendor panel orchestration, verdict schema, and synthesis path used by the
MCP tool, but it never calls MCP, x402, settlement, or D1.

## Fixture regression check

Run the default check without credentials or network access:

```sh
npm run eval
```

The command loads `eval/cases.json` and `eval/fixture-results.json`, validates
every synthesized verdict with `verdictSchema`, and prints a JSON summary. It
exits nonzero when case/result IDs are missing or duplicated, panel labels are
malformed, a verdict fails its schema, or a tracked metric falls below the
committed fixture baseline.

The public corpus contains synthetic claims only. It covers factual claims,
code review, migration safety, ambiguous evidence, and adversarial claims, with
examples of every supported verdict. No customer input or production response
belongs in either fixture file.

The fixture is a deterministic regression test for the scorer and expected
v1-shaped behavior. Its latency values are fixed test data, not a current
service benchmark, and its scores must not be presented as evidence of live
provider quality.

## Metrics

- `synthesisAccuracy`: fraction of synthesized verdict labels matching the
  labelled cases.
- `naiveMajorityAccuracy`: fraction matched by a simple majority of panel
  `ASSESSMENT:` labels. A tied vote is treated as `contested`.
- `requiredFindingRecall`: fraction of labelled required findings present in
  the structured synthesized verdict.
- `schemaFailures`: verdicts rejected by the runtime `verdictSchema`.
- `degraded`: cases completed with fewer than all three vendors.
- `averageLatencyMs`: mean end-to-end latency for results that provide latency.

The naive-majority comparison is deliberately simple. It establishes whether
synthesis adds value by weighing specific evidence instead of counting votes;
it is not a replacement verdict algorithm.

## Opt-in live evaluation

Live evaluation makes direct vendor-token calls and therefore incurs Anthropic,
OpenAI, and Google API costs. It makes no x402 payment and writes no D1 record.
It reads credentials only from the current process environment; it does not
load `.env`, `.dev.vars`, keychain, wallet, or credential files.

Export all seven values explicitly:

```sh
export ANTHROPIC_API_KEY='...'
export OPENAI_API_KEY='...'
export GOOGLE_API_KEY='...'
export PANEL_MODEL_ANTHROPIC='...'
export PANEL_MODEL_OPENAI='...'
export PANEL_MODEL_GOOGLE='...'
export SYNTHESIS_MODEL='...'
npm run eval:live
```

The runner prints only each synthetic case ID, verdict, latency/degraded status,
and aggregate metrics. It does not print keys or raw model responses. Missing
environment values fail before any provider request is made.

Live results vary with provider and model changes. Record the date, model IDs,
prompt versions, aggregate summary, and any provider incidents when treating a
run as release evidence. Do not commit API keys or raw provider payloads.

## Prompt-version rollout gate

Prompt modules remain immutable. A candidate must use new files such as
`panel_v2.ts` and `synthesis_v2.ts`; do not edit the v1 modules in place.

Before rollout, run the incumbent v1 and candidate versions on the same corpus
with the same model IDs and a close time window. The candidate must:

1. exceed the committed v1 synthesis-accuracy and required-finding baselines;
2. preserve zero schema failures;
3. retain the synthesis advantage over naive majority;
4. explain any additional degraded cases or material latency increase; and
5. pass the credential-free fixture check and the full project test suite.

If the candidate does not improve quality, keep v1. Refreshing labels or
required findings requires human review and a separate change so a prompt
cannot improve its score by silently weakening the benchmark.
