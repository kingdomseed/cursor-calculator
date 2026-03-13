import type { CursorImportOptions } from './types';

export function getExclusionReason(
  kind: string,
  options: Required<CursorImportOptions>,
): string | null {
  if (kind === 'Errored, No Charge' || kind === 'Aborted, Not Charged') {
    return 'No-charge row excluded from pricing replay';
  }

  if (kind === 'Free') {
    return 'Free row excluded from pricing replay';
  }

  if (kind === 'User API Key' && !options.includeUserApiKey) {
    return 'User API Key row excluded from Cursor-plan replay';
  }

  return null;
}
