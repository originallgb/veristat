# Buyer-Facing Launch Kit & First-Ten Outreach Pack

Issue #16 Specification & Implementation Plan.  
Philosophy: Ruthless minimalism (Ponytail ethos). Zero marketing fluff, high signal-to-noise, strict technical truth, and explicit boundary disclosures.

All external submissions, directory registrations, pull requests, and outreach messages require explicit human operator approval before execution.

---

## 1. Directory & Catalog Listings Copy

All text below is calibrated to exact platform schemas and limits.

### Official MCP Registry (`server.json` & Catalog View)
- **Registry Namespace**: `io.github.originallgb/veristat`
- **Transport**: `streamable-http` (`https://veristat.grant-23a.workers.dev/mcp`)
- **Schema**: `https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json`

#### Short Description (`server.json:description`)
```text
Cross-vendor AI panel that verifies claims and drafts with structured consensus verdicts.
```
- **Character Count**: 89 characters (Limit: <= 100 chars).

#### Full Description (Catalog Detail View)
```text
Veristat provides cross-vendor decision review for high-stakes agent workflows. Instead of correlated self-grading, inputs are evaluated concurrently across a heterogeneous panel of frontier models (Anthropic, OpenAI, Google) followed by a structured synthesis pass. Emits schema-enforced consensus scores, agreements, contradictions, and dissents via streamable HTTP. Settles per-request at $0.50 USDC on Base via x402. Zero raw text stored (ADR-0004 SHA-256 hashed). Free sample verdict included.
```
- **Character Count**: 496 characters (Limit: <= 500 chars).

---

### awesome-x402 (Markdown PR Table Row)
Target File: `README.md` (Services / Tools Table)

```markdown
| [Veristat](https://github.com/originallgb/veristat) | Cross-vendor AI consensus panel (Anthropic + OpenAI + Google) for high-stakes agent decisions. Emits structured verdicts. | $0.50 USDC (Base) |
```
- **Description Column Length**: 123 characters.

---

### Smithery (`smithery.yaml` & CLI Snippet)

#### Configuration (`smithery.yaml`)
```yaml
startCommand:
  type: streamable-http
  url: https://veristat.grant-23a.workers.dev/mcp
```

#### Install / Run Snippet
```bash
npx -y @smithery/cli install io.github.originallgb/veristat --client claude
```

---

### Glama.ai Listing

- **Title**: Veristat
- **Subtitle**: Cross-vendor AI consensus panel for high-stakes agent decisions
  - *Subtitle Length*: 65 characters.
- **Markdown Description**:
```markdown
Veristat gives autonomous agents a second, independent opinion before executing irreversible actions.

Instead of self-grading against the generating model, Veristat fans inputs to an independent, cross-vendor panel of frontier models (Anthropic, OpenAI, and Google) with an Anthropic synthesis pass.

### Features
- **Tools**: `consensus_check` (paid verification), `get_sample_verdict` (free discovery).
- **Output**: Schema-enforced JSON with `verdict` (`verified`, `contested`, `inconclusive`), `consensus_score`, agreements, per-model contradictions, and dissent.
- **Payment**: $0.50 USDC per check on Base via x402 protocol (EIP-3009 transfer authorization). No subscriptions or API keys required.
- **Zero-Toxic-Waste Privacy (ADR-0004)**: Inputs are SHA-256 hashed. Zero raw input or verdict text is stored in server databases.
```
- **Markdown Description Length**: 874 characters.

---

### PulseMCP Listing

- **Title**: Veristat
- **Tagline**: Cross-vendor decision review for high-stakes agent actions
  - *Tagline Length*: 58 characters.
- **Transport**: `streamable-http` (`https://veristat.grant-23a.workers.dev/mcp`)
- **Overview**:
```markdown
Veristat provides multi-vendor consensus verification for AI agents over MCP. Every request evaluates submitted content concurrently across Anthropic, OpenAI, and Google frontier models, synthesizing findings into explicit points of agreement, contradiction, and dissent. Billed per-request at $0.50 USDC on Base using x402. No vendor API keys needed.
```
- **Overview Length**: 352 characters.

---

### CDP Bazaar & x402scan

Used in the Bazaar resource declaration (`extensions.bazaar.info.description`) and x402scan catalog entry:

```text
Cross-vendor decision review for high-stakes agent actions. Evaluates claims, plans, and code across an independent 3-model panel (Anthropic + OpenAI + Google) with an Anthropic synthesis pass. Returns structured verdicts: consensus score, agreements, contradictions, and model dissent. $0.50 USDC per check on Base via x402 exact scheme. Zero-Toxic-Waste privacy: inputs SHA-256 hashed, zero raw text stored. Call get_sample_verdict free or consensus_check to verify.
```
- **Character Count**: 466 characters (Limit: strictly <= 500 chars).

---

## 2. Approved Positioning & Boundary Disclosures

### Core Value Line
> "Cross-vendor decision review for high-stakes agent outputs."

A model cannot reliably grade its own high-stakes conclusions. Correlated failure modes across models from the same vendor produce blind spots. Veristat breaks correlation by enforcing a strict heterogeneous 3-model panel plus an independent synthesis pass.

### Technical Architecture
- **Panel Composition**: Exactly 3 frontier models from 3 independent vendors:
  - Anthropic (`claude-sonnet`)
  - OpenAI (`gpt-mini` / frontier peer)
  - Google (`gemini-flash` / frontier peer)
  *(Never two models from the same vendor).*
- **Synthesis Pass**: Anthropic synthesis step that processes raw panel evaluations into a schema-enforced JSON verdict.
- **Timeout**: Strict 60-second ceiling across parallel panel evaluation.
- **Degraded Execution**: If a panelist drops or times out, the synthesis returns a verdict flagged `panel_degraded` with remaining models.

### Pricing & Settlement Contract
- **Base Fee**: Flat $0.50 USDC on Base (`eip155:8453`) or Base Sepolia (`eip155:84532`).
- **Payment Scheme**: `x402` exact scheme (EIP-3009 `transferWithAuthorization`). Gasless for the buyer; settled by facilitator.
- **Panel Size Compatibility**: `panel_size: 5` is accepted in the tool input schema for backward compatibility, but is explicitly quoted and fulfilled as the 3-panel check ($0.50).
- **Large-Input Surcharge**: +$0.50 when input content plus context exceeds ~8,000 tokens.
- **Payee Address**: Pin checked against payment challenge requirements.

### Privacy Policy (ADR-0004 Zero-Toxic-Waste)
- **Zero Raw Text Persistence**: Prompt text, code snippets, claims, panel reasoning, and full verdict text are **never written to persistent disk or D1 storage**.
- **Cryptographic Hashing**: User inputs are hashed via SHA-256 (`input_hash`) for telemetry and deduplication.
- **Telemetry Only**: D1 records only operational metadata: `input_hash`, `verdict_label` (`verified` | `contested` | `inconclusive`), numeric `consensus_score`, token counts, latency, and `model_count`.
- **Scrubbing**: The `deleteRequestData` utility allows purging operational metadata records by `input_hash` or `request_id`.

### Negative Boundaries (What Veristat Is NOT)
- **No Live 5-Model Panel**: Currently fulfilled and billed strictly as 3-model panels.
- **No Automatic Refunds**: Settlement occurs only after a successful verdict synthesis. If the panel fails, x402 settlement is not executed. Settled payments are non-refundable.
- **No Signed Certificates**: Verdicts are structured JSON execution results; they are not cryptographic validity proofs or legal attestations.
- **No Live Web Search / Citations**: `research_fanout` is explicitly `NOT_AVAILABLE` (stubbed). Veristat reviews logic, safety, code, and claims against model frontier reasoning, not live internet browsing.

---

## 3. Three Focused Agent Integration Recipes

All snippets use TypeScript, `@modelcontextprotocol/sdk`, and standard x402 handling via `@x402/evm` / `agents/x402`.

### Recipe 1: Pre-Trade Risk Review (Autonomous DeFi / Financial Agents)
Runs before signing an on-chain transaction or executing a trade strategy.

