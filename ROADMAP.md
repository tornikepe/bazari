# Bazari — road to production

What this project still needs before it takes a real order, and before it
carries a portfolio interview.

**Where it stands:** Phase 0 (security) is finished and deployed. Phase 1 is
half done — payments and images are the gaps, and both are waiting on something
only you can provide.

---

# ✅ Done

## Security — Phase 0, complete

**Account takeover, closed.** The password-reset and verification codes were
reachable by the caller, so anyone who knew an address could seize the account
— and `admin@bazari.ge / admin123` was printed in the README *and* on the login
page. Four leaks closed:

- `demoCode` removed from `AuthState` and every return site
- `register` no longer redirects to `/verify?…&code=…`, which had been leaking
  the code into browser history, access logs and the `Referer` header
- the login page now advertises the demo *customer*, which cannot change prices
  or cancel orders
- the seed refuses to run without `ADMIN_PASSWORD` (min 12 chars) — no
  deployment can inherit a password that is public in this repository

**Transactional email.** `src/lib/mail.ts` talks to Resend and is the only file
that knows the provider; `auth-emails.ts` and `order-emails.ts` hold the
templates, localised, each with a plain-text twin. Without a key, codes go to
the *server* log in development and are refused in production — never returned
to the browser. Verified: codes arrive.

**Rate limiting.** Postgres-backed (`src/lib/rate-limit.ts`) rather than a
second managed service — auth endpoints are low-volume and one atomic upsert
per attempt is cheap. Fails *open*, because locking everyone out of the shop is
worse than the attack it prevents.

| endpoint | limit |
| --- | --- |
| login | 5 / 15 min, per IP **and** per email; cleared on success |
| password reset · resend verification | 3 / hour per email, 10 / hour per IP |
| coupon preview | 20 / min per IP |
| `placeOrder` | 10 / hour per IP |

Reset and resend are checked *before* the user lookup, so the throttle itself
cannot be used to probe which addresses are registered.

