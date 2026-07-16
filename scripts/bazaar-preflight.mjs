// Read-only Bazaar preflight against a live Veristat MCP endpoint.
//
// This deliberately stops before payment. It validates the exact unpaid
// challenge that a buyer receives, including the MCP Bazaar declaration, so a
// funded canary is not spent on a malformed or stale deployment.
//
// Usage:
//   VERISTAT_URL=https://veristat.<subdomain>.workers.dev/mcp \
//     node scripts/bazaar-preflight.mjs

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { validateDiscoveryExtensionSpec } from "@x402/extensions/bazaar";
import { mcpFetch } from "./mcp-fetch.mjs";

const BASE = process.env.VERISTAT_URL;
if (!BASE) {
  console.error("Set VERISTAT_URL to the deployed /mcp endpoint. The preflight never defaults to localhost.");
  process.exit(1);
}

let endpoint;
try {
  endpoint = new URL(BASE);
} catch {
  console.error(`VERISTAT_URL is not an absolute URL: ${BASE}`);
  process.exit(1);
}

let failures = 0;
const check = (name, condition, detail = "") => {
  console.log(`${condition ? "PASS" : "FAIL"}  ${name}${condition || !detail ? "" : ` — ${detail}`}`);
  if (!condition) failures++;
};

const client = new Client({ name: "bazaar-preflight", version: "1.0.0" });
try {
  await client.connect(
    new StreamableHTTPClientTransport(endpoint, { fetch: mcpFetch })
  );

  const response = await client.callTool({
    name: "consensus_check",
    arguments: {
      content: "Bazaar discovery preflight: validate this unpaid challenge without executing the panel.",
      question: "Is the x402 discovery declaration well formed?"
    }
  });
  const required = response._meta?.["x402/error"];
  const acceptance = required?.accepts?.[0];
  const bazaar = required?.extensions?.bazaar;
  const input = bazaar?.info?.input;

  check("unpaid consensus_check returns a payment challenge",
    response.isError === true && required?.error === "PAYMENT_REQUIRED");
  check("x402 v2 challenge", required?.x402Version === 2, String(required?.x402Version));
  check("resource URL is the requested absolute HTTPS endpoint",
    required?.resource?.url === endpoint.toString() && endpoint.protocol === "https:",
    String(required?.resource?.url));
  check("resource description and MIME type are populated",
    typeof required?.resource?.description === "string" &&
      required.resource.description.length > 0 &&
      required.resource.mimeType === "application/json");
  check("acceptance uses exact scheme with string amount",
    acceptance?.scheme === "exact" &&
      typeof acceptance?.amount === "string" &&
      /^[1-9][0-9]*$/.test(acceptance.amount),
    JSON.stringify({ scheme: acceptance?.scheme, amount: acceptance?.amount }));
  check("acceptance carries CAIP-2 network, asset, and payee",
    typeof acceptance?.network === "string" && acceptance.network.includes(":") &&
      typeof acceptance?.asset === "string" && acceptance.asset.length > 0 &&
      typeof acceptance?.payTo === "string" && acceptance.payTo.length > 0,
    JSON.stringify({ network: acceptance?.network, asset: acceptance?.asset, payTo: acceptance?.payTo }));

  const validation = bazaar
    ? validateDiscoveryExtensionSpec(bazaar)
    : { valid: false, errors: ["missing bazaar extension"] };
  check("Bazaar extension passes the SDK specification validator",
    validation.valid === true,
    JSON.stringify(validation.errors ?? validation));
  check("Bazaar input identifies the MCP tool and transport",
    input?.type === "mcp" &&
      input?.toolName === "consensus_check" &&
      (input?.transport === undefined || input.transport === "streamable-http") &&
      input?.inputSchema?.type === "object",
    JSON.stringify({ type: input?.type, toolName: input?.toolName, transport: input?.transport }));
  check("Bazaar declaration includes input and output examples",
    input?.example && bazaar?.info?.output?.type === "json" && bazaar.info.output.example);
  check("signed Veristat quote accompanies the challenge",
    typeof required?.extensions?.["veristat/quote"]?.token === "string" &&
      typeof required?.extensions?.["veristat/quote"]?.priceUSD === "number");

  console.log("\nSANITIZED CHALLENGE SUMMARY");
  console.log(JSON.stringify({
    checked_at: new Date().toISOString(),
    resource: required?.resource?.url,
    tool: input?.toolName,
    transport: input?.transport ?? "streamable-http",
    network: acceptance?.network,
    amount: acceptance?.amount,
    asset: acceptance?.asset,
    payTo: acceptance?.payTo,
    bazaar_valid: validation.valid === true
  }, null, 2));
} finally {
  await client.close().catch(() => {});
}

console.log(`\n${failures === 0 ? "BAZAAR PREFLIGHT OK" : `BAZAAR PREFLIGHT FAILED: ${failures} check(s)`}`);
process.exit(failures === 0 ? 0 : 1);
