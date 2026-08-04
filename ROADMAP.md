# Bazari — road to production

| | |
| --- | --- |
| **Security (Phase 0)** | ✅ complete |
| **Payments** | 🟡 framework done and tested · no gateway |
| **Email** | 🟡 works · only reaches your own inbox until a domain is verified |
| **Testing** | ✅ 190 unit · 42 e2e · CI on every push |
| **Contact assistant** | ✅ live on Gemini's free tier · answers verified against the real catalogue |
| **Product photos** | ❌ one placeholder for all 40 |
| **Legal pages** | 🟡 technical half written · business details missing |
| **Money handling** | ✅ integer tetri throughout |
| **Can it take a real order today?** | **No** — A1 and A2 below |

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

## 1.4 SEO, print and legal

| # | Item |
| --- | --- |
| ✅ | `Product` + `BreadcrumbList` JSON-LD on product pages, carrying the CSP nonce so the tag is not blocked. No rating or review fields — the shop has neither, and claiming otherwise in markup is penalised |
| ✅ | Print stylesheet — an order confirmation prints as ink on white, without header, footer or buttons |
| ✅ | Privacy policy, technical half — every stored field, all four cookies with lifetimes, the three processors, retention periods |
| ✅ | Per-page descriptions and Open Graph on product and info pages |

## 1.5 Design and responsive

| # | Item |
| --- | --- |
| ✅ | Animated landing hero — drifting orbs, masked grid, headline sheen, live brand strip from real catalogue rows. Transform/opacity only, behind `prefers-reduced-motion` |
| ✅ | **Fixed: text spilled out of buttons on phones.** `.btn` had `white-space: nowrap` on a fixed height, so long Georgian labels escaped the button. Buttons now wrap and grow; type size untouched |
| ✅ | **Fixed: product grid was 2 columns at 320px**, leaving cards ~130px wide — nothing fitted. Single column below 380px |
| ✅ | Designed 404 (with a search box, not a dead end) and a 500 error page |
| ✅ | Responsive regression test — 10 pages × 3 widths × both locales, fails on any visible overflow |

## 1.6 Money as integers

| # | Item |
| --- | --- |
| ✅ | Every amount — product prices, cost, order totals, coupon values, line items — is now **integer tetri**, not `Float` |
| ✅ | Migration rounds before casting, so a stored `149.98999999999998` becomes `14999` rather than `14998` |
| ✅ | `formatPrice` is the single place that divides by 100, using integer division |
| ✅ | `placeOrder` needs no rounding at all: whole price × integer quantity is exact |
| ✅ | Admin form still takes lari (what a person thinks in); one conversion on the write path |
| ✅ | Catalogue URLs keep lari — `?minPrice=100` is what you would share |
| ✅ | Cart key bumped to `v2`: a v1 basket held lari and would have priced ₾149 at ₾1.49 |
| ✅ | Verified on live data — every amount whole, every order reconciles |

## 1.7 Contact assistant (B6)

Streamed from `/api/chat` as newline-delimited JSON. **Gemini on Google's free
tier by default**, so it costs nothing to run; Claude Opus 5 is a key swap away
when you want the better answer.

| # | Item | Detail |
| --- | --- | --- |
| ✅ | Answers from the shop, not from memory | The category list, product count, price range and the information pages go into the system prompt, all **counted from the database**. Prices and stock come from live tool calls, so a figure it quotes is the one in the table when it was asked |
| ✅ | Four tools, **all reads** | `search_products` · `get_product` · `list_categories` · `lookup_order`. There is no tool that writes — the promise that a conversation can't change an order or move money is enforced by the absence of the capability, not by asking the model nicely |
| ✅ | Order lookup locked to the owner | The model passes an order number and never an identity. Ownership is resolved from the request's own cookies — a signed-in account, or the signed receipt cookie a guest checkout leaves behind. An **admin session grants nothing here**; staff have the dashboard. Someone else's real order reads exactly like a made-up one, so the chat can't be used to probe which numbers exist |
| ✅ | Never leaks a customer's details | The lookup selects status, dates, items and total. Name, phone, email and street address are not selected at all, so they cannot reach a transcript even for the order's own owner |
| ✅ | Rate limit | 30 messages/hour per browser, 90/hour per address, on the same Postgres limiter the auth endpoints use |
| ✅ | Two monthly ceilings | **Money**, counted from the token usage each response reports — input, output, cache read and cache write priced separately, because folding a cache read into input overstates a cached conversation about tenfold. And **requests**, optional, because on a free tier the money cap is not a small number but a structurally unreachable one: nothing multiplied by any number of requests is still nothing. Both fail **closed** — if the counter can't be read the request is declined, since the failure mode here is an unbounded bill |
| ✅ | Provider is pluggable | One `ChatProvider` interface, same idiom as the payments `Adapter`. Gemini and Claude behind it; adding a third is writing an adapter and registering it. Selected by which key is present — and naming a provider whose key is missing switches the assistant **off** rather than quietly falling back, so a forgotten key is visible instead of being served by the free tier for months |
| ✅ | Free tier disclosed, not glossed over | Google states that free-tier content is used to improve its products, so the privacy page names Google as a processor, says exactly what the assistant receives, and tells visitors not to type real personal details |
| ✅ | Prompt caching | The standing context is cached per locale for five minutes so the prefix stays byte-identical between messages — a prefix that changes is a cache that never hits |
| ✅ | Both languages | Answers in the site's language by default, and switches to whatever the visitor writes in |
| ✅ | Off by default | No API key, no launcher. Decided on the server and passed down, so an unconfigured deployment shows nothing rather than a button that fails |
| ✅ | Strict scope | Shop questions only, and tool output is treated as data — a product description that reads like an instruction is still a product description |
| ✅ | Links are same-origin by construction | Paths in an answer are linked only against an allowlist of routes the app actually has, so nothing the model writes can become an off-site destination |

