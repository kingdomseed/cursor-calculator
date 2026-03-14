import { useState } from 'react';
import type { ManualTokenInputMode } from '../app/calculatorState';
import type { ExactTokenBreakdown } from '../domain/recommendation/types';
import { Collapsible } from './Collapsible';

interface TokenInputProps {
  value: number;
  onChange: (value: number) => void;
  manualTokenInputMode: ManualTokenInputMode;
  onManualTokenInputModeChange: (mode: ManualTokenInputMode) => void;
  cacheReadShare: number;
  onCacheReadShareChange: (value: number) => void;
  exactTokens: ExactTokenBreakdown;
  onExactTokensChange: (tokens: ExactTokenBreakdown) => void;
}

export function TokenInput({
  value,
  onChange,
  manualTokenInputMode,
  onManualTokenInputModeChange,
  cacheReadShare,
  onCacheReadShareChange,
  exactTokens,
  onExactTokensChange,
}: TokenInputProps) {
  const isSimpleMode = manualTokenInputMode === 'simple';

  return (
    <div className="text-center">
      <p className="text-[#14120b]/60 mb-4">How many tokens will you use this month?</p>
      <div className="inline-flex bg-white rounded-full p-1 shadow-sm border border-[#e0e0d8] mb-6">
        <button
          onClick={() => onManualTokenInputModeChange('simple')}
          className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
            isSimpleMode
              ? 'bg-[#14120b] text-white shadow-sm'
              : 'text-[#14120b]/60 hover:text-[#14120b]'
          }`}
        >
          Quick estimate
        </button>
        <button
          onClick={() => onManualTokenInputModeChange('advanced')}
          className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
            !isSimpleMode
              ? 'bg-[#14120b] text-white shadow-sm'
              : 'text-[#14120b]/60 hover:text-[#14120b]'
          }`}
        >
          Exact token buckets
        </button>
      </div>

      {isSimpleMode ? (
        <>
          <p className="text-[#14120b]/60 mb-4">
            Enter your monthly tokens, then estimate what share were cache reads.
          </p>
          <div className="inline-flex items-baseline gap-2">
            <input
              type="text"
              value={value.toLocaleString()}
              onChange={(e) => {
                const parsedValue = parseInt(e.target.value.replace(/,/g, ''), 10);
                onChange(Number.isNaN(parsedValue) ? 0 : parsedValue);
              }}
              className="w-72 sm:w-96 md:w-[28rem] text-4xl sm:text-5xl md:text-6xl font-bold bg-transparent border-none focus:outline-none focus:ring-0 text-center p-0 overflow-visible"
            />
            <span className="text-lg sm:text-xl text-[#14120b]/40">tokens</span>
          </div>
          {value >= 1_000 && (
            <p className="text-lg text-[#14120b]/50 mt-2 font-medium">
              {formatTokenScale(value)}
            </p>
          )}
          <div className="mt-6 px-4">
            <input
              type="range"
              min="100000"
              max="1000000000"
              step="100000"
              value={Math.min(value, 1_000_000_000)}
              onChange={(e) => onChange(Number(e.target.value))}
              className="w-full h-2 bg-[#e0e0d8] rounded-full appearance-none cursor-pointer accent-[#14120b]"
            />
            <div className="flex justify-between text-xs text-[#14120b]/40 mt-2">
              <span>100k</span><span>500M</span><span>1B</span>
            </div>
          </div>

          <div className="mt-6 p-4 bg-white rounded-xl border border-[#e0e0d8] text-left">
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium">Cache-read share of entered tokens</label>
              <span className="text-sm font-semibold bg-[#f7f7f4] px-2 py-0.5 rounded">
                {cacheReadShare.toFixed(cacheReadShare % 1 === 0 ? 0 : 1)}%
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              step="1"
              value={cacheReadShare}
              onChange={(e) => onCacheReadShareChange(Number(e.target.value))}
              className="w-full h-2 bg-[#e0e0d8] rounded-full appearance-none cursor-pointer accent-[#14120b]"
            />
            <div className="flex justify-between text-xs text-[#14120b]/40 mt-1">
              <span>0%</span><span>Import CSV %</span><span>100%</span>
            </div>
            <p className="mt-2 text-xs text-[#14120b]/50">
              Tip: for the closest CSV match, use API tokens priced as your total and copy over
              the cache-read share.
            </p>
          </div>
        </>
      ) : (
        <ExactTokenBucketsCard exactTokens={exactTokens} onExactTokensChange={onExactTokensChange} />
      )}
    </div>
  );
}

function ExactTokenBucketsCard({
  exactTokens,
  onExactTokensChange,
}: {
  exactTokens: ExactTokenBreakdown;
  onExactTokensChange: (tokens: ExactTokenBreakdown) => void;
}) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="bg-white rounded-2xl border border-[#e0e0d8] text-left">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-5"
      >
        <div>
          <p className="text-sm font-medium">Exact token buckets</p>
          {!expanded && exactTokens.total > 0 && (
            <p className="text-sm text-[#14120b]/50 mt-1">
              {exactTokens.total.toLocaleString()} tokens
              {exactTokens.total >= 1_000 && ` · ${formatTokenScale(exactTokens.total)}`}
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

      <Collapsible open={expanded}>
        <div className="px-5 pb-5 space-y-4">
          <p className="text-sm text-[#14120b]/60">
            Match the token columns in an imported Cursor CSV. Total tokens update automatically.
          </p>

          <ExactTokenBucketField
            label="Input with cache write"
            value={exactTokens.inputWithCacheWrite}
            onChange={(value) => onExactTokensChange({ ...exactTokens, inputWithCacheWrite: value })}
          />
          <ExactTokenBucketField
            label="Input without cache write"
            value={exactTokens.inputWithoutCacheWrite}
            onChange={(value) => onExactTokensChange({ ...exactTokens, inputWithoutCacheWrite: value })}
          />
          <ExactTokenBucketField
            label="Cache reads"
            value={exactTokens.cacheRead}
            onChange={(value) => onExactTokensChange({ ...exactTokens, cacheRead: value })}
          />
          <ExactTokenBucketField
            label="Output"
            value={exactTokens.output}
            onChange={(value) => onExactTokensChange({ ...exactTokens, output: value })}
          />

          <div className="pt-2 border-t border-[#e0e0d8]">
            <p className="text-xs uppercase tracking-wide text-[#14120b]/50">Derived total</p>
            <p className="text-2xl font-bold mt-1">{exactTokens.total.toLocaleString()} tokens</p>
            {exactTokens.total >= 1_000 && (
              <p className="text-sm text-[#14120b]/50 mt-1">{formatTokenScale(exactTokens.total)}</p>
            )}
          </div>
        </div>
      </Collapsible>
    </div>
  );
}

function ExactTokenBucketField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block">
      <span className="text-sm text-[#14120b]/60">{label}</span>
      <input
        type="text"
        value={value.toLocaleString()}
        onChange={(event) => {
          const parsedValue = parseInt(event.target.value.replace(/,/g, ''), 10);
          onChange(Number.isNaN(parsedValue) ? 0 : parsedValue);
        }}
        className="mt-1 w-full rounded-xl border border-[#e0e0d8] bg-[#f7f7f4] px-4 py-3 text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-[#14120b]/10"
      />
    </label>
  );
}

function formatTokenScale(value: number): string {
  if (value >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toFixed(value % 1_000_000_000 === 0 ? 0 : 2)} billion`;
  }

  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(value % 1_000_000 === 0 ? 0 : 2)} million`;
  }

  return `${(value / 1_000).toFixed(value % 1_000 === 0 ? 0 : 1)}k`;
}
