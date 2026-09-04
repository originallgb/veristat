# ADR 0004: Zero-Toxic-Waste Privacy and Retention Policy

## Status
Accepted

## Context
Veristat processes sensitive inputs (claims, answers, plans, code changes) for verification via external LLM panels. In the MVP phase, we stored raw inputs, panel responses, and synthesized verdicts in a D1 database.
This poses a significant privacy risk and creates a toxic data waste problem, as the requests table becomes a high-value target containing arbitrary proprietary code and content from users.

## Decision
We adopt a "zero-toxic-waste" privacy policy for launch. 
1. The D1 `requests` table will no longer store raw text (`input_json`, `panel_json`, `verdict_json`).
2. We replace raw text persistence with aggregate metrics and cryptographic hashes. We will only store:
   - `input_hash`: SHA-256 hash of the input payload.
   - `verdict_label`: The high-level outcome (e.g., "contested", "verified").
   - `consensus_score`: Numeric score of consensus.
   - `total_tokens`: Total tokens consumed.
   - `model_count`: Number of models that successfully participated.
3. We provide a `deleteRequestData` utility to allow users to completely scrub even the metadata footprint of their requests.

## Consequences
- **Positive:** Eliminates the risk of leaking sensitive user data from our database. Lowers compliance burdens. Appeals to privacy-conscious users.
- **Negative:** We lose the ability to retrospectively debug specific failed verifications by looking at the exact text that caused the issue, or to build a dataset for fine-tuning based on user traffic. We rely purely on aggregate telemetry.

> [!WARNING]
> `migrations/0003_privacy_retention.sql` permanently drops raw user text columns (`input_json`, `panel_json`, `verdict_json`). Operators must take a remote D1 backup (e.g. `npx wrangler d1 export veristat --remote --output backup.sql`) before applying it in environments with historical data.
