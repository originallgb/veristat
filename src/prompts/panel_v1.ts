export const PANEL_PROMPT_VERSION = "panel_v1";

export function buildPanelPrompt(opts: {
  content: string;
  context?: string;
  question?: string;
  mode: "verify" | "adversarial";
}): string {
  const focus =
    opts.question ??
    "Is this content accurate, sound, and safe to act on? Identify any errors, unsupported claims, or risks.";

  const stance =
    opts.mode === "adversarial"
      ? `You are the adversary. Your job is to attack this content: find every flaw, hidden assumption, factual error, edge case, and failure mode. Steelman it only to break it better. If after honest effort you cannot find substantive problems, say so — but do not manufacture objections.`
      : `You are an independent verifier. Assess the content on its merits. Be specific and cite your reasoning; do not hedge to avoid committing to a position.`;

  return `${stance}

FOCUSING QUESTION: ${focus}
${opts.context ? `\nBACKGROUND CONTEXT:\n${opts.context}\n` : ""}
CONTENT UNDER REVIEW:
---
${opts.content}
---

Respond in exactly this structure:
ASSESSMENT: one of SUPPORTED | CONTESTED | REFUTED | INSUFFICIENT_INFO
CONFIDENCE: 0-100
KEY_POINTS: 3-8 bullet points, each a specific claim you agree with, dispute, or flag — state which and why.
REASONING: your core argument in under 200 words.`;
}
