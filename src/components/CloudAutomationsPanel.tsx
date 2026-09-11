import type { ReactNode } from 'react';
import type { Audience, Model } from '../domain/catalog/types';
import type {
  CloudAutomationScope,
  CloudAutomationsResult,
  CloudProductKind,
  CloudRuntimeKind,
} from '../domain/cloudAutomations/types';
import { getCloudProductLabel } from '../domain/cloudAutomations/pricing';
import { PROVIDER_COLORS } from '../lib/constants';

interface Props {
  audience: Audience;
  product: CloudProductKind;
  runtime: CloudRuntimeKind;
  automationScope: CloudAutomationScope;
  modelId: string;
  tokens: number;
  cacheReadShare: number;
  inputRatio: number;
  fast: boolean;
  models: Model[];
  result: CloudAutomationsResult;
  onProductChange: (product: CloudProductKind) => void;
  onRuntimeChange: (runtime: CloudRuntimeKind) => void;
  onAutomationScopeChange: (scope: CloudAutomationScope) => void;
  onModelIdChange: (modelId: string) => void;
  onTokensChange: (tokens: number) => void;
  onCacheReadShareChange: (cacheReadShare: number) => void;
  onInputRatioChange: (inputRatio: number) => void;
  onFastChange: (fast: boolean) => void;
}

const PRODUCTS: CloudProductKind[] = [
  'cloud_agent',
  'self_hosted_runtime',
  'automation',
  'bugbot',
  'security_agent',
  'pr_routing_and_approval',
  'projects',
];

