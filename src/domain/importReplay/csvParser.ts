import type { ExactTokenBreakdown } from '../recommendation/types';
import type { ParsedRow } from './types';

export function parseCursorCsvText(text: string): ParsedRow[] {
  const lines = text
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0);

  if (lines.length <= 1) {
    return [];
  }

  const headers = parseCsvLine(lines[0]);

  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    const row = Object.fromEntries(headers.map((header, index) => [header, values[index] ?? '']));

    const tokens: ExactTokenBreakdown = {
      inputWithCacheWrite: toNumber(row['Input (w/ Cache Write)']),
      inputWithoutCacheWrite: toNumber(row['Input (w/o Cache Write)']),
      cacheRead: toNumber(row['Cache Read']),
      output: toNumber(row['Output Tokens']),
      total: toNumber(row['Total Tokens']),
    };

    const computedTotal =
      tokens.inputWithCacheWrite +
      tokens.inputWithoutCacheWrite +
      tokens.cacheRead +
      tokens.output;

    if (tokens.total <= 0 && computedTotal > 0) {
      tokens.total = computedTotal;
    }

    return {
      dayKey: extractDayKey(row.Date),
      kind: row.Kind ?? '',
      model: row.Model ?? 'unknown',
      maxMode: (row['Max Mode'] ?? '').toLowerCase() === 'yes',
      tokens,
    };
  });
}

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];

    if (char === '"') {
      const nextChar = line[index + 1];
      if (inQuotes && nextChar === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      values.push(current);
      current = '';
      continue;
    }

    current += char;
  }

  values.push(current);
  return values;
}

function toNumber(value: string | undefined): number {
  const normalized = (value ?? '').replace(/,/g, '').trim();
  if (!normalized) return 0;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function extractDayKey(value: string | undefined): string | null {
  const normalized = (value ?? '').trim();
  if (!normalized) return null;

  const directMatch = normalized.match(/^(\d{4}-\d{2}-\d{2})/);
  if (directMatch) {
    return directMatch[1];
  }

  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString().slice(0, 10);
}
