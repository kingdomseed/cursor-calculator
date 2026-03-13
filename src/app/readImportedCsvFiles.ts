import type { ImportedCsvFile } from './calculatorState';

export interface ReadableCsvFile {
  name: string;
  text: () => Promise<string>;
}

export async function readImportedCsvFiles(
  files: ArrayLike<ReadableCsvFile>,
): Promise<ImportedCsvFile[]> {
  const selectedFile = files[0];
  if (!selectedFile) {
    return [];
  }

  return [{
    name: selectedFile.name,
    text: await selectedFile.text(),
  }];
}
