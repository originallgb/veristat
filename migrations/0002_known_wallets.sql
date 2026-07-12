-- Our own wallets (deployer, test, canary), excluded from the organic-payer
-- count that decides the ship gate (docs/STRATEGY.md: 10 organic wallets/30d).
CREATE TABLE IF NOT EXISTS known_wallets (
  address TEXT PRIMARY KEY,       -- lowercased 0x address
  label TEXT NOT NULL,            -- e.g. "deployer", "testnet-buyer", "mainnet-canary"
  created_at TEXT NOT NULL
);
