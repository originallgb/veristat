# Veristat Node buyer example

This copyable example connects to the Veristat MCP endpoint, lists the public
tools, retrieves the free sample verdict, and interacts with the x402 payment
gateway.

It supports two distinct flows:
1. `npm run unpaid` (default, spend-immune): Connects, lists tools, fetches the
   free sample, and deliberately stops at the 402 payment challenge. It has no
   wallet, signer, or payment client configuration; this default path cannot spend money.
2. `npm run paid` (optional opt-in for Base Sepolia rehearsal): Performs a real testnet
   verification using `withX402Client`, signing an exact $0.50 payment requirement
   from a caller-supplied Base Sepolia throwaway wallet after explicit opt-in and confirmation.

## Privacy disclosure (ADR-0004)

Veristat operates under the adopted **ADR-0004 Zero-Toxic-Waste** privacy policy:
- **No raw content persistence:** Raw prompts, query content, panel responses, and full
  verdict text are never persisted to the server's D1 database.
- **Cryptographic hashing:** Request payloads are identified exclusively by their SHA-256
  `input_hash`.
- **Aggregate telemetry only:** Server persistence is restricted to non-sensitive operational
  metrics: `input_hash`, high-level `verdict_label` (e.g., "contested", "verified"), numeric
  `consensus_score`, token counts, and participating `model_count`.
- **Panel architecture:** The verification panel queries independent frontier models from
  Anthropic, OpenAI, and Google, followed by Anthropic synthesis.

Using the committed synthetic request is recommended during rehearsals.

## Release truth and endpoint status

The live public rehearsal endpoint matches the source repository contract ($0.50, 3-panel fulfilled):
- Endpoint: `https://veristat.grant-23a.workers.dev/mcp`
- Fulfilled panel size: 3 independent vendors
- Base price: $0.50 (500000 atomic USDC) on Base Sepolia (`eip155:84532`)
- Payee: `0x86CdAe1A22458442BaB9E10216a7E96b606d3635`
- USDC Asset: `0x036CbD53842c5426634e7929541eC2318f3dCF7e`

## Requirements and install

- Node.js 22 or later.
- No server API credentials (Anthropic, OpenAI, Google, Cloudflare) are needed by the buyer;
  all LLM orchestration is server-side.

Copy this whole directory into a fresh folder, then install dependencies:

```sh
npm ci
```

### Flow 1: Default unpaid run (spend-immune)

```sh
npm run unpaid
```

To run against a local development server instead of the public endpoint:

```sh
VERISTAT_URL=http://127.0.0.1:8787/mcp npm run unpaid
```

### Flow 2: Optional paid run (Base Sepolia rehearsal)

Paid execution is strictly opt-in and requires explicit environment configuration:

```sh
ENABLE_PAID_CALL=1 NETWORK=eip155:84532 BUYER_PRIVATE_KEY=<your-testnet-private-key> npm run paid
```

Paid mode safeguards:
- **Explicit enablement required:** Fails closed unless `ENABLE_PAID_CALL=1`.
- **Network lock:** Strictly locked to Base Sepolia (`eip155:84532`). Mainnet (`eip155:8453`)
  and other chains are rejected immediately.
- **Throwaway wallet:** `BUYER_PRIVATE_KEY` must be supplied in the environment. Use a
  throwaway wallet funded with testnet USDC (e.g. from the Circle Base Sepolia faucet). Never
  use a deployer key or mainnet key.
- **Contract pinning:** Validates that the payment challenge specifies exactly $0.50 (`500000`
  atomic units), the expected Base Sepolia USDC contract, and the Veristat testnet recipient address.
- **Max payment cap:** Enforces a client-side cap of `500000n` ($0.50).
- **Confirmation callback:** Prompts/confirms payment parameters before signing. If declined,
  the process aborts cleanly without settlement.
- **Sanitized output:** Never logs private keys, quote tokens, or raw request content.

## What the output proves

| Step | What happens | Can it spend? |
|---|---|---|
| Initialize and list tools | Completes the MCP handshake and checks the two buyer tools | No |
| Free sample | Reads the published verdict class, current fulfilled panel size, and price | No |
| Unpaid `consensus_check` | Receives and validates the x402 402 contract | No |
| Optional paid `consensus_check` | Validates terms, confirms, signs payment, and receives verdict | Yes (Base Sepolia only, capped at $0.50) |

The output is an allowlisted summary only: tool names, sample verdict class/three-panel/$0.50
summary, and public payment requirement fields (scheme, network, amount, asset, payee, resource URL,
and Bazaar transport). In paid mode, it logs a sanitized settlement receipt (transaction hash, network, payer).

## Common errors

- `PAID_CALL_NOT_ENABLED`: Paid mode was run without `ENABLE_PAID_CALL=1`.
- `PAID_NETWORK_NOT_ALLOWED`: `NETWORK` was omitted or set to anything other than `eip155:84532`.
- `BUYER_KEY_MISSING`: `BUYER_PRIVATE_KEY` was not provided in the environment.
- `UNEXPECTED_AMOUNT` / `UNEXPECTED_ASSET` / `UNEXPECTED_PAYEE`: The server challenge did not
  match the pinned Base Sepolia contract terms.
- Confirmation declined: The confirmation hook returned `false`, aborting payment cleanly.
- `User rejected` / Insufficient funds: The throwaway wallet lacks Base Sepolia ETH (for gas) or
  testnet USDC.

## Why the local dispatcher matters

`mcp-fetch.mjs` uses a dedicated `undici` dispatcher. Do not replace it with global `fetch`:
on affected Node versions, an open MCP SSE stream can deadlock a same-origin request.
The example's local dispatcher avoids that failure.
