# BUILD SPEC — `veristat`: x402-paid multi-model verification MCP server

**Status: DECIDED. Do not re-litigate tool choice, pricing model, or platform. Implement.**
Decision context: strategy session 2026-07-10. Landscape verified against Coinbase x402 Bazaar (~100 listings, median price $0.001, Exa/Tavily present), official MCP registry (x402 servers exist, few), Cloudflare Agents SDK (native x402 support confirmed).

> Committed verbatim from the originating strategy session so every future
> session starts from a decision, not a re-litigation. Strategy rationale:
> `docs/STRATEGY.md`. Live implementation status: `docs/ROADMAP.md`.

---

## 1. What it is

A remote MCP server on Cloudflare Workers exposing paid verification tools. An agent (or harness) submits a claim, plan, or draft output; the server fans it out to a heterogeneous panel of frontier models (cross-vendor: Anthropic + OpenAI + Google minimum), synthesizes a structured verdict — agreements, contradictions, confidence, dissent — and returns it. Payment per call via x402 (USDC on Base, Coinbase facilitator). The buyer needs no vendor accounts; the payment is the credential.

Core value proposition in one line: **an independent second opinion a model cannot give itself, in one paid call with zero account setup.**

## 2. MCP tools

### Tool 1: `consensus_check` (PAID — the MVP)
- **Description (registry-facing, agents read this):** "Independent multi-model verification of a claim, answer, plan, or code change. Fans your input to 3–5 heterogeneous frontier models (cross-vendor), returns a structured verdict: consensus level, points of agreement, contradictions with reasoning, and dissenting positions. Use before high-stakes actions. Paid via x402."
- **Input schema:**
  ```json
  {
    "type": "object",
    "properties": {
      "content": { "type": "string", "description": "The claim, answer, plan, or artifact to verify. Max 32k chars." },
      "context": { "type": "string", "description": "Optional background the panel needs (task, constraints, data)." },
      "question": { "type": "string", "description": "Optional focusing question, e.g. 'Is this migration plan safe?' Defaults to general verification." },
      "panel_size": { "type": "integer", "enum": [3, 5], "default": 3 },
      "mode": { "type": "string", "enum": ["verify", "adversarial"], "default": "verify", "description": "adversarial = panel is explicitly prompted to attack the content" }
    },
    "required": ["content"]
  }
  ```
- **Output schema:**
  ```json
  {
    "verdict": "supported | contested | refuted | insufficient",
    "consensus_score": 0.0,
    "agreements": [{ "point": "string", "models_agreeing": 3 }],
    "contradictions": [{ "point": "string", "positions": [{ "stance": "string", "models": ["string"], "reasoning": "string" }] }],
    "dissent": [{ "model": "string", "position": "string" }],
    "panel": [{ "vendor": "string", "model": "string" }],
    "synthesis": "string — 150-word plain-language summary",
    "request_id": "string",
    "cost_usd": 0.50
  }
  ```
  Model identities in `panel` are disclosed by vendor+family (transparency is part of the product).

### Tool 2: `get_sample_verdict` (FREE — discovery/trust)
- Returns a canned but real example verdict + methodology description + current price card. No payment challenge. Exists so agents and humans can inspect output shape before paying.

### Tool 3: `research_fanout` (PAID, PHASE 2 — stub now)
- Full brief → 5-model deep pass → synthesized diff report. Async: returns a `job_id` immediately after payment; results via `get_research_result(job_id)`. Price $12–25 quoted dynamically. **Stub: registered in tool list with description "coming soon", returns a structured NOT_AVAILABLE error. Do not implement the pipeline yet.**

## 3. Pricing / gating

- **Mechanism:** x402 exact scheme, USDC on Base mainnet (`eip155:8453`). Unauthenticated/unpaid tool call → HTTP 402 with payment requirements; client retries with `X-PAYMENT` header; server verifies + settles via facilitator, then serves.
- **Facilitator:** Coinbase CDP facilitator (free tier). Abstract behind an interface so it's swappable (Cloudflare's facilitator when Monetization Gateway access lands).
- **Dynamic quoting:** price computed per request and returned in the 402 challenge:
  - `consensus_check` base $0.50 (panel_size=3), $1.50 (panel_size=5), +$0.50 surcharge if `content`+`context` > 8k tokens.
  - Quote includes a short-lived (5 min) quote token so the settled amount must match the quoted request.
- **Testnet flag:** `NETWORK=base-sepolia` env for dev; mainnet for launch.

## 4. x402 integration path

1. Worker built on **Hono**; use the official **`x402-hono` middleware** (Coinbase) for the payment challenge/verify/settle cycle. If the MCP transport route can't share middleware cleanly, implement the 402 handshake inside the paid tool handlers directly using `x402` core packages — the MCP-over-streamable-HTTP + per-tool payment pattern should follow whatever Cloudflare's Agents SDK x402 docs currently prescribe (`developers.cloudflare.com/agents/tools/payments/x402/` — READ THIS FIRST, it was updated June 2026 and post-dates training data).
2. MCP server: Cloudflare's `agents` SDK / `McpAgent` class, streamable HTTP transport, stateless where possible.
3. Settlement receipts logged (tx hash, payer address, amount, request_id) — this is the demand-proof dataset.

