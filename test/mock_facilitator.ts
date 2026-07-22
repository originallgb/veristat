import type { FacilitatorClient } from "@x402/core/server";
import type {
  PaymentPayload,
  PaymentRequirements
} from "@x402/core/types";

/**
 * In-memory FacilitatorClient — proves the facilitator seam is swappable
 * (Coinbase CDP today, Cloudflare Gateway later) and lets the full
 * 402 → verify → execute → settle cycle run in tests with no network.
 */
export class MockFacilitator implements FacilitatorClient {
  verifyCalls: { payload: PaymentPayload; requirements: PaymentRequirements }[] = [];
  settleCalls: { payload: PaymentPayload; requirements: PaymentRequirements }[] = [];
  failVerify = false;
  failSettle = false;
  omitPayerOnSettle = false;
  /** EIP-3009 nonces already settled on the mock "chain" — replayed
   *  authorizations fail verify, as they would against a real facilitator. */
  private settledNonces = new Set<string>();

  constructor(private network: string) {}

  private nonceOf(payload: PaymentPayload): string {
    const auth = (payload.payload as { authorization?: { nonce?: string } })
      ?.authorization;
    return auth?.nonce ?? JSON.stringify(payload.payload);
  }

  async getSupported() {
    return {
      kinds: [{ x402Version: 2, scheme: "exact", network: this.network as never }],
      extensions: [],
      signers: {}
    };
  }

  async verify(payload: PaymentPayload, requirements: PaymentRequirements) {
    this.verifyCalls.push({ payload, requirements });
    if (this.failVerify) return { isValid: false, invalidReason: "MOCK_REJECTED" };
    if (this.settledNonces.has(this.nonceOf(payload)))
      return { isValid: false, invalidReason: "NONCE_ALREADY_USED" };
    const payer = (payload.payload as { authorization?: { from?: string } })
      ?.authorization?.from;
    return { isValid: true, payer };
  }

  async settle(payload: PaymentPayload, requirements: PaymentRequirements) {
    this.settleCalls.push({ payload, requirements });
    if (this.failSettle) {
      return {
        success: false,
        errorReason: "MOCK_SETTLE_FAILED",
        transaction: "",
        network: this.network as never
      };
    }
    this.settledNonces.add(this.nonceOf(payload));
    const result = {
      success: true,
      transaction: `0xmock${this.settleCalls.length.toString(16).padStart(8, "0")}`,
      network: this.network as never
    };
    if (this.omitPayerOnSettle) return result;
    return {
      ...result,
      payer: (payload.payload as { authorization?: { from?: string } })
        ?.authorization?.from
    };
  }
}
