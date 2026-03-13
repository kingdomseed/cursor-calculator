import type { Mode, PlanResult } from '../lib/types';
import { formatCurrency, formatNumber, formatRate } from '../lib/calculations';
import { PROVIDER_COLORS } from '../lib/constants';
import { CircleCheckIcon } from './Icons';

interface Props {
  result: PlanResult;
  mode: Mode;
}

export function BestPlanCard({ result, mode }: Props) {
  return (
    <div className="bg-[#14120b] text-white rounded-2xl p-6 sm:p-8">
      <div className="flex items-center gap-2 mb-4">
        <CircleCheckIcon className="w-5 h-5 text-green-400" />
        <span className="text-sm font-medium text-white/70 uppercase tracking-wide">Your Best Option</span>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-2 mb-6">
        <h2 className="text-3xl sm:text-4xl font-bold">
          {result.plan === 'pro_plus' ? 'Pro Plus' : result.plan === 'ultra' ? 'Ultra' : 'Pro'}
        </h2>
        <div className="text-right">
          <p className="text-4xl sm:text-5xl font-bold">{formatCurrency(result.totalCost)}</p>
          <p className="text-white/60 text-sm">/month</p>
        </div>
      </div>

      <div className="space-y-3 border-t border-white/20 pt-4 text-sm">
        <div>
          <div className="flex justify-between">
            <span className="text-white/60">Plan subscription</span>
            <span>${result.subscription}/mo</span>
          </div>
          <p className="text-xs text-white/40 mt-0.5">
            includes ${result.apiPool} API pool
          </p>
        </div>

        {result.overage > 0 ? (
          <div className="flex justify-between">
            <span className="text-white/60">Additional API usage</span>
            <span className="text-amber-400">+{formatCurrency(result.overage)}</span>
          </div>
        ) : (
          <div className="flex justify-between">
            <span className="text-white/60">API usage covered by pool</span>
            <span className="text-green-400">{formatCurrency(result.apiUsage)}</span>
          </div>
        )}
      </div>

      <div className="mt-6 pt-4 border-t border-white/20">
        <p className="text-sm text-white/60 mb-3">
          {mode === 'budget' ? 'What you get' : 'Your usage breakdown'}
        </p>
        <div className="space-y-3">
          {['Auto', 'Composer 1.5'].map((name) => (
            <div key={name} className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#14120b] ring-1 ring-white/20" />
                <span className="font-medium text-sm">{name}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-white/60">Included</span>
              </div>
              <span className="font-semibold text-white/50">Usage based</span>
            </div>
          ))}

          {result.perModel.map((item) => {
            const variantBadges: string[] = [];
            if (item.maxMode) variantBadges.push('Max');
            if (item.fast) variantBadges.push('Fast');
            if (item.thinking) variantBadges.push('Thinking');
            if (item.caching) {
              variantBadges.push(item.exactTokens ? 'Cache' : `Cache ${item.cacheHitRate}%`);
            }
            if (item.approximated) variantBadges.push('Approx');
            if (item.sourceLabel) variantBadges.push(item.sourceLabel);

            return (
              <div key={item.key} className="flex items-start justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${PROVIDER_COLORS[item.provider] || 'bg-gray-400'}`} />
                    <span className="font-medium text-sm">{item.label}</span>
                    {variantBadges.map((badge) => (
                      <span key={badge} className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-white/60">
                        {badge}
                      </span>
                    ))}
                  </div>
                  <p className="text-xs text-white/40 ml-4">
                    {formatRate(item.effectiveRates.input)} / {formatRate(item.effectiveRates.output)} per M
                  </p>
                </div>
                <div className="text-right">
                  {mode === 'budget' ? (
                    <span className="font-semibold">{formatNumber(item.tokens.total)} tokens</span>
                  ) : (
                    <span className="font-semibold">{formatCurrency(item.apiCost)}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
