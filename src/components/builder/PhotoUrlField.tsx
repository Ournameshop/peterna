"use client";

import {
  useCallback,
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type FormEvent,
} from "react";
import { motion } from "framer-motion";
import { Upload, X } from "lucide-react";
import { C, FONT_SANS } from "@/lib/peterna-tokens";
import { PHOTO_PROMPT, substitutePetName } from "@/lib/library/copy";
import type { PhotoAsset } from "@/lib/builder/state";
import type { IngestUrlResponse, UploadResponse } from "@/lib/builder/wire-types";

// Pattern A — Photo + URL combo. File dropzone + URL textarea coexist.
//
// On submit:
//   - files → multipart POST /api/upload (one request per file)
//   - URLs → POST /api/ingest-url with the parsed list
//
// Both calls return { ok: true, asset_id, public_url } shapes that we
// hand back to the parent as a unified PhotoAsset[].

type Props = {
  sessionId: string;
  petName: string | null;
  variant?: "first" | "followup";
  onComplete: (photos: PhotoAsset[]) => void;
  onSkip: () => void;
};

type UploadStatus = {
  // local preview / progress state for both files and URLs
  id: string;
  label: string;
  state: "queued" | "uploading" | "ok" | "error";
  publicUrl?: string;
  // Bug-8: track the server-side asset_id so a double-tap on Remove drops the
  // right uploadedAssets entry instead of orphaning it. Pre-fix the code keyed
  // removal off publicUrl, which mismatches when statuses are out of date.
  assetId?: string;
  error?: string;
};

const MAX_FILES = 10;
const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB

function parseUrls(input: string): string[] {
  return input
    .split(/[\s,;\n]+/)
    .map((u) => u.trim())
    .filter((u) => u.length > 0);
}

function genId() {
  // small unique id for local list keys; not persisted
  return Math.random().toString(36).slice(2, 10);
}

