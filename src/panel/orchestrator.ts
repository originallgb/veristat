import type { PanelModel, PanelResult, ProviderFn } from "./providers";

export const PANEL_TIMEOUT_MS = 60_000; // spec §5: 60s ceiling
export const MIN_PANEL_FOR_VERDICT = 2; // degrade gracefully at 2/3

export interface PanelOutcome {
  results: PanelResult[];
  succeeded: PanelResult[];
  degraded: boolean;
}

export async function runPanel(
  panel: { model: PanelModel; fn: ProviderFn }[],
  prompt: string
): Promise<PanelOutcome> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort("panel timeout"), PANEL_TIMEOUT_MS);

  const results = await Promise.all(
    panel.map(async ({ model, fn }): Promise<PanelResult> => {
      const start = Date.now();
      try {
        const output = await fn(prompt, controller.signal);
        if (!output.trim()) throw new Error("empty response");
        return { ...model, ok: true, output, latencyMs: Date.now() - start };
      } catch (e) {
        return {
          ...model,
          ok: false,
          output: "",
          error: String(e).slice(0, 500),
          latencyMs: Date.now() - start
        };
      }
    })
  );
  clearTimeout(timer);

  const succeeded = results.filter((r) => r.ok);
  if (succeeded.length < MIN_PANEL_FOR_VERDICT) {
    throw new PanelFailedError(results);
  }
  return { results, succeeded, degraded: succeeded.length < panel.length };
}

export class PanelFailedError extends Error {
  constructor(public results: PanelResult[]) {
    super(
      `Panel failed: only ${results.filter((r) => r.ok).length} of ${results.length} models responded`
    );
  }
}
