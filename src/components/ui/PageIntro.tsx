/**
 * The head of a page that is *yours* — the cart, the wishlist — set in the
 * middle: the small line above, the title in the serif, and one line under
 * it saying what the page holds. Everything on these pages is centred on a
 * phone, so the head is too.
 */
export function PageIntro({
  eyebrow,
  title,
  line,
  children,
}: {
  eyebrow: string;
  title: string;
  line?: React.ReactNode;
  /** Actions under the line — a button or two, centred. */
  children?: React.ReactNode;
}) {
  return (
    <div className="page-intro">
      <p className="eyebrow">{eyebrow}</p>
      <h1 className="display-md mt-2 text-ink-900">{title}</h1>
      {line && <p className="mt-2.5 text-sm text-ink-500">{line}</p>}
      {children && <div className="mt-5 flex flex-wrap items-center justify-center gap-2">{children}</div>}
    </div>
  );
}
