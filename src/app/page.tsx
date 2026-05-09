import PawMark from "@/components/PawMark";
import SignupForm from "@/components/SignupForm";

export default function Home() {
  const year = new Date().getFullYear();

  return (
    <main className="relative flex min-h-screen flex-col bg-[color:var(--color-cream)] text-[color:var(--color-charcoal)]">
      {/* Header / wordmark */}
      <header className="z-10 px-6 pt-8 sm:px-10 sm:pt-10">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <span
            aria-label="peterna"
            className="font-display text-xl italic lowercase text-[color:var(--color-sage-deep)] sm:text-2xl"
          >
            peterna
          </span>
          <span className="hidden items-center gap-2 text-[0.7rem] uppercase tracking-[0.28em] text-[color:var(--color-charcoal-faint)] sm:inline-flex">
            <span className="relative flex h-1.5 w-1.5">
              <span className="gentle-pulse absolute inline-flex h-full w-full rounded-full bg-[color:var(--color-sage)]" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[color:var(--color-sage)]" />
            </span>
            Coming soon
          </span>
        </div>
      </header>

      {/* Hero */}
      <section className="z-10 flex flex-1 items-center px-6 sm:px-10">
        <div className="soft-rise mx-auto w-full max-w-2xl py-16 text-center sm:py-24">
          <PawMark
            size={92}
            className="mx-auto mb-8 text-[color:var(--color-sage)]"
          />

          <h1 className="font-display text-[2rem] font-normal leading-[1.2] tracking-tight text-[color:var(--color-charcoal)] sm:text-5xl md:text-[3.25rem]">
            A gentle place to{" "}
            <em className="not-italic font-normal text-[color:var(--color-sage-deep)] sm:italic">
              remember
            </em>
            <span className="text-[color:var(--color-sage-deep)]">.</span>
          </h1>

          <p className="mx-auto mt-6 max-w-lg text-base leading-relaxed text-[color:var(--color-charcoal-soft)] sm:mt-7 sm:text-lg">
            peterna is a quiet space to celebrate, remember, and share the lives
            of the pets we&rsquo;ve loved.
            <span className="mt-2 block text-[color:var(--color-charcoal-faint)]">
              Coming soon.
            </span>
          </p>

          <div className="flex justify-center">
            <SignupForm />
          </div>

          {/* Mobile-only "coming soon" indicator (header version is hidden on mobile). */}
          <p className="mt-10 inline-flex items-center gap-2 text-[0.7rem] uppercase tracking-[0.28em] text-[color:var(--color-charcoal-faint)] sm:hidden">
            <span className="relative flex h-1.5 w-1.5">
              <span className="gentle-pulse absolute inline-flex h-full w-full rounded-full bg-[color:var(--color-sage)]" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[color:var(--color-sage)]" />
            </span>
            Opening soon
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="z-10 px-6 pb-8 sm:px-10 sm:pb-10">
        <div className="mx-auto flex max-w-5xl items-center justify-center border-t border-[color:var(--color-charcoal)]/[0.08] pt-6">
          <p className="text-xs tracking-wide text-[color:var(--color-charcoal-faint)]">
            Made with love{" "}
            <span className="mx-2 text-[color:var(--color-sage)]">·</span>{" "}
            © {year}{" "}
            <span className="font-display italic lowercase text-[color:var(--color-charcoal-soft)]">
              peterna
            </span>
          </p>
        </div>
      </footer>
    </main>
  );
}
