# Bazari — road to production

| | |
| --- | --- |
| **Security (Phase 0)** | ✅ complete, deployed |
| **Shop foundations (Phase 1)** | 🟡 half — payments framework and emails done, gateway and photos missing |
| **Testing** | ❌ none at all |
| **Can it take a real order today?** | **No** — see A1 and A2 |

---

# PART 1 — What is done

## 1.1 Security

| # | Item | Detail |
| --- | --- | --- |
| ✅ | Account takeover closed | Reset/verification codes were returned to the caller; `admin@bazari.ge / admin123` was in the README **and** on the login page. Four separate leaks fixed. |
| ✅ | Codes leaked via URL | `register` redirected to `/verify?…&code=…` — into browser history, access logs and the `Referer` header. Now sends the address only. |
| ✅ | No default admin password | Seed refuses to run without `ADMIN_PASSWORD` (min 12 chars). Rotated in production. |
| ✅ | Transactional email | `src/lib/mail.ts` → Resend. Codes go to the *server* log in dev, refused in production, never to the browser. |
| ✅ | Rate limiting | Postgres-backed, no second service. Fails *open* — locking out the shop is worse than the attack. |
| ✅ | Security headers | `src/proxy.ts`, nonce-based CSP + HSTS + 4 more. |
| ✅ | Image optimiser abuse | `next.config.ts` allowed **any** HTTPS host — an open proxy on our bandwidth. Narrowed. |
| ✅ | Stock race | Two shoppers could buy the same last unit. Conditional decrement + `CHECK (stock >= 0)`. |
| ✅ | Secrets | `.env` never committed (history audited). `AUTH_SECRET` rotated both environments. |

**Rate limits in force**

| Endpoint | Limit |
| --- | --- |
| login | 5 / 15 min — per IP **and** per email, cleared on success |
| reset · resend verification | 3 / hour per email, 10 / hour per IP |
| coupon preview | 20 / min per IP |
| `placeOrder` | 10 / hour per IP |

Reset and resend are checked *before* the user lookup, so the throttle cannot
be used to probe which addresses exist.

## 1.2 Payments — framework only

| # | Item | Detail |
| --- | --- | --- |
| ✅ | `Payment` / `PaymentEvent` tables | Amounts in **tetri as integers** — float must not decide what a card is charged |
| ✅ | Server-side amounts | Read from the order row; a webhook reporting a different figure is **refused** |
| ✅ | Idempotent webhooks | Unique index on `(paymentId, externalId)` inside the capture transaction — a redelivered event cannot charge twice |
| ✅ | Failure / timeout / abandoned | `failed`, `cancelled`, `expired` + a 30-minute sweeper |
| ✅ | Cash on delivery | `manual` adapter; an admin marks it received |
| ✅ | Refunds | Flip status, cancel order, return every line through the stock ledger |
| ❌ | **A real gateway** | See **A2** |

Verified: tampered amount refused · capture flips the order · replayed webhook
stores one event and applies nothing · expiry leaves captured payments alone ·
refund returns stock with a matching ledger balance.

## 1.3 Emails

| # | Item |
| --- | --- |
| ✅ | Verification code, password reset — both languages, plain-text twin |
| ✅ | Order confirmation — sent *after* the transaction commits, so a mail outage cannot break a completed basket |
| ✅ | Shipped notice — fires only on the real transition, so re-saving cannot mail twice |
| ❌ | **Delivery to anyone but you** — see **A1** |

## 1.4 Earlier in the build

Coupons wired into checkout · order-detail data exposure closed (order numbers
were sequential and the page was public) · database integrity audit clean ·
zero layout shift on language switch · dark mode · fixed type scale ·
responsive to 320px.

---

# PART 2 — What is left

## Section A — Yours. I cannot start these.

### 🔴 A1. Verify a sending domain — **do this first**

Mail goes out as `onboarding@resend.dev`, which **only delivers to your own
address**. Every customer email silently fails to reach anyone else. Our tests
only passed because we sent to your Gmail.

1. Resend → **Domains** → **Add Domain**
2. Add the SPF and DKIM records it gives you to your DNS
3. Wait for verification (minutes to a few hours)
4. Set `MAIL_FROM` to an address on that domain

**Effort:** 30 min + DNS wait · **Blocks:** all customer email

### 🔴 A2. Payment provider — start the paperwork today

**Stripe cannot pay out to a Georgian entity.** Realistically: Bank of Georgia,
TBC, or **PayZe** (aggregator — covers both banks' cards, much simpler
onboarding for a small shop).

1. Choose one
2. Submit the merchant application
3. Send me the credentials when they arrive

**Effort:** you — a form · **Wait:** weeks · **Then me:** ~1 day for the adapter

### 🔴 A3. Product photos

All 40 products share one placeholder SVG. This holds the design back more
than anything else.

1. Vercel → **Storage** → **Create** → **Blob** → gives `BLOB_READ_WRITE_TOKEN`
2. Gather real photos

I will not reuse brand or marketplace images — that is someone else's
copyright on a site that takes money.

**Effort:** 10 min for the token, the photos are the real work

### 🔴 A4. Business details for the legal pages

Legal entity name · tax ID · registered address · contact details.

I will not invent these. A made-up tax ID on a page that governs a sale is
worse than having no page.

---

## Section B — Mine. Say which and I start.

### 🟡 B1. Privacy policy, technical half — **no blocker, can start now**

