import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { mcpFetch } from "./mcp-fetch.mjs";

export const DEFAULT_VERISTAT_URL = "https://veristat.grant-23a.workers.dev/mcp";
const EXPECTED_NETWORK = "eip155:84532";
const EXPECTED_AMOUNT = "500000";
const EXPECTED_ASSET = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
const EXPECTED_PAYEE = "0x86CdAe1A22458442BaB9E10216a7E96b606d3635";

// Keep the default request public and synthetic. Do not replace it with
// customer content until Veristat publishes its privacy/retention policy.
export const SYNTHETIC_REQUEST = {
  content: "A migration plan says CREATE INDEX without CONCURRENTLY is safe during peak writes.",
  question: "What operational risk should be checked before approving this claim?"
};

const REQUIRED_TOOLS = ["consensus_check", "get_sample_verdict"];

function parseTextResult(result, label) {
  const text = result?.content?.[0]?.text;
  if (result?.isError || typeof text !== "string") {
    throw new Error(`${label} returned no usable text result`);
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`${label} returned malformed JSON`);
  }
}

function summarizeFreeSample(sample) {
  const price = sample?.price_card?.consensus_check;
  if (price?.fulfilled_panel_size !== 3 || price?.current_price !== "$0.50") {
    throw new Error("free sample does not describe the current three-panel $0.50 service");
  }
  if (typeof sample?.sample_verdict?.verdict !== "string") {
    throw new Error("free sample has no verdict class");
  }
  if (typeof sample?.methodology !== "string" || typeof sample?.service_version !== "string") {
    throw new Error("free sample has no methodology or service version");
  }
  return {
    verdict: sample.sample_verdict.verdict,
    panel_size: price.fulfilled_panel_size,
    price: price.current_price,
    methodology: "three-vendor panel plus synthesis",
    service_version: sample.service_version
  };
}

function summarizeUnpaidChallenge(result, expectedResourceUrl) {
  const challenge = result?._meta?.["x402/error"];
  const requirements = challenge?.accepts;
  const requirement = requirements?.[0];
  const bazaarInput = challenge?.extensions?.bazaar?.info?.input;
  const quote = challenge?.extensions?.["veristat/quote"];

  if (
    result?.isError !== true ||
    challenge?.x402Version !== 2 ||
    challenge?.error !== "PAYMENT_REQUIRED" ||
    !Array.isArray(requirements) ||
    requirements.length !== 1 ||
    !requirement ||
    requirement.scheme !== "exact" ||
    requirement.network !== EXPECTED_NETWORK ||
    requirement.amount !== EXPECTED_AMOUNT ||
    requirement.asset?.toLowerCase() !== EXPECTED_ASSET.toLowerCase() ||
    requirement.payTo?.toLowerCase() !== EXPECTED_PAYEE.toLowerCase() ||
    challenge?.resource?.url !== expectedResourceUrl ||
    bazaarInput?.toolName !== "consensus_check" ||
    bazaarInput?.transport !== "streamable-http" ||
    quote?.priceUSD !== 0.5 ||
    typeof quote?.token !== "string" ||
    quote.token.length === 0
  ) {
    throw new Error("unpaid response does not match the locked Base Sepolia contract");
  }

  // This allowlist omits signed quote tokens, payment material, and content.
  return {
    scheme: requirement.scheme,
    network: requirement.network,
    amount: requirement.amount,
    asset: requirement.asset,
    payTo: requirement.payTo,
    resourceUrl: challenge.resource.url,
    bazaar: { toolName: bazaarInput.toolName, transport: bazaarInput.transport }
  };
}

/** Connect, inspect the public contract, and deliberately stop at the 402. */
export async function runUnpaidBuyer({
  baseUrl = process.env.VERISTAT_URL ?? DEFAULT_VERISTAT_URL,
  createClient = () => new Client({ name: "veristat-unpaid-buyer", version: "0.1.0" }),
  createTransport = (url) => new StreamableHTTPClientTransport(url, { fetch: mcpFetch }),
  log = console.log
} = {}) {
  let client;
  try {
    const endpoint = new URL(baseUrl);
    client = createClient();
    await client.connect(createTransport(endpoint));

    const tools = await client.listTools();
    const toolNames = tools?.tools?.map((tool) => tool.name) ?? [];
    if (!REQUIRED_TOOLS.every((name) => toolNames.includes(name))) {
      throw new Error(`server does not expose the required tools: ${REQUIRED_TOOLS.join(", ")}`);
    }
    log({ tools: REQUIRED_TOOLS });

    const sample = parseTextResult(
      await client.callTool({ name: "get_sample_verdict", arguments: {} }),
      "get_sample_verdict"
    );
    log({ free_sample: summarizeFreeSample(sample) });

    const unpaid = await client.callTool({ name: "consensus_check", arguments: SYNTHETIC_REQUEST });
    log({ unpaid_challenge: summarizeUnpaidChallenge(unpaid, endpoint.toString()) });
  } finally {
    await client?.close?.();
  }
}

if (
  process.argv[1] &&
  realpathSync(fileURLToPath(import.meta.url)) === realpathSync(process.argv[1])
) {
  runUnpaidBuyer().catch((error) => {
    console.error(`FAILED: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
}
