"use client";

import {
  useEffect,
  useId,
  useMemo,
  useState,
  type CSSProperties,
} from "react";
import { motion } from "framer-motion";
import { C, FONT_DISPLAY, FONT_SANS } from "@/lib/peterna-tokens";
import { WORDS_EDITOR, substitutePetName } from "@/lib/library/copy";
import {
  MUSIC_TRACKS,
  defaultMusicForFormat,
  type MusicTrack,
} from "@/lib/library/music-tracks";
import {
  NARRATION_VOICES,
  type NarrationVoice,
} from "@/lib/library/narration-voices";
import {
  defaultOpeningArchetypeForFormat,
  resolveOpeningArchetype,
} from "@/lib/library/opening-archetypes";
import { DEFAULT_CLOSING_TEXT } from "@/lib/library/closing-archetypes";

// Stage 5.5 — The Words editor.
//
// Panel layout (top → bottom):
//   1. Opening title card — multiline TextField pre-filled with the format's
//      opening archetype template (PET_NAME substituted). Empty submission
//      means "use the library default."
//   2. Closing card — multiline TextField pre-filled with "With love, always".
//   3. Music — PillPicker over MUSIC_TRACKS. Default = first track whose
//      format_affinity includes the session's format. Optional ("No music").
//   4. Narration (optional) — PillPicker over NARRATION_VOICES + textarea.
//      Off by default; the user opts in by tapping a voice pill.
//
// Defaults are generous on purpose. A user who taps "Continue to card
// preview" without touching anything ends up with a complete tribute: their
// pet's name on the opening, "With love, always" on the closing, no music,
// no narration. Skipping never gates anything.
//
// State is owned here for live edits; the parent (BuilderClient) receives
// updates via `onChange` and persists them through PATCH /api/words.
// `onContinue` fires the words_approved → POST /api/words/approve handler.

export type WordsEditorState = {
  opening_title_card_text: string | null;
  closing_card_text: string | null;
  music_track_id: string | null;
  narration_voice_id: string | null;
  narration_text: string | null;
};

type Props = {
  petName: string | null;
  formatId: string | null;
  initial: WordsEditorState;
  /** Fires on every field commit (blur, pill tap) — caller PATCHes /api/words. */
  onChange: (patch: Partial<WordsEditorState>) => void;
  /** Fires when the user taps "Continue to card preview". */
  onContinue: () => void;
  disabled?: boolean;
  submitting?: boolean;
};

