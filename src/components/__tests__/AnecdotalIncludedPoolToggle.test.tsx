import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import { AnecdotalIncludedPoolToggle } from '../AnecdotalIncludedPoolToggle';

describe('AnecdotalIncludedPoolToggle', () => {
  it('renders conservative plan estimates and source links as unofficial', () => {
    const html = renderToStaticMarkup(
      <AnecdotalIncludedPoolToggle checked={false} onChange={vi.fn()} />,
    );

    expect(html).toContain('Anecdotal Composer pool estimate');
    expect(html).toContain('500.00M');
    expect(html).toContain('1.00B');
    expect(html).toContain('1.70B');
    expect(html).toContain('not Cursor entitlements');
    expect(html).toContain('$200-plan snapshot of about 1.5B tokens at 89% usage');
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
