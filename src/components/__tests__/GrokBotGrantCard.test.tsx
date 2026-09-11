import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import { GrokBotGrantCard } from '../GrokBotGrantCard';

const presentation = {
  heading: 'Grok Bot',
  cadenceLabel: 'Weekly',
  grantSummary: 'You get Grok Bot usage on Pro, Pro Plus, and Ultra.',
  notes: [
    'Cursor does not publish how much you get each week.',
    'If you run out and on-demand is on, extra usage bills as Cursor on-demand.',
    'SuperGrok and X Premium+ do not add extra Grok Bot usage to your Cursor plan.',
  ],
};

describe('GrokBotGrantCard', () => {
  it('keeps the simple copy and slides out from the right on hover or keyboard focus', () => {
    const html = renderToStaticMarkup(<GrokBotGrantCard presentation={presentation} />);

    expect(html).toContain('You get Grok Bot usage on Pro, Pro Plus, and Ultra.');
    expect(html).toContain('Grok Bot Usage');
    expect(html).toContain('tabindex="0"');
    expect(html).toContain('aria-label="Grok Bot Usage"');
    expect(html).toContain('hover:translate-x-0');
    expect(html).toContain('focus:translate-x-0');
    expect(html).toContain('focus-within:translate-x-0');
    expect(html).toContain('fixed inset-y-0 right-0');
    expect(html).not.toContain('h-16');
    expect(html).not.toContain('grant');
  });
});
