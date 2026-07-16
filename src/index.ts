import { Hono } from "hono";
import { VeristatMCP } from "./mcp/server";
import { computePriceUSD } from "./payments/quoting";
import { METHODOLOGY, priceCard } from "./mcp/sample_verdict";
import { healthPayload } from "./health";

export { VeristatMCP };

const app = new Hono<{ Bindings: Env }>();

app.get("/", (c) =>
  c.json({
    name: "veristat",
    description:
      "x402-paid multi-model verification MCP server. Connect an MCP client to /mcp (streamable HTTP).",
    mcp_endpoint: "/mcp",
    methodology: METHODOLOGY,
    price_card: priceCard(c.env.NETWORK),
    network: c.env.NETWORK
  })
);

app.get("/health", (c) => c.json(healthPayload(c.env)));

// Human/agent-readable quote preview (the authoritative quote is in the 402)
app.get("/price", (c) => {
  const chars = Number(c.req.query("chars") ?? 1000);
  return c.json({
    panel_3_usd: computePriceUSD({ panelSize: 3, contentChars: chars }),
    panel_5_usd: computePriceUSD({ panelSize: 5, contentChars: chars }),
    note: "MVP routes all requests to a 3-model panel."
  });
});

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(request.url);
    if (url.pathname === "/mcp" || url.pathname.startsWith("/mcp/")) {
      return VeristatMCP.serve("/mcp", { binding: "VeristatMCP" }).fetch(
        request,
        env,
        ctx
      );
    }
    return app.fetch(request, env, ctx);
  }
};