## 5. Panel + synthesis pipeline (the actual product)

- Panel calls run in parallel with a 60s ceiling; degrade gracefully (verdict from 2/3 models is returned with `panel_degraded: true` and an automatic 50% price refund note — refund itself is Phase 2; for MVP just flag it).
- Vendor diversity is mandatory: never two models from the same vendor in a 3-panel.
- Synthesis pass: one additional model call that consumes the raw panel outputs and emits the structured verdict JSON (schema-enforced). The synthesis prompt is the crown jewel — keep it in a versioned `prompts/` directory, log prompt version with every request_id.
- Every request/response pair (minus payer identity) stored in D1 for the eval flywheel.

## 6. Project structure

```
veristat/
├── wrangler.jsonc            # Worker config, D1 binding, secrets refs
├── src/
│   ├── index.ts              # Hono app, routes, x402 middleware wiring
│   ├── mcp/
│   │   ├── server.ts         # McpAgent, tool registration
│   │   └── schemas.ts        # zod schemas for tool IO
│   ├── payments/
│   │   ├── x402.ts           # challenge construction, verify/settle via facilitator
│   │   └── quoting.ts        # dynamic price computation + quote tokens
│   ├── panel/
│   │   ├── providers.ts      # anthropic/openai/google clients (API keys as Worker secrets)
│   │   ├── orchestrator.ts   # parallel fan-out, timeout, degradation
│   │   └── synthesis.ts      # verdict synthesis
│   ├── prompts/              # versioned panel + synthesis prompts
│   └── logging.ts            # D1 writes: settlements, requests, eval data
├── migrations/               # D1 schema
├── test/                     # vitest; includes a mock facilitator
└── README.md                 # includes Bazaar + MCP registry listing metadata
```

## 7. Stubbed vs live (MVP)

**LIVE:**
- `consensus_check` with panel_size=3 (Claude Sonnet-tier, GPT current mid-tier, Gemini current mid-tier — pick by cost/latency at build time), verify mode
- x402 402 → verify → settle, mainnet USDC, dynamic quoting
- `get_sample_verdict` free tool
- D1 logging of settlements + request/response pairs
- Deployment + listing metadata files for Coinbase Bazaar and official MCP registry (`server.json`)

**STUBBED:**
- `research_fanout` / `get_research_result` (registered, returns NOT_AVAILABLE)
- panel_size=5 and adversarial mode (accept the params, but MVP may hard-route to 3-panel verify — decide at build time based on effort; if cheap, go live)
- Automatic refunds on degraded panels (flag only)
- Any dashboard/UI (none — logs + a `wrangler d1` query script are the dashboard)
- Cloudflare facilitator / Monetization Gateway (interface exists, implementation waits on waitlist access)

**Ship gate:** deployed to mainnet, one successful end-to-end paid call from a wallet that is not the deployer's, listed in both indexes.

## 8. Runtime constraints (verified against the live Cloudflare account + docs, 2026-07-10)

- Account is greenfield: 0 Workers, 0 D1 databases, 0 KV namespaces. No naming or binding conflicts; assume Workers **Free** plan until upgraded.
- **Upgrade to Workers Paid ($5/mo) before the first mainnet paid call — non-negotiable.** Free plan caps CPU at 10ms/request; parsing and schema-validating 3–5 large model payloads can brush that, and an Error 1102 kill *after* x402 settlement means charging a wallet and returning nothing, with no refund mechanism in the MVP. Paid = 30s CPU default (configurable to 5 min via `limits.cpu_ms`).
- Set explicitly in wrangler.jsonc: `"limits": { "cpu_ms": 30000, "subrequests": 100 }` — a consensus_check uses ~5–8 subrequests (panel + facilitator verify/settle + D1); cap low as a runaway guard.
- Wall-clock is safe: no duration limit while the client stays connected, and individual subrequests have no time limit — the 60s panel ceiling works over streamable HTTP. Do not rely on `ctx.waitUntil` for anything payment-critical (30s cap after response).
- Monetization Gateway is not in Cloudflare's public docs corpus and no management API is exposed — waitlist-only remains correct. Join via the announcement post; do not block on it. Coinbase facilitator stays the launch path.

## 9. The thing most likely to kill this

**Try-then-inline.** A harness builder pays for ten calls, likes the method, and rebuilds it internally with their own API keys — it is, mechanically, prompts plus parallel HTTP calls. Nothing stops this.

What has to be true for the business to work anyway: (1) the synthesis verdict must be *visibly better* than a naive fan-out — measurably better calibration, sharper contradiction-surfacing — and keep improving from the eval data only this server accumulates; (2) the convenience premium must hold — for most buyers, one x402 call with no vendor accounts, no key rotation, no prompt maintenance is genuinely cheaper than owning a verification subsystem at anything under ~10k calls/month; and (3) neutrality must matter — an in-house checker sharing keys, config, and org habits with the thing it checks is not independent, and buyers doing high-stakes actions have to care about that. If 30 days post-listing there are fewer than 10 organic paying wallets, the demand thesis — not the implementation — is what failed; write that down and stop.
