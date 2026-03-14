import { useState } from 'react';
import { buildImportSummarySections, getPricedApiCacheReadShare } from '../app/cursorImportPresentation';
import { formatNumber } from '../domain/recommendation/formatters';
import type {
  ApproximationMode,
  CursorImportReport,
} from '../domain/importReplay/types';
import { Collapsible } from './Collapsible';

interface Props {
  report: CursorImportReport | null;
  error: string | null;
  selectedFileName: string | null;
  isImporting: boolean;
  approximationMode: ApproximationMode;
  includeUserApiKey: boolean;
  onFilesSelected: (files: FileList | null) => void;
  onApproximationModeChange: (mode: ApproximationMode) => void;
  onIncludeUserApiKeyChange: (checked: boolean) => void;
}

export function CursorImportPanel({
  report,
  error,
  selectedFileName,
  isImporting,
  approximationMode,
  includeUserApiKey,
  onFilesSelected,
  onApproximationModeChange,
  onIncludeUserApiKeyChange,
}: Props) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="bg-white rounded-2xl border border-[#e0e0d8] p-5 sm:p-6">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between text-left"
      >
        <div>
          <h3 className="text-lg font-semibold">Import Cursor usage CSVs</h3>
          {!expanded && report && (
            <p className="text-sm text-[#14120b]/50 mt-1">
              {selectedFileName} · {formatNumber(report.summary.activeDays)} days · {formatNumber(report.summary.pricedApiTokens)} API tokens · {Math.round(getPricedApiCacheReadShare(report) * 100)}% cache
            </p>
          )}
          {!expanded && !report && (
            <p className="text-sm text-[#14120b]/50 mt-1">
              {selectedFileName ?? 'No file loaded'}
            </p>
          )}
        </div>
        <svg
          className={`w-5 h-5 text-[#14120b]/40 transition-transform flex-shrink-0 ${expanded ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      <Collapsible open={expanded} duration={300}>
        <div className="space-y-3 mt-4">
          <p className="text-sm text-[#14120b]/60">
            Uses the exact input, cache, and output token columns from Cursor exports, then prices the API-eligible rows with the existing plan math.
          </p>

          <div className="rounded-xl border border-dashed border-[#e0e0d8] bg-[#f7f7f4] px-4 py-4">
            <label className="block text-sm font-medium text-[#14120b]/70 mb-2" htmlFor="cursor-csv-upload">
              Select one exported monthly CSV file
            </label>
            <input
              id="cursor-csv-upload"
              type="file"
              accept=".csv,text/csv"
              onChange={(event) => {
                onFilesSelected(event.target.files);
                event.currentTarget.value = '';
              }}
              className="block w-full text-sm text-[#14120b]/70 file:mr-4 file:rounded-full file:border-0 file:bg-[#14120b] file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-[#2b281d]"
            />
            <div className="mt-3 rounded-lg border border-[#e0e0d8] bg-white px-3 py-2 text-sm text-[#14120b]/70">
              {selectedFileName ? (
                <span className="break-all">
                  Loaded: <span className="font-medium text-[#14120b]">{selectedFileName}</span>
                </span>
              ) : (
                'No file loaded yet.'
              )}
            </div>
            <p className="mt-2 text-xs text-[#14120b]/45">
              Choosing another CSV replaces the current file.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex items-start gap-3 rounded-xl border border-[#e0e0d8] px-4 py-3">
              <input
                type="checkbox"
                checked={includeUserApiKey}
                onChange={(event) => onIncludeUserApiKeyChange(event.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-[#e0e0d8] text-[#14120b] focus:ring-[#14120b]"
              />
              <span>
                <span className="block text-sm font-medium">Include User API Key rows</span>
                <span className="block text-xs text-[#14120b]/50">
                  On by default so imported usage reflects a "Cursor only" estimate using the closest documented Cursor model rate.
                </span>
              </span>
            </label>

            <label className="rounded-xl border border-[#e0e0d8] px-4 py-3">
              <span className="block text-sm font-medium mb-2">Label mapping mode</span>
              <select
                value={approximationMode}
                onChange={(event) => onApproximationModeChange(event.target.value as ApproximationMode)}
                className="w-full rounded-lg border border-[#e0e0d8] bg-[#f7f7f4] px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#14120b]/30"
              >
                <option value="best_effort">Best effort</option>
                <option value="strict">Strict catalog only</option>
              </select>
              <span className="block text-xs text-[#14120b]/50 mt-2">
                Best effort maps retired or undocumented labels like `agent_review`, provider-prefixed API rows, and retired `grok-4` exports to the nearest documented Cursor model and flags them as approximate.
              </span>
            </label>
          </div>

          {isImporting && (
            <p className="text-sm text-[#14120b]/60">Reading and pricing selected files…</p>
          )}

          {error && (
            <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </p>
          )}

          {report && (
            <div className="space-y-4">
              {buildImportSummarySections(report).map((section) => (
                <section
                  key={section.title}
                  className="rounded-2xl border border-[#e0e0d8] bg-[#fcfcfa] p-4"
                >
                  <h4 className="text-sm font-semibold uppercase tracking-[0.18em] text-[#14120b]/55">
                    {section.title}
                  </h4>
                  <div
                    className={`mt-3 grid gap-3 ${
                      section.layout === 'usage'
                        ? 'sm:grid-cols-2'
                        : 'sm:grid-cols-2 lg:grid-cols-3'
                    }`}
                  >
                    {section.stats.map((stat) => (
                      <SummaryStat
                        key={`${section.title}-${stat.label}`}
                        label={stat.label}
                        value={stat.value}
                        note={stat.note}
                        tone={stat.tone}
                      />
                    ))}
                  </div>
                </section>
              ))}

              {report.summary.approximatedApiTokens > 0 && (
                <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  Best-effort mappings were used for {formatNumber(report.summary.approximatedApiTokens)} tokens. Those prices are useful estimates, but they are not fully verified against a first-party Cursor label match.
                </p>
              )}

              {report.unsupported.length > 0 && (
                <div className="rounded-xl border border-[#e0e0d8] px-4 py-4">
                  <h4 className="text-sm font-semibold">Top unsupported labels</h4>
                  <div className="mt-3 space-y-2">
                    {report.unsupported.slice(0, 4).map((issue) => (
                      <div key={`${issue.label}-${issue.reason}`} className="flex items-start justify-between gap-3 text-sm">
                        <div>
                          <p className="font-medium">{issue.label}</p>
                          <p className="text-xs text-[#14120b]/50">{issue.reason}</p>
                        </div>
                        <span className="font-semibold text-[#14120b]/65">{formatNumber(issue.tokens)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {report.nonApiIncluded.length > 0 && (
                <div className="rounded-xl border border-[#e0e0d8] px-4 py-4">
                  <h4 className="text-sm font-semibold">Included pool usage kept out of API pricing</h4>
                  <div className="mt-3 space-y-2">
                    {report.nonApiIncluded.slice(0, 3).map((issue) => (
                      <div key={`${issue.label}-${issue.reason}`} className="flex items-start justify-between gap-3 text-sm">
                        <div>
                          <p className="font-medium">{issue.label}</p>
                          <p className="text-xs text-[#14120b]/50">{issue.reason}</p>
                        </div>
                        <span className="font-semibold text-[#14120b]/65">{formatNumber(issue.tokens)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </Collapsible>
    </div>
  );
}

function SummaryStat({
  label,
  value,
  note,
  tone = 'default',
}: {
  label: string;
  value: string;
  note?: string;
  tone?: 'default' | 'amber' | 'red';
}) {
  const toneClasses = tone === 'amber'
    ? 'bg-amber-50 border-amber-200 text-amber-900'
    : tone === 'red'
      ? 'bg-red-50 border-red-200 text-red-900'
      : 'bg-[#f7f7f4] border-[#e0e0d8] text-[#14120b]';

  return (
    <div className={`min-w-0 rounded-xl border px-4 py-3 ${toneClasses}`}>
      <p className="text-xs uppercase tracking-wide opacity-60">{label}</p>
      <p className="mt-1 break-words text-lg font-semibold leading-tight">{value}</p>
      {note && (
        <p className="mt-1 text-xs opacity-60">{note}</p>
      )}
    </div>
  );
}
