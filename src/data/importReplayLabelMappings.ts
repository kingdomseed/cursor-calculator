export interface ImportReplayLabelMapping {
  modelId: string;
  fast: boolean;
  maxMode: boolean;
  thinking: boolean;
  approximated: boolean;
}

export interface ImportReplayLongContextCompanion {
  maxId: string;
  approximated?: boolean;
}

export const EXACT_IMPORT_REPLAY_LABEL_MAPPINGS: Record<string, ImportReplayLabelMapping> = {
  'gpt-5-fast': {
    modelId: 'gpt-5',
    fast: true,
    maxMode: false,
    thinking: false,
    approximated: false,
  },
  'claude-4-sonnet-thinking': {
    modelId: 'claude-4-sonnet',
    fast: false,
    maxMode: false,
    thinking: true,
    approximated: false,
  },
  'claude-4.5-sonnet-thinking': {
    modelId: 'claude-4-5-sonnet',
    fast: false,
    maxMode: false,
    thinking: true,
    approximated: false,
  },
  'claude-4.6-opus-max-thinking': {
    modelId: 'claude-opus-4-6-max',
    fast: false,
    maxMode: true,
    thinking: true,
    approximated: false,
  },
};

export const APPROXIMATE_IMPORT_REPLAY_LABEL_MAPPINGS: Record<string, ImportReplayLabelMapping> = {
  'us.anthropic.claude-opus-4-6-v1': {
    modelId: 'claude-opus-4-6',
    fast: false,
    maxMode: false,
    thinking: false,
    approximated: true,
  },
  'global.anthropic.claude-opus-4-6-v1': {
    modelId: 'claude-opus-4-6',
    fast: false,
    maxMode: false,
    thinking: false,
    approximated: true,
  },
  'anthropic.claude-opus-4-6-v1': {
    modelId: 'claude-opus-4-6',
    fast: false,
    maxMode: false,
    thinking: false,
    approximated: true,
  },
  'us.anthropic.claude-opus-4-6-v1:0': {
    modelId: 'claude-opus-4-6',
    fast: false,
    maxMode: false,
    thinking: false,
    approximated: true,
  },
  'us.anthropic.claude-opus-4-6-20260205-v1:0': {
    modelId: 'claude-opus-4-6',
    fast: false,
    maxMode: false,
    thinking: false,
    approximated: true,
  },
  'us.anthropic.claude-opus-4-5-20251101-v1:0': {
    modelId: 'claude-4-5-opus',
    fast: false,
    maxMode: false,
    thinking: false,
    approximated: true,
  },
  'us.anthropic.claude-sonnet-4-5-20250929-v1:0': {
    modelId: 'claude-4-5-sonnet',
    fast: false,
    maxMode: false,
    thinking: false,
    approximated: true,
  },
  'global.anthropic.claude-sonnet-4-6-v1': {
    modelId: 'claude-sonnet-4-6',
    fast: false,
    maxMode: false,
    thinking: false,
    approximated: true,
  },
  'us.anthropic.claude-3-7-sonnet-20250219-v1:0': {
    modelId: 'claude-4-sonnet',
    fast: false,
    maxMode: false,
    thinking: false,
    approximated: true,
  },
  'claude-4.5-opus-high-thinking': {
    modelId: 'claude-4-5-opus',
    fast: false,
    maxMode: false,
    thinking: true,
    approximated: true,
  },
  'claude-4.6-opus-high-thinking': {
    modelId: 'claude-opus-4-6',
    fast: false,
    maxMode: false,
    thinking: true,
    approximated: true,
  },
  'claude-4-opus-thinking': {
    modelId: 'provider-anthropic-claude-opus-4',
    fast: false,
    maxMode: false,
    thinking: true,
    approximated: true,
  },
  'claude-4.1-opus-thinking': {
    modelId: 'provider-anthropic-claude-opus-4-1',
    fast: false,
    maxMode: false,
    thinking: true,
    approximated: true,
  },
  'gpt-5-high-fast': {
    modelId: 'gpt-5',
    fast: true,
    maxMode: false,
    thinking: false,
    approximated: true,
  },
  'gpt-5-medium-fast': {
    modelId: 'gpt-5',
    fast: true,
    maxMode: false,
    thinking: false,
    approximated: true,
  },
  'gpt-5-high': {
    modelId: 'gpt-5',
    fast: false,
    maxMode: false,
    thinking: false,
    approximated: true,
  },
  'gpt-5.1-codex-high': {
    modelId: 'gpt-5.1-codex',
    fast: false,
    maxMode: false,
    thinking: false,
    approximated: true,
  },
  'gpt-5.2-codex-xhigh': {
    modelId: 'gpt-5.2-codex',
    fast: false,
    maxMode: false,
    thinking: false,
    approximated: true,
  },
  'gpt-5.2-codex-high': {
    modelId: 'gpt-5.2-codex',
    fast: false,
    maxMode: false,
    thinking: false,
    approximated: true,
  },
  'gpt-5.3-codex-high': {
    modelId: 'gpt-5.3-codex',
    fast: false,
    maxMode: false,
    thinking: false,
    approximated: true,
  },
  'gemini-3-pro-preview': {
    modelId: 'gemini-3-pro',
    fast: false,
    maxMode: false,
    thinking: false,
    approximated: true,
  },
  'gemini-3-flash-preview': {
    modelId: 'gemini-3-flash',
    fast: false,
    maxMode: false,
    thinking: false,
    approximated: true,
  },
  o3: {
    modelId: 'provider-openai-o3',
    fast: false,
    maxMode: false,
    thinking: false,
    approximated: true,
  },
  agent_review: {
    modelId: 'gpt-5',
    fast: false,
    maxMode: false,
    thinking: false,
    approximated: true,
  },
  'grok-4-0709': {
    modelId: 'grok-code-fast-1',
    fast: false,
    maxMode: false,
    thinking: false,
    approximated: true,
  },
};

export const IMPORT_REPLAY_LONG_CONTEXT_COMPANIONS: Record<string, ImportReplayLongContextCompanion> = {
  'claude-4-sonnet': { maxId: 'claude-4-sonnet-1m' },
  'claude-4-5-opus': { maxId: 'claude-opus-4-6-max', approximated: true },
  'claude-4-5-sonnet': { maxId: 'claude-4-sonnet-1m', approximated: true },
  'claude-opus-4-6': { maxId: 'claude-opus-4-6-max' },
  'claude-sonnet-4-6': { maxId: 'claude-4-sonnet-1m', approximated: true },
  'gpt-5.4': { maxId: 'gpt-5.4-max' },
};

export const IMPORT_REPLAY_APPROXIMATE_FAST_REASONING_SUFFIXES = ['medium', 'high', 'xhigh'] as const;
export const IMPORT_REPLAY_DEFAULT_APPROXIMATE_FAST_MULTIPLIER = 2;
