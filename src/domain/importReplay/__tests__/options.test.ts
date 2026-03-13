import { describe, expect, it } from 'vitest';

import { DEFAULT_CURSOR_IMPORT_OPTIONS, resolveCursorImportOptions } from '../options';

describe('import replay options', () => {
  it('provides one shared set of replay defaults', () => {
    expect(DEFAULT_CURSOR_IMPORT_OPTIONS).toEqual({
      includeUserApiKey: true,
      approximationMode: 'best_effort',
    });
    expect(resolveCursorImportOptions()).toEqual(DEFAULT_CURSOR_IMPORT_OPTIONS);
  });

  it('merges partial overrides onto the shared defaults', () => {
    expect(resolveCursorImportOptions({ approximationMode: 'strict' })).toEqual({
      includeUserApiKey: true,
      approximationMode: 'strict',
    });
    expect(resolveCursorImportOptions({ includeUserApiKey: false })).toEqual({
      includeUserApiKey: false,
      approximationMode: 'best_effort',
    });
  });
});
