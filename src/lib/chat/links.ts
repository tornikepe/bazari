/**
 * Finding site links inside the assistant's text.
 *
 * The assistant is told to write links as plain paths (`/product/anker-…`)
 * rather than markdown, because a chat bubble that renders raw `[text](url)`
 * is worse than one with a bare path in it. This turns those paths back into
 * something clickable.
 *
 * The allowlist is the security boundary, not a convenience. Two things it
 * prevents:
 *
 * - Ordinary text becoming a link. "24/7" and "and/or" contain a slash and a
 *   word, and a naive pattern turns both into broken destinations.
 * - A destination chosen by model output. Only paths matching a route this app
 *   actually has are linked, so nothing here can produce an off-site href — no
 *   `http://`, no protocol-relative `//host`, no `javascript:`.
 *
 * Kept out of the component so it can be tested without a DOM.
 */

export const LINKABLE_ROUTES = [
  "product",
  "catalog",
  "track",
  "faq",
  "shipping",
  "returns",
  "warranty",
  "about",
  "contact",
  "terms",
  "privacy",
  "cart",
  "favorites",
  "account",
  "order",
  "login",
  "register",
] as const;

/**
 * `/route`, optionally followed by `/segments` and one `?query`.
 *
 * The alternation is anchored by the leading slash and a word boundary at the
 * end of the route name, so `/catalogue` does not match `/catalog`.
 */
const PATH = new RegExp(
  `/(?:${LINKABLE_ROUTES.join("|")})\\b(?:/[\\w%-]+)*(?:\\?[\\w=&%.-]+)?`,
  "g",
);

export type Segment =
  | { type: "text"; value: string }
  | { type: "link"; href: string };

/** Sentence punctuation swept up by the match doesn't belong in the href. */
function trimTrailing(path: string): { href: string; tail: string } {
  const match = /[.,;:!?)]+$/.exec(path);
  if (!match) return { href: path, tail: "" };
  return { href: path.slice(0, match.index), tail: match[0] };
}

/** Splits one line into plain text and link segments, in order. */
export function splitLinks(line: string): Segment[] {
  const segments: Segment[] = [];
  let cursor = 0;

  const push = (value: string) => {
    if (!value) return;
    const last = segments[segments.length - 1];
    // Merge adjacent text so a trailing full stop doesn't become its own node.
    if (last?.type === "text") last.value += value;
    else segments.push({ type: "text", value });
  };

  for (const match of line.matchAll(PATH)) {
    push(line.slice(cursor, match.index));

    const { href, tail } = trimTrailing(match[0]);
    // A match that is nothing but punctuation after trimming isn't a link.
    if (href.length > 1) segments.push({ type: "link", href });
    else push(match[0].slice(0, match[0].length - tail.length));
    push(tail);

    cursor = match.index + match[0].length;
  }

  push(line.slice(cursor));
  return segments;
}
