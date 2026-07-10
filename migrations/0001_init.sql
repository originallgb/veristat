-- Settlement receipts: the demand-proof dataset
CREATE TABLE IF NOT EXISTS settlements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  request_id TEXT NOT NULL,
  tx_hash TEXT,
  payer TEXT,
  amount_usd REAL NOT NULL,
  network TEXT NOT NULL,
  tool TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_settlements_request ON settlements (request_id);

-- Request/response pairs (minus payer identity): the eval flywheel
CREATE TABLE IF NOT EXISTS requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  request_id TEXT NOT NULL UNIQUE,
  tool TEXT NOT NULL,
  mode TEXT NOT NULL,
  panel_size INTEGER NOT NULL,
  prompt_version TEXT NOT NULL,
  synthesis_version TEXT NOT NULL,
  input_json TEXT NOT NULL,
  panel_json TEXT NOT NULL,
  verdict_json TEXT NOT NULL,
  degraded INTEGER NOT NULL DEFAULT 0,
  total_latency_ms INTEGER NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_requests_created ON requests (created_at);
