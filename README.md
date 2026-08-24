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
- [Design system](#design-system) — and [DESIGN.md](DESIGN.md), the rules on one page
- [Testing](#testing)
- [Deploying](#deploying)
- [The storefront](#the-storefront) — the 3D hero, search suggestions, photo uploads, the theme fade
- [Configuring the shop](#configuring-the-shop) — using this for a different business
- [Moving to another Postgres](#moving-to-another-postgres)
- [Commit attribution](#commit-attribution)
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

Now generate the secrets. **The seed will not run without them**, on purpose — see
[Accounts and passwords](#accounts-and-passwords) for why, and for what each account is:

```bash
npm run setup:credentials
```

That writes `AUTH_SECRET` and a password for each of the three accounts into `.env`, and prints
nothing secret. It never overwrites a value you already set, so it is safe to re-run.

Then create the schema and start:

```bash
npm run db:migrate
npm run db:seed
npm run dev
```

Finally, arm the repository's git hooks — one command, once per clone:

```bash
git config core.hooksPath .githooks
```

See [Commit attribution](#commit-attribution) for what it protects against.

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

**There is no default and nothing ships with one.** You either generate them or choose them
yourself; what you cannot do is skip the step.

The short way:

```bash
npm run setup:credentials
```

It writes a password for each account into `.env`, plus `AUTH_SECRET`. Each is 24 characters
drawn from `A-Za-z0-9_-` — about 143 bits, and an alphabet that survives being pasted into a
shell, a URL or a YAML file without escaping. `AUTH_SECRET` gets 32 bytes rather than 18: a
password is typed by a person and rate-limited on the way in, while a signing key is attacked
offline with no such ceiling.

Two things it deliberately does not do:

- **It does not print them.** They are in `.env`, which is the only place anything reads them
  from. A password echoed into a terminal stays in that scrollback, in the shell history of
  whoever scrolls up, and in any recording of the session. `npm run setup:credentials -- --show`
  prints them when you genuinely need to read one out.
- **It does not overwrite one that is already set.** Rotating `ADMIN_PASSWORD` without
  re-seeding leaves `.env` and the database disagreeing, and the symptom is being locked out of
  your own dashboard. `-- --force` does it anyway and tells you to re-seed.

It also replaces known placeholder values rather than trusting them. This repository used to
ship `AUTH_SECRET="dev-only-change-me-to-a-long-random-string"` in `.env.example`, which meant
`cp .env.example .env` produced a session signing key that *looked* set, was never questioned,
and is published here for anyone to read. The template now ships it empty so it fails loudly,
and the generator treats any leftover copy as unset. **If you deployed before this change, set a
new `AUTH_SECRET` in your host's environment** — with the old value, session cookies can be
forged.

Or set them by hand. Each password is one environment variable:

```bash
ADMIN_PASSWORD="..."      # minimum 12 characters
VIEWER_PASSWORD="..."     # minimum 12 characters
CUSTOMER_PASSWORD="..."   # minimum 8 characters
```

If any is missing or too short, `npm run db:seed` stops with an error naming the variable. It
does not fall back to a default and carry on. `setup:credentials` reports the same thing
earlier, so a password you typed yourself and made too short is caught before the seed runs.

That refusal is the point. A password that ships inside a repository is a password on every
deployment that forgot to change it, and the deployment most likely to forget is the one nobody
is watching. A seed that fails loudly costs five seconds; the alternative costs the shop.

The viewer is held to the same 12-character minimum as the admin. It cannot change anything,
but it can read every order, every customer's home address and every margin in the shop, so
"it's only read-only" is not a reason to admit a weak password. The customer's floor is 8: it
owns nothing but its own test orders and is meant to be typed by hand during a demo.

### Which command writes where

Worth stating plainly, because the two commands look similar and only one of them touches
`.env`:

| Command | Reads | Writes |
|---|---|---|
| `npm run setup:credentials` | `.env` (to see what is already set) | **`.env`** — the three passwords and `AUTH_SECRET` |
| `npm run db:seed` | `.env` | **the database** — the hashed passwords, in the `User` table |

**`db:seed` never writes to `.env`.** If you delete `.env`, seeding does not recreate it — it
stops with an error naming the variable that is missing. `setup:credentials` is the one that
creates the file, from `.env.example`, and fills in what is empty.

So from nothing at all:

```bash
npm run setup:credentials   # creates .env and the secrets in it
npm run db:seed             # creates the accounts from them
```

### How a password gets attached to an account

1. It is written into `.env` — by `npm run setup:credentials`, or by you.
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

### Sessions, and what a reset actually ends

The session cookie is stateless — `userId.sessionVersion.expiresAt.hmac`, signed and
self-verifying, so a request costs no database lookup and there is no session table to keep.

The catch with that design is that a cookie cannot normally be taken back: it stays valid until
it expires, which was seven days, no matter what happens to the password. That is the wrong
answer to "I think somebody is in my account" — the exact moment somebody resets a password.

`sessionVersion` fixes it. The number is signed into the cookie and compared against the column
on every request, so incrementing the column invalidates every cookie that user holds, at once
and immediately. A password reset does exactly that, then issues the resetting browser a fresh
session so it is not logged out of its own recovery.

Rotating a *staff* password through the seed also revokes nothing on its own — the seed writes
a new hash, and old cookies for that account keep working until they expire. If you are
rotating because a password leaked rather than for hygiene, bump the column too:

```sql
UPDATE "User" SET "sessionVersion" = "sessionVersion" + 1 WHERE email = 'admin@bazari.ge';
```

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
4. Under *Authorised redirect URIs* add these exactly, including the scheme. Google matches them
   character for character — a missing `http://`, a trailing slash or the wrong port is the usual
   cause of `redirect_uri_mismatch`:
   ```
   http://localhost:3000/api/auth/google/callback
   https://bazari-git-main-tornikepes-projects.vercel.app/api/auth/google/callback
   ```
   The second is this deployment's own URL. If you later put a domain in front of it, add that
   one too — and set `NEXT_PUBLIC_SITE_URL` to it, because the callback URL the app sends is
   built from that variable.
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
| `npm run test:e2e` | End-to-end tests (Playwright), screenshots included |
| `npm run test:visual` | Just the thirty screenshots; `test:visual:update` accepts them |
| `npm run setup:credentials` | Generate `AUTH_SECRET` and the three account passwords into `.env`. Never overwrites what is set; `-- --show` prints them, `-- --force` replaces them |
| `npm run db:migrate` | Apply migrations |
| `npm run db:seed` | Seed catalogue, orders and the three accounts (idempotent) |
| `npm run db:setup` | `migrate deploy` then `db:seed` — pointing at a new Postgres |
| `npm run db:verify` | Is there enough here to serve the site: settings row, info pages, catalogue, an admin |
| `npm run db:audit` | Is any of it wrong: orphans, order arithmetic, whole-tetri prices, Georgian encoding |
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

The rules themselves are one page: **[DESIGN.md](DESIGN.md)** — the four templates, the page
rhythm, the header, the card, the table, the figures. Each is enforced by
[`tests/unit/design-rules.test.ts`](tests/unit/design-rules.test.ts), which fails when a page
invents a ninth way to do one of those eight things. What follows here is the material the rules
are made of.

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

### Page templates

Thirty-four routes, four templates. A new page starts by choosing one of them rather than by
copying whichever page happened to be open — which is how the site ended up with four page
paddings and four different ways to write a title in the first place.

| Template | What it is | Routes |
|---|---|---|
| **Page** | `.page` for the margins, [`PageHeader`](src/components/layout/PageHeader.tsx) for the title, content below. The default; pick this unless there is a reason not to | `/catalog`, `/favorites`, `/cart`, `/checkout`, `/track`, `/account`, the eight information pages, and every `/dashboard` route |
| **Record** | `.page`, a breadcrumb, then two columns with the title beside the thing itself rather than above both | `/product/[slug]` |
| **Notice** | One centred card and no page furniture: a short title, a sentence, one or two buttons | `/login`, `/register`, `/forgot-password`, `/verify`, `/invite`, `/order/[number]`, `/checkout` with an empty cart, 404, and both error boundaries |
| **Landing** | Full-width bands, a `display`-scale headline, no page header | `/` |

`PageHeader` takes a trail, an eyebrow, a title, a count, one line of purpose, and an action that
sits on the right — on a narrow screen the action wraps below the title instead of squeezing it.
It has two named variants:

- **`scale="panel"`** — the dashboard's smaller title. The dashboard is a denser place and had
  already settled on this across all ten of its pages; the prop is there so one component makes
  that decision instead of ten copies of the same class names.
- **the account page** — [`AccountIdentity`](src/components/account/AccountIdentity.tsx) is the
  same eyebrow / title / sub-line / action shape inside a card with the customer's initials
  beside it. It is the one page whose header is about *who is reading it*.

---

## Testing

```bash
npm test            # unit — money, dates, contrast, SKUs, chart scale, the design rules
npm run test:e2e    # end-to-end — the flows, the security properties, the screenshots
```

The end-to-end suite covers what is easiest to break invisibly: authorization boundaries, the
read-only role, OAuth failure paths, layout stability across both languages, that overlays
animate in both directions, that every control has an accessible name and a reachable target,
and that the drawers hold the keyboard as well as the pointer.

### Two engines

It runs in **Chromium** and **WebKit**. WebKit is not thoroughness for its own sake — it is the
only engine iOS is allowed to render with, so it is the only way to see an iPhone problem without
an iPhone. Running everything twice would double an eleven-minute run for no gain, so WebKit runs
the specs tagged `@engine`: layout, sticky, overflow, focus and motion. A server action behaves
the same in both.

```bash
npx playwright test --project=webkit
```

Its first run failed 24 of 34, and one cause explained nearly all of them. The CSP sent
`upgrade-insecure-requests` on every response. Chromium exempts localhost from that directive;
WebKit does not, so every stylesheet, script and server action on `http://127.0.0.1:3100` was
upgraded to a port with no TLS listener and failed. The page rendered unstyled, never hydrated,
and every form silently did nothing — which looked like two dozen unrelated layout and focus
bugs. The directive is now sent only when the request is really over HTTPS, which is the only
situation it means anything in.

The three tests that press Tab are excluded from WebKit, and that is a fact rather than a
workaround: **Safari does not put links or buttons in the tab order** unless the reader turns on
"Use keyboard navigation to move focus between controls". Measured rather than assumed — in
WebKit, Tab on the home page cycles between the body and one text input.

### The look of it

Six pages, in two languages at two widths plus dark mode: thirty screenshots, compared pixel for
pixel on every run. It is the only check that would notice a heading losing its weight or a price
turning the colour of its background, and it is what makes a design change *measured* rather than
admired.

```bash
npm run test:visual          # compare
npm run test:visual:update   # accept, after looking at every diff
```

A screenshot is a picture of one browser on one operating system, so the baselines are committed
per platform — `-darwin` beside `-linux` — and neither set is ever compared against the other.
After a deliberate design change, refresh the macOS pair locally and take the Linux pair from the
`test-results` artifact CI uploads when it fails: every `*-actual.png` in it is a new baseline,
named after the test that took it.

What is masked is the data — prices, stock counts, the four newest products — because this suite
shares a database with tests that place orders and sell stock down. Their boxes still take up
space, so a card that changes shape still fails. And it refuses to compare at all if the shop is
not wearing its default brand colour, which is the only way thirty diffs about nothing ever get
reported here.

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

## The storefront

Three things worth describing, because each hides a decision.

### A hero in three dimensions

The object beside the headline is the shop's own mark given depth — a cube whose every face is
the 2×2 module grid with one cell in brand red, turning once every 28 seconds. It is CSS, not a
canvas: `transform-style: preserve-3d` is a real perspective projection with six faces composited
on the GPU, and it needs no library, no shader and **no JavaScript at all**, so it renders on the
server and is correct before hydration rather than after it. It stops for `prefers-reduced-motion`
and it is `aria-hidden` — it says nothing the heading does not.

### Suggestions in the search field

Typing two characters into the header search shows matching products under it, with the
thumbnail, brand and price. `/api/search` shares its matching predicate with the catalogue by
importing it, rather than restating it — two definitions of what "matches" means fail silently
and in the most annoying way available: a product offered in the dropdown that is missing from
the page you land on after pressing enter. A test asserts the suggested product really is among
the catalogue's results for the same word.

It is a real combobox. Arrow keys move the highlight, Enter opens the highlighted product, Enter
with nothing highlighted submits the search as before, and Escape closes the list while **keeping
what was typed** — `<input type="search">` clears itself on Escape in Chrome, so the default is
taken over while the list is open and only then, leaving a second Escape to clear the field.

### Uploading a product photo

**Dashboard → Products → New** takes a file. The upload happens when the file is chosen rather
than when the product is saved, so the preview is the photo that is actually stored and a refusal
arrives while you are still looking at the field.

The bytes go into Postgres, not into object storage. Object storage is the usual answer and it
needs an account and a token before a single photo can be uploaded; this works on a fresh clone
with nothing configured. `Product.image` holds a short `/api/images/<id>` URL rather than the
bytes, so the catalogue's list queries — which select `image` for every card — carry a path and
not a megabyte. Moving to Vercel Blob later changes only where the upload route writes; nothing
that reads a product would know the difference.

**What a file is, is decided by reading it.** The `type` a browser sends with an upload is a
claim from the client, and a route that stores whatever was declared and serves it back with that
`Content-Type` is how a stored cross-site scripting bug gets built. So the format is sniffed from
the leading bytes and the declaration is discarded — JPEG, PNG, WebP or AVIF, up to 2 MB, and
anything else is refused. A WAV is not mistaken for a WebP and an MP4 is not mistaken for an AVIF,
because both share their first four bytes with the format they are not. There are tests for each.

The URL field is still there and still what gets saved, so pasting a link works exactly as it
did.

### The theme fades

Switching between light and dark cross-fades over 700ms in both directions.

It is a **view transition**, not a CSS transition, and that is not a matter of taste. Every colour
here is `var(--color-…)`, and an unregistered custom property is not animatable: flipping
`data-theme` recomputes the dependent colours without starting a transition at all. The first
attempt did exactly that — `transition-duration` reported a correct `0.7s` on every element on the
page and not one transition ever ran. Listening for `transitionrun` is what caught it; watching it
and deciding it looked smooth would not have.

Reduced motion skips it, and so does any engine without the API — a missing fade is a missing
nicety, a theme that will not change is a broken control.

---

## Configuring the shop

Everything that makes this shop *this* shop lives in the dashboard under
**Settings**, not in the source. Nothing below needs a code change:

| Group | What |
|---|---|
| **Shop** | Name, browser-tab suffix per language, description, logo URL |
| **Brand colour** | One colour; the whole palette is derived from it |
| **Contact** | Email, phone, address, opening hours — each optional |
| **Delivery** | Free-delivery threshold, delivery fee, cash-on-delivery toggle |

The name appears in the header, the footer, the browser tab, the sign-in page
and every email the shop sends. Delivery rules are applied in one place and
reach the cart, the checkout total and the shipping page together, so the
figure a shopper is shown cannot drift from the one they are charged.

**Empty contact fields are not rendered at all.** A shop without a phone number
yet shows nothing about phone numbers rather than a row with a dash in it —
the same rule the rest of the site follows about never displaying a figure it
cannot stand behind.

Money is typed in lari and stored in tetri; the conversion happens once, in the
save action.

### The brand colour

One colour, off a logo. From it the site derives ten brand shades plus the
button tokens, for the light theme and the dark one — twenty-six values from a
single field, written into the document head as the same custom properties the
stylesheet declares.

The ramp is built in **OKLCH**, because hue stays put there while lightness
moves; interpolating the same ramp in sRGB drags saturated colours through
grey. It is then judged in **WCAG luminance**, which is a different measure
entirely — a yellow and a blue at the same perceptual lightness differ
threefold in luminance. That gap is the reason every shade is measured rather
than trusted: a ramp can look perfectly evenly stepped and still fail AA.

What is kept from the chosen colour is its hue and its saturation. Its
*lightness* comes from the default ramp, which was tuned shade by shade against
every pair the site actually puts on screen. A colour picked for a sign or a
package was never chosen to carry 13px text on a near-white page, and for light
colours the honest answer is that it cannot be used unchanged.

So a colour that would have to move too far to be readable is **refused**, and
the nearest colour that does work comes back with it as a button you can press.
Bright yellow is the clearest case: as link text it would have to become a dark
olive, and quietly restyling someone's brand into a different colour is worse
than telling them. The check runs in the form as you type, and again in the
server action — the form is a convenience, and the action is the rule.

A shop on the default colour ships no override at all: no extra element, and
nothing that can go stale against the stylesheet.

Adding these checks found two AA failures in the palette that had already
shipped — the round icon chip at 4.48:1, and the dashboard's featured badge at
4.05:1 in dark mode. Both pairs were being rendered and neither was in the
contrast test's list. They are now.

Still hardcoded, and honestly so: **the currency symbol**. `formatPrice` has 56
call sites and threading it through half of them would put two currencies on
one page, so the column exists and the pass is still to come. The **information
pages** (about, FAQ, shipping, returns, warranty, terms, privacy) are also
still in `src/lib/info-pages.ts` — moving them into the database is the next
step.

---

## Moving to another Postgres

Nothing in the application is tied to a particular host. `src/lib/prisma.ts`
takes a plain connection string through the standard `pg` driver, so Neon,
Supabase, Vercel Postgres, Railway or a server in a cupboard are all the same
to it.

### The move

```bash
# 1. Both connection strings in .env  (and in Vercel, for production)
DATABASE_URL="postgresql://…-pooler.…"   # pooled — the running app
DIRECT_URL="postgresql://….…"            # direct — migrations and the seed

# 2. Apply every migration, then fill the database
npm run db:setup

# 3. Confirm it is actually usable
npm run db:verify

# 4. …and that nothing in it is wrong  (after any bulk import, too)
npm run db:audit
```

`DIRECT_URL` is optional and falls back to `DATABASE_URL`, which is all a local
Postgres or the CI container needs — they have no pooler to opt out of.

`db:verify` checks the things that make a database *serveable* rather than
merely *migrated*: the settings row, all eight information pages, an active
catalogue, an admin to sign in as, and that every price is a whole number of
tetri. A migration can apply perfectly and still leave a database the site
half-renders on, and each of those failures otherwise shows up as a broken
page rather than an error.

`db:audit` asks the opposite question — not "is enough here" but "is any of it
wrong". Orphaned rows, orders whose items no longer sum to their subtotal,
prices that stopped being whole tetri, blank names, and Georgian mangled by a
copy that ran under the wrong client encoding. None of these break a page: they
render perfectly and stay wrong. Worth running after moving hosts and after any
bulk import of a real catalogue, which is where spreadsheet arithmetic and
non-Latin text go wrong most often.

**This path is rehearsed on every push.** CI creates an empty `postgres:16`
container, runs the same `migrate deploy`, `db:seed` and `db:verify`, then the
whole end-to-end suite against it. A green build is a statement that a brand
new database works.

### Which region

Put the database wherever the **functions** run, not wherever you are. Each
page render issues several queries, so a cross-Atlantic hop is paid three or
four times per page; your own distance to the site is absorbed by Vercel's edge
network and costs one round trip.

This deployment's compute region is visible in any response header:

```bash
curl -sI https://your-site.vercel.app/ | grep x-vercel-id
# x-vercel-id: fra1::iad1::…
#              ^edge  ^compute
```

It currently reads `iad1` — Washington DC — so the database belongs in **AWS
US East (N. Virginia), `us-east-1`**. Putting it in Frankfurt to be near
Georgia would add roughly 90ms to every query and make every page slower.

If you would rather serve Georgian visitors from Europe, move *both*: pin the
functions with a `vercel.json` (`{ "regions": ["fra1"] }`) and create the
database in Frankfurt. Matching the two is what matters; which pair you pick
matters much less.

### Two things that will bite you

**The app needs the pooled string; migrations need the direct one.** Every
serverless instance builds its own pool, so without pooling a handful of warm
instances ask for more connections than a small plan allows — this project has
already been taken down once by exactly that, `P2037 TooManyConnections`, with
correct pages that simply could not get a connection. But migrations must *not*
go through it: Prisma Migrate takes a session-level advisory lock so two
deploys cannot apply the same migration at once, and a transaction-mode pooler
does not keep a session between statements. The symptom is a migration that
hangs rather than an error naming the cause.

On Neon the pooled host contains `-pooler`; that single substring is the whole
difference between the two strings, and it is the reliable way to tell them
apart whatever the dashboard calls them. Keep `DATABASE_POOL_MAX` small too;
it defaults to 3 in production.

**Check the SSL mode.** Most hosted providers require `?sslmode=require` on
the end of the URL. `pg` currently treats `require` as `verify-full` and warns
about it on start-up; the connection works, and the warning is expected.

### What a move costs you

Migrations hold the entire schema, and the seed rebuilds the catalogue,
categories, coupons, the three accounts, the settings row, the information
pages and a history of demo orders. What is *not* recoverable is anything
typed into the dashboard that differs from the seed — edited product copy,
changed settings, rewritten information pages, and real orders.

There is no export step here because there is nothing this project stores that
the repository cannot regenerate. If you have been running a real shop on it,
take a dump **before** you switch:

```bash
pg_dump "$OLD_DATABASE_URL" --data-only --column-inserts > backup.sql
```

---

## Commit attribution

This repository once accumulated thirty commits with no author. `user.email`
was never set, so git fell back to `tornike@Tornikes-MacBook-Pro.local` — not
an address GitHub knows. Every one of them rendered as an unlinked avatar and
none reached the contribution graph.

The failure is silent by design: git is happy, the push succeeds, and the only
symptom is an empty square on a page nobody checks daily. It went unnoticed for
weeks, and fixing it meant rewriting history and force-pushing.

`.githooks/pre-push` makes it impossible to repeat. It refuses to push when
`user.email` is unset, and refuses any commit whose author address ends in
`.local`, `.lan` or `.home` — the shape git invents for a machine with no
configured identity. Arm it once per clone:

```bash
git config core.hooksPath .githooks
```

The hook reads the ref updates git feeds it on stdin rather than using
`@{push}`. That matters: `@{push}` does not resolve on a branch's first push
from a fresh clone, which is precisely the push where an unattributed commit is
most likely.

If commits are not appearing on your graph, check these in order:

```bash
git config user.email          # must be your GitHub address or its noreply form
git log -3 --format='%h %ae'   # what is actually recorded on the commits
```

Then confirm GitHub agrees — `author` is `null` when it cannot link a commit:

```bash
curl -s "https://api.github.com/repos/<you>/<repo>/commits?per_page=3" \
  | grep -E '"login"|"date"'
```

Note that contributions only count on the **default branch** of a repository
you own, and never in a fork.

---

## Notes and known limits

- **The search does not stem Georgian, because Postgres cannot.** There is no Georgian dictionary
  in stock Postgres — not on Neon, not in the `postgres:16` image CI runs — and a stemmer for a
  language that inflects this much is a piece of linguistics rather than a configuration line. Full
  text (the `simple` configuration) does the tokenising and the ranking; trigrams stand in for the
  stemmer, which is what lets a word carrying a case ending find the bare form. What that cannot
  rescue is a mistyped short word: "ankre" shares one trigram of three with "anker".
- **Nothing in the seeded catalogue has variants.** The machinery is there — questions, answers,
  generated combinations, stock and price per combination — but every seeded product is sold in one
  form, so the product page looks exactly as it did. Add a question on any product in the dashboard
  and the picker appears.
- **Product images.** All seeded products share `public/products/placeholder.svg`. Set a real
  image URL per product in the dashboard. The placeholder is deliberately transparent so it takes
  the card's own background and works in both themes; a real photograph on a white studio ground
  will look like a white square in dark mode, which is a fact about photographs rather than a bug.
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
- **Nothing is emailed at all without a sending domain.** Order confirmations, shipping notices,
  the low-stock alert to the shop and the back-in-stock message to a shopper are all written and
  all degrade the same way: without `RESEND_API_KEY` the message is written to the *server* log and
  never to the browser. That is deliberate — it keeps local development workable without ever
  handing a one-time code to the caller.
- **An order prints, but no invoice is emailed.** Both order pages — the shop's and the
  shopper's — print as a document: the shop's name and contact details, the number, the date, who
  it is for, the lines, the totals. It is deliberately not a fiscal document and says so on its
  face; issuing one means a tax number and a numbering scheme an accountant signs off. Attaching a
  PDF to the confirmation email needs a renderer and a verified sending domain.
- **The shop installs, but does not run offline.** The manifest and icons are real — install it
  from the browser's own menu and it gets the shop's name, its colour and its square. There is no
  service worker, so there is nothing to serve when the network is gone, and Chromium therefore
  does not fire `beforeinstallprompt` — which is what the "install the app" line in the footer
  waits for, and why you will usually not see it. Writing a service worker to make a button appear
  would be the wrong way round: it is a caching strategy and an update strategy, and this shop has
  neither yet.

---

<div align="center">

Built by [tornikepe](https://github.com/tornikepe)

</div>
