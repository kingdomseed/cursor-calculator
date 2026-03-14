import { useState } from 'react';
import type {
  IncludedPoolItem,
  RecommendationComparisonRow,
  RecommendationModelDisplayRow,
  RecommendationModelGroup,
  RecommendationPlanPresentation,
  RecommendationPresentation,
} from '../app/recommendationPresentation';
import { getBaseModelId } from '../app/modelGrouping';
import { formatCurrency } from '../domain/recommendation/formatters';
import { PROVIDER_COLORS } from '../lib/constants';
import { Collapsible } from './Collapsible';

interface Props {
  presentation: RecommendationPresentation;
  defaultOpen?: boolean;
}

interface ComparisonModelRow {
  key: string;
  label: string;
  provider: string;
  badges: string[];
  rateLabel: string;
  values: Array<{
    plan: RecommendationPlanPresentation['plan'];
    affordable: boolean;
    primaryMetric: RecommendationModelDisplayRow['primaryMetric'] | null;
    secondaryMetric: RecommendationModelDisplayRow['secondaryMetric'];
  }>;
}

export function PlanComparison({ presentation, defaultOpen = false }: Props) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const modelRows = presentation.modelGroups ? [] : buildModelRows(presentation.plans);
  const hasModelContent = modelRows.length > 0
    || presentation.includedPoolItems.length > 0
    || (presentation.modelGroups && presentation.modelGroups.length > 0);

  return (
    <div className="mt-6">
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        className="flex items-center gap-2 text-sm text-[#14120b]/60 hover:text-[#14120b]"
      >
        <svg className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
        Compare all plans
      </button>

      <Collapsible open={isOpen} duration={300}>
        <div className="mt-4 bg-white border border-[#e0e0d8] rounded-xl overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#14120b]">
                <th className="text-left px-5 py-3 font-medium text-white/60 text-xs uppercase tracking-wide"></th>
                {presentation.plans.map((plan) => (
                  <th
                    key={plan.plan}
                    className={`text-right px-5 py-3 text-xs font-semibold uppercase tracking-wide ${
                      shouldDimPlan(plan, presentation) ? 'text-white/25' : 'text-white/80'
                    }`}
                  >
                    {plan.planLabel}
                  </th>
                ))}
              </tr>
            </thead>
            {presentation.comparisonSections.map((section) => (
              <tbody key={section.kind}>
                <tr className="bg-[#f0efe8]">
                  <th
                    colSpan={presentation.plans.length + 1}
                    className="px-5 py-2 text-left text-[10px] font-bold uppercase tracking-[0.15em] text-[#14120b]/50"
                  >
                    {section.title}
                  </th>
                </tr>
                {section.rows.map((row, rowIndex) => (
                  <ComparisonRow
                    key={row.key}
                    presentation={presentation}
                    row={row}
                    isEven={rowIndex % 2 === 0}
                    isTotal={row.key === 'totalOutOfPocket' || row.key === 'estimatedMonthlyCost' || row.key === 'primaryEstimatedOutOfPocket'}
                  />
                ))}
                {section.kind === 'usage_value_details' && hasModelContent && (
                  <>
                    <tr className="bg-[#f0efe8]">
                      <th
                        colSpan={presentation.plans.length + 1}
                        className="px-5 py-2 text-left text-[10px] font-bold uppercase tracking-[0.15em] text-[#14120b]/50"
                      >
                        Per-model details
                      </th>
                    </tr>
                    {presentation.includedPoolItems.map((item) => (
                      <IncludedPoolRow
                        key={item.key}
                        item={item}
                        planCount={presentation.plans.length}
                      />
                    ))}
                    {presentation.modelGroups ? (
                      <GroupedModelRows
                        modelGroups={presentation.modelGroups}
                        plans={presentation.plans}
                        presentation={presentation}
                      />
                    ) : (
                      modelRows.map((row) => (
                        <ModelRow
                          key={row.key}
                          presentation={presentation}
                          row={row}
                        />
                      ))
                    )}
                  </>
                )}
              </tbody>
            ))}
          </table>
        </div>
      </Collapsible>
    </div>
  );
}

