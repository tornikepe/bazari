<div align="center">

# Luto

A bilingual Georgian online shop: storefront, checkout, payments, and a staff dashboard that
runs the whole business from one place.

ქართული · English  ·  Next.js 16 App Router  ·  React 19  ·  PostgreSQL + Prisma 7  ·  Tailwind CSS v4

[Live](https://bazari-one.vercel.app) · [Source](https://github.com/tornikepe/bazari) · [DESIGN.md](DESIGN.md)

</div>

---

> The shop is called **Luto**. The repository, the Vercel project and the deployment URL still
> say `bazari`, which is what it was called while it was being built — renaming those breaks
> links and buys nothing. The name on screen is a row in the database (`ShopSettings.name`) and
> nothing in this codebase hardcodes it, so changing it in Dashboard → Settings changes it
> everywhere: the bar, the tab, the footer, the share cards, the structured data, the dashboard
> rail and the signature on every email the shop sends.

Luto is a working shop, not a template. It takes orders, holds money against a bank transfer
or a card, prints an invoice, tracks what came back, counts what it cost to sell, and tells its
owner where the profit went. Everything on screen is read from the database — the stock, the
review stars, the delivery prices, the shop's own name and telephone number, the text of the
terms page. There is nothing hardcoded that a shop owner would ever need to change in the code.

Two languages everywhere, not as an afterthought: every product, every category, every info
page and every one of some two and a half thousand interface strings exists in Georgian and in English,
and the Georgian is set in its own typeface.

---

## Contents

- [Quick start](#quick-start)
- [Before you go live](#before-you-go-live)
- [Accounts and passwords](#accounts-and-passwords)
- [Environment variables](#environment-variables)
- [The storefront](#the-storefront)
- [The dashboard](#the-dashboard)
- [Payments](#payments)
- [The assistant](#the-assistant)
- [Security](#security)
- [Two languages, one typeface](#two-languages-one-typeface)
- [The data model](#the-data-model)
- [Scripts](#scripts)
- [Project structure](#project-structure)
- [Deploying](#deploying)
- [Backups and moving the database](#backups-and-moving-the-database)
- [Known limits](#known-limits)

---

## Quick start

**You need** Node 20+ and a PostgreSQL database.

```bash
git clone https://github.com/tornikepe/bazari.git
cd bazari
npm install
cp .env.example .env
```

Put a connection string in `DATABASE_URL`. Any Postgres works — Neon, Supabase, Railway, a
local server. For a throwaway one that expires by itself:

```bash
npx -y create-db@latest create -t 24h -j
```

Generate the secrets. **The seed refuses to run without them**, deliberately — see
[Accounts and passwords](#accounts-and-passwords):

```bash
npm run setup:credentials
```

That writes `AUTH_SECRET` and one password per seeded account into `.env`, prints nothing
secret, and never overwrites a value you already set, so it is safe to re-run.

Then create the schema, fill it, and start:

```bash
npm run db:setup
npm run dev
```

The shop is at `http://localhost:3000`, the dashboard at `/dashboard`.

> **The Prisma CLI reads `.env`, not `.env.local`.** `prisma.config.ts` loads `dotenv/config`
> and prefers `DIRECT_URL`. If `.env` holds your production string and `.env.local` your local
> one, prefix the command rather than trusting the file order:
>
> ```bash
> DATABASE_URL=… DIRECT_URL=… npx prisma migrate deploy
> ```

---

## Before you go live

Everything below is a decision or an account, not code. The shop runs without any of it — it
simply runs as a demonstration rather than as a business.

**Must be done, in this order:**

1. **A database that is not on a free tier.** This is the one that bites: a free Neon project
   runs out of its quota and then refuses *every* query, and the shop goes quiet. The pages now
   degrade rather than going blank — the home page says so at the top, the cart and order
   tracking keep working — but nothing can be bought until the database answers again. Watch
   the provider's usage page; the figure that grows fastest here is the transfer slips.
2. **Hosting that allows a shop.** Vercel's Hobby plan is for non-commercial use; a shop that
   takes money needs Pro. This is the only unavoidable monthly cost on day one.
3. **Rotate the seeded admin password** — Dashboard → Staff. The page says how old it is. Make
   the **recovery codes** first: eight one-time codes, shown once, and the only way back into a
   staff account on a deployment whose staff address receives no mail.
4. **Fill in the shop's own details** — Dashboard → Settings. Name, telephone, address, hours,
   and the **bank account holder's name**: an IBAN with no name beside it tells a customer
   nothing about who they are paying.
5. **Real prices, real stock, real cost prices.** The cost price is what every margin and profit
   figure in the dashboard is calculated from; left at zero, those pages lie.
6. **A domain**, and with it a mailbox. Until the staff address is on a domain you own and read,
   password resets and the second sign-in step cannot work — see the environment table.
7. **Clear the test data** on the day you open:
   ```bash
   npm run db:backup
   npm run db:reset-live -- --yes
   ```
   It removes test orders and customer accounts. The catalogue, delivery zones, coupons,
   settings and your own staff account stay.

**Should be done, but the shop sells without them:**

- **A payment gateway.** Four adapters are written — PayPal, Coinbase Commerce, TBC, BOG — and
  none is configured. Until one is, the shop works by bank transfer: the customer uploads a
  photograph of the slip, you confirm when the money arrives, and the commission is zero. The
  two Georgian banks need a contract, which needs a registered business first.
- **Business registration**, if you are taking money in Georgia. Banks and PayPal will not open
  a merchant account without it.
- **Social accounts.** Dashboard → Settings → Social. A blank field draws no mark at all, which
  is better than a mark that opens instagram.com rather than your page.
- **A logo and a tagline.** Both blank fall back to a default mark and a generic sentence.
- **`CRON_SECRET`**, or the daily job — expiring stale payment attempts, writing to people who
  left a cart — never runs.
- **An uptime monitor** on `/api/health`, which answers `{ ok, db, ms }`.

---

## Accounts and passwords

The seed creates three accounts, and it will not invent a password for any of them.

| Account | Role | What it can do |
| --- | --- | --- |
| `ADMIN_EMAIL` | `admin` | Everything: the whole dashboard, and every control on it. |
| `VIEWER_EMAIL` | `viewer` | Sees every dashboard page, changes nothing. Enforced in the Server Actions, not by hiding buttons — the actions are reachable by direct POST. |
| `CUSTOMER_EMAIL` | `customer` | An ordinary shopper, for trying the storefront. |

`npm run setup:credentials` generates each password with `crypto.randomBytes` and writes it into
`.env`. Nothing is printed to the terminal and nothing is committed — `.env` is gitignored. The
seed hashes what it finds there with **scrypt** and stores only the hash.

**Signing up can never mint staff.** Registration hardcodes `role: "customer"`; the only ways
to an `admin` or `viewer` row are the seed and an invitation sent from Dashboard → Staff.

**Rotating the admin password** is a button: Dashboard → Staff → generate. It mints a strong
password, shows it once, stores the hash, and raises the account's `sessionVersion`, which
signs out every existing session on that account immediately.

**Recovery codes** are the way back in when the password is gone: Dashboard → Staff makes eight
one-time codes, shows them once and stores only their scrypt hashes. `/recover` takes an address
and one code, spends it, signs every other session out, and lands on the page where a new
password is made. Every refusal there reads the same, so the form cannot be used to find out who
works here, and it is metered five tries to the quarter hour by address and by caller.

They exist because the usual way back does not work here. This deployment's staff address is on
a domain it receives no mail at, so "email me a reset link" sends the link nowhere. They are also
what makes the generated password safe to keep: a password nobody memorises is only a good
password when losing it is survivable.

**A second sign-in step** is available for staff: the password, then a six-digit code emailed to
the address on the account. It is off unless `STAFF_2FA=1` **and** a mailer is configured. The
switch is explicit on purpose — when it was keyed on the mailer alone, setting a mail key locked
the owner out, because the code went to an address on a domain the shop does not receive mail
at. Turn it on only once you are certain you read that mailbox.

**Who last used the dashboard** is on the staff list: every account says when it last signed in,
or that it never has.

---

## Environment variables

Copy `.env.example` to `.env` and fill it in. `npm run setup:credentials` generates the secrets
and the seeded passwords into that file for you — nothing is printed to the terminal and `.env`
is gitignored.

In production these go in **Vercel → Settings → Environment Variables**, and then the project
must be **redeployed**: a variable added after a build is not in that build.

### Required — the shop will not run without these

| Variable | What it is | How to write it |
| --- | --- | --- |
| `DATABASE_URL` | Where the shop keeps everything. Any Postgres: Neon, Supabase, Prisma Postgres, Railway, a local server. Use the **pooled** string if the provider offers two. | `postgresql://user:pass@host:5432/db?sslmode=require` |
| `AUTH_SECRET` | The key the session cookie is signed with. Changing it signs everybody out. | 32+ random bytes: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | The staff account the seed **creates**. The password is only used at creation — rotating it in Dashboard → Staff sticks, because re-seeding never rewrites a staff password. Minimum 12 characters; the seed refuses to run without one. | `admin@luto.ge` / a generated string |
| `VIEWER_EMAIL` / `VIEWER_PASSWORD` | Read-only staff. Sees every dashboard page, changes nothing. Same 12-character rule — it cannot write, but it can read every order, address and margin. | `viewer@luto.ge` / a generated string |
| `CUSTOMER_EMAIL` / `CUSTOMER_PASSWORD` | A demo shopper, so checkout can be tried without signing up. Minimum 8. This one *is* reset on every re-seed, because being able to sign into it is the point. | `user@luto.ge` / anything memorable |

### Needed in production, optional locally

| Variable | What it is | How to write it |
| --- | --- | --- |
| `DIRECT_URL` | The **unpooled** connection, for migrations. Prisma Migrate holds a session-level lock and a transaction-mode pooler does not keep a session between statements — the symptom is a migration that hangs forever. Neon and Supabase hand out two strings; this is the other one. Leave it unset for a local Postgres with no pooler. | the same shape as `DATABASE_URL` |
| `NEXT_PUBLIC_SITE_URL` | The canonical origin. Everything that has to be absolute reads it: links in emails and invoices, the sitemap, the share images, the OAuth callbacks. Without it they all point at `localhost`. **Public on purpose** — it is the address of the site. | `https://luto.ge`, no trailing slash |
| `CRON_SECRET` | The bearer token `/api/cron/daily` demands. Without it the route refuses every caller, which is how an unconfigured deployment should behave — but it also means the daily job does nothing. | any long random string, same value in Vercel's cron settings |

### Email — without it nothing is ever sent

| Variable | What it is | How to write it |
| --- | --- | --- |
| `RESEND_API_KEY` | The sender for order confirmations, verification codes, password resets and low-stock warnings. Without a key the codes are written to the server log in development and nothing at all is sent in production. | from [resend.com](https://resend.com) → API Keys |
| `MAIL_FROM` | Who the mail comes from. Must be on a domain **verified with Resend**. Left blank, the shop signs with its own name and Resend's shared sender, which only ever reaches the account owner — fine for a first smoke test, useless for customers. | `Luto <noreply@luto.ge>` |
| `STAFF_2FA` | `1` asks staff for a six-digit code after the password. **Leave it off until the staff address is a mailbox somebody actually reads** — a code nobody can read is not a second factor, it is a locked door. Recovery codes (Dashboard → Staff) are the way back in on a deployment whose staff address receives no mail. | `1`, or blank |

### Optional — each feature is simply absent without its keys

| Variable | What it is | How to write it |
| --- | --- | --- |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | "Sign in with Google". The button only appears when **both** are set, so an unconfigured deployment shows a plain email form rather than a button that fails after a round trip. | [console.cloud.google.com](https://console.cloud.google.com/apis/credentials) → OAuth client ID (Web). Redirect URI: `https://<domain>/api/auth/google/callback` |
| `FACEBOOK_CLIENT_ID` / `FACEBOOK_CLIENT_SECRET` | The same for Facebook. It only returns an email once it has confirmed one, and this app refuses a sign-in without one, so the app needs the `email` permission approved before it works for anybody outside your test users. | [developers.facebook.com](https://developers.facebook.com/apps) → Facebook Login. Redirect: `https://<domain>/api/auth/facebook/callback` |
| `ANTHROPIC_API_KEY` *or* `GEMINI_API_KEY` | The shop assistant. With neither, the chat launcher is not rendered at all and the shop works exactly as before. | from [console.anthropic.com](https://console.anthropic.com) or [aistudio.google.com](https://aistudio.google.com/apikey) |
| `CHAT_PROVIDER` | Which one to use when both keys are present. | `anthropic` or `gemini` |
| `CHAT_MONTHLY_BUDGET_USD` / `CHAT_MONTHLY_REQUEST_CAP` | Hard ceilings for the month. The assistant stops answering rather than overspending. | `10` / `2000` |
| `DATABASE_POOL_MAX` | How many connections the pool may open. Set it when the host counts connections against you. | `5` |
| `DATABASE_CONSOLE_URL` | Where "open the database" in Dashboard → Database points. Guessed from the host for Neon and Prisma Postgres, so most deployments leave it blank. | the provider's console URL |
| `NEXT_PUBLIC_SENTRY_DSN` | Error reporting. Nothing is loaded without it. | from [sentry.io](https://sentry.io) → the project's DSN |
| `SENTRY_AUTH_TOKEN` / `SENTRY_ORG` / `SENTRY_PROJECT` | Uploads source maps at build time, so a stack trace names your code instead of a minified chunk. Build-time only. | from Sentry → Auth Tokens |
| `PAYMENT_SANDBOX` | `1` mounts a fake gateway at `/pay/sandbox` that calls the webhook back the way a real one does, so the whole card path can be walked without a merchant account. **Never set this in production.** | `1` locally, never on Vercel |

Four more are set by the platform and never by you: `NODE_ENV`, `VERCEL`, `VERCEL_ENV`,
`VERCEL_GIT_COMMIT_SHA`.

---

## The storefront

**Catalogue.** Filters by category, price, availability and sale; sorting; pagination that keeps
its place in the URL. Search runs against a generated `searchText` column, so a typo-tolerant
query is one index lookup, not a table scan.

What the shop will sell is one rule — `ON_SALE` in `src/lib/catalog.ts`: the product is switched
on **and** its category is one the shop is showing. Hiding a category therefore takes its goods
off the floor, everywhere at once: the catalogue, the search, the home page, the assistant, the
sitemap, the baskets already holding one, and checkout. The product's own page is the single
exception, and deliberately — somebody following a bookmark gets the page, with nothing in stock
on it.

**A product.** Gallery with a lightbox, specifications, cross-sells, recently viewed, stock
warnings, and a "tell me when it is back" address that is deleted the moment the message is
sent. Sizes and colours are real combinations with their own SKU, stock and price — a shop can
stop making "Red / XL" without withdrawing red or XL, and a shopper who picks a gone pair is
told so rather than handed a different one. The size opens the shop's own panel, not the
operating system's wheel, so a sold-out size can say so in the shop's own hand.

**Cart and wishlist.** Held in `localStorage`, so they survive a closed tab without an
account. What is in them is re-priced and re-checked against the database when the order is
actually placed, never trusted from the browser. Because they live in a browser they can name
products withdrawn months ago, so each page load asks the shop which of them it still sells and
sweeps out the rest — product and size both. A call that fails removes nothing: a shop that
cannot be reached has not withdrawn anything. A line is a card a thumb can swipe away. Both
pages read down the middle on a phone.

**Checkout.** Saved addresses, delivery zones with their own prices and a free-delivery
threshold, coupons, and a summary panel that scrolls with the page. Paying by bank transfer
shows the shop's account and **requires a photograph of the transfer slip** before the order
can be placed — the shop has no gateway telling it the money arrived, so the slip is the only
evidence there will ever be. The photo is shrunk in the browser before it is sent, and read from
its own leading bytes on arrival rather than from the `type` the request claims: JPEG, PNG, WebP,
AVIF or the HEIC an iPhone sends when the browser could not redraw it.

**After the order.** A confirmation page with the status timeline, a PDF invoice, an emailed
receipt, order tracking by number and phone for a guest, and a returns panel that opens inside
the shop's return window.

**Info pages.** About, contact, FAQ, shipping, returns, warranty, privacy, terms — all rows in
the database, edited from Dashboard → Pages, in both languages. `npm run db:refresh-pages`
restores them to the built-in copy.

**Throughout.** Light and dark themes with a pre-paint script so there is no flash of the wrong
one; a brand colour that regenerates the whole palette; smooth scrolling; the safe-area insets
of a notched phone respected on every fixed edge.

---

## The dashboard

`/dashboard`, staff only. Seventeen pages.

| Page | What it is for |
| --- | --- |
| **Home** | Today's takings, orders awaiting a decision, stock about to run out. |
| **Orders** | Every order, its items as they were priced that day, its event log, its payments, its refunds, and the transfer slip to check against the bank. |
| **Products** | Create and edit, in both languages: photos, specifications, options and generated variants, price, cost, stock. |
| **Categories** | The tree, with its own bilingual names and images, and an eye on every row: hiding one puts the whole shelf away, goods included. |
| **Coupons** | Percentage or fixed, per-order minimums, expiry, usage caps. |
| **Customers** | Who they are, what they bought, what they are owed. |
| **Reviews** | Moderation. Only a customer whose order of that product was *delivered* can write one, so a star on the storefront is a fact. |
| **Returns** | Requests, their reasons, their items, and the refund. |
| **Payments** | The four gateways, each with its own card, its own credentials and its own test mode. |
| **Margins** | Buying price and selling price edited where they are read, product by product, and what is left. |
| **Analytics** | Six questions of every product and category: seen, opened, carted, bought, what a customer cost to bring, what profit was left. Ad spend is the one figure typed in by hand, and it has its own card. |
| **Traffic** | Visitors and pages, counted without a cookie — numbers and a hash that cannot be turned back into a person. The page says so at the top. |
| **Pages** | The text of every info page, both languages. |
| **Settings** | Name, tagline, telephone, address, hours, delivery zones and prices, tax rate, return window, brand colour, bank details. |
| **Staff** | Invitations, roles, when each account last signed in, the password generator and how old the password is, the eight recovery codes, and whether the second sign-in step is on. |
| **Audit** | Who changed what, and what it was before. |
| **Database** | What it is, where it is, how many rows each table holds, and a link to the provider's own console. A window, nothing more. |

---

## Payments

| Method | How it settles |
| --- | --- |
| **Bank transfer** | The shop's account is shown, a photograph of the slip is required, and the shop marks the order paid once the money lands. |
| **Card** | Whichever gateway is enabled and configured. |
| **TBC**, **BOG** | Georgian bank gateways. Each needs a merchant agreement. |
| **PayPal** | developer.paypal.com → Create App. |
| **Crypto** | Coinbase Commerce. |

Each gateway is an adapter behind one interface — `isConfigured`, `start`, `verify`, `refund` —
so a fifth is a file, not a refactor. Credentials are typed into Dashboard → Payments and stored
encrypted; they are never environment variables, so adding a gateway does not need a redeploy.

Every gateway confirms through a signed webhook, and the order is only moved by the webhook, not
by the shopper's return to the site — a browser that never comes back must not lose an order,
and a browser that comes back twice must not pay for one twice.

`PAYMENT_SANDBOX=1` mounts a gateway that takes no money: a hosted page inside this app with
"pay" and "decline" on it, calling the real webhook the way a real gateway does. It exists so
the whole path can be exercised locally. **It must never be set in production.**

---

## The assistant

A chat panel that answers about products, delivery, returns and the shopper's own orders. It
runs on Anthropic or Gemini, reads the catalogue and the info pages through retrieval, and can
look up an order for the person who placed it — and only for them.

It has two hard ceilings: `CHAT_MONTHLY_BUDGET_USD` and `CHAT_MONTHLY_REQUEST_CAP`. Spending is
recorded per request in `ChatUsage`. When either ceiling is reached the assistant says it is
unavailable rather than quietly costing money.

---

## Security

**Sessions.** A signed cookie, `<userId>.<sessionVersion>.<expiresAt>.<hmac>`, httpOnly,
sameSite lax, secure over TLS. `sessionVersion` is the revocation lever: raising it on a user
row invalidates every cookie that account has ever been given, which is what a password rotation
and a forced sign-out both do.

**Passwords.** scrypt, per-user salt. Never logged, never returned from a Server Action, never
in a URL.

**Rate limiting.** A fixed-window limiter in Postgres, keyed per IP *and* per account — the
first stops one host spraying many accounts, the second stops a botnet grinding one. It covers
sign-in, the staff code, registration, password reset, coupons, reviews, search, orders and the
assistant.

**Content Security Policy.** Nonce-based, generated per request in `src/proxy.ts` (this version
of Next names the middleware `proxy.ts`). `script-src` allows no inline script except the nonced
bootstrap, with `strict-dynamic` for the chunks. HSTS, `X-Content-Type-Options`, a referrer
policy and a permissions policy travel with it.

**Authorisation is in the actions.** Every Server Action checks the role itself. Hiding a button
hides nothing: an action is reachable by direct POST.

**Private files.** Transfer slips, review photos and avatars are served from routes that check
who is asking. A stranger asking for someone else's slip gets a 404, not a 403 — an order number
that exists must not answer differently from one that does not.

**Recovery without a mailbox.** Eight one-time codes per staff account, scrypt-hashed like a
password, spent on use and redeemed at `/recover` — see *Accounts and passwords* above. This is
the only way back into a staff account on this deployment; never propose an email-based reset
for staff until the address on the account is a mailbox somebody reads.

**Audit trail.** Every staff change is written to `AuditEntry` with the before and after,
including the rotations, the recovery codes and the sign-ins that used one.

---

## Two languages, one typeface

Locale lives in a cookie, is read on the server, and is baked into the very first render — no
flash of the wrong language. Every string is in `src/lib/i18n.ts`, in both languages, with
`fill()` for interpolation and separate singular and plural forms where Georgian needs them.

The Georgian is set in **BPG Nino Mtavruli Bold**, self-hosted and scoped with a `unicode-range`
to the three Georgian blocks. The Latin half is **Inter 700**, which sits at the same apparent
size and weight, so a line mixing the two reads as one line, and which carries the lari sign,
the multiplication sign and the minus that the Georgian face does not draw.

Two details in the font pipeline are load-bearing:

- **`adjustFontFallback: false`.** Next would otherwise add an unscoped `bpgNino Fallback`
  family directly behind a face that *is* scoped, and it would swallow every Latin letter and
  digit before Inter was ever reached. A face scoped to one script must not be followed by an
  unscoped copy of itself.
- **The outlines were moved.** BPG Nino as published draws its glyphs about four and a half per
  cent of the em above the baseline. On its own that is invisible; beside a Latin face that sits
  on the baseline properly, every digit looked dropped. No CSS can move one font's glyphs
  relative to another's inside a line, so all 169 glyphs were shifted down 92 units once, in the
  file, and the two faces now share a baseline.

Prices are built by hand rather than with `Intl.NumberFormat`, because Node and the browser ship
different ICU data for `ka-GE` and hydration failed on the decimal mark. The Georgian form
groups thousands with a **no-break** space and keeps the lari sign attached, so an amount is one
word and can never be split across a line ending.

---

## The data model

37 models in `prisma/schema.prisma`, 50 migrations. The shape of it:

- **Catalogue** — `Category`, `Product`, `ProductImage`, `ProductOption`, `ProductOptionValue`,
  `ProductVariant`, `VariantValue`, `StockMovement`, `StockAlert`.
- **Selling** — `Order`, `OrderItem`, `OrderEvent`, `Coupon`, `DeliveryZone`, `Payment`,
  `PaymentEvent`, `PaymentGateway`, `ReturnRequest`, `ReturnItem`, `RefundAccount`.
- **People** — `User`, `Address`, `Favorite`, `Review`, `ReviewPhoto`, `VerificationToken`,
  `SavedView`, `CartSnapshot`.
- **The shop itself** — `ShopSettings`, `InfoPage`, `AuditEntry`, `RateLimit`, `ChatUsage`.
- **Counting** — `PageView`, `ProductEvent`, `DailyVisitor`, `MarketingSpend`.

Two rules run through all of it. **Money is tetri**, a whole number, everywhere — the single
division by 100 is in `formatPrice`, so no arithmetic anywhere else can round. And **an order
is a snapshot**: name, price, size label, delivery zone and tax rate are all copied onto the
order when it is placed, so an invoice printed next year says what was actually sold, however
the catalogue has changed since.

---

## Scripts

```bash
npm run dev                # development server
npm run build              # production build
npm run typecheck          # tsc --noEmit
npm run lint               # eslint

npm run setup:credentials  # generate AUTH_SECRET and the seeded passwords into .env
npm run db:setup           # migrate deploy + seed
npm run db:migrate         # prisma migrate dev
npm run db:seed            # fill an empty database
npm run db:studio          # Prisma Studio
npm run db:reset           # drop and rebuild — local only

npm run db:backup          # every table to backups/, timestamped JSON
npm run db:restore         # put one back
npm run db:verify          # is it usable
npm run db:audit           # is anything in it wrong
npm run db:reset-live      # clear orders and test data, keep the catalogue
npm run db:refresh-pages   # restore the info pages to their built-in copy
npm run db:import          # bulk product import — format is at the top of the script
```

---

## Project structure

```
src/
  app/
    (shop)/          storefront — catalogue, product, cart, checkout, account, info pages
    (auth)/          sign in, register, verify, invite, forgot password
    dashboard/       staff dashboard, sixteen pages behind one panel layout
    actions/         Server Actions — every write in the app, every one role-checked
    api/             webhooks, images, search, invoices, receipts, cron, health
    globals.css      Tailwind v4 tokens and the whole design system
  components/        by area: layout, product, cart, checkout, account, admin, ui, providers
  lib/               the business: payments, analytics, i18n, auth, mail, variants, tax, …
  generated/prisma/  the Prisma client, generated here rather than into node_modules
  proxy.ts           security headers and the CSP nonce
prisma/
  schema.prisma      37 models
  migrations/        50, applied in order
scripts/             the npm run db:* tools
backups/             gitignored
```

---

## Deploying

Vercel, from `main`. The build is a plain `next build` — **it never applies migrations**. The
order matters:

```bash
npm run db:backup                 # 1. always first
npx prisma migrate deploy         # 2. production schema
git push origin main              # 3. the code that needs it
```

Set the environment variables in Vercel → Settings → Environment Variables, then redeploy: a
variable added after a build is not in that build.

`vercel.json` schedules `/api/cron/daily` at 06:00 UTC. It expires payment attempts nobody came
back for and writes once to anyone who left a cart for a day. It needs `CRON_SECRET`; without
one it refuses every caller, which is the right way for an unconfigured deployment to behave.

`/api/health` answers `{ ok, db, ms }` for an uptime monitor.

---

## Backups and moving the database

```bash
npm run db:backup     # every table to backups/luto-<timestamp>.json
npm run db:restore    # and back again
npm run db:verify     # the schema is complete and the app can read it
npm run db:audit      # nothing inside it contradicts anything else
```

A backup nobody has restored is not a backup. Restore one into a throwaway database and run
`db:verify` against it before you rely on the file.

To move to another Postgres: put both strings in `.env`, `npx prisma migrate deploy` against the
new one, restore, then run `db:verify` and `db:audit`. Keep the database in the same region as
the compute — the `x-vercel-id` header names the edge and the compute region, and a shop whose
database is an ocean away pays for it on every page.

---

## Known limits

- **Everything uploaded lives in Postgres** — product photos, avatars, review photos and
  transfer slips — served through routes with `immutable` cache headers, so the CDN answers
  after the first hit and the database is not touched again. Simple, and no second service to
  configure. The figure to watch is the slips: they are the largest thing a shopper uploads
  (about 300 kB each, one per bank-transfer order), and at a couple of thousand orders they
  outweigh the whole catalogue. Either move to a larger database plan, or expire them — a slip
  for money that arrived six months ago is dead weight and somebody else's personal data.
- **A database on a free tier will stop the shop.** Neon's free project refuses every query
  once its quota is spent — not a slow query, a refused one. The chrome and the written pages
  survive it (see *Before you go live*), but nothing can be bought until it answers again.
- **No test suite.** There was one; it was removed deliberately. CI runs lint, typecheck and a
  migrate-from-empty check, and changes are verified against a real browser instead.
- **The plan is not in this repository.** What is left to do before the shop opens lives in a
  `ROADMAP.md` beside the checkout, untracked on purpose: it is the owner's business, not the
  codebase's.
- **The gateway adapters are written but not yet exercised against live merchant accounts.**
  TBC and BOG both need a contract first. `PAYMENT_SANDBOX=1` covers the whole path locally.
- **Georgian phone numbers only** in the validation — this is a Georgian shop.

---

<div align="center">
<sub>Built with Claude Code.</sub>
</div>
