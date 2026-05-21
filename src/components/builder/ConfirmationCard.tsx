"use client";

import { useId, useState, type CSSProperties } from "react";
import { motion } from "framer-motion";
import { Pencil, Check, X } from "lucide-react";
import { C, FONT_DISPLAY, FONT_SANS } from "@/lib/peterna-tokens";
import { CONFIRMATION_FRAMING, VISION_FAILURE, substitutePetName } from "@/lib/library/copy";
import { composeObservationParagraph } from "@/lib/builder/observation";
import type { InferredProfile } from "@/lib/builder/state";

// Stage 1.5 — "Here's what I see" confirmation card.
//
// - Card framing copy is LOCKED (CONFIRMATION_FRAMING).
// - Observation paragraph composed from the inferred profile by
//   composeObservationParagraph().
// - Each field renders as a tappable chip below the paragraph. Tap opens
//   inline edit: enum select for species/age, free-text for breed/coat.
// - On vision-failure we render a gentle fallback (the parent route should
//   have skipped to intake_memory already, but render defensively).

type Species =
  | "dog"
  | "cat"
  | "rabbit"
  | "bird"
  | "hamster"
  | "guinea_pig"
  | "ferret"
  | "reptile"
  | "fish"
  | "horse"
  | "other";

type AgeRange = "puppy_kitten" | "young_adult" | "adult" | "senior";

const SPECIES_OPTIONS: { id: Species; label: string }[] = [
  { id: "dog", label: "Dog" },
  { id: "cat", label: "Cat" },
  { id: "rabbit", label: "Rabbit" },
  { id: "bird", label: "Bird" },
  { id: "hamster", label: "Hamster" },
  { id: "guinea_pig", label: "Guinea pig" },
  { id: "ferret", label: "Ferret" },
  { id: "reptile", label: "Reptile" },
  { id: "fish", label: "Fish" },
  { id: "horse", label: "Horse" },
  { id: "other", label: "Other" },
];

const AGE_OPTIONS: { id: AgeRange; label: string }[] = [
  { id: "puppy_kitten", label: "Puppy / kitten" },
  { id: "young_adult", label: "Young adult" },
  { id: "adult", label: "Adult" },
  { id: "senior", label: "Senior" },
];

type Props = {
  petName: string;
  profile: InferredProfile;
  submitting?: boolean;
  onConfirm: (profile: InferredProfile) => void;
  onVisionFailureContinue?: () => void;
};

type EditingField = null | "species" | "breed" | "coat" | "age";

