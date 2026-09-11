import type { GrokBotPresentation } from '../app/recommendationPresentation';

interface Props {
  presentation: GrokBotPresentation;
}

export function GrokBotGrantCard({ presentation }: Props) {
  return (
    <>
      <div className="h-16" aria-hidden="true" />
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-20 md:left-64">
        <div className="mx-auto max-w-2xl px-4">
          <section
            tabIndex={0}
            aria-label="Grok Bot"
            className="pointer-events-auto translate-y-[calc(100%-3rem)] cursor-pointer rounded-t-xl border border-b-0 border-[#e0e0d8] bg-white p-4 outline-none transition-transform duration-200 ease-out hover:translate-y-0 focus:translate-y-0 focus-visible:translate-y-0 focus-within:translate-y-0 focus-visible:ring-2 focus-visible:ring-[#14120b] focus-visible:ring-offset-2 motion-reduce:translate-y-0 motion-reduce:transition-none"
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-[#14120b]/50">
              {presentation.cadenceLabel}
            </p>
            <h3 className="mt-1 text-sm font-semibold">{presentation.heading}</h3>
            <p className="mt-2 text-sm text-[#14120b]/70">{presentation.grantSummary}</p>
            <ul className="mt-3 space-y-1.5 text-xs text-[#14120b]/50">
              {presentation.notes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </>
  );
}
