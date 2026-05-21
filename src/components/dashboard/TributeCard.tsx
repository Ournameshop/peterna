"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from "react";
import Link from "next/link";
import { Check, Copy, MoreHorizontal, Pencil } from "lucide-react";
import type { StageTag } from "@/lib/builder/state";
import type {
  TributeListItem,
  TributeRenameRequest,
  TributeRenameResponse,
} from "@/lib/builder/wire-types";
import { C, FONT_DISPLAY, FONT_SANS } from "@/lib/peterna-tokens";

type Props = {
  tribute: TributeListItem;
  onRenamed: (updated: TributeListItem) => void;
  onDeleted: (sessionId: string) => void;
};

// Stage groupings for the badge + the "Open" vs "View tribute" CTA. Anything
// past `delivery_ready` is "Ready to share"; everything else is still in
// progress. We rely on `is_complete` from the API (delivery_ready_at non-null)
// as the canonical truth — the stage tag is a hint, the timestamp is the gate.
const COMPLETE_STAGES: ReadonlySet<StageTag> = new Set<StageTag>([
  "delivery_ready",
  "delivery_emailed",
]);

function stageLabel(stage: StageTag, isComplete: boolean): string {
  if (isComplete || COMPLETE_STAGES.has(stage)) return "Ready to share";
  return "In progress";
}

function formatUpdatedAt(iso: string): string {
  // Lightweight relative formatter — no extra dependency. "Updated 3 days ago"
  // / "Updated today" / fall back to a date string for older items.
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "";
  const diffMs = Date.now() - then;
  const day = 86_400_000;
  if (diffMs < day) return "Updated today";
  if (diffMs < 2 * day) return "Updated yesterday";
  if (diffMs < 30 * day) {
    const days = Math.floor(diffMs / day);
    return `Updated ${days} days ago`;
  }
  return `Updated ${new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  })}`;
}

