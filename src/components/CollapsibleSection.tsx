'use client';

import { useState, ReactNode } from 'react';

interface CollapsibleSectionProps {
  title: string;
  defaultExpanded?: boolean;
  children: ReactNode;
  badge?: string;
}

export function CollapsibleSection({ title, defaultExpanded = true, children, badge }: CollapsibleSectionProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  return (
    <div className="bg-[#0a0a0a] rounded-lg border border-[#2a2a2a] overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-[#141414] transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className={`text-[#666] transition-transform ${isExpanded ? 'rotate-90' : ''}`}>
            ▶
          </span>
          <span className="text-sm font-medium text-[#ededed]">{title}</span>
          {badge && (
            <span className="text-[10px] text-[#666] bg-[#1a1a1a] px-1.5 py-0.5 rounded">
              {badge}
            </span>
          )}
        </div>
        <span className="text-[10px] text-[#555]">
          {isExpanded ? 'collapse' : 'expand'}
        </span>
      </button>
      {isExpanded && (
        <div className="border-t border-[#2a2a2a]">
          {children}
        </div>
      )}
    </div>
  );
}
