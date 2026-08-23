# Bazari — what is left

This file is the to-do list, and only that. Everything finished has been removed from it: what
was done, why, and what it cost is in the git history, where it cannot drift out of date.

Ordered by how much each item would be missed. Anything marked ⛔ is blocked on something that
cannot be produced here.

---

## 1. Responsive — the part a desktop cannot check

The layout holds from 320px up, in both languages, on Chromium and WebKit, and that is a test
rather than a claim. What is left needs a real phone.

- ⛔ **`env(safe-area-inset-*)` is inert.** `.buy-bar` already pads for the home indicator and
  that padding resolves to `0`, because the viewport never opts in with `viewport-fit=cover`.
  Turning it on extends the page under the notch, so it has to land together with insets on
  every edge — and none of it can be verified here: Playwright cannot emulate a safe area, and
  the iOS Simulator needs the full Xcode install of **A7**. Shipping it blind could put content
  under the notch that is merely letterboxed today, which is worse
- **iOS Safari's 100vh and the moving address bar**, on the chat panel and the mobile filter
  sheet — `min-h-screen` in three places wants `dvh`
- **Momentum scrolling** inside the filter rail and the chat transcript
- **The on-screen keyboard**: the checkout form must not hide the field being typed into
- **Reduced motion, forced colours** (Windows high contrast) **and 200% browser zoom** — three
  settings real people use that nothing here has ever been opened with

---

## 2. Design

### 2.1 — Missing rather than wrong

- **Error states in the chat panel, the payment panel and the page editor** — three places that
  still print a bare red sentence with no way out of it
- **Cross-sell** is still "related products" and nothing else. Bought-together, recently viewed,
  and something on the empty cart
- **Saved views and inline editing** on the dashboard tables — products can be selected and
  published, hidden or deleted in one go; orders and customers cannot be acted on in bulk at all
- **The 404 and error pages** work and are unloved
- **The account page:** a saved-address book rather than one address, filtering the order list by
  status, and something better than empty space beside the profile form on a wide screen

### 2.2 — Craft

- **Micro-interactions** on add-to-cart, quantity change and status change. The site animates
  panels and drawers and nothing else
- **A print stylesheet** for the order page, which a shop actually uses
- **Dark mode reviewed page by page** rather than trusted to the token swap
- **A real favicon set**, web manifest and install prompt

---

## 3. What a real shop needs and this does not have

Ordered by how badly a business would miss it.

| Priority | Item | Where it stands |
|---|---|---|
| 🔴 | **Payment** | The adapter interface is written and tested; nothing implements it. Needs a provider — **A4** |
| 🟠 | **Coupon management** | The `Coupon` table and the validation work. There is no page to create one |
| 🟠 | **Staff management** | Roles change only through Prisma Studio. Needs invite, role change, deactivate |
| 🟠 | **Order invoice** | Printable, and attached to the confirmation email |
| 🟠 | **Stock control** | Restock from the dashboard, a low-stock email, "tell me when it is back" for shoppers |
| 🟡 | **Product variants** | Size and colour. A schema change, and the largest single feature here |
| 🟡 | **Search that works** | `contains` today. Postgres full-text with Georgian stemming — the assistant already had to work around this |
| 🟡 | **Product images, the rest** | Uploading and the gallery work. Still missing: ordering, alt text per language, generated sizes |
| 🟡 | **Delivery options** | Courier against pickup, zones, per-zone pricing |
| 🟡 | **Tax** | Shown and recorded per order. Georgia is 18% |
| 🟡 | **Returns** | A request flow, not only a policy page |
| 🟢 | **Reviews** | Only if they are real. The rule against invented numbers stands |
| 🟢 | **The wishlist on the account** | `localStorage` only, so it is lost when the browser is cleared |
| 🟢 | **Abandoned-cart email** | Waits on the sending domain — **A3** |

---

## 4. Testing

332 unit and 212 end-to-end tests run on every push, across Chromium and WebKit, with a database
audit and a width sweep of both the storefront and the dashboard. What is missing:

- **Visual regression.** Every page × two themes × two languages × three widths, diffed on every
  PR. It is the only way "the design does not quietly rot" becomes a fact rather than a hope
- **Accessibility assertions** — `axe-core` on every page in both languages. The hand-written
  checks catch what they were written for and nothing else
- **Firefox.** Chromium and WebKit run; Gecko has never opened this site
- **A load test** on the catalogue and checkout. The site has been down once from connection
  exhaustion, and a modest one would have caught it before customers did
- **A disposable test database**, so the suite stops mutating the data it reads — the buy-bar
  tests broke once because the checkout suite sold out the product they used

---

## 5. Operations

- **An admin audit log** — who changed which price, and when
- **Error tracking** (Sentry with source maps) — needs an account, **A8**
- **Uptime alerting** to your phone
- **Backups**: confirm retention, and **restore once** to prove it works
- **Analytics**, privacy-friendly, so no cookie banner is needed
- **A custom domain** — `bazari.ge` reads better than a `vercel.app` subdomain
- **A staging database**, so migrations are rehearsed before production
- **Rate limiting on checkout**, not only on the auth routes

---

## 6. The documentation pass, at the end

Written down as a phase rather than left as good intentions, because it is the part that is
always meant to happen and never scheduled. The README is kept current as each piece lands —
that is not this. This is the pass that reads the whole thing as one document, from the position
of someone who has never seen the project.

