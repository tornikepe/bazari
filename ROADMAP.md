# Bazari — to do

Only what is left. ⛔ marks work blocked on something that cannot be produced here.

---

## 1. Responsive — needs a real phone

- ⛔ `env(safe-area-inset-*)`: add `viewport-fit=cover` together with insets on every edge.
  Cannot be verified without **A7**
- Open the site at 200% zoom, in forced colours, and with reduced motion — on the device,
  not in an emulator

Done since the last cut: `dvh` on the filter sheet and the dashboard rail (the chat panel
already had it); scroll chaining stopped inside the filter sheet and the menu drawer;
`scroll-padding-top` on `html` so a field the keyboard scrolls into view lands below the
sticky header rather than under it. Momentum scrolling needs nothing — every engine has
done it for overflow boxes since iOS 13, and `-webkit-overflow-scrolling` is a no-op.

---

## 2. Shop features

| | Item | What it needs |
|---|---|---|
| 🔴 | Payment | An implementation behind the adapter interface. Blocked on **A4** |
| 🟢 | Reviews | Only if they are real |
| 🟢 | Abandoned-cart email | Blocked on **A3** |

Done since the last cut:

- **Order invoice.** A PDF drawn from the order's own columns — the same document the page
  prints, in either language, with Noto Sans Georgian embedded — downloadable from both order
  pages and attached to the confirmation email. The email itself still waits on **A3**.
- **Tax.** Every order records the VAT inside its total and the rate it was worked out at
  (`Order.tax`, `Order.taxRate`); the cart, the checkout, both order pages and the printed
  invoice show "including VAT 18%". The rate is a setting; zero hides the line.
- **Delivery options.** Courier or collection in person, with a collection address; courier
  zones with a fee each and, optionally, a free-delivery threshold of their own. Managed on
  the settings page; the checkout asks; the order remembers the zone by name.
- **Returns.** A request flow, not only a policy page: a shopper asks from the order page
  within the window (a setting, 14 days), picks the lines and a reason; the shop answers
  from **Dashboard → Returns** and the reply appears on the shopper's order page. Marking a
  return received puts the stock back through the ledger.
- **Return emails.** The shopper is written to when the shop approves, rejects, receives or
  refunds — with the shop's reply in the message. Like every other email here it goes to the
  server log until **A3** gives it a sending domain.
- **Wishlist on the account.** A signed-in shopper's hearts are written to the account and
  come back in any browser; the browser's own list is kept and merged on sign-in, and a
  removal survives a closed tab. The product page has its own heart now, beside the cart.

---

## 3. Testing

- Run `npm run load` once against the deployed site (`LOAD_URL=https://…`), gently — the
  figures measured here go through a database on another continent and say more about the
  round trip than about the pages

Done since the last cut: `axe-core` on every page — nineteen public routes, the account and
the dashboard — in both languages and both themes (`tests/e2e/a11y.spec.ts`, 84 audits);
Firefox as a third engine on the engine-sensitive slice (`--project=firefox`);
`npm run test:e2e:scratch`, which makes a throwaway Postgres, migrates and seeds it, and runs
the suite against it, so nothing needs to touch a real database; `npm run load`, the
catalogue under twenty connections with a p99 budget — its first run found the product page
awaiting two queries in sequence that its own comment said ran together, and a production
pool of three connections that is right for Vercel and a queue for `next start`; and
`checkout-race.spec.ts`, six real browsers buying the last three units in the same instant,
of which exactly three succeed.

---

## 4. Operations

- Error tracking — Sentry with source maps. Blocked on **A8**
- Uptime alerting to your phone
- Backups: confirm retention, and restore once to prove it works
- A custom domain
- A staging database, so migrations are rehearsed before production. (`npm run
  test:e2e:scratch` rehearses every migration on a throwaway database each time it runs,
  which is most of what a staging database is for)

Done since the last cut: **Dashboard → Traffic** — page views counted per day and path
from a beacon the page sends, with no cookie set and no address kept; a day's visitors are
told apart by a keyed hash under a key that changes at midnight, so "how many people" has an
answer and "who" cannot be asked. The privacy page says so. And **Dashboard → Audit log**. Every write a staff member can make —
a product, a price typed over in the table, a stock figure, a category, an order's status, a
payment, a return, a coupon, a zone, the settings, an information page, a staff or customer
account — leaves a row with who, when, and `field: before → after`. Append-only; the
read-only role can read it.

Rate limiting on checkout was already there (`placeOrder`, ten an hour per address) and
should not have been on this list.

---

## 5. Documentation, at the end

- Screenshots that match what ships, in both languages and both themes — after **A5**, or
  they are screenshots of one placeholder photo forty times
- Read the README top to bottom once more after **A3** and **A4** land, since both change
  what the "honest limits" say

Done since the last cut: the environment-variable table rewritten from `grep process.env` —
it named `SITE_URL` where the code reads `NEXT_PUBLIC_SITE_URL`, and was missing `DIRECT_URL`,
`MAIL_FROM` and the two chat ceilings — with what breaks without each; the scripts table and
the project structure brought up to date; every `npm run` command in the README run against
the current schema (`db:verify` and `db:audit` pass); the new settings, the zones, the returns,
the audit log, the traffic page and the PDF written up where they belong.

---

## 6. What only you can do

| | What | Why it is yours |
|---|---|---|
| **A1** | `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` | The console is signed into as you, and the secret is a secret |
| **A2** | Check `AUTH_SECRET` on Vercel — if it is still the public placeholder, session cookies can be forged | Only you can read your project's environment |
| **A3** | A sending domain verified in Resend, and `RESEND_API_KEY` | Domain ownership. Until then no customer email is sent at all |
| **A4** | A payment provider application | A business relationship, and it takes weeks |
| **A5** | Real product photographs | Nobody can invent a photo of a product that exists |
| **A6** | Real business details — address, phone, hours, tax ID | They are facts about a business |
| **A7** | A full Xcode install, then `sudo xcode-select -s /Applications/Xcode.app/Contents/Developer` | It needs your password |
| **A8** | A Sentry account | An account and a billing decision |
| **A9** | Run the three new migrations against production: `npm run db:migrate` (or `prisma migrate deploy`) after merging | They were rehearsed on a throwaway database, not on yours |

```bash
# A1 — register the client at console.cloud.google.com/apis/credentials with these
#      redirect URIs, character for character:
#        http://localhost:3000/api/auth/google/callback
#        https://bazari-git-main-tornikepes-projects.vercel.app/api/auth/google/callback
GOOGLE_CLIENT_ID="…"
GOOGLE_CLIENT_SECRET="…"
```

```bash
# A2 — replacing it signs everyone out, which is the correct outcome.
npm run setup:credentials -- --force   # locally; set the Vercel one by hand
```

---

## 7. Order of work

1. **A9** — the migrations, before anything else ships
2. **§2** — what is left of the shop features, in the order they are weighted
3. **§4** and **§5**, last
4. **§1** whenever a real phone is to hand
