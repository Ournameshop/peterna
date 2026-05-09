"use client";

import { motion } from "framer-motion";
import { C, FONT_DISPLAY } from "@/lib/peterna-tokens";

export default function QuietLine({
  animated = false,
  label = "",
  tone = "dark",
}: {
  animated?: boolean;
  label?: string;
  tone?: "dark" | "light";
}) {
  const lineBg = tone === "light" ? "rgba(248,241,228,0.18)" : C.line;
  const labelColor = tone === "light" ? "rgba(248,241,228,0.65)" : C.inkSofter;
  return (
    <div style={{ position: "relative", width: "100%" }} aria-hidden="true">
      <motion.div
        style={{ position: "relative", height: 1, background: lineBg }}
        initial={animated ? { scaleX: 0, originX: 0 } : false}
        whileInView={animated ? { scaleX: 1 } : undefined}
        transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1] }}
        viewport={{ once: true, margin: "-100px" }}
      >
        <motion.div
          style={{
            position: "absolute",
            top: "50%",
            transform: "translateY(-50%)",
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: C.gold,
            boxShadow:
              "0 0 0 4px rgba(201,169,97,0.15), 0 0 18px rgba(201,169,97,0.5)",
          }}
          initial={animated ? { left: "0%" } : { left: "12%" }}
          whileInView={animated ? { left: "12%" } : undefined}
          transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1] }}
          viewport={{ once: true, margin: "-100px" }}
        />
      </motion.div>
      {label && (
        <div
          style={{
            position: "absolute",
            top: 12,
            right: 0,
            fontSize: 10,
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            color: labelColor,
            fontFamily: FONT_DISPLAY,
            fontStyle: "italic",
          }}
        >
          {label}
        </div>
      )}
    </div>
  );
}