- **Every claim re-verified against the code**, not against what the code did when the sentence
  was written. Every command actually run; every count and path checked. A README is trusted
  more than the code it describes, so a stale line there does more damage than a stale comment
- **The three passwords and `AUTH_SECRET`** — how they are generated, where they live, how they
  reach an account, how to rotate one. It is what people get stuck on, and the reason
  `npm run setup:credentials` exists
- **One route in, one route out.** Someone cloning this should reach a running shop without
  reading anything twice
- **Screenshots that match what ships**, in both languages and both themes
- **Every environment variable**: what it is for, what breaks without it, whether it is required
- **The honest limits.** What is deliberately not built, what is demo-only, and what would have
  to change to take real money

---

## 7. What only you can do

Each of these needs an account, a payment relationship, a password, or something from the real
world. None can be guessed at, and none should be approximated with an invented stand-in.

| | What | Why it is yours | What it unblocks |
|---|---|---|---|
| **A1** | **`GOOGLE_CLIENT_ID`** and **`GOOGLE_CLIENT_SECRET`** | Registering an OAuth client means signing in to Google's console as you, and the secret is a secret | Google sign-in. The flow is written and tested. Until then the button is drawn and **disabled**, with a line saying why |
| **A2** | **Check `AUTH_SECRET` on Vercel** | Only you can read your project's environment | Nothing — but if it is still the public placeholder, session cookies can be **forged**. Local is fine; production was never checked |
| **A3** | A sending domain verified in **Resend**, and `RESEND_API_KEY` | Domain ownership | Every customer email. Right now **nothing is sent at all**: registration, the resend button and password reset each say so plainly rather than promising a code that cannot arrive |
| **A4** | A **payment provider** application | A business relationship, and it takes weeks | §3 payment. Worth starting long before it is needed |
| **A5** | **Real product photographs** | Nobody can invent a photo of a product that exists | The catalogue. Uploading and the gallery already work and wait for nothing |
| **A6** | **Real business details** — address, phone, hours, tax ID | They are facts about a business | The contact settings, which stay empty on purpose rather than showing something invented |
| **A7** | A full **Xcode** install, then `sudo xcode-select -s /Applications/Xcode.app/Contents/Developer` | It needs your password | §1's notch work. `env(safe-area-inset-*)` cannot be emulated, so it stays device-gated rather than shipped blind |
| **A8** | A **Sentry** account | An account and a billing decision | §5 error tracking |

### The two that cost nothing and unblock the most

```bash
# A1 — after registering the client at console.cloud.google.com/apis/credentials
#      with these redirect URIs, character for character:
#        http://localhost:3000/api/auth/google/callback
#        https://bazari-git-main-tornikepes-projects.vercel.app/api/auth/google/callback
GOOGLE_CLIENT_ID="…"
GOOGLE_CLIENT_SECRET="…"
```

```bash
# A2 — if Vercel's AUTH_SECRET is still "dev-only-change-me-to-a-long-random-string",
#      replace it. Everyone is signed out, which is the correct outcome.
npm run setup:credentials -- --force   # locally; set the Vercel one by hand
```

**Nothing in sections 1 to 6 waits on any of these**, apart from the two items marked ⛔ and A3.

---

## 8. One design across the whole site

The direction is settled — Swiss, a grid, hairline rules, square corners, no shadows, one red —
and the tokens exist. What does not exist is a *system*: pages were built one at a time and each
solved the same problems slightly differently, so the site reads as a good design applied nine
times rather than one design. This is the pass that makes every page look like the same hand
drew it.

It is last on purpose. Doing it before the pages stop changing means doing it twice.

**The rules to write down, then apply everywhere**

- **One page header.** Today: some pages open with a breadcrumb and an `h1`, some with an `h1`
  alone, the account page with an identity card, the track page with a centred icon. Decide the
  shape — eyebrow, title, one line of purpose, optional action on the right — and give every page
  the same one
- **One card.** The orders card has a bordered header bar; the profile card has a padded heading;
  the dashboard's have neither. One card component with an optional header and one padding scale
- **One vertical rhythm.** `py-6 lg:py-8` on the catalogue, `py-10 lg:py-14` on the track page,
  `py-6 lg:py-10` on the account page. Three values doing one job
- **One way to show a set of figures.** The account page uses a hairline strip; the dashboard
  uses separate cards; the track page uses a definition list. Pick one and use it three times
- **One table.** Column alignment, zebra rules, the money column, the row-action column, and what
  a row looks like when it collapses to a card on a phone
- **One empty, one loading, one error** — these three already exist as components and are the
  proof the rest is worth doing
- **A page-template inventory** in the README: which of the four templates each route uses, so
  the next page starts from a decision instead of a copy-paste

**How it gets checked**

- Visual regression (§4) lands *first*, so the pass is measured rather than admired
- A short document — not a style guide nobody reads, a one-page list of the seven rules above —
  and a test that fails when a page invents an eighth

---

## 9. Order of work

1. **§2.1 design** — the remaining error states, cross-sell, the 404 and error pages. None of it
   is blocked
2. **§3 shop features** — coupons and staff management first: both are a page away from data
   that already exists and already works
3. **§4 testing** — visual regression, which §8 depends on
4. **§8 the design pass**, once the pages have stopped moving
5. **§5 operations** and **§6 documentation**, last, when there is something stable to describe
