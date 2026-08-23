# Bazari — to do

Only what is left. ⛔ marks work blocked on something that cannot be produced here.

---

## 1. Responsive — needs a real phone

- ⛔ `env(safe-area-inset-*)`: add `viewport-fit=cover` together with insets on every edge.
  Cannot be verified without **A7**
- `min-h-screen` → `dvh` in three places: the chat panel and the mobile filter sheet, for iOS
  Safari's moving address bar
- Momentum scrolling in the filter rail and the chat transcript
- The on-screen keyboard must not hide the checkout field being typed into
- Open the site at 200% zoom, in forced colours, and with reduced motion

---

## 2. Design

- Saved views, inline editing, and bulk actions for orders and customers
- A print stylesheet for the order page
- Dark mode, reviewed page by page
- A favicon set, a web manifest, an install prompt

---

## 3. Shop features

| | Item | What it needs |
|---|---|---|
| 🔴 | Payment | An implementation behind the adapter interface. Blocked on **A4** |
| 🟠 | Order invoice | Printable, and attached to the confirmation email |
| 🟠 | Stock control | Restock from the dashboard, low-stock email, "tell me when it is back" |
| 🟡 | Product variants | Size and colour. A schema change, and the largest item here |
| 🟡 | Search | Postgres full-text with Georgian stemming, in place of `contains` |
| 🟡 | Product images | Ordering, alt text per language, generated sizes |
| 🟡 | Delivery options | Courier against pickup, zones, per-zone pricing |
| 🟡 | Tax | Shown and recorded per order. Georgia is 18% |
| 🟡 | Returns | A request flow, not only a policy page |
| 🟢 | Reviews | Only if they are real |
| 🟢 | Wishlist on the account | It lives in `localStorage` and is lost when the browser is cleared |
| 🟢 | Abandoned-cart email | Blocked on **A3** |

---

## 4. Testing

- Visual regression: every page × two themes × two languages × three widths, diffed on every PR
- `axe-core` on every page, in both languages
- Firefox
- A load test on the catalogue and checkout
- A disposable test database, so the suite stops mutating the data it reads

---

## 5. Operations

- An admin audit log: who changed which price, and when
- Error tracking — Sentry with source maps. Blocked on **A8**
- Uptime alerting to your phone
- Backups: confirm retention, and restore once to prove it works
- Analytics, privacy-friendly, no cookie banner
- A custom domain
- A staging database, so migrations are rehearsed before production
- Rate limiting on checkout

---

## 6. Documentation, at the end

- Re-verify every claim against the code, and run every command in the README
- The three passwords and `AUTH_SECRET`: how they are made, where they live, how to rotate one
- One route in, one route out — clone to running shop without reading anything twice
- Screenshots that match what ships, in both languages and both themes
- Every environment variable: what it is for, what breaks without it, whether it is required
- The honest limits: what is deliberately not built, and what would have to change to take money

---

## 7. What only you can do

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

## 8. One design across the whole site

Nine pages were built one at a time, and each solved the same problems slightly differently.
Decide each rule once, then apply it everywhere.

- **One page header** — eyebrow, title, one line of purpose, optional action on the right
- **One card** — an optional header bar, one padding scale
- **One vertical rhythm** — one page-padding value, not three
- **One way to show a row of figures**
- **One table** — column alignment, zebra rules, the money column, the row-action column, and
  what a row becomes on a phone
- **A page-template inventory** in the README: which template each route uses, so the next page
  starts from a decision rather than a copy-paste
- A one-page list of those rules, and a test that fails when a page invents another

Visual regression (§4) lands first, so the pass is measured rather than admired.

---

## 9. Order of work

1. **§4** — visual regression
2. **§8** — the design pass
3. **§2** — craft, after the design pass: polishing pages that are about to be restyled is work
   done twice
4. **§5** and **§6**, last
