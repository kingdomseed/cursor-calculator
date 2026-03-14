import type {
  RecommendationComparisonSection,
  RecommendationPresentation,
} from '../app/recommendationPresentation';
import { PROVIDER_COLORS } from '../lib/constants';
import { CircleCheckIcon } from './Icons';

interface Props {
  presentation: RecommendationPresentation;
}

interface CardBreakdownSection {
  title: string;
  rows: Array<{
    key: string;
    label: string;
    value: string;
  }>;
}

export function BestPlanCard({ presentation }: Props) {
  const breakdownSections = getBreakdownSections(presentation);
  const { hero, bestPlan } = presentation;

  return (
    <div className="bg-[#14120b] text-white rounded-2xl p-6 sm:p-8">
      <div className="flex items-center gap-2 mb-4">
        <CircleCheckIcon className="w-5 h-5 text-green-400" />
        <span className="text-sm font-medium text-white/70 uppercase tracking-wide">Recommended plan</span>
      </div>

      <div className="mb-6">
        <p className="text-sm font-medium text-white/70 uppercase tracking-wide">{hero.title}</p>
        <div className="mt-3 flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-3">
          <h2 className="text-3xl sm:text-4xl font-bold">{bestPlan.planLabel}</h2>
          <div className="text-right">
            <p className="text-sm text-white/60">{hero.primaryMetric.label}</p>
            <p className="text-4xl sm:text-5xl font-bold">{hero.primaryMetric.formattedValue}</p>
          </div>
        </div>
        {hero.secondaryMetric && (
          <div className="mt-3 flex justify-between gap-3 text-sm">
            <span className="text-white/60">{hero.secondaryMetric.label}</span>
            <span className="font-semibold">{hero.secondaryMetric.formattedValue}</span>
          </div>
        )}
        <p className="mt-3 text-sm text-white/60">{hero.context}</p>
      </div>

      <div className="space-y-4 border-t border-white/20 pt-4">
        {breakdownSections.map((section) => (
          <div key={section.title}>
            <p className="text-sm text-white/60 mb-2">{section.title}</p>
            <div className="space-y-2 text-sm">
              {section.rows.map((row) => (
                <div key={row.key} className="flex justify-between gap-3">
                  <span className="text-white/60">{row.label}</span>
                  <span className="text-right">{row.value}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 pt-4 border-t border-white/20">
        <p className="text-sm text-white/60 mb-3">Model details</p>
        <div className="space-y-3">
          {presentation.includedPoolItems.map((item) => (
            <div key={item.key} className="flex items-start justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${PROVIDER_COLORS[item.provider] || 'bg-gray-400'}`} />
                <span className="font-medium text-sm">{item.label}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-white/60">Included</span>
              </div>
              <span className="text-sm text-white/50">{item.poolLabel}</span>
            </div>
          ))}
          {bestPlan.modelRows.map((item) => (
            <div key={item.key} className="flex items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${PROVIDER_COLORS[item.provider] || 'bg-gray-400'}`} />
                  <span className="font-medium text-sm">{item.label}</span>
                  {item.badges.map((badge) => (
                    <span key={badge} className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-white/60">
                      {badge}
                    </span>
                  ))}
                </div>
                <p className="text-xs text-white/40 ml-4">{item.rateLabel}</p>
                {item.secondaryMetric && (
                  <p className="text-xs text-white/40 ml-4 mt-1">
                    {item.secondaryMetric.label}: {item.secondaryMetric.formattedValue}
                  </p>
                )}
              </div>
              <div className="text-right">
                <p className="text-xs text-white/60">{item.primaryMetric.label}</p>
                <span className="font-semibold">{item.primaryMetric.formattedValue}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function getBreakdownSections(presentation: RecommendationPresentation): CardBreakdownSection[] {
  return presentation.comparisonSections
    .filter((section) => section.kind !== 'primary_answer')
    .map((section) => buildBreakdownSection(section, presentation.bestPlan.plan));
}

function buildBreakdownSection(
  section: RecommendationComparisonSection,
  bestPlan: RecommendationPresentation['bestPlan']['plan'],
): CardBreakdownSection {
  return {
    title: section.title,
    rows: section.rows.map((row) => {
      const value = row.values.find((entry) => entry.plan === bestPlan);

      return {
        key: row.key,
        label: row.label,
        value: value?.formattedValue ?? '—',
      };
    }),
  };
}
