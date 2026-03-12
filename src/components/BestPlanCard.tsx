import type { Model, ModelConfig, PlanResult, Mode } from '../lib/types';
import { formatNumber, formatCurrency, formatRate } from '../lib/calculations';
import { PROVIDER_COLORS } from '../lib/constants';

interface Props {
  result: PlanResult;
  mode: Mode;
  models: Model[];
  configs: ModelConfig[];
}

export function BestPlanCard({ result, mode, models, configs }: Props) {
  return (
    <div className="bg-[#14120b] text-white rounded-2xl p-6 sm:p-8">
      <div className="flex items-center gap-2 mb-4">
        <svg className="w-5 h-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
        </svg>
        <span className="text-sm font-medium text-white/70 uppercase tracking-wide">Your Best Option</span>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-2 mb-6">
        <h2 className="text-3xl sm:text-4xl font-bold">{result.plan === 'pro_plus' ? 'Pro Plus' : result.plan === 'ultra' ? 'Ultra' : 'Pro'}</h2>
        <div className="text-right">
          <p className="text-4xl sm:text-5xl font-bold">{formatCurrency(result.totalCost)}</p>
          <p className="text-white/60 text-sm">/month</p>
        </div>
      </div>

      <div className="space-y-3 border-t border-white/20 pt-4 text-sm">
        {/* Subscription with pool as subordinate detail */}
        <div>
          <div className="flex justify-between">
            <span className="text-white/60">Plan subscription</span>
            <span>${result.subscription}/mo</span>
          </div>
          <p className="text-xs text-white/40 mt-0.5">
            includes ${result.apiPool} API pool
          </p>
        </div>

        {/* What happens with usage vs pool */}
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

      {/* Per-model breakdown */}
      <div className="mt-6 pt-4 border-t border-white/20">
        <p className="text-sm text-white/60 mb-3">
          {mode === 'budget' ? 'What you get' : 'Your usage breakdown'}
        </p>
        <div className="space-y-3">
          {result.perModel.map((pm) => {
            const model = models.find(m => m.id === pm.modelId);
            const config = configs.find(c => c.modelId === pm.modelId);
            if (!model) return null;
            const variantBadges: string[] = [];
            if (config?.maxMode) variantBadges.push('Max');
            if (config?.fast) variantBadges.push('Fast');
            if (config?.thinking) variantBadges.push('Thinking');
            if (config?.caching) variantBadges.push(`Cache ${config.cacheHitRate}%`);
            return (
              <div key={pm.modelId} className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${PROVIDER_COLORS[model.provider] || 'bg-gray-400'}`} />
                    <span className="font-medium text-sm">{model.name}</span>
                    {variantBadges.map(badge => (
                      <span key={badge} className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-white/60">{badge}</span>
                    ))}
                  </div>
                  <p className="text-xs text-white/40 ml-4">
                    {formatRate(pm.effectiveRates.input)} / {formatRate(pm.effectiveRates.output)} per M
                  </p>
                </div>
                <div className="text-right">
                  {mode === 'budget' ? (
                    <span className="font-semibold">{formatNumber(pm.tokens.total)} tokens</span>
                  ) : (
                    <span className="font-semibold">{formatCurrency(pm.apiCost)}</span>
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
