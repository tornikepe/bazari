# Bazari — road to production

What this project still needs before it takes a real order, and before it
carries a portfolio interview. Ordered so that each phase is safe to ship on
its own. **Phase 0 must land before the site is shown to anyone with a real
email address.**

Status legend: `[ ]` not started · `[~]` partially there · `[x]` done

---

## Phase 0 — Security blockers (do these first)

All of Phase 0 is done except rotating the production `AUTH_SECRET`, which is
left for you because it signs out every logged-in user.

### 0.1 Password-reset codes are returned to the caller — **critical** ✅ done

`requestPasswordReset` and `resendVerification` in `src/app/actions/auth.ts`
*used to* return the one-time code in the response body as `demoCode`. That was
a deliberate shortcut so the flow could be demoed without an email provider,
but in production it meant:

1. Anyone submits `admin@bazari.ge` (published in the README and the seed).
2. The reset code comes straight back in the server-action response.
3. They call `resetPassword` with it and own the admin account.

- [x] Delete `demoCode` from `AuthState` and every return site
- [x] Send the code by email instead (see 0.2)
- [x] Remove the `DemoCodeNotice` component and its usages
- [x] Change the seeded admin password, and stop documenting a real one
- [x] **Also found:** `register` redirected to `/verify?…&code=<code>`, leaking
      the code into browser history, access logs and the Referer header
- [x] **Also found:** the login page rendered the admin password on screen; it
      now advertises the demo customer instead

The mail layer landed with it (`src/lib/mail.ts`, `src/lib/auth-emails.ts`), so
0.2 is mostly done — **all that remains is adding `RESEND_API_KEY` and
`MAIL_FROM` in Vercel and verifying a sending domain.** Until then production
sends nothing: reset codes are refused rather than leaked, so password reset is
unavailable but not exploitable. Sign-up and sign-in are unaffected.

### 0.2 Real transactional email

There is no mail provider wired up at all. Needed for verification, password
reset, and order confirmations.

