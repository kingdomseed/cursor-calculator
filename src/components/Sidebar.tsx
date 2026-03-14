import type { NavigationTarget } from '../app/calculatorState';
import { CalculatorIcon, ChartLineIcon, FileCsvIcon, GitHubIcon, JHDIcon, WalletIcon } from './Icons';

interface SidebarProps {
  activeTarget: NavigationTarget;
  onNavigate: (target: NavigationTarget) => void;
  pricingDate: string;
}

const NAV_ITEMS: { target: NavigationTarget; label: string; icon: typeof WalletIcon }[] = [
  { target: 'budget', label: 'I have a budget', icon: WalletIcon },
  { target: 'manual_usage', label: 'I know my usage', icon: ChartLineIcon },
  { target: 'csv_import', label: 'I have a CSV', icon: FileCsvIcon },
];

export function Sidebar({ activeTarget, onNavigate, pricingDate }: SidebarProps) {
  return (
    <aside
      className="flex flex-col h-full overflow-y-auto bg-[#14120b] text-white p-5"
    >
      {/* Branding */}
      <div className="flex items-center gap-2 mb-6">
        <CalculatorIcon className="w-5 h-5" />
        <span className="font-semibold text-sm">Cursor Cost Calculator</span>
      </div>

      {/* Navigation */}
      <nav aria-label="Calculator mode" className="flex flex-col gap-1">
        {NAV_ITEMS.map(({ target, label, icon: Icon }) => (
          <button
            key={target}
            type="button"
            onClick={() => onNavigate(target)}
            className={`flex items-center gap-2.5 text-left px-3 py-2.5 rounded-lg text-sm transition-colors ${
              target === activeTarget
                ? 'bg-white/12 text-white font-medium'
                : 'text-white/50 hover:text-white/70 hover:bg-white/5'
            }`}
          >
            <Icon className="w-4 h-4 flex-shrink-0" />
            {label}
          </button>
        ))}
      </nav>

      {/* Footer */}
      <div className="mt-auto pt-6">
        <p className="text-xs text-white/45 mb-2 font-medium uppercase tracking-wide">
          How plans work
        </p>
        <p className="text-xs text-white/45 mb-3">
          Every plan includes two usage pools: usage-based and API-based. Auto and Composer draw
          from the usage-based pool and are included in every subscription. The API pool covers all
          other models. Once exhausted, you pay overage at the same per-token rates.
        </p>

        <p className="text-xs text-white/45 mb-2 font-medium">Max Mode</p>
        <p className="text-xs text-white/45 mb-3">
          Extends context to a model&apos;s maximum (up to 1M tokens). Adds a 20% Cursor upcharge.
          Some models also have provider-level long-context rates — Claude 4.6 Opus is the
          exception with no additional surcharge at 1M context.
        </p>

        <p className="text-xs text-white/45 mb-2 font-medium">Caching</p>
        <p className="text-xs text-white/45 mb-3">
          Cache reads are up to 90% cheaper than regular input tokens for most models. Cursor bills
          cache reads as a separate token category alongside input and output.
        </p>

        <p className="text-xs text-white/45 mb-2 font-medium">Disclaimer</p>
        <p className="text-xs text-white/45 mb-3">
          All figures are estimates based on publicly available pricing data. Actual costs depend on
          your specific usage patterns, and rates may change without notice. This tool is not
          affiliated with Cursor.
        </p>

        <p className="mb-3">
          <a
            href="https://cursor.com/docs/models-and-pricing"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-white/45 underline hover:text-white/70"
          >
            Cursor&apos;s Pricing Page
          </a>
        </p>

        <div className="flex items-center gap-3 mb-3">
          <a
            href="https://github.com/kingdomseed/cursor-calculator"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-white/45 hover:text-white/70"
          >
            <GitHubIcon className="w-3 h-3" />
            GitHub
          </a>
          <a
            href="https://jasonholtdigital.com"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-white/45 hover:text-white/70"
          >
            <JHDIcon className="w-3 h-3" />
            JHD
          </a>
        </div>

        <p className="text-xs text-white/30 mt-3">Last updated {pricingDate}</p>
      </div>
    </aside>
  );
}