export default function WordsEditor({
  petName,
  formatId,
  initial,
  onChange,
  onContinue,
  disabled = false,
  submitting = false,
}: Props) {
  // Compute the prefill defaults once per (petName, formatId) tuple so we
  // never overwrite the user's edits on a re-render. The pre-fill happens at
  // mount via the words_loaded effect below.
  const defaultOpening = useMemo(
    () =>
      resolveOpeningArchetype(
        defaultOpeningArchetypeForFormat(formatId),
        petName ?? 'your pet',
      ),
    [petName, formatId],
  );
  const defaultClosing = useMemo(
    () => substitutePetName(DEFAULT_CLOSING_TEXT, petName),
    [petName],
  );
  const defaultMusicId = useMemo(
    () => defaultMusicForFormat(formatId),
    [formatId],
  );

  // Local state shadows the parent's so live edits feel snappy; commits flow
  // up via onChange on blur (text) or tap (pills).
  const [opening, setOpening] = useState<string>(
    initial.opening_title_card_text ?? defaultOpening,
  );
  const [closing, setClosing] = useState<string>(
    initial.closing_card_text ?? defaultClosing,
  );
  const [musicId, setMusicId] = useState<string | null>(
    // null in `initial` means "user has not touched this yet" → apply the
    // format-driven default. The default is shown selected so the user sees
    // the choice we've made for them; tapping "No music" opts out.
    initial.music_track_id === undefined
      ? defaultMusicId
      : initial.music_track_id ?? defaultMusicId,
  );
  const [narrationVoiceId, setNarrationVoiceId] = useState<string | null>(
    initial.narration_voice_id ?? null,
  );
  const [narrationText, setNarrationText] = useState<string>(
    initial.narration_text ?? "",
  );

  // On first mount, push the resolved defaults up to the parent so the
  // session row matches what the user is looking at. The parent debounces
  // before the actual PATCH — this is just to keep local + remote in sync.
  // We only emit changes for fields the user hasn't already set.
  useEffect(() => {
    const patch: Partial<WordsEditorState> = {};
    if (
      initial.opening_title_card_text === null ||
      initial.opening_title_card_text === undefined
    ) {
      patch.opening_title_card_text = defaultOpening;
    }
    if (
      initial.closing_card_text === null ||
      initial.closing_card_text === undefined
    ) {
      patch.closing_card_text = defaultClosing;
    }
    // Music: only seed when the user has NOT explicitly chosen yet. Backend
    // null means "untouched"; once the user picks (including the no-music
    // pill below), we never overwrite.
    if (initial.music_track_id === null && defaultMusicId) {
      patch.music_track_id = defaultMusicId;
    }
    if (Object.keys(patch).length > 0) {
      onChange(patch);
    }
    // We intentionally fire once on mount only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Helpers — debounced text commit on blur, immediate pill commit on tap.
  function commitOpening(value: string) {
    const next = value.length > 0 ? value : null;
    onChange({ opening_title_card_text: next });
  }
  function commitClosing(value: string) {
    const next = value.length > 0 ? value : null;
    onChange({ closing_card_text: next });
  }
  function commitMusic(id: string | null) {
    setMusicId(id);
    onChange({ music_track_id: id });
  }
  function commitNarrationVoice(id: string | null) {
    setNarrationVoiceId(id);
    onChange({ narration_voice_id: id });
    if (id === null) {
      // Clearing the voice also clears any drafted narration text.
      setNarrationText("");
      onChange({ narration_voice_id: null, narration_text: null });
    }
  }
  function commitNarrationText(value: string) {
    onChange({ narration_text: value.length > 0 ? value : null });
  }

  const narrationOpen = narrationVoiceId !== null;
  const subhead = substitutePetName(WORDS_EDITOR.subhead, petName);

  return (
    <section
      aria-label="Stage 5.5 — The Words"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 28,
      }}
    >
      <header
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 8,
          textAlign: "center",
        }}
      >
        <h2
          style={{
            margin: 0,
            fontFamily: FONT_DISPLAY,
            fontStyle: "italic",
            fontSize: 30,
            lineHeight: 1.3,
            color: C.ink,
            fontWeight: 400,
            letterSpacing: "-0.005em",
          }}
        >
          {substitutePetName(WORDS_EDITOR.headline, petName)}
        </h2>
        <p
          style={{
            margin: "0 auto",
            maxWidth: 540,
            fontFamily: FONT_SANS,
            fontSize: 14,
            color: C.inkSofter,
            lineHeight: 1.6,
          }}
        >
          {subhead}
        </p>
      </header>

      {/* 1. Opening title card */}
      <FieldSection
        label={WORDS_EDITOR.sections.opening.label}
        hint={WORDS_EDITOR.sections.opening.hint}
      >
        <MultilineField
          value={opening}
          placeholder={substitutePetName(
            WORDS_EDITOR.sections.opening.placeholder,
            petName,
          )}
          maxLength={140}
          onChange={setOpening}
          onCommit={commitOpening}
          disabled={disabled}
          ariaLabel={WORDS_EDITOR.sections.opening.label}
        />
      </FieldSection>

      {/* 2. Closing card */}
      <FieldSection
        label={WORDS_EDITOR.sections.closing.label}
        hint={WORDS_EDITOR.sections.closing.hint}
      >
        <MultilineField
          value={closing}
          placeholder={WORDS_EDITOR.sections.closing.placeholder}
          maxLength={140}
          onChange={setClosing}
          onCommit={commitClosing}
          disabled={disabled}
          ariaLabel={WORDS_EDITOR.sections.closing.label}
        />
      </FieldSection>

      {/* 3. Music */}
      <FieldSection
        label={WORDS_EDITOR.sections.music.label}
        hint={WORDS_EDITOR.sections.music.hint}
      >
        <MusicGrid
          tracks={MUSIC_TRACKS}
          selectedId={musicId}
          onPick={commitMusic}
          skipLabel={WORDS_EDITOR.sections.music.skip_pill_label}
          disabled={disabled}
        />
      </FieldSection>

      {/* 4. Narration */}
      <FieldSection
        label={WORDS_EDITOR.sections.narration.label}
        hint={substitutePetName(WORDS_EDITOR.sections.narration.hint, petName)}
      >
        <NarrationBlock
          voices={NARRATION_VOICES}
          selectedVoiceId={narrationVoiceId}
          narrationText={narrationText}
          open={narrationOpen}
          onPickVoice={commitNarrationVoice}
          onChangeText={(v) => setNarrationText(v)}
          onCommitText={commitNarrationText}
          skipLabel={WORDS_EDITOR.sections.narration.skip_pill_label}
          voiceQuestion={WORDS_EDITOR.sections.narration.voice_question}
          textLabel={WORDS_EDITOR.sections.narration.text_label}
          textPlaceholder={WORDS_EDITOR.sections.narration.text_placeholder}
          disabled={disabled}
        />
      </FieldSection>

      {/* Continue */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 10,
          marginTop: 12,
        }}
      >
        <motion.button
          type="button"
          onClick={() => !disabled && !submitting && onContinue()}
          disabled={disabled || submitting}
          whileHover={!disabled && !submitting ? { scale: 1.02 } : {}}
          whileTap={!disabled && !submitting ? { scale: 0.98 } : {}}
          transition={{ type: "spring", stiffness: 400, damping: 25 }}
          style={{
            display: "inline-flex",
            alignItems: "center",
            padding: "14px 28px",
            borderRadius: 999,
            fontFamily: FONT_SANS,
            fontSize: 14,
            fontWeight: 500,
            border: "none",
            cursor: disabled || submitting ? "not-allowed" : "pointer",
            background: C.ink,
            color: C.cream,
            opacity: disabled || submitting ? 0.6 : 1,
            letterSpacing: "0.01em",
          }}
        >
          {submitting ? "Saving…" : WORDS_EDITOR.continue}
        </motion.button>
        <p
          style={{
            margin: 0,
            fontFamily: FONT_SANS,
            fontSize: 13,
            color: C.inkSofter,
            lineHeight: 1.55,
            textAlign: "center",
            maxWidth: 480,
          }}
        >
          {substitutePetName(WORDS_EDITOR.continue_hint, petName)}
        </p>
      </div>
    </section>
  );
}