export default function PhotoUrlField({
  sessionId,
  petName,
  variant = "first",
  onComplete,
  onSkip,
}: Props) {
  const inputId = useId();
  const urlId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [dragOver, setDragOver] = useState(false);
  const [statuses, setStatuses] = useState<UploadStatus[]>([]);
  const [urlInput, setUrlInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const header =
    variant === "first" ? PHOTO_PROMPT.header_first : PHOTO_PROMPT.header_followup;
  const question = substitutePetName(
    variant === "first"
      ? petName
        ? PHOTO_PROMPT.question_first
        : PHOTO_PROMPT.question_first_no_name
      : PHOTO_PROMPT.question_followup,
    petName,
  );

  const addFiles = useCallback(
    (files: FileList | File[]) => {
      const list = Array.from(files);
      const accepted: { id: string; file: File }[] = [];
      const rejected: UploadStatus[] = [];

      for (const f of list) {
        if (!f.type.startsWith("image/")) {
          rejected.push({
            id: genId(),
            label: f.name,
            state: "error",
            error: "Not an image",
          });
          continue;
        }
        if (f.size > MAX_FILE_BYTES) {
          rejected.push({
            id: genId(),
            label: f.name,
            state: "error",
            error: "Over 10 MB",
          });
          continue;
        }
        accepted.push({ id: genId(), file: f });
      }

      setStatuses((prev) => {
        const merged = [
          ...prev,
          ...rejected,
          ...accepted.map((a) => ({
            id: a.id,
            label: a.file.name,
            state: "queued" as const,
          })),
        ];
        if (merged.length > MAX_FILES) {
          setError(`Up to ${MAX_FILES} photos at a time.`);
          return merged.slice(0, MAX_FILES);
        }
        setError(null);
        return merged;
      });

      // kick uploads in background
      accepted.forEach((a) => uploadOne(a.id, a.file));
    },
    // uploadOne is closed over below; safe to omit from deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sessionId],
  );

  async function uploadOne(localId: string, file: File) {
    setStatuses((prev) =>
      prev.map((s) => (s.id === localId ? { ...s, state: "uploading" } : s)),
    );
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("session_id", sessionId);
      const res = await fetch("/api/upload", {
        method: "POST",
        body: form,
      });
      const json = (await res.json().catch(() => null)) as UploadResponse | null;

      if (res.ok && json && json.ok === true) {
        const assetId = json.asset_id;
        const publicUrl = json.public_url;
        setStatuses((prev) =>
          prev.map((s) =>
            s.id === localId
              ? {
                  ...s,
                  state: "ok",
                  publicUrl,
                  assetId,
                }
              : s,
          ),
        );
        setUploadedAssets((prev) => [
          ...prev,
          { asset_id: assetId, public_url: publicUrl },
        ]);
      } else {
        const msg =
          (json && "error" in json && typeof json.error === "string"
            ? json.error
            : null) ?? "Upload failed";
        setStatuses((prev) =>
          prev.map((s) =>
            s.id === localId ? { ...s, state: "error", error: msg } : s,
          ),
        );
      }
    } catch (err) {
      setStatuses((prev) =>
        prev.map((s) =>
          s.id === localId
            ? {
                ...s,
                state: "error",
                error: err instanceof Error ? err.message : "Upload failed",
              }
            : s,
        ),
      );
    }
  }

  const [uploadedAssets, setUploadedAssets] = useState<PhotoAsset[]>([]);

  function onFileInput(e: ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files.length > 0) {
      addFiles(e.target.files);
    }
    // reset so re-picking the same file works
    e.target.value = "";
  }

  function onDrop(e: DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addFiles(e.dataTransfer.files);
    }
  }

  function removeStatus(id: string) {
    // Bug-8: read the target out of the latest state by routing both updates
    // through the setter callbacks. React batches setState; closing over
    // `statuses` here would race on double-clicks. We pluck the asset_id out
    // of the previous statuses inside the setter, then drop from
    // uploadedAssets keyed on asset_id (the stable server-side identity).
    let removedAssetId: string | undefined;
    setStatuses((prev) => {
      const target = prev.find((s) => s.id === id);
      removedAssetId = target?.assetId;
      return prev.filter((s) => s.id !== id);
    });
    setUploadedAssets((prev) =>
      removedAssetId
        ? prev.filter((a) => a.asset_id !== removedAssetId)
        : prev,
    );
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);

    const urls = parseUrls(urlInput);
    let urlAssets: PhotoAsset[] = [];

    if (urls.length > 0) {
      try {
        const res = await fetch("/api/ingest-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ session_id: sessionId, urls }),
        });
        const json = (await res.json().catch(() => null)) as IngestUrlResponse | null;

        if (res.ok && json && json.ok === true) {
          urlAssets = json.assets.map((a) => ({
            asset_id: a.asset_id,
            public_url: a.public_url,
          }));
          if (json.failed && json.failed.length > 0) {
            setError(
              `Couldn't read ${json.failed.length} link${
                json.failed.length === 1 ? "" : "s"
              }.`,
            );
          }
        } else {
          setError("Couldn't reach those links — paste a direct image URL.");
        }
      } catch {
        setError("Network problem — try again or skip for now.");
      }
    }

    const all = [...uploadedAssets, ...urlAssets];
    setSubmitting(false);

    if (all.length === 0) {
      // nothing succeeded
      setError(
        "Add at least one photo of your pet, or skip and we'll ask again later.",
      );
      return;
    }
    onComplete(all);
  }

  const dropzoneStyle = {
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    gap: 8,
    padding: "32px 20px",
    borderRadius: 16,
    border: `2px dashed ${dragOver ? C.gold : C.line}`,
    background: dragOver ? "rgba(201, 169, 97, 0.08)" : "#FFFBF3",
    cursor: "pointer",
    textAlign: "center" as const,
    color: C.inkSoft,
    transition: "border-color 120ms, background 120ms",
  };

  const hasAnything =
    uploadedAssets.length > 0 || parseUrls(urlInput).length > 0;

  return (
    <form
      onSubmit={handleSubmit}
      style={{ display: "flex", flexDirection: "column", gap: 18 }}
      aria-label={header}
    >
      <header style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <h2
          style={{
            fontFamily: FONT_SANS,
            fontSize: 20,
            fontWeight: 500,
            color: C.ink,
            margin: 0,
            lineHeight: 1.4,
          }}
        >
          {header}
        </h2>
        <p
          style={{
            fontFamily: FONT_SANS,
            fontSize: 14,
            color: C.inkSoft,
            margin: 0,
            lineHeight: 1.55,
          }}
        >
          {question}
        </p>
      </header>

      {/* Dropzone */}
      <label
        htmlFor={inputId}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        style={dropzoneStyle}
      >
        <Upload size={22} aria-hidden="true" />
        <span style={{ fontFamily: FONT_SANS, fontSize: 14, color: C.ink }}>
          Drag photos here, or tap to choose
        </span>
        <span style={{ fontFamily: FONT_SANS, fontSize: 12, color: C.inkSofter }}>
          JPG, PNG, HEIC — up to 10 MB each
        </span>
        <input
          ref={fileInputRef}
          id={inputId}
          type="file"
          accept="image/*"
          multiple
          onChange={onFileInput}
          style={{ display: "none" }}
        />
      </label>

      {/* Status / thumbnails */}
      {statuses.length > 0 ? (
        <ul
          aria-label="Uploaded photos"
          style={{
            listStyle: "none",
            padding: 0,
            margin: 0,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))",
            gap: 10,
          }}
        >
          {statuses.map((s) => (
            <li
              key={s.id}
              style={{
                position: "relative",
                aspectRatio: "1 / 1",
                borderRadius: 12,
                overflow: "hidden",
                background: C.blush,
                border: `1px solid ${C.line}`,
              }}
            >
              {s.publicUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={s.publicUrl}
                  alt={s.label}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    display: "block",
                  }}
                />
              ) : (
                <div
                  style={{
                    width: "100%",
                    height: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontFamily: FONT_SANS,
                    fontSize: 11,
                    color: C.inkSoft,
                    padding: 10,
                    textAlign: "center",
                  }}
                >
                  {s.state === "uploading"
                    ? "Uploading…"
                    : s.state === "queued"
                      ? "Queued"
                      : s.state === "error"
                        ? (s.error ?? "Failed")
                        : "Saved"}
                </div>
              )}
              <button
                type="button"
                onClick={() => removeStatus(s.id)}
                aria-label={`Remove ${s.label}`}
                style={{
                  position: "absolute",
                  top: 6,
                  right: 6,
                  background: "rgba(42, 33, 27, 0.7)",
                  color: C.cream,
                  border: "none",
                  borderRadius: 999,
                  width: 22,
                  height: 22,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                }}
              >
                <X size={12} />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {/* URL textarea */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <label
          htmlFor={urlId}
          style={{
            fontFamily: FONT_SANS,
            fontSize: 13,
            color: C.inkSoft,
          }}
        >
          {PHOTO_PROMPT.url_label}
        </label>
        <textarea
          id={urlId}
          rows={2}
          placeholder={PHOTO_PROMPT.url_placeholder}
          value={urlInput}
          onChange={(e) => setUrlInput(e.target.value)}
          style={{
            fontFamily: FONT_SANS,
            fontSize: 14,
            color: C.ink,
            background: "#FFFBF3",
            border: `1px solid ${C.line}`,
            borderRadius: 12,
            padding: "12px 14px",
            outline: "none",
            resize: "vertical",
            minHeight: 60,
          }}
        />
        <span style={{ fontFamily: FONT_SANS, fontSize: 11, color: C.inkSofter }}>
          One per line, or separated by commas.
        </span>
      </div>

      {error ? (
        <p
          role="alert"
          style={{
            margin: 0,
            fontFamily: FONT_SANS,
            fontSize: 13,
            color: "#8a4b2b",
            background: "rgba(201, 169, 97, 0.12)",
            border: `1px solid ${C.gold}`,
            borderRadius: 10,
            padding: "10px 12px",
          }}
        >
          {error}
        </p>
      ) : null}

      <div style={{ display: "flex", gap: 12, marginTop: 4, flexWrap: "wrap" }}>
        <motion.button
          type="submit"
          disabled={submitting || !hasAnything}
          whileHover={hasAnything && !submitting ? { scale: 1.02 } : {}}
          whileTap={hasAnything && !submitting ? { scale: 0.98 } : {}}
          transition={{ type: "spring", stiffness: 400, damping: 25 }}
          style={{
            display: "inline-flex",
            alignItems: "center",
            padding: "12px 24px",
            borderRadius: 999,
            fontFamily: FONT_SANS,
            fontSize: 14,
            fontWeight: 500,
            border: "none",
            cursor: hasAnything && !submitting ? "pointer" : "not-allowed",
            background: hasAnything ? C.ink : C.line,
            color: hasAnything ? C.cream : C.inkSofter,
          }}
        >
          {submitting
            ? "Saving…"
            : variant === "followup"
              ? PHOTO_PROMPT.continue_with_one
              : PHOTO_PROMPT.submit}
        </motion.button>

        {/* Spec §1.2: minimum acceptable is 1 photo (with soft warning at
            character-sheet time). The Skip pill is therefore only available
            on the "followup" variant — once the user already has at least
            one photo and is being prompted for additional angles. */}
        {variant === "followup" && (
          <button
            type="button"
            onClick={onSkip}
            style={{
              background: "transparent",
              border: "none",
              color: C.inkSofter,
              fontFamily: FONT_SANS,
              fontSize: 13,
              cursor: "pointer",
              padding: "12px 16px",
              textDecoration: "underline",
              textUnderlineOffset: 3,
            }}
          >
            {PHOTO_PROMPT.skip}
          </button>
        )}
      </div>
    </form>
  );
}