export function CloudAutomationsPanel({
  audience,
  product,
  runtime,
  automationScope,
  modelId,
  tokens,
  cacheReadShare,
  inputRatio,
  fast,
  models,
  result,
  onProductChange,
  onRuntimeChange,
  onAutomationScopeChange,
  onModelIdChange,
  onTokensChange,
  onCacheReadShareChange,
  onInputRatioChange,
  onFastChange,
}: Props) {
  const selectedModel = models.find((model) => model.id === modelId);
  const showModelInputs = product === 'cloud_agent'
    || product === 'self_hosted_runtime'
    || product === 'automation'
    || product === 'bugbot';

  return (
    <div>
      <h2 className="text-lg font-semibold">Cloud, Bugbot, and automations</h2>
      <p className="mt-1 text-sm text-[#14120b]/55">
        Separate from monthly IDE pools. Cloud runs are priced at the selected model&apos;s API rates.
        This is not an IDE plan recommendation.
      </p>

      <div className="mt-4 p-4 bg-white rounded-xl border border-[#e0e0d8] space-y-4">
        <Field label="Product" htmlFor="cloud-product">
          <select
            id="cloud-product"
            value={product}
            onChange={(event) => onProductChange(event.target.value as CloudProductKind)}
            className="w-full bg-[#f7f7f4] border border-[#e0e0d8] rounded-lg px-3 py-2 text-sm"
          >
            {PRODUCTS.map((value) => (
              <option key={value} value={value}>{getCloudProductLabel(value)}</option>
            ))}
          </select>
        </Field>

        {product === 'self_hosted_runtime' && (
          <Field label="Runtime" htmlFor="cloud-runtime">
            <select
              id="cloud-runtime"
              value={runtime}
              onChange={(event) => onRuntimeChange(event.target.value as CloudRuntimeKind)}
              className="w-full bg-[#f7f7f4] border border-[#e0e0d8] rounded-lg px-3 py-2 text-sm"
            >
              <option value="cursor_managed">Cursor-managed</option>
              <option value="my_machines">My machines</option>
              <option value="team_pools" disabled={audience === 'personal'}>
                Team Pools (Enterprise)
              </option>
            </select>
          </Field>
        )}

        {product === 'automation' && (
          <Field label="Automation scope" htmlFor="cloud-scope">
            <select
              id="cloud-scope"
              value={automationScope}
              onChange={(event) => onAutomationScopeChange(event.target.value as CloudAutomationScope)}
              className="w-full bg-[#f7f7f4] border border-[#e0e0d8] rounded-lg px-3 py-2 text-sm"
            >
              <option value="private">Private (creator billed)</option>
              <option value="team_visible">Team Visible (creator billed)</option>
              <option value="team_owned" disabled={audience === 'personal'}>
                Team Owned (Teams/Enterprise)
              </option>
            </select>
          </Field>
        )}

        {showModelInputs && (
          <>
            <Field label="Selected model" htmlFor="cloud-model">
              <select
                id="cloud-model"
                value={modelId}
                onChange={(event) => onModelIdChange(event.target.value)}
                className="w-full bg-[#f7f7f4] border border-[#e0e0d8] rounded-lg px-3 py-2 text-sm"
              >
                {models.map((model) => (
                  <option key={model.id} value={model.id}>{model.name}</option>
                ))}
              </select>
            </Field>

            {selectedModel?.variants?.fast && (
              <label className="flex items-center gap-1.5 text-sm">
                <input
                  type="checkbox"
                  checked={fast}
                  onChange={(event) => onFastChange(event.target.checked)}
                  className="w-4 h-4 rounded border-[#e0e0d8] text-[#14120b] accent-[#14120b]"
                />
                Fast variant
              </label>
            )}

            <Field label="Tokens for this run" htmlFor="cloud-tokens">
              <input
                id="cloud-tokens"
                type="number"
                min="0"
                step="1000"
                value={tokens}
                onChange={(event) => onTokensChange(Number(event.target.value))}
                className="w-full bg-[#f7f7f4] border border-[#e0e0d8] rounded-lg px-3 py-2 text-sm"
              />
            </Field>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label htmlFor="cloud-cache-share" className="text-sm font-medium">Cache-read share</label>
                <span className="text-sm font-semibold bg-[#f7f7f4] px-2 py-0.5 rounded">{cacheReadShare}%</span>
              </div>
              <input
                id="cloud-cache-share"
                type="range"
                min="0"
                max="95"
                step="5"
                value={cacheReadShare}
                onChange={(event) => onCacheReadShareChange(Number(event.target.value))}
                className="w-full h-2 bg-[#e0e0d8] rounded-full appearance-none cursor-pointer accent-[#14120b]"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label htmlFor="cloud-io-ratio" className="text-sm font-medium">Input : Output ratio</label>
                <span className="text-sm font-semibold bg-[#f7f7f4] px-2 py-0.5 rounded">{inputRatio} : 1</span>
              </div>
              <input
                id="cloud-io-ratio"
                type="range"
                min="1"
                max="10"
                step="0.5"
                value={inputRatio}
                onChange={(event) => onInputRatioChange(Number(event.target.value))}
                className="w-full h-2 bg-[#e0e0d8] rounded-full appearance-none cursor-pointer accent-[#14120b]"
              />
            </div>
          </>
        )}
      </div>

      <div className="mt-6 p-4 bg-white rounded-xl border border-[#e0e0d8]">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#14120b]/50">Cloud cost</p>
        <div className="mt-3 flex items-center gap-2">
          {selectedModel && (
            <span className={`w-2 h-2 rounded-full ${PROVIDER_COLORS[selectedModel.provider] || 'bg-gray-400'}`} />
          )}
          <p className="text-sm font-medium">{getCloudProductLabel(product)}</p>
        </div>
        <div className="mt-3 space-y-2 text-sm">
          {result.lines.map((line) => (
            <div key={line.key} className="flex justify-between gap-3">
              <span className="text-[#14120b]/60">
                {line.label}
                {line.status === 'unverified' ? ' (unverified)' : ''}
              </span>
              <span className="font-semibold">{line.formattedAmount}</span>
            </div>
          ))}
        </div>
        {result.lines.some((line) => line.note) && (
          <p className="mt-3 text-xs text-[#14120b]/50">
            {result.lines.find((line) => line.note)?.note}
          </p>
        )}
        <ul className="mt-4 space-y-1.5 text-xs text-[#14120b]/50">
          {result.notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="block text-sm font-medium mb-1.5">{label}</label>
      {children}
    </div>
  );
}
