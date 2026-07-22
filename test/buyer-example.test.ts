import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_VERISTAT_URL,
  SYNTHETIC_REQUEST,
  runUnpaidBuyer
} from "../examples/node-buyer/unpaid.mjs";

const sample = {
  sample_verdict: { verdict: "contested" },
  methodology: "three independent vendors",
  service_version: "1.0.0",
  price_card: {
    consensus_check: {
      fulfilled_panel_size: 3,
      current_price: "$0.50"
    }
  }
};

const challenge = {
  error: "PAYMENT_REQUIRED",
  accepts: [{
    scheme: "exact",
    network: "eip155:84532",
    amount: "500000",
    asset: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
    payTo: "0x86CdAe1A22458442BaB9E10216a7E96b606d3635"
  }],
  x402Version: 2,
  resource: { url: DEFAULT_VERISTAT_URL },
  extensions: {
    bazaar: { info: { input: { toolName: "consensus_check", transport: "streamable-http" } } },
    "veristat/quote": { priceUSD: 0.5, token: "must-never-be-logged" }
  }
};

function mockClient(overrides: Record<string, unknown> = {}) {
  const calls: unknown[] = [];
  const client = {
    connected: false,
    closed: false,
    async connect() { this.connected = true; },
    async close() { this.closed = true; },
    async listTools() {
      return { tools: [{ name: "consensus_check" }, { name: "get_sample_verdict" }] };
    },
    async callTool(request: unknown) {
      calls.push(request);
      const name = (request as { name: string }).name;
      if (name === "get_sample_verdict") return { isError: false, content: [{ text: JSON.stringify(sample) }] };
      return { isError: true, _meta: { "x402/error": challenge } };
    },
    ...overrides
  };
  return { client, calls };
}

describe("unpaid Node buyer example", () => {
  it("uses only the free and unpaid flow, then prints an allowlisted summary", async () => {
    const { client, calls } = mockClient();
    const output: unknown[] = [];

    await runUnpaidBuyer({
      createClient: () => client,
      createTransport: () => ({ mocked: true }),
      log: (line: unknown) => output.push(line)
    });

    expect(client.connected).toBe(true);
    expect(client.closed).toBe(true);
    expect(calls).toEqual([
      { name: "get_sample_verdict", arguments: {} },
      { name: "consensus_check", arguments: SYNTHETIC_REQUEST }
    ]);
    expect(output).toEqual([
      { tools: ["consensus_check", "get_sample_verdict"] },
      {
        free_sample: {
          verdict: "contested",
          panel_size: 3,
          price: "$0.50",
          methodology: "three-vendor panel plus synthesis",
          service_version: "1.0.0"
        }
      },
      {
        unpaid_challenge: {
          scheme: "exact",
          network: "eip155:84532",
          amount: "500000",
          asset: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
          payTo: "0x86CdAe1A22458442BaB9E10216a7E96b606d3635",
          resourceUrl: DEFAULT_VERISTAT_URL,
          bazaar: { toolName: "consensus_check", transport: "streamable-http" }
        }
      }
    ]);
    expect(JSON.stringify(output)).not.toContain("must-never-be-logged");
  });

  it("rejects a sample that claims a non-three-panel service and still closes", async () => {
    const { client } = mockClient({
      async callTool(request: unknown) {
        if ((request as { name: string }).name === "get_sample_verdict") {
          return { isError: false, content: [{ text: JSON.stringify({ ...sample, price_card: { consensus_check: { fulfilled_panel_size: 5, current_price: "$1.50" } } }) }] };
        }
        throw new Error("the unpaid call must not run after a bad free sample");
      }
    });

    await expect(runUnpaidBuyer({ createClient: () => client, createTransport: () => ({}) })).rejects.toThrow("three-panel");
    expect(client.closed).toBe(true);
  });

  it("rejects a malformed unpaid challenge without exposing its signed quote", async () => {
    const { client } = mockClient({
      async callTool(request: unknown) {
        if ((request as { name: string }).name === "get_sample_verdict") {
          return { isError: false, content: [{ text: JSON.stringify(sample) }] };
        }
        return { isError: true, _meta: { "x402/error": { ...challenge, accepts: [] } } };
      }
    });

    await expect(runUnpaidBuyer({ createClient: () => client, createTransport: () => ({}) })).rejects.toThrow("locked Base Sepolia contract");
    expect(client.closed).toBe(true);
  });

  it("rejects wrong-but-well-formed payment terms", async () => {
    const { client } = mockClient({
      async callTool(request: unknown) {
        if ((request as { name: string }).name === "get_sample_verdict") {
          return { isError: false, content: [{ text: JSON.stringify(sample) }] };
        }
        return {
          isError: true,
          _meta: {
            "x402/error": {
              ...challenge,
              accepts: [{ ...challenge.accepts[0], amount: "499999" }]
            }
          }
        };
      }
    });

    await expect(
      runUnpaidBuyer({ createClient: () => client, createTransport: () => ({}) })
    ).rejects.toThrow("locked Base Sepolia contract");
    expect(client.closed).toBe(true);
  });

  it("contains no payment client, signer, wallet, or secret surface", async () => {
    const testDirectory = dirname(fileURLToPath(import.meta.url));
    const source = await readFile(resolve(testDirectory, "../examples/node-buyer/unpaid.mjs"), "utf8");
    expect(source).not.toMatch(/withX402Client|BUYER_PRIVATE_KEY|privateKeyToAccount|toClientEvmSigner|agents\/x402|@x402\/evm/);
  });
});
