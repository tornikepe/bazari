# Bazari — road to "drop in a business and sell"

**The goal, stated plainly:** everything except the business name and the products should already
be built, polished and working. The day you decide what you are selling, the only things you
should have to supply are a name, a logo, contact details and a catalogue — not a single code
change.

This roadmap is written against a measurement, not a guess. Section 0 is what a sweep of the
live code actually found on 7 August 2026; everything after it follows from that.

---

## 0. Where it actually stands

A sweep of **16 public pages × 8 widths (320→1536) × 2 languages** — 256 page renders — checking
horizontal overflow, tap-target size, accessible names and image alt text.

| Result | Count | Verdict |
|---|---|---|
| Horizontal overflow | **0** | Solid. This is the thing most sites fail and it is genuinely clean. |
| Images without `alt` | **0** | Solid. |
| Controls under 24×24px | **400 distinct** | 🔴 Real. Mostly footer and nav links at 19px tall. |
| Controls with no accessible name | **3** | 🔴 Real. Product-card image links announce as just "link". |

Plus what the existing suite already guarantees: 211 unit + 83 e2e tests, no layout shift between
Georgian and English, WCAG AA contrast in both themes computed from real token values,
authorization boundaries proven by replaying captured requests.

**So the responsive *layout* is in good shape. What is not finished is everything a finger and a
screen reader touch, and — much more importantly — the shop is still Bazari-shaped in code.**

---

## 1. 🔴 The structural gap: this shop is hardcoded

This is the whole ask, and it is one problem, not many. Today a new business cannot use this
without a developer, because these live in source files:

| What | Where it lives now | Should be |
|---|---|---|
| Shop name, tab title | `src/lib/site.ts` — a `const` | Settings row in the database |
| Logo | `src/components/ui/Logo.tsx` — a React component | Uploaded image, with the mark as fallback |
| Currency `₾` | `src/lib/format.ts` — a `const` | Settings, with locale-correct placement |
| Free-shipping threshold, delivery fee | `src/lib/cart-rules.ts` — two `const`s | Settings, editable in the dashboard |
| About / FAQ / shipping / returns / warranty / terms / privacy | `src/lib/info-pages.ts` — hardcoded prose in both languages | Editable pages in the dashboard |
| Contact details | Nowhere — deliberately, to avoid inventing them | Settings, and the contact page renders what is set |
| Email sender name and footer | Template literals in `src/lib/order-emails.ts` | Derived from settings |

**There is no settings page in the dashboard at all.** The route list is products, categories,
orders, customers — nothing else.

### 1.1 — Shop settings ✅ **done**

- ✅ `ShopSettings` table, single row, cached per request so it costs one query however many
  components ask for it
- ✅ Dashboard → **Settings**: Shop · Contact · Delivery
- ✅ Name, tab suffix per language, tagline, logo URL — the name reaches the header, footer, tab
  title, sign-in page and emails
- ✅ Contact details, each optional, and **an empty field renders nothing at all** rather than a
  row with a dash in it
- ✅ Delivery threshold and fee, applied in one place so the cart, the checkout total and the
  shipping page cannot disagree
- ✅ Every column defaults to the constant it replaced, so the migration changed nothing on screen

Found and fixed on the way: the shipping page told customers delivery was free over ₾20,000 with
a ₾1,500 fee — it interpolated raw tetri and the money-as-integers migration had missed it.

**Not done, deliberately:** the currency symbol. `formatPrice` has 56 call sites and threading
half of them would put two currencies on one page. The column exists; the pass is its own job.

### 1.2 — Editable information pages ✅ **done**

- ✅ All eight pages moved from `info-pages.ts` into a table, seeded with the text that ships in
  the repo, which also stays as the fallback for an unseeded database
- ✅ Edited in the dashboard, both languages side by side — the mistake worth preventing is
  changing one and forgetting the other
- ✅ Body format is two rules, not JSON: `## ` starts a section, everything else is a paragraph.
  A textarea an owner can type into beats a structured editor nobody can use unaided
- ✅ Figures are placeholders — `{freeShipping}` resolves from settings at render, so a page can
  never state a delivery rule the checkout no longer applies
- ✅ Unpublished pages leave the footer instead of rendering an empty shell, and the footer uses
  each page's own title

### 1.3 — Brand theming without a code change 🔵 **next**

