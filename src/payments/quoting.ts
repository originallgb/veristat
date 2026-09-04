/**
 * Dynamic price computation + signed quote tokens (spec §3).
 *
 * Pricing is deterministic from the request args, so the amount demanded in
 * the 402 challenge and the amount checked at verify/settle time always
 * match for the same request. The signed quote token is returned in the 402
 * payload so a buyer can prove what was quoted, and carries a 5-minute
 * expiry that is enforced before settlement.
 */

// ~4 chars/token heuristic; surcharge threshold is 8k tokens (spec §3)
const SURCHARGE_CHAR_THRESHOLD = 8_000 * 4;
export const QUOTE_TTL_MS = 5 * 60 * 1000;
/** Signed quotes are normally a few hundred characters. Keep a generous hard
 * ceiling so attacker-controlled metadata cannot drive unbounded HMAC/base64
 * work before payment verification. */
export const MAX_ENCODED_QUOTE_TOKEN_CHARS = 4_096;

export interface QuoteInput {
  panelSize: 3 | 5;
  contentChars: number; // content + context combined
}

export function computePriceUSD({ panelSize, contentChars }: QuoteInput): number {
  const base = panelSize === 5 ? 1.5 : 0.5;
  const surcharge = contentChars > SURCHARGE_CHAR_THRESHOLD ? 0.5 : 0;
  return base + surcharge;
}

export interface Quote {
  priceUSD: number;
  requestHash: string;
  expiresAt: number; // epoch ms
}

async function hmac(key: string, data: string): Promise<string> {
  const k = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(data));
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

export async function hashRequest(args: unknown): Promise<string> {
  const data = new TextEncoder().encode(JSON.stringify(args));
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function signQuote(
  signingKey: string,
  quote: Quote
): Promise<string> {
  const body = btoa(JSON.stringify(quote));
  const sig = await hmac(signingKey, body);
  return `${body}.${sig}`;
}

export async function verifyQuote(
  signingKey: string,
  token: string,
  expected: { priceUSD: number; requestHash: string },
  now = Date.now()
): Promise<{ ok: true } | { ok: false; reason: string }> {
  if (token.length > MAX_ENCODED_QUOTE_TOKEN_CHARS)
    return { ok: false, reason: "QUOTE_TOO_LARGE" };
  const [body, sig] = token.split(".");
  if (!body || !sig) return { ok: false, reason: "MALFORMED_QUOTE" };
  try {
    const sigBytes = Uint8Array.from(atob(sig), (c) => c.charCodeAt(0));
    const k = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(signingKey),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );
    const valid = await crypto.subtle.verify(
      "HMAC",
      k,
      sigBytes,
      new TextEncoder().encode(body)
    );
    if (!valid) return { ok: false, reason: "BAD_QUOTE_SIGNATURE" };
  } catch {
    return { ok: false, reason: "BAD_QUOTE_SIGNATURE" };
  }
  let quote: Quote;
  try {
    quote = JSON.parse(atob(body));
  } catch {
    return { ok: false, reason: "MALFORMED_QUOTE" };
  }
  if (quote.expiresAt < now) return { ok: false, reason: "QUOTE_EXPIRED" };
  if (quote.priceUSD !== expected.priceUSD)
    return { ok: false, reason: "QUOTE_PRICE_MISMATCH" };
  if (quote.requestHash !== expected.requestHash)
    return { ok: false, reason: "QUOTE_REQUEST_MISMATCH" };
  return { ok: true };
}
