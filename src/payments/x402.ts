/**
 * x402 payment gating for MCP tools with dynamic per-request pricing.
 *
 * Modeled on the agents SDK's `withX402`/`paidTool` (which only supports
 * static prices) — same wire protocol: unpaid calls get an isError result
 * whose `_meta["x402/error"]` carries the 402 payload; clients retry with
 * `_meta["x402/payment"]` (or PAYMENT-SIGNATURE / X-PAYMENT headers).
 * Compatible with `withX402Client` from `agents/x402`.
 *
 * The facilitator sits behind @x402/core's `FacilitatorClient` interface
 * (verify / settle / getSupported), so swapping Coinbase CDP → Cloudflare
 * Gateway (or a mock in tests) is a constructor argument, not a rewrite.
 */

import type {
  McpServer,
  RegisteredTool,
  ToolCallback
} from "@modelcontextprotocol/sdk/server/mcp.js";
import type {
  ToolAnnotations,
  CallToolResult
} from "@modelcontextprotocol/sdk/types.js";
import type { ZodRawShape } from "zod";
import {
  x402ResourceServer,
  HTTPFacilitatorClient,
  type FacilitatorClient,
  type ResourceConfig
} from "@x402/core/server";
import type {
  PaymentPayload,
  PaymentRequirements,
  Network
} from "@x402/core/types";
import { registerExactEvmScheme } from "@x402/evm/exact/server";
import {
  computePriceUSD,
  hashRequest,
  signQuote,
  verifyQuote,
  QUOTE_TTL_MS,
  type QuoteInput
} from "./quoting";

export interface PaymentGateConfig {
  network: string; // CAIP-2, e.g. "eip155:84532"
  recipient: `0x${string}`;
  quoteSigningKey: string;
  /** Injectable facilitator — HTTPFacilitatorClient in prod, mock in tests. */
  facilitator?: FacilitatorClient;
  facilitatorUrl?: string;
  /** Fired after successful settlement — receipt logging (never blocks response). */
  onSettled?: (info: {
    tool: string;
    requestId: string;
    priceUSD: number;
    transaction?: string;
    payer?: string;
    network: string;
  }) => Promise<void> | void;
}

export interface SettlementInfo {
  transaction?: string;
  network?: string;
  payer?: string;
  priceUSD: number;
  requestId: string;
}

export class PaymentGate {
  private resourceServer: x402ResourceServer;
  private initPromise: Promise<void> | null = null;

  constructor(private cfg: PaymentGateConfig) {
    const facilitator =
      cfg.facilitator ??
      new HTTPFacilitatorClient({
        url: (cfg.facilitatorUrl ?? "https://x402.org/facilitator") as `${string}://${string}`
      });
    this.resourceServer = new x402ResourceServer(facilitator);
    registerExactEvmScheme(this.resourceServer);
  }

  private ensureInitialized(): Promise<void> {
    if (!this.initPromise) {
      this.initPromise = this.resourceServer.initialize().catch((err) => {
        this.initPromise = null;
        throw err;
      });
    }
    return this.initPromise;
  }

