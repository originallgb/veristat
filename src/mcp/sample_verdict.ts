import type { VerdictResponse } from "./schemas";
import { computePriceUSD } from "../payments/quoting";

/** Canned-but-real example verdict for the free discovery tool (spec §2). */
export const SAMPLE_VERDICT: VerdictResponse = {
  verdict: "contested",
  consensus_score: 0.45,
  agreements: [
    { point: "The proposed index change will speed up the read path for the stated query pattern.", models_agreeing: 3 },
    { point: "The migration is reversible if run inside a transaction.", models_agreeing: 2 }
  ],
  contradictions: [
    {
      point: "Whether the migration is safe to run against the live primary during business hours",
      positions: [
        {
          stance: "Unsafe: CREATE INDEX without CONCURRENTLY takes an exclusive lock and will block writes on a table this size",
          models: ["anthropic/claude-sonnet", "google/gemini-flash"],
          reasoning: "At ~40M rows the index build will hold a write lock for minutes; the plan does not use CONCURRENTLY or schedule a maintenance window."
        },
        {
          stance: "Acceptable: table write volume shown in the context is low enough that a brief lock is tolerable",
          models: ["openai/gpt-mini"],
          reasoning: "The context indicates <5 writes/sec; a short exclusive lock is an inconvenience, not an outage."
        }
      ]
    }
  ],
  dissent: [
    {
      model: "google/gemini-flash",
      position: "The rollback step drops the wrong index name; even if the build succeeds, the runbook as written cannot be reversed cleanly."
    }
  ],
  panel: [
    { vendor: "anthropic", model: "claude-sonnet" },
    { vendor: "openai", model: "gpt-mini" },
    { vendor: "google", model: "gemini-flash" }
  ],
  synthesis:
    "The panel agrees the index will help the read path but splits on operational safety: two of three models flag that building the index without CONCURRENTLY will lock writes on a large table, and one model independently found that the rollback step references the wrong index name. Recommendation: rebuild the plan with CREATE INDEX CONCURRENTLY, fix the rollback target, and re-verify before executing.",
  request_id: "sample-0000-0000",
  cost_usd: 0.5
};

export const METHODOLOGY = `Veristat fans your input to a heterogeneous panel of frontier models — one each from Anthropic, OpenAI, and Google (never two from the same vendor) — in parallel with a 60s ceiling. Each panelist independently assesses the content against your focusing question. A separate synthesis pass consumes the raw panel outputs and emits a schema-enforced verdict: consensus level, specific agreements, contradictions with per-model positions and reasoning, and dissents. Panel identities are disclosed by vendor and model family. If a panelist fails, a verdict from the remaining models is returned flagged panel_degraded. Prompts are versioned and logged with every request_id.`;

export function priceCard(network: string) {
  return {
    consensus_check: {
      fulfilled_panel_size: 3,
      current_price: `$${computePriceUSD({ panelSize: 3, contentChars: 0 }).toFixed(2)}`,
      accepted_panel_size_values: [3, 5],
      panel_size_5_compatibility:
        "accepted for compatibility; the current MVP fulfills and quotes it as a 3-panel check",
      large_input_surcharge: "+$0.50 when content+context exceed ~8k tokens",
      quote: "exact price returned in the 402 challenge, quote valid 5 minutes"
    },
    research_fanout: "coming soon ($12–25, quoted dynamically)",
    payment: `x402 exact scheme, USDC, network ${network}`,
    accounts_required: "none — the payment is the credential"
  };
}

export function pricePreview(contentChars: number) {
  const fulfilledPrice = computePriceUSD({ panelSize: 3, contentChars });

  return {
    // Preserve the original public response keys. Both values reflect the
    // three-panel fulfillment path until five-panel execution is live.
    panel_3_usd: fulfilledPrice,
    panel_5_usd: fulfilledPrice,
    fulfilled_panel_size: 3,
    consensus_check_usd: fulfilledPrice,
    accepted_panel_size_values: [3, 5],
    note:
      "The current MVP fulfills and quotes both accepted panel_size values as a 3-model panel."
  };
}
