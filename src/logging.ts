/**
 * D1 writes: settlement receipts (demand-proof dataset, spec §4.3) and
 * request/response pairs minus payer identity (eval flywheel, spec §5).
 * Logging must never fail a paid request — errors are swallowed and logged.
 */

export interface SettlementRecord {
  requestId: string;
  txHash?: string;
  payer?: string;
  amountUsd: number;
  network: string;
  tool: string;
}

export interface RequestRecord {
  requestId: string;
  tool: string;
  mode: string;
  panelSize: number;
  promptVersion: string;
  synthesisVersion: string;
  inputJson: string; // content/context/question — no payer identity
  panelJson: string; // raw panel outputs + latencies
  verdictJson: string;
  degraded: boolean;
  totalLatencyMs: number;
}

export async function logSettlement(db: D1Database, r: SettlementRecord): Promise<void> {
  try {
    await db
      .prepare(
        `INSERT INTO settlements (request_id, tx_hash, payer, amount_usd, network, tool, created_at)
         VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`
      )
      .bind(r.requestId, r.txHash ?? null, r.payer ?? null, r.amountUsd, r.network, r.tool)
      .run();
  } catch (e) {
    console.error("settlement log failed", r.requestId, e);
  }
}

export async function logRequest(db: D1Database, r: RequestRecord): Promise<void> {
  try {
    await db
      .prepare(
        `INSERT INTO requests (request_id, tool, mode, panel_size, prompt_version, synthesis_version,
            input_json, panel_json, verdict_json, degraded, total_latency_ms, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
      )
      .bind(
        r.requestId, r.tool, r.mode, r.panelSize, r.promptVersion, r.synthesisVersion,
        r.inputJson, r.panelJson, r.verdictJson, r.degraded ? 1 : 0, r.totalLatencyMs
      )
      .run();
  } catch (e) {
    console.error("request log failed", r.requestId, e);
  }
}
