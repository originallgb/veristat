# Dependency advisory triage — issue #15 (2026-08-01)

This records the evidence and residual-risk disposition for
[issue #15](https://github.com/originallgb/veristat/issues/15). It is a
source-only dependency change; it does not authorize a deployment, payment,
or release.

**Status:** the safe remediation is complete, but issue #15 cannot be closed
until the operator either accepts the residual runtime dependency risk for the
launch path or authorizes the separately scoped `agents`/MCP migration.

## Evidence refreshed

| Source | Result |
| --- | --- |
| `npm audit --omit=dev` | 0 critical, 0 high, 4 moderate |
| GitHub Dependabot | still reports its pre-push open alerts; the relevant alerts are fast-uri #14, sharp #13, axios #1–#11, and Hono Node adapter #7/#12 |
| `npm ls` | resolves axios 1.19.0, fast-uri 3.1.5, postcss 8.5.25, and sharp 0.35.2 |

Dependabot is expected to remain stale until this branch is pushed and scanned.
`npm audit --omit=dev` is the acceptance check for the lockfile now in this
working tree.

## Applied safe fixes

| Advisory path | Disposition | Rationale |
| --- | --- | --- |
| `@coinbase/cdp-sdk` → `axios` | override to `^1.18.0` (resolves 1.19.0) | Removes the high Node HTTP adapter advisory without upgrading the CDP SDK. The CDP client remains on its tested 1.52.0 version. |
| MCP SDK → `ajv` → `fast-uri` | override to `^3.1.4` (resolves 3.1.5) | Patch-level URI parser fix; no application interface changes. |
| `agents` → Vite → `postcss` | override to `^8.5.18` (resolves 8.5.25) | Removes the high source-map path traversal advisory. |
| Wrangler → Miniflare → sharp | Wrangler 4.116.0 (Miniflare 4.20260730.0, sharp 0.35.2) | Development/deploy-toolchain update. Version 4.116.0 is the latest non-alpha Wrangler line using a Miniflare version outside the reported vulnerable range. |

The payment/discovery compatibility seam is deliberately exact-pinned at
`@x402/core`, `@x402/evm`, and `@x402/extensions` 2.18.0. A CDP SDK 1.54.0
attempt required x402 2.19+, so it was not adopted. The direct MCP SDK remains
at 1.29.0 to match `agents` 0.17.3; allowing 1.30.0 produced incompatible
private types during `npm run typecheck`.

## Residual moderate advisories

| Path | Production relevance and compensating control | Owner and revisit |
| --- | --- | --- |
| `agents` → `@modelcontextprotocol/sdk` → `@hono/node-server` | The reported path traversal is in Hono's Node `serve-static` adapter on Windows. The deployed service is a Cloudflare Worker and does not configure that adapter or serve static files. The package is nevertheless transitive runtime dependency, so this is tracked rather than waived as unreachable. | Engineering: reassess by 2026-09-01 or when `agents` publishes a compatible non-major remediation. Operator decision is required if a release needs acceptance beyond this evidence. |
| `agents` / MCP SDK | The available npm fix is `agents` 0.20.1 and is a major migration. It is outside issue #15's safe-fix boundary because it can change MCP transport and payment integration behaviour. | Engineering: plan as a separately approved migration; do not use `npm audit fix --force`. |

## Verification evidence (2026-08-01)

| Check | Result |
| --- | --- |
| `npm audit --omit=dev` | 0 critical, 0 high, 4 documented moderate findings; exits nonzero as expected for those findings |
| `npx vitest run test/x402.test.ts test/index.test.ts test/discovery.test.ts` | 3 files, 18 tests passed; covers payment settlement and MCP/discovery transport seams |
| `npm run typecheck` | passed |
| `npm test` | 7 files, 47 tests passed, including settle-only-after-success coverage |
| `npm run registry:validate` | `REGISTRY VALIDATION OK` |
| `npm run eval` | 12 fixtures; synthesis accuracy 11/12, required-finding recall 1.0, zero schema failures |
| `npx wrangler deploy --dry-run` | bundled successfully with Wrangler 4.116.0; dry-run exited before deployment |

No deployment, paid call, publication, or network/configuration mutation was
performed. The remaining release decision is operator-owned as stated above.
