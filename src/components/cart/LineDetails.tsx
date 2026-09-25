/**
 * What a line is, as tags: "40", "შავი", "XL" — one for each thing the
 * shop sells this product by.
 *
 * A combination is stored on the line, on the order and in the email as a
 * single string, its values joined by a middle dot (see `labelFor`). One
 * long chip reading "40 · შავი · ბამბა" is a sentence pretending to be a
 * label; split at the dot, it is three facts the eye takes in at once —
 * and a product that grows a third option tomorrow grows a third tag here
 * without anything being changed.
 *
 * Not a client component: it renders the same words wherever the label
 * came from — the cart's line, the checkout's summary, the order page.
 */
export function LineDetails({ label, className = "" }: { label: string; className?: string }) {
  const parts = label
    .split("·")
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length === 0) return null;

  return (
    <span className={`line-details-tags ${className}`}>
      {parts.map((part, index) => (
        <span key={`${part}-${index}`} className="detail-tag">
          {part}
        </span>
      ))}
    </span>
  );
}
