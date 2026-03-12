import type { Mode } from '../lib/types';
import { WalletIcon, CoinsIcon } from './Icons';

export function ModeToggle({ mode, onChange }: { mode: Mode; onChange: (m: Mode) => void }) {
  return (
    <div className="flex justify-center">
      <div className="inline-flex bg-white rounded-full p-1 shadow-sm border border-[#e0e0d8]">
        <button
          onClick={() => onChange("budget")}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-full font-medium text-sm transition-all ${
            mode === "budget"
              ? "bg-[#14120b] text-white shadow-sm"
              : "text-[#14120b]/60 hover:text-[#14120b]"
          }`}
        >
          <WalletIcon className="w-4 h-4" />
          I have a budget
        </button>
        <button
          onClick={() => onChange("tokens")}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-full font-medium text-sm transition-all ${
            mode === "tokens"
              ? "bg-[#14120b] text-white shadow-sm"
              : "text-[#14120b]/60 hover:text-[#14120b]"
          }`}
        >
          <CoinsIcon className="w-4 h-4" />
          I know my usage
        </button>
      </div>
    </div>
  );
}
