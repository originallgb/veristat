# Official MCP registry publishing

Fetched 2026-07-12 from https://modelcontextprotocol.io/registry/quickstart
(+ modelcontextprotocol/registry GitHub docs).

## Flow

1. `server.json` at repo root (already drafted here) — validated against the
   registry schema. Remote-only servers use the `remotes` array with
   `streamable-http` + URL; no `packages` entry needed.
2. Namespace: `io.github.<github-user>/<name>` → ownership proven via GitHub
   auth; **no URL restrictions** for io.github.* namespaces (a workers.dev URL
   is fine). Custom domains would need the com.<domain> namespace + DNS proof.
3. Before login or publication, run `mcp-publisher validate server.json`.
   `publish --dry-run` is obsolete. Then, only with operator authorization,
   use `mcp-publisher login github` (device-code flow — needs the operator's
   GitHub) and `mcp-publisher publish`.
4. CI re-publish: the official GitHub Action supports GitHub OIDC — no stored
   secrets — so version bumps can publish automatically once the first manual
   publish establishes the namespace.

## veristat specifics

- Resolved on 2026-07-16: `server.json` uses
  `io.github.originallgb/veristat`, version `1.0.0`, and
  `https://veristat.grant-23a.workers.dev/mcp`.
- **Current release gate:** the checked-in registry/public-contract source is
  newer than the active Worker at that URL. Do not publish this registry
  version until an operator authorizes a deployment and verifies `/health`,
  root/`/price`, the free sample, and the unpaid 402 contract against the exact
  public endpoint.
- Version in `server.json` should track releases; the registry treats each
  publish as a version entry.
- The registry-facing description is product copy — agents read it to decide
  whether to wire us in. Current draft already leads with the value line and
  the free `get_sample_verdict` trust hook; keep it that way.

Sources:
- https://modelcontextprotocol.io/registry/quickstart
- https://github.com/modelcontextprotocol/registry/blob/main/docs/modelcontextprotocol-io/quickstart.mdx
- https://github.com/marketplace/actions/publish-mcp-server