Verified end to end in the browser: the gates run in order, both rate-limit
buckets and the monthly request counter increment, the stream reaches the
browser, and a failed upstream call renders as a readable message rather than an
empty bubble. The panel fits 320px in both languages with zero overflow.
**The answers are now verified against the live catalogue.** It quotes real
prices and stock, retries a Georgian plural on the shorter stem when the first
search misses (the language declines its nouns, so "ყურსასმენები" does not
match a product named "ყურსასმენი"), refuses an order number that isn't the
asker's without speculating, and declines a direct "ignore your instructions".

## 1.9 Design polish (B7)

| # | Item | Detail |
| --- | --- | --- |
| ✅ | WCAG AA contrast, both themes | A real audit, not a glance. It failed: `ink-400` — the shade used for the site's *smallest* text — sat at **2.42:1** on the page background, and every status badge was nearer 3:1 than 4.5:1. In dark mode white-on-brand managed 3.61:1. All 52 pairs now pass, and a test parses the values out of `globals.css` so a future edit can't quietly undo it |
| ✅ | `--color-brand-solid` split out | `brand-600` was doing two opposite jobs in dark mode: light enough to read *as* a link on a dark surface, dark enough for white text to read *on top* of it. One value cannot do both, so now it doesn't have to |
| ✅ | Form-field borders | Held to the 3:1 that WCAG asks of a component's boundary — an input's border is the only thing saying "you can type here". Card borders stay decorative at 1.22:1, which is correct |
| ✅ | Sticky buy bar | Appears once the real purchase panel scrolls away, on the product page where the description and related items are long. Publishes its height so the chat launcher steps over it rather than being covered — two fixed elements in one corner otherwise fight, and stylesheet order decides the winner |
| ✅ | Skeleton matched its grid | The skeleton hardcoded two columns from zero width while the catalogue renders one below 380px — so on a narrow phone the page reflowed the moment data arrived. A layout jump caused by the thing meant to prevent one. Both now read the same constant |
| ✅ | Add-to-cart confirmation · optimistic quantity · empty states | Already built earlier — verified rather than rewritten. The cart is `localStorage`, so quantity changes are already instant; there is no round trip to be optimistic about |

**Deliberately not done: a skeleton for the product page.** A `loading.tsx`
there starts the response streaming, and once headers are sent `notFound()`
can no longer set a status — a withdrawn product would answer **200**. Next
marks it `noindex`, so it isn't indexed, but it still reads as a soft 404. The
skeleton is not worth that. The e2e test says so, next to the assertion.

## 1.8 Earlier in the build

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

### ✅ A5. Switch the assistant on — DONE

Done — the key is in Vercel and the assistant is answering on the live site.
Verified against the real catalogue: it quotes real prices and stock, refuses
someone else's order number without speculating about why, and declines
off-topic requests including a direct instruction to ignore its rules.

**One limit worth knowing.** Google's free tier allows **five requests a
minute for the whole shop**, and a question needing a product lookup spends
two of them. Past that, visitors see "that's a lot of questions, try again
shortly" rather than an error. Fine for a portfolio site; the day it isn't,
`CHAT_PROVIDER=anthropic` with a paid key removes the ceiling.

Kept below for reference:

