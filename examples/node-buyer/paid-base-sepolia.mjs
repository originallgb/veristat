import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { withX402Client } from "agents/x402";
import { toClientEvmSigner } from "@x402/evm";
import { privateKeyToAccount } from "viem/accounts";
import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { mcpFetch } from "./mcp-fetch.mjs";

export const DEFAULT_VERISTAT_URL = "https://veristat.grant-23a.workers.dev/mcp";
export const EXPECTED_NETWORK = "eip155:84532";
export const EXPECTED_AMOUNT = "500000";
export const EXPECTED_ASSET = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
export const EXPECTED_PAYEE = "0x86CdAe1A22458442BaB9E10216a7E96b606d3635";
export const EXPECTED_SCHEME = "exact";
export const MAX_PAYMENT_VALUE = 500000n;

export const SYNTHETIC_REQUEST = {
  content: "A migration plan says CREATE INDEX without CONCURRENTLY is safe during peak writes.",
  question: "What operational risk should be checked before approving this claim?"
};

function sameAddress(actual, expected) {
  return typeof actual === "string" && actual.toLowerCase() === expected.toLowerCase();
}

function validateRequirements(requirements) {
  if (!Array.isArray(requirements) || requirements.length !== 1) {
    throw new Error("UNEXPECTED_PAYMENT_OPTIONS: Expected exactly one Base Sepolia payment requirement.");
  }
  const req = requirements[0];
  if (!req || req.scheme !== EXPECTED_SCHEME) {
    throw new Error(`UNEXPECTED_SCHEME: Payment requirement must use ${EXPECTED_SCHEME} scheme.`);
  }
  if (req.network !== EXPECTED_NETWORK) {
    throw new Error(`UNEXPECTED_NETWORK: Payment requirement must use ${EXPECTED_NETWORK}.`);
  }
  if (req.amount !== EXPECTED_AMOUNT || BigInt(req.amount) > MAX_PAYMENT_VALUE) {
    throw new Error(`UNEXPECTED_AMOUNT: Payment requirement must be exactly ${EXPECTED_AMOUNT} atomic USDC.`);
  }
  if (!sameAddress(req.asset, EXPECTED_ASSET)) {
    throw new Error("UNEXPECTED_ASSET: Payment requirement uses an unexpected asset.");
  }
  if (!sameAddress(req.payTo, EXPECTED_PAYEE)) {
    throw new Error("UNEXPECTED_PAYEE: Payment requirement uses an unexpected payee.");
  }
  return req;
}

async function defaultConfirm(req) {
  console.log(`402 received — paying ${Number(req.amount) / 1e6} USDC on ${req.network} to ${req.payTo}`);
  return true;
}

/** Connect, validate the pinned Base Sepolia challenge, confirm, and pay. */
export async function runPaidBuyer({
  baseUrl = process.env.VERISTAT_URL ?? DEFAULT_VERISTAT_URL,
  env = process.env,
  createClient = () => new Client({ name: "veristat-paid-buyer", version: "0.1.0" }),
  createTransport = (url) => new StreamableHTTPClientTransport(url, { fetch: mcpFetch }),
  log = console.log,
  confirm = defaultConfirm,
  request = SYNTHETIC_REQUEST
} = {}) {
  if (env.ENABLE_PAID_CALL !== "1") {
    throw new Error(
      "PAID_CALL_NOT_ENABLED: Paid mode is disabled. Set ENABLE_PAID_CALL=1 only for an approved Base Sepolia rehearsal."
    );
  }
  if (env.NETWORK !== EXPECTED_NETWORK) {
    throw new Error("PAID_NETWORK_NOT_ALLOWED: Paid buyer is locked to eip155:84532.");
  }
  if (!env.BUYER_PRIVATE_KEY) {
    throw new Error("BUYER_KEY_MISSING: BUYER_PRIVATE_KEY must be supplied in environment.");
  }

  const pk = env.BUYER_PRIVATE_KEY.startsWith("0x")
    ? env.BUYER_PRIVATE_KEY
    : `0x${env.BUYER_PRIVATE_KEY}`;
  const account = privateKeyToAccount(pk);
  const signer = toClientEvmSigner(account);

  let client;
  try {
    const endpoint = new URL(baseUrl);
    client = createClient();
    await client.connect(createTransport(endpoint));

    const paying = withX402Client(client, {
      network: EXPECTED_NETWORK,
      account: signer,
      maxPaymentValue: MAX_PAYMENT_VALUE
    });

    const res = await paying.callTool(
      async (requirements) => {
        const req = validateRequirements(requirements);
        const ok = await confirm({
          scheme: req.scheme,
          network: req.network,
          amount: req.amount,
          asset: req.asset,
          payTo: req.payTo
        });
        return Boolean(ok);
      },
      { name: "consensus_check", arguments: request }
    );

    if (res?.isError) {
      if (res?.content?.[0]?.text === "User declined payment") {
        log({ aborted: true, reason: "Payment confirmation declined" });
        return;
      }
      throw new Error(`PAID_CALL_FAILED: ${res?.content?.[0]?.text ?? "unknown error"}`);
    }

    let verdict;
    try {
      verdict = JSON.parse(res.content?.[0]?.text ?? "{}");
    } catch {
      verdict = {};
    }

    const paymentResponse = res._meta?.["x402/payment-response"];
    log({
      verdict: verdict.verdict ?? verdict.sample_verdict?.verdict ?? "verified",
      request_id: verdict.request_id,
      receipt: paymentResponse
        ? {
            success: paymentResponse.success,
            transaction: paymentResponse.transaction,
            network: paymentResponse.network,
            payer: paymentResponse.payer
          }
        : undefined
    });
  } finally {
    await client?.close?.();
  }
}

if (
  process.argv[1] &&
  realpathSync(fileURLToPath(import.meta.url)) === realpathSync(process.argv[1])
) {
  runPaidBuyer().catch((error) => {
    console.error(`FAILED: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
}
