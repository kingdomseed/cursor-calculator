import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import { AnecdotalIncludedPoolToggle } from '../AnecdotalIncludedPoolToggle';
import { ANECDOTAL_FIRST_PARTY_POOL_TOKEN_ALLOWANCES } from '../../data/includedPoolEstimates';

describe('AnecdotalIncludedPoolToggle', () => {
  it('anchors Pro Plus at 1B and scales Pro and Ultra at 1x, 3x, and 20x', () => {
    const allowances = ANECDOTAL_FIRST_PARTY_POOL_TOKEN_ALLOWANCES;

    expect(allowances.pro_plus).toBe(1_000_000_000);
    expect(allowances.pro).toBe(Math.round(allowances.pro_plus / 3));
    expect(allowances.ultra).toBe(Math.round((allowances.pro_plus * 20) / 3));
  });

  it('renders conservative plan estimates and source links as unofficial', () => {
    const html = renderToStaticMarkup(
      <AnecdotalIncludedPoolToggle checked={false} onChange={vi.fn()} />,
    );

    expect(html).toContain('Anecdotal first-party pool estimate');
    expect(html).toContain('333.33M');
    expect(html).toContain('1.00B');
    expect(html).toContain('6.67B');
    expect(html).toContain('Composer 2.5-equivalent estimates.');
    expect(html).toContain('Actual usage depends heavily on cache hit rate and model selection');
    expect(html).toContain('1B Pro Plus anchor; scale: Pro 1x, Pro Plus 3x, Ultra 20x.');
    expect(html).toContain('cache-heavy work may last longer; Fast mode and output-heavy work may run out sooner.');
    expect(html).toContain('https://www.reddit.com/r/cursor/comments/1tq9chj/composer_25_is_a_monster_20_usd_for_800_m_tokens/');
    expect(html).toContain('https://forum.cursor.com/t/auto-composer-is-there-a-difference-in-those-plan-pro-vs-pro-vs-ultra/156411');
  });

  it('renders a standard checkbox for the opt-in control', () => {
    const html = renderToStaticMarkup(
      <AnecdotalIncludedPoolToggle checked={true} onChange={vi.fn()} />,
    );

    expect(html).toContain('for="anecdotal-included-pool-estimate"');
    expect(html).toContain('id="anecdotal-included-pool-estimate"');
    expect(html).toContain('type="checkbox"');
    expect(html).toContain('checked=""');
  });
});
