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

## 2. Shop features

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

## 3. Testing

- `axe-core` on every page, in both languages
- Firefox
- A load test on the catalogue and checkout
- A disposable test database, so the suite stops mutating the data it reads

---

## 4. Operations

- An admin audit log: who changed which price, and when
- Error tracking — Sentry with source maps. Blocked on **A8**
- Uptime alerting to your phone
- Backups: confirm retention, and restore once to prove it works
- Analytics, privacy-friendly, no cookie banner
- A custom domain
- A staging database, so migrations are rehearsed before production
- Rate limiting on checkout

---

## 5. Documentation, at the end

- Re-verify every claim against the code, and run every command in the README
- The three passwords and `AUTH_SECRET`: how they are made, where they live, how to rotate one
- One route in, one route out — clone to running shop without reading anything twice
- Screenshots that match what ships, in both languages and both themes
- Every environment variable: what it is for, what breaks without it, whether it is required
- The honest limits: what is deliberately not built, and what would have to change to take money

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

1. **§2** — the shop features, in the order they are weighted
2. **§3** — testing, alongside rather than after
3. **§4** and **§5**, last
4. **§1** whenever a real phone is to hand — most of it cannot be verified without one
