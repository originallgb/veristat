import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  consensusCheckDiscovery,
  consensusCheckJsonSchema,
  validateDiscoveryExtensionSpec
} from "../src/payments/discovery";
import { consensusCheckInput } from "../src/mcp/schemas";

// A rejected discovery declaration means the Bazaar silently never lists us
// (docs/research/bazaar-listing.md) — pin its validity here.
describe("bazaar discovery declaration", () => {
  const declaration = consensusCheckDiscovery("test description");

  it("declares under the bazaar extension key", () => {
    expect(Object.keys(declaration)).toContain("bazaar");
  });

  it("passes the extension's own spec validation", () => {
    const bazaar = (declaration as Record<string, { info?: unknown; schema?: unknown }>)
      .bazaar;
    const result = validateDiscoveryExtensionSpec(bazaar as never);
    expect(result.valid, JSON.stringify(result)).toBe(true);
  });

  it("declares an input schema in sync with the zod source of truth", () => {
    const schema = consensusCheckJsonSchema() as {
      properties?: Record<string, unknown>;
      required?: string[];
    };
    expect(Object.keys(schema.properties ?? {}).sort()).toEqual(
      Object.keys(consensusCheckInput).sort()
    );
    expect(schema.required).toContain("content");
    expect(schema.required).not.toContain("context");
  });

  it("example input validates against the declared schema's own source", () => {
    const bazaar = (
      declaration as Record<
        string,
        { info?: { input?: { example?: unknown; toolName?: string } } }
      >
    ).bazaar;
    expect(bazaar?.info?.input?.toolName).toBe("consensus_check");
    const example = bazaar?.info?.input?.example as
      | Record<string, unknown>
      | undefined;
    expect(example).toBeDefined();
    // The example must parse under the real zod schema — a drifting example
    // is the same silent-rejection risk as a drifting schema.
    expect(() => z.object(consensusCheckInput).parse(example)).not.toThrow();
  });
});
