// Smoke test against a running server: initialize → tools/list →
// get_sample_verdict (free) → consensus_check unpaid (expect 402 payload).
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { mcpFetch } from "./mcp-fetch.mjs";

const BASE = process.env.VERISTAT_URL ?? "http://localhost:8787/mcp";
const EXPECTED_VERSION = process.env.EXPECTED_VERSION;

const healthUrl = new URL(BASE);
healthUrl.pathname = "/health";
healthUrl.search = "";
const healthRes = await mcpFetch(healthUrl);
if (!healthRes.ok) {
  throw new Error(`health check failed: ${healthRes.status} ${healthRes.statusText}`);
}
const health = await healthRes.json();
if (!health.ok || typeof health.version !== "string") {
  throw new Error(`health response has no deployment identity: ${JSON.stringify(health)}`);
}
if (EXPECTED_VERSION && health.version !== EXPECTED_VERSION) {
  throw new Error(`deployment version mismatch: expected ${EXPECTED_VERSION}, got ${health.version}`);
}
console.log(`HEALTH: ${health.ok} | version: ${health.version} | network: ${health.network}`);

const client = new Client({ name: "smoke", version: "0.0.0" });
await client.connect(
  new StreamableHTTPClientTransport(new URL(BASE), { fetch: mcpFetch })
);

const tools = await client.listTools();
console.log("TOOLS:", tools.tools.map((t) => t.name).join(", "));

const sample = await client.callTool({ name: "get_sample_verdict", arguments: {} });
const sampleBody = JSON.parse(sample.content[0].text);
console.log("SAMPLE verdict:", sampleBody.sample_verdict.verdict, "| price_card panel_3:", sampleBody.price_card.consensus_check.panel_3);

const unpaid = await client.callTool({
  name: "consensus_check",
  arguments: { content: "The earth is flat.", question: "Is this true?" }
});
console.log("UNPAID isError:", unpaid.isError);
const err = unpaid._meta?.["x402/error"];
if (!err) {
  console.log("RAW:", JSON.stringify(unpaid, null, 2).slice(0, 800));
  process.exit(1);
}
console.log("402 error:", err.error);
console.log("402 accepts[0]:", JSON.stringify({ scheme: err.accepts?.[0]?.scheme, network: err.accepts?.[0]?.network, amount: err.accepts?.[0]?.amount, payTo: err.accepts?.[0]?.payTo, asset: err.accepts?.[0]?.asset }));
console.log("402 quote:", JSON.stringify(err.extensions?.["veristat/quote"]?.priceUSD));

const stub = await client.callTool({ name: "research_fanout", arguments: { brief: "x" } });
console.log("STUB research_fanout:", JSON.parse(stub.content[0].text).error);

await client.close();
console.log("SMOKE OK");
