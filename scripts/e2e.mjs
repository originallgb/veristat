// Full x402 e2e matrix against a running veristat server (docs/TESTING.md).
// Exercises the same withX402Client real agent buyers use, so a pass is also
// a wire-format compliance check. Exits nonzero on any failure.
//
//   VERISTAT_URL=http://localhost:8787/mcp \
//   BUYER_PRIVATE_KEY=$(cat .wallets/buyer.key) node scripts/e2e.mjs
//
// Env:
//   VERISTAT_URL       target /mcp endpoint (default http://localhost:8787/mcp)
//   BUYER_PRIVATE_KEY  funded base-sepolia buyer key (scripts/make-test-wallet.mjs)
//   NETWORK            CAIP-2, default eip155:84532
//   E2E_UNPAID_ONLY=1  run only the free/402-shape checks (no wallet needed)
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { withX402Client } from "agents/x402";
import { toClientEvmSigner } from "@x402/evm";
import { privateKeyToAccount } from "viem/accounts";
import { mcpFetch } from "./mcp-fetch.mjs";

const BASE = process.env.VERISTAT_URL ?? "http://localhost:8787/mcp";
const NETWORK = process.env.NETWORK ?? "eip155:84532";
const UNPAID_ONLY = process.env.E2E_UNPAID_ONLY === "1";
const PK = process.env.BUYER_PRIVATE_KEY;

let failures = 0;
const check = (name, cond, detail = "") => {
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${cond || !detail ? "" : ` — ${detail}`}`);
  if (!cond) failures++;
};

const client = new Client({ name: "e2e", version: "0.0.0" });
await client.connect(
  new StreamableHTTPClientTransport(new URL(BASE), { fetch: mcpFetch })
);
console.log(`target: ${BASE} (${NETWORK})\n`);

// 1. tool surface
const tools = await client.listTools();
const names = tools.tools.map((t) => t.name);
for (const t of ["consensus_check", "get_sample_verdict", "research_fanout"])
  check(`tool listed: ${t}`, names.includes(t), `got: ${names.join(", ")}`);

// 2. free tool
const sample = await client.callTool({ name: "get_sample_verdict", arguments: {} });
let sampleBody;
try {
  sampleBody = JSON.parse(sample.content[0].text);
} catch {}
check("get_sample_verdict returns a verdict + price card",
  !sample.isError && !!sampleBody?.sample_verdict?.verdict && !!sampleBody?.price_card);

// 3. unpaid 402 challenge shape
const CONTENT = "Renaming a table in PostgreSQL with ALTER TABLE ... RENAME TO does not rewrite the table.";
const unpaid = await client.callTool({
  name: "consensus_check",
  arguments: { content: CONTENT }
});
const err = unpaid._meta?.["x402/error"];
check("unpaid call is a 402 challenge", unpaid.isError === true && !!err);
check("402 error code", err?.error === "PAYMENT_REQUIRED", String(err?.error));
const req0 = err?.accepts?.[0];
check("402 quotes $0.50 (3-panel, small input)", req0?.amount === "500000", String(req0?.amount));
check("402 network matches", req0?.network === NETWORK, String(req0?.network));
check("402 scheme is exact", req0?.scheme === "exact", String(req0?.scheme));
check("402 carries signed quote extension",
  typeof err?.extensions?.["veristat/quote"]?.token === "string" &&
  err?.extensions?.["veristat/quote"]?.priceUSD === 0.5);

// 4. stub stays stubbed
const stub = await client.callTool({ name: "research_fanout", arguments: { brief: "x" } });
let stubBody;
try {
  stubBody = JSON.parse(stub.content[0].text);
} catch {}
check("research_fanout is a structured NOT_AVAILABLE stub", stubBody?.error === "NOT_AVAILABLE");

if (UNPAID_ONLY) {
  await client.close();
  console.log(`\n${failures === 0 ? "E2E (unpaid-only) OK" : `E2E FAILED: ${failures} check(s)`}`);
  process.exit(failures === 0 ? 0 : 1);
}
if (!PK) {
  console.error("\nBUYER_PRIVATE_KEY not set — run scripts/make-test-wallet.mjs, fund it, retry (or E2E_UNPAID_ONLY=1).");
  process.exit(1);
}

// 5. client-side price cap refuses to overpay (no charge)
const capped = withX402Client(client, {
  network: NETWORK,
  account: toClientEvmSigner(privateKeyToAccount(PK)),
  maxPaymentValue: BigInt(1000) // $0.001 cap — below any veristat price
});
let cappedRejected = false;
try {
  const r = await capped.callTool(async () => true, {
    name: "consensus_check",
    arguments: { content: CONTENT }
  });
  cappedRejected = r.isError === true;
} catch {
  cappedRejected = true;
}
check("under-cap client never completes an overpriced call", cappedRejected);

// 6. paid call end to end (real settlement)
// (withX402Client mutates the underlying client; re-wrapping with a higher cap)
const paying = withX402Client(client, {
  network: NETWORK,
  account: toClientEvmSigner(privateKeyToAccount(PK)),
  maxPaymentValue: BigInt(3_000_000) // $3 cap
});
const paid = await paying.callTool(
  async (reqs) => {
    console.log(`      paying ${Number(reqs[0].amount) / 1e6} USDC on ${reqs[0].network}`);
    return true;
  },
  { name: "consensus_check", arguments: { content: CONTENT } }
);
let verdict;
try {
  verdict = JSON.parse(paid.content[0].text);
} catch {}
check("paid call returns a verdict", !paid.isError && !!verdict?.verdict,
  paid.isError ? String(paid.content?.[0]?.text).slice(0, 300) : "unparseable verdict");
check("verdict has a panel and synthesis",
  Array.isArray(verdict?.panel) && verdict.panel.length >= 2 && !!verdict?.synthesis);
const receipt = paid._meta?.["x402/payment-response"];
check("settlement receipt with tx hash", receipt?.success === true && !!receipt?.transaction,
  JSON.stringify(receipt));
if (receipt?.transaction) {
  const scan = NETWORK === "eip155:8453" ? "https://basescan.org" : "https://sepolia.basescan.org";
  console.log(`      tx: ${scan}/tx/${receipt.transaction}`);
  console.log(`      request_id: ${verdict?.request_id} (check settlements row: node scripts/dashboard.mjs)`);
}

await client.close();
console.log(`\n${failures === 0 ? "E2E OK" : `E2E FAILED: ${failures} check(s)`}`);
process.exit(failures === 0 ? 0 : 1);
