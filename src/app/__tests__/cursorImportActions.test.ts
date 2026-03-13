import { describe, expect, it, vi } from 'vitest';

import { buildCursorImportActions, CURSOR_IMPORT_READ_ERROR } from '../cursorImportActions';

describe('buildCursorImportActions', () => {
  it('returns no actions when no files were selected', async () => {
    await expect(buildCursorImportActions(null)).resolves.toEqual([]);
  });

  it('emits started and loaded actions for a successful file selection', async () => {
    const readFiles = vi.fn().mockResolvedValue([
      {
        name: 'cursor-usage.csv',
        text: 'csv-body',
      },
    ]);

    const actions = await buildCursorImportActions(
      [{ name: 'cursor-usage.csv', text: async () => 'csv-body' }],
      readFiles,
    );

    expect(readFiles).toHaveBeenCalledTimes(1);
    expect(actions).toEqual([
      { type: 'import_started' },
      {
        type: 'import_loaded',
        files: [{ name: 'cursor-usage.csv', text: 'csv-body' }],
      },
    ]);
  });

  it('emits started and failed actions when file reading throws', async () => {
    const readFiles = vi.fn().mockRejectedValue(new Error('boom'));

    const actions = await buildCursorImportActions(
      [{ name: 'cursor-usage.csv', text: async () => 'csv-body' }],
      readFiles,
    );

    expect(actions).toEqual([
      { type: 'import_started' },
      {
        type: 'import_failed',
        error: CURSOR_IMPORT_READ_ERROR,
      },
    ]);
  });
});
