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
| 🟠 | Order invoice | A PDF attached to the confirmation email. Needs a renderer, and **A3** |
| 🟠 | Return emails | Tell the shopper when the shop answers a request. Written into the row already; sending needs **A3** |
| 🟢 | Reviews | Only if they are real |
| 🟢 | Wishlist on the account | It lives in `localStorage` and is lost when the browser is cleared |
| 🟢 | Abandoned-cart email | Blocked on **A3** |

Done since the last cut:

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

---

## 3. Testing

- A load test on the catalogue and checkout
- A disposable test database, *wired in*. The recipe works today —
  `npx create-db@latest create -t 24h -j` gives a Postgres that deletes itself, and the whole
  suite ran against one for this cut — but it is a thing a person does, not a thing the
  suite does. `global-setup.ts` could create one and `migrate deploy` + seed into it

Done since the last cut: `axe-core` on every page — nineteen public routes, the account and
the dashboard — in both languages and both themes (`tests/e2e/a11y.spec.ts`, 84 audits);
Firefox as a third engine on the engine-sensitive slice (`--project=firefox`).

---

## 4. Operations

- An admin audit log: who changed which price, and when
- Error tracking — Sentry with source maps. Blocked on **A8**
- Uptime alerting to your phone
- Backups: confirm retention, and restore once to prove it works
- Analytics, privacy-friendly, no cookie banner
- A custom domain
- A staging database, so migrations are rehearsed before production. (Three migrations in
  this cut were rehearsed on a throwaway database first — see §3 — which is the manual
  version of this)

Rate limiting on checkout was already there (`placeOrder`, ten an hour per address) and
should not have been on this list.

---

## 5. Documentation, at the end

- Re-verify every claim against the code, and run every command in the README
- The three passwords and `AUTH_SECRET`: how they are made, where they live, how to rotate one
- One route in, one route out — clone to running shop without reading anything twice
- Screenshots that match what ships, in both languages and both themes
- Every environment variable: what it is for, what breaks without it, whether it is required
- The honest limits: what is deliberately not built, and what would have to change to take money
- The three new settings — VAT rate, collection, return window — and the zones table

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
3. **§3** — the load test, and wiring the throwaway database into the suite
4. **§4** and **§5**, last
5. **§1** whenever a real phone is to hand
