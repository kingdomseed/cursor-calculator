import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import { BudgetInput } from '../BudgetInput';
import { TokenInput } from '../TokenInput';
import { WelcomeModal } from '../WelcomeModal';

describe('calculator semantics copy', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('frames the budget and token inputs around spend ceiling versus monthly usage', () => {
    const budgetHtml = renderToStaticMarkup(
      <BudgetInput value={200} onChange={() => undefined} />,
    );
    const tokenHtml = renderToStaticMarkup(
      <TokenInput
        value={100_000_000}
        onChange={() => undefined}
        manualTokenInputMode="simple"
        onManualTokenInputModeChange={() => undefined}
        cacheReadShare={25}
        onCacheReadShareChange={() => undefined}
        exactTokens={{
          inputWithCacheWrite: 0,
          inputWithoutCacheWrite: 0,
          cacheRead: 0,
          output: 0,
          total: 0,
        }}
        onExactTokensChange={() => undefined}
      />,
    );

    expect(budgetHtml).toContain('What&#x27;s the most you want to spend per month?');
    expect(tokenHtml).toContain('How many tokens will you use this month?');
  });

  it('introduces the calculator using the new budget-versus-usage framing', () => {
    vi.stubGlobal('window', {});
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
    });

    const html = renderToStaticMarkup(<WelcomeModal />);

    expect(html).toContain('Budget mode estimates what a monthly spend ceiling gets you.');
    expect(html).toContain('Cursor docs disagree on Other Models dollars: search and a 2026-08-23 Wayback capture of a billing page still show at least $20 / $70 / $400; the live billing page and pricing table no longer print those amounts.');
    expect(html).toContain('Last published floors are not current guaranteed included dollars.');
    expect(html).toContain('Cloud, Bugbot, and automations have their own cost view.');
  });
});