```typescript
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { withX402Client } from "agents/x402";
import { toClientEvmSigner } from "@x402/evm";
import { privateKeyToAccount } from "viem/accounts";

interface TradePlan {
  pair: string;
  action: "BUY" | "SELL";
  expectedSlippageBps: number;
  routeDetails: string;
}

interface ConsensusVerdict {
  verdict: "verified" | "contested" | "inconclusive";
  consensus_score: number;
  contradictions: Array<{ point: string; positions: Array<{ stance: string; models: string[] }> }>;
  synthesis: string;
}

export async function verifyPreTradeSafety(trade: TradePlan, buyerPrivateKey: `0x${string}`): Promise<boolean> {
  const transport = new StreamableHTTPClientTransport(
    new URL("https://veristat.grant-23a.workers.dev/mcp")
  );
  const client = new Client({ name: "defi-guard-agent", version: "1.0.0" });
  await client.connect(transport);

  try {
    const signer = toClientEvmSigner(privateKeyToAccount(buyerPrivateKey));
    const paidClient = withX402Client(client, { signer });

    const response = await paidClient.callTool({
      name: "consensus_check",
      arguments: {
        content: JSON.stringify(trade, null, 2),
        question: "Does this routing logic or liquidity assumption expose the position to sandwich attacks or extreme slippage?"
      }
    });

    const result = JSON.parse((response.content[0] as { text: string }).text) as ConsensusVerdict;

    if (result.verdict === "contested" || result.consensus_score < 0.70) {
      console.warn("Trade rejected by cross-vendor consensus:", result.synthesis);
      for (const contradiction of result.contradictions) {
        console.warn(`Dispute: ${contradiction.point}`);
      }
      return false;
    }

    return true;
  } finally {
    await client.close();
  }
}
```

---

### Recipe 2: Risky Database Migration Safety (Autonomous DevOps / Coding Agents)
Evaluates SQL DDL plans before running them against production databases.

```typescript
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { withX402Client } from "agents/x402";
import { toClientEvmSigner } from "@x402/evm";
import { privateKeyToAccount } from "viem/accounts";

interface MigrationReviewResult {
  isSafe: boolean;
  verdict: string;
  warnings: string[];
  recommendation: string;
}

export async function reviewMigration(
  migrationSql: string,
  tableStats: string,
  buyerPrivateKey: `0x${string}`
): Promise<MigrationReviewResult> {
  const transport = new StreamableHTTPClientTransport(
    new URL("https://veristat.grant-23a.workers.dev/mcp")
  );
  const client = new Client({ name: "devops-gate-agent", version: "1.0.0" });
  await client.connect(transport);

  try {
    const signer = toClientEvmSigner(privateKeyToAccount(buyerPrivateKey));
    const paidClient = withX402Client(client, { signer });

    const response = await paidClient.callTool({
      name: "consensus_check",
      arguments: {
        content: `SQL:\n${migrationSql}\n\nTABLE CONTEXT:\n${tableStats}`,
        question: "Will this migration cause exclusive table locks, write downtime, or irreversible schema corruption during peak traffic?"
      }
    });

    const data = JSON.parse((response.content[0] as { text: string }).text);
    const isSafe = data.verdict === "verified" && data.consensus_score >= 0.85;

    const warnings = (data.contradictions || []).map(
      (c: { point: string }) => c.point
    );

    return {
      isSafe,
      verdict: data.verdict,
      warnings,
      recommendation: data.synthesis
    };
  } finally {
    await client.close();
  }
}
```

---

### Recipe 3: Factual Consensus Verification (Research & Reporting Agents)
Checks core quantitative or factual assertions against frontier models before publishing or acting on report summaries.

```typescript
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { withX402Client } from "agents/x402";
import { toClientEvmSigner } from "@x402/evm";
import { privateKeyToAccount } from "viem/accounts";

export async function verifyResearchClaim(
  claimText: string,
  sourceContext: string,
  buyerPrivateKey: `0x${string}`
): Promise<{ consensusScore: number; passes: boolean; dissentSummary: string }> {
  const transport = new StreamableHTTPClientTransport(
    new URL("https://veristat.grant-23a.workers.dev/mcp")
  );
  const client = new Client({ name: "research-verifier-agent", version: "1.0.0" });
  await client.connect(transport);

  try {
    const signer = toClientEvmSigner(privateKeyToAccount(buyerPrivateKey));
    const paidClient = withX402Client(client, { signer });

    const response = await paidClient.callTool({
      name: "consensus_check",
      arguments: {
        content: `Claim: ${claimText}\nContext: ${sourceContext}`,
        question: "Is this claim logically sound, mathematically consistent, and free of vendor hallucination?"
      }
    });

    const parsed = JSON.parse((response.content[0] as { text: string }).text);

    return {
      consensusScore: parsed.consensus_score,
      passes: parsed.verdict === "verified",
      dissentSummary: (parsed.dissent || []).map((d: { position: string }) => d.position).join("; ")
    };
  } finally {
    await client.close();
  }
}
```

---

## 4. No-Spend Quickstart

