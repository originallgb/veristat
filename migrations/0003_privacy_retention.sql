-- Privacy & Retention: replace raw text persistence with aggregate metrics and hash
CREATE TABLE requests_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  request_id TEXT NOT NULL UNIQUE,
  tool TEXT NOT NULL,
  mode TEXT NOT NULL,
  panel_size INTEGER NOT NULL,
  prompt_version TEXT NOT NULL,
  synthesis_version TEXT NOT NULL,
  input_hash TEXT NOT NULL,
  verdict_label TEXT NOT NULL,
  consensus_score REAL,
  total_tokens INTEGER NOT NULL DEFAULT 0,
  model_count INTEGER NOT NULL DEFAULT 0,
  degraded INTEGER NOT NULL DEFAULT 0,
  total_latency_ms INTEGER NOT NULL,
  created_at TEXT NOT NULL
);

INSERT INTO requests_new (
  id, request_id, tool, mode, panel_size, prompt_version, synthesis_version,
  input_hash, verdict_label, consensus_score, total_tokens, model_count,
  degraded, total_latency_ms, created_at
)
SELECT 
  id, request_id, tool, mode, panel_size, prompt_version, synthesis_version,
  'legacy_unhashed', 'legacy', NULL, 0, 0,
  degraded, total_latency_ms, created_at
FROM requests;

DROP TABLE requests;
ALTER TABLE requests_new RENAME TO requests;
CREATE INDEX IF NOT EXISTS idx_requests_created ON requests (created_at);
