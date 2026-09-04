import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { McpAgent } from "agents/mcp";
import { z } from "zod";
import { PaymentGate } from "../payments/x402";
import { buildFacilitator } from "../payments/cdp";
import { consensusCheckDiscovery } from "../payments/discovery";
import {
  consensusCheckInput,
  researchFanoutInput,
  type VerdictResponse
} from "./schemas";
import { SAMPLE_VERDICT, METHODOLOGY, priceCard } from "./sample_verdict";
import { buildPanel } from "../panel/providers";
import { runPanel, PanelFailedError } from "../panel/orchestrator";
import { synthesize, SYNTHESIS_PROMPT_VERSION } from "../panel/synthesis";
import { buildPanelPrompt, PANEL_PROMPT_VERSION } from "../prompts/panel_v1";
import { computePriceUSD } from "../payments/quoting";
import { logRequest, logSettlement } from "../logging";
import { VERSION } from "../version";

const CONSENSUS_DESCRIPTION =
  "Independent multi-model verification of a claim, answer, plan, or code change. " +
  "The current MVP fans your input to 3 heterogeneous frontier models (cross-vendor) and returns a structured verdict: " +
  "consensus level, points of agreement, contradictions with reasoning, and dissenting positions. " +
  "panel_size 5 remains accepted for compatibility but is fulfilled and quoted as a 3-panel check. " +
  "Privacy: submitted content, context, and question are sent to Anthropic, OpenAI, and Google for the panel; content and panel outputs are then sent to Anthropic for synthesis. " +
  "Only cryptographic hashes and aggregate telemetry are stored, with zero raw input/output text retained. " +
  "Use before high-stakes actions. Paid via x402.";

export class VeristatMCP extends McpAgent<Env> {
  server = new McpServer({ name: "veristat", version: VERSION });

  async init() {
    const env = this.env;
    const gate = new PaymentGate({
      network: env.NETWORK,
      recipient: env.PAY_TO_ADDRESS as `0x${string}`,
      facilitator: buildFacilitator(env),
      publicUrl: env.PUBLIC_URL || undefined,
      quoteSigningKey: env.QUOTE_SIGNING_KEY,
      onSettled: (s) =>
        logSettlement(env.DB, {
          requestId: s.requestId,
          txHash: s.transaction,
          payer: s.payer,
          amountUsd: s.priceUSD,
          network: s.network,
          tool: s.tool
        })
    });

    // --- Tool 1: consensus_check (PAID, live) ---
    gate.registerPaidTool(
      this.server,
      "consensus_check",
      CONSENSUS_DESCRIPTION,
      0.5, // advertised base; actual price quoted per request in the 402
      consensusCheckInput,
      { readOnlyHint: true, openWorldHint: true },
      (args) => ({
        // MVP hard-routes to 3-panel (spec §7); accept panel_size but quote 3
        panelSize: 3,
        contentChars:
          String(args.content ?? "").length + String(args.context ?? "").length
      }),
      async (args, settlement) => {
        const started = Date.now();
        const mode = (args.mode as "verify" | "adversarial") ?? "verify";

        const prompt = buildPanelPrompt({
          content: args.content,
          context: args.context,
          question: args.question,
          mode
        });

        let outcome;
        try {
          outcome = await runPanel(buildPanel(env), prompt);
        } catch (e) {
          if (e instanceof PanelFailedError) {
            // Fails BEFORE settlement — the buyer is never charged (x402
            // settle runs only on success).
            return {
              isError: true,
              content: [
                {
                  type: "text" as const,
                  text: JSON.stringify({
                    error: "PANEL_UNAVAILABLE",
                    detail: e.message,
                    note: "No payment was settled for this request."
                  })
                }
              ]
            };
          }
          throw e;
        }

        const verdict = await synthesize(env, {
          content: args.content,
          question: args.question,
          panel: outcome.succeeded
        });

        const response: VerdictResponse = {
          ...verdict,
          panel: outcome.succeeded.map((p) => ({ vendor: p.vendor, model: p.model })),
          ...(outcome.degraded
            ? {
                panel_degraded: true,
                refund_note:
                  "Panel was degraded (a model failed to respond). A 50% refund policy applies; automatic refunds are not yet live — contact the operator with your request_id."
              }
            : {}),
          request_id: settlement.requestId,
          cost_usd: settlement.priceUSD
        };

        const inputString = JSON.stringify({
          content: args.content,
          context: args.context,
          question: args.question
        });
        const hashBuffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(inputString));
        const inputHash = Array.from(new Uint8Array(hashBuffer))
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");

        await logRequest(env.DB, {
          requestId: settlement.requestId,
          tool: "consensus_check",
          mode,
          panelSize: 3,
          promptVersion: PANEL_PROMPT_VERSION,
          synthesisVersion: SYNTHESIS_PROMPT_VERSION,
          inputHash,
          verdictLabel: verdict.verdict,
          consensusScore: verdict.consensus_score,
          // v1 raw-fetch providers omit token counts; usage telemetry will be extracted in v2.
          totalTokens: 0,
          modelCount: outcome.succeeded.length,
          degraded: outcome.degraded,
          totalLatencyMs: Date.now() - started
        });

        return {
          content: [{ type: "text" as const, text: JSON.stringify(response, null, 2) }]
        };
      },
      consensusCheckDiscovery(CONSENSUS_DESCRIPTION)
    );

    // --- Tool 2: get_sample_verdict (FREE, live) ---
    this.server.registerTool(
      "get_sample_verdict",
      {
        description:
          "Free. Returns a real example consensus_check verdict, the verification methodology, and the current price card — inspect the output shape before paying.",
        inputSchema: {}
      },
      async () => ({
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                sample_verdict: SAMPLE_VERDICT,
                service_version: VERSION,
                methodology: METHODOLOGY,
                price_card: priceCard(this.env.NETWORK),
                example_price_panel3_small_input: `$${computePriceUSD({ panelSize: 3, contentChars: 1000 })}`
              },
              null,
              2
            )
          }
        ]
      })
    );

    // --- Tool 3/4: research_fanout (PHASE 2, stubbed) ---
    const notAvailable = () => ({
      isError: true,
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({
            error: "NOT_AVAILABLE",
            detail:
              "research_fanout is coming soon. No payment was requested or settled. Use consensus_check for verification today."
          })
        }
      ]
    });

    this.server.registerTool(
      "research_fanout",
      {
        description:
          "Coming soon. Full research brief -> 5-model deep pass -> synthesized diff report ($12-25, quoted dynamically, async via job_id). Currently returns NOT_AVAILABLE.",
        inputSchema: researchFanoutInput
      },
      async () => notAvailable()
    );

    this.server.registerTool(
      "get_research_result",
      {
        description:
          "Coming soon. Fetch the result of a research_fanout job by job_id. Currently returns NOT_AVAILABLE.",
        inputSchema: { job_id: z.string() }
      },
      async () => notAvailable()
    );
  }
}
