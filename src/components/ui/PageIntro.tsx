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
  facts,
  children,
}: {
  eyebrow: string;
  title: string;
  line?: React.ReactNode;
  /**
   * What the page holds, one fact per entry — "6 items", "total 2 926,00 ₾".
   *
   * A list rather than one string, because each fact has a number in it and
   * a number must not be parted from the word it belongs to. Written as a
   * sentence, the line broke wherever it ran out of room: `ჯამი` ended one
   * line and `2 926,00 ₾` began the next, and the figure read as belonging
   * to nothing. Each fact is now unbreakable and the line wraps only between
   * them, still down the middle.
   */
  facts?: React.ReactNode[];
  /** Actions under the line — a button or two, centred. */
  children?: React.ReactNode;
}) {
  const shown = facts?.filter(Boolean) ?? [];

  return (
    <div className="page-intro">
      <p className="eyebrow">{eyebrow}</p>
      <h1 className="display-md mt-2 text-ink-900">{title}</h1>

      {shown.length > 0 ? (
        <p className="intro-facts">
          {shown.map((fact, index) => (
            <span key={index}>{fact}</span>
          ))}
        </p>
      ) : (
        line && <p className="mt-2.5 text-sm text-ink-500">{line}</p>
      )}

      {children && <div className="mt-5 flex flex-wrap items-center justify-center gap-2">{children}</div>}
    </div>
  );
}
