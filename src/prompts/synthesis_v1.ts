export const SYNTHESIS_PROMPT_VERSION = "synthesis_v1";

export function buildSynthesisPrompt(opts: {
  content: string;
  question?: string;
  panelOutputs: { model: string; vendor: string; output: string }[];
}): string {
  const panels = opts.panelOutputs
    .map(
      (p, i) => `--- PANELIST ${i + 1} (${p.vendor}/${p.model}) ---\n${p.output}`
    )
    .join("\n\n");

  return `You are the synthesis judge for a multi-model verification panel. ${opts.panelOutputs.length} independent frontier models reviewed the same content. Your job: produce one calibrated, structured verdict from their raw outputs.

Rules:
- Weigh substance, not verbosity. A panelist with a specific counterexample outweighs two with vague approval.
- Surface genuine contradictions between panelists explicitly — they are the most valuable signal.
- consensus_score: 1.0 = unanimous specific agreement, 0.5 = split, 0.0 = unanimous rejection. Calibrate, don't round to extremes.
- verdict: "supported" (panel affirms), "contested" (substantive disagreement), "refuted" (panel finds fatal flaws), "insufficient" (panel lacks information to judge).
- synthesis: a plain-language summary, max 150 words, that a busy human can act on.
- Attribute positions by panelist vendor/model as given.

${opts.question ? `FOCUSING QUESTION: ${opts.question}\n` : ""}
CONTENT THAT WAS REVIEWED:
---
${opts.content.slice(0, 8000)}
---

PANEL OUTPUTS:
${panels}

Output ONLY valid JSON matching this schema, no markdown fences, no prose:
{
  "verdict": "supported" | "contested" | "refuted" | "insufficient",
  "consensus_score": number 0-1,
  "agreements": [{"point": string, "models_agreeing": integer}],
  "contradictions": [{"point": string, "positions": [{"stance": string, "models": [string], "reasoning": string}]}],
  "dissent": [{"model": string, "position": string}],
  "synthesis": string
}`;
}
