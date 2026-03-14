import type { ReactNode } from 'react';

interface CollapsibleProps {
  open: boolean;
  duration?: 200 | 300;
  children: ReactNode;
}

export function Collapsible({ open, duration = 200, children }: CollapsibleProps) {
  return (
    <div
      className={`grid transition-[grid-template-rows] ease-in-out ${
        open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
      } ${duration === 300 ? 'duration-300' : 'duration-200'}`}
    >
      <div className="overflow-hidden">
        {children}
      </div>
    </div>
  );
}
