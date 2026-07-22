import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  BASE_SEPOLIA_NETWORK,
  BASE_SEPOLIA_USDC_ASSET,
  SMALL_CALL_ATOMIC_AMOUNT,
  TESTNET_PAY_TO_ADDRESS,
  assertSafePaymentChallenge,
  assertSafePaymentRequirements,
  expectedSmallTestnetChallenge,
  guardClientPaymentChallenges,
  readPaidOperatorConfig
} from "../scripts/paid-operator-guard.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const RESOURCE = "https://veristat.grant-23a.workers.dev/mcp";

const requirement = () => ({
  scheme: "exact",
  network: BASE_SEPOLIA_NETWORK,
  amount: SMALL_CALL_ATOMIC_AMOUNT,
  asset: BASE_SEPOLIA_USDC_ASSET,
  payTo: TESTNET_PAY_TO_ADDRESS
});

const challenge = () => ({
  x402Version: 2,
  error: "PAYMENT_REQUIRED",
  resource: { url: RESOURCE },
  accepts: [requirement()],
  extensions: {
    bazaar: {
      info: {
        input: { type: "mcp", toolName: "consensus_check", transport: "streamable-http" },
        output: { type: "json" }
      }
    },
    "veristat/quote": { priceUSD: 0.5, token: "signed-quote" }
  }
});

