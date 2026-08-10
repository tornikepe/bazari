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
| Controls failing WCAG 2.2 target size | **0** | ✅ **Corrected.** The "400 under 24×24" below counted size and never applied SC 2.5.8's spacing exception. |
| Controls with no accessible name | **0** | ✅ **Corrected.** The "3" came from a check that never looked up `label[for]`. |
| Controls under 44×44 (comfort, not conformance) | **388 → 141** | ⚪ Improved anyway — see §2.1. |

Plus what the existing suite already guarantees: 298 unit + 106 e2e tests, no layout shift between
Georgian and English, WCAG AA contrast in both themes computed from real token values,
authorization boundaries proven by replaying captured requests.

> **Two of the numbers above were wrong, and the correction is the point.** The original sweep
> was a script run by hand. Turning it into a test (`tests/e2e/target-size.spec.ts`) showed it had
> counted every control under 24px as a failure, when SC 2.5.8 passes an undersized target whose
> 24px circle touches no other — the footer links it was mostly counting sat 34px apart and
> cleared it. And its accessible-name check never consulted `label[for]`, so it called ten
> correctly-labelled form fields unnamed. A finding that is wrong costs more than one that is
> missing, because somebody acts on it.

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
| ~~Brand colour~~ | ~~`globals.css` — a ten-shade ramp~~ | ✅ One colour in Settings, ramp derived for both themes |
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

### 1.3 — Brand theming without a code change ✅

- ✅ One colour in Settings becomes the whole brand ramp — ten shades plus the button tokens,
  for both themes — written as custom properties into the document head
- ✅ The payoff of the token system: every colour was already a token in one file and no
  component hardcodes a value, so nothing but `globals.css` had to be touched
- ✅ The ramp is built in OKLCH, which keeps hue steady while lightness moves, then **measured**
  in WCAG luminance and moved until it passes. The two disagree by design — a yellow and a blue
  at the same perceptual lightness differ threefold in luminance — so a ramp that looks evenly
  stepped can still fail AA, and only the measurement is believed
- ✅ Refused with an explanation rather than accepted quietly: a colour that would have to change
  beyond recognition to be readable is rejected, and the nearest colour that *does* work comes
  back with it as a button. Checked in the form and again in the server action, because the
  action takes a POST from anywhere
- ✅ Found and fixed two AA failures in the palette that already shipped — the icon chip at
  4.48:1, and the dashboard's featured badge at 4.05:1 in dark mode, where `brand-700` was
  darker than `brand-600` and no tint could rescue it. Both pairs are now in the static guard

> **The blocker this waited on, for the record.** The Prisma Postgres account
> started refusing every connection with `planLimitReached`, and the old database
> could not even be read, so nothing was exported — the move to **Neon**
> (`us-east-1`, free tier) is a rebuild from the 15 migrations plus the seed, and
> lost only hand-typed dashboard edits.
>
> Two connection strings, because they are not interchangeable. `DATABASE_URL` is
> the **pooled** endpoint — serverless functions open a connection per invocation
> and would otherwise exhaust the server's limit. `DIRECT_URL` is the plain one,
> used only by `prisma migrate`, whose session-level advisory lock does not
> survive a transaction-mode pooler. Round trips run ~150ms against ~0.2ms for a
> local database, which is why the e2e assertion budget was resized.

---

## 2. 🔴 Responsive, finished properly

The layout does not break. What is unfinished is touch and assistive technology.

### 2.1 — Tap targets ✅ **done**

WCAG 2.2 asks for 24×24 CSS px *or* enough spacing; Apple and Google both recommend 44px for
anything a thumb aims at. The site already met the standard. What it did not have was comfort.

- ✅ **Footer links fill their rows** — 19px of target in a 34px row meant half of every row was
  dead space. The list's `gap` became padding on the link, so the target went 19px → 44px with
  the rows keeping the spacing they had. Extracted to one `FooterLink` rather than three copies
- ✅ **Breadcrumbs** 18px → 34px, via `-my-2 py-2`: the padding grows the hit area, the negative
  margin pulls the layout box back so nothing on the page moves. Four hand-rolled copies became
  one `Breadcrumb` component. Not pushed to 44 — that needs 13px a side, which reaches over the
  heading below and starts eating clicks meant for it
- ✅ **Header icon buttons** 40px → 44px. They are ghost buttons with no background at rest, so
  the change is invisible until hover
