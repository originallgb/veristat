# ADR-0007: License the service as fair source and the buyer example as MIT

Status: Accepted

Date: 2026-09-25

Supersedes: the "no licence granted" bullet in ADR-0006.

## Context

ADR-0006 published the repository with no licence (all rights reserved).
`package.json` still carried the npm default `"ISC"`, which contradicted the
README. The product is the hosted, x402-paid endpoint. The code, including the
synthesis prompt, is public, so the realistic threat is a fork running a
competing paid endpoint. Buyers never run the service code; they run a client.

The Fair Core License (FCL) was considered. It is the Functional Source
License (FSL) plus protection for license-key-gated features in self-hosted
commercial editions. Veristat has no self-hosted edition and no license keys,
so that addition would do nothing here.

## Decision

- Everything outside `examples/` is licensed under `FSL-1.1-MIT`
  (`LICENSE.md`): any use except a competing commercial product or service,
  with each version converting to MIT two years after publication.
- `examples/node-buyer/` is licensed MIT (`examples/node-buyer/LICENSE`).
  The rule for future code: anything a buyer runs (examples, a future client
  SDK) is MIT; anything that is the service or its operator tooling
  (`src/`, `migrations/`, `eval/`, `scripts/`, `test/`) is FSL.
- The licensor is Leon Grant Bussinger personally. The copyright line
  changes if the Mathesa rename moves ownership to an entity.

## Consequences

- Competing hosted clones are prohibited for two years per version. Against a
  pseudonymous x402 seller this is a deterrent, not an enforcement mechanism.
  The durable advantages remain operation, discovery listing and eval data,
  none of which is in the repository.
- Published prompts become MIT two years after each version ships.
- The buyer example can be copied into commercial agents without licence
  review.
- Before accepting outside contributions to FSL-licensed paths, adopt a DCO or
  a lightweight CLA so contributed code can be used commercially and
  relicensed.
- GitHub's licence detection reads only the root file, so the README states
  the split explicitly.