  /**
   * Register a paid tool whose price is computed per request from its args.
   * `quoteFromArgs` maps validated args → QuoteInput; the handler receives
   * the settled request's metadata for logging.
   */
  registerPaidTool<Args extends ZodRawShape>(
    server: McpServer,
    name: string,
    description: string,
    baseAdvertisedUSD: number,
    paramsSchema: Args,
    annotations: ToolAnnotations,
    quoteFromArgs: (args: Record<string, unknown>) => QuoteInput,
    cb: (
      args: Parameters<ToolCallback<Args>>[0],
      settlement: SettlementInfo,
      extra: Parameters<ToolCallback<Args>>[1]
    ) => ReturnType<ToolCallback<Args>>
  ): RegisteredTool {
    const network = this.cfg.network as Network;

    return server.registerTool(
      name,
      {
        description,
        inputSchema: paramsSchema,
        annotations,
        _meta: {
          "agents-x402/paymentRequired": true,
          "agents-x402/priceUSD": baseAdvertisedUSD,
          "veristat/dynamicPricing": true
        }
      },
      // biome-ignore format: keep close to SDK reference shape
      (async (args: Record<string, unknown>, extra: Parameters<ToolCallback<Args>>[1]) => {
        await this.ensureInitialized();

        const quoteInput = quoteFromArgs(args);
        const priceUSD = computePriceUSD(quoteInput);
        const requestHash = await hashRequest({ name, args });

        const resourceConfig: ResourceConfig = {
          scheme: "exact",
          payTo: this.cfg.recipient,
          price: priceUSD,
          network,
          maxTimeoutSeconds: 300
        };

        let requirements: PaymentRequirements[];
        try {
          requirements =
            await this.resourceServer.buildPaymentRequirements(resourceConfig);
        } catch {
          const payload = { x402Version: 2, error: "PRICE_COMPUTE_FAILED" };
          return {
            isError: true,
            _meta: { "x402/error": payload },
            content: [{ type: "text", text: JSON.stringify(payload) }]
          } as const;
        }

        const resourceInfo = {
          url: `x402://${name}`,
          description,
          mimeType: "application/json"
        };

        const quoteToken = await signQuote(this.cfg.quoteSigningKey, {
          priceUSD,
          requestHash,
          expiresAt: Date.now() + QUOTE_TTL_MS
        });

        const headers = extra?.requestInfo?.headers ?? {};
        const token =
          (extra?._meta?.["x402/payment"] as string | undefined) ??
          (headers["PAYMENT-SIGNATURE"] as string | undefined) ??
          (headers["X-PAYMENT"] as string | undefined);

        const paymentRequired = (
          reason = "PAYMENT_REQUIRED",
          extraFields: Record<string, unknown> = {}
        ) => {
          const payload = {
            x402Version: 2,
            error: reason,
            resource: resourceInfo,
            accepts: requirements,
            extensions: {
              "veristat/quote": { token: quoteToken, priceUSD, ttlMs: QUOTE_TTL_MS }
            },
            ...extraFields
          };
          return {
            isError: true,
            _meta: { "x402/error": payload },
            content: [{ type: "text", text: JSON.stringify(payload) }]
          } as const;
        };

        if (!token || typeof token !== "string") return paymentRequired();

        let paymentPayload: PaymentPayload;
        try {
          paymentPayload = JSON.parse(atob(token));
        } catch {
          return paymentRequired("INVALID_PAYMENT");
        }

        // If the client echoes our quote token, enforce expiry + integrity.
        // Either way the settled amount is pinned to `requirements`, which is
        // recomputed deterministically from the same args.
        const echoedQuote = extra?._meta?.["veristat/quote"] as string | undefined;
        if (echoedQuote) {
          const q = await verifyQuote(this.cfg.quoteSigningKey, echoedQuote, {
            priceUSD,
            requestHash
          });
          if (!q.ok) return paymentRequired(q.reason);
        }

        const matchingReq = this.resourceServer.findMatchingRequirements(
          requirements,
          paymentPayload
        );
        if (!matchingReq) return paymentRequired("INVALID_PAYMENT");

        let payer: string | undefined;
        try {
          const vr = await this.resourceServer.verifyPayment(
            paymentPayload,
            matchingReq
          );
          if (!vr.isValid) {
            return paymentRequired(vr.invalidReason ?? "INVALID_PAYMENT", {
              payer: vr.payer
            });
          }
          payer = vr.payer;
        } catch {
          return paymentRequired("INVALID_PAYMENT");
        }

        const requestId = crypto.randomUUID();

        // Execute the tool; settle only on success (buyer never pays for an error)
        let result: CallToolResult;
        let failed = false;
        try {
          result = (await cb(
            args as Parameters<ToolCallback<Args>>[0],
            { priceUSD, requestId, payer },
            extra
          )) as CallToolResult;
          if (result && typeof result === "object" && "isError" in result && result.isError) {
            failed = true;
          }
        } catch (e) {
          failed = true;
          result = {
            isError: true,
            content: [{ type: "text", text: `Tool execution failed: ${String(e)}` }]
          };
        }

        if (!failed) {
          try {
            const s = await this.resourceServer.settlePayment(
              paymentPayload,
              matchingReq
            );
            if (s.success) {
              result._meta ??= {};
              result._meta["x402/payment-response"] = {
                success: true,
                transaction: s.transaction,
                network: s.network,
                payer: s.payer
              };
              result._meta["veristat/settlement"] = {
                requestId,
                priceUSD,
                transaction: s.transaction,
                payer: s.payer
              };
              try {
                await this.cfg.onSettled?.({
                  tool: name,
                  requestId,
                  priceUSD,
                  transaction: s.transaction,
                  payer: s.payer,
                  network: this.cfg.network
                });
              } catch (e) {
                console.error("onSettled hook failed", requestId, e);
              }
            } else {
              return paymentRequired(s.errorReason ?? "SETTLEMENT_FAILED");
            }
          } catch {
            return paymentRequired("SETTLEMENT_FAILED");
          }
        }

        return result;
      }) as unknown as ToolCallback<Args>
    );
  }
}
