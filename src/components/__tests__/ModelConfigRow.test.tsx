import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import { getModelById } from '../../domain/catalog/currentCatalog';
import type { ModelConfig } from '../../lib/types';
import { ModelConfigRow } from '../ModelConfigRow';

function configFor(modelId: string): ModelConfig {
  return {
    modelId,
    weight: 100,
    maxMode: true,
    fast: false,
    thinking: false,
    caching: false,
    cacheHitRate: 0,
  };
}

describe('ModelConfigRow fast and long context', () => {
  it('does not present Grok 4.7 Fast as a Max Mode variant', () => {
    const model = getModelById('grok-4.7');
    const markup = renderToStaticMarkup(
      <ModelConfigRow model={model!} config={configFor(model!.id)} onChange={() => undefined} />,
    );

    expect(markup).toContain('Fast');
    expect(markup).not.toContain('separate from Max');
    expect(markup).not.toContain('stacks with Max');
  });

  it('still marks documented separate Fast and Max variants', () => {
    const model = getModelById('gpt-5.6-sol');
    const markup = renderToStaticMarkup(
      <ModelConfigRow model={model!} config={configFor(model!.id)} onChange={() => undefined} />,
    );

    expect(markup).toContain('(separate from Max)');
  });
});