export default function TributeCard({ tribute, onRenamed, onDeleted }: Props) {
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(tribute.pet_name ?? "");
  const [renameSaving, setRenameSaving] = useState(false);
  const [renameError, setRenameError] = useState<string | null>(null);

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [copied, setCopied] = useState(false);

  const isComplete = tribute.is_complete;
  const label = stageLabel(tribute.stage, isComplete);
  const displayName = tribute.pet_name?.trim() || "Untitled tribute";

  // Open the rename input — also closes the menu if it's open.
  const startRename = useCallback(() => {
    setMenuOpen(false);
    setRenameError(null);
    setRenameValue(tribute.pet_name ?? "");
    setRenaming(true);
  }, [tribute.pet_name]);

  const cancelRename = useCallback(() => {
    setRenaming(false);
    setRenameError(null);
    setRenameValue(tribute.pet_name ?? "");
  }, [tribute.pet_name]);

  const saveRename = useCallback(async () => {
    const next = renameValue.trim();
    // No-op on empty or unchanged — fail closed on blank, treat unchanged
    // as cancel.
    if (next.length === 0) {
      setRenameError("A name is required.");
      return;
    }
    if (next === (tribute.pet_name ?? "")) {
      setRenaming(false);
      return;
    }
    setRenameSaving(true);
    setRenameError(null);
    try {
      const body: TributeRenameRequest = { pet_name: next };
      const res = await fetch(
        `/api/dashboard/tributes/${tribute.session_id}/rename`,
        {
          method: "POST",
          credentials: "same-origin",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      const json = (await res.json().catch(() => null)) as
        | TributeRenameResponse
        | null;
      if (!res.ok || !json || json.ok !== true) {
        setRenameError(
          "We couldn't save that just yet. Try again in a moment.",
        );
        setRenameSaving(false);
        return;
      }
      onRenamed(json.tribute);
      setRenameSaving(false);
      setRenaming(false);
    } catch {
      setRenameError("We couldn't save that just yet. Try again in a moment.");
      setRenameSaving(false);
    }
  }, [renameValue, tribute.pet_name, tribute.session_id, onRenamed]);

  const onRenameKey = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        void saveRename();
      } else if (e.key === "Escape") {
        e.preventDefault();
        cancelRename();
      }
    },
    [cancelRename, saveRename],
  );

  // Close the menu on outside click + escape.
  useEffect(() => {
    if (!menuOpen) return;
    function onDocClick(e: MouseEvent) {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    function onKey(e: globalThis.KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  const startDelete = useCallback(() => {
    setMenuOpen(false);
    setDeleteError(null);
    setConfirmingDelete(true);
  }, []);

  const cancelDelete = useCallback(() => {
    setConfirmingDelete(false);
    setDeleteError(null);
  }, []);

  const confirmDelete = useCallback(async () => {
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/session/${tribute.session_id}`, {
        method: "DELETE",
        credentials: "same-origin",
      });
      if (!res.ok) {
        setDeleteError(
          "We couldn't delete that. Try again in a moment.",
        );
        setDeleting(false);
        return;
      }
      onDeleted(tribute.session_id);
    } catch {
      setDeleteError("We couldn't delete that. Try again in a moment.");
      setDeleting(false);
    }
  }, [tribute.session_id, onDeleted]);

  const copyShareLink = useCallback(async () => {
    if (!tribute.share_url) return;
    try {
      await navigator.clipboard.writeText(tribute.share_url);
      setCopied(true);
      // 2s reset — long enough to register, short enough to not stick.
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: select-able input would be over-engineering for this.
      // Silent failure; user can right-click the link.
    }
  }, [tribute.share_url]);

  // Open-builder URL when in progress; public tribute URL when complete.
  const primaryHref = isComplete && tribute.share_slug
    ? `/tribute/${tribute.share_slug}`
    : `/builder?session=${encodeURIComponent(tribute.session_id)}&step=${encodeURIComponent(tribute.stage)}`;
  const primaryLabel = isComplete ? "View tribute" : "Open";

  return (
    <article
      style={{
        position: "relative",
        background: C.cream,
        border: `1px solid ${C.line}`,
        borderRadius: 16,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        boxShadow: "0 1px 0 rgba(42,33,27,0.02)",
      }}
    >
      <Thumbnail
        url={tribute.character_sheet_url}
        alt={`Character sheet for ${displayName}`}
      />

      <div
        style={{
          padding: "20px 22px 22px",
          display: "flex",
          flexDirection: "column",
          gap: 12,
          flex: 1,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <div style={{ minWidth: 0, flex: 1 }}>
            {renaming ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <input
                  autoFocus
                  type="text"
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onBlur={() => void saveRename()}
                  onKeyDown={onRenameKey}
                  disabled={renameSaving}
                  aria-label="Pet name"
                  maxLength={80}
                  style={{
                    fontFamily: FONT_DISPLAY,
                    fontSize: 22,
                    fontWeight: 400,
                    color: C.ink,
                    background: "transparent",
                    border: "none",
                    borderBottom: `1px solid ${C.goldDeep}`,
                    padding: "2px 0",
                    width: "100%",
                    outline: "none",
                  }}
                />
                {renameError ? (
                  <span
                    role="alert"
                    style={{
                      fontFamily: FONT_SANS,
                      fontSize: 12,
                      color: "#8B3A2F",
                    }}
                  >
                    {renameError}
                  </span>
                ) : (
                  <span
                    style={{
                      fontFamily: FONT_SANS,
                      fontSize: 12,
                      color: C.inkSofter,
                    }}
                  >
                    Enter to save · Esc to cancel
                  </span>
                )}
              </div>
            ) : (
              <button
                type="button"
                onClick={startRename}
                aria-label={`Rename ${displayName}`}
                style={{
                  appearance: "none",
                  background: "none",
                  border: "none",
                  padding: 0,
                  margin: 0,
                  cursor: "text",
                  textAlign: "left",
                  fontFamily: FONT_DISPLAY,
                  fontSize: 22,
                  lineHeight: 1.15,
                  fontWeight: 400,
                  color: C.ink,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  maxWidth: "100%",
                }}
              >
                <span
                  style={{
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    maxWidth: "100%",
                  }}
                >
                  {displayName}
                </span>
                <Pencil
                  size={13}
                  aria-hidden="true"
                  style={{ color: C.inkSofter, flexShrink: 0 }}
                />
              </button>
            )}
            <div
              style={{
                marginTop: 6,
                fontFamily: FONT_SANS,
                fontSize: 12,
                letterSpacing: "0.04em",
                color: C.inkSofter,
              }}
            >
              {formatUpdatedAt(tribute.updated_at)}
            </div>
          </div>

          <div ref={menuRef} style={{ position: "relative", flexShrink: 0 }}>
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              aria-label="Tribute options"
              style={{
                appearance: "none",
                background: "none",
                border: `1px solid transparent`,
                borderRadius: 999,
                width: 32,
                height: 32,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                color: C.inkSoft,
              }}
            >
              <MoreHorizontal size={16} />
            </button>
            {menuOpen && (
              <div
                role="menu"
                style={{
                  position: "absolute",
                  top: "calc(100% + 6px)",
                  right: 0,
                  minWidth: 160,
                  background: C.cream,
                  border: `1px solid ${C.line}`,
                  borderRadius: 12,
                  boxShadow: "0 12px 32px -8px rgba(42,33,27,0.18)",
                  padding: 6,
                  zIndex: 5,
                }}
              >
                <button
                  type="button"
                  role="menuitem"
                  onClick={startRename}
                  style={menuItemStyle()}
                >
                  Rename
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={startDelete}
                  style={menuItemStyle({ tone: "warn" })}
                >
                  Delete
                </button>
              </div>
            )}
          </div>
        </div>

        <StageBadge label={label} />

        {/* Share link row — only when a slug exists. */}
        {tribute.share_url && tribute.share_slug ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 12px",
              borderRadius: 999,
              border: `1px solid ${C.line}`,
              background: "rgba(248,241,228,0.6)",
              fontFamily: FONT_SANS,
              fontSize: 12,
              color: C.inkSoft,
              minWidth: 0,
            }}
          >
            <span
              style={{
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                flex: 1,
                minWidth: 0,
              }}
              title={tribute.share_url}
            >
              {tribute.share_url.replace(/^https?:\/\//, "")}
            </span>
            <button
              type="button"
              onClick={copyShareLink}
              aria-label={copied ? "Link copied" : "Copy share link"}
              style={{
                appearance: "none",
                background: "none",
                border: "none",
                cursor: "pointer",
                color: copied ? C.goldDeep : C.inkSoft,
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                fontFamily: FONT_SANS,
                fontSize: 12,
                fontWeight: 500,
                padding: "2px 4px",
                flexShrink: 0,
              }}
            >
              {copied ? <Check size={13} /> : <Copy size={13} />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        ) : null}

        <div
          style={{
            marginTop: "auto",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            paddingTop: 8,
          }}
        >
          <Link
            href={primaryHref}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontFamily: FONT_SANS,
              fontSize: 14,
              fontWeight: 500,
              color: C.ink,
              textDecoration: "none",
              borderBottom: `1px solid ${C.ink}`,
              paddingBottom: 2,
            }}
          >
            {primaryLabel} →
          </Link>
        </div>

        {confirmingDelete ? (
          <DeleteConfirm
            deleting={deleting}
            error={deleteError}
            onCancel={cancelDelete}
            onConfirm={confirmDelete}
          />
        ) : null}
      </div>
    </article>
  );
}

function Thumbnail({ url, alt }: { url: string | null; alt: string }) {
  if (url) {
    // Plain <img> rather than next/image — the public_url is a remote R2 URL
    // that hasn't been added to next.config images.remotePatterns; using
    // next/image here would require a config touch the brief doesn't permit.
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt={alt}
        style={{
          display: "block",
          width: "100%",
          aspectRatio: "4 / 3",
          objectFit: "cover",
          background: C.blush,
        }}
      />
    );
  }
  return (
    <div
      role="img"
      aria-label="Tribute thumbnail not yet rendered"
      style={{
        width: "100%",
        aspectRatio: "4 / 3",
        background:
          "linear-gradient(135deg, rgba(233,213,195,0.55), rgba(201,169,97,0.18))",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <span
        style={{
          fontFamily: FONT_DISPLAY,
          fontStyle: "italic",
          fontSize: 16,
          color: C.inkSoft,
          opacity: 0.7,
        }}
      >
        — In progress —
      </span>
    </div>
  );
}

function StageBadge({ label }: { label: string }) {
  const isReady = label === "Ready to share";
  return (
    <span
      style={{
        alignSelf: "flex-start",
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "4px 12px",
        borderRadius: 999,
        fontSize: 11,
        letterSpacing: "0.16em",
        textTransform: "uppercase",
        fontFamily: FONT_SANS,
        background: isReady
          ? "rgba(143,166,142,0.14)"
          : "rgba(201,169,97,0.12)",
        color: isReady ? "#6E8268" : C.goldDeep,
        border: `1px solid ${isReady ? "rgba(143,166,142,0.3)" : "rgba(201,169,97,0.3)"}`,
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: 6,
          height: 6,
          borderRadius: 999,
          background: isReady ? "#8FA68E" : C.gold,
        }}
      />
      {label}
    </span>
  );
}

function DeleteConfirm({
  deleting,
  error,
  onCancel,
  onConfirm,
}: {
  deleting: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div
      role="alertdialog"
      aria-label="Confirm delete tribute"
      style={{
        marginTop: 4,
        padding: "14px 16px",
        borderRadius: 12,
        background: "rgba(139,58,47,0.06)",
        border: "1px solid rgba(139,58,47,0.25)",
      }}
    >
      <p
        style={{
          margin: 0,
          fontFamily: FONT_SANS,
          fontSize: 13,
          lineHeight: 1.55,
          color: C.inkSoft,
        }}
      >
        Delete forever? This can&apos;t be undone.
      </p>
      {error ? (
        <p
          role="alert"
          style={{
            margin: "8px 0 0",
            fontFamily: FONT_SANS,
            fontSize: 12,
            color: "#8B3A2F",
          }}
        >
          {error}
        </p>
      ) : null}
      <div
        style={{
          display: "flex",
          gap: 8,
          marginTop: 12,
          justifyContent: "flex-end",
        }}
      >
        <button
          type="button"
          onClick={onCancel}
          disabled={deleting}
          style={{
            appearance: "none",
            background: "none",
            border: "none",
            cursor: "pointer",
            fontFamily: FONT_SANS,
            fontSize: 13,
            color: C.inkSoft,
            padding: "6px 10px",
          }}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={deleting}
          style={{
            appearance: "none",
            background: "#8B3A2F",
            color: C.cream,
            border: "none",
            borderRadius: 999,
            padding: "6px 14px",
            fontFamily: FONT_SANS,
            fontSize: 13,
            fontWeight: 500,
            cursor: deleting ? "wait" : "pointer",
            opacity: deleting ? 0.7 : 1,
          }}
        >
          {deleting ? "Deleting…" : "Delete"}
        </button>
      </div>
    </div>
  );
}

function menuItemStyle(opts: { tone?: "warn" } = {}): CSSProperties {
  return {
    display: "block",
    width: "100%",
    textAlign: "left",
    padding: "10px 12px",
    borderRadius: 8,
    background: "none",
    border: "none",
    cursor: "pointer",
    fontFamily: FONT_SANS,
    fontSize: 14,
    color: opts.tone === "warn" ? "#8B3A2F" : C.ink,
  };
}
