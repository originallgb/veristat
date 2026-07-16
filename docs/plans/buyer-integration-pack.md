# Buyer integration pack plan

Status: implementation plan. The examples described here do not yet exist,
and this document does not authorize a paid smoke, mainnet call, publication,
or outreach.

## Goal

Give a new Node buyer one small, copyable integration that demonstrates the
entire public contract without requiring Veristat source knowledge:

1. connect and complete MCP initialization;
2. list tools;
3. call `get_sample_verdict` for free;
4. call `consensus_check` without payment and inspect the x402 402 metadata;
5. optionally retry the same call with an explicitly enabled Base Sepolia
   payment.

The default path must be useful and incapable of spending money.

## Proposed artifacts

```text
examples/node-buyer/
├── README.md
├── package.json
├── package-lock.json
├── mcp-fetch.mjs
├── unpaid.mjs
└── paid-base-sepolia.mjs
```

The example should be self-contained enough to copy into a fresh project. Its
`mcp-fetch.mjs` must use a dedicated undici `Agent` and undici's own `fetch`,
matching `scripts/mcp-fetch.mjs`; bare/global `fetch` is not acceptable for
MCP streamable HTTP because an open SSE stream can deadlock same-origin calls
on affected Node versions.

## Flow 1 — Initialize, list, free sample, unpaid 402

`unpaid.mjs` should:

- Read `VERISTAT_URL`, defaulting only to the documented public Base Sepolia
  rehearsal endpoint or an explicitly chosen localhost endpoint.
- Create the MCP client and connect over streamable HTTP. Explain that SDK
  `connect` performs the MCP initialize handshake.
- Call `listTools()` and assert `consensus_check` and
  `get_sample_verdict` exist. The unavailable `research_fanout` stub is not a
  buyer dependency.
- Call `get_sample_verdict`, parse the result, and print only a concise verdict
  class, methodology/version summary, and current three-panel price.
- Call `consensus_check` with a harmless synthetic example and no payment
  wrapper.
- Assert an error result with `_meta["x402/error"]`, then print only sanitized
  challenge fields: scheme, CAIP-2 network, amount, asset, payee, resource URL,
  and Bazaar tool/transport type. Do not print quote tokens or the full
  challenge.
- Close the MCP client in a `finally` path and return nonzero on any contract
  mismatch.

Acceptance criteria:

- Running the documented default can never invoke `withX402Client` or spend.
- Output proves initialize/list, free sample, and unpaid 402 behavior without
  printing a prompt beyond the committed synthetic example.
- It rejects a missing/malformed payment challenge and a non-three-panel price
  claim.

## Flow 2 — Optional Base Sepolia paid retry

`paid-base-sepolia.mjs` should reuse the same MCP request arguments for the
unpaid challenge and paid retry, then use `withX402Client` only after all
safeguards pass.

Required safeguards:

- Require `ENABLE_PAID_CALL=1`; absence means fail closed before reading a
  wallet variable or constructing a signer.
- Require `NETWORK=eip155:84532` and require the challenge network to match.
  Reject `eip155:8453` and every other network. There is no mainnet override in
  this example while the Phase 3 gate is closed.
- Require `BUYER_PRIVATE_KEY` from the process environment. Never support a
  committed `.env`, inline key, example key, secret-store read, or generated
  wallet funded on the user's behalf.
- Tell the operator to use a throwaway, funded Base Sepolia wallet that is not
  the deployer. Do not inspect, print, or persist its private key.
- Validate the resource URL, asset, payee, amount, and discovery declaration
  before payment. Refuse an unexpected large-input surcharge for the small
  committed example.
- Enforce a narrow maximum payment value and show a human confirmation callback
  containing only public payment requirements.
- Print a concise verdict status, request ID, and sanitized public settlement
  receipt. Do not write an evidence file by default or print raw payment
  payload/signature data.
- Close the client on success, refusal, and error.

Acceptance criteria:

- No paid request is possible without all explicit flags, exact Base Sepolia
  matching, a caller-supplied key, and confirmation.
- The example cannot be converted to mainnet through an environment variable
  alone.
- The payment cap is at or just above the expected `$0.50` small-input quote,
  not the broader `$3` operator-test cap.
- No wallet key, payment signature/payload, quote token, provider credential,
  submitted customer content, or full verdict is logged or stored.
- A declined confirmation exits without settlement.

## Documentation requirements

The example README must include:

- Supported Node version and exact install commands.
- A table distinguishing free sample, unpaid challenge, and paid retry.
- The current three-vendor/three-panel behavior and large-input surcharge;
  `panel_size: 5` compatibility is not live five-panel service.
- The Base Sepolia faucet/funding responsibility and the fact that real vendor
  API keys are server-side concerns, not buyer requirements.
- The implemented privacy/retention disclosure and policy link before asking a
  buyer to submit non-synthetic content.
- Common errors: wrong network, unfunded wallet, missing x402 challenge,
  payment declined, panel unavailable with no settlement, and MCP transport
  deadlock caused by replacing the dedicated dispatcher with global fetch.
- A clear warning that the public endpoint remains a rehearsal target until
  the Phase 2/3 gate changes.

No documentation may suggest that a buyer needs Anthropic, OpenAI, Google,
CDP, or Cloudflare credentials. The only credential in the optional paid
example is the buyer's own throwaway Base Sepolia wallet key, supplied at run
time.

## Fresh-environment verification

Verification must prove that the instructions work outside the repository's
installed dependency tree.

1. Copy only `examples/node-buyer/` into a new temporary directory.
2. Run the documented clean install.
3. Run the unpaid example against localhost fixture infrastructure or the
   exact public testnet URL. This step must make no payment and need no secret.
4. Verify output contains the expected tool names, free sample status, and
   sanitized 402 fields.
5. Run the paid example with no flags and confirm it fails before signer
   construction.
6. Use mocked transport/payment tests for approval, decline, wrong network,
   excessive amount, malformed challenge, and successful retry.
7. A live Base Sepolia paid smoke remains operator-approved and manual; it is
   not a CI step and is not required to merge the pack.

Suggested repository verification after implementation:

```sh
npx vitest run test/buyer-example.test.ts
npm run typecheck
npm test
```

## Launch harness adaptations

After the core example passes, derive a few focused snippets rather than many
shallow integrations:

- Pre-trade claim/risk check for x402 trading-agent builders.
- Risky code or migration review for coding-agent/plugin channels.
- Research-claim verification for deep-research users.
- Consulting harness dogfood with payer wallets flagged non-organic.

Each adaptation should change only the synthetic input and focusing question,
not fork payment or transport logic. External PRs, directory submissions, and
outreach are launch-material preparation and require operator approval.

## Dependencies and operator decisions

Dependencies:

- Registry/public-contract alignment so the example asserts stable names,
  version, fulfilled panel size, and price.
- A selected and implemented privacy/retention policy before encouraging real
  customer content.
- The existing dedicated-dispatcher behavior and x402 client compatibility.

Operator decisions:

- Approve the final example endpoint and wording.
- Choose whether the optional paid script ships in the main quickstart or a
  clearly separate advanced section.
- Approve the maximum payment cap and any live Base Sepolia paid smoke.
- Authorize later publication, external PRs, or outreach. Implementing the
  pack authorizes none of those actions.

## Explicit non-goals

- No mainnet support or network flip.
- No additional Bazaar diagnostic payment.
- No five-panel execution, refund automation, or `research_fanout` client.
- No provider-key setup, secret-store automation, or wallet generation/funding.
- No deployment or registry/directory publication.
