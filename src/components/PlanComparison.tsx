import { useState } from 'react';
import type { Model, Mode, PlanResult } from '../lib/types';
import { formatNumber, formatCurrency } from '../lib/calculations';
import { PROVIDER_COLORS } from '../lib/constants';

interface Props {
  results: PlanResult[];
  mode: Mode;
  models: Model[];
}

export function PlanComparison({ results, mode, models }: Props) {
  const [isOpen, setIsOpen] = useState(false);

  const modelIds = results[0]?.perModel.map(pm => pm.modelId) ?? [];

  return (
    <div className="mt-6">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 text-sm text-[#14120b]/60 hover:text-[#14120b]"
      >
        <svg className={`w-4 h-4 transition-transform ${isOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                {results.map(r => (
                  <th key={r.plan} className={`text-right px-4 py-3 font-medium ${
                    mode === 'budget' && !r.affordable ? 'text-[#14120b]/30' : 'text-[#14120b]/60'
                  }`}>
                    {r.plan === 'pro_plus' ? 'Pro Plus' : r.plan === 'ultra' ? 'Ultra' : 'Pro'}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e0e0d8]">
              <Row label="Subscription" values={results.map(r => `$${r.subscription}`)} results={results} mode={mode} />
              <Row label="API pool" values={results.map(r => `$${r.apiPool}`)} results={results} mode={mode} />
              <Row label="Your API usage" values={results.map(r => formatCurrency(r.apiUsage))} results={results} mode={mode} />
              <Row label="Overage" values={results.map(r => r.overage > 0 ? formatCurrency(r.overage) : '—')} results={results} mode={mode} />
              <Row label="Total cost" values={results.map(r => formatCurrency(r.totalCost))} results={results} mode={mode} bold />
              <Row label="Unused pool" values={results.map(r => r.unusedPool > 0 ? formatCurrency(r.unusedPool) : '—')} results={results} mode={mode} />
              {modelIds.map(modelId => {
                const model = models.find(m => m.id === modelId);
                if (!model) return null;
                return (
                  <tr key={modelId}>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${PROVIDER_COLORS[model.provider] || 'bg-gray-400'}`} />
                        <span className="text-xs">{model.name}</span>
                      </div>
                    </td>
                    {results.map(r => {
                      const pm = r.perModel.find(p => p.modelId === modelId);
                      const dimmed = mode === 'budget' && !r.affordable;
                      return (
                        <td key={r.plan} className={`px-4 py-2 text-right text-xs font-semibold ${dimmed ? 'text-[#14120b]/30' : ''}`}>
                          {pm ? (mode === 'budget' ? `${formatNumber(pm.tokens.total)} tokens` : formatCurrency(pm.apiCost)) : '—'}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Row({ label, values, results, mode, bold }: {
  label: string; values: string[]; results: PlanResult[]; mode: Mode; bold?: boolean;
}) {
  return (
    <tr>
      <td className={`px-4 py-2 ${bold ? 'font-bold' : ''}`}>{label}</td>
      {values.map((v, i) => {
        const dimmed = mode === 'budget' && !results[i].affordable;
        return (
          <td key={i} className={`px-4 py-2 text-right ${bold ? 'font-bold' : ''} ${dimmed ? 'text-[#14120b]/30' : ''}`}>
            {v}
          </td>
        );
      })}
    </tr>
  );
}
