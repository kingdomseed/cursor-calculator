import { useCallback, useEffect, useState, type ReactNode } from 'react';
import type { NavigationTarget } from '../app/calculatorState';
import { Sidebar } from './Sidebar';

interface Props {
  activeTarget: NavigationTarget;
  onNavigate: (target: NavigationTarget) => void;
  pricingDate: string;
  children: ReactNode;
}

export function SidebarLayout({ activeTarget, onNavigate, pricingDate, children }: Props) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleNavigate = useCallback((target: NavigationTarget) => {
    onNavigate(target);
    setMobileOpen(false);
  }, [onNavigate]);

  useEffect(() => {
    if (!mobileOpen) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileOpen(false);
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [mobileOpen]);

  return (
    <div className="min-h-screen bg-[#f7f7f4] text-[#14120b]">
      {/* Desktop sidebar */}
      <div className="hidden md:block fixed top-0 left-0 w-52 h-screen z-30">
        <Sidebar activeTarget={activeTarget} onNavigate={handleNavigate} pricingDate={pricingDate} />
      </div>

      {/* Mobile hamburger */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-20 bg-white border-b border-[#e0e0d8] px-4 py-3">
        <button
          onClick={() => setMobileOpen(true)}
          className="p-1"
          aria-label="Open navigation"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-40">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileOpen(false)}
          />
          <div
            className="relative w-52 h-full"
            role="dialog"
            aria-modal="true"
          >
            <Sidebar activeTarget={activeTarget} onNavigate={handleNavigate} pricingDate={pricingDate} />
          </div>
        </div>
      )}

      {/* Content area */}
      <main className="md:ml-52 pt-14 md:pt-0">
        <div className="max-w-2xl mx-auto px-4 py-8 sm:py-12">
          {children}
        </div>
      </main>
    </div>
  );
}