export default function ConfirmationCard({
  petName,
  profile: initialProfile,
  submitting = false,
  onConfirm,
  onVisionFailureContinue,
}: Props) {
  const [profile, setProfile] = useState<InferredProfile>(initialProfile);
  const [editing, setEditing] = useState<EditingField>(null);
  const [batchEdit, setBatchEdit] = useState(false);

  const chipLabelId = useId();

  if (profile.vision_failure) {
    // Defensive — parent should have already routed past this card.
    const headline = substitutePetName(VISION_FAILURE.headline, petName);
    return (
      <section
        aria-label="Vision pass fallback"
        style={{
          background: "#FFFBF3",
          border: `1px solid ${C.line}`,
          borderRadius: 18,
          padding: "28px 24px",
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        <h2
          style={{
            fontFamily: FONT_DISPLAY,
            fontStyle: "italic",
            fontSize: 24,
            margin: 0,
            color: C.ink,
            lineHeight: 1.4,
          }}
        >
          {headline}
        </h2>
        <p
          style={{
            margin: 0,
            fontFamily: FONT_SANS,
            fontSize: 14,
            color: C.inkSoft,
            lineHeight: 1.55,
          }}
        >
          {VISION_FAILURE.subhead}
        </p>
        {onVisionFailureContinue ? (
          <div style={{ marginTop: 6 }}>
            <motion.button
              type="button"
              onClick={onVisionFailureContinue}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              style={{
                display: "inline-flex",
                alignItems: "center",
                padding: "12px 24px",
                borderRadius: 999,
                fontFamily: FONT_SANS,
                fontSize: 14,
                fontWeight: 500,
                border: "none",
                cursor: "pointer",
                background: C.ink,
                color: C.cream,
              }}
            >
              Continue
            </motion.button>
          </div>
        ) : null}
      </section>
    );
  }

  const paragraph =
    composeObservationParagraph(profile, petName) ??
    `Here are the basics I have for ${petName}. Tap anything to change.`;

  const intro = substitutePetName(CONFIRMATION_FRAMING.intro, petName);
  const outro = CONFIRMATION_FRAMING.outro;
  const acceptLabel = substitutePetName(CONFIRMATION_FRAMING.accept, petName);

  function commitEdit(field: EditingField, value: string) {
    if (!field) return;
    setProfile((p) => {
      switch (field) {
        case "species":
          return { ...p, species: value };
        case "breed":
          return { ...p, breed_guess: value };
        case "coat":
          return { ...p, coat_description: value };
        case "age":
          return { ...p, age_range: value as AgeRange };
      }
    });
    setEditing(null);
  }

  function renderChip(
    field: Exclude<EditingField, null>,
    label: string,
    value: string | undefined,
  ) {
    const isEditing = editing === field || batchEdit;
    const displayValue = value && value.trim().length > 0 ? value : "Tap to add";

    return (
      <div
        role="group"
        aria-labelledby={chipLabelId}
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 6,
          padding: "12px 14px",
          background: isEditing ? "rgba(201, 169, 97, 0.08)" : "#FFFBF3",
          borderRadius: 14,
          border: `1px solid ${isEditing ? C.gold : C.line}`,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
          }}
        >
          <span
            style={{
              fontFamily: FONT_SANS,
              fontSize: 11,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: C.inkSofter,
              fontWeight: 500,
            }}
          >
            {label}
          </span>
          <button
            type="button"
            onClick={() =>
              isEditing ? setEditing(null) : (setBatchEdit(false), setEditing(field))
            }
            aria-label={`Edit ${label}`}
            style={{
              background: "transparent",
              border: "none",
              color: C.inkSoft,
              cursor: "pointer",
              padding: 4,
              display: "inline-flex",
              alignItems: "center",
            }}
          >
            {isEditing ? <X size={14} /> : <Pencil size={14} />}
          </button>
        </div>

        {isEditing ? (
          <FieldEditor
            field={field}
            initialValue={value ?? ""}
            onSave={(v) => commitEdit(field, v)}
            onCancel={() => setEditing(null)}
          />
        ) : (
          <span
            style={{
              fontFamily: FONT_SANS,
              fontSize: 15,
              color: C.ink,
              fontWeight: 500,
            }}
          >
            {displayValue}
          </span>
        )}
      </div>
    );
  }

  const speciesLabel =
    SPECIES_OPTIONS.find((s) => s.id === profile.species)?.label ?? profile.species;
  const ageLabel = AGE_OPTIONS.find((a) => a.id === profile.age_range)?.label;

  return (
    <section
      aria-label="Here's what we see"
      style={{
        background: "#FFFBF3",
        border: `1px solid ${C.line}`,
        borderRadius: 18,
        padding: "28px 24px",
        display: "flex",
        flexDirection: "column",
        gap: 18,
      }}
    >
      <p
        style={{
          margin: 0,
          fontFamily: FONT_SANS,
          fontSize: 13,
          color: C.inkSofter,
          letterSpacing: "0.04em",
          textTransform: "uppercase",
        }}
      >
        {intro}
      </p>

      <p
        style={{
          margin: 0,
          fontFamily: FONT_DISPLAY,
          fontStyle: "italic",
          fontSize: 24,
          color: C.ink,
          lineHeight: 1.5,
          fontWeight: 400,
        }}
      >
        {paragraph}
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
          gap: 10,
          marginTop: 4,
        }}
      >
        {renderChip("species", CONFIRMATION_FRAMING.chip_labels.species, speciesLabel)}
        {renderChip("breed", CONFIRMATION_FRAMING.chip_labels.breed, profile.breed_guess)}
        {renderChip("coat", CONFIRMATION_FRAMING.chip_labels.coat, profile.coat_description)}
        {renderChip("age", CONFIRMATION_FRAMING.chip_labels.age, ageLabel)}
      </div>

      <p
        style={{
          margin: 0,
          fontFamily: FONT_SANS,
          fontSize: 13,
          color: C.inkSofter,
          lineHeight: 1.55,
        }}
      >
        {outro}
      </p>

      <div style={{ display: "flex", gap: 12, marginTop: 6, flexWrap: "wrap" }}>
        <motion.button
          type="button"
          disabled={submitting}
          onClick={() => onConfirm(profile)}
          whileHover={!submitting ? { scale: 1.02 } : {}}
          whileTap={!submitting ? { scale: 0.98 } : {}}
          transition={{ type: "spring", stiffness: 400, damping: 25 }}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "12px 24px",
            borderRadius: 999,
            fontFamily: FONT_SANS,
            fontSize: 14,
            fontWeight: 500,
            border: "none",
            cursor: submitting ? "not-allowed" : "pointer",
            background: C.ink,
            color: C.cream,
            opacity: submitting ? 0.7 : 1,
          }}
        >
          <Check size={14} />
          {acceptLabel}
        </motion.button>
        <button
          type="button"
          onClick={() => {
            setBatchEdit((b) => !b);
            setEditing(null);
          }}
          style={{
            background: "transparent",
            border: `1px solid ${C.ink}`,
            color: C.ink,
            fontFamily: FONT_SANS,
            fontSize: 14,
            cursor: "pointer",
            padding: "12px 22px",
            borderRadius: 999,
            fontWeight: 500,
          }}
        >
          {batchEdit ? "Done editing" : CONFIRMATION_FRAMING.fix}
        </button>
      </div>
    </section>
  );
}

