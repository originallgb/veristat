export const DEFAULT_VERISTAT_URL: string;
export const EXPECTED_NETWORK: "eip155:84532";
export const EXPECTED_AMOUNT: "500000";
export const EXPECTED_ASSET: string;
export const EXPECTED_PAYEE: string;
export const EXPECTED_SCHEME: "exact";
export const MAX_PAYMENT_VALUE: bigint;
export const SYNTHETIC_REQUEST: { content: string; question: string };

export function runPaidBuyer(options?: {
  baseUrl?: string;
  env?: Record<string, string | undefined>;
  createClient?: () => any;
  createTransport?: (url: URL) => unknown;
  log?: (line: unknown) => void;
  confirm?: (challenge: {
    scheme: string;
    network: string;
    amount: string;
    asset: string;
    payTo: string;
  }) => Promise<boolean> | boolean;
  request?: { content: string; question?: string };
}): Promise<void>;
