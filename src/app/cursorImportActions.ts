import type { CalculatorAction } from './calculatorReducer';
import { readImportedCsvFiles, type ReadableCsvFile } from './readImportedCsvFiles';

export const CURSOR_IMPORT_READ_ERROR = 'Could not read the selected CSV files.';

export interface CursorImportActionFlow {
  startedAction: CalculatorAction | null;
  completion: Promise<CalculatorAction | null>;
}

export function startCursorImport(
  files: ArrayLike<ReadableCsvFile> | null,
  readFiles: (files: ArrayLike<ReadableCsvFile>) => Promise<Awaited<ReturnType<typeof readImportedCsvFiles>>> = readImportedCsvFiles,
): CursorImportActionFlow {
  if (!files || files.length === 0) {
    return {
      startedAction: null,
      completion: Promise.resolve(null),
    };
  }

  return {
    startedAction: { type: 'import_started' },
    completion: (async () => {
      try {
        const loadedFiles = await readFiles(files);
        return {
          type: 'import_loaded',
          files: loadedFiles,
        } as CalculatorAction;
      } catch {
        return {
          type: 'import_failed',
          error: CURSOR_IMPORT_READ_ERROR,
        } as CalculatorAction;
      }
    })(),
  };
}
