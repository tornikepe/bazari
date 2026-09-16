/**
 * A series as one line, the size of a word.
 *
 * No axes, no labels — the figure beside it is the reading, and the line
 * is its shape: rising, falling, spiky, flat. Drawn on the server as an
 * SVG that draws itself in on arrival (`pathLength="1"` and a dash that
 * runs from 1 to 0, see `.spark-line`), with a soft fill under it.
 */
export function Sparkline({
  values,
  className = "",
  tone = "currentColor",
}: {
  values: number[];
  className?: string;
  /** The line's colour; the fill is the same at a fraction of the alpha. */
  tone?: string;
}) {
  if (values.length < 2) return null;

  const width = 100;
  const height = 32;
  const pad = 2;
  const max = Math.max(...values, 1);
  const step = (width - pad * 2) / (values.length - 1);
  const points = values.map((value, index) => {
    const x = pad + index * step;
    const y = height - pad - (value / max) * (height - pad * 2);
    return [Math.round(x * 100) / 100, Math.round(y * 100) / 100] as const;
  });
  const line = points.map(([x, y], index) => `${index === 0 ? "M" : "L"}${x} ${y}`).join(" ");
  const area = `${line} L${points[points.length - 1]![0]} ${height} L${points[0]![0]} ${height} Z`;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      aria-hidden="true"
      className={`spark ${className}`}
      style={{ color: tone }}
    >
      <path d={area} className="spark-area" />
      <path d={line} pathLength={1} className="spark-line" />
    </svg>
  );
}
