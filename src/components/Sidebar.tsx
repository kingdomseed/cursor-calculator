import type { NavigationTarget } from '../app/calculatorState';
import { CalculatorIcon, ChartLineIcon, CloudIcon, FileCsvIcon, GitHubIcon, JHDIcon, WalletIcon } from './Icons';

interface SidebarProps {
  activeTarget: NavigationTarget;
  onNavigate: (target: NavigationTarget) => void;
  pricingDate: string;
}

const NAV_ITEMS: { target: NavigationTarget; label: string; icon: typeof WalletIcon }[] = [
  { target: 'budget', label: 'I have a budget', icon: WalletIcon },
  { target: 'manual_usage', label: 'I know my usage', icon: ChartLineIcon },
  { target: 'csv_import', label: 'I have a CSV', icon: FileCsvIcon },
  { target: 'cloud_automations', label: 'Cloud and automations', icon: CloudIcon },
];

export function Sidebar({ activeTarget, onNavigate, pricingDate }: SidebarProps) {
  return (
    <aside
      data-sidebar
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
          About this tool
        </p>
        <p className="text-xs text-white/45 mb-4">
          Budget mode estimates what a monthly spend ceiling gets you. Usage mode estimates total
          usage cost and out-of-pocket spend. Last published Other Models floors are not current
          guaranteed included dollars. Import a Cursor CSV to replay exact token columns from a
          real month. Cloud and automations are a separate cost family.
        </p>

        <p className="text-xs text-white/45 mb-2 font-medium uppercase tracking-wide">
          How plans work
        </p>
        <p className="text-xs text-white/45 mb-3">
          Official monthly pools are Cursor Models and Other Models. Unused monthly usage does not
          roll over. Composer 2.5, Grok 4.6, and Grok 4.5 are Cursor Models. Auto is a router, not
          a pool. Last published official Other Models floors were Pro at least $20, Pro Plus $70,
          and Ultra $400. Live docs no longer publish those amounts. Ultra used to include $400 on
          a $200 plan; you may not get that now. The same is true of Pro $20 and Pro Plus $70.
          Those are last published historical floors, not current guaranteed included dollars.
          Teams Other Models dollars are unpublished. Teams and Enterprise add $0.25/M on
          third-party tokens.
        </p>

        <p className="text-xs text-white/45 mb-2 font-medium">Max Mode</p>
        <p className="text-xs text-white/45 mb-3">
          Max Mode is available only on legacy request-based plans, at API rate plus 20%. Current
          usage-based plans do not include Max Mode, so the +20% upcharge is hidden here.
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
            href="https://cursor.com/docs"
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
