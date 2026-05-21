import { C, FONT_SANS } from "@/lib/peterna-tokens";

// Filters for /admin/renders. Plain HTML <form method="GET"> so navigation
// + back/forward all "just work". Server component — no client hooks needed.

const CAPABILITIES = [
  { value: "", label: "All capabilities" },
  { value: "image", label: "Image" },
  { value: "vision", label: "Vision" },
  { value: "video", label: "Video" },
  { value: "text", label: "Text" },
];

const VENDORS = [
  { value: "", label: "All vendors" },
  { value: "openai", label: "OpenAI" },
  { value: "gemini", label: "Gemini" },
  { value: "fal", label: "fal.ai" },
];

const labelStyle = {
  display: "flex",
  flexDirection: "column" as const,
  gap: 4,
  fontSize: 11,
  letterSpacing: "0.12em",
  textTransform: "uppercase" as const,
  color: C.inkSofter,
  fontFamily: FONT_SANS,
};

const inputStyle = {
  appearance: "none" as const,
  border: `1px solid ${C.line}`,
  background: "rgba(255,255,255,0.7)",
  padding: "8px 12px",
  borderRadius: 8,
  fontSize: 13,
  color: C.ink,
  fontFamily: FONT_SANS,
  minWidth: 160,
};

export default function RendersFilters({
  capability,
  vendor,
  errorsOnly,
  from,
  to,
}: {
  capability: string;
  vendor: string;
  errorsOnly: boolean;
  from: string;
  to: string;
}) {
  return (
    <form
      method="GET"
      style={{
        display: "flex",
        gap: 12,
        alignItems: "flex-end",
        flexWrap: "wrap",
        padding: "16px 20px",
        background: "rgba(255,255,255,0.5)",
        border: `1px solid ${C.line}`,
        borderRadius: 12,
        marginBottom: 16,
      }}
    >
      <label style={labelStyle}>
        Capability
        <select
          name="capability"
          defaultValue={capability}
          style={inputStyle}
        >
          {CAPABILITIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </label>
      <label style={labelStyle}>
        Vendor
        <select name="vendor" defaultValue={vendor} style={inputStyle}>
          {VENDORS.map((v) => (
            <option key={v.value} value={v.value}>
              {v.label}
            </option>
          ))}
        </select>
      </label>
      <label style={labelStyle}>
        From
        <input
          type="date"
          name="from"
          defaultValue={from}
          style={inputStyle}
        />
      </label>
      <label style={labelStyle}>
        To
        <input type="date" name="to" defaultValue={to} style={inputStyle} />
      </label>
      <label
        style={{
          ...labelStyle,
          flexDirection: "row" as const,
          alignItems: "center",
          gap: 8,
          textTransform: "none",
          letterSpacing: "0.02em",
          fontSize: 13,
          color: C.ink,
          paddingBottom: 8,
        }}
      >
        <input
          type="checkbox"
          name="errors_only"
          defaultChecked={errorsOnly}
          value="1"
        />
        Errors only
      </label>
      <button
        type="submit"
        style={{
          padding: "8px 18px",
          borderRadius: 999,
          border: "none",
          background: C.ink,
          color: C.cream,
          fontSize: 12,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          fontFamily: FONT_SANS,
          cursor: "pointer",
        }}
      >
        Apply
      </button>
    </form>
  );
}
