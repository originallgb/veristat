// End-to-end PAID call against a running veristat server.
//
// Requires (see README "What you must supply"):
//   BUYER_PRIVATE_KEY  — a testnet wallet key holding base-sepolia USDC
//                        (faucet: https://faucet.circle.com). NOT the deployer's.
//   ENABLE_PAID_CALL   — must equal 1; checked before the wallet is read
//   VERISTAT_URL       — optional, defaults to http://localhost:8787/mcp
//   EVIDENCE_FILE      — optional path for a sanitized JSON rehearsal record
//
// Usage (with BUYER_PRIVATE_KEY already securely exported):
//   ENABLE_PAID_CALL=1 NETWORK=eip155:84532 node scripts/paid-call.mjs "claim to verify"
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { withX402Client } from "agents/x402";
import { toClientEvmSigner } from "@x402/evm";
import { privateKeyToAccount } from "viem/accounts";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { mcpFetch } from "./mcp-fetch.mjs";
import {
  SMALL_CALL_ATOMIC_AMOUNT,
  assertSafePaymentChallenge,
  assertSafePaymentRequirements,
  expectedSmallTestnetChallenge,
  guardClientPaymentChallenges,
  readPaidOperatorConfig
} from "./paid-operator-guard.mjs";

let paidConfig;
try {
  // This guard runs before BUYER_PRIVATE_KEY is read, before the MCP
  // connection opens, and before any signer can be constructed.
  paidConfig = readPaidOperatorConfig(process.env);
} catch (error) {
  console.error(`PAID CALL REFUSED: ${error instanceof Error ? error.message : "guard failed"}`);
  process.exit(1);
}
const pk = paidConfig.privateKey;
const content =
  process.argv[2] ??
  "Renaming a table in PostgreSQL with ALTER TABLE ... RENAME TO is instantaneous and does not rewrite the table.";

const BASE = process.env.VERISTAT_URL ?? "http://localhost:8787/mcp";
const NETWORK = paidConfig.network;
const EVIDENCE_FILE = process.env.EVIDENCE_FILE;
const expectedPaidChallenge = expectedSmallTestnetChallenge(BASE);
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
let acceptance;
try {
  if (unpaid.isError !== true) {
    throw new Error("Endpoint returned payment metadata without an MCP error result.");
  }
  acceptance = assertSafePaymentChallenge(challenge, expectedPaidChallenge);
} catch (error) {
  await client.close().catch(() => {});
  console.error(
    `PAID CALL REFUSED: ${error instanceof Error ? error.message : "challenge guard failed"}`
  );
  process.exit(1);
}
const bazaarInput = challenge?.extensions?.bazaar?.info?.input;
const bazaarOutput = challenge?.extensions?.bazaar?.info?.output;

// withX402Client performs its own unpaid call. Guard that exact challenge—not
// only the diagnostic challenge above—before its confirmation callback can
// construct or sign a payment payload.
guardClientPaymentChallenges(client, expectedPaidChallenge);
const paying = withX402Client(client, {
  network: NETWORK,
  account: toClientEvmSigner(privateKeyToAccount(pk)),
  maxPaymentValue: BigInt(SMALL_CALL_ATOMIC_AMOUNT) // exact $0.50 synthetic-call cap
});

console.log(`Calling consensus_check (will pay if challenged)...`);
const res = await paying.callTool(
  async (reqs) => {
    try {
      const requirement = assertSafePaymentRequirements(reqs, expectedPaidChallenge);
      console.log(
        `402 received — paying ${Number(requirement.amount) / 1e6} USDC on ${requirement.network} to ${requirement.payTo}`
      );
      return true;
    } catch (error) {
      console.error(
        `Payment refused: ${error instanceof Error ? error.message : "guard failed"}`
      );
      return false;
    }
  },
  { name: "consensus_check", arguments: { content } }
);

if (res.isError) {
  await client.close().catch(() => {});
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
