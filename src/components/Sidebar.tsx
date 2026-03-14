import type { NavigationTarget } from '../app/calculatorState';
import { CalculatorIcon, GitHubIcon, JHDIcon } from './Icons';

interface SidebarProps {
  activeTarget: NavigationTarget;
  onNavigate: (target: NavigationTarget) => void;
  pricingDate: string;
}

const NAV_ITEMS: { target: NavigationTarget; label: string }[] = [
  { target: 'budget', label: 'I have a budget' },
  { target: 'manual_usage', label: 'I know my usage' },
  { target: 'csv_import', label: 'I have a CSV' },
];

export function Sidebar({ activeTarget, onNavigate, pricingDate }: SidebarProps) {
  return (
    <aside
      role="navigation"
      aria-label="Calculator mode"
      className="flex flex-col h-full bg-[#14120b] text-white p-4"
    >
      {/* Branding */}
      <div className="flex items-center gap-2 mb-6">
        <CalculatorIcon className="w-5 h-5" />
        <span className="font-semibold text-sm">Cursor Cost Calculator</span>
      </div>

      {/* Navigation */}
      <nav className="flex flex-col gap-1">
        {NAV_ITEMS.map(({ target, label }) => (
          <button
            key={target}
            onClick={() => onNavigate(target)}
            className={
              target === activeTarget
                ? 'text-left px-3 py-2 rounded text-sm bg-white/12 text-white font-medium'
                : 'text-left px-3 py-2 rounded text-sm text-white/50 hover:text-white/70 hover:bg-white/5'
            }
          >
            {label}
          </button>
        ))}
      </nav>

      {/* Footer */}
      <div className="mt-auto pt-6">
        <p className="text-[10px] text-white/30 mb-2 font-medium uppercase tracking-wide">
          How plans work
        </p>
        <p className="text-[10px] text-white/30 mb-3">
          Every plan includes two usage pools. Auto and Composer are usage-based and included in
          every subscription — they don&apos;t draw from the API pool. The API pool covers all other
          models. Once exhausted, you pay overage at the same per-token rates.
        </p>

        <p className="text-[10px] text-white/30 mb-2 font-medium">Max Mode</p>
        <p className="text-[10px] text-white/30 mb-3">
          Adds 20% Cursor upcharge. For extended context (1M), use the dedicated Max/1M model
          variants which have long-context pricing built into their rates.
        </p>

        <p className="text-[10px] text-white/30 mb-2 font-medium">Disclaimer</p>
        <p className="text-[10px] text-white/30 mb-3">
          All figures are estimates based on publicly available pricing data. Actual costs depend on
          your specific usage patterns, and rates may change without notice. This tool is not
          affiliated with Cursor.
        </p>

        <p className="text-[10px] text-white/30 mb-3">Last updated {pricingDate}</p>

        <div className="flex items-center gap-3">
          <a
            href="https://github.com/kingdomseed/cursor-calculator"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-[10px] text-white/30 hover:text-white/50"
          >
            <GitHubIcon className="w-3 h-3" />
            GitHub
          </a>
          <a
            href="https://jasonholtdigital.com"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-[10px] text-white/30 hover:text-white/50"
          >
            <JHDIcon className="w-3 h-3" />
            JHD
          </a>
        </div>
      </div>
    </aside>
  );
}
