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
import { bazaarResourceServerExtension } from "@x402/extensions/bazaar";
import {
  computePriceUSD,
  hashRequest,
  signQuote,
  verifyQuote,
  QUOTE_TTL_MS,
  MAX_ENCODED_QUOTE_TOKEN_CHARS,
  type QuoteInput
} from "./quoting";

/** The v2 payload includes an EVM authorization plus discovery metadata and is
 * normally well below this ceiling. Bound it before base64/JSON decoding so an
 * unpaid caller cannot force unbounded allocation or parsing work. */
export const MAX_ENCODED_PAYMENT_TOKEN_CHARS = 64 * 1024;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export interface PaymentGateConfig {
  network: string; // CAIP-2, e.g. "eip155:84532"
  recipient: `0x${string}`;
  quoteSigningKey: string;
  /** Injectable facilitator — HTTPFacilitatorClient in prod, mock in tests. */
  facilitator?: FacilitatorClient;
  facilitatorUrl?: string;
  /**
   * Public URL of this MCP endpoint (e.g. https://veristat.<sub>.workers.dev/mcp).
   * Used as the 402 `resource.url`, which the client echoes as
   * `paymentPayload.resource` — the URL the Bazaar catalogs us under. Falls
   * back to x402://<tool> when unset (payments work; discovery listing won't).
   */
  publicUrl?: string;
  /** Fired after successful settlement. The hook is awaited, but its failure is
   * isolated from the successful paid response. */
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
    // Bazaar discovery (docs/research/bazaar-listing.md): the extension's
    // echo validation runs for tools that declare discovery metadata.
    this.resourceServer.registerExtension(bazaarResourceServerExtension);
    // The quote token is re-signed on every 402, so the client's echo always
    // carries the previous token — exclude it from echo validation; expiry
    // and integrity are enforced separately via verifyQuote.
    this.resourceServer.registerExtension({
      key: "veristat/quote",
      dynamicInfoFields: ["token"]
    });
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
    ) => ReturnType<ToolCallback<Args>>,
    /** Bazaar discovery declaration (declareDiscoveryExtension output),
     *  advertised in the 402 `extensions` and echoed to the facilitator. */
    discovery?: Record<string, unknown>
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
          // The client echoes this as paymentPayload.resource — the URL the
          // Bazaar catalogs on first settlement (docs/research/bazaar-listing.md)
          url: this.cfg.publicUrl ?? `x402://${name}`,
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
              ...(discovery ?? {}),
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

        if (token.length > MAX_ENCODED_PAYMENT_TOKEN_CHARS) {
          return paymentRequired("PAYMENT_TOO_LARGE");
        }

        let paymentPayload: PaymentPayload;
        try {
          const decoded: unknown = JSON.parse(atob(token));
          if (!isRecord(decoded)) return paymentRequired("INVALID_PAYMENT");
          paymentPayload = decoded as unknown as PaymentPayload;
        } catch {
          return paymentRequired("INVALID_PAYMENT");
        }

        // Normal x402 v2 clients copy challenge extensions into the encoded
        // PaymentPayload. Verify the quote from that authenticated retry shape,
        // rather than relying on a separate MCP metadata field.
        const payloadExtensions = isRecord(paymentPayload.extensions)
          ? paymentPayload.extensions
          : undefined;
        const payloadQuoteExtension = payloadExtensions?.["veristat/quote"];
        let echoedQuote: string | undefined;
        if (payloadQuoteExtension !== undefined) {
          if (!isRecord(payloadQuoteExtension)) {
            return paymentRequired("MALFORMED_QUOTE");
          }
          if (typeof payloadQuoteExtension.token !== "string") {
            return paymentRequired("MALFORMED_QUOTE");
          }
          echoedQuote = payloadQuoteExtension.token;
        }

        // Compatibility for early clients that echoed the signed token beside
        // x402/payment. Verify it identically, then normalize it into the
        // payload before extension echo validation and facilitator calls.
        if (!echoedQuote) {
          const legacyQuote = extra?._meta?.["veristat/quote"];
          if (legacyQuote !== undefined && typeof legacyQuote !== "string") {
            return paymentRequired("MALFORMED_QUOTE");
          }
          echoedQuote = legacyQuote;
          if (echoedQuote) {
            paymentPayload.extensions = {
              ...(payloadExtensions ?? {}),
              "veristat/quote": {
                token: echoedQuote,
                priceUSD,
                ttlMs: QUOTE_TTL_MS
              }
            };
          }
        }

        if (!echoedQuote) return paymentRequired("QUOTE_REQUIRED");
        if (echoedQuote.length > MAX_ENCODED_QUOTE_TOKEN_CHARS)
          return paymentRequired("QUOTE_TOO_LARGE");
        const q = await verifyQuote(this.cfg.quoteSigningKey, echoedQuote, {
          priceUSD,
          requestHash
        });
        if (!q.ok) return paymentRequired(q.reason);

        const matchingReq = this.resourceServer.findMatchingRequirements(
          requirements,
          paymentPayload
        );
        if (!matchingReq) return paymentRequired("INVALID_PAYMENT");

        // Echoed extensions (bazaar declaration, quote) must preserve what we
        // advertised — a tampered discovery echo could poison the catalog.
        const echoCheck = this.resourceServer.validateExtensions(
          paymentRequired()._meta["x402/error"] as never,
          paymentPayload
        );
        if (!echoCheck.valid) {
          return paymentRequired(echoCheck.invalidReason ?? "EXTENSION_ECHO_MISMATCH");
        }

        let payer: string | undefined;
        try {
          const vr = await this.resourceServer.verifyPayment(
            paymentPayload,
            matchingReq,
            discovery
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
              matchingReq,
              discovery
            );
            if (s.success) {
              const settledPayer = s.payer ?? payer;
              result._meta ??= {};
              result._meta["x402/payment-response"] = {
                success: true,
                transaction: s.transaction,
                network: s.network,
                payer: settledPayer
              };
              result._meta["veristat/settlement"] = {
                requestId,
                priceUSD,
                transaction: s.transaction,
                payer: settledPayer
              };
              try {
                await this.cfg.onSettled?.({
                  tool: name,
                  requestId,
                  priceUSD,
                  transaction: s.transaction,
                  payer: settledPayer,
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
