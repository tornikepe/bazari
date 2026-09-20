/**
 * A headline whose words rise one after another.
 *
 * Each word is wrapped twice: an outer span that clips, an inner one that
 * starts below the clip and comes up — the stylesheet's `.split-word`
 * animation, staggered by the word's index. Rendered on the server, so
 * the first paint already has the words in place for anyone who has asked
 * for less motion, and no layout is waited on.
 */
export function SplitWords({ text, className = "" }: { text: string; className?: string }) {
  const words = text.split(/\s+/).filter(Boolean);
  return (
    <span className={className}>
      {words.map((word, index) => (
        <span key={`${word}-${index}`}>
          <span className="split-line">
            <span className="split-word" style={{ "--i": index } as React.CSSProperties}>
              {word}
            </span>
          </span>
          {/* Outside the clipping span: a space at the end of an
              inline-block collapses, and the words ran together. */}
          {index < words.length - 1 ? " " : null}
        </span>
      ))}
    </span>
  );
}
