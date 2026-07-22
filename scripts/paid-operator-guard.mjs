/**
 * Fail-closed policy for operator-triggered paid test calls.
 *
 * These are public Base Sepolia values, not secrets. Keeping them here makes
 * the permitted spend target immutable and independently testable. Update
 * them alongside wrangler.jsonc if the rehearsal receiver ever changes.
 */
export const BASE_SEPOLIA_NETWORK = "eip155:84532";
export const BASE_SEPOLIA_USDC_ASSET =
  "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
export const TESTNET_PAY_TO_ADDRESS =
  "0x86CdAe1A22458442BaB9E10216a7E96b606d3635";
export const SMALL_CALL_ATOMIC_AMOUNT = "500000";

export class PaidOperatorGuardError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "PaidOperatorGuardError";
    this.code = code;
  }
}

const reject = (code, message) => {
  throw new PaidOperatorGuardError(code, message);
};

/**
 * Reads the wallet only after explicit enablement and the testnet-only network
 * lock have passed. Accepting an env-like object keeps the ordering testable.
 */
export function readPaidOperatorConfig(env = process.env) {
  if (env.ENABLE_PAID_CALL !== "1") {
    reject(
      "PAID_CALL_NOT_ENABLED",
      "Paid mode is disabled. Set ENABLE_PAID_CALL=1 only for an approved Base Sepolia rehearsal."
    );
  }

  const network = env.NETWORK ?? BASE_SEPOLIA_NETWORK;
  if (network !== BASE_SEPOLIA_NETWORK) {
    reject(
      "PAID_NETWORK_NOT_ALLOWED",
      `Paid operator scripts are locked to ${BASE_SEPOLIA_NETWORK}; got ${network}.`
    );
  }

  // Do not move this read above the enablement and network checks.
  const privateKey = env.BUYER_PRIVATE_KEY;
  if (!privateKey) {
    reject(
      "BUYER_KEY_MISSING",
      "BUYER_PRIVATE_KEY must be supplied from the current process environment."
    );
  }

  return Object.freeze({ network, privateKey });
}

export function expectedSmallTestnetChallenge(resourceUrl) {
  let parsed;
  try {
    parsed = new URL(resourceUrl);
  } catch {
    reject("INVALID_RESOURCE_URL", "VERISTAT_URL must be an absolute URL.");
  }

  return Object.freeze({
    scheme: "exact",
    network: BASE_SEPOLIA_NETWORK,
    amount: SMALL_CALL_ATOMIC_AMOUNT,
    resourceUrl: parsed.toString(),
    asset: BASE_SEPOLIA_USDC_ASSET,
    payTo: TESTNET_PAY_TO_ADDRESS
  });
}

const sameAddress = (actual, expected) =>
  typeof actual === "string" && actual.toLowerCase() === expected.toLowerCase();

/** Validates the exact requirement that the payment client is allowed to sign. */
export function assertSafePaymentRequirements(requirements, expected) {
  if (!Array.isArray(requirements) || requirements.length !== 1) {
    reject(
      "UNEXPECTED_PAYMENT_OPTIONS",
      "Expected exactly one Base Sepolia payment requirement."
    );
  }

  const requirement = requirements[0];
  if (!requirement || requirement.scheme !== expected.scheme) {
    reject("UNEXPECTED_SCHEME", "Payment requirement must use the exact scheme.");
  }
  if (requirement.network !== expected.network) {
    reject(
      "UNEXPECTED_NETWORK",
      `Payment requirement must use ${expected.network}.`
    );
  }
  if (requirement.amount !== expected.amount) {
    reject(
      "UNEXPECTED_AMOUNT",
      `Payment requirement must be exactly ${expected.amount} atomic USDC.`
    );
  }
  if (!sameAddress(requirement.asset, expected.asset)) {
    reject("UNEXPECTED_ASSET", "Payment requirement uses an unexpected asset.");
  }
  if (!sameAddress(requirement.payTo, expected.payTo)) {
    reject("UNEXPECTED_PAYEE", "Payment requirement uses an unexpected payee.");
  }

  return requirement;
}

/** Validates the unpaid challenge before any signer is constructed. */
export function assertSafePaymentChallenge(challenge, expected) {
  if (
    !challenge ||
    challenge.x402Version !== 2 ||
    challenge.error !== "PAYMENT_REQUIRED"
  ) {
    reject("MALFORMED_CHALLENGE", "Endpoint did not return the expected x402 v2 challenge.");
  }
  if (challenge.resource?.url !== expected.resourceUrl) {
    reject("UNEXPECTED_RESOURCE", "Payment challenge resource does not match VERISTAT_URL.");
  }

  const bazaarInput = challenge.extensions?.bazaar?.info?.input;
  const bazaarOutput = challenge.extensions?.bazaar?.info?.output;
  const quote = challenge.extensions?.["veristat/quote"];
  if (
    bazaarInput?.type !== "mcp" ||
    bazaarInput?.toolName !== "consensus_check" ||
    bazaarInput?.transport !== "streamable-http" ||
    bazaarOutput?.type !== "json"
  ) {
    reject("UNEXPECTED_DISCOVERY", "Payment challenge has unexpected Bazaar discovery metadata.");
  }
  if (quote?.priceUSD !== 0.5 || typeof quote?.token !== "string" || !quote.token) {
    reject("UNEXPECTED_QUOTE", "Payment challenge has no usable locked-price quote.");
  }

  return assertSafePaymentRequirements(challenge.accepts, expected);
}

/** Ensure the exact challenge used by withX402Client is validated before its
 * confirmation callback can construct or sign a payment payload. */
export function guardClientPaymentChallenges(client, expected, onChallenge = () => {}) {
  const callTool = client.callTool.bind(client);
  Object.defineProperty(client, "callTool", {
    configurable: true,
    value: async (...args) => {
      const result = await callTool(...args);
      const challenge = result?._meta?.["x402/error"];
      if (result?.isError && Array.isArray(challenge?.accepts) && challenge.accepts.length > 0) {
        assertSafePaymentChallenge(challenge, expected);
        onChallenge(challenge);
      }
      return result;
    }
  });
  return client;
}
