'use client';

export type AppMode = 'home' | 'studio' | 'guitar';

interface ModeSwitcherProps {
  mode: AppMode;
  onChange: (mode: AppMode) => void;
}

const MODES: { id: AppMode; label: string; accent: string }[] = [
  { id: 'studio', label: 'Studio', accent: '#00ffff' },
  { id: 'guitar', label: 'Guitar', accent: '#ff6b35' },
];

export function ModeSwitcher({ mode, onChange }: ModeSwitcherProps) {
  return (
    <div className="inline-flex items-center gap-1 rounded-lg border border-[#2a2a2a] bg-[#0a0a0a] p-1">
      {MODES.map((m) => {
        const active = mode === m.id;
        return (
          <button
            key={m.id}
            onClick={() => onChange(m.id)}
            className={`px-2.5 sm:px-3 py-1.5 text-xs sm:text-sm font-medium rounded-md transition-colors whitespace-nowrap ${
              active
                ? 'bg-[#1a1a1a] text-[#ededed]'
                : 'text-[#888] hover:text-[#ededed] hover:bg-[#141414]'
            }`}
            style={active ? { boxShadow: `inset 0 0 0 1px ${m.accent}55` } : undefined}
          >
            <span className="flex items-center gap-1.5">
              <span
                className="w-1.5 h-1.5 rounded-full shrink-0"
                style={{ background: active ? m.accent : '#444' }}
              />
              {m.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