1. [aistudio.google.com/apikey](https://aistudio.google.com/apikey) → **Create API key**.
   No card, no billing setup.
2. Add it to Vercel — **paste it once**, on a single line. A key pasted twice
   arrives with a newline in it, and that is exactly how `RESEND_API_KEY` broke
   every email on this project for an afternoon:

```bash
npx vercel env add GEMINI_API_KEY production
```

3. Optionally cap the month. On the free tier the money cap can never fire, so
   this is the one that does the work:

```bash
npx vercel env add CHAT_MONTHLY_REQUEST_CAP production
```

4. Redeploy

The key never passes through me. Once it is in, the launcher appears by itself
and I can check the answers against the real catalogue.

**One thing to know before you switch it on.** Google's free tier states that
conversations are used to improve Google's products. For a demo shop on seeded
data that is fine, and the privacy page now says so plainly. It stops being fine
the day the shop takes real orders — at that point either move to a paid tier or
switch to Claude, which is one variable:

```bash
npx vercel env add ANTHROPIC_API_KEY production
npx vercel env add CHAT_PROVIDER production   # "anthropic"
```

---

## Section B — Mine. Nothing blocking; say which.

Ordered by what I would do next.



### ✅ B8. Rest of SEO — done, minus one item that does not apply

| # | Item | Detail |
| --- | --- | --- |
| ✅ | Generated OG card per product | `opengraph-image.tsx`, rendered at request time with the product's real name, brand, price and stock. Typographic rather than photographic **because all forty products still share one placeholder** — a card built around the photo would show the same grey box every time |
| ✅ | Georgian actually renders | `ImageResponse` draws through Satori, which has no font-fallback chain the way a browser does: without Georgian glyphs supplied as bytes, every Georgian name would come out as empty boxes. Noto Sans Georgian (OFL, 59KB) is committed rather than fetched, so a deploy never depends on Google being reachable, and named in `outputFileTracingIncludes` so the serverless bundle actually contains it |
| ✅ | Site-level card | For every route without its own. Deliberately carries no product counts — it is generated at build time, so any figure in it would be frozen at deploy day |
| ✅ | `Organization` + `WebSite` JSON-LD | With a `SearchAction` pointing at `/catalog?q=`, which is the search this site really uses. **No `address`, `telephone`, `logo` or `sameAs`** — the shop has none of those, and inventing them in a block search engines read as a business record is worse than omitting it. A test asserts their absence |
| ❌ | `hreflang` | **Does not apply to this site, and adding it would be a lie.** |

**On hreflang.** It annotates *distinct URLs* that hold the same page in
different languages. Bazari has no such URLs: the locale lives in the
`cm_locale` cookie and both languages are served from the same address —
`/catalog` is `/catalog` in Georgian and in English. Emitting
`<link rel="alternate" hreflang="en" href="/catalog">` next to
`hreflang="ka" href="/catalog"` tells a crawler two different things about one
URL, which is worse than saying nothing.

Making it real means giving each language its own path (`/ka/catalog`,
`/en/catalog`) — a routing change touching every route, every internal link
and the language switcher, plus redirects so existing links survive. Worth
doing the day the shop targets search in both languages; not worth faking
before then.

### 🟡 B9. Blocked only on your inputs

- **B4 product images** *(needs A3)* — dashboard upload, gallery, `next/image`
  with AVIF/WebP, type and size validation, EXIF stripped, alt text in both
  languages. ~1 day once the token exists.
- **B5 payment adapter** *(needs A2)* — implement `Adapter` from
  `src/lib/payments/types.ts`: `start`, `parseWebhook`, `refund`. Everything
  else is written and tested. ~1 day.

---

## Section C — Before launch, not urgent yet

### 🟢 C1. Operations

Sentry with source maps · uptime alerting to your phone · confirm Prisma
Postgres retention and **actually restore once** to prove it works ·
privacy-friendly analytics · admin audit log (who changed which price) ·
session revocation via `sessionVersion` so a password change invalidates old
cookies · **custom domain** (`bazari.ge` reads far better than a `vercel.app`
subdomain on a CV) · staging database so migrations are rehearsed.

### 🟢 C4. Legal extras

Cookie consent — only if you add non-essential tracking. Nothing on the site
needs it today, and the privacy page says so.

---

# PART 3 — Order of work

| Step | Who | What | Why now |
| --- | --- | --- | --- |
| 1 | **You** | A1 — sending domain | No customer can receive an email until this is done |
| 2 | **You** | A2 — merchant application | Weeks of waiting; start the clock today |
| 3 | **You** | A3 — photos + Blob token | Largest visible improvement available |
| 5 | **Me** | B4 — image upload and gallery | Follows A3 |
| 6 | **Me** | B5 — payment adapter | When credentials arrive |
| 7 | **You + me** | A4 + legal pages finished | Before taking public orders |
| 8 | **Me** | B8 SEO — OG images, hreflang, Organization JSON-LD | Once the shop actually works |
| 9 | **Me** | C1 operations | Before real traffic |

**Right now:** you on A1, A2 and A3 — every remaining item of mine waits on one
of them, except the design polish and the rest of the SEO. A5 is five minutes
whenever you feel like it.

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
- The chatbot is the best single thing to talk about in an interview: it is the
  one feature where the interesting work is all in what it is *not allowed* to
  do — no tool that writes, ownership resolved from cookies rather than from
  anything the model says, and a spend cap that fails closed
- A green CI badge, and a live link that loads fast on a phone
