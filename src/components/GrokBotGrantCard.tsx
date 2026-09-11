import type { GrokBotPresentation } from '../app/recommendationPresentation';

interface Props {
  presentation: GrokBotPresentation;
}

const TAB_LABEL = 'Grok Bot Usage';

export function GrokBotGrantCard({ presentation }: Props) {
  return (
    <div className="pointer-events-none fixed inset-y-0 right-0 z-20 flex items-center">
      <section
        tabIndex={0}
        aria-label={TAB_LABEL}
        className="pointer-events-auto flex translate-x-[calc(100%-2.75rem)] cursor-pointer rounded-l-xl border border-r-0 border-[#14120b] bg-white outline-none transition-transform duration-200 ease-out hover:translate-x-0 focus:translate-x-0 focus-visible:translate-x-0 focus-within:translate-x-0 focus-visible:ring-2 focus-visible:ring-[#14120b] focus-visible:ring-offset-2 motion-reduce:translate-x-0 motion-reduce:transition-none"
      >
        <div className="flex w-11 shrink-0 items-center justify-center rounded-l-[0.7rem] bg-[#14120b] text-white">
          <span className="py-3 text-xs font-semibold tracking-wide [writing-mode:vertical-rl] rotate-180">
            {TAB_LABEL}
          </span>
        </div>
        <div className="w-72 p-4">
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
        </div>
      </section>
    </div>
  );
}
