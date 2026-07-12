// Generate a throwaway buyer wallet for x402 testnet e2e (docs/TESTING.md).
// The key lands in gitignored .wallets/<name>.key; fund the printed address
// with base-sepolia USDC. No ETH is needed — the exact scheme is EIP-3009
// transferWithAuthorization and the facilitator pays gas.
//
// Usage: node scripts/make-test-wallet.mjs [name]   (default: buyer)
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

const name = (process.argv[2] ?? "buyer").replace(/[^a-z0-9_-]/gi, "");
const path = `.wallets/${name}.key`;
if (existsSync(path)) {
  console.error(`${path} already exists — pick another name or delete it first.`);
  process.exit(1);
}

const pk = generatePrivateKey();
const account = privateKeyToAccount(pk);
mkdirSync(".wallets", { recursive: true });
writeFileSync(path, pk + "\n", { mode: 0o600 });

console.log(`wallet "${name}" (testnet-only, throwaway)`);
console.log(`  address: ${account.address}`);
console.log(`  key:     ${path}  (gitignored — never commit, never reuse on mainnet)`);
console.log(`
Fund it (USDC only, no ETH needed):
  1. https://faucet.circle.com → Base Sepolia → ${account.address}
     (20 USDC per address per 2 hours)
  2. Then: BUYER_PRIVATE_KEY=$(cat ${path}) node scripts/e2e.mjs
`);
