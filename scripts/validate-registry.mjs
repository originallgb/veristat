import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const EXPECTED_SCHEMA =
  "https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json";
const EXPECTED_NAME = "io.github.originallgb/veristat";
const EXPECTED_REMOTE = "https://veristat.grant-23a.workers.dev/mcp";
const EXPECTED_REPOSITORY = "https://github.com/originallgb/veristat";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const registryPath = resolve(process.argv[2] ?? resolve(repoRoot, "server.json"));
const errors = [];

function readJson(path, label) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    errors.push(`${label} is not readable JSON: ${error.message}`);
    return {};
  }
}

const registry = readJson(registryPath, registryPath);
const packageMetadata = readJson(resolve(repoRoot, "package.json"), "package.json");

let runtimeVersion;
try {
  const versionSource = readFileSync(resolve(repoRoot, "src/version.ts"), "utf8");
  runtimeVersion = versionSource.match(
    /export\s+const\s+VERSION\s*=\s*["']([^"']+)["']/
  )?.[1];
} catch (error) {
  errors.push(`src/version.ts is not readable: ${error.message}`);
}

if (registry.$schema !== EXPECTED_SCHEMA) {
  errors.push(`$schema must be ${EXPECTED_SCHEMA}`);
}
if (registry.name !== EXPECTED_NAME) {
  errors.push(`name must be ${EXPECTED_NAME}`);
}
if (registry.title !== "Veristat") {
  errors.push("title must be Veristat");
}
if (
  typeof registry.description !== "string" ||
  registry.description.length < 1 ||
  registry.description.length > 100
) {
  errors.push("description must contain 1-100 characters");
}
if (
  !packageMetadata.version ||
  registry.version !== packageMetadata.version ||
  runtimeVersion !== packageMetadata.version
) {
  errors.push(
    "server.json, package.json, and src/version.ts must use the same version"
  );
}
if (
  !Array.isArray(registry.remotes) ||
  registry.remotes.length !== 1 ||
  registry.remotes[0]?.type !== "streamable-http" ||
  registry.remotes[0]?.url !== EXPECTED_REMOTE
) {
  errors.push(`remotes must contain the public streamable-http URL ${EXPECTED_REMOTE}`);
}
if (
  registry.repository?.url !== EXPECTED_REPOSITORY ||
  registry.repository?.source !== "github"
) {
  errors.push(`repository must identify ${EXPECTED_REPOSITORY} on github`);
}

if (errors.length > 0) {
  console.error("REGISTRY VALIDATION FAILED");
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log("REGISTRY VALIDATION OK");
}
