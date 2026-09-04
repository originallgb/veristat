/**
 * Bazaar discovery declarations (docs/research/bazaar-listing.md).
 *
 * The CDP facilitator catalogs a resource the first time it SETTLES a payment
 * whose 402 challenge carried this extension and whose payload echoes it.
 * The declared inputSchema undergoes strict JSON Schema validation on the
 * facilitator — a rejection is silent apart from the EXTENSION-RESPONSES
 * header (logged by @x402/core as "[x402] extension responses: ..."), so
 * test/discovery.test.ts pins the declaration's validity and its sync with
 * the zod input schema.
 */

import { z } from "zod";
import {
  declareDiscoveryExtension,
  validateDiscoveryExtensionSpec
} from "@x402/extensions/bazaar";
import { consensusCheckInput } from "../mcp/schemas";

export { validateDiscoveryExtensionSpec };

/** JSON Schema for consensus_check derived from the zod source of truth. */
export function consensusCheckJsonSchema(): Record<string, unknown> {
  return z.toJSONSchema(z.object(consensusCheckInput), {
    io: "input",
    target: "draft-7"
  }) as Record<string, unknown>;
}

/**
 * Discovery declaration for consensus_check, keyed by extension id
 * ("bazaar" today) — merged into the 402 payload's `extensions` and echoed
 * by paying clients so the facilitator can catalog us.
 */
export function consensusCheckDiscovery(
  description: string
): Record<string, unknown> {
  return declareDiscoveryExtension({
    toolName: "consensus_check",
    description,
    transport: "streamable-http",
    inputSchema: consensusCheckJsonSchema(),
    example: {
      content:
        "Renaming a table in PostgreSQL with ALTER TABLE ... RENAME TO does not rewrite the table.",
      question: "Is this claim correct?",
      panel_size: 3,
      mode: "verify"
    },
    output: {
      example: {
        verdict: "supported",
        consensus_score: 0.92,
        agreements: [
          { point: "RENAME TO is a catalog-only change", models_agreeing: 3 }
        ],
        contradictions: [],
        dissent: [],
        panel: [
          { vendor: "anthropic", model: "claude-sonnet" },
          { vendor: "openai", model: "gpt-mini" },
          { vendor: "google", model: "gemini-flash" }
        ],
        synthesis: "All three models agree the claim is accurate...",
        request_id: "6f9c1a2e-...",
        cost_usd: 0.5
      }
    }
  }) as Record<string, unknown>;
}
