import { describe, expect, it, beforeEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { CallToolResultSchema } from "@modelcontextprotocol/sdk/types.js";
import { withX402Client } from "agents/x402";
import { toClientEvmSigner } from "@x402/evm";
import { privateKeyToAccount } from "viem/accounts";
import { z } from "zod";
import { PaymentGate, type SettlementInfo } from "../src/payments/x402";
import { MockFacilitator } from "./mock_facilitator";

const NETWORK = "eip155:84532";
// Well-known anvil/hardhat test key #0 — NOT a real wallet
const TEST_PK =
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
const RECIPIENT = "0x1111111111111111111111111111111111111111" as const;

async function setup(opts?: { failSettle?: boolean; toolFails?: boolean }) {
  const facilitator = new MockFacilitator(NETWORK);
  facilitator.failSettle = opts?.failSettle ?? false;

  const gate = new PaymentGate({
    network: NETWORK,
    recipient: RECIPIENT,
    quoteSigningKey: "test-key",
    facilitator,
    onSettled: async (s) => {
      settled.push(s);
    }
  });
  const settled: unknown[] = [];

  const server = new McpServer({ name: "test", version: "0.0.0" });
  gate.registerPaidTool(
    server,
    "echo_paid",
    "Echoes, for money",
    0.5,
    { message: z.string() },
    {},
    (args) => ({
      panelSize: 3,
      contentChars: String(args.message).length
    }),
    async (args, settlement: SettlementInfo) => {
      if (opts?.toolFails) {
        return {
          isError: true,
          content: [{ type: "text" as const, text: "tool blew up" }]
        };
      }
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              echoed: args.message,
              request_id: settlement.requestId,
              cost_usd: settlement.priceUSD
            })
          }
        ]
      };
    }
  );

  const client = new Client({ name: "test-client", version: "0.0.0" });
  const [ct, st] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(st), client.connect(ct)]);

  // withX402Client mutates callTool in place — exercise the unpaid path via
  // a raw request that bypasses the payment wrapper
  const rawCall = (args: Record<string, unknown>) =>
    client.request(
      { method: "tools/call", params: { name: "echo_paid", arguments: args } },
      CallToolResultSchema
    );

  const account = privateKeyToAccount(TEST_PK);
  const payingClient = withX402Client(client, {
    network: NETWORK,
    account: toClientEvmSigner(account),
    maxPaymentValue: BigInt(10_000_000) // $10 cap in atomic USDC
  });

  return { facilitator, payingClient, rawCall, settled };
}

describe("x402 payment gate", () => {
  it("returns a 402 payload with quote for unpaid calls", async () => {
    const { rawCall } = await setup();
    const res = await rawCall({ message: "hi" });
    expect(res.isError).toBe(true);
    const err = res._meta?.["x402/error"] as Record<string, unknown>;
    expect(err).toBeDefined();
    expect(err.error).toBe("PAYMENT_REQUIRED");
    const accepts = err.accepts as { amount: string; payTo: string }[];
    // $0.50 = 500000 atomic USDC (6 decimals)
    expect(accepts[0].amount).toBe("500000");
    expect(accepts[0].payTo.toLowerCase()).toBe(RECIPIENT.toLowerCase());
    const ext = err.extensions as Record<string, { priceUSD: number }>;
    expect(ext["veristat/quote"].priceUSD).toBe(0.5);
  });

  it("quotes the large-input surcharge dynamically", async () => {
    const { rawCall } = await setup();
    const res = await rawCall({ message: "x".repeat(40_000) });
    const err = res._meta?.["x402/error"] as Record<string, unknown>;
    const accepts = err.accepts as { amount: string }[];
    expect(accepts[0].amount).toBe("1000000"); // $1.00
  });

  it("completes pay → verify → execute → settle end to end", async () => {
    const { facilitator, payingClient, settled } = await setup();
    const res = await payingClient.callTool(async () => true, {
      name: "echo_paid",
      arguments: { message: "hello" }
    });
    expect(res.isError ?? false).toBe(false);
    const body = JSON.parse((res.content as { text: string }[])[0].text);
    expect(body.echoed).toBe("hello");
    expect(body.cost_usd).toBe(0.5);
    expect(facilitator.verifyCalls).toHaveLength(1);
    expect(facilitator.settleCalls).toHaveLength(1);
    const receipt = res._meta?.["x402/payment-response"] as Record<string, unknown>;
    expect(receipt.success).toBe(true);
    expect(String(receipt.transaction)).toMatch(/^0xmock/);
    expect(settled).toHaveLength(1);
  });

  it("does not settle when the tool fails", async () => {
    const { facilitator, payingClient } = await setup({ toolFails: true });
    const res = await payingClient.callTool(async () => true, {
      name: "echo_paid",
      arguments: { message: "boom" }
    });
    expect(res.isError).toBe(true);
    expect(facilitator.verifyCalls).toHaveLength(1);
    expect(facilitator.settleCalls).toHaveLength(0);
  });

  it("rejects payment the facilitator declines", async () => {
    const { facilitator, payingClient } = await setup();
    facilitator.failVerify = true;
    const res = await payingClient.callTool(async () => true, {
      name: "echo_paid",
      arguments: { message: "hi" }
    });
    expect(res.isError).toBe(true);
    expect(facilitator.settleCalls).toHaveLength(0);
  });
});
