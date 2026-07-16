import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { VERSION } from "../src/version";
import { priceCard, pricePreview } from "../src/mcp/sample_verdict";
import { consensusCheckInput } from "../src/mcp/schemas";
import { z } from "zod";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const registry = JSON.parse(readFileSync(join(projectRoot, "server.json"), "utf8")) as {
  $schema?: string;
  name?: string;
  title?: string;
  description?: string;
  version?: string;
  repository?: { url?: string; source?: string };
  remotes?: Array<{ type?: string; url?: string }>;
};
const packageMetadata = JSON.parse(
  readFileSync(join(projectRoot, "package.json"), "utf8")
) as { version?: string; scripts?: Record<string, string> };

const validatorPath = join(projectRoot, "scripts/validate-registry.mjs");

describe("official MCP registry metadata", () => {
  it("describes the public Veristat remote with current metadata", () => {
    expect(registry.$schema).toBe(
      "https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json"
    );
    expect(registry.name).toBe("io.github.originallgb/veristat");
    expect(registry.title).toBe("Veristat");
    expect(registry.description).toEqual(expect.any(String));
    expect(registry.description!.length).toBeLessThanOrEqual(100);
    expect(registry.repository).toEqual({
      url: "https://github.com/originallgb/veristat",
      source: "github"
    });
    expect(registry.remotes).toEqual([
      {
        type: "streamable-http",
        url: "https://veristat.grant-23a.workers.dev/mcp"
      }
    ]);
  });

  it("keeps package, registry, and runtime versions aligned", () => {
    expect(packageMetadata.version).toBe("1.0.0");
    expect(registry.version).toBe(packageMetadata.version);
    expect(VERSION).toBe(packageMetadata.version);
  });

  it("advertises the fulfilled three-panel price while accepting panel_size 5", () => {
    const card = priceCard("eip155:84532");
    const serializedCard = JSON.stringify(card);

    expect(card.consensus_check).toMatchObject({
      fulfilled_panel_size: 3,
      current_price: "$0.50",
      accepted_panel_size_values: [3, 5]
    });
    expect(serializedCard).not.toContain("$1.50");
    expect(() =>
      z.object(consensusCheckInput).parse({ content: "check me", panel_size: 5 })
    ).not.toThrow();
  });

  it("preserves legacy price keys with the fulfilled three-panel quote", () => {
    expect(pricePreview(1_000)).toMatchObject({
      panel_3_usd: 0.5,
      panel_5_usd: 0.5,
      consensus_check_usd: 0.5,
      fulfilled_panel_size: 3,
      accepted_panel_size_values: [3, 5]
    });
  });

  it("provides a credential-free validator for the committed metadata", () => {
    expect(packageMetadata.scripts?.["registry:validate"]).toBe(
      "node scripts/validate-registry.mjs"
    );

    const result = spawnSync(process.execPath, [validatorPath], {
      encoding: "utf8"
    });
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain("REGISTRY VALIDATION OK");
  });

  it.each([
    ["schema", { $schema: "https://example.com/old-schema.json" }],
    ["version", { version: "9.9.9" }],
    ["description", { description: "x".repeat(101) }],
    ["remote", { remotes: [{ type: "sse", url: "https://example.com/mcp" }] }],
    ["repository", { repository: { url: "https://example.com", source: "git" } }]
  ])("rejects inconsistent %s metadata", (_label, mutation) => {
    const directory = mkdtempSync(join(tmpdir(), "veristat-registry-"));
    const fixturePath = join(directory, "server.json");

    try {
      writeFileSync(fixturePath, JSON.stringify({ ...registry, ...mutation }));
      const result = spawnSync(process.execPath, [validatorPath, fixturePath], {
        encoding: "utf8"
      });
      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain("REGISTRY VALIDATION FAILED");
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("publishes only from explicit release triggers using GitHub OIDC", () => {
    const workflow = readFileSync(
      join(projectRoot, ".github/workflows/publish-mcp.yml"),
      "utf8"
    );

    expect(workflow).toContain("workflow_dispatch:");
    expect(workflow).toContain('tags: ["v*"]');
    expect(workflow).toContain("id-token: write");
    expect(workflow).toContain("contents: read");
    expect(workflow).toContain("npm run registry:validate");
    expect(workflow).toContain("./mcp-publisher validate server.json");
    expect(workflow).toContain("./mcp-publisher login github-oidc");
    expect(workflow).toContain("./mcp-publisher publish");
    expect(workflow).not.toContain("secrets.");
  });
});
