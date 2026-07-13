import type { PlanKey } from '../domain/catalog/types';
import type { IncludedPoolEstimateConfig } from '../domain/recommendation/types';

export const ANECDOTAL_INCLUDED_POOL_SOURCES = [
  {
    label: 'Cursor forum: Auto + Composer pool',
    url: 'https://forum.cursor.com/t/auto-composer-is-there-a-difference-in-those-plan-pro-vs-pro-vs-ultra/156411',
  },
  {
    label: 'Reddit: Composer 2.5 Pro estimate',
    url: 'https://www.reddit.com/r/cursor/comments/1tq9chj/composer_25_is_a_monster_20_usd_for_800_m_tokens/',
  },
  {
    label: 'Reddit: Composer 2.5 Ultra estimate',
    url: 'https://www.reddit.com/r/cursor/comments/1txnq52/composer_25_usage_with_ultra/',
  },
  {
    label: 'DeepakNess Composer 2.5 usage writeup',
    url: 'https://deepakness.com/raw/using-composer-2-5/',
  },
] as const;

export const ANECDOTAL_FIRST_PARTY_POOL_TOKEN_ALLOWANCES: Record<PlanKey, number> = {
  pro: 333_333_333,
  pro_plus: 1_000_000_000,
  ultra: 6_666_666_667,
};

export const ANECDOTAL_INCLUDED_POOL_ESTIMATE: IncludedPoolEstimateConfig = {
  referenceModelId: 'composer-2.5',
  equivalentTokenAllowances: ANECDOTAL_FIRST_PARTY_POOL_TOKEN_ALLOWANCES,
  sourceLabel: 'Rate-weighted community estimate',
};
