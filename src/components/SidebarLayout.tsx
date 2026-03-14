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
  const [collapsed, setCollapsed] = useState(false);

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
      <div
        className={`hidden md:block fixed top-0 left-0 h-screen z-30 transition-all duration-200 ${
          collapsed ? 'w-12' : 'w-64'
        }`}
      >
        {collapsed ? (
          <div className="h-full bg-[#14120b] flex flex-col items-center py-4">
            <button
              onClick={() => setCollapsed(false)}
              className="p-2 text-white/60 hover:text-white rounded-lg hover:bg-white/10"
              aria-label="Expand navigation"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        ) : (
          <div className="h-full relative">
            <Sidebar activeTarget={activeTarget} onNavigate={handleNavigate} pricingDate={pricingDate} />
            <button
              onClick={() => setCollapsed(true)}
              className="absolute top-4 right-3 p-1 text-white/40 hover:text-white/70 rounded"
              aria-label="Collapse navigation"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7M18 19l-7-7 7-7" />
              </svg>
            </button>
          </div>
        )}
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
            className="relative w-64 h-full"
            role="dialog"
            aria-modal="true"
          >
            <Sidebar activeTarget={activeTarget} onNavigate={handleNavigate} pricingDate={pricingDate} />
          </div>
        </div>
      )}

      {/* Content area */}
      <main className={`pt-14 md:pt-0 transition-all duration-200 ${collapsed ? 'md:ml-12' : 'md:ml-64'}`}>
        <div className="max-w-2xl mx-auto px-4 py-8 sm:py-12">
          {children}
        </div>
      </main>
    </div>
  );
}
