import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import { AnecdotalIncludedPoolToggle } from '../AnecdotalIncludedPoolToggle';

describe('AnecdotalIncludedPoolToggle', () => {
  it('renders conservative plan estimates and source links as unofficial', () => {
    const html = renderToStaticMarkup(
      <AnecdotalIncludedPoolToggle checked={false} onChange={vi.fn()} />,
    );

    expect(html).toContain('Anecdotal Composer pool estimate');
    expect(html).toContain('650.00M');
    expect(html).toContain('1.60B');
    expect(html).toContain('3.00B');
    expect(html).toContain('These are estimates.');
    expect(html).toContain('Actual usage depends heavily on cache hit rate and model selection');
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
