# STRATEGY — why veristat exists, and when to stop

Distilled from the 2026-07-10 strategy session (landscape verified live against
the Coinbase x402 Bazaar, official MCP registry, and Cloudflare docs). This is
context, not open questions — decisions live in `docs/SPEC.md`.

## The position

Per-request payment rails for agent traffic are live (Cloudflare Monetization
Gateway on waitlist, x402 protocol, stablecoin settlement; AWS equivalent GA).
The unit of payment is the request; the caller is increasingly an agent. The
bet: there is a first-mover position in shipping genuinely useful, well-priced,
discoverable paid MCP tools before the field fills in — trading speed-to-cash
for that position.

## Landscape calibration (verified 2026-07-10)

- Coinbase x402 Bazaar: ~100 resources read at the time; dominated by
  crypto-market data; median price $0.001, p90 $0.10. **Exa and Tavily already
  sell search per-call via x402** — serious API companies think the channel is
  worth listing in.
  **Correction (2026-07-12):** that ~100 was one page of an offset-paginated
  API; the catalog's true total is **~25,500 resources** and items carry a
  `quality` ranking field (`docs/research/bazaar-listing.md`). Shelf space is
  crowded; discoverability is a ranking/search problem, not a scarcity one.
  The ship gate below is unchanged — it exists to answer exactly this.
- Official MCP registry: live; x402-paid servers exist but are a rounding error.
- The only population demonstrably *spending* through these rails is trading
  bots buying market data, because their willingness-to-pay is denominated in
  trade P&L.
- Honest read: infrastructure is overbuilt relative to demand. We're not early
  to a queue — we're early to a room that might stay empty for two quarters.

## Why this tool (the three traps, forced)

**Demand / chicken-and-egg.** The near-term buyer is a builder wiring the
endpoint into a harness, not an autonomous wallet-bearing agent. What clears
"worth wiring in": (1) x402 dissolves multi-vendor account friction — payment
is the credential; (2) a model cannot cheaply be its own independent checker —
self-grading is correlated failure, so the checker must be a different model,
cross-vendor; (3) $0.50 as opex beats owning a verification subsystem below
~10k calls/month.

**Defensibility.** Moat ranking available to a solo operator: proprietary data
> hard computation > aggregation-plus-methodology > reliability > prompting.
veristat's moats are soft but real: synthesis methodology, the eval flywheel
(every paid call generates eval data competitors don't have), and registry
incumbency (verified settlement history in a machine-mediated market).

**Unit economics.** Value-per-call, not volume. `consensus_check` costs
~$0.10–0.12 in tokens (3-model panel + synthesis) against a $0.50 price →
~78% gross margin. `research_fanout` $2–4 cost against $12–25 → 70–83%.
Never price-cut into the sub-cent tier — those prices are for cache reads;
ours includes frontier-model tokens.

Rejected alternatives: the x402 "shovel" (commoditized on day zero — Cloudflare
and Coinbase give it away), sensor-geometry tool (best moat, no market),
curated corpus (outflanked by Exa/Tavily at $0.001–0.01/call).

## Pricing rationale

$0.50/3-panel is 5–500× the Bazaar's p90 — deliberate. We sell a verdict, not
a cache read. Dynamic 402 quoting keeps price tied to cost (panel size, input
length). The buyer base is currently conditioned on sub-cent pricing; the
counterweight is that Bazaar money flows through trading agents whose
willingness-to-pay tracks trade value — and a pre-trade sanity check is
directly sellable to them.

## Distribution

Coinbase Bazaar (settlement-triggered listing), official MCP registry,
x402scan, Cloudflare Monetization Gateway waitlist (CF-native stack = obvious
launch-partner pitch), awesome-x402, Smithery/Glama/PulseMCP, plus the free
`get_sample_verdict` tool so agents can taste output without a wallet.
First-ten-customers list: `docs/ROADMAP.md` Phase 5.

## The kill condition (verbatim, do not soften)

**Try-then-inline** is the thing most likely to kill this: a builder pays for
ten calls, likes the method, rebuilds it in-house with their own keys. For the
business to work anyway: the verdict must be visibly better than naive fan-out
and keep improving from eval data; the convenience premium must hold; and
neutrality must matter to buyers doing high-stakes actions.

**Ship gate: 10 distinct organic paying wallets within 30 days of listing.**
Not revenue — distinct payers, excluding our own flagged test/canary wallets.
If the gate fails, the demand thesis — not the implementation — failed.
Write it down and stop.
