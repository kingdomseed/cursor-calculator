import { ANECDOTAL_FIRST_PARTY_POOL_TOKEN_ALLOWANCES, ANECDOTAL_INCLUDED_POOL_SOURCES } from '../data/includedPoolEstimates';
import { formatNumber } from '../domain/recommendation/formatters';

interface AnecdotalIncludedPoolToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
}

const SWITCH_ID = 'anecdotal-included-pool-estimate';

export function AnecdotalIncludedPoolToggle({
  checked,
  onChange,
}: AnecdotalIncludedPoolToggleProps) {
  const planEstimates = [
    { label: 'Pro', tokens: ANECDOTAL_FIRST_PARTY_POOL_TOKEN_ALLOWANCES.pro },
    { label: 'Pro Plus', tokens: ANECDOTAL_FIRST_PARTY_POOL_TOKEN_ALLOWANCES.pro_plus },
    { label: 'Ultra', tokens: ANECDOTAL_FIRST_PARTY_POOL_TOKEN_ALLOWANCES.ultra },
  ];

  return (
    <section className="mt-4 p-4 bg-white rounded-xl border border-[#e0e0d8]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <label htmlFor={SWITCH_ID} className="text-sm font-semibold text-[#14120b]">
            Anecdotal first-party pool estimate
          </label>
          <p id={`${SWITCH_ID}-description`} className="mt-1 text-xs text-[#14120b]/55">
            Cursor does not publish first-party pool limits. This optional estimate uses
            community-reported dashboard data to model overage after the pool is exhausted.
          </p>
          <p className="mt-1 text-xs font-medium text-[#14120b]/55">
            1B Pro Plus anchor; scale: Pro 1x, Pro Plus 3x, Ultra 20x.
          </p>
        </div>
        <input
          id={SWITCH_ID}
          type="checkbox"
          checked={checked}
          aria-describedby={`${SWITCH_ID}-description`}
          onChange={(event) => onChange(event.target.checked)}
          className="mt-0.5 h-5 w-5 flex-shrink-0 cursor-pointer rounded border-[#b9b9ad] text-[#14120b] accent-[#14120b] focus:ring-2 focus:ring-[#14120b] focus:ring-offset-2"
        />
      </div>

      <dl className="mt-3 grid grid-cols-3 gap-2">
        {planEstimates.map((estimate) => (
          <div key={estimate.label} className="rounded-lg bg-[#f7f7f4] px-3 py-2">
            <dt className="text-[11px] font-medium uppercase tracking-wide text-[#14120b]/45">
              {estimate.label}
            </dt>
            <dd className="text-sm font-semibold text-[#14120b]">
              {formatNumber(estimate.tokens)}
            </dd>
          </div>
        ))}
      </dl>

      <p className="mt-3 text-xs text-[#14120b]/45">
        Composer 2.5-equivalent estimates. Actual usage depends heavily on cache hit rate and model selection:
        cache-heavy work may last longer; Fast mode and output-heavy work may run out sooner.
      </p>

      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
        {ANECDOTAL_INCLUDED_POOL_SOURCES.map((source) => (
          <a
            key={source.url}
            href={source.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-[#14120b]/55 underline hover:text-[#14120b]"
          >
            {source.label}
          </a>
        ))}
      </div>
    </section>
  );
}
