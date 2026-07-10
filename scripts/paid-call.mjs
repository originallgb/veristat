// End-to-end PAID call against a running veristat server.
//
// Requires (see README "What you must supply"):
//   BUYER_PRIVATE_KEY  — a testnet wallet key holding base-sepolia USDC
//                        (faucet: https://faucet.circle.com). NOT the deployer's.
//   VERISTAT_URL       — optional, defaults to http://localhost:8787/mcp
//
// Usage: BUYER_PRIVATE_KEY=0x... node scripts/paid-call.mjs "claim to verify"
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { withX402Client } from "agents/x402";
import { toClientEvmSigner } from "@x402/evm";
import { privateKeyToAccount } from "viem/accounts";

const pk = process.env.BUYER_PRIVATE_KEY;
if (!pk) {
  console.error("Set BUYER_PRIVATE_KEY to a funded base-sepolia test wallet key.");
  process.exit(1);
}
const content =
  process.argv[2] ??
  "Renaming a table in PostgreSQL with ALTER TABLE ... RENAME TO is instantaneous and does not rewrite the table.";

const BASE = process.env.VERISTAT_URL ?? "http://localhost:8787/mcp";
const client = new Client({ name: "paid-caller", version: "0.0.0" });
await client.connect(new StreamableHTTPClientTransport(new URL(BASE)));

const paying = withX402Client(client, {
  network: process.env.NETWORK ?? "eip155:84532",
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
await client.close();
