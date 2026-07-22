export const BASE_SEPOLIA_NETWORK: "eip155:84532";
export const BASE_SEPOLIA_USDC_ASSET: string;
export const TESTNET_PAY_TO_ADDRESS: string;
export const SMALL_CALL_ATOMIC_AMOUNT: "500000";

export class PaidOperatorGuardError extends Error {
  code: string;
}

export interface PaidOperatorEnvironment {
  ENABLE_PAID_CALL?: string;
  NETWORK?: string;
  BUYER_PRIVATE_KEY?: string;
}

export interface PaidOperatorConfig {
  readonly network: "eip155:84532";
  readonly privateKey: string;
}

export interface ExpectedPaidChallenge {
  readonly scheme: "exact";
  readonly network: "eip155:84532";
  readonly amount: "500000";
  readonly resourceUrl: string;
  readonly asset: string;
  readonly payTo: string;
}

export interface PaymentRequirementLike {
  scheme?: unknown;
  network?: unknown;
  amount?: unknown;
  asset?: unknown;
  payTo?: unknown;
  [key: string]: unknown;
}

export interface PaymentChallengeLike {
  x402Version?: unknown;
  error?: unknown;
  resource?: { url?: unknown };
  accepts?: unknown;
  [key: string]: unknown;
}

export interface ChallengeGuardClient {
  callTool: (...args: any[]) => any;
}

export function readPaidOperatorConfig(
  env?: PaidOperatorEnvironment
): Readonly<PaidOperatorConfig>;

export function expectedSmallTestnetChallenge(
  resourceUrl: string
): Readonly<ExpectedPaidChallenge>;

export function assertSafePaymentRequirements(
  requirements: unknown,
  expected: ExpectedPaidChallenge
): PaymentRequirementLike;

export function assertSafePaymentChallenge(
  challenge: PaymentChallengeLike,
  expected: ExpectedPaidChallenge
): PaymentRequirementLike;

export function guardClientPaymentChallenges<T extends ChallengeGuardClient>(
  client: T,
  expected: ExpectedPaidChallenge,
  onChallenge?: (challenge: PaymentChallengeLike) => void
): T;