- [x] Pick a provider — [Resend](https://resend.com) is the least friction on
      Vercel (generous free tier, good DX)
- [ ] **Create the account, add `RESEND_API_KEY` + `MAIL_FROM` in Vercel**
- [ ] Verify a sending domain (SPF + DKIM DNS records) so mail isn't spam-filed
- [x] `src/lib/mail.ts` with a typed `sendMail()` wrapper
- [x] Templates: verify address, reset password — *order emails still to do (1.3)*
- [x] Both languages — the templates must respect the user's locale
- [x] Fail soft: a mail outage must never break checkout

**Effort:** ~1 day including DNS propagation.

### 0.3 Rate limiting ✅ done

Every auth endpoint is unthrottled. Login, reset-request and the coupon
preview can all be hammered for free.

- [x] ~~Upstash Redis~~ → **Postgres-backed** (`src/lib/rate-limit.ts`). No second
      managed service: auth endpoints are low-volume and one indexed atomic
      upsert per attempt is cheap. Fails *open* if the DB is unreachable.
- [x] Login: 5 attempts / 15 min per IP **and** per email; a correct password
      clears both counters
- [x] Reset + resend verification: 3 / hour per email, 10 / hour per IP —
      checked *before* the user lookup so the throttle can't be used to probe
      which addresses exist
- [x] Coupon preview: 20 / min per IP
- [x] `placeOrder`: 10 / hour per IP
- [x] Localised "too many attempts, try again in N min" in both languages

**Effort:** ~half a day.

### 0.4 Secrets and headers ✅ mostly done

- [x] Local `AUTH_SECRET` rotated to 48 random bytes
- [ ] **Rotate the production `AUTH_SECRET`** — signs every session cookie, so
      doing it logs everyone out. Left for you to run.
- [x] Confirmed `.env` is git-ignored and appears nowhere in git history
- [x] Security headers via `src/proxy.ts` (this Next version renames
      `middleware.ts` → `proxy.ts`): HSTS, `X-Content-Type-Options`,
      `Referrer-Policy`, `X-Frame-Options`, `Permissions-Policy`, and a
      **nonce-based CSP** — `strict-dynamic` with a fresh nonce per request, so
      inline script is forbidden except the pre-paint theme script, which reads
      the nonce from `x-nonce`
- [x] Server Action origin checks left at Next's default (not disabled)
- [x] **Also found:** `next.config.ts` allowed images from *any* HTTPS host,
      which makes the image optimiser an open proxy fetching arbitrary URLs on
      our bandwidth. Narrowed to the Blob storage hostname.

`style-src` keeps `'unsafe-inline'` on purpose: React sets `style` attributes
(the hero gradient among them). Inline *style* is a much smaller risk than
inline script, which is fully locked down.

### 0.5 Stock race at checkout ✅ done

`placeOrder` reads stock, then decrements it. Two shoppers buying the last unit
at the same moment can both succeed and drive stock negative.

- [x] Conditional decrement inside the transaction — `updateMany` with
      `where: { stock: { gte: qty } }`; zero rows matched throws
      `OutOfStockError`, rolling the whole order back
- [x] `CHECK ("stock" >= 0)` on `Product` as a backstop
- [x] Regression test run: two buyers racing for one unit → exactly one sale,
      final stock 0, never negative

---

## Phase 1 — Things a real shop cannot open without

### 1.1 Payments — framework done, adapter pending

`paymentMethod` is currently just a label on the order; no money moves.

- [ ] **Decide the provider.** Note **Stripe cannot pay out to a Georgian
      entity** — it is not a supported country — so realistically this is Bank
      of Georgia, TBC, or an aggregator like PayZe (simpler onboarding for a
      small shop, covers both banks' cards). Start the merchant application
      early; the paperwork is the long pole, not the code.
- [x] Server-side amount — `startPayment` reads the total from the order row
      and the webhook **refuses to capture** if the gateway reports a different
      figure, marking the attempt failed instead
- [x] Idempotent webhook — `/api/payments/[provider]/webhook`. A unique index
      on `(paymentId, externalId)` inside the same transaction as the capture
      means a redelivered event is a no-op, and it still answers 200 so the
      gateway stops retrying
- [x] Failure, timeout and abandoned — `PaymentState` covers
      `failed`/`cancelled`/`expired`, and `expireStalePayments()` sweeps
      attempts nobody returned to after 30 minutes
- [x] Cash on delivery kept — the `manual` adapter records the attempt with no
      gateway, and an admin marks it received from the dashboard
- [x] Refund writes `paymentStatus: refunded`, cancels the order and returns
      every line through the stock ledger. Verified: stock +2, ledger balance
      matches, order flipped
- [x] `Payment` / `PaymentEvent` tables, amounts in **tetri as integers** —
      float must never decide what a card is charged

**Adding a gateway is now one file.** Implement `Adapter` from
`src/lib/payments/types.ts` (three methods: `start`, `parseWebhook`, `refund`),
add its id to the `PaymentProvider` enum, register it in
`src/lib/payments/index.ts`. Everything else — the payment row, idempotency,
the order transition, the ledger — is already written and tested.

**Known gap:** `Product.price` and `Order.total` are `Float`. Fine for display,
but money in floats is a latent rounding bug; `Payment.amount` is integer tetri
for exactly that reason. Converting the rest is a wide but mechanical change,
worth doing before real money moves.

**Effort:** ~3–5 days including bank paperwork, which is the slow part — start
the merchant application early, it can take weeks.

### 1.2 Real product images — blocked on you

All 40 products share `public/products/placeholder.svg`. This is the single
most visible thing holding the design back.

- [ ] Image upload in the dashboard — [Vercel Blob](https://vercel.com/docs/vercel-blob)
      or UploadThing. **Needs a Blob store and `BLOB_READ_WRITE_TOKEN`**, which
      only you can create.
- [ ] **The photos themselves.** This is the real blocker: I cannot source
      genuine product photography, and reusing brand or marketplace images
      would be someone else's copyright on a site that takes money.
- [ ] Multiple images per product with a gallery on the product page
- [ ] Serve via `next/image` with proper `sizes`, AVIF/WebP
- [ ] Validate type and size on upload; strip EXIF
- [ ] Alt text per image, in both languages, for a11y and SEO

### 1.3 Order lifecycle emails ✅ done

- [x] "We got your order" — sent after the order transaction commits, so a
      mail outage cannot turn a completed basket into an error
- [x] "Your order shipped" — fires only on the real transition;
      `updateOrderStatus` returns early when the status is unchanged, so
      re-saving cannot mail the customer twice
- [x] Tracking link and order number in both, localised, each with a
      plain-text twin. A blank address is a silent no-op — email is optional
      at checkout
- [x] Verified end to end on production: order placed → confirmation, moved to
      shipped → notice, both accepted by the provider

### 1.4 Legal pages with real content — blocked on you

`/privacy`, `/terms`, `/returns`, `/warranty`, `/shipping` exist but are
placeholders. For a real Georgian shop these are legally required.

- [ ] Privacy policy naming the actual data collected and the processors
      (Vercel, Prisma, the mail and payment providers)
- [ ] Terms of sale, refund and returns policy per Georgian consumer law
- [ ] Business details: legal entity, tax ID, real contact address. **I will
      not invent these** — a made-up tax ID or address on a page that governs a
      sale is worse than no page. Send them and I will write the pages.
- [ ] Cookie consent if you add any non-essential tracking

---

## Phase 2 — Testing, so it stays working

There is currently **no automated test of any kind** and no CI. Every
regression so far has been caught by hand.

### 2.1 End-to-end (Playwright)

- [ ] Guest checkout, including a coupon, start to finish
- [ ] Signed-in checkout, order appears under `/account`
- [ ] Register → verify → sign in → sign out
- [ ] Forgot password → reset → sign in with the new password
- [ ] Admin: edit a product, move an order through every status
- [ ] Authorisation: a customer cannot reach `/dashboard`; a stranger cannot
      open someone else's `/order/<number>`
- [ ] Both locales and both themes on the critical path

### 2.2 Unit (Vitest)

- [ ] Coupon maths: percent, fixed, minimum total, expiry, exhausted, capped
      at the subtotal
- [ ] Cart totals and the free-shipping threshold boundary
- [ ] `formatPrice` in both locales (this has broken hydration before)
- [ ] Password hashing and session token signing/expiry
- [ ] Order-number generation and collision retry

### 2.3 CI

- [ ] GitHub Actions: lint + typecheck + build + tests on every PR
- [ ] Block merges to `main` on a red build
- [ ] Run migrations against a throwaway Postgres in CI
- [ ] Dependabot or Renovate for security updates

### 2.4 Manual QA pass

- [ ] Click **every** button, link and form on every page, in both languages
- [ ] Keyboard-only pass: tab order, visible focus, Escape closes overlays
- [ ] Screen-reader pass on checkout
- [ ] Real devices: iOS Safari and Android Chrome, not just a resized window
- [ ] Slow-3G and offline behaviour

---

## Phase 3 — Operations

- [ ] **Error monitoring** — Sentry, with source maps, so you learn about
      failures before customers report them
- [ ] **Uptime check** — Better Stack or similar, alerting to your phone
- [ ] **Backups** — confirm Prisma Postgres retention and *actually restore
      once* to prove it works
- [ ] **Analytics** — Vercel Analytics or Plausible (privacy-friendly, no
      cookie banner needed)
- [ ] **Admin audit log** — who changed which price, who cancelled which order
- [ ] **Session revocation** — a `sessionVersion` on the user so "sign out
      everywhere" and a password change can invalidate old cookies
- [ ] **Custom domain** — `bazari.ge` reads far better than a `vercel.app`
      subdomain, on a CV especially
- [ ] **Staging environment** — a preview database so migrations are rehearsed

---

## Phase 4 — Design and growth

### 4.1 Design

- [ ] Real product photography (see 1.2 — everything else is cosmetic until
      the placeholder is gone)
- [ ] Product page: image gallery, clearer delivery estimate, sticky buy box
- [ ] Empty states with a suggested next action rather than a bare message
- [ ] Loading skeletons on catalog and dashboard instead of layout jumps
- [ ] Micro-interactions: add-to-cart confirmation, optimistic quantity updates
- [ ] Print stylesheet for the order confirmation (customers print invoices)
- [ ] A designed 404 and 500 page
- [ ] Full contrast audit against WCAG AA in both themes

### 4.2 SEO

- [ ] Per-page `description` and Open Graph tags
- [ ] Generated OG images per product
- [ ] `Product` and `BreadcrumbList` JSON-LD structured data
- [ ] `hreflang` for the two locales
- [ ] **Revisit the fixed title.** Every page currently renders the exact same
      `<title>`, which was a deliberate request — but it is the single biggest
      SEO weakness, since search engines rely on it heavily. A good compromise:
      keep `Bazari - ონლაინ მაღაზია` on the home page and append the product or
      category name elsewhere (`Anker PowerCore 20000mAh — Bazari`). Worth
      deciding consciously rather than by default.

### 4.3 Contact chatbot

Three options, cheapest first:

1. **Third-party widget** (Crisp, Tawk.to) — a day's work, real human chat, but
   a generic look and another company's script on your page.
2. **Rule-based FAQ bot** — a few days, no running cost, fully on-brand;
   answers a fixed set of questions and hands off to a contact form.
3. **LLM-backed assistant** (recommended) — Claude API over your own data:
   product catalogue, FAQ content and, for a signed-in customer, their order
   status. This is the option that doubles as a portfolio piece, given the
   AI-automation direction.

For option 3:

- [ ] `/api/chat` route, streaming, with the system prompt server-side only
- [ ] Retrieval over products and FAQ so answers cite real stock and prices
- [ ] Tool: look up an order — **only** for the signed-in owner
- [ ] Strict scope: refuse anything off-topic; never invent stock or delivery
      dates; escalate to a human contact form when unsure
- [ ] Rate limit per session and cap monthly spend
- [ ] Log conversations for review, with consent, and let users clear them
- [ ] Both languages; match the site's theme tokens
- [ ] Never let it perform an action that costs money or changes an order

**Effort:** ~1 week for option 3 done properly.

---

## Suggested order

| Week | Focus |
| --- | --- |
| 1 | Phase 0 in full — the reset-code hole, email, rate limiting, stock race |
| 2 | Product images + image upload; order emails; legal pages |
| 3 | Payments (start the bank application in week 1 — it is the long pole) |
| 4 | Playwright + Vitest + CI, then the manual QA sweep |
| 5 | Monitoring, backups, custom domain, session revocation |
| 6+ | Design polish, SEO, then the chatbot |

## For the portfolio specifically

Different from the shop checklist — a reviewer looks for evidence of judgement,
not feature count:

- [ ] A README that leads with **why**: the decisions and the trade-offs, not a
      feature list
- [ ] Screenshots and a short screen recording, so nobody has to run it
- [ ] Keep the demo logins working, but only for a demo account with no real
      power, on seeded data
- [ ] Write up two or three real problems you hit and how you diagnosed them —
      the Postgres case-sensitivity break, the hydration mismatch on prices, the
      sequential-order-number exposure. That reads far better than "built an
      e-commerce site"
- [ ] Green CI badge on the repo
- [ ] A live link that loads fast and works on a phone