> ✅ **Unblocked — the database now runs on Neon** (`us-east-1`, free tier),
> replacing the Prisma Postgres account that had started refusing every
> connection with `planLimitReached`. The old database could not be read, so
> nothing was exported: the move is a rebuild from the 15 migrations plus the
> seed, which loses only hand-typed dashboard edits.
>
> Two connection strings, because they are not interchangeable. `DATABASE_URL`
> is the **pooled** endpoint (`-pooler` in the host) — serverless functions open
> a connection per invocation and would otherwise exhaust the server's limit.
> `DIRECT_URL` is the plain endpoint, used only by `prisma migrate`, whose
> session-level advisory lock does not survive a transaction-mode pooler.
>
> Verified end to end: all 15 migrations applied, `npm run db:verify` green,
> `npm run db:audit` finds no damage, 222 unit tests and the full e2e suite pass
> against it, and production serves from it. Round trips run ~150ms rather than
> the ~0.2ms of a local database, which is why the e2e assertion budget was
> resized — see `playwright.config.ts`.

- Brand colour and mark set in Settings, injected as CSS custom properties on `<html>`
- The design system already makes this possible: every colour is a token in one file and no
  component hardcodes a value. This is the payoff of that decision
- Contrast is re-checked against the chosen colour at save time, and a colour that fails AA is
  refused with an explanation rather than accepted quietly

---

## 2. 🔴 Responsive, finished properly

The layout does not break. What is unfinished is touch and assistive technology.

### 2.1 — Tap targets (400 findings)

WCAG 2.2 asks for 24×24 CSS px; Apple and Google both recommend 44px for anything a thumb aims
at. Footer and nav links currently render 19px tall. The exception in the spec is for links
inline *in a sentence* — footer links in a list are not that, so they do not qualify.

- Footer and nav link rows get vertical padding to clear 44px
- Icon buttons audited for a 44px hit area even where the icon is smaller — the visual size stays,
  the touchable area grows
- Checkbox and radio rows in the filter rail made row-height targets, not 16px squares
- The audit script becomes a test, so this cannot regress

### 2.2 — Accessible names (3 findings)

- Product-card image links currently announce as "link" with no text. Either label them or, better,
  remove the duplicate link so the card has exactly one focusable target
- The `sr-only` input on `/catalog` checked and labelled

### 2.3 — Real-device behaviour the desktop sweep cannot see

- iOS Safari 100vh and the dynamic address bar, on the chat panel and the mobile filter sheet
- `env(safe-area-inset-*)` on the notch and home indicator for the sticky buy bar and drawers
- Touch scrolling inside the filter rail and the chat transcript with momentum
- Landscape phone, which nothing has ever been checked at
- Keyboard-open behaviour on mobile: the checkout form must not hide the field being typed into
- Reduced motion, forced colours (Windows high contrast), and 200% browser zoom

### 2.4 — Keyboard and screen reader

- Full keyboard pass on every flow: catalogue → product → cart → checkout → order
- Focus trap in the drawers and the chat panel; focus returned to the trigger on close
- Skip-to-content link
- Live regions for cart updates and form errors, so a screen reader is told what changed
- `aria-current`, heading order and landmark audit per page

---

## 3. 🎨 Design, taken further

The Swiss direction is right and consistent. What it lacks is the last 10% that separates
"clean" from "considered".

### 3.1 — What is missing rather than wrong

- **Empty states.** Several pages show a line of grey text where they should show a drawing, an
  explanation and the one action that fixes it
- **Loading states.** Skeletons exist for the product grid; the dashboard, cart and order pages
  still jump
- **Error states.** A failed action mostly produces a red sentence; it should say what to do next
- **Product page.** The weakest page on the site — no gallery, no specification table worth the
  name, no cross-sell beyond "related"
- **Density on the dashboard.** Tables are readable but plain; column sorting, saved views, bulk
  actions and inline editing are all missing
- **The 404 and error pages** are functional and unloved

### 3.2 — Craft

- A proper icon for empty states and errors rather than a grey circle
- Micro-interactions on add-to-cart, quantity change and status change — the site animates panels
  well and value changes not at all
- Print stylesheet for the order/invoice page, which a shop actually uses
- Dark mode reviewed page by page rather than trusted to the token swap
- An actual favicon set, web manifest and PWA install prompt

---

## 4. 🧩 What a real shop needs and this does not have

Ordered by how badly a business would miss it.

