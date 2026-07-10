/**
 * Raw fetch clients for the three panel vendors. API keys are Worker
 * secrets; model IDs are vars so they can be retuned without a deploy.
 */

export interface PanelModel {
  vendor: "anthropic" | "openai" | "google";
  model: string;
}

export interface PanelResult extends PanelModel {
  ok: boolean;
  output: string;
  error?: string;
  latencyMs: number;
}

export type ProviderFn = (prompt: string, signal: AbortSignal) => Promise<string>;

const MAX_OUTPUT_TOKENS = 2048;

export function anthropicProvider(apiKey: string, model: string): ProviderFn {
  return async (prompt, signal) => {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      signal,
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model,
        max_tokens: MAX_OUTPUT_TOKENS,
        messages: [{ role: "user", content: prompt }]
      })
    });
    if (!res.ok) throw new Error(`anthropic ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const data = (await res.json()) as { content: { type: string; text?: string }[] };
    return data.content.filter((b) => b.type === "text").map((b) => b.text).join("");
  };
}

export function openaiProvider(apiKey: string, model: string): ProviderFn {
  return async (prompt, signal) => {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      signal,
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        max_completion_tokens: MAX_OUTPUT_TOKENS,
        messages: [{ role: "user", content: prompt }]
      })
    });
    if (!res.ok) throw new Error(`openai ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const data = (await res.json()) as {
      choices: { message: { content: string } }[];
    };
    return data.choices[0]?.message?.content ?? "";
  };
}

export function googleProvider(apiKey: string, model: string): ProviderFn {
  return async (prompt, signal) => {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        signal,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: MAX_OUTPUT_TOKENS }
        })
      }
    );
    if (!res.ok) throw new Error(`google ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const data = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    return (
      data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? ""
    );
  };
}

/** Vendor diversity is mandatory (spec §5): one model per vendor in a 3-panel. */
export function buildPanel(env: Env): { model: PanelModel; fn: ProviderFn }[] {
  return [
    {
      model: { vendor: "anthropic", model: env.PANEL_MODEL_ANTHROPIC },
      fn: anthropicProvider(env.ANTHROPIC_API_KEY, env.PANEL_MODEL_ANTHROPIC)
    },
    {
      model: { vendor: "openai", model: env.PANEL_MODEL_OPENAI },
      fn: openaiProvider(env.OPENAI_API_KEY, env.PANEL_MODEL_OPENAI)
    },
    {
      model: { vendor: "google", model: env.PANEL_MODEL_GOOGLE },
      fn: googleProvider(env.GOOGLE_API_KEY, env.PANEL_MODEL_GOOGLE)
    }
  ];
}
