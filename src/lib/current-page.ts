/**
 * Whether a link points at the page it is already on.
 *
 * `aria-current="page"` is the one piece of orientation a screen reader cannot
 * get any other way: without it the link to where you already are is
 * indistinguishable from the ten around it. Sighted readers get the same thing
 * from a highlighted item, which is why it tends to be styled and never marked.
 *
 * One function rather than a comparison written at each call site, because the
 * comparison is not as obvious as it looks — see below — and two of them would
 * eventually disagree about `/catalog` and `/catalog?sale=1`.
 */
export function isCurrentPage(href: string, pathname: string, search: string): boolean {
  // Absolute URLs and anchors are never "this page" for this purpose: an anchor
  // is a place within it, and marking it steals the mark from the real entry.
  if (!href.startsWith("/") || href.startsWith("//")) return false;

  const [linkPath, linkQuery = ""] = href.split("?");

  if (linkPath !== pathname) return false;

  // A link with no query — `/catalog` in the menu — is the current page only
  // when the page carries no query either. Otherwise standing on
  // `/catalog?sale=1` would mark plain "Catalogue" as current alongside
  // "Deals", and two current pages is worse than none.
  const current = new URLSearchParams(search);
  const wanted = new URLSearchParams(linkQuery);

  for (const [key, value] of wanted) {
    if (current.get(key) !== value) return false;
  }

  // Every parameter the link asks for is present. It also has to be *all* of
  // them: `/catalog` must not match while a filter is applied, or the menu
  // claims you are on a page you have navigated away from.
  return [...current.keys()].length === [...wanted.keys()].length;
}
