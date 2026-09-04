# Mathesa public-surface migration map

Status: active, source-only migration record for [issue #19](https://github.com/originallgb/veristat/issues/19).

This map implements the reversible planning step required by
[ADR-0004](../decisions/0004-privacy-retention-policy.md) and
[ADR-0005](../decisions/0005-select-mathesa-masterbrand.md), and is ordered by
the [roadmap](../ROADMAP.md) and [current-state handoff](../context/current-state.md).
It does **not**
authorize a rename, deployment, publication, visibility change, purchase,
registration, filing, paid call, or outreach.

Public-facing source copy may change before deployment (`rename now`), while public contract/runtime changes remain release-gated behind #17 and #8.

## Governing decisions

- **Selected masterbrand:** Mathesa.
- **Repository and project:** retain `originallgb/veristat` and the current
  project identity. This is an explicit owner hold, not an omission.
- **Legacy infrastructure:** retain stable tools, Worker/Durable Object/D1
  identifiers, endpoint, payment resource, migrations, and historical evidence
  unless a separately approved engineering migration says otherwise.
- **Clearance and acquisition:** parked; this map makes no ownability or legal
  claim.

## Classification

| Surface | Current value | Planned Mathesa handling | Class | Rationale | Dependency and verification | Rollback / public-contract effect |
|---|---|---|---|---|---|---|
| Display masterbrand in prepared source copy | Mixed `Mathesa` and `Veristat` wording | Use `Mathesa` where the text describes the selected product identity; preserve `Veristat` only where it names a legacy identifier or historical record | Rename now | Align preparatory human-facing copy with the selected masterbrand without falsifying history | Editorial review against ADR-0005; Markdown-link check | Revert documentation commit; no deployed contract change |
| README title and product narrative | `# Mathesa`, with legacy product prose below | Stage coherent Mathesa buyer-facing copy, but retain the live-endpoint warning until #17 passes | Rename now | Makes prepared product messaging consistent while preserving the source-to-live warning | #16 positioning/claims review; no-spend buyer wording remains accurate | Revert source copy; no live change |
| Buyer examples and non-runtime documentation | Legacy display strings and `VERISTAT_URL` examples | Update human-facing labels only when the public contract and endpoint plan are approved; leave current URL/environment variables unchanged | Owner decision | Labels need approved positioning, while executable legacy values remain compatibility-sensitive | #7, #16, #17; exact copy requires approved descriptor and support identity | Keep legacy examples; any executable URL change is release-gated |
| Registry display metadata | `server.json` title and description use the working name | Prepare Mathesa `title`/description only in a reviewed release bundle; do not publish or alter the existing remote while launch gates are open | Release-gated external action | Registry identity is public, externally distributed contract metadata | #4/#5/#7/#14/#15/#17/#18 and #8, protected registry environment, exact deployed-source verification | Restore prior metadata before submission; registry identity is public contract metadata |
| Registry reverse-DNS name | `io.github.originallgb/veristat` | Retain while the repository/project hold remains; decide only with the eventual repository/registry identity strategy | Owner decision | It is coupled to the explicitly held repository/project identity and consumer discovery | #14 and any future repository decision | Keep the legacy identifier; changes can break discovery/consumer references |
| Public root JSON and MCP server display name | `veristat` in `src/index.ts` and `src/mcp/server.ts` | Do not change in this slice. Decide and test alongside a source-to-live deployment plan | Release-gated external action | These values are served to buyers and MCP clients, so changing them alters the public contract | #17; smoke root, `/health`, `/price`, initialize, tools/list, unpaid 402, and buyer path | Roll back deployment to verified prior Worker; changes alter public contract identity |
| MCP tool identifiers and schemas | `consensus_check`, `get_sample_verdict` | Keep stable | Keep stable | Stable tool names protect existing buyers, examples, and discovery compatibility | Existing test suite and buyer compatibility | No change; avoids buyer and catalog breakage |
| GitHub repository and project | `originallgb/veristat` | Keep stable by explicit owner hold | Keep stable | The owner expressly deferred this identity change | Future owner decision only | No change |
| npm package, CLI, and environment variable names | Existing package identity and `VERISTAT_URL` | Keep stable until a separately designed package/CLI compatibility plan exists | Keep stable | Installation and automation users may depend on these executable identifiers | #7 and future package decision | No change; prevents broken installation and automation |
| Worker, `workers.dev` URL, and x402 resource URL | `veristat` Worker and `https://veristat.grant-23a.workers.dev/mcp` | Keep stable | Keep stable | The payment resource and catalog evidence depend on the exact deployed endpoint | #4/#17 release evidence; discovery checks must continue to use the exact current URL | No change; preserves catalog and payment-resource continuity |
| Durable Object, D1, migrations, and runtime bindings | `VeristatMCP`, D1 `veristat`, applied migrations | Keep stable | Keep stable | Renaming stateful resources introduces avoidable state/data migration risk | Any future change requires tested state migration and explicit authorization | No change; avoids state/data migration risk |
| x402 discovery/payment metadata and receipt history | Existing resource, settlement records, testnet/on-chain evidence | Keep stable | Keep stable | These records must remain joinable and auditable across the controlled rehearsal | #4, #18; preserve historical evidence exactly | No change; prevents catalog/payment discontinuity |
| Future canonical domain/endpoint and redirect/alias plan | No approved domain or endpoint | Select only after the repository hold, clearance/acquisition posture, and release plan are expressly decided | Owner decision | No acquisition or canonical endpoint strategy is currently authorized | #14; parked acquisition and external authorization | No action; no redirect is promised |
| Repository/project rename, Worker/Durable Object/D1 renames, endpoint migration, npm/CLI rename | Legacy names | Require a dedicated engineering design, compatibility plan, migration rehearsal, rollback, and owner authorization | Engineering migration | These changes alter state, routing, compatibility, or external identities beyond source copy | New issue/spec plus #14 authority; no work is authorized here | Retain legacy identifiers unless that migration succeeds |
| Registry publication, directory submissions, domain/handle acquisition, public visibility, outreach | Not performed | Do not act until all named launch gates and exact owner approval pass | Release-gated external action | Each action creates an external commitment or irreversible public footprint | #4/#5/#7/#14/#15/#17/#18 and #8 | Stop before external action; no public commitment |

## Ordered execution

1. Review this map under #19 and resolve its owner-decision rows without
   reopening candidate generation.
2. Make only approved source-copy edits that do not alter an executable public
   contract, the repository/project identity, or legacy infrastructure. Public-facing source copy may change before deployment (`rename now`), while public contract/runtime changes remain release-gated behind #17 and #8.
3. Complete the independent launch gates: #5 privacy, #15 dependency/security,
   #7 buyer pack, and #16 launch assets.
4. Treat identity-bearing runtime changes as part of #17's reviewed Base
   Sepolia release, with exact deployed-source and public-contract verification.
5. Treat registry identity/publication as #8 work after its #4/#5/#7/#14/#15/
   #17/#18 dependencies and exact owner approval; keep outreach under the same
   existing release gates.

## Acceptance record

- [x] The repo/project hold is explicit.
- [x] Stable tools and legacy infrastructure are explicitly classified.
- [x] The map distinguishes source preparation from release-gated actions.
- [x] [ADR-0004](../decisions/0004-privacy-retention-policy.md),
  [ADR-0005](../decisions/0005-select-mathesa-masterbrand.md), the
  [roadmap](../ROADMAP.md), and [current-state handoff](../context/current-state.md)
  are reflected without changing their historical evidence.
- [x] Product-identity prose in the README, contributor, security, and support
  pages, strategy, and evaluation overview uses `Mathesa`; executable values,
  registry metadata, and historical/runtime evidence remain unchanged.
- [ ] Owner decisions are recorded for the descriptor, attribution/support,
  eventual registry identity, and canonical future endpoint.
- [ ] Any runtime or public-contract implementation is separately authorized
  and verified.
