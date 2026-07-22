import { describe, expect, it } from "vitest";
import {
  computePriceUSD,
  hashRequest,
  MAX_ENCODED_QUOTE_TOKEN_CHARS,
  signQuote,
  verifyQuote
} from "../src/payments/quoting";

describe("computePriceUSD", () => {
  it("prices a small 3-panel at $0.50", () => {
    expect(computePriceUSD({ panelSize: 3, contentChars: 1000 })).toBe(0.5);
  });
  it("prices a 5-panel at $1.50", () => {
    expect(computePriceUSD({ panelSize: 5, contentChars: 1000 })).toBe(1.5);
  });
  it("adds $0.50 surcharge over ~8k tokens", () => {
    expect(computePriceUSD({ panelSize: 3, contentChars: 40_000 })).toBe(1.0);
    expect(computePriceUSD({ panelSize: 5, contentChars: 40_000 })).toBe(2.0);
  });
});

describe("quote tokens", () => {
  const key = "test-signing-key";

  it("round-trips a valid quote", async () => {
    const requestHash = await hashRequest({ a: 1 });
    const token = await signQuote(key, {
      priceUSD: 0.5,
      requestHash,
      expiresAt: Date.now() + 60_000
    });
    expect(
      await verifyQuote(key, token, { priceUSD: 0.5, requestHash })
    ).toEqual({ ok: true });
  });

  it("rejects expired quotes", async () => {
    const requestHash = await hashRequest({ a: 1 });
    const token = await signQuote(key, {
      priceUSD: 0.5,
      requestHash,
      expiresAt: Date.now() - 1
    });
    const res = await verifyQuote(key, token, { priceUSD: 0.5, requestHash });
    expect(res).toEqual({ ok: false, reason: "QUOTE_EXPIRED" });
  });

  it("rejects tampered price", async () => {
    const requestHash = await hashRequest({ a: 1 });
    const token = await signQuote(key, {
      priceUSD: 0.5,
      requestHash,
      expiresAt: Date.now() + 60_000
    });
    const res = await verifyQuote(key, token, { priceUSD: 1.5, requestHash });
    expect(res).toEqual({ ok: false, reason: "QUOTE_PRICE_MISMATCH" });
  });

  it("rejects a forged signature", async () => {
    const requestHash = await hashRequest({ a: 1 });
    const token = await signQuote("other-key", {
      priceUSD: 0.5,
      requestHash,
      expiresAt: Date.now() + 60_000
    });
    const res = await verifyQuote(key, token, { priceUSD: 0.5, requestHash });
    expect(res).toEqual({ ok: false, reason: "BAD_QUOTE_SIGNATURE" });
  });

  it("rejects oversized tokens before signature or base64 work", async () => {
    const res = await verifyQuote(
      key,
      "A".repeat(MAX_ENCODED_QUOTE_TOKEN_CHARS + 1),
      { priceUSD: 0.5, requestHash: await hashRequest({ a: 1 }) }
    );
    expect(res).toEqual({ ok: false, reason: "QUOTE_TOO_LARGE" });
  });
});
