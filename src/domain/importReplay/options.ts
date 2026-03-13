import type { CursorImportOptions, ResolvedCursorImportOptions } from './types';

export const DEFAULT_CURSOR_IMPORT_OPTIONS: Readonly<ResolvedCursorImportOptions> = Object.freeze({
  includeUserApiKey: true,
  approximationMode: 'best_effort',
});

export function resolveCursorImportOptions(
  options: CursorImportOptions = {},
): ResolvedCursorImportOptions {
  return {
    ...DEFAULT_CURSOR_IMPORT_OPTIONS,
    ...options,
  };
}
