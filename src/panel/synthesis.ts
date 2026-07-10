import { verdictSchema, type Verdict } from "../mcp/schemas";
import { buildSynthesisPrompt, SYNTHESIS_PROMPT_VERSION } from "../prompts/synthesis_v1";
import { anthropicProvider } from "./providers";
import type { PanelResult } from "./providers";

export { SYNTHESIS_PROMPT_VERSION };

const SYNTHESIS_TIMEOUT_MS = 45_000;

/** One extra model call that turns raw panel outputs into the verdict JSON. */
export async function synthesize(
  env: Env,
  opts: { content: string; question?: string; panel: PanelResult[] }
): Promise<Verdict> {
  const prompt = buildSynthesisPrompt({
    content: opts.content,
    question: opts.question,
    panelOutputs: opts.panel.map((p) => ({
      vendor: p.vendor,
      model: p.model,
      output: p.output
    }))
  });

  const provider = anthropicProvider(env.ANTHROPIC_API_KEY, env.SYNTHESIS_MODEL);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort("synthesis timeout"), SYNTHESIS_TIMEOUT_MS);
  let raw: string;
  try {
    raw = await provider(prompt, controller.signal);
  } finally {
    clearTimeout(timer);
  }

  // Schema-enforced parse; tolerate accidental markdown fences
  const jsonText = raw.trim().replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new Error(`Synthesis returned non-JSON output: ${raw.slice(0, 200)}`);
  }
  return verdictSchema.parse(parsed);
}
