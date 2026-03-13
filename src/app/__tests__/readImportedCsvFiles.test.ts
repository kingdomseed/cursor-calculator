import { describe, expect, it } from 'vitest';

import { readImportedCsvFiles } from '../readImportedCsvFiles';

describe('readImportedCsvFiles', () => {
  it('loads only the first selected file', async () => {
    const loaded = await readImportedCsvFiles([
      {
        name: 'cursor-usage-a.csv',
        text: async () => 'first-body',
      },
      {
        name: 'cursor-usage-b.csv',
        text: async () => 'second-body',
      },
    ]);

    expect(loaded).toEqual([
      {
        name: 'cursor-usage-a.csv',
        text: 'first-body',
      },
    ]);
  });

  it('surfaces file read failures to the controller layer', async () => {
    await expect(readImportedCsvFiles([
      {
        name: 'cursor-usage.csv',
        text: async () => {
          throw new Error('boom');
        },
      },
    ])).rejects.toThrow('boom');
  });
});