// -----------------------------------------------------------------------------
// FieldSection — labeled wrapper for each editor block.
// -----------------------------------------------------------------------------

function FieldSection({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 10,
        background: "#FFFBF3",
        border: `1px solid ${C.line}`,
        borderRadius: 18,
        padding: "22px 22px",
      }}
    >
      <header
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 4,
        }}
      >
        <h3
          style={{
            margin: 0,
            fontFamily: FONT_SANS,
            fontSize: 15,
            fontWeight: 600,
            color: C.ink,
            letterSpacing: "0.01em",
          }}
        >
          {label}
        </h3>
        {hint ? (
          <p
            style={{
              margin: 0,
              fontFamily: FONT_SANS,
              fontSize: 13,
              lineHeight: 1.5,
              color: C.inkSofter,
            }}
          >
            {hint}
          </p>
        ) : null}
      </header>
      <div>{children}</div>
    </section>
  );
}

// -----------------------------------------------------------------------------
// MultilineField — local-state textarea that commits on blur.
//
// (We don't reuse <TextField> here because it owns its own submit semantics
// and we want field-level autosave + no per-field submit button.)
// -----------------------------------------------------------------------------

function MultilineField({
  value,
  placeholder,
  maxLength,
  onChange,
  onCommit,
  disabled,
  ariaLabel,
}: {
  value: string;
  placeholder?: string;
  maxLength?: number;
  onChange: (value: string) => void;
  onCommit: (value: string) => void;
  disabled?: boolean;
  ariaLabel?: string;
}) {
  const id = useId();
  return (
    <textarea
      id={id}
      rows={3}
      maxLength={maxLength}
      placeholder={placeholder}
      value={value}
      disabled={disabled}
      aria-label={ariaLabel}
      onChange={(e) => onChange(e.target.value)}
      onBlur={(e) => onCommit(e.target.value.trim())}
      style={{
        width: "100%",
        boxSizing: "border-box",
        fontFamily: FONT_SANS,
        fontSize: 15,
        lineHeight: 1.55,
        color: C.ink,
        background: C.cream,
        border: `1px solid ${C.line}`,
        borderRadius: 12,
        padding: "12px 14px",
        outline: "none",
        resize: "vertical",
        minHeight: 88,
        opacity: disabled ? 0.7 : 1,
      }}
    />
  );
}