**Security headers.** `src/proxy.ts` — note this Next version renames
`middleware.ts` to `proxy.ts`, and it must sit beside `src/app`; at the repo
root it silently does nothing. Nonce-based CSP with `strict-dynamic`, plus
HSTS, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy` and
`Permissions-Policy`. `style-src` keeps `'unsafe-inline'` deliberately: React
sets `style` attributes, and inline style is a far smaller risk than inline
script, which is fully locked down.

**Also found and fixed:** `next.config.ts` allowed images from *any* HTTPS
host, which turns the image optimiser into an open proxy fetching arbitrary
URLs on our bandwidth and from our IP.

**Stock race.** `placeOrder` read stock and then decremented it, so two
shoppers could buy the same last unit. The decrement is now conditional
(`updateMany` with `stock >= qty`), evaluated by the database as part of the
write, with a `CHECK (stock >= 0)` backstop. Verified with two concurrent
claims on one unit: exactly one sale, final stock 0.

**Secrets.** `.env` confirmed git-ignored and absent from the whole history.
`AUTH_SECRET` rotated in both environments.

## Shop foundations — Phase 1, partial

**Payment framework** — everything that does not depend on which gateway you
pick, so choosing one later is a single file rather than a project.

- `Payment` / `PaymentEvent` tables, amounts in **tetri as integers** — float
  must never decide what a card is charged
- amounts read from the order row, never the caller; a webhook reporting a
  different figure is **refused**, not captured
- idempotent webhooks: a unique index on `(paymentId, externalId)` inside the
  same transaction as the capture, so a redelivered event cannot charge twice
- `failed` / `cancelled` / `expired` states, and a sweeper that closes attempts
  nobody returned to after 30 minutes
- cash on delivery kept — the `manual` adapter records the attempt and an admin
  marks it received, so "is this paid?" has one answer either way
- refunds flip the status, cancel the order and return every line through the
  stock ledger

Verified against the database: tampered amount refused, capture flips the
order, replayed webhook stores one event and applies nothing, expiry leaves
captured payments alone, refund returns stock with a matching ledger balance.

**Order emails.** Confirmation on checkout, shipped notice on the transition.
The confirmation is sent *after* the order transaction commits, so a mail
outage cannot turn a completed basket into an error; the shipped notice fires
only on the real transition, so re-saving cannot mail the customer twice.
Verified end to end on production.

## Earlier in the build

Coupons wired into checkout · order-detail data exposure closed (order numbers
were sequential and the page was public) · database integrity audit clean
(totals, ledger balances, coupon usage) · zero layout shift on language switch
· dark mode · fixed type scale · responsive to 320px.

---

# ⬜ Remaining

## 🔴 Blocked on you — I cannot start these

**1. Verify a sending domain.** Right now mail goes out as
`onboarding@resend.dev`, which **only delivers to your own address**. Every
customer email — verification, password reset, order confirmation — silently
fails to reach anyone else. This is the single most important item on the list.

> Resend → Domains → Add Domain → add the SPF and DKIM records to your DNS,
> then set `MAIL_FROM` to an address on that domain.

**2. Pick a payment provider and start the merchant application.**
**Stripe cannot pay out to a Georgian entity** — it is not a supported country
— so realistically this is Bank of Georgia, TBC, or an aggregator like PayZe
(simpler onboarding for a small shop, covers both banks' cards). The paperwork
takes weeks; the code is one adapter. Start the application now, hand me
credentials later.

**3. Product photos.** All 40 products share one placeholder SVG — this is what
holds the design back more than anything else. I need two things: a Vercel Blob
store (`BLOB_READ_WRITE_TOKEN`), and the photos themselves. I will not reuse
brand or marketplace images: that is someone else's copyright on a site that
takes money.

**4. Business details for the legal pages.** Legal entity name, tax ID, real
registered address, contact details. I will not invent these — a made-up tax ID
on a page that governs a sale is worse than having no page.

*I can write the technical half of the privacy policy today without you: what
data is collected, which processors touch it (Vercel, Prisma Postgres, Resend),
how long it is kept, and every cookie the site sets. Say the word.*

## 🟡 Ready to build — say which and I start

**Product images** *(after the Blob token)* — upload in the dashboard, multiple
images per product with a gallery, `next/image` with proper `sizes` and
AVIF/WebP, type and size validation, EXIF stripped, alt text in both languages.

**Payment adapter** *(after credentials)* — implement `Adapter` from
`src/lib/payments/types.ts`: three methods, `start`, `parseWebhook`, `refund`.
Everything else is written and tested.

**Automated tests.** There is currently **no test of any kind and no CI** —
every regression so far has been caught by hand.

- Playwright: guest checkout with a coupon · signed-in checkout · register →
  verify → sign in → sign out · forgot password → reset → sign in · admin moves
  an order through every status · a customer cannot reach `/dashboard` and a
  stranger cannot open someone else's order
- Vitest: coupon maths (percent, fixed, minimum, expiry, exhausted, capped) ·
  cart totals and the free-shipping boundary · `formatPrice` in both locales
  (this has broken hydration before) · password hashing and session tokens
- GitHub Actions on every PR, migrations against a throwaway Postgres, merges
  blocked on red

**Money as integers.** `Product.price` and `Order.total` are `Float`. Fine for
display, but a latent rounding bug — `Payment.amount` is integer tetri for
exactly that reason. A wide but mechanical change, worth doing **before real
money moves**.

**Contact chatbot.** Three options, cheapest first: a third-party widget
(Crisp, Tawk.to, a day's work but generic and another company's script on your
page); a rule-based FAQ bot; or — recommended — an **LLM assistant on the
Claude API** over your own catalogue, FAQ and, for a signed-in customer, their
order status. That last one doubles as a portfolio piece given your
AI-automation direction. Roughly a week done properly: streaming `/api/chat`,
retrieval so answers cite real stock and prices, an order-lookup tool locked to
the signed-in owner, strict scope, per-session rate limit and a monthly spend
cap, both languages, never able to change an order or move money.

## 🟢 Before launch, not urgent yet

**Operations** — Sentry with source maps · uptime alerting to your phone ·
confirm Prisma Postgres retention and *actually restore once* to prove it works
· privacy-friendly analytics · admin audit log (who changed which price) ·
session revocation via a `sessionVersion` so a password change invalidates old
cookies · **a custom domain** (`bazari.ge` reads far better than a `vercel.app`
subdomain on a CV) · a staging database so migrations are rehearsed.

**Design** — product page gallery, clearer delivery estimate, sticky buy box ·
empty states that suggest a next action · loading skeletons instead of layout
jumps · add-to-cart confirmation and optimistic quantity updates · print
stylesheet for the order confirmation · designed 404 and 500 · full WCAG AA
contrast audit in both themes.

**SEO** — per-page descriptions and Open Graph · generated OG images per
product · `Product` and `BreadcrumbList` JSON-LD · `hreflang` for both locales.

> **One decision to make here.** Every page renders the identical `<title>`,
> exactly as you asked — but that is the site's biggest SEO weakness, since
> search engines lean on it heavily. A reasonable compromise: keep
> `Bazari - ონლაინ მაღაზია` on the home page and append the product or category
> name elsewhere (`Anker PowerCore 20000mAh — Bazari`). Your call; it stays as
> you asked until you say otherwise.

**Legal** — cookie consent, but only if you add non-essential tracking.
Nothing on the site needs it today.

---

## Suggested order

1. **Verify the sending domain** — customer email is broken until you do
2. **Start the merchant application** — it is the long pole, and it is paperwork
3. **Photos** — the largest visible improvement available
4. **Tests + CI** — before the codebase grows further
5. Payment adapter when credentials land, then money-as-integers
6. Operations, design polish, SEO, chatbot

## For the portfolio specifically

A reviewer looks for judgement, not feature count.

- A README that leads with **why** — the decisions and trade-offs, not a
  feature list
- Screenshots and a short screen recording, so nobody has to run it
- Demo logins that work but can do no damage, on seeded data
- Write up two or three real problems and how you diagnosed them: the Postgres
  case-sensitivity break, the hydration mismatch on prices, the sequential
  order numbers exposing customer addresses, the doubled API key that made
  every email fail. That reads far better than "built an e-commerce site"
- A green CI badge, and a live link that loads fast on a phone
