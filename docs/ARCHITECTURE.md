# ARCHITECTURE — Cloudflare layout and payment flow

Companion to `CLAUDE.md`'s Architecture section — diagrams, not prose. Render
natively on GitHub; source of truth for the code is still the files named in
each box.

## Cloudflare architecture

```mermaid
flowchart TB
    Agent["Agent / MCP client\n(withX402Client)"]

    subgraph CF["Cloudflare Worker (veristat)"]
        Hono["Hono routes\nsrc/index.ts\n/  /health  /price"]
        MCP["VeristatMCP\n(McpAgent, Durable Object)\nsrc/mcp/server.ts\nstreamable HTTP /mcp"]
        Gate["PaymentGate\nsrc/payments/x402.ts"]
        Quote["quoting.ts\ndeterministic price +\nHMAC 5-min quote token"]
        Orchestrator["orchestrator.ts\nparallel fan-out, 60s ceiling\ndegrades at 2/3"]
        Synth["synthesis.ts\n1 schema-enforced call\nverdictSchema"]
        Log["logging.ts\nswallow-on-error"]
    end

    subgraph Panel["Panel providers (src/panel/providers.ts) — vendor-diverse"]
        Anthropic["Anthropic"]
        OpenAI["OpenAI"]
        Google["Google"]
    end

    D1[("D1: veristat\nsettlements (demand proof)\nrequests (eval flywheel)")]
    Facilitator["Facilitator\n(@x402/core FacilitatorClient)\nx402.org -> CDP -> CF Gateway"]

    Agent -->|MCP request| MCP
    Agent -->|GET / health / price| Hono
    MCP --> Gate
    Gate --> Quote
    Gate -->|verify + settle| Facilitator
    Gate -->|on success| Orchestrator
    Orchestrator --> Anthropic
    Orchestrator --> OpenAI
    Orchestrator --> Google
    Orchestrator --> Synth
    Synth --> Log
    Gate -->|onSettled| Log
    Log --> D1
```

Key seams: the facilitator is injected via `FacilitatorClient`
(`src/payments/x402.ts`) — swapping x402.org → CDP → Cloudflare Monetization
Gateway is a constructor argument, not a rewrite (`docs/RUNBOOK.md`
facilitator swap procedure). Panel vendor diversity is enforced in
`src/panel/providers.ts` — never two models from one vendor.

## Payment flow (happy path + tested failure branches)

Branches below map 1:1 to `docs/TESTING.md`'s negative-path matrix
(`test/x402.test.ts`) — this is that matrix as a picture.

```mermaid
sequenceDiagram
    participant Buyer as Agent buyer
    participant Gate as PaymentGate
    participant Fac as Facilitator
    participant Tool as Panel plus Synthesis
    participant D1 as D1 settlements slash requests

    Buyer->>Gate: call consensus_check, no payment
    Gate-->>Buyer: 402 challenge, price plus quote token plus discovery ext

    Note over Buyer,Gate: Buyer signs payment, retries with signed payment meta

    Buyer->>Gate: call consensus_check plus payment

    alt quote expired past 5 min
        Gate-->>Buyer: QUOTE_EXPIRED, re-challenge with new 402
    else quote tampered price or hash mismatch
        Gate-->>Buyer: re-challenge with new 402
    else wrong network, mainnet payment vs testnet config
        Gate-->>Buyer: rejected, no verify call
    else replayed payment payload
        Fac-->>Gate: not settled twice, chain enforced
    else facilitator declines verify
        Gate->>Fac: verify
        Fac-->>Gate: declined
        Gate-->>Buyer: error, no execution, no settle
    else happy path
        Gate->>Fac: verify
        Fac-->>Gate: ok
        Gate->>Tool: execute consensus_check
        alt tool failure, panel or synthesis error
            Tool-->>Gate: error
            Gate-->>Buyer: error result, no settle call, buyer keeps funds
        else tool succeeds, degraded two of three panel
            Tool-->>Gate: verdict plus panel_degraded true plus refund note
            Gate->>Fac: settle
            alt settle fails, facilitator 500
                Fac-->>Gate: failure
                Gate-->>Buyer: error, no receipt logged, no silent charge
            else settle ok
                Fac-->>Gate: receipt
                Gate->>D1: log settlement plus degraded request
                Gate-->>Buyer: verdict plus payment response
            end
        else tool succeeds, full panel
            Tool-->>Gate: verdict
            Gate->>Fac: settle
            Fac-->>Gate: receipt
            Gate->>D1: log settlement plus request, onSettled
            Gate-->>Buyer: verdict plus receipt
        end
    end
```

Invariant this diagram exists to make visible: **settlement only happens
after the tool callback succeeds** — every failure branch above either never
reaches `Fac->>Gate: settle` or fails before `D1` is written. A settlement
row in D1 without a matching verdict is a release blocker, not a flake
(`docs/TESTING.md` invariant #1).
