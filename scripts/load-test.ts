/**
 * How the catalogue holds up under a crowd.
 *
 * Fires a fixed number of concurrent connections at the pages a shopper reads
 * — the home page, the catalogue, a filtered catalogue, a search, and a
 * handful of product pages — for a few seconds each, and reports what came
 * back: requests per second, the median and the tail, and anything that was
 * not a 200.
 *
 *     npm run build && npm start            # in one terminal, a production build
 *     npm run load                          # in another
 *     LOAD_URL=https://your-host npm run load
 *     LOAD_CONNECTIONS=50 LOAD_SECONDS=20 npm run load
 *
 * Against a production build, not `next dev`: the dev server compiles on
 * demand and measures the compiler, not the site.
 *
 * Read paths only, on purpose. A checkout under load is a different question
 * — not "how many a second" but "what if they all arrive at once" — and
 * `tests/e2e/checkout-race.spec.ts` answers that one with six real browsers.
 *
 * The search endpoint is throttled at 120 a minute per address, so it is
 * given a short, gentle run of its own and a 429 there is expected — it is
 * the throttle working, and the report says so rather than counting it as a
 * fault.
 */
import autocannon from "autocannon";

const base = (process.env.LOAD_URL ?? "http://127.0.0.1:3100").replace(/\/$/, "");
const connections = Number(process.env.LOAD_CONNECTIONS ?? 20);
const seconds = Number(process.env.LOAD_SECONDS ?? 10);
/** The tail the shop is willing to stand behind; the run fails past it. */
const budgetP99 = Number(process.env.LOAD_P99_MS ?? 2000);

type Scenario = { name: string; paths: string[]; connections?: number; seconds?: number; expect?: number[] };

async function slugs(): Promise<string[]> {
  // A few real product pages, found the way the header's search finds them.
  const res = await fetch(`${base}/api/search?q=an`);
  if (!res.ok) return [];
  const data = (await res.json()) as { products?: { slug: string }[] };
  return (data.products ?? []).map((product) => product.slug).slice(0, 5);
}

async function main() {
  const probe = await fetch(base).catch(() => null);
  if (!probe || !probe.ok) {
    console.error(`✗ nothing answered at ${base} — start a production build first (npm run build && npm start)`);
    process.exit(1);
  }

  const products = await slugs();
  const scenarios: Scenario[] = [
    { name: "home", paths: ["/"] },
    { name: "catalogue", paths: ["/catalog", "/catalog?page=2", "/catalog?sort=price-asc"] },
    { name: "catalogue, filtered", paths: ["/catalog?category=electronics", "/catalog?sale=1&min=50"] },
    ...(products.length > 0
      ? [{ name: "product pages", paths: products.map((slug) => `/product/${slug}`) }]
      : []),
    // Gentle, and short: the throttle is 120 a minute per address.
    { name: "search (throttled)", paths: ["/api/search?q=an", "/api/search?q=usb"], connections: 2, seconds: 3, expect: [200, 429] },
  ];

  let failed = false;
  const rows: string[][] = [];

  for (const scenario of scenarios) {
    const result = await autocannon({
      url: base,
      connections: scenario.connections ?? connections,
      duration: scenario.seconds ?? seconds,
      // Round-robin over the scenario's paths, so a run covers all of them.
      requests: scenario.paths.map((path) => ({ method: "GET" as const, path })),
      setupClient: (client) => {
        client.setHeaders({ accept: "text/html,application/json", "accept-language": "ka" });
      },
    });

    const okCodes = scenario.expect ?? [200];
    const nonOk = result.non2xx - (okCodes.includes(429) ? Number(result.statusCodeStats?.["429"]?.count ?? 0) : 0);
    const bad = result.errors + result.timeouts + nonOk;
    const p99 = result.latency.p99;
    const over = p99 > budgetP99 && !scenario.expect;
    if (bad > 0 || over) failed = true;

    rows.push([
      scenario.name,
      `${result.requests.average.toFixed(0)}/s`,
      `${result.latency.p50} ms`,
      `${result.latency.p97_5} ms`,
      `${p99} ms${over ? " ✗" : ""}`,
      bad > 0 ? `${bad} ✗` : "0",
    ]);
  }

  const header = ["scenario", "req/s", "p50", "p97.5", "p99", "errors"];
  const widths = header.map((h, i) => Math.max(h.length, ...rows.map((r) => r[i]!.length)));
  const line = (cells: string[]) => cells.map((c, i) => c.padEnd(widths[i]!)).join("  ");
  console.log(`\n${base} — ${connections} connections, ${seconds}s per scenario, p99 budget ${budgetP99} ms\n`);
  console.log(line(header));
  console.log(widths.map((w) => "-".repeat(w)).join("  "));
  for (const row of rows) console.log(line(row));
  console.log("");

  if (failed) {
    console.error("✗ over budget or not all 200 — see the marked rows");
    process.exit(1);
  }
  console.log("✓ within budget");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
