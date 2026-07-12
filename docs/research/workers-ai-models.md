# Workers AI models as panel/aux providers — feasibility

Fetched 2026-07-12 from developers.cloudflare.com (Workers AI model pages,
pricing, JSON-mode changelog, AI Gateway bindings docs). Model catalog and
prices move fast — re-verify before building.

**Verdict: technically trivial, strategically constrained. Do not touch the
paid panel. Best near-term fit is eval-flywheel graders after mainnet launch;
defer everything until ROADMAP Phase 3+ is done.**

## Technical fit against our provider abstraction

The panel abstraction is `ProviderFn = (prompt, signal) => Promise<string>`
(`src/panel/providers.ts:18`); providers are closures over key+model built in
`buildPanel()` (`providers.ts:92`). A Workers AI provider is a thin wrapper —
`env.AI.run("@cf/...", { messages })` or the OpenAI-compatible
`/v1/chat/completions` REST endpoint. No API-key secret: the binding is
ambient to the Worker.

Gaps a real integration must bridge:

- No `"ai"` binding exists in `wrangler.jsonc`; `Env` (`src/env.d.ts`) would
  need `AI: Ai`.
- `env.AI.run()` takes no AbortSignal — wrap in `Promise.race` against the
  signal so the 60s panel ceiling (`src/panel/orchestrator.ts`) still holds.
- Synthesis is hardcoded to `anthropicProvider` (`src/panel/synthesis.ts:25`);
  swapping it is a code change, not config.
- `buildPanel()` is a hardcoded 3-vendor array and the `vendor` union is
  `"anthropic" | "openai" | "google"` — a Workers AI panelist widens both.
- Local dev with an AI binding bills real account usage.

Upside: many Workers AI models support JSON mode / `guided_json`, which could
*strengthen* output parsing vs. today's labeled-text panel format.

## Catalog & cost (July 2026)

| Model | $/M in / out | Notes |
|---|---|---|
| `@cf/meta/llama-3.3-70b-instruct-fp8-fast` | 0.29 / 2.25 | 24k ctx, function calling |
| `@cf/qwen/qwen3-30b-a3b-fp8` | 0.051 / 0.34 | reasoning, 32k ctx |
| `@cf/nvidia/nemotron-3-120b-a12b` | n/a (new) | large MoE |
| `@cf/google/gemma-4-26b-a4b-it` | n/a (new) | 256k ctx, thinking mode |
| `@cf/deepseek-ai/deepseek-r1-distill-qwen-32b` | 0.50 / 4.88 | reasoning |
| `@cf/zai-org/glm-4.7-flash`, `@cf/mistralai/mistral-small-3.1-24b-instruct` | n/a | guided_json |

Billing is in Neurons ($0.011/1k) on the Workers Paid plan we already need;
10k Neurons/day free. A typical panel call (~2–5k in / ~1k out per model)
costs well under a cent per panelist vs. our ~$0.10–0.12 all-in unit cost.

## Why it can't replace the paid panel

SPEC §1/§5 mandate a **frontier, cross-vendor** panel (Anthropic + OpenAI +
Google minimum) and STRATEGY prices $0.50 explicitly on "includes
frontier-model tokens." Open-weight models all served by one infra provider
weaken both the frontier claim and the independence story the price rests on.
Replacing panelists means re-litigating settled constraints — off the table.

## Where it does fit (effort estimates)

1. **Eval-flywheel graders** (best near-term, post-launch): cheap open models
   re-scoring logged verdicts from the D1 `requests` table. No spec conflict,
   no payment-path risk. ~1–2 days once there's data worth grading.
2. **Cheap product tier later** (e.g. `panel: "open"` at ~$0.05–0.10): a
   pricing-surface change — deferred until after the 30-day gate; requires
   quoting + panel-construction changes. ~3–5 days.
3. **Synthesis fallback / aux tasks** (pre-screening, size estimation):
   small, but adds a binding to the paid path — only with care. ~1 day.
4. **AI Gateway** (adjacent, not Workers AI): route existing vendor fetches
   through `gateway.ai.cloudflare.com` for logs/caching/retries without
   changing vendors or keys. Low-risk observability win. ~half day.