// -----------------------------------------------------------------------------
// MusicGrid — picker over MUSIC_TRACKS + an explicit "No music" pill.
// -----------------------------------------------------------------------------

function MusicGrid({
  tracks,
  selectedId,
  onPick,
  skipLabel,
  disabled,
}: {
  tracks: ReadonlyArray<MusicTrack>;
  selectedId: string | null;
  onPick: (id: string | null) => void;
  skipLabel: string;
  disabled?: boolean;
}) {
  // We filter out the spec's literal "silence" entry from the track grid
  // because we surface it as a quiet skip pill below the grid — clearer UX.
  const grid = tracks.filter((t) => t.id !== "silence");
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div
        role="radiogroup"
        aria-label="Music tracks"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: 10,
        }}
      >
        {grid.map((t) => {
          const isSel = selectedId === t.id;
          return (
            <motion.button
              key={t.id}
              type="button"
              role="radio"
              aria-checked={isSel}
              onClick={() => !disabled && onPick(t.id)}
              whileHover={!disabled ? { scale: 1.015 } : {}}
              whileTap={!disabled ? { scale: 0.985 } : {}}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
              disabled={disabled}
              style={trackButtonStyle(isSel, disabled)}
            >
              <span
                style={{
                  fontFamily: FONT_SANS,
                  fontSize: 14,
                  fontWeight: 600,
                  color: C.ink,
                }}
              >
                {t.label}
              </span>
              <span
                style={{
                  fontFamily: FONT_SANS,
                  fontSize: 12,
                  color: C.inkSofter,
                  lineHeight: 1.45,
                }}
              >
                {t.secondary}
              </span>
            </motion.button>
          );
        })}
      </div>
      <button
        type="button"
        onClick={() => !disabled && onPick(null)}
        disabled={disabled}
        style={{
          alignSelf: "flex-start",
          background: "transparent",
          border: "none",
          color: selectedId === null ? C.ink : C.inkSofter,
          fontFamily: FONT_SANS,
          fontSize: 13,
          fontWeight: selectedId === null ? 600 : 400,
          cursor: disabled ? "not-allowed" : "pointer",
          padding: "8px 0",
          textDecoration: "underline",
          textUnderlineOffset: 3,
        }}
      >
        {skipLabel}
      </button>
    </div>
  );
}

function trackButtonStyle(isSel: boolean, disabled?: boolean): CSSProperties {
  return {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    gap: 4,
    padding: "14px 16px",
    borderRadius: 14,
    background: isSel ? "rgba(201, 169, 97, 0.12)" : C.cream,
    border: `1px solid ${isSel ? C.gold : C.line}`,
    boxShadow: isSel ? `0 0 0 2px rgba(201, 169, 97, 0.22) inset` : "none",
    cursor: disabled ? "not-allowed" : "pointer",
    textAlign: "left",
    opacity: disabled ? 0.6 : 1,
    width: "100%",
  };
}

