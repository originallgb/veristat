import { describe, expect, it } from "vitest";
import {
  runPanel,
  PanelFailedError,
  MIN_PANEL_FOR_VERDICT
} from "../src/panel/orchestrator";
import type { PanelModel, ProviderFn } from "../src/panel/providers";

const model = (vendor: PanelModel["vendor"]): PanelModel => ({
  vendor,
  model: `${vendor}-test-model`
});

const ok =
  (text: string): ProviderFn =>
  async () =>
    text;
const boom: ProviderFn = async () => {
  throw new Error("vendor down");
};

describe("panel orchestrator degradation", () => {
  it("returns a full panel undegraded", async () => {
    const outcome = await runPanel(
      [
        { model: model("anthropic"), fn: ok("a") },
        { model: model("openai"), fn: ok("b") },
        { model: model("google"), fn: ok("c") }
      ],
      "prompt"
    );
    expect(outcome.degraded).toBe(false);
    expect(outcome.succeeded).toHaveLength(3);
  });

  it("degrades gracefully at 2/3 with the flag set", async () => {
    const outcome = await runPanel(
      [
        { model: model("anthropic"), fn: ok("a") },
        { model: model("openai"), fn: boom },
        { model: model("google"), fn: ok("c") }
      ],
      "prompt"
    );
    expect(outcome.degraded).toBe(true);
    expect(outcome.succeeded).toHaveLength(2);
    const failed = outcome.results.find((r) => !r.ok);
    expect(failed?.error).toContain("vendor down");
  });

  it("throws PanelFailedError below the verdict minimum (never charges)", async () => {
    expect(MIN_PANEL_FOR_VERDICT).toBe(2);
    await expect(
      runPanel(
        [
          { model: model("anthropic"), fn: ok("a") },
          { model: model("openai"), fn: boom },
          { model: model("google"), fn: boom }
        ],
        "prompt"
      )
    ).rejects.toBeInstanceOf(PanelFailedError);
  });

  it("treats an empty response as a failure", async () => {
    const outcome = await runPanel(
      [
        { model: model("anthropic"), fn: ok("  ") },
        { model: model("openai"), fn: ok("b") },
        { model: model("google"), fn: ok("c") }
      ],
      "prompt"
    );
    expect(outcome.degraded).toBe(true);
    expect(outcome.succeeded).toHaveLength(2);
  });
});
