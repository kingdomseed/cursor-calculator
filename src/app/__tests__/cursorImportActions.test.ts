import { describe, expect, it, vi } from 'vitest';

import { CURSOR_IMPORT_READ_ERROR, startCursorImport } from '../cursorImportActions';

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
}

describe('startCursorImport', () => {
  it('returns no-op actions when no files were selected', async () => {
    const flow = startCursorImport(null);

    expect(flow.startedAction).toBeNull();
    await expect(flow.completion).resolves.toBeNull();
  });

  it('returns started immediately while the file read is still pending', async () => {
    const loadedFiles = [
      {
        name: 'cursor-usage.csv',
        text: 'csv-body',
      },
    ];
    const deferred = createDeferred<typeof loadedFiles>();
    const readFiles = vi.fn().mockReturnValue(deferred.promise);

    const flow = startCursorImport(
      [{ name: 'cursor-usage.csv', text: async () => 'csv-body' }],
      readFiles,
    );

    expect(readFiles).toHaveBeenCalledTimes(1);
    expect(flow.startedAction).toEqual({ type: 'import_started' });

    let settled = false;
    void flow.completion.then(() => {
      settled = true;
    });
    await Promise.resolve();

    expect(settled).toBe(false);

    deferred.resolve(loadedFiles);

    await expect(flow.completion).resolves.toEqual({
      type: 'import_loaded',
      files: loadedFiles,
    });
  });

  it('returns a failed completion action when file reading throws', async () => {
    const readFiles = vi.fn().mockRejectedValue(new Error('boom'));

    const flow = startCursorImport(
      [{ name: 'cursor-usage.csv', text: async () => 'csv-body' }],
      readFiles,
    );

    expect(flow.startedAction).toEqual({ type: 'import_started' });
    await expect(flow.completion).resolves.toEqual({
      type: 'import_failed',
      error: CURSOR_IMPORT_READ_ERROR,
    });
  });
});