function ComparisonRow({
  presentation,
  row,
  isEven,
  isTotal,
}: {
  presentation: RecommendationPresentation;
  row: RecommendationComparisonRow;
  isEven: boolean;
  isTotal: boolean;
}) {
  const rowBg = isTotal ? 'bg-[#f7f7f4]' : isEven ? 'bg-white' : 'bg-[#fafaf8]';

  return (
    <tr className={`${rowBg} ${isTotal ? 'border-t border-[#e0e0d8]' : ''}`}>
      <td className={`px-5 py-2.5 ${isTotal ? 'font-semibold text-[#14120b]' : 'text-[#14120b]/70'}`}>
        {row.label}
      </td>
      {row.values.map((value) => (
        <td
          key={value.plan}
          className={`px-5 py-2.5 text-right tabular-nums ${
            isTotal ? 'font-semibold' : ''
          } ${
            shouldDimAffordableValue(value.affordable, presentation)
              ? 'text-[#14120b]/25'
              : isTotal ? 'text-[#14120b]' : 'text-[#14120b]/80'
          }`}
        >
          {value.formattedValue}
        </td>
      ))}
    </tr>
  );
}

function ModelRow({
  presentation,
  row,
}: {
  presentation: RecommendationPresentation;
  row: ComparisonModelRow;
}) {
  return (
    <tr className="border-t border-[#e0e0d8]/50">
      <td className="px-5 py-2.5 align-top">
        <div className="flex items-start gap-2">
          <span className={`w-2 h-2 rounded-full mt-1 ${PROVIDER_COLORS[row.provider] || 'bg-gray-400'}`} />
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-[#14120b]/70">{row.label}</span>
              {row.badges.map((badge) => (
                <span key={badge} className="text-[10px] text-[#14120b]/35">
                  {badge}
                </span>
              ))}
            </div>
            <p className="text-[10px] text-[#14120b]/35">{row.rateLabel}</p>
          </div>
        </div>
      </td>
      {row.values.map((value) => (
        <td
          key={value.plan}
          className={`px-5 py-2.5 text-right align-top ${
            shouldDimAffordableValue(value.affordable, presentation)
              ? 'text-[#14120b]/25'
              : ''
          }`}
        >
          {value.primaryMetric ? (
            <p className="font-semibold text-xs">{value.primaryMetric.formattedValue}</p>
          ) : (
            <p className="font-semibold text-xs text-[#14120b]/25">—</p>
          )}
          {value.secondaryMetric && (
            <p className="text-[10px] text-[#14120b]/35 mt-1">
              {value.secondaryMetric.label}: {value.secondaryMetric.formattedValue}
            </p>
          )}
        </td>
      ))}
    </tr>
  );
}

function IncludedPoolRow({
  item,
  planCount,
}: {
  item: IncludedPoolItem;
  planCount: number;
}) {
  return (
    <tr className="border-t border-[#e0e0d8]/50">
      <td className="px-5 py-2.5 align-top">
        <div className="flex items-start gap-2">
          <span className={`w-2 h-2 rounded-full mt-1 ${PROVIDER_COLORS[item.provider] || 'bg-gray-400'}`} />
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-[#14120b]/70">{item.label}</span>
              <span className="text-[10px] text-[#14120b]/35">Included</span>
            </div>
            <p className="text-[10px] text-[#14120b]/35">{item.poolLabel}</p>
          </div>
        </div>
      </td>
      {Array.from({ length: planCount }, (_, i) => (
        <td key={i} className="px-5 py-2.5 text-right align-top text-xs text-[#14120b]/35">
          Included
        </td>
      ))}
    </tr>
  );
}

function GroupedModelRows({
  modelGroups,
  plans,
  presentation,
}: {
  modelGroups: RecommendationModelGroup[];
  plans: RecommendationPlanPresentation[];
  presentation: RecommendationPresentation;
}) {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const toggleGroup = (groupKey: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupKey)) {
        next.delete(groupKey);
      } else {
        next.add(groupKey);
      }
      return next;
    });
  };

  return (
    <>
      {modelGroups.map((group) => {
        const isExpanded = expandedGroups.has(group.groupKey);
        const isSingleton = group.variantCount === 1;

        return (
          <GroupSection
            key={group.groupKey}
            group={group}
            plans={plans}
            presentation={presentation}
            isExpanded={isExpanded}
            isSingleton={isSingleton}
            onToggle={() => toggleGroup(group.groupKey)}
          />
        );
      })}
    </>
  );
}