// -----------------------------------------------------------------------------
// NarrationBlock — voice picker + narration text. Off by default; tapping a
// voice opens the textarea.
// -----------------------------------------------------------------------------

function NarrationBlock({
  voices,
  selectedVoiceId,
  narrationText,
  open,
  onPickVoice,
  onChangeText,
  onCommitText,
  skipLabel,
  voiceQuestion,
  textLabel,
  textPlaceholder,
  disabled,
}: {
  voices: ReadonlyArray<NarrationVoice>;
  selectedVoiceId: string | null;
  narrationText: string;
  open: boolean;
  onPickVoice: (id: string | null) => void;
  onChangeText: (value: string) => void;
  onCommitText: (value: string) => void;
  skipLabel: string;
  voiceQuestion: string;
  textLabel: string;
  textPlaceholder: string;
  disabled?: boolean;
}) {
  const textId = useId();
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <p
        style={{
          margin: 0,
          fontFamily: FONT_SANS,
          fontSize: 13,
          fontWeight: 500,
          color: C.inkSofter,
        }}
      >
        {voiceQuestion}
      </p>
      <div
        role="radiogroup"
        aria-label="Narration voices"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 10,
        }}
      >
        {voices.map((v) => {
          const isSel = selectedVoiceId === v.id;
          return (
            <motion.button
              key={v.id}
              type="button"
              role="radio"
              aria-checked={isSel}
              onClick={() => !disabled && onPickVoice(v.id)}
              whileHover={!disabled ? { scale: 1.015 } : {}}
              whileTap={!disabled ? { scale: 0.985 } : {}}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
              disabled={disabled}
              style={trackButtonStyle(isSel, disabled)}
            >
              <span
                style={{
                  fontFamily: FONT_SANS,
                  fontSize: 14,
                  fontWeight: 600,
                  color: C.ink,
                }}
              >
                {v.label}
              </span>
              <span
                style={{
                  fontFamily: FONT_SANS,
                  fontSize: 12,
                  color: C.inkSofter,
                  lineHeight: 1.45,
                }}
              >
                {v.secondary}
              </span>
            </motion.button>
          );
        })}
      </div>
      <button
        type="button"
        onClick={() => !disabled && onPickVoice(null)}
        disabled={disabled}
        style={{
          alignSelf: "flex-start",
          background: "transparent",
          border: "none",
          color: selectedVoiceId === null ? C.ink : C.inkSofter,
          fontFamily: FONT_SANS,
          fontSize: 13,
          fontWeight: selectedVoiceId === null ? 600 : 400,
          cursor: disabled ? "not-allowed" : "pointer",
          padding: "4px 0 0 0",
          textDecoration: "underline",
          textUnderlineOffset: 3,
        }}
      >
        {skipLabel}
      </button>

      {open ? (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
            marginTop: 4,
          }}
        >
          <label
            htmlFor={textId}
            style={{
              fontFamily: FONT_SANS,
              fontSize: 13,
              fontWeight: 500,
              color: C.inkSofter,
            }}
          >
            {textLabel}
          </label>
          <textarea
            id={textId}
            rows={4}
            maxLength={600}
            placeholder={textPlaceholder}
            value={narrationText}
            disabled={disabled}
            onChange={(e) => onChangeText(e.target.value)}
            onBlur={(e) => onCommitText(e.target.value.trim())}
            style={{
              width: "100%",
              boxSizing: "border-box",
              fontFamily: FONT_SANS,
              fontSize: 14,
              lineHeight: 1.55,
              color: C.ink,
              background: C.cream,
              border: `1px solid ${C.line}`,
              borderRadius: 12,
              padding: "12px 14px",
              outline: "none",
              resize: "vertical",
              minHeight: 110,
            }}
          />
        </div>
      ) : null}
    </div>
  );
}