What data is collected, which processors touch it (Vercel, Prisma Postgres,
Resend), retention, and every cookie the site sets. Leaves gaps only for A4.

**Effort:** ~2 hours

### 🟡 B2. Tests and CI — **no blocker, highest engineering value**

There is currently **no test of any kind and no CI**. Every regression so far
was caught by hand.

- **Playwright** — guest checkout with a coupon · signed-in checkout · register
  → verify → sign in → sign out · forgot password → reset → sign in · admin
  moves an order through every status · a customer cannot reach `/dashboard`
  and a stranger cannot open someone else's order
- **Vitest** — coupon maths (percent, fixed, minimum, expiry, exhausted,
  capped) · cart totals and the free-shipping boundary · `formatPrice` in both
  locales (this has broken hydration before) · password hashing and session
  tokens
- **GitHub Actions** — lint, typecheck, build, tests on every PR; migrations
  against a throwaway Postgres; merges blocked on red

**Effort:** ~2 days

### 🟡 B3. Money as integers — **do before real money moves**

`Product.price` and `Order.total` are `Float`. Fine for display, a latent
rounding bug for charging — `Payment.amount` is integer tetri for exactly that
reason. Wide but mechanical.

**Effort:** ~1 day · **Deadline:** before A2 lands

### 🟡 B4. Product images *(needs A3's token)*

Dashboard upload · multiple images per product with a gallery · `next/image`
with proper `sizes` and AVIF/WebP · type and size validation · EXIF stripped ·
alt text in both languages.

**Effort:** ~1 day

### 🟡 B5. Payment adapter *(needs A2's credentials)*

Implement `Adapter` from `src/lib/payments/types.ts` — three methods: `start`,
`parseWebhook`, `refund`. Everything else is written and tested.

**Effort:** ~1 day

### 🟡 B6. Contact chatbot

| Option | Effort | Trade-off |
| --- | --- | --- |
| Widget (Crisp, Tawk.to) | 1 day | Generic look, another company's script on your page |
| Rule-based FAQ bot | 2–3 days | On-brand, no running cost, limited |
| **LLM on the Claude API** ⭐ | ~1 week | Best result, doubles as a portfolio piece |

The recommended option: streaming `/api/chat` · retrieval over your catalogue
and FAQ so answers cite real stock and prices · an order-lookup tool locked to
the signed-in owner · strict scope · per-session rate limit and a monthly spend
cap · both languages · never able to change an order or move money.

---

## Section C — Before launch, not urgent yet

### 🟢 C1. Operations

Sentry with source maps · uptime alerting to your phone · confirm Prisma
Postgres retention and **actually restore once** to prove it works ·
privacy-friendly analytics · admin audit log (who changed which price) ·
session revocation via `sessionVersion` so a password change invalidates old
cookies · **custom domain** (`bazari.ge` reads far better than a `vercel.app`
subdomain on a CV) · staging database so migrations are rehearsed.

### 🟢 C2. Design

Product page gallery, clearer delivery estimate, sticky buy box · empty states
that suggest a next action · loading skeletons instead of layout jumps ·
add-to-cart confirmation and optimistic quantity updates · print stylesheet for
the order confirmation · designed 404 and 500 · WCAG AA contrast audit in both
themes.

### 🟢 C3. SEO

Per-page descriptions and Open Graph · generated OG images per product ·
`Product` and `BreadcrumbList` JSON-LD · `hreflang` for both locales.

> **One decision for you.** Every page renders the identical `<title>`, exactly
> as you asked — but that is the site's biggest SEO weakness, since search
> engines lean on it heavily. A compromise: keep `Bazari - ონლაინ მაღაზია` on
> the home page, append the product or category name elsewhere
> (`Anker PowerCore 20000mAh — Bazari`). Stays as you asked until you say
> otherwise.

### 🟢 C4. Legal extras

Cookie consent — only if you add non-essential tracking. Nothing on the site
needs it today.

---

# PART 3 — Order of work

| Step | Who | What | Why now |
| --- | --- | --- | --- |
| 1 | **You** | A1 — sending domain | Customer email is broken until this is done |
| 2 | **You** | A2 — merchant application | Weeks of waiting; start the clock |
| 3 | **Me** | B2 — tests and CI | Before the codebase grows further |
| 4 | **You** | A3 — photos | Largest visible improvement available |
| 5 | **Me** | B4 — image upload | Follows A3 |
| 6 | **Me** | B3 — money as integers | Must land before A2 does |
| 7 | **Me** | B5 — payment adapter | When credentials arrive |
| 8 | Both | A4 + B1 — legal pages | Before taking public orders |
| 9 | **Me** | C1 → C2 → C3 → B6 | Polish and growth |

**Can start in parallel right now:** you on A1 and A2, me on B1 or B2.

---

# PART 4 — For the portfolio

A reviewer looks for judgement, not feature count.

- A README that leads with **why** — decisions and trade-offs, not a feature list
- Screenshots and a short screen recording, so nobody has to run it
- Demo logins that work but can do no damage, on seeded data
- Write up two or three real problems and how you diagnosed them:
  - Postgres `LIKE` is case-sensitive where SQLite was not — search broke silently after the migration
  - A hydration mismatch on prices, from `Intl.NumberFormat` disagreeing between Node and the browser
  - Sequential order numbers on a public page exposing every customer's address
  - A doubled API key that made *every* email fail with an invalid header
- A green CI badge, and a live link that loads fast on a phone