- ✅ **The product card's favourite button** 32px → 40px. The tidier trick — keep the chip small
  and grow only the touch area with an `::after` ring — was tried, and *does not work here*: the
  card and its image link both have `overflow: hidden`, so the ring is clipped away. It looked
  right in the CSS and caught nothing. Growing the chip is uglier and works
- ✅ **The audit is a test now** (`tests/e2e/target-size.spec.ts`), run in both languages, and
  verified to fail when the fixes are reverted rather than assumed to work

388 controls under 44px, down to 141. What remains is deliberate: full-width buttons that are
36px tall, 36px logo links, and text links sitting inline in a sentence.

### 2.2 — Accessible names ✅ **done — there were none**

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

### 2.4 — Keyboard and screen reader 🔵 **in progress**

- ✅ **Skip-to-content link** — the first tab stop, hidden until focused and visible the moment
  it is. Without it, reaching the page by keyboard meant tabbing the logo, the search field, its
  button, five icon buttons and the language toggle, on every page. `<main>` gained
  `tabIndex={-1}`, because an element without it is a scroll target but not a focus target and
  the next Tab would carry on from the header as though nothing had happened
- ✅ **The drawers are modal for the keyboard too** — focus moves in on open, is held inside
  while open, and returns to the control that opened it on close. All three drawers get it at
  once because it lives in `useOverlay`. They also gained `role="dialog"`, `aria-modal` and a
  real name: a dialog without one announces as "dialog" and nothing else
- ✅ Focus lands on the **panel**, not on the first focusable thing in the container — which was
  the scrim, so the drawer opened with "Close" selected and read as though it were already
  dismissing itself
- ✅ **Tested by pressing keys**, not by asserting attributes (`tests/e2e/keyboard.spec.ts`), and
  verified by disabling each fix and watching three of the four tests go red. `aria-modal="true"`
  on a drawer that lets Tab wander out behind it is a claim, not a behaviour — and it is exactly
  what a test that trusted the markup would have passed
- Full keyboard pass on the remaining flows: catalogue → product → cart → checkout → order
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

**Phase 1 — make it configurable. ✅ Done.** §1.1 settings, §1.2 info pages, §1.3 theming.
*This was the one that mattered: "use it for my business" no longer means "edit TypeScript".
A name, a colour, contact details and the eight information pages are now all set from the
dashboard. What is still hardcoded is listed in the table above — the currency symbol, and the
logo, which needs somewhere to upload an image to.*

**Phase 2 — finish responsive and accessibility.** §2.1 tap targets, §2.2 names, §2.3 real
devices, §2.4 keyboard. Then §5's audit-as-test so it stays fixed.

**Phase 3 — design depth.** §3.1 states, §3.2 craft, and the product page rebuilt.

**Phase 4 — the shop features.** Coupons, staff, invoice, stock. Images and payment slot in here
the moment you supply a token and a provider.

**Phase 5 — testing and operations.** §5 and §6.

**Phase 6 — the documentation pass, last.** §8.

---

## 8. The documentation pass, when everything else is done

Written down as a phase rather than left as good intentions, because it is the part that is
always meant to happen and never scheduled.

The README is kept current as each piece lands — that is not this. This is the pass at the end
that reads the whole thing as one document, from the position of someone who has never seen the
project, and fixes what only becomes visible once everything exists:

- **Every claim re-verified against the code**, not against what the code did when the sentence
  was written. Every command in the README actually run; every ratio, count and file path
  checked. A README is trusted more than the code it describes, so a stale line in it does more
  damage than a stale comment
- **The three account passwords and `AUTH_SECRET`** — how they are generated, where they are
  stored, how they reach an account, and how to rotate one. This is the part people get stuck
  on, and it is the reason `npm run setup:credentials` exists
- **One route in, one route out.** Someone cloning this should reach a running shop with real
  data without reading anything twice; someone dropping their own business in should find that
  path stated in one place rather than assembled from four sections
- **Screenshots that match what ships**, in both languages and both themes
- **Every environment variable**: what it is for, what breaks without it, and whether it is
  required or optional
- **The honest limits.** What is deliberately not built, what is demo-only, and what would have
  to change to take real money. A project that overstates itself is worse than one that says
  plainly where it stops

Nothing here is a rewrite. It is the difference between documentation that exists and
documentation that is true.

---

## 9. What only you can do

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
