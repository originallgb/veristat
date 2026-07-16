import { describe, expect, it } from "vitest";
import { healthPayload } from "../src/health";

describe("health endpoint", () => {
  it("returns the deployment identity and network", async () => {
    expect(
      healthPayload({
        CF_VERSION_METADATA: {
          id: "version-test-123",
          tag: "",
          timestamp: "2026-07-16T14:00:00.000Z"
        },
        NETWORK: "eip155:84532"
      })
    ).toEqual({
      ok: true,
      version: "version-test-123",
      deployed_at: "2026-07-16T14:00:00.000Z",
      network: "eip155:84532"
    });
  });
});
