export const DEFAULT_VERISTAT_URL: string;
export const SYNTHETIC_REQUEST: { content: string; question: string };

export function runUnpaidBuyer(options?: {
  baseUrl?: string;
  createClient?: () => any;
  createTransport?: (url: URL) => unknown;
  log?: (line: unknown) => void;
}): Promise<void>;
