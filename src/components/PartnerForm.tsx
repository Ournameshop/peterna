"use client";

import { useState, type FormEvent } from "react";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type PartnerType =
  | "veterinary"
  | "crematorium"
  | "memorial-product"
  | "shelter-rescue"
  | "other";

const PARTNER_TYPES: { id: PartnerType; label: string }[] = [
  { id: "veterinary", label: "Veterinary clinic" },
  { id: "crematorium", label: "Pet crematorium / aftercare" },
  { id: "memorial-product", label: "Memorial product or service" },
  { id: "shelter-rescue", label: "Shelter or rescue" },
  { id: "other", label: "Other" },
];

export default function PartnerForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [organization, setOrganization] = useState("");
  const [role, setRole] = useState("");
  const [partnerType, setPartnerType] = useState<PartnerType | "">("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "error" | "success" | "submitting">("idle");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!name.trim()) {
      setStatus("error");
      setError("Please share your name.");
      return;
    }
    if (!EMAIL_RE.test(email.trim())) {
      setStatus("error");
      setError("Please enter a valid email address.");
      return;
    }
    if (!organization.trim()) {
      setStatus("error");
      setError("Please tell us your organization.");
      return;
    }
    if (!partnerType) {
      setStatus("error");
      setError("Please select a partnership type.");
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
        className="mx-auto w-full max-w-xl rounded-lg border border-[color:var(--color-sage)]/25 bg-[color:var(--color-sage)]/[0.06] px-6 py-8 text-center"
      >
        <p className="font-display text-2xl italic text-[color:var(--color-sage-deep)]">
          Thank you.
        </p>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-[color:var(--color-charcoal-soft)]">
          We&rsquo;ve received your note and will reach out soon. We&rsquo;re grateful
          you&rsquo;d like to walk alongside us.
        </p>
      </div>
    );
  }

  const inputClass =
    "w-full rounded-md border border-[color:var(--color-charcoal)]/15 bg-white/60 px-4 py-3 text-sm text-[color:var(--color-charcoal)] placeholder:text-[color:var(--color-charcoal-faint)] transition focus:border-[color:var(--color-sage)] focus:outline-none focus:ring-2 focus:ring-[color:var(--color-sage)]/25";

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="mx-auto w-full max-w-xl"
      aria-describedby={error ? "partner-error" : "partner-hint"}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label
            htmlFor="partner-name"
            className="mb-1.5 block text-xs uppercase tracking-[0.18em] text-[color:var(--color-charcoal-faint)]"
          >
            Your name
          </label>
          <input
            id="partner-name"
            name="name"
            type="text"
            autoComplete="name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label
            htmlFor="partner-email"
            className="mb-1.5 block text-xs uppercase tracking-[0.18em] text-[color:var(--color-charcoal-faint)]"
          >
            Email
          </label>
          <input
            id="partner-email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label
            htmlFor="partner-org"
            className="mb-1.5 block text-xs uppercase tracking-[0.18em] text-[color:var(--color-charcoal-faint)]"
          >
            Organization
          </label>
          <input
            id="partner-org"
            name="organization"
            type="text"
            autoComplete="organization"
            required
            value={organization}
            onChange={(e) => setOrganization(e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label
            htmlFor="partner-role"
            className="mb-1.5 block text-xs uppercase tracking-[0.18em] text-[color:var(--color-charcoal-faint)]"
          >
            Your role
          </label>
          <input
            id="partner-role"
            name="role"
            type="text"
            autoComplete="organization-title"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            placeholder="optional"
            className={inputClass}
          />
        </div>
      </div>

      <fieldset className="mt-6">
        <legend className="mb-3 text-xs uppercase tracking-[0.18em] text-[color:var(--color-charcoal-faint)]">
          Partnership type
        </legend>
        <div className="flex flex-wrap gap-2">
          {PARTNER_TYPES.map((opt) => {
            const checked = partnerType === opt.id;
            return (
              <label
                key={opt.id}
                className={`cursor-pointer rounded-full border px-4 py-2 text-xs transition ${
                  checked
                    ? "border-[color:var(--color-sage)] bg-[color:var(--color-sage)]/10 text-[color:var(--color-sage-deep)]"
                    : "border-[color:var(--color-charcoal)]/15 bg-white/40 text-[color:var(--color-charcoal-soft)] hover:border-[color:var(--color-sage)]/40"
                }`}
              >
                <input
                  type="radio"
                  name="partnerType"
                  value={opt.id}
                  checked={checked}
                  onChange={() => setPartnerType(opt.id)}
                  className="sr-only"
                />
                {opt.label}
              </label>
            );
          })}
        </div>
      </fieldset>

      <div className="mt-6">
        <label
          htmlFor="partner-message"
          className="mb-1.5 block text-xs uppercase tracking-[0.18em] text-[color:var(--color-charcoal-faint)]"
        >
          A short note <span className="normal-case tracking-normal text-[color:var(--color-charcoal-faint)]/70">(optional)</span>
        </label>
        <textarea
          id="partner-message"
          name="message"
          rows={4}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Tell us a little about how you&rsquo;d like to walk alongside us."
          className={`${inputClass} resize-y`}
        />
      </div>

      <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-between">
        {error ? (
          <p
            id="partner-error"
            role="alert"
            className="text-xs text-[color:var(--color-sage-deep)]"
          >
            {error}
          </p>
        ) : (
          <p
            id="partner-hint"
            className="text-xs text-[color:var(--color-charcoal-faint)]"
          >
            We read every note personally.
          </p>
        )}
        <button
          type="submit"
          className="inline-flex items-center justify-center rounded-md bg-[color:var(--color-sage)] px-6 py-3 text-sm font-medium tracking-wide text-white transition hover:bg-[color:var(--color-sage-deep)] focus:outline-none focus:ring-2 focus:ring-[color:var(--color-sage)]/40 focus:ring-offset-2 focus:ring-offset-[color:var(--color-cream)]"
        >
          Reach out to us
        </button>
      </div>
    </form>
  );
}
