# The rules

One page. Every rule here is enforced by
[`tests/unit/design-rules.test.ts`](tests/unit/design-rules.test.ts), which fails when a page
invents a ninth way to do one of these eight things.

Nine pages were built one at a time and each solved the same problems slightly differently — four
page paddings, thirteen hand-written titles, six card paddings, four tables. Nobody chose any of
them. Each was a copy of whichever page happened to be open. What follows is each of those
decisions made once.

Breaking a rule is allowed. Doing it silently is not: add the file to the test's exception list
with the reason, the way the ones below are.

---

## 1. Four templates, and a page picks one

| Template | What it is |
|---|---|
| **Page** | `.page` for the margins, `PageHeader` for the title, content below. The default |
| **Record** | `.page`, a breadcrumb, then two columns with the title beside the thing itself |
| **Notice** | `.page-notice` and one centred card — a short title, a sentence, one or two buttons |
| **Landing** | Full-width bands, a `display`-scale headline, no page header |

Which route uses which is in the [README](README.md#page-templates).

## 2. One vertical rhythm

`.page` — 1.5rem of vertical padding, 2.5rem from `lg`. No page sets its own.

`.page-notice` — 5rem, because a single card in the middle of an empty page needs room above it or
it reads as a page that failed to load the rest.

## 3. One page header

[`PageHeader`](src/components/layout/PageHeader.tsx): trail, eyebrow, title, count, one line of
purpose, and an action on the right that wraps *below* the title on a narrow screen rather than
squeezing it. Everything but the title is optional. Nothing is reordered.

Two variants, both named in the component:

- `scale="panel"` — the dashboard's smaller title.
- `code` — the title is an identifier, so an order number is set in mono.

## 4. One card

`.card` draws the box. Padding is one of three, and the choice is about what the card *is*:

| | | For |
|---|---|---|
| `.card-pad` | 1.25rem | A card that holds a section of the page |
| `.card-pad-tight` | 1rem | A card that is one row in a list, or a tile in a grid |
| `.card-pad-notice` | 3.5rem / 1.5rem | A card that *is* the page — a 404, an empty cart |

`.card-head` is the bar across the top: the rule and the two paddings, nothing else. What goes in
it — a title alone, a title with a link at the far end, an icon beside a heading — is the page's
business.

## 5. One table

`.table` and its descendants carry the whole thing: the head, the cell padding, the hairline
between rows, the tint on hover. A cell that holds something a reader compares down a column gets
`.figures` — right aligned, tabular. The last column holds the row's controls, under a heading that
says what they change rather than the word "actions".

Below `lg` a table becomes a list of cards, because the honest answer for a seven-column table at
390px is not a table.

## 6. One way to show a row of figures

[`Figures`](src/components/ui/Figures.tsx) — a hairline grid of label-and-value cells, at one size.

Not the dashboard's four tiles at the top of the overview: those are links with icons, and a thing
you can click is not a figure. Not the home page's hero counts either — those are display-scale
type on a landing page.

## 7. Colour, type and motion

Every colour, radius, font and type-scale step is a token at the top of
[`globals.css`](src/app/globals.css). Components reference tokens and never literal values.

The type scale is fixed: no font-size changes at any breakpoint, and a 13px floor. Dark mode
overrides token *values* only — there is not one `dark:` variant in the application.

Motion is restrained and reversible, and switched off under `prefers-reduced-motion`.

## 8. Nothing moves when the language changes

Georgian is the longer language. Switching to it must not move or resize anything;
[`stability.spec.ts`](tests/e2e/stability.spec.ts) measures every control in both languages at four
widths and fails if one changes size.
