<div align="center">

# Bazari

**A bilingual e-commerce storefront with a full staff dashboard.**

ქართული · English  ·  Next.js 16 App Router  ·  PostgreSQL + Prisma 7  ·  Tailwind CSS v4

[Live demo](https://bazari-git-main-tornikepes-projects.vercel.app) · [Source](https://github.com/tornikepe/bazari)

</div>

---

> ### ⚠️ This is a demo, not a real shop
>
> Bazari reproduces the look and the mechanics of a real online store. It exists to demonstrate
> full-stack engineering, not to sell anything.
>
> - **No real payments.** Checkout records a cash-on-delivery order. No card is ever charged.
> - **Products, prices and orders are sample data.**
> - **Every product shares one bundled photo** until a real image URL is set in the dashboard.
>
> There are no invented review scores, supplier claims, phone numbers or addresses anywhere in
> the interface. If a number is on screen, it was counted from the database.

---

## Contents

- [Quick start](#quick-start) — running locally in about five minutes
- [Accounts and passwords](#accounts-and-passwords) — **how the three logins are created and assigned**
- [Google and Facebook sign-in](#google-and-facebook-sign-in) — what to register, and why it is needed
- [Environment variables](#environment-variables)
- [What it demonstrates](#what-it-demonstrates)
- [Tech stack](#tech-stack)
- [Scripts](#scripts)
- [Project structure](#project-structure)
- [Design system](#design-system)
- [Testing](#testing)
- [Deploying](#deploying)
- [Notes and known limits](#notes-and-known-limits)

---

## Quick start

**You need:** Node 20+ and a PostgreSQL database.

```bash
git clone https://github.com/tornikepe/bazari.git
cd bazari
npm install
cp .env.example .env
```

Put a PostgreSQL connection string in `DATABASE_URL`. Any Postgres works — Neon, Supabase,
Railway, a local server — or spin one up instantly:

```bash
npx create-db@latest
```

Now set the passwords for the three seeded accounts. **The seed will not run without them**, on
purpose — see [Accounts and passwords](#accounts-and-passwords) for why, and for what each
account is. Generate each one with:

```bash
node -e "console.log(require('crypto').randomBytes(18).toString('base64url'))"
```

Run it four times and put the results in `.env` as `AUTH_SECRET`, `ADMIN_PASSWORD`,
`VIEWER_PASSWORD` and `CUSTOMER_PASSWORD`.

Then create the schema and start:

```bash
npm run db:migrate
npm run db:seed
npm run dev
```

| | |
|---|---|
| Storefront | <http://localhost:3000> |
| Staff dashboard | <http://localhost:3000/dashboard> |
| Database browser | `npm run db:studio` |

---

## Accounts and passwords

This is the part people get stuck on, so it is written out in full.

### The three accounts

`npm run db:seed` creates exactly three users. Each one exists to demonstrate a different level
of access:

| Account | Default address | Role | What it can do |
|---|---|---|---|
| **Administrator** | `admin@bazari.ge` | `admin` | Everything: add and edit products, move orders through their statuses, take payments, issue refunds, manage categories. |
| **Viewer** | `viewer@bazari.ge` | `viewer` | Sees every dashboard page — orders, customers, margins, stock — and can change **nothing**. |
| **Customer** | `user@bazari.ge` | `customer` | Shops. Places orders and sees its own history. Cannot reach the dashboard at all. |

The addresses are defaults; override them with `ADMIN_EMAIL`, `VIEWER_EMAIL` and
`CUSTOMER_EMAIL`.

### How the passwords are created

**You choose them. Nothing is generated for you, and nothing has a default.**

Each password is one environment variable:

```bash
ADMIN_PASSWORD="..."      # minimum 12 characters
VIEWER_PASSWORD="..."     # minimum 12 characters
CUSTOMER_PASSWORD="..."   # minimum 8 characters
```

If any is missing or too short, `npm run db:seed` stops with an error naming the variable. It
does not fall back to a default and carry on.

That refusal is the point. A password that ships inside a repository is a password on every
deployment that forgot to change it, and the deployment most likely to forget is the one nobody
is watching. A seed that fails loudly costs five seconds; the alternative costs the shop.

The viewer is held to the same 12-character minimum as the admin. It cannot change anything,
but it can read every order, every customer's home address and every margin in the shop, so
"it's only read-only" is not a reason to admit a weak password. The customer's floor is 8: it
owns nothing but its own test orders and is meant to be typed by hand during a demo.

### How a password gets attached to an account

1. You write it into `.env`.
2. `npm run db:seed` reads the variable.
3. It is hashed — **scrypt**, with a random per-user salt — by `hashPassword` in
   [`src/lib/auth-hash.ts`](src/lib/auth-hash.ts).
4. Only the hash is stored in the `User` table. The plain password is never written anywhere.

At sign-in the same function hashes what was typed and compares the two. Nothing in the
application can read a password back out — which is why "what is my admin password?" has no
answer other than "look in your own `.env`".

```bash
grep '^ADMIN_PASSWORD' .env
```

### Re-running the seed

`npm run db:seed` is idempotent and safe to re-run. It **upserts** the three accounts, so
changing a password is two steps:

```bash
# 1. edit ADMIN_PASSWORD in .env
npm run db:seed
```

The user keeps its id and its order history; only the stored hash changes.

### Changing a password in production

The deployed app reads the same variables. On Vercel:

```bash
npx vercel env add ADMIN_PASSWORD production
```

Then re-run the seed against the production database, so the new hash is written. Changing the
variable alone does nothing — it is read only at seed time.

> **If a password ever appears in a terminal, a log or a chat window, treat it as burned and
> replace it.** The seed used to print it on every run for convenience; it now prints only the
> address and the name of the variable, for exactly this reason.

### How roles are assigned — and why sign-up cannot mint staff

The role is **never** taken from a form. There are exactly two places a `User` row is created:

- **`npm run db:seed`** — assigns `admin`, `viewer` and `customer` explicitly.
- **Sign-up** ([`src/app/actions/auth.ts`](src/app/actions/auth.ts)) and **social sign-in**
  ([`src/app/api/auth/[provider]/callback/route.ts`](src/app/api/auth/%5Bprovider%5D/callback/route.ts))
  — both hardcode `role: "customer"`.

So there is no request anybody can craft, through the sign-up form or through Google, that
produces a staff account. To promote someone, change the column directly:

```bash
npm run db:studio      # find the user, set role to admin or viewer
```

### Where the rule is actually enforced

Hiding a button is not a permission. Every mutating Server Action independently calls
`getCurrentAdmin()`, because Server Actions are reachable by direct `POST` and the dashboard
layout's redirect only governs what gets *rendered*.

That claim is tested rather than asserted:
[`tests/e2e/viewer-role.spec.ts`](tests/e2e/viewer-role.spec.ts) captures a real product-toggle
request off the wire while an admin performs it, replays it byte-for-byte with the viewer's
session cookie, and checks the database column is unchanged.

---

## Google and Facebook sign-in

### Why your own credentials are needed

A fair question: *why does this need anything from me — can't visitors just use their own Google
accounts?*

They do use their own accounts. What has to be registered is not **your** Google account but
**the website**. When someone presses "Continue with Google", their browser goes to Google, and
Google has to answer: *which site is asking, and is it allowed to?* A client ID is what
identifies the site. Without one, Google has no idea who is requesting anything and refuses.

So it is a one-time registration of the app itself. It is free, it takes a few minutes, and only
you can do it, because creating it means signing in to Google's and Meta's own consoles.

**Everything works without it.** If the variables are unset the buttons are simply not rendered
and sign-in is by email and password. A button that fails after a round trip to Google is worse
than no button, so the app checks before drawing one.

### Google

1. Open [Google Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials).
2. Create a project if you have none.
3. **Create Credentials → OAuth client ID**, application type **Web application**.
4. Under *Authorised redirect URIs* add these exactly, including the scheme:
   ```
   http://localhost:3000/api/auth/google/callback
   https://your-domain.com/api/auth/google/callback
   ```
5. Copy the client ID and secret into `.env`:
   ```bash
   GOOGLE_CLIENT_ID="..."
   GOOGLE_CLIENT_SECRET="..."
   ```

### Facebook

1. Open [Meta for Developers → My Apps](https://developers.facebook.com/apps) and create an app.
2. Add the **Facebook Login** product.
3. Under *Valid OAuth Redirect URIs* add:
   ```
   https://your-domain.com/api/auth/facebook/callback
   ```
4. Copy the App ID and App Secret into `.env`:
   ```bash
   FACEBOOK_CLIENT_ID="..."
   FACEBOOK_CLIENT_SECRET="..."
   ```

> Facebook only returns an email address once it has confirmed it, and this app refuses a
> sign-in without one. Your app needs the `email` permission approved before it works for anyone
> outside your own test users.

### What the implementation guarantees

Written against the raw OAuth 2.0 authorization-code flow rather than an auth library — two
providers is about a hundred lines, and these are decisions worth being able to read:

- **`state`**, in a short-lived http-only cookie, checked on return. Without it, a crafted
  callback URL carrying an attacker's authorization code silently links their identity to
  whoever opens it.
- **PKCE (S256).** An intercepted code is useless without the verifier, which never leaves the
  server.
- **A verified email is required.** Accounts are matched by address, so accepting an unverified
  one is an account takeover: register `someone@gmail.com` at a careless provider, sign in here,
  inherit their orders. Google's `email_verified` must be `true`; Facebook omits the field
  entirely until it has confirmed the address, so its absence is a refusal rather than something
  to work around.
- **A social sign-in cannot create staff.** The role is hardcoded to `customer`.

Covered by [`tests/e2e/oauth.spec.ts`](tests/e2e/oauth.spec.ts).

---

## Environment variables

| Variable | Required | What it is |
|---|---|---|
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `AUTH_SECRET` | ✅ | Signs the session cookie. Any long random string. |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | ✅ to seed | Full-access staff account. Min 12 chars. |
| `VIEWER_EMAIL` / `VIEWER_PASSWORD` | ✅ to seed | Read-only staff account. Min 12 chars. |
| `CUSTOMER_EMAIL` / `CUSTOMER_PASSWORD` | ✅ to seed | Demo shopper. Min 8 chars. |
| `SITE_URL` | recommended | Canonical URL — used in emails, the sitemap and OAuth redirects |
| `RESEND_API_KEY` | optional | Transactional email. Without it, mail is logged to the console. |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | optional | Enables the Google button |
| `FACEBOOK_CLIENT_ID` / `FACEBOOK_CLIENT_SECRET` | optional | Enables the Facebook button |
| `GEMINI_API_KEY` | optional | The contact assistant. Gemini has a free tier. |
| `ANTHROPIC_API_KEY` | optional | The assistant, on Claude instead |
| `CHAT_PROVIDER` | optional | `gemini` or `anthropic` |
| `DATABASE_POOL_MAX` | optional | Connections per instance. Defaults to 3 in production. |

`.env.example` carries the same list with fuller comments.

---

## What it demonstrates

**Storefront** — home, catalogue, product pages, cart, checkout, order confirmation and
tracking. Faceted filtering by category, price, brand and availability, all held in the URL so
any view can be linked, with brand options narrowing to match the other active filters. Wishlist,
dark mode, and a bilingual interface that never shifts by a pixel when the language changes.

**Staff dashboard** — revenue, profit and margin over a selectable 7/30/90-day window; product
and category management with filtering, sorting and pagination; an order workflow that records
who moved each status and when; a customer list with real lifetime totals; and an append-only
stock ledger, so "why is this out of stock?" always has an answer.

**Two staff roles.** `admin`, and a read-only `viewer` enforced in the Server Actions rather
than by hiding buttons.

**Accounts** — email sign-up with verification codes, password reset, and optional Google and
Facebook sign-in. An account is required to check out, so no order can exist without an owner.

**A contact assistant** that answers from the live catalogue through read-only tool calls, so a
price or stock level it quotes is the one in the database. It cannot change an order or move
money, and the order-lookup tool resolves ownership from the request's own cookies, so no prompt
can make it read somebody else's.

**Money as integers.** Every amount is stored and computed in tetri; `formatPrice` is the single
place a division by 100 happens.

---

## Tech stack

| Layer | Tech |
|---|---|
| **Framework** | Next.js 16 (App Router, Server Components, Server Actions) |
| **Language** | TypeScript (strict) |
| **Database** | PostgreSQL via Prisma 7 with the `@prisma/adapter-pg` driver adapter |
| **Styling** | Tailwind CSS v4, design tokens in a single CSS file |
| **Auth** | scrypt hashing + HMAC-signed session cookie (`node:crypto`), no auth dependency |
| **OAuth** | Raw authorization-code flow with `state` and PKCE, no auth library |
| **State** | `useSyncExternalStore` over `localStorage` for cart and wishlist |
| **i18n** | Cookie-driven dictionaries, type-checked so `en` cannot drift from `ka` |
| **Icons** | Hand-rolled inline SVG set — no icon dependency |
| **Assistant** | Pluggable provider (`@google/genai` free tier, or `@anthropic-ai/sdk`), streamed as NDJSON |
| **Tests** | Vitest + Playwright, run in GitHub Actions |

---

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` | Production build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm test` | Unit tests (Vitest) |
| `npm run test:e2e` | End-to-end tests (Playwright) |
| `npm run db:migrate` | Apply migrations |
| `npm run db:seed` | Seed catalogue, orders and the three accounts (idempotent) |
| `npm run db:studio` | Prisma Studio |
| `npm run db:reset` | Drop, re-migrate and re-seed |

---

## Project structure

```
src/
├── app/
│   ├── (shop)/          storefront routes + header/footer chrome
│   ├── (auth)/          sign in / sign up
│   ├── dashboard/
│   │   └── (panel)/     staff-only shell (customers are sent to /account)
│   ├── api/auth/        OAuth start + callback routes
│   ├── actions/         Server Actions (auth, orders, admin, payments, tracking)
│   ├── sitemap.ts       dynamic sitemap
│   └── robots.ts
├── components/
│   ├── catalog/         filter rail, mobile drawer, sort, chips, pagination
│   ├── product/         product card, add-to-cart, purchase panel, sticky buy bar
│   ├── admin/           dashboard-only UI (toolbar, forms, tables, chart)
│   ├── checkout/        the checkout form
│   ├── chat/            contact assistant widget
│   ├── layout/          header, footer, info-page renderer
│   ├── providers/       cart, i18n and theme context
│   └── ui/              icons, price, badges, overlays, skeletons
└── lib/
    ├── analytics.ts     dashboard metrics and the daily series
    ├── auth.ts          session cookie, roles, password hashing
    ├── auth-roles.ts    the role union, importable from the client
    ├── oauth.ts         Google and Facebook providers
    ├── catalog.ts       product queries and facet counts
    ├── filters.ts       filter parsing/serialising (shared client + server)
    ├── format.ts        money, dates and the shop's timezone
    ├── sku.ts           SKU generation
    ├── use-overlay.ts   mount/unmount lifecycle for animated panels
    └── i18n.ts          translation dictionaries
```

---

## Design system

Every colour, radius, shadow, font and type-scale step is a design token at the top of
[`src/app/globals.css`](src/app/globals.css), with the shared `.btn` / `.card` / `.field` /
`.badge` primitives below it. Components reference tokens and never hard-coded values, so a full
visual redesign is an edit to that one file.

The type scale is deliberately **fixed** — no font-size changes at any breakpoint, and a 13px
floor. Text is the same size on a 380px phone as on a 27-inch monitor.

Switching between Georgian and English never moves or resizes anything. Controls whose width
would otherwise follow their label are pinned. This is verified rather than assumed:
[`tests/e2e/stability.spec.ts`](tests/e2e/stability.spec.ts) renders every page in both
languages at four widths and compares the measured height of every control.

Dark mode overrides token *values* only, so every component re-themes at once and not a single
`dark:` variant is written anywhere in the app. Contrast is checked by
[`tests/unit/contrast.test.ts`](tests/unit/contrast.test.ts), which computes real ratios from the
token values in both themes rather than trusting the palette by eye.

Motion is restrained and reversible: overlays animate in *and* out, opening slower than closing,
and everything is switched off under `prefers-reduced-motion`.

---

## Testing

```bash
npm test            # unit — money, dates, contrast, SKUs, chart scale, chat tools
npm run test:e2e    # end-to-end — the flows, and the security properties
```

The end-to-end suite covers what is easiest to break invisibly: authorization boundaries, the
read-only role, OAuth failure paths, layout stability across both languages, and that overlays
animate in both directions.

---

## Deploying

Deployed on Vercel from `main`. Set the environment variables in the project settings, then run
the migrations and the seed against the production database once.

Two things worth knowing before pointing this at a real database:

- **Connection pooling.** `DATABASE_POOL_MAX` defaults to 3 in production. An unbounded pool per
  serverless instance exhausted the database's connection limit and took the live site down once
  already.
- **`remotePatterns` in `next.config.ts` currently allows any HTTPS host**, so that arbitrary
  product image URLs work in the demo. Narrow it to your own CDN before running a real shop.

---

## Notes and known limits

- **Product images.** All seeded products share `public/products/placeholder.svg`. Set a real
  image URL per product in the dashboard.
- **Payments are not real.** Orders are recorded as cash-on-delivery. `PaymentProvider` is an
  enum with a single `manual` member, ready for a real adapter.
- **Order tracking requires the phone number**, not just the order number, so order numbers
  cannot be enumerated to read customers' details.
- **Both languages are served from the same URL** via a cookie, so there is deliberately no
  `hreflang`. Annotating one URL as two languages tells a crawler two contradictory things;
  doing it properly means path-based locales, which is a routing change rather than a tag.
- **Dates render in `Asia/Tbilisi`**, hardcoded rather than derived from the runtime. A
  runtime-derived zone answers differently on the server and in the browser, which is a hydration
  mismatch; UTC is deterministic but four hours wrong, which filed every order placed after
  midnight under the previous day.

---

<div align="center">

Built by [tornikepe](https://github.com/tornikepe)

</div>
