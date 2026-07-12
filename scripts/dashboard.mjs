// The dashboard is a script (spec §7: no UI). Prints settlement volume,
// request health, and the ship-gate metric: distinct ORGANIC paying wallets
// (excluding our own, tracked in known_wallets — docs/STRATEGY.md).
//
// Usage: node scripts/dashboard.mjs [--local]   (default: --remote D1)
import { execFileSync } from "node:child_process";

const scope = process.argv.includes("--local") ? "--local" : "--remote";

const q = (sql) => {
  const out = execFileSync(
    "npx",
    ["wrangler", "d1", "execute", "veristat", scope, "--json", "--command", sql],
    { encoding: "utf8" }
  );
  return JSON.parse(out)[0]?.results ?? [];
};

const money = q(`SELECT count(*) AS settlements,
                        round(coalesce(sum(amount_usd),0), 2) AS gross_usd,
                        count(DISTINCT payer) AS distinct_payers
                 FROM settlements`);
const organic = q(`SELECT count(DISTINCT payer) AS organic_payers
                   FROM settlements
                   WHERE payer IS NOT NULL
                     AND lower(payer) NOT IN (SELECT address FROM known_wallets)`);
const organic30 = q(`SELECT count(DISTINCT payer) AS organic_payers_30d
                     FROM settlements
                     WHERE payer IS NOT NULL
                       AND lower(payer) NOT IN (SELECT address FROM known_wallets)
                       AND created_at >= datetime('now', '-30 days')`);
const health = q(`SELECT count(*) AS requests, coalesce(sum(degraded),0) AS degraded,
                         coalesce(round(avg(total_latency_ms)),0) AS avg_latency_ms
                  FROM requests`);
const recent = q(`SELECT created_at, tool, amount_usd, payer, tx_hash
                  FROM settlements ORDER BY id DESC LIMIT 10`);
const known = q(`SELECT address, label FROM known_wallets`);

console.log(`=== veristat dashboard (${scope.slice(2)}) ===\n`);
console.log("money   :", JSON.stringify(money[0]));
console.log("organic :", JSON.stringify({ ...organic[0], ...organic30[0] }),
  "→ ship gate: 10 organic payers in 30d");
console.log("health  :", JSON.stringify(health[0]));
console.log(`known wallets (${known.length}):`, known.map((w) => `${w.label}=${w.address.slice(0, 10)}…`).join(", ") || "none registered!");
if (known.length === 0)
  console.log("  ⚠ register your own wallets or the organic count is inflated:");
console.log(`  register: npx wrangler d1 execute veristat ${scope} --command "INSERT OR IGNORE INTO known_wallets VALUES ('0x…lowercased…','deployer',datetime('now'))"`);
console.log("\nrecent settlements:");
for (const r of recent)
  console.log(` ${r.created_at}  $${r.amount_usd}  ${r.tool}  ${String(r.payer).slice(0, 12)}…  ${String(r.tx_hash).slice(0, 18)}…`);
if (recent.length === 0) console.log("  (none yet)");
