import { z } from "zod";

export const MAX_CONTENT_CHARS = 32_000;

export const consensusCheckInput = {
  content: z
    .string()
    .min(1)
    .max(MAX_CONTENT_CHARS)
    .describe("The claim, answer, plan, or artifact to verify. Max 32k chars."),
  context: z
    .string()
    .max(MAX_CONTENT_CHARS)
    .optional()
    .describe("Optional background the panel needs (task, constraints, data)."),
  question: z
    .string()
    .max(2_000)
    .optional()
    .describe(
      "Optional focusing question, e.g. 'Is this migration plan safe?' Defaults to general verification."
    ),
  panel_size: z.union([z.literal(3), z.literal(5)]).default(3),
  mode: z
    .enum(["verify", "adversarial"])
    .default("verify")
    .describe("adversarial = panel is explicitly prompted to attack the content")
};

export const verdictSchema = z.object({
  verdict: z.enum(["supported", "contested", "refuted", "insufficient"]),
  consensus_score: z.number().min(0).max(1),
  agreements: z.array(
    z.object({ point: z.string(), models_agreeing: z.number().int() })
  ),
  contradictions: z.array(
    z.object({
      point: z.string(),
      positions: z.array(
        z.object({
          stance: z.string(),
          models: z.array(z.string()),
          reasoning: z.string()
        })
      )
    })
  ),
  dissent: z.array(z.object({ model: z.string(), position: z.string() })),
  synthesis: z.string()
});

export type Verdict = z.infer<typeof verdictSchema>;

export type VerdictResponse = Verdict & {
  panel: { vendor: string; model: string }[];
  panel_degraded?: boolean;
  refund_note?: string;
  request_id: string;
  cost_usd: number;
};

export const researchFanoutInput = {
  brief: z.string().min(1).describe("Full research brief.")
};
