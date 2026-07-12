/**
 * Coinbase CDP facilitator client (docs/ROADMAP.md Phase 2).
 *
 * The CDP facilitator requires JWT bearer auth on verify/settle (discovery
 * reads are public). Selection is driven by config: when FACILITATOR_URL
 * points at api.cdp.coinbase.com and CDP keys are present, wire
 * createAuthHeaders; the x402.org facilitator needs no auth. Settling
 * through CDP with the bazaar extension is what triggers the Bazaar listing.
 */

import { HTTPFacilitatorClient, type FacilitatorClient } from "@x402/core/server";
import { generateJwt } from "@coinbase/cdp-sdk/auth";

export const CDP_FACILITATOR_URL =
  "https://api.cdp.coinbase.com/platform/v2/x402";

export function isCdpFacilitator(url: string): boolean {
  return new URL(url).host === "api.cdp.coinbase.com";
}

export function buildFacilitator(env: {
  FACILITATOR_URL: string;
  CDP_API_KEY_ID?: string;
  CDP_API_KEY_SECRET?: string;
}): FacilitatorClient {
  const url = env.FACILITATOR_URL as `${string}://${string}`;
  if (!isCdpFacilitator(url)) {
    return new HTTPFacilitatorClient({ url });
  }
  if (!env.CDP_API_KEY_ID || !env.CDP_API_KEY_SECRET) {
    throw new Error(
      "FACILITATOR_URL points at the CDP facilitator but CDP_API_KEY_ID / CDP_API_KEY_SECRET secrets are not set (docs/ROADMAP.md Phase 2)."
    );
  }
  const { host, pathname } = new URL(url);
  const authFor = async (method: "GET" | "POST", endpoint: string) => ({
    Authorization: `Bearer ${await generateJwt({
      apiKeyId: env.CDP_API_KEY_ID!,
      apiKeySecret: env.CDP_API_KEY_SECRET!,
      requestMethod: method,
      requestHost: host,
      requestPath: `${pathname}/${endpoint}`,
      expiresIn: 120
    })}`
  });
  return new HTTPFacilitatorClient({
    url,
    createAuthHeaders: async () => ({
      verify: await authFor("POST", "verify"),
      settle: await authFor("POST", "settle"),
      supported: await authFor("GET", "supported"),
      bazaar: {} // discovery reads are public
    })
  });
}
