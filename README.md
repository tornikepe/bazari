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
- 🔐 **Admin panel** — dashboard, product CRUD with filters/sort/pagination, category CRUD,
  order management with status transitions and search
- 🔑 **Session auth** — scrypt password hashing and HMAC-signed cookies, no auth dependency
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
- Admin panel → [localhost:3000/admin](http://localhost:3000/admin)

Seeded admin login (change it in `.env` before deploying anywhere public):

```
admin@bazari.ge / admin123
```

---

## 📜 Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` | Production build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run db:migrate` | Apply migrations |
| `npm run db:seed` | Seed categories, products, orders and the admin user (idempotent) |
| `npm run db:studio` | Prisma Studio |
| `npm run db:reset` | Drop, re-migrate and re-seed |

---

## 🗂️ Project structure

```
src/
├── app/
│   ├── (shop)/          storefront routes + header/footer chrome
│   ├── admin/
│   │   ├── login/       outside the guarded group, so it can't redirect to itself
│   │   └── (panel)/     auth-guarded admin shell
│   ├── actions/         Server Actions (auth, orders, admin, tracking)
│   ├── sitemap.ts       dynamic sitemap
│   └── robots.ts
├── components/
│   ├── catalog/         filter sidebar, mobile drawer, sort, chips, pagination
│   ├── product/         product card, add-to-cart, purchase panel, wishlist button
│   ├── admin/           admin-only UI (toolbar, forms, tables)
│   ├── layout/          header, footer, info-page renderer
│   ├── providers/       cart + i18n context
│   └── ui/              icons, price, status badge, skeletons
└── lib/
    ├── catalog.ts       product queries and facet counts
    ├── filters.ts       filter parsing/serialising (shared client + server)
    ├── cart-store.ts    localStorage cart as an external store
    ├── favorites-store.ts
    ├── auth.ts          session cookie + password hashing
    └── i18n.ts          translation dictionaries
```

---

## 🎨 Design system

Every colour, radius, shadow, font and type-scale step is a design token at the top of
`src/app/globals.css`, with the shared `.btn` / `.card` / `.field` / `.badge` primitives right
below. Components reference tokens, never hard-coded values — so a full visual redesign is an
edit to that one file.

The type scale is deliberately **fixed**: no font-size changes at any breakpoint, and a 13px
floor. Text is the same size on a 380px phone as on a 27" monitor, and switching between
Georgian and English never resizes or reflows anything — product titles reserve both of their
lines so a row of cards stays aligned in either language.

---

## 📝 Notes

- **Product images.** All seeded products share `public/products/placeholder.svg`. Set a real
  image URL per product in the admin. `next.config.ts` currently allows any HTTPS host — narrow
  `remotePatterns` to your own CDN before production.
- **Every Server Action re-checks the session.** Actions are reachable by direct `POST`, so the
  admin layout's redirect is not treated as the only gate.
- **Order tracking requires the phone number**, not just the order number, so order numbers
  can't be enumerated to read customers' details.

---

<div align="center">

Built by [tornikepe](https://github.com/tornikepe)

</div>
