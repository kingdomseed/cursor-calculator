import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import { BudgetInput } from '../BudgetInput';
import { ModeToggle } from '../ModeToggle';
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
      <TokenInput value={100_000_000} onChange={() => undefined} />,
    );

    expect(budgetHtml).toContain('What&#x27;s the most you want to spend per month?');
    expect(tokenHtml).toContain('How many tokens will you use this month?');
  });

  it('explains the semantic difference between budget mode and usage mode', () => {
    const html = renderToStaticMarkup(
      <ModeToggle mode="budget" onChange={() => undefined} />,
    );

    expect(html).toContain('Budget mode starts with your monthly spend ceiling.');
    expect(html).toContain('Usage mode starts with the tokens you expect to use.');
  });

  it('introduces the calculator using the new budget-versus-usage framing', () => {
    vi.stubGlobal('window', {});
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
    });

    const html = renderToStaticMarkup(<WelcomeModal />);

    expect(html).toContain('Budget mode estimates what a monthly spend ceiling gets you.');
    expect(html).toContain('Usage mode estimates total usage cost and out-of-pocket spend after plan coverage.');
  });
});
