import { useState } from 'react';
import { HandWaveIcon } from './Icons';

const STORAGE_KEY = 'cursor-calc-welcome-dismissed';

export function WelcomeModal() {
  const [show, setShow] = useState(() => {
    if (typeof window === 'undefined') {
      return false;
    }

    return !localStorage.getItem(STORAGE_KEY);
  });

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, '1');
    setShow(false);
  }

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 sm:p-8 shadow-xl">
        <div className="flex items-center gap-2 mb-3">
          <HandWaveIcon className="w-6 h-6 text-[#14120b]" />
          <h2 className="text-xl font-bold">Welcome to Cursor Cost Calculator</h2>
        </div>
        <p className="text-sm text-[#14120b]/70 mb-4">
          Budget mode estimates what a monthly spend ceiling gets you. Usage mode estimates total usage cost and out-of-pocket spend after plan coverage.
        </p>
        <p className="text-xs text-[#14120b]/50 mb-6">
          All rates come from Cursor's public docs, but this is an estimate — not a guarantee. Pricing can change at any time, and actual costs depend on your usage patterns. This tool is not affiliated with Cursor and is not responsible for any financial decisions.
        </p>
        <button
          onClick={dismiss}
          className="w-full bg-[#14120b] text-white rounded-xl py-3 text-sm font-semibold hover:bg-[#14120b]/90 transition-colors cursor-pointer"
        >
          Got it
        </button>
      </div>
    </div>
  );
}
