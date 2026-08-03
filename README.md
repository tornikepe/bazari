<div align="center">

# Bazari

**A full-stack e-commerce storefront with a complete admin panel.**

Bilingual (ქართული · English) · Next.js 16 App Router · PostgreSQL + Prisma 7 · Tailwind CSS v4

</div>

---

> ## ⚠️ This is a demo — not a real shop
>
> Bazari is an **educational / portfolio project** that reproduces the look and flow of a real
> online store. It exists to demonstrate full-stack engineering, not to sell anything.
>
> - ❌ **No real payments.** Checkout records a cash-on-delivery order — no card is ever charged.
> - 🔢 **All products, prices and orders are fictional** sample data.
> - 🖼️ Every product uses the same bundled sample photo until a real image URL is set in the admin.
>
> There are no invented review scores, supplier claims, phone numbers or addresses anywhere in
> the UI — if a number is shown, it is counted from the database.

---

## 🎯 What it demonstrates

- 🛍️ **Storefront** — home, catalog, product pages, cart, checkout, order confirmation
- 🔎 **Faceted filtering** — category, price range, brand and availability, all in the URL so any
  filtered view is shareable; brand options narrow to match the other active filters
- 🌐 **Bilingual UI** (`ka` / `en`) from a cookie, so Server Components render the right language
  on the very first paint — no flash, no client-side swap
- 👤 **Two account types from one sign-in form** — the account's role decides where it lands:
  staff get the admin dashboard, customers get a much lighter account area (their orders,
  saved delivery details, wishlist). A customer who types `/dashboard` is redirected away.
- 🔐 **Admin dashboard** — stats, product CRUD with filters/sort/pagination, category CRUD,
  order management with status transitions and search
- 🔑 **Session auth** — scrypt password hashing and HMAC-signed cookies, no auth dependency
- 🌗 **Dark mode** — cookie-persisted, falls back to the OS preference, and applied before
  first paint so there is no flash of the wrong theme
- ✨ **Restrained motion** — scroll reveals, staggered grids and hover lifts, all switched off
  under `prefers-reduced-motion`
- 💬 **Contact assistant** — a streaming chat widget on the Claude API that answers from the
  live catalogue rather than from memory, so a price or a stock level it quotes is the one in
  the database. Four read-only tools; it cannot change an order or move money, and the
  order-lookup tool resolves ownership from the request's own cookies, so no prompt can make it
  read someone else's. Per-browser rate limit and a counted monthly spend cap.
- ❤️ **Wishlist** and 📦 **order tracking** (order number + phone as a second factor)
- 🧾 **Server-side order totals** — the cart lives in `localStorage`, so prices are re-read from
  the database when an order is placed and never trusted from the client
- 🔎 **SEO** — dynamic `sitemap.xml`, `robots.txt`, Open Graph and Twitter metadata
- 📱 **Responsive** — a filter sidebar that becomes a bottom-sheet drawer, and admin tables that
  become cards, verified with no horizontal overflow from 320px upward

---

## 🧱 Tech stack

| Layer | Tech |
|---|---|
| **Framework** | Next.js 16 (App Router, Server Components, Server Actions) |
| **Language** | TypeScript (strict) |
| **Database** | PostgreSQL via Prisma 7 with the `@prisma/adapter-pg` driver adapter |
| **Styling** | Tailwind CSS v4, design tokens in a single CSS file |
| **Auth** | scrypt hashing + HMAC-signed session cookie (`node:crypto`) |
| **State** | `useSyncExternalStore` over `localStorage` for cart and wishlist |
| **i18n** | Cookie-driven dictionaries, type-checked so `en` can't drift from `ka` |
| **Icons** | Hand-rolled inline SVG set — no icon dependency |
| **Assistant** | Claude Opus 5 via `@anthropic-ai/sdk`, streamed as NDJSON from a route handler |

---

## 🚀 Getting started

