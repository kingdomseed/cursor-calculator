import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { TokenInput } from '../TokenInput';
import type { ExactTokenBreakdown } from '../../domain/recommendation/types';

const exactTokens: ExactTokenBreakdown = {
  inputWithCacheWrite: 100,
  inputWithoutCacheWrite: 200,
  cacheRead: 300,
  output: 50,
  total: 650,
};

describe('TokenInput copy', () => {
  it('clarifies quick estimates and exact bucket entry', () => {
    const simpleMarkup = renderToStaticMarkup(
      <TokenInput
        value={340_000_000}
        onChange={() => {}}
        manualTokenInputMode="simple"
        onManualTokenInputModeChange={() => {}}
        cacheReadShare={87}
        onCacheReadShareChange={() => {}}
        exactTokens={exactTokens}
        onExactTokensChange={() => {}}
      />,
    );

    expect(simpleMarkup).toContain('Quick estimate');
    expect(simpleMarkup).toContain('Exact token buckets');
    expect(simpleMarkup).toContain('Enter your monthly tokens, then estimate what share were cache reads.');
    expect(simpleMarkup).toContain('Cache-read share of entered tokens');
    expect(simpleMarkup).toContain('Tip: for the closest CSV match, use API tokens priced as your total and copy over the cache-read share.');

    const advancedMarkup = renderToStaticMarkup(
      <TokenInput
        value={340_000_000}
        onChange={() => {}}
        manualTokenInputMode="advanced"
        onManualTokenInputModeChange={() => {}}
        cacheReadShare={87}
        onCacheReadShareChange={() => {}}
        exactTokens={exactTokens}
        onExactTokensChange={() => {}}
      />,
    );

    expect(advancedMarkup).toContain('Match the token columns in an imported Cursor CSV. Total tokens update automatically.');
    expect(advancedMarkup).toContain('Input with cache write');
    expect(advancedMarkup).toContain('Input without cache write');
    expect(advancedMarkup).toContain('Cache reads');
  });
});