// -----------------------------------------------------------------------------
// Inline field editor: dropdown for enums, text input for free-text.
// -----------------------------------------------------------------------------

function FieldEditor({
  field,
  initialValue,
  onSave,
  onCancel,
}: {
  field: "species" | "breed" | "coat" | "age";
  initialValue: string;
  onSave: (v: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(initialValue);

  const baseInput: CSSProperties = {
    fontFamily: FONT_SANS,
    fontSize: 14,
    color: C.ink,
    background: C.cream,
    border: `1px solid ${C.line}`,
    borderRadius: 10,
    padding: "10px 12px",
    outline: "none",
    width: "100%",
  };

  if (field === "species" || field === "age") {
    const options = field === "species" ? SPECIES_OPTIONS : AGE_OPTIONS;
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <select
          value={value}
          autoFocus
          onChange={(e) => setValue(e.target.value)}
          style={baseInput}
        >
          {!options.find((o) => o.id === value) ? (
            <option value="">Pick one…</option>
          ) : null}
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
        <EditorActions onSave={() => onSave(value)} onCancel={onCancel} />
      </div>
    );
  }

  // breed / coat — free text
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <input
        type="text"
        value={value}
        autoFocus
        onChange={(e) => setValue(e.target.value)}
        style={baseInput}
      />
      <EditorActions onSave={() => onSave(value)} onCancel={onCancel} />
    </div>
  );
}

function EditorActions({
  onSave,
  onCancel,
}: {
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <div style={{ display: "flex", gap: 8 }}>
      <button
        type="button"
        onClick={onSave}
        style={{
          background: C.ink,
          color: C.cream,
          border: "none",
          borderRadius: 999,
          padding: "8px 16px",
          fontFamily: FONT_SANS,
          fontSize: 12,
          fontWeight: 500,
          cursor: "pointer",
        }}
      >
        {CONFIRMATION_FRAMING.chip_save}
      </button>
      <button
        type="button"
        onClick={onCancel}
        style={{
          background: "transparent",
          color: C.inkSofter,
          border: "none",
          padding: "8px 12px",
          fontFamily: FONT_SANS,
          fontSize: 12,
          cursor: "pointer",
          textDecoration: "underline",
          textUnderlineOffset: 3,
        }}
      >
        {CONFIRMATION_FRAMING.chip_cancel}
      </button>
    </div>
  );
}