Buyers can verify the endpoint, inspect the exact data schema, and test x402 payment requirements in under 5 minutes without a wallet, private key, or spending funds.

Reference Implementation: [`examples/node-buyer/unpaid.mjs`](file:///d:/Repos/originallgb/veristat/examples/node-buyer/unpaid.mjs)

### Step 1: Clone and Install
```bash
git clone https://github.com/originallgb/veristat.git
cd veristat/examples/node-buyer
npm ci
```

### Step 2: Run Unpaid Verification
```bash
npm run unpaid
```

### What This Proves (Zero Financial Risk)
1. **MCP Initialization**: Handshakes with `https://veristat.grant-23a.workers.dev/mcp` over `streamable-http`.
2. **Tool Discovery**: Validates presence of `consensus_check` and `get_sample_verdict`.
3. **Free Sample Inspection**: Invokes `get_sample_verdict` without billing. Returns the current three-panel methodology, service version, price card ($0.50 / 3-panel fulfilled), and a complete sample verdict.
4. **Unpaid 402 Challenge Validation**: Sends a synthetic request to `consensus_check`. Asserts that the server returns an x402 HTTP 402 challenge with:
   - Scheme: `exact`
   - Network: Base Sepolia (`eip155:84532`)
   - Asset: USDC (`0x036CbD53842c5426634e7929541eC2318f3dCF7e`)
   - Amount: `500000` (0.50 USDC)
   - Payee: `0x86CdAe1A22458442BaB9E10216a7E96b606d3635`
   - Bazaar Extension: MCP transport metadata

The process terminates with exit code 0 on contract compliance. It cannot spend money because no wallet or private key is configured.

---

## 5. One Contested Synthetic Sample

Sourced directly from [`src/mcp/sample_verdict.ts`](file:///d:/Repos/originallgb/veristat/src/mcp/sample_verdict.ts) (`SAMPLE_VERDICT`). Demonstrates how a contested operational question splits a cross-vendor panel.

### Input
- **Content**: `"A migration plan says CREATE INDEX without CONCURRENTLY is safe during peak writes."`
- **Question**: `"What operational risk should be checked before approving this claim?"`

### Exact Synthesized JSON Verdict
```json
{
  "verdict": "contested",
  "consensus_score": 0.45,
  "agreements": [
    {
      "point": "The proposed index change will speed up the read path for the stated query pattern.",
      "models_agreeing": 3
    },
    {
      "point": "The migration is reversible if run inside a transaction.",
      "models_agreeing": 2
    }
  ],
  "contradictions": [
    {
      "point": "Whether the migration is safe to run against the live primary during business hours",
      "positions": [
        {
          "stance": "Unsafe: CREATE INDEX without CONCURRENTLY takes an exclusive lock and will block writes on a table this size",
          "models": [
            "anthropic/claude-sonnet",
            "google/gemini-flash"
          ],
          "reasoning": "At ~40M rows the index build will hold a write lock for minutes; the plan does not use CONCURRENTLY or schedule a maintenance window."
        },
        {
          "stance": "Acceptable: table write volume shown in the context is low enough that a brief lock is tolerable",
          "models": [
            "openai/gpt-mini"
          ],
          "reasoning": "The context indicates <5 writes/sec; a short exclusive lock is an inconvenience, not an outage."
        }
      ]
    }
  ],
  "dissent": [
    {
      "model": "google/gemini-flash",
      "position": "The rollback step drops the wrong index name; even if the build succeeds, the runbook as written cannot be reversed cleanly."
    }
  ],
  "panel": [
    {
      "vendor": "anthropic",
      "model": "claude-sonnet"
    },
    {
      "vendor": "openai",
      "model": "gpt-mini"
    },
    {
      "vendor": "google",
      "model": "gemini-flash"
    }
  ],
  "synthesis": "The panel agrees the index will help the read path but splits on operational safety: two of three models flag that building the index without CONCURRENTLY will lock writes on a large table, and one model independently found that the rollback step references the wrong index name. Recommendation: rebuild the plan with CREATE INDEX CONCURRENTLY, fix the rollback target, and re-verify before executing.",
  "request_id": "sample-0000-0000",
  "cost_usd": 0.5
}
```

---

## 6. First-Ten Outreach Pack & Wallet Attribution Rules

### Target Roster: 10 Named Targets Across 3 Segments

| # | Segment | Target | Focus / Hook |
|---|---|---|---|
| 1 | Agent Frameworks | **ElizaOS** (ai16z / eliza) | Verification action plugin for high-stakes agent execution. |
| 2 | Agent Frameworks | **Daydreams Router** | Cross-vendor sanity check for autonomous planner decisions. |
| 3 | Agent Frameworks | **CrewAI Tool Registry** | Reviewer agent tool to prevent hallucinations in research crews. |
| 4 | Agent Frameworks | **LangGraph Templates** | Human-in-the-loop alternative: automatic 3-vendor consensus gate. |
| 5 | Autonomous Coding | **Claude Code Plugin / OpenCode** | Pre-commit / migration safety check via x402 tool plugin. |
| 6 | Autonomous Coding | **Aider** | Multi-vendor sanity check on architectural refactoring proposals. |
| 7 | Autonomous Coding | **Continue.dev** | Context review hook before applying destructive diffs. |
| 8 | Web3 / Crypto Agents | **OttoAI** (Coinbase Bazaar) | Pre-trade risk review for autonomous trading agents. |
| 9 | Web3 / Crypto Agents | **Virtuals Protocol Agents** | Autonomous verification for tokenized AI agent governance actions. |
| 10 | Web3 / Crypto Agents | **Brian AI / Giza** | Cross-checking intent routing and smart contract execution payloads. |

---

### Three Developer-to-Developer Outreach Templates

#### Template 1: For Autonomous Web3 / Trading Agent Builders
```text
Subject: Cross-vendor sanity check for autonomous agent trades (x402 / MCP)

Hey [Name] — saw your work on [Project/Agent].

One recurring failure mode in autonomous trading agents is correlated hallucination: a single model misinterpreting liquidity depth or slippage parameters and executing an irreversible swap.

We built Veristat (MCP server over x402). It runs high-stakes decisions through a 3-vendor panel (Anthropic + OpenAI + Google) with an independent synthesis pass. It returns a structured JSON verdict with explicit points of contradiction and dissent.

It settles at $0.50 USDC on Base per check via x402 (no accounts, no subscriptions, payment is the credential).

You can inspect the free sample verdict and unpaid 402 challenge in 30 seconds with no spend:
git clone https://github.com/originallgb/veristat
cd veristat/examples/node-buyer && npm ci && npm run unpaid

Repo & specs: https://github.com/originallgb/veristat
If you'd like a testnet credit to test live with your agent harness, let me know.
```

#### Template 2: For Autonomous DevOps & Coding Tools
```text
Subject: Independent 3-vendor safety review for agent code/DDL migrations

Hey [Name] — quick question regarding [Tool/Project].

When coding agents generate destructive actions (e.g. database migrations, infrastructure scripts, security rules), self-grading with the same model often misses subtle operational locks (e.g. PostgreSQL CREATE INDEX without CONCURRENTLY).

Veristat is a lightweight MCP tool that fans proposals across three independent frontier models (Claude, GPT, Gemini) to catch vendor-specific blind spots. It produces structured consensus verdicts detailing agreements and specific model dissents.

Key boundaries:
- Flat $0.50 USDC per review on Base via x402.
- ADR-0004 Zero-Toxic-Waste: inputs are SHA-256 hashed; zero raw code or prompt text is stored on the server.
- Streamable HTTP MCP transport.

Code examples & zero-spend test:
https://github.com/originallgb/veristat/blob/main/docs/plans/buyer-facing-launch-kit.md#recipe-2-risky-database-migration-safety-autonomous-devops--coding-agents

Happy to hop on a quick thread or PR an integration snippet if of interest.
```

#### Template 3: For Agent Framework Maintainers
```text
Subject: Cross-vendor consensus tool for [Framework] tool ecosystem

Hey [Name] —

We put together an MCP integration for [Framework] agents that need an un-correlated second opinion before taking high-stakes actions.

Rather than having an agent re-prompt itself, Veristat fans the input across Anthropic, OpenAI, and Google simultaneously and returns a schema-enforced consensus score, agreements, and contradictions.

Integration details:
- Standard MCP streamable HTTP transport (`/mcp`).
- Built-in x402 payment rail ($0.50 USDC on Base), meaning callers need zero API keys for Anthropic/OpenAI/Google.
- Free zero-wallet discovery tool (`get_sample_verdict`) included.

Here is the quickstart and runnable TypeScript recipe:
https://github.com/originallgb/veristat/tree/main/examples/node-buyer

Would you be open to a PR adding Veristat to the community tool / plugin directory?
```

---

### Non-Organic Wallet Attribution Policy
Per `docs/STRATEGY.md`, Veristat enforces a strict ship gate: **10 distinct organic paying wallets within 30 days of listing**.

1. **Known Wallets Tracking (`known_wallets` table in D1)**:
   - All internal, deployer, canary, automated test, and consulting client wallets are registered in D1:
     ```sql
     INSERT INTO known_wallets (address, label, created_at) VALUES ('0x...', 'label', datetime('now'));
     ```
   - Standard labels: `deployer`, `testnet-buyer`, `mainnet-canary`, `operator-rehearsal`, `consulting-dogfood`.
2. **Attribution Filter**:
   - `scripts/dashboard.mjs` executes queries that exclude any address matching `known_wallets`:
     ```sql
     SELECT COUNT(DISTINCT payer) as organic_wallets 
     FROM settlements 
     WHERE payer NOT IN (SELECT address FROM known_wallets)
       AND settled_at >= datetime('now', '-30 days');
     ```
3. **Purity of Ship Gate**:
   - Consulting clients where Veristat operators configure or fund the wallet are tagged `consulting-dogfood` and strictly excluded from the 10-wallet organic metric.
   - Only autonomous, third-party buyers count toward satisfying the launch gate.
   - If fewer than 10 organic wallets pay within 30 days of public listing: the kill condition triggers, further spend stops, and a postmortem is written.

---

## 7. Directory Correction, Deprecation & Rollback Text

Templates for updating directory metadata, issuing incident advisories, or rolling back service versions.

### Listing Updates Template (Registry / Directory Schema Updates)
```text
[Update] Veristat MCP Server (io.github.originallgb/veristat)

Release: v1.0.0
Endpoint: https://veristat.grant-23a.workers.dev/mcp
Transport: streamable-http

Summary of Changes:
- Discovery: Updated get_sample_verdict response card and methodology summary.
- Contract: Aligned consensus_check pricing at $0.50 USDC on Base (EIP-3009).
- Privacy: Formalized ADR-0004 Zero-Toxic-Waste privacy disclosure (SHA-256 hashed inputs, zero raw text persisted).
- Compatibility: panel_size=5 accepted for compatibility, fulfilled as 3-panel check.

Repository: https://github.com/originallgb/veristat
Commit: [COMMIT_HASH]
Operator Sign-off: [OPERATOR_NAME / DATE]
```

### Maintenance & Upstream Outage Notice Template
```text
[Notice] Veristat MCP Maintenance / Upstream Outage

Status: Degradation / Maintenance Window
Affected Service: consensus_check (MCP tool)
Time Range: [START_UTC] to [END_UTC]

Details:
One or more upstream frontier model providers (Anthropic / OpenAI / Google) are experiencing elevated error rates or scheduled maintenance.

Fail-Closed Safeguard:
Veristat requires 3 independent vendors to generate a complete consensus verdict.
- Requests unable to assemble a 3-vendor panel will return tool error: "PANEL_UNAVAILABLE".
- In accordance with our payment terms, UNFULFILLED REQUESTS ARE NEVER SETTLED ON-CHAIN. No USDC is deducted from buyer wallets when an outage occurs.

Tracking: Monitor https://veristat.grant-23a.workers.dev/health for live service status.
```

### Deprecation & Rollback Notice Template
```text
[Advisory] Veristat Version Deprecation / Rollback Notice

Affected Version / Endpoint: [VERSION / ENDPOINT_URL]
Effective Date: [DATE]
Replacement Endpoint: https://veristat.grant-23a.workers.dev/mcp

Reason for Action:
[Contract migration / Vulnerability mitigation / Schema version retirement]

Action Required for Buyers:
1. Update MCP client configuration to point to the current endpoint.
2. Verify Base USDC asset contract: 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 (Base Mainnet).
3. If using pinned hashes or schemas, pull updated definitions from https://github.com/originallgb/veristat.

Historical Support:
Old endpoints will return HTTP 410 Gone with a machine-readable redirection header.
```

---

### Mandatory Operator Sign-Off Requirement
> **CRITICAL OPERATIONAL POLICY**:  
> No external pull request, GitHub issue comment, directory submission (Smithery, Glama, PulseMCP, awesome-x402), registry publication (`mcp-publisher publish`), or outreach email/message may be dispatched autonomously.  
> Every external action requires human operator review, verified clean test runs, and explicit signed approval.
