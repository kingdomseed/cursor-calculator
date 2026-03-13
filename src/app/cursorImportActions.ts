import type { CalculatorAction } from './calculatorReducer';
import { readImportedCsvFiles, type ReadableCsvFile } from './readImportedCsvFiles';

export const CURSOR_IMPORT_READ_ERROR = 'Could not read the selected CSV files.';

export async function buildCursorImportActions(
  files: ArrayLike<ReadableCsvFile> | null,
  readFiles: (files: ArrayLike<ReadableCsvFile>) => Promise<Awaited<ReturnType<typeof readImportedCsvFiles>>> = readImportedCsvFiles,
): Promise<CalculatorAction[]> {
  if (!files || files.length === 0) {
    return [];
  }

  try {
    const loadedFiles = await readFiles(files);
    return [
      { type: 'import_started' },
      { type: 'import_loaded', files: loadedFiles },
    ];
  } catch {
    return [
      { type: 'import_started' },
      { type: 'import_failed', error: CURSOR_IMPORT_READ_ERROR },
    ];
  }
}
