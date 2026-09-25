# ADR-0006: Publish the repository before the rename

Status: Accepted. Superseded in part by ADR-0007 (licence).

Date: 2026-09-24

## Context

On 2026-07-31 the owner decided that the Veristat working name would be
replaced before the official MCP Registry `1.0.0` publication, the public
repository launch, directory submissions and outreach. ADR-0005 selected
Mathesa as the replacement. The migration remains unmerged and trademark
clearance is parked.

## Decision

The owner waives the rename gate for the **repository only**. The source is
published tonight as a clearly labelled work in progress under the working
name `veristat`.

The publication route mirrors the art-precepts-design release:

- a fresh public repository containing `main` only;
- history rewritten to drop local paths, agent session logs, worktree records,
  binary review exports and tool attribution trailers;
- the original repository kept private as the full, unscrubbed record,
  including its issues and pull requests;
- no licence granted (all rights reserved).

## Still gated

The rename remains a prerequisite for MCP Registry publication, directory
submissions, outreach and mainnet launch. This decision does not authorise
any of those, nor a deployment, paid call or network change.

## Consequences

- Readers see the working name. A later repository rename is safe because
  GitHub redirects the old URL.
- The Mathesa name becomes visible in ADR-0005 before trademark clearance.
- Issue references in `docs/` point to the private tracker.
