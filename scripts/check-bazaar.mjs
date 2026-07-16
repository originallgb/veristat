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
//   PAY_TO_ADDRESS optional merchant lookup before the full catalog scan
//   NETWORK        optional CAIP-2 filter for the semantic-search check
//   MAX_PAGES      offset-pagination page cap (default 400 → 40k resources)
//
// The CDP catalog is offset-paginated ({pagination:{limit,offset,total}}) and
// was ~25k resources when this was written — a full negative scan takes a
// few minutes; a positive match exits as soon as it's found.

const DISCOVERY_URL =
  process.env.DISCOVERY_URL ??
  "https://api.cdp.coinbase.com/platform/v2/x402/discovery/resources";
const RESOURCE_URL = process.env.RESOURCE_URL;
const PAY_TO_ADDRESS = process.env.PAY_TO_ADDRESS;
const NETWORK = process.env.NETWORK;
const MAX_PAGES = Number(process.env.MAX_PAGES ?? 400);
if (!RESOURCE_URL) {
  console.error("Set RESOURCE_URL to the deployed endpoint (e.g. https://veristat.<subdomain>.workers.dev/mcp)");
  process.exit(1);
}
const host = new URL(RESOURCE_URL).host;
const normalizedResource = new URL(RESOURCE_URL).toString();
const exactResourceMatch = (item) => {
  try {
    return new URL(String(item.resource ?? "")).toString() === normalizedResource;
  } catch {
    return false;
  }
};

// The merchant endpoint is a fast, authoritative lookup when the receiving
// address is known. Keep the full scan as a second source because it also
// catches records whose merchant attribution is delayed.
if (PAY_TO_ADDRESS) {
  const merchantUrl = new URL("merchant", DISCOVERY_URL);
  merchantUrl.searchParams.set("payTo", PAY_TO_ADDRESS);
  const merchantRes = await fetch(merchantUrl);
  if (!merchantRes.ok) {
    console.error(`merchant endpoint ${merchantRes.status} ${merchantRes.statusText} — ${(await merchantRes.text()).slice(0, 300)}`);
    process.exit(2);
  }
  const merchantBody = await merchantRes.json();
  const merchantItems = merchantBody.resources ?? merchantBody.items ?? [];
  const merchantMatches = merchantItems.filter(exactResourceMatch);
  console.log(`merchant lookup: ${merchantItems.length} resource(s) for ${PAY_TO_ADDRESS}`);
  if (merchantMatches.length > 0) {
    console.log(`LISTED (${merchantMatches.length} merchant entr${merchantMatches.length === 1 ? "y" : "ies"}):`);
    for (const match of merchantMatches)
      console.log(JSON.stringify(match, null, 2).slice(0, 1500));
    process.exit(0);
  }
}

if (PAY_TO_ADDRESS || NETWORK) {
  const searchUrl = new URL("search", DISCOVERY_URL);
  searchUrl.searchParams.set("query", "veristat multi-model verification consensus_check");
  if (PAY_TO_ADDRESS) searchUrl.searchParams.set("payTo", PAY_TO_ADDRESS);
  if (NETWORK) searchUrl.searchParams.set("network", NETWORK);
  searchUrl.searchParams.set("limit", "20");
  const searchRes = await fetch(searchUrl);
  if (!searchRes.ok) {
    console.error(`search endpoint ${searchRes.status} ${searchRes.statusText} — ${(await searchRes.text()).slice(0, 300)}`);
    process.exit(2);
  }
  const searchBody = await searchRes.json();
  const searchItems = searchBody.resources ?? [];
  const searchMatches = searchItems.filter(exactResourceMatch);
  console.log(`semantic search: ${searchItems.length} candidate(s), ${searchMatches.length} exact match(es)`);
  if (searchMatches.length > 0) {
    console.log(`LISTED (${searchMatches.length} search entr${searchMatches.length === 1 ? "y" : "ies"}):`);
    for (const match of searchMatches)
      console.log(JSON.stringify(match, null, 2).slice(0, 1500));
    process.exit(0);
  }
}

const found = [];
const LIMIT = 1000;
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
    if (exactResourceMatch(item)) found.push(item);
  }
  if (items.length === 0) break;
  offset += items.length;
  pages++;
  if (pages % 25 === 0)
    console.log(`  …scanned ${scanned}/${total}`);
}

console.log(`scanned ${scanned}/${Number.isFinite(total) ? total : "?"} resources at ${DISCOVERY_URL}`);
console.log(`checked at ${new Date().toISOString()}`);
if (found.length === 0) {
  console.log(`NOT LISTED: ${RESOURCE_URL}`);
  console.log(`host diagnostic: no exact match for ${host}`);
  console.log("Reminders: listing requires a *settled* payment through this facilitator");
  console.log("with the discovery extension accepted, and drops after 30 days of inactivity.");
  process.exit(1);
}
console.log(`LISTED (${found.length} entr${found.length === 1 ? "y" : "ies"}):`);
for (const f of found) console.log(JSON.stringify(f, null, 2).slice(0, 1500));
