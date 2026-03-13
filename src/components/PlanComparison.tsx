import { useState } from 'react';
import type { Mode, PlanLineItem, PlanResult } from '../lib/types';
import { formatCurrency, formatNumber } from '../domain/recommendation/formatters';
import { PROVIDER_COLORS } from '../lib/constants';

interface Props {
  results: PlanResult[];
  mode: Mode;
}

export function PlanComparison({ results, mode }: Props) {
  const [isOpen, setIsOpen] = useState(false);

  const lineItems = results[0]?.perModel ?? [];
  const apiUsageLabel = mode === 'budget' ? 'API value unlocked' : 'Your API usage';
  const overageLabel = mode === 'budget' ? 'Additional API billed' : 'Overage';
  const totalCostLabel = mode === 'budget' ? 'Total cash cost' : 'Total cost';

  return (
    <div className="mt-6">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 text-sm text-[#14120b]/60 hover:text-[#14120b]"
      >
        <svg className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
        Compare all plans
      </button>

      {isOpen && (
        <div className="mt-4 bg-white border border-[#e0e0d8] rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-[#f7f7f4]">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-[#14120b]/60"></th>
                {results.map((result) => (
                  <th
                    key={result.plan}
                    className={`text-right px-4 py-3 font-medium ${
                      mode === 'budget' && !result.affordable ? 'text-[#14120b]/30' : 'text-[#14120b]/60'
                    }`}
                  >
                    {result.plan === 'pro_plus' ? 'Pro Plus' : result.plan === 'ultra' ? 'Ultra' : 'Pro'}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e0e0d8]">
              <Row label="Subscription" values={results.map((result) => `$${result.subscription}/mo`)} results={results} mode={mode} />
              <Row label="↳ includes pool" values={results.map((result) => `$${result.apiPool}`)} results={results} mode={mode} subdued />
              <Row label={apiUsageLabel} values={results.map((result) => formatCurrency(result.apiUsage))} results={results} mode={mode} />
              <Row label={overageLabel} values={results.map((result) => result.overage > 0 ? formatCurrency(result.overage) : '—')} results={results} mode={mode} />
              <Row label={totalCostLabel} values={results.map((result) => formatCurrency(result.totalCost))} results={results} mode={mode} bold />
              <Row label="Unused pool" values={results.map((result) => result.unusedPool > 0 ? formatCurrency(result.unusedPool) : '—')} results={results} mode={mode} />
              {lineItems.map((lineItem) => (
                <tr key={lineItem.key}>
                  <td className="px-4 py-2">
                    <LineItemLabel item={lineItem} />
                  </td>
                  {results.map((result) => {
                    const item = result.perModel.find((candidate) => candidate.key === lineItem.key);
                    const dimmed = mode === 'budget' && !result.affordable;

                    return (
                      <td key={result.plan} className={`px-4 py-2 text-right text-xs font-semibold ${dimmed ? 'text-[#14120b]/30' : ''}`}>
                        {item ? (mode === 'budget' ? `${formatNumber(item.tokens.total)} tokens` : formatCurrency(item.apiCost)) : '—'}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function LineItemLabel({ item }: { item: PlanLineItem }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`w-2 h-2 rounded-full ${PROVIDER_COLORS[item.provider] || 'bg-gray-400'}`} />
      <span className="text-xs">{item.label}</span>
      {item.fast && <span className="text-[10px] text-[#14120b]/40">Fast</span>}
      {item.maxMode && <span className="text-[10px] text-[#14120b]/40">Max</span>}
      {item.approximated && <span className="text-[10px] text-amber-600">Approx</span>}
      {item.sourceLabel && <span className="text-[10px] text-[#14120b]/40">{item.sourceLabel}</span>}
    </div>
  );
}

function Row({ label, values, results, mode, bold, subdued }: {
  label: string;
  values: string[];
  results: PlanResult[];
  mode: Mode;
  bold?: boolean;
  subdued?: boolean;
}) {
  return (
    <tr>
      <td className={`px-4 py-2 ${bold ? 'font-bold' : ''} ${subdued ? 'text-[#14120b]/40 text-xs' : ''}`}>{label}</td>
      {values.map((value, index) => {
        const dimmed = mode === 'budget' && !results[index].affordable;
        return (
          <td
            key={index}
            className={`px-4 py-2 text-right ${bold ? 'font-bold' : ''} ${dimmed ? 'text-[#14120b]/30' : ''} ${subdued ? 'text-[#14120b]/40 text-xs' : ''}`}
          >
            {value}
          </td>
        );
      })}
    </tr>
  );
}