| Priority | Item | Why |
|---|---|---|
| 🔴 | **Product images** | Every product shares one placeholder. Upload, gallery, ordering, alt text per language, AVIF/WebP. *Needs a Blob token from you.* |
| 🔴 | **Payment** | The adapter interface is written and tested; nothing implements it. *Needs a provider from you.* |
| 🔴 | **Settings** | Section 1 |
| 🟠 | **Coupon management** | The `Coupon` table and validation exist and work — there is no dashboard page to create one |
| 🟠 | **Staff management** | Roles are changeable only through Prisma Studio. Needs invite, role change, deactivate |
| 🟠 | **Order invoice / receipt** | Printable, and attached to the confirmation email |
| 🟠 | **Stock control** | Restock from the dashboard, low-stock email, "notify me when back" for shoppers |
| 🟡 | **Product variants** | Size and colour. A schema change and the biggest single feature here |
| 🟡 | **Search that works** | Currently `contains`. Needs Postgres full-text with Georgian stemming — the assistant already had to work around this |
| 🟡 | **Delivery options** | Courier vs pickup, zones, per-zone pricing |
| 🟡 | **Tax / VAT** | Displayed and recorded per order. Georgia is 18% |
| 🟡 | **Returns** | A request flow, not just a policy page |
| 🟢 | **Reviews** | Only if real. The site's rule against invented numbers stands |
| 🟢 | **Wishlist on the account** | Currently `localStorage` only — lost when the browser is cleared |
| 🟢 | **Abandoned-cart email** | Needs the sending domain |

---

## 5. 🧪 Testing

Today: 211 unit, 83 e2e, one browser, CI on every push. Good coverage of logic and flows; three
gaps.

- **Visual regression.** Screenshot every page × 2 themes × 2 languages × 3 widths and diff on
  every PR. This is the only way "the design does not quietly rot" becomes a fact rather than a hope
- **Cross-browser.** Chromium only today. Add Firefox and WebKit — WebKit especially, since it is
  where the iOS bugs in §2.3 will surface
- **The audit script becomes a test.** The sweep that produced §0 should run in CI, so tap targets
  and unnamed controls cannot come back
- **Accessibility assertions.** `axe-core` on every page in both languages
- **Load.** The site has been down once already from connection exhaustion; a modest load test on
  the catalogue and checkout would have caught it before customers did
- **A seeded, disposable test database** so e2e stops mutating the same data it reads — the
  buy-bar tests already broke once because the checkout suite sold out the product they used

---

## 6. ⚙️ Operations

- ✅ Session revocation — a password reset now ends every other session
- ✅ Commit attribution guard — a pre-push hook refuses commits GitHub cannot link
- **Admin audit log** — who changed which price, and when
- **Error tracking** (Sentry with source maps) — *needs an account from you*
- **Uptime alerting** to your phone
- **Backups**: confirm retention and **restore once**, to prove it works
- **Analytics** — privacy-friendly, no cookie banner needed
- **Custom domain** — `bazari.ge` reads better than a `vercel.app` subdomain
- **Staging database**, so migrations are rehearsed before production
- **Rate limiting on checkout**, not just auth

---

## 7. Order of work

**Phase 1 — make it configurable.** §1.1 settings, §1.2 info pages, §1.3 theming.
*Nothing else matters as much: until this is done, "use it for my business" means "edit
TypeScript".*

**Phase 2 — finish responsive and accessibility.** §2.1 tap targets, §2.2 names, §2.3 real
devices, §2.4 keyboard. Then §5's audit-as-test so it stays fixed.

**Phase 3 — design depth.** §3.1 states, §3.2 craft, and the product page rebuilt.

**Phase 4 — the shop features.** Coupons, staff, invoice, stock. Images and payment slot in here
the moment you supply a token and a provider.

**Phase 5 — testing and operations.** §5 and §6.

---

## 8. What only you can do

Everything else is mine. These four are not, and three of them block work above.

| | What | Blocks |
|---|---|---|
| **A1** | A sending domain verified in Resend | Every customer email |
| **A2** | A payment provider application | §4 payment |
| **A3** | Product photos + a Vercel Blob token | §4 images — the largest visible improvement available |
| **A4** | Real business details, when you have a business | §1.1 contact settings |

None of Phase 1, 2, 3 or 5 waits on any of them.

---

## Appendix — the audit, reproducible

The measurement in §0 came from a sweep across every public page at eight widths in both
languages, checking `documentElement.scrollWidth` against `clientWidth`, every interactive
element's bounding box against 24×24, every control for an accessible name, and every image for
`alt`. §5 turns it into a test that runs in CI rather than a script run by hand.

*Last measured: 7 August 2026. Phase 1.1 completed the same day.*
