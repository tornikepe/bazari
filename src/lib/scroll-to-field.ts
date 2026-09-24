/**
 * Bringing a field the shopper has to fix into view.
 *
 * The page scrolls smoothly under Lenis, which drives the window itself —
 * so a plain `scrollIntoView` starts a native scroll that Lenis then
 * overrides on its next frame, and the page lurches back. `Motion` hands
 * its instance here when it mounts; when there is one, the scroll goes
 * through it and behaves like every other scroll on the site. When there
 * is not — the admin, the auth pages, a visitor who asked for reduced
 * motion — the browser's own is used.
 */
type Scroller = {
  scrollTo: (target: HTMLElement, options?: { offset?: number }) => void;
};

let scroller: Scroller | null = null;

export function registerScroller(instance: Scroller | null) {
  scroller = instance;
}

/** How far above the field to stop: the header, plus room to breathe. */
function headroom() {
  const header = document.querySelector("header");
  return -((header?.offsetHeight ?? 64) + 24);
}

export function scrollToField(element: HTMLElement | null) {
  if (!element) return;

  if (scroller) scroller.scrollTo(element, { offset: headroom() });
  else element.scrollIntoView({ behavior: "smooth", block: "center" });

  /* Focus after the scroll has been asked for and with `preventScroll`,
     because focusing first jumps the page to the field instantly and the
     smooth scroll then animates from nowhere to the same place. */
  window.setTimeout(() => {
    try {
      element.focus({ preventScroll: true });
    } catch {
      // A field that cannot take focus still got scrolled to, which is
      // the half that matters.
    }
  }, 260);
}