function GroupSection({
  group,
  plans,
  presentation,
  isExpanded,
  isSingleton,
  onToggle,
}: {
  group: RecommendationModelGroup;
  plans: RecommendationPlanPresentation[];
  presentation: RecommendationPresentation;
  isExpanded: boolean;
  isSingleton: boolean;
  onToggle: () => void;
}) {
  // Compute per-plan aggregate values for this group
  const planAggregates = plans.map((plan) => {
    const total = plan.modelRows
      .filter((row) => getBaseModelId(row.modelId) === group.groupKey)
      .reduce((sum, row) => sum + (row.primaryMetric.value ?? 0), 0);
    return {
      plan: plan.plan,
      affordable: plan.affordable,
      total,
    };
  });

  // Build child model rows for expanded view
  const childKeys = group.children.map((child) => child.key);
  const childRows: ComparisonModelRow[] = childKeys.map((childKey) => {
    // Find the first plan that has this child row to get label/provider/badges/rateLabel
    let label = '';
    let provider = '';
    let badges: string[] = [];
    let rateLabel = '';
    for (const plan of plans) {
      const found = plan.modelRows.find((r) => r.key === childKey);
      if (found) {
        label = found.label;
        provider = found.provider;
        badges = found.badges;
        rateLabel = found.rateLabel;
        break;
      }
    }

    return {
      key: childKey,
      label,
      provider,
      badges,
      rateLabel,
      values: plans.map((plan) => {
        const found = plan.modelRows.find((r) => r.key === childKey);
        return {
          plan: plan.plan,
          affordable: plan.affordable,
          primaryMetric: found?.primaryMetric ?? null,
          secondaryMetric: found?.secondaryMetric ?? null,
        };
      }),
    };
  });

  if (isSingleton && childRows.length === 1) {
    return (
      <ModelRow
        key={childRows[0].key}
        presentation={presentation}
        row={childRows[0]}
      />
    );
  }

  return (
    <>
      {/* Group header row */}
      <tr className="hover:bg-[#f7f7f4]/40">
        <td className="px-4 py-2 align-top">
          <button
            type="button"
            className="flex items-start gap-2 cursor-pointer text-left w-full"
            onClick={onToggle}
            aria-expanded={isExpanded}
          >
            <span className={`w-2 h-2 rounded-full mt-1 ${PROVIDER_COLORS[group.provider] || 'bg-gray-400'}`} />
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs">{group.familyLabel}</span>
              <span className="text-[10px] text-[#14120b]/40">
                {group.variantCount} variants
              </span>
              <svg
                className={`w-3 h-3 text-[#14120b]/40 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </button>
        </td>
        {planAggregates.map((agg) => (
          <td
            key={agg.plan}
            className={`px-4 py-2 text-right align-top ${
              shouldDimAffordableValue(agg.affordable, presentation)
                ? 'text-[#14120b]/30'
                : ''
            }`}
          >
            <p className="font-semibold text-xs">{formatCurrency(agg.total)}</p>
          </td>
        ))}
      </tr>

      {/* Expanded child rows */}
      <tr>
        <td colSpan={plans.length + 1} className="p-0 border-0">
          <Collapsible open={isExpanded}>
            <table className="w-full text-sm">
              <tbody>
                {childRows.map((row) => (
                  <ModelRow
                    key={row.key}
                    presentation={presentation}
                    row={row}
                  />
                ))}
              </tbody>
            </table>
          </Collapsible>
        </td>
      </tr>
    </>
  );
}

function buildModelRows(plans: RecommendationPlanPresentation[]): ComparisonModelRow[] {
  const rows = new Map<string, {
    key: string;
    label: string;
    provider: string;
    badges: string[];
    rateLabel: string;
    byPlan: Map<RecommendationPlanPresentation['plan'], RecommendationModelDisplayRow>;
  }>();

  for (const plan of plans) {
    for (const modelRow of plan.modelRows) {
      const existing = rows.get(modelRow.key);

      if (!existing) {
        rows.set(modelRow.key, {
          key: modelRow.key,
          label: modelRow.label,
          provider: modelRow.provider,
          badges: modelRow.badges,
          rateLabel: modelRow.rateLabel,
          byPlan: new Map(),
        });
      }

      rows.get(modelRow.key)?.byPlan.set(plan.plan, modelRow);
    }
  }

  return Array.from(rows.values()).map((row) => ({
    key: row.key,
    label: row.label,
    provider: row.provider,
    badges: row.badges,
    rateLabel: row.rateLabel,
    values: plans.map((plan) => {
      const value = row.byPlan.get(plan.plan);

      return {
        plan: plan.plan,
        affordable: plan.affordable,
        primaryMetric: value?.primaryMetric ?? null,
        secondaryMetric: value?.secondaryMetric ?? null,
      };
    }),
  }));
}

function shouldDimPlan(
  plan: RecommendationPlanPresentation,
  presentation: RecommendationPresentation,
) {
  return presentation.mode === 'budget' && !plan.affordable;
}

function shouldDimAffordableValue(
  affordable: boolean,
  presentation: RecommendationPresentation,
) {
  return presentation.mode === 'budget' && !affordable;
}
