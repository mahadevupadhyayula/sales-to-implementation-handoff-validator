import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-[#f3f1ea] px-6 py-16 text-[#18342f]">
      <div className="mx-auto max-w-5xl">
        <p className="eyebrow">Implementation intelligence</p>
        <h1 className="mt-4 max-w-3xl font-serif text-6xl leading-[0.96] tracking-[-0.04em]">
          Make the handoff decision before kickoff.
        </h1>
        <p className="mt-7 max-w-2xl text-lg leading-8 text-[#52635f]">
          Review a synthetic closed-won deal against its source evidence, resolve material findings,
          and prepare a controlled implementation decision.
        </p>
        <Link
          href="/handoffs/deal-nhl-2027-001"
          className="mt-10 inline-flex items-center gap-3 rounded-full bg-[#18342f] px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-[#245047]"
        >
          Open Northstar Harbor review <span aria-hidden>→</span>
        </Link>
        <div className="mt-16 grid gap-4 md:grid-cols-3">
          {[
            ["01", "Inspect", "Seven bounded synthetic sources, with authority and processing status."],
            ["02", "Review", "Twelve evidence-backed findings grouped into six delivery workstreams."],
            ["03", "Decide", "Four explicit outcomes, unlocked only after required review."],
          ].map(([number, title, copy]) => (
            <div key={number} className="rounded-2xl border border-[#d8d8ce] bg-white/55 p-6">
              <span className="font-mono text-xs text-[#bc5c3f]">{number}</span>
              <h2 className="mt-8 text-lg font-semibold">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-[#63706d]">{copy}</p>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
