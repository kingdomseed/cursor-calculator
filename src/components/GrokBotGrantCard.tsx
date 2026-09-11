import type { GrokBotPresentation } from '../app/recommendationPresentation';

interface Props {
  presentation: GrokBotPresentation;
}

export function GrokBotGrantCard({ presentation }: Props) {
  return (
    <section className="mt-6 p-4 bg-white rounded-xl border border-[#e0e0d8]">
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
  );
}
