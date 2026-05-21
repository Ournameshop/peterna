import { redirect } from "next/navigation";
import { headers } from "next/headers";
import type { Metadata } from "next";
import DashboardClient from "@/components/dashboard/DashboardClient";
import { readUserIdFromCookie } from "@/lib/auth/user-cookie";
import type { AuthMeResponse, UserWire } from "@/lib/builder/wire-types";

// Phase 11 — Memorial Management dashboard.
//
// Server Component. The auth gate is two-pronged:
//   1. Cheap HMAC-verified cookie check via `readUserIdFromCookie` — if the
//      cookie isn't present (or is tampered / expired) we bounce to /signin
//      without a network call.
//   2. Canonical `/api/auth/me` fetch — the cookie says "we trust this id"
//      but `users` rows can be deleted server-side; we still resolve to the
//      live row so the client gets the canonical email + name.
//
// Tribute list rendering lives in <DashboardClient/>. This page does not
// fetch the tribute list itself — the list is user-mutable (rename / delete)
// and a client component owns that state. We also can't claim mid-build
// anonymous sessions from the server (the claim POST sets cookies on the
// response), so the client kicks off both calls on mount.

export const metadata: Metadata = {
  title: "Your tributes — Peterna",
  description:
    "Every tribute you've made with Peterna, gathered in one place.",
};

async function fetchCurrentUser(): Promise<UserWire | null> {
  // Next 16 RSC fetches don't resolve relative paths — same pattern as
  // src/app/builder/r/[token]/page.tsx + the previous dashboard placeholder.
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

export default async function PageDashboard() {
  // Cheap gate — no cookie, no auth. Avoids a wasted /api/auth/me round-trip
  // for the common unauthenticated visitor case (e.g. stale bookmark).
  const userId = await readUserIdFromCookie();
  if (!userId) {
    redirect("/signin");
  }

  // Canonical verification — `users` row may have been deleted, or the HMAC
  // helper may be using a rotated secret. Either way, fall back to signin.
  const user = await fetchCurrentUser();
  if (!user) {
    redirect("/signin");
  }

  return <DashboardClient user={user} />;
}
