// End-to-end PAID call against a running veristat server.
//
// Requires (see README "What you must supply"):
//   BUYER_PRIVATE_KEY  — a testnet wallet key holding base-sepolia USDC
//                        (faucet: https://faucet.circle.com). NOT the deployer's.
//   VERISTAT_URL       — optional, defaults to http://localhost:8787/mcp
//   EVIDENCE_FILE      — optional path for a sanitized JSON rehearsal record
//
// Usage: BUYER_PRIVATE_KEY=0x... node scripts/paid-call.mjs "claim to verify"
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { withX402Client } from "agents/x402";
import { toClientEvmSigner } from "@x402/evm";
import { privateKeyToAccount } from "viem/accounts";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { mcpFetch } from "./mcp-fetch.mjs";

const pk = process.env.BUYER_PRIVATE_KEY;
if (!pk) {
  console.error("Set BUYER_PRIVATE_KEY to a funded base-sepolia test wallet key.");
  process.exit(1);
}
const content =
  process.argv[2] ??
  "Renaming a table in PostgreSQL with ALTER TABLE ... RENAME TO is instantaneous and does not rewrite the table.";

const BASE = process.env.VERISTAT_URL ?? "http://localhost:8787/mcp";
const NETWORK = process.env.NETWORK ?? "eip155:84532";
const EVIDENCE_FILE = process.env.EVIDENCE_FILE;
const client = new Client({ name: "paid-caller", version: "0.0.0" });
await client.connect(
  new StreamableHTTPClientTransport(new URL(BASE), { fetch: mcpFetch })
);

// Capture the public challenge before the payment wrapper mutates the client.
// The evidence record deliberately excludes the quote token, private key,
// payment payload/signature, prompt, verdict, and API credentials.
const unpaid = await client.callTool({
  name: "consensus_check",
  arguments: { content }
});
const challenge = unpaid._meta?.["x402/error"];
const acceptance = challenge?.accepts?.[0];
const bazaarInput = challenge?.extensions?.bazaar?.info?.input;
const bazaarOutput = challenge?.extensions?.bazaar?.info?.output;
if (!unpaid.isError || challenge?.error !== "PAYMENT_REQUIRED") {
  console.error("FAILED: deployed endpoint did not return an x402 payment challenge");
  process.exit(1);
}

const paying = withX402Client(client, {
  network: NETWORK,
  account: toClientEvmSigner(privateKeyToAccount(pk)),
  maxPaymentValue: BigInt(3_000_000) // $3 cap
});

console.log(`Calling consensus_check (will pay if challenged)...`);
const res = await paying.callTool(
  async (reqs) => {
    const r = reqs[0];
    console.log(`402 received — paying ${Number(r.amount) / 1e6} USDC on ${r.network} to ${r.payTo}`);
    return true;
  },
  { name: "consensus_check", arguments: { content } }
);

if (res.isError) {
  console.error("FAILED:", res.content?.[0]?.text?.slice(0, 2000));
  process.exit(1);
}
console.log("\n=== VERDICT ===\n", res.content[0].text);
console.log("\n=== SETTLEMENT RECEIPT ===\n", JSON.stringify(res._meta?.["x402/payment-response"], null, 2));
if (EVIDENCE_FILE) {
  const receipt = res._meta?.["x402/payment-response"];
  let verdict;
  try {
    verdict = JSON.parse(res.content?.[0]?.text ?? "{}");
  } catch {
    verdict = {};
  }
  const explorer = NETWORK === "eip155:8453"
    ? "https://basescan.org"
    : "https://sepolia.basescan.org";
  const evidence = {
    recorded_at: new Date().toISOString(),
    target: BASE,
    challenge: {
      x402Version: challenge?.x402Version,
      resource: challenge?.resource?.url,
      scheme: acceptance?.scheme,
      network: acceptance?.network,
      amount: acceptance?.amount,
      asset: acceptance?.asset,
      payTo: acceptance?.payTo,
      bazaar: {
        present: !!challenge?.extensions?.bazaar,
        inputType: bazaarInput?.type,
        toolName: bazaarInput?.toolName,
        transport: bazaarInput?.transport ?? "streamable-http",
        outputType: bazaarOutput?.type
      }
    },
    settlement: {
      success: receipt?.success === true,
      transaction: receipt?.transaction,
      network: receipt?.network,
      payer: receipt?.payer,
      requestId: verdict?.request_id,
      explorerUrl: receipt?.transaction ? `${explorer}/tx/${receipt.transaction}` : undefined
    }
  };
  await mkdir(dirname(EVIDENCE_FILE), { recursive: true });
  await writeFile(EVIDENCE_FILE, `${JSON.stringify(evidence, null, 2)}\n`, {
    mode: 0o600
  });
  console.log(`\nSanitized evidence written to ${EVIDENCE_FILE}`);
}
await client.close();
