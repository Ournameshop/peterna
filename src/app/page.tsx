export default function Home() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-black text-slate-100">
      {/* Soft glow accents */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-40 -left-40 h-96 w-96 rounded-full bg-indigo-500/20 blur-3xl" />
        <div className="absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-fuchsia-500/10 blur-3xl" />
      </div>

      <div className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center px-6 py-16 text-center">
        <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium tracking-wide text-slate-300 backdrop-blur">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
          In development
        </span>

        <h1 className="bg-gradient-to-b from-white to-slate-400 bg-clip-text text-4xl font-semibold tracking-tight text-transparent sm:text-6xl">
          peterna.com
        </h1>
        <p className="mt-3 text-lg font-medium text-slate-300 sm:text-xl">
          Coming Soon
        </p>

        <p className="mt-6 max-w-md text-base leading-relaxed text-slate-400 sm:text-lg">
          Something new is on the way.
        </p>

        <form
          action="#"
          className="mt-10 flex w-full max-w-md flex-col gap-3 sm:flex-row"
        >
          <label htmlFor="email" className="sr-only">
            Email address
          </label>
          <input
            id="email"
            type="email"
            name="email"
            required
            placeholder="you@example.com"
            className="flex-1 rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-indigo-400/60 focus:outline-none focus:ring-2 focus:ring-indigo-400/30"
          />
          <button
            type="submit"
            className="rounded-lg bg-white px-5 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-200 focus:outline-none focus:ring-2 focus:ring-white/40"
          >
            Notify me
          </button>
        </form>
        <p className="mt-3 text-xs text-slate-500">
          Drop your email and we&apos;ll be in touch when we launch.
        </p>

        <footer className="mt-16 text-xs text-slate-600">
          © {new Date().getFullYear()} peterna.com
        </footer>
      </div>
    </main>
  );
}
