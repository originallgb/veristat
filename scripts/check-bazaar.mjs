// "Are we actually listed?" — poll a facilitator's discovery catalog for our
// resource. Listing is settlement-triggered and rejections can be silent
// (docs/research/bazaar-listing.md), so this is the source of truth, not the
// EXTENSION-RESPONSES header.
//
// Usage:
//   RESOURCE_URL=https://veristat.<subdomain>.workers.dev/mcp node scripts/check-bazaar.mjs
// Env:
//   DISCOVERY_URL  catalog endpoint. Default: CDP Bazaar
//                  https://api.cdp.coinbase.com/platform/v2/x402/discovery/resources
//   RESOURCE_URL   our endpoint URL to look for (exact or same-host match)
//   MAX_PAGES      offset-pagination page cap (default 400 → 40k resources)
//
// The CDP catalog is offset-paginated ({pagination:{limit,offset,total}}) and
// was ~25k resources when this was written — a full negative scan takes a
// few minutes; a positive match exits as soon as it's found.

const DISCOVERY_URL =
  process.env.DISCOVERY_URL ??
  "https://api.cdp.coinbase.com/platform/v2/x402/discovery/resources";
const RESOURCE_URL = process.env.RESOURCE_URL;
const MAX_PAGES = Number(process.env.MAX_PAGES ?? 400);
if (!RESOURCE_URL) {
  console.error("Set RESOURCE_URL to the deployed endpoint (e.g. https://veristat.<subdomain>.workers.dev/mcp)");
  process.exit(1);
}
const host = new URL(RESOURCE_URL).host;

const found = [];
const LIMIT = 100;
let offset = 0;
let total = Infinity;
let scanned = 0;
let pages = 0;

while (offset < total && pages < MAX_PAGES && found.length === 0) {
  const url = new URL(DISCOVERY_URL);
  url.searchParams.set("limit", String(LIMIT));
  url.searchParams.set("offset", String(offset));
  const res = await fetch(url);
  if (!res.ok) {
    console.error(`discovery endpoint ${res.status} ${res.statusText} — ${(await res.text()).slice(0, 300)}`);
    process.exit(2);
  }
  const body = await res.json();
  const items = body.items ?? [];
  total = body.pagination?.total ?? offset + items.length;
  scanned += items.length;
  for (const item of items) {
    const r = String(item.resource ?? "");
    if (r === RESOURCE_URL || r.includes(host)) found.push(item);
  }
  if (items.length === 0) break;
  offset += items.length;
  pages++;
  if (pages % 25 === 0)
    console.log(`  …scanned ${scanned}/${total}`);
}

console.log(`scanned ${scanned}/${Number.isFinite(total) ? total : "?"} resources at ${DISCOVERY_URL}`);
if (found.length === 0) {
  console.log(`NOT LISTED: ${RESOURCE_URL}`);
  console.log("Reminders: listing requires a *settled* payment through this facilitator");
  console.log("with the discovery extension accepted, and drops after 30 days of inactivity.");
  process.exit(1);
}
console.log(`LISTED (${found.length} entr${found.length === 1 ? "y" : "ies"}):`);
for (const f of found) console.log(JSON.stringify(f, null, 2).slice(0, 1500));
