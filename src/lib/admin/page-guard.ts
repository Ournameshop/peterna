import "server-only";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { readUserIdFromCookie } from "@/lib/auth/user-cookie";
import type { AuthMeResponse, UserWire } from "@/lib/builder/wire-types";

// Phase 14 — server-side admin gate for the `/admin/*` pages.
//
// The API routes under `/api/admin/*` enforce their own auth (backend owns
// `src/lib/admin/auth.ts`); this helper is the **page-side** mirror, so an
// unauthorized visitor gets bounced to `/signin?next=…` before any data
// fetch fires. It's intentionally separated from the API auth module so the
// two can evolve independently (page wants `redirect()`; API wants a 403).
//
// Two-pronged check, same shape as `src/app/dashboard/page.tsx`:
//   1. Cheap cookie HMAC check (`readUserIdFromCookie`) — bounces with no
//      network call if the cookie is missing / tampered / expired.
//   2. Canonical `/api/auth/me` fetch to resolve the live user row + email.
// Then we match the resolved email against `ADMIN_EMAILS` (comma-separated).

function parseAdminEmails(): Set<string> {
  const raw = process.env.ADMIN_EMAILS ?? "";
  const set = new Set<string>();
  for (const part of raw.split(",")) {
    const trimmed = part.trim().toLowerCase();
    if (trimmed) set.add(trimmed);
  }
  return set;
}

async function fetchCurrentUser(): Promise<UserWire | null> {
  // Next 16 RSC fetches don't resolve relative paths — same pattern as
  // `src/app/dashboard/page.tsx`.
  const hdrs = await headers();
  const host = hdrs.get("host") ?? "localhost:3000";
  const protocol = hdrs.get("x-forwarded-proto") ?? "http";
  const base = `${protocol}://${host}`;
  const cookieHeader = hdrs.get("cookie") ?? "";

  try {
    const res = await fetch(`${base}/api/auth/me`, {
      method: "GET",
      headers: cookieHeader ? { cookie: cookieHeader } : undefined,
      cache: "no-store",
    });
    if (!res.ok) return null;
    const json = (await res.json().catch(() => null)) as AuthMeResponse | null;
    if (!json || json.ok !== true) return null;
    return json.user ?? null;
  } catch {
    return null;
  }
}

/**
 * Verify the current visitor is an admin. Redirects to
 * `/signin?next=<currentPath>` on miss (no cookie, no live row, or email not
 * in `ADMIN_EMAILS`). Returns the resolved `UserWire` on hit.
 *
 * Callers pass the page's path so the post-signin redirect lands the admin
 * back where they started — e.g. `await requireAdminOrRedirect("/admin")`.
 */
export async function requireAdminOrRedirect(
  nextPath: string,
): Promise<UserWire> {
  const userId = await readUserIdFromCookie();
  if (!userId) {
    redirect(`/signin?next=${encodeURIComponent(nextPath)}`);
  }

  const user = await fetchCurrentUser();
  if (!user) {
    redirect(`/signin?next=${encodeURIComponent(nextPath)}`);
  }

  const admins = parseAdminEmails();
  if (!admins.has(user.email.toLowerCase())) {
    // Not an admin — same redirect as not-signed-in. We deliberately don't
    // surface a "forbidden" page; that would advertise the existence of an
    // admin section to civilians.
    redirect(`/signin?next=${encodeURIComponent(nextPath)}`);
  }

  return user;
}

/**
 * Server-side helper used by admin pages to perform their data fetch.
 * Mirrors `fetchCurrentUser` — builds an absolute URL from the current
 * request's host/protocol and forwards the cookie header.
 */
export async function adminFetch<T>(path: string): Promise<T | null> {
  const hdrs = await headers();
  const host = hdrs.get("host") ?? "localhost:3000";
  const protocol = hdrs.get("x-forwarded-proto") ?? "http";
  const cookieHeader = hdrs.get("cookie") ?? "";

  try {
    const res = await fetch(`${protocol}://${host}${path}`, {
      method: "GET",
      headers: cookieHeader ? { cookie: cookieHeader } : undefined,
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json().catch(() => null)) as T | null;
  } catch {
    return null;
  }
}
