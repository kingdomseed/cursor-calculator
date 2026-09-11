import type { Model } from '../catalog/types';
import { isOtherModelsPool } from '../catalog/pools';
import { buildSimpleExactTokenBreakdown } from '../recommendation/manualUsage';
import { exactTokensToDollars } from '../recommendation/conversions';
import { computeBillableRates } from '../recommendation/rates';
import { formatCurrency } from '../recommendation/formatters';
import type {
  CloudAutomationsInput,
  CloudAutomationsResult,
  CloudCostLine,
  CloudProductKind,
} from './types';

const PRODUCT_LABELS: Record<CloudProductKind, string> = {
  cloud_agent: 'Cloud Agents',
  self_hosted_runtime: 'Self-hosted runtime',
  automation: 'Automations',
  bugbot: 'Bugbot',
  security_agent: 'Security Agents',
  pr_routing_and_approval: 'PR Routing and Approval',
  projects: 'Projects',
};

export function computeCloudAutomationsCost(
  input: CloudAutomationsInput,
  models: Model[],
): CloudAutomationsResult {
  const model = models.find((candidate) => candidate.id === input.modelId);
  const notes = buildCloudNotes(input);
  const unpublishedProducts = input.product === 'projects'
    || input.product === 'pr_routing_and_approval'
    || input.product === 'security_agent';

  if (!model || unpublishedProducts) {
    return {
      product: input.product,
      modelId: input.modelId,
      modelName: model?.name ?? input.modelId,
      billedAtApiRates: false,
      usageCost: null,
      lines: [
        unpublishedLine(input.product),
      ],
      notes,
    };
  }

  if (input.product === 'bugbot') {
    return {
      product: input.product,
      modelId: model.id,
      modelName: model.name,
      billedAtApiRates: true,
      usageCost: null,
      lines: [
        {
          key: 'bugbot-guidance',
          label: 'Average run guidance',
          amount: null,
          formattedAmount: '$1.00–$1.50',
          status: 'unverified',
          note: 'Guidance copy, not a published per-PR rate.',
        },
        pricedLine(model, input, 'Autofix token cost at selected model API rates'),
      ],
      notes,
    };
  }

  const usageLine = pricedLine(model, input, `${PRODUCT_LABELS[input.product]} at selected model API rates`);

  return {
    product: input.product,
    modelId: model.id,
    modelName: model.name,
    billedAtApiRates: true,
    usageCost: usageLine.amount,
    lines: [usageLine],
    notes,
  };
}

function pricedLine(model: Model, input: CloudAutomationsInput, label: string): CloudCostLine {
  const exactTokens = buildSimpleExactTokenBreakdown(input.tokens, input.cacheReadShare, input.inputRatio);
  const rates = computeBillableRates(
    model,
    {
      modelId: model.id,
      weight: 100,
      maxMode: false,
      fast: input.fast && !!model.variants?.fast,
      thinking: false,
      caching: input.cacheReadShare > 0,
      cacheHitRate: input.cacheReadShare,
    },
    new Date(),
    input.audience,
  );
  const amount = exactTokensToDollars(exactTokens, rates);

  return {
    key: 'selected-model-api',
    label,
    amount,
    formattedAmount: formatCurrency(amount),
    status: 'sourced',
    note: isOtherModelsPool(model.pool) && input.audience === 'teams_enterprise'
      ? 'Teams third-party runs include the $0.25/M Cursor Token Rate here. Whether that rate also applies to Cloud Agent runs is unverified; it is shown only as the same selected-model API math.'
      : undefined,
  };
}

function unpublishedLine(product: CloudProductKind): CloudCostLine {
  return {
    key: 'unpublished',
    label: `${PRODUCT_LABELS[product]} price`,
    amount: null,
    formattedAmount: 'Unpublished',
    status: 'unverified',
  };
}

function buildCloudNotes(input: CloudAutomationsInput): string[] {
  const notes = [
    'Cloud Agents and Automations are billed at API pricing for the selected model.',
    'A claim that Cloud Agents always bypass Cursor Models included usage is unverified.',
    'No Cursor VM-hour, CPU, or memory price is published.',
  ];

  if (input.product === 'self_hosted_runtime') {
    notes.push('Self-hosted adds bring-your-own compute. Cursor still bills the selected model.');
    notes.push('Worker caps: 200 per user and 1,000 per team.');
    if (input.runtime === 'team_pools' && input.audience !== 'teams_enterprise') {
      notes.push('Team Pools are gated to Enterprise.');
    }
    if (input.runtime !== 'cursor_managed') {
      notes.push('Partner or local compute dollars are unverified.');
    }
  }

  if (input.product === 'automation') {
    notes.push('Each Automation run is a Cloud Agent run. Automations use each model’s maximum context window.');
    if (input.automationScope === 'team_owned' && input.audience === 'personal') {
      notes.push('Team Owned billing is for Teams/Enterprise only.');
    }
    if (input.audience === 'personal') {
      notes.push('Whether Pro, Pro Plus, and Ultra include Automations beyond Bugbot is unverified.');
    }
  }

  if (input.product === 'bugbot') {
    notes.push(
      input.audience === 'teams_enterprise'
        ? 'Teams/Enterprise Bugbot settles on-demand only.'
        : 'Personal Bugbot uses included usage first, then on-demand if enabled.',
    );
    notes.push('Current exact per-PR rates on cursor.com/pricing are unverified.');
  }

  if (input.product === 'security_agent') {
    notes.push('Security Agents bill to the team usage pool. No separate add-on price is published.');
    notes.push('Requires a team or enterprise plan.');
  }

  if (input.product === 'pr_routing_and_approval') {
    notes.push('PR Routing and Approval has no published price section.');
  }

  if (input.product === 'projects') {
    notes.push('Projects are powered by Cloud Agents. Beta. Price and plan gate are unpublished.');
  }

  return notes;
}

export function getCloudProductLabel(product: CloudProductKind): string {
  return PRODUCT_LABELS[product];
}