describe("paid operator guard", () => {
  it("does not read the buyer key until explicit enablement passes", () => {
    let keyReads = 0;
    const disabled = {
      ENABLE_PAID_CALL: "0",
      NETWORK: BASE_SEPOLIA_NETWORK,
      get BUYER_PRIVATE_KEY() {
        keyReads += 1;
        return "must-not-be-read";
      }
    };

    expect(() => readPaidOperatorConfig(disabled)).toThrow(/disabled/i);
    expect(keyReads).toBe(0);
  });

  it("rejects mainnet before reading the buyer key", () => {
    let keyReads = 0;
    const mainnet = {
      ENABLE_PAID_CALL: "1",
      NETWORK: "eip155:8453",
      get BUYER_PRIVATE_KEY() {
        keyReads += 1;
        return "must-not-be-read";
      }
    };

    expect(() => readPaidOperatorConfig(mainnet)).toThrow(/locked to eip155:84532/i);
    expect(keyReads).toBe(0);
  });

  it("returns an immutable testnet-only operator configuration", () => {
    const config = readPaidOperatorConfig({
      ENABLE_PAID_CALL: "1",
      NETWORK: BASE_SEPOLIA_NETWORK,
      BUYER_PRIVATE_KEY: "test-only-key"
    });

    expect(config).toEqual({
      network: BASE_SEPOLIA_NETWORK,
      privateKey: "test-only-key"
    });
    expect(Object.isFrozen(config)).toBe(true);
  });

  it("accepts only the exact locked small-call challenge", () => {
    const expected = expectedSmallTestnetChallenge(RESOURCE);

    expect(assertSafePaymentChallenge(challenge(), expected)).toEqual(requirement());
    expect(expected).toMatchObject({
      amount: "500000",
      resourceUrl: RESOURCE,
      asset: BASE_SEPOLIA_USDC_ASSET,
      payTo: TESTNET_PAY_TO_ADDRESS
    });
    expect(Object.isFrozen(expected)).toBe(true);
  });

  it.each([
    ["malformed", { x402Version: 1 }],
    ["wrong scheme", { accepts: [{ ...requirement(), scheme: "upto" }] }],
    ["mainnet", { accepts: [{ ...requirement(), network: "eip155:8453" }] }],
    ["excessive amount", { accepts: [{ ...requirement(), amount: "500001" }] }],
    ["wrong resource", { resource: { url: "https://attacker.example/mcp" } }],
    ["wrong asset", { accepts: [{ ...requirement(), asset: "0x1111111111111111111111111111111111111111" }] }],
    ["wrong payee", { accepts: [{ ...requirement(), payTo: "0x2222222222222222222222222222222222222222" }] }],
    ["multiple options", { accepts: [requirement(), requirement()] }],
    ["wrong discovery", { extensions: { ...challenge().extensions, bazaar: { info: { input: { type: "http" } } } } }],
    ["missing quote", { extensions: { bazaar: challenge().extensions.bazaar } }]
  ])("refuses a %s challenge before payment authorization", (_label, mutation) => {
    const expected = expectedSmallTestnetChallenge(RESOURCE);
    const unsafe = { ...challenge(), ...mutation };
    let paymentAuthorized = false;

    expect(() => {
      assertSafePaymentChallenge(unsafe, expected);
      paymentAuthorized = true;
    }).toThrow();
    expect(paymentAuthorized).toBe(false);
  });

  it("revalidates retry requirements before approving a signature", () => {
    const expected = expectedSmallTestnetChallenge(RESOURCE);
    let paymentAuthorized = false;

    expect(() => {
      assertSafePaymentRequirements(
        [{ ...requirement(), amount: "1000000" }],
        expected
      );
      paymentAuthorized = true;
    }).toThrow(/exactly 500000/i);
    expect(paymentAuthorized).toBe(false);
  });

  it("guards the exact unpaid challenge observed by the payment wrapper", async () => {
    const unsafe = {
      ...challenge(),
      resource: { url: "https://attacker.example/mcp" }
    };
    const client = {
      async callTool() {
        return { isError: true, _meta: { "x402/error": unsafe } };
      }
    };
    guardClientPaymentChallenges(client, expectedSmallTestnetChallenge(RESOURCE));

    await expect(client.callTool()).rejects.toThrow(/resource/i);
  });

  it.each(["scripts/e2e.mjs", "scripts/paid-call.mjs"])(
    "%s refuses before connecting when the paid flag is missing",
    (script) => {
      const env = {
        ...process.env,
        E2E_UNPAID_ONLY: "0",
        ENABLE_PAID_CALL: "0",
        NETWORK: BASE_SEPOLIA_NETWORK,
        BUYER_PRIVATE_KEY: "must-not-be-used",
        VERISTAT_URL: "http://127.0.0.1:1/mcp"
      };
      const run = spawnSync(process.execPath, [resolve(ROOT, script)], {
        cwd: ROOT,
        env,
        encoding: "utf8"
      });

      expect(run.status).toBe(1);
      expect(run.stderr).toMatch(/REFUSED: Paid mode is disabled/i);
      expect(run.stderr).not.toMatch(/ECONNREFUSED|invalid private key/i);
    }
  );

  it("keeps guard checks ahead of connections and signer construction", () => {
    for (const [file, signerCall] of [
      ["scripts/e2e.mjs", "privateKeyToAccount(PK)"],
      ["scripts/paid-call.mjs", "privateKeyToAccount(pk)"]
    ]) {
      const source = readFileSync(resolve(ROOT, file), "utf8");
      const guard = source.indexOf("paidConfig = readPaidOperatorConfig(process.env)");
      const connect = source.indexOf("await client.connect");
      const signer = source.indexOf(signerCall);

      expect(guard).toBeGreaterThan(-1);
      expect(guard).toBeLessThan(connect);
      expect(guard).toBeLessThan(signer);
      expect(source).toContain("assertSafePaymentChallenge");
      expect(source).toContain("assertSafePaymentRequirements");
      expect(source).toContain("BigInt(SMALL_CALL_ATOMIC_AMOUNT)");
    }
  });

  it("requires explicit workflow opt-in and fixes the paid job to Base Sepolia", () => {
    const workflow = readFileSync(resolve(ROOT, ".github/workflows/ci.yml"), "utf8");

    expect(workflow).toContain("run_paid_testnet_e2e:");
    expect(workflow).toContain("default: false");
    expect(workflow).toContain("inputs.run_paid_testnet_e2e == true");
    expect(workflow).toContain("needs: test");
    expect(workflow).toContain('ENABLE_PAID_CALL: "1"');
    expect(workflow).toContain("NETWORK: eip155:84532");
  });
});
