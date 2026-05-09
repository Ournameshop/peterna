"use client";

import { useState, type FormEvent } from "react";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function SignupForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "error" | "success">("idle");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const value = email.trim();
    if (!EMAIL_RE.test(value)) {
      setStatus("error");
      setError("Please enter a valid email address.");
      return;
    }
    setError(null);
    setStatus("success");
  }

  if (status === "success") {
    return (
      <div
        role="status"
        aria-live="polite"
        className="mt-10 w-full max-w-md rounded-lg border border-[color:var(--color-sage)]/25 bg-[color:var(--color-sage)]/[0.06] px-6 py-5 text-center"
      >
        <p className="font-display text-lg italic text-[color:var(--color-sage-deep)]">
          Thank you.
        </p>
        <p className="mt-1 text-sm text-[color:var(--color-charcoal-soft)]">
          We&rsquo;ll be in touch when peterna opens its doors.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="mt-10 w-full max-w-md"
      aria-describedby={error ? "email-error" : "email-hint"}
    >
      <div className="flex flex-col gap-3 sm:flex-row">
        <label htmlFor="email" className="sr-only">
          Email address
        </label>
        <input
          id="email"
          type="email"
          name="email"
          autoComplete="email"
          required
          inputMode="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (status === "error") {
              setStatus("idle");
              setError(null);
            }
          }}
          placeholder="your email"
          aria-invalid={status === "error"}
          className="min-w-0 flex-1 rounded-md border border-[color:var(--color-charcoal)]/15 bg-white/60 px-4 py-3 text-sm text-[color:var(--color-charcoal)] placeholder:text-[color:var(--color-charcoal-faint)] transition focus:border-[color:var(--color-sage)] focus:outline-none focus:ring-2 focus:ring-[color:var(--color-sage)]/25"
        />
        <button
          type="submit"
          className="inline-flex items-center justify-center rounded-md bg-[color:var(--color-sage)] px-6 py-3 text-sm font-medium tracking-wide text-white transition hover:bg-[color:var(--color-sage-deep)] focus:outline-none focus:ring-2 focus:ring-[color:var(--color-sage)]/40 focus:ring-offset-2 focus:ring-offset-[color:var(--color-cream)]"
        >
          Tell me when it&rsquo;s ready
        </button>
      </div>
      {error ? (
        <p
          id="email-error"
          role="alert"
          className="mt-3 text-xs text-[color:var(--color-sage-deep)]"
        >
          {error}
        </p>
      ) : (
        <p
          id="email-hint"
          className="mt-3 text-xs text-[color:var(--color-charcoal-faint)]"
        >
          A single quiet note when we open. Nothing more.
        </p>
      )}
    </form>
  );
}
