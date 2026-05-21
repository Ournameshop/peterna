// Phase 14 — formatting helpers for the admin dashboard.
//
// Pure, server- and client-safe. No imports. The admin UI mostly deals in
// money (USD), durations (ms), percents (0..1), and relative timestamps —
// keeping the helpers here means the table components stay focused on layout.
//
// All four use the platform `Intl` APIs; no extra dependency.

const USD = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const USD_COMPACT = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

/** "$1,234.56". Negative and zero pass through as-is. NaN → "—". */
export function formatUsd(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return USD.format(n);
}

/**
 * Same as `formatUsd` but drops trailing `.00` on whole dollar amounts —
 * useful for summary cards where "$1,234" reads cleaner than "$1,234.00".
 */
export function formatUsdCompact(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return USD_COMPACT.format(n);
}

/**
 * Format a fraction (0..1) as a percent with one decimal. Values outside
 * 0..1 are still rendered (caller bug surfaces visibly, not silently).
 */
export function formatPercent(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  const pct = n * 100;
  // 12.3% — one decimal is precise enough for failure / fallback rates.
  return `${pct.toFixed(1)}%`;
}

/**
 * Format a duration in milliseconds as a short human string:
 *   850ms / 1.2s / 2m 30s / 1h 5m
 *
 * Anchored on "ms" up to one second, "s" up to 60s, "m s" up to an hour,
 * then "h m". Negative or non-finite → "—".
 */
export function formatDuration(ms: number | null | undefined): string {
  if (ms == null || !Number.isFinite(ms) || ms < 0) return "—";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(s < 10 ? 1 : 0)}s`;
  const totalSeconds = Math.round(s);
  if (totalSeconds < 3600) {
    const m = Math.floor(totalSeconds / 60);
    const rest = totalSeconds % 60;
    return rest === 0 ? `${m}m` : `${m}m ${rest}s`;
  }
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

const RELATIVE = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

/**
 * Format an ISO timestamp relative to "now": "3 minutes ago", "yesterday",
 * "in 2 hours". Falls back to an empty string for invalid input. We do not
 * fall back to a date string here — pages that want an absolute date should
 * render it next to the relative form.
 */
export function formatRelative(iso: string | null | undefined): string {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "";
  const diffSec = Math.round((then - Date.now()) / 1000);
  const abs = Math.abs(diffSec);
  // Tiered units; Intl.RelativeTimeFormat handles plural + "ago" / "in"
  // wording. The thresholds match Chrome's `dateStyle:'relative'` shape.
  if (abs < 45) return RELATIVE.format(diffSec, "second");
  if (abs < 2700) return RELATIVE.format(Math.round(diffSec / 60), "minute");
  if (abs < 86_400) return RELATIVE.format(Math.round(diffSec / 3600), "hour");
  if (abs < 5_184_000)
    return RELATIVE.format(Math.round(diffSec / 86_400), "day");
  if (abs < 31_536_000)
    return RELATIVE.format(Math.round(diffSec / 2_592_000), "month");
  return RELATIVE.format(Math.round(diffSec / 31_536_000), "year");
}

/**
 * Format an ISO timestamp as a fixed-locale absolute date string —
 * "May 22, 2026 · 14:03". Used alongside formatRelative on detail screens.
 */
export function formatAbsolute(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** "1,234" — integer counts in tables. */
const INT = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
export function formatInt(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return INT.format(n);
}
