import { C } from "@/lib/peterna-tokens";

// Phase 14 — pure inline SVG sparkline. No chart library.
//
// Path computation:
//   - x is `i * (W - 2*pad) / (n - 1) + pad` so the line spans the box with
//     a small horizontal padding so the stroke doesn't clip at the edges.
//   - y maps each datum onto [0, H - 2*pad] inverted (SVG y grows downward),
//     so the highest value sits near the top. If max == min we pin to mid.
//   - The path is one `M` + `(n-1)` `L` segments; the area fill is the same
//     path closed back along the baseline.

type Props = {
  data: number[];
  width?: number;
  height?: number;
  stroke?: string;
  fill?: string;
  /** Optional accessible label — read by screen readers via aria-label. */
  ariaLabel?: string;
};

export default function Sparkline({
  data,
  width = 320,
  height = 64,
  stroke = C.sage,
  fill = "rgba(143,166,142,0.18)",
  ariaLabel,
}: Props) {
  if (!data || data.length === 0) {
    return (
      <svg
        width={width}
        height={height}
        role="img"
        aria-label={ariaLabel ?? "no data"}
      />
    );
  }
  const pad = 4;
  const w = Math.max(1, width - pad * 2);
  const h = Math.max(1, height - pad * 2);
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const n = data.length;

  // If we only have one point, render a single dot at the right edge.
  if (n === 1) {
    const cx = pad + w;
    const cy = pad + h / 2;
    return (
      <svg
        width={width}
        height={height}
        role="img"
        aria-label={ariaLabel ?? `value ${data[0]}`}
      >
        <circle cx={cx} cy={cy} r={2.5} fill={stroke} />
      </svg>
    );
  }

  const xs = data.map((_, i) => pad + (i * w) / (n - 1));
  const ys = data.map((v) => {
    const norm = (v - min) / range;
    return pad + (1 - norm) * h;
  });

  // Line path — single M then a chain of L commands.
  let d = `M ${xs[0].toFixed(2)} ${ys[0].toFixed(2)}`;
  for (let i = 1; i < n; i++) {
    d += ` L ${xs[i].toFixed(2)} ${ys[i].toFixed(2)}`;
  }
  // Area path — same line then down to the bottom-right, along the
  // baseline, and back up, closed with Z.
  const areaD = `${d} L ${xs[n - 1].toFixed(2)} ${(pad + h).toFixed(2)} L ${xs[0].toFixed(2)} ${(pad + h).toFixed(2)} Z`;

  // Last-point dot — a small visual anchor on the rightmost data point.
  const lastX = xs[n - 1];
  const lastY = ys[n - 1];

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={ariaLabel ?? `sparkline of ${n} values`}
      style={{ display: "block" }}
    >
      <path d={areaD} fill={fill} stroke="none" />
      <path
        d={d}
        fill="none"
        stroke={stroke}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={lastX} cy={lastY} r={2.5} fill={stroke} />
    </svg>
  );
}