```bash
git clone https://github.com/tornikepe/bazari.git
cd bazari
npm install
cp .env.example .env
```

Put a PostgreSQL connection string in `.env`. Any Postgres works — Neon, Supabase, Railway,
a local server, or an instant one:

```bash
npx create-db@latest
```

Then set up the schema and start:

```bash
npm run db:migrate
npm run db:seed
npm run dev
```

- Storefront → [localhost:3000](http://localhost:3000)
- Dashboard  → [localhost:3000/dashboard](http://localhost:3000/dashboard)

Seeded logins:

```
user@bazari.ge / user1234      → customer account
```

The admin account is `admin@bazari.ge`, and its password is whatever you put in
`ADMIN_PASSWORD` before seeding — there is no default, and the seed refuses to
run without one. The live demo's admin password is deliberately not published:
a dashboard that can edit prices and cancel orders should not be open to anyone
who reads this file.

---

## 📜 Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` | Production build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run db:migrate` | Apply migrations |
| `npm run db:seed` | Seed categories, products, orders and both demo users (idempotent) |
| `npm run db:studio` | Prisma Studio |
| `npm run db:reset` | Drop, re-migrate and re-seed |

---

## 🗂️ Project structure

```
src/
├── app/
│   ├── (shop)/          storefront routes + header/footer chrome
│   ├── (auth)/          sign in / sign up, one form for both roles
│   ├── dashboard/
│   │   └── (panel)/     staff-only shell (customers are sent to /account)
│   ├── actions/         Server Actions (auth, orders, admin, tracking)
│   ├── sitemap.ts       dynamic sitemap
│   └── robots.ts
├── components/
│   ├── catalog/         filter sidebar, mobile drawer, sort, chips, pagination
│   ├── product/         product card, add-to-cart, purchase panel, wishlist button
│   ├── admin/           admin-only UI (toolbar, forms, tables)
│   ├── layout/          header, footer, info-page renderer
│   ├── providers/       cart, i18n and theme context
│   └── ui/              icons, price, status badge, skeletons
└── lib/
    ├── catalog.ts       product queries and facet counts
    ├── filters.ts       filter parsing/serialising (shared client + server)
    ├── cart-store.ts    localStorage cart as an external store
    ├── favorites-store.ts
    ├── auth.ts          session cookie, roles + password hashing
    ├── theme.ts         light/dark cookie + pre-paint script
    └── i18n.ts          translation dictionaries
```

---

## 🎨 Design system

Every colour, radius, shadow, font and type-scale step is a design token at the top of
`src/app/globals.css`, with the shared `.btn` / `.card` / `.field` / `.badge` primitives right
below. Components reference tokens, never hard-coded values — so a full visual redesign is an
edit to that one file.

The type scale is deliberately **fixed**: no font-size changes at any breakpoint, and a 13px
floor. Text is the same size on a 380px phone as on a 27" monitor.

Switching between Georgian and English never moves or resizes anything either. Controls whose
width would otherwise follow their label — the language buttons, the header actions, the sort
and filter selects — are pinned, and product titles reserve both of their lines. This is
verified rather than assumed: rendering every page in both languages produces an identical set
of layout classes for all ~1,600 elements.

Dark mode is the same idea taken further — `[data-theme="dark"]` only overrides token *values*,
so every component re-themes at once and not a single `dark:` variant is written anywhere in
the app.

---

## 📝 Notes

- **Product images.** All seeded products share `public/products/placeholder.svg`. Set a real
  image URL per product in the admin. `next.config.ts` currently allows any HTTPS host — narrow
  `remotePatterns` to your own CDN before production.
- **Every Server Action re-checks the session.** Actions are reachable by direct `POST`, so the
  dashboard layout's redirect is not treated as the only gate.
- **Order tracking requires the phone number**, not just the order number, so order numbers
  can't be enumerated to read customers' details.

---

<div align="center">

Built by [tornikepe](https://github.com/tornikepe)

</div>
