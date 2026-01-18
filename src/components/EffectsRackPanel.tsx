'use client';

import { useState } from 'react';
import { Effect, EffectType, EffectParams, EFFECT_LABELS, DEFAULT_EFFECT_PARAMS } from '@/lib/audio-engine';

interface EffectsRackPanelProps {
  effects: Effect[];
  onAddEffect: (type: EffectType) => void;
  onRemoveEffect: (id: string) => void;
  onUpdateEffect: (id: string, params: Partial<EffectParams[EffectType]>) => void;
  onToggleEffect: (id: string, enabled: boolean) => void;
  onMoveEffect: (id: string, direction: 'up' | 'down') => void;
}

const EFFECT_COLORS: Record<EffectType, string> = {
  filter: '#ff6b35',
  distortion: '#ff4444',
  delay: '#00ffff',
  reverb: '#00ff88',
  chorus: '#9966ff',
  phaser: '#ff66cc',
  tremolo: '#ffcc00',
  bitcrusher: '#ff3366',
  compressor: '#66ccff',
  eq: '#99ff66',
  vibrato: '#ff9900',
  autowah: '#cc66ff',
};

const ALL_EFFECTS: EffectType[] = [
  'filter', 'distortion', 'delay', 'reverb', 'chorus', 
  'phaser', 'tremolo', 'bitcrusher', 'compressor', 'eq', 'vibrato', 'autowah'
];

export function EffectsRackPanel({
  effects,
  onAddEffect,
  onRemoveEffect,
  onUpdateEffect,
  onToggleEffect,
  onMoveEffect,
}: EffectsRackPanelProps) {
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [expandedEffects, setExpandedEffects] = useState<Set<string>>(new Set());

  const toggleExpanded = (id: string) => {
    setExpandedEffects(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleAddEffect = (type: EffectType) => {
    onAddEffect(type);
    setShowAddMenu(false);
  };

  return (
    <div className="bg-[#0a0a0a] rounded-lg border border-[#2a2a2a]">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-[#2a2a2a]">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-[#ededed]">Effects Chain</span>
          <span className="text-xs text-[#666] font-mono">{effects.length} active</span>
        </div>
        <div className="relative">
          <button
            onClick={() => setShowAddMenu(!showAddMenu)}
            className="w-7 h-7 rounded bg-[#00ffff] text-black font-bold text-lg hover:bg-[#00cccc] transition-colors flex items-center justify-center"
            title="Add effect"
          >
            +
          </button>
          
          {/* Add Effect Menu */}
          {showAddMenu && (
            <div className="absolute right-0 top-full mt-1 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg shadow-xl z-50 w-48 py-1 max-h-64 overflow-y-auto">
              {ALL_EFFECTS.map(type => (
                <button
                  key={type}
                  onClick={() => handleAddEffect(type)}
                  className="w-full px-3 py-2 text-left text-sm text-[#ededed] hover:bg-[#2a2a2a] transition-colors flex items-center gap-2"
                >
                  <span 
                    className="w-2 h-2 rounded-full" 
                    style={{ backgroundColor: EFFECT_COLORS[type] }}
                  />
                  {EFFECT_LABELS[type]}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Effects List */}
      <div className="p-2 space-y-2">
        {effects.length === 0 ? (
          <div className="text-center py-6 text-[#555] text-sm">
            No effects added. Click + to add an effect.
          </div>
        ) : (
          effects.map((effect, index) => (
            <EffectItem
              key={effect.id}
              effect={effect}
              index={index}
              totalCount={effects.length}
              color={EFFECT_COLORS[effect.type]}
              isExpanded={expandedEffects.has(effect.id)}
              onToggleExpanded={() => toggleExpanded(effect.id)}
              onRemove={() => onRemoveEffect(effect.id)}
              onUpdate={(params) => onUpdateEffect(effect.id, params)}
              onToggleEnabled={(enabled) => onToggleEffect(effect.id, enabled)}
              onMoveUp={() => onMoveEffect(effect.id, 'up')}
              onMoveDown={() => onMoveEffect(effect.id, 'down')}
            />
          ))
        )}
      </div>

      {/* Click away to close menu */}
      {showAddMenu && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={() => setShowAddMenu(false)} 
        />
      )}
    </div>
  );
}

interface EffectItemProps {
  effect: Effect;
  index: number;
  totalCount: number;
  color: string;
  isExpanded: boolean;
  onToggleExpanded: () => void;
  onRemove: () => void;
  onUpdate: (params: Partial<EffectParams[EffectType]>) => void;
  onToggleEnabled: (enabled: boolean) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

function EffectItem({
  effect,
  index,
  totalCount,
  color,
  isExpanded,
  onToggleExpanded,
  onRemove,
  onUpdate,
  onToggleEnabled,
  onMoveUp,
  onMoveDown,
}: EffectItemProps) {
  return (
    <div 
      className={`rounded border transition-colors ${
        effect.enabled 
          ? 'border-[#2a2a2a] bg-[#111]' 
          : 'border-[#1a1a1a] bg-[#0a0a0a] opacity-50'
      }`}
    >
      {/* Effect Header */}
      <div className="flex items-center gap-2 p-2">
        {/* Reorder buttons */}
        <div className="flex flex-col gap-0.5">
          <button
            onClick={onMoveUp}
            disabled={index === 0}
            className="w-4 h-3 text-[8px] text-[#666] hover:text-[#00ffff] disabled:opacity-30 disabled:hover:text-[#666]"
          >
            ▲
          </button>
          <button
            onClick={onMoveDown}
            disabled={index === totalCount - 1}
            className="w-4 h-3 text-[8px] text-[#666] hover:text-[#00ffff] disabled:opacity-30 disabled:hover:text-[#666]"
          >
            ▼
          </button>
        </div>

        {/* Enable toggle */}
        <button
          onClick={() => onToggleEnabled(!effect.enabled)}
          className={`w-5 h-5 rounded flex items-center justify-center text-xs transition-colors ${
            effect.enabled 
              ? 'bg-[#00ff88] text-black' 
              : 'bg-[#2a2a2a] text-[#666]'
          }`}
          title={effect.enabled ? 'Disable' : 'Enable'}
        >
          {effect.enabled ? '●' : '○'}
        </button>

        {/* Effect name */}
        <button
          onClick={onToggleExpanded}
          className="flex-1 flex items-center gap-2 text-left"
        >
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
          <span className="text-sm text-[#ededed] font-medium">{EFFECT_LABELS[effect.type]}</span>
          <span className="text-[10px] text-[#555]">{isExpanded ? '▼' : '▶'}</span>
        </button>

        {/* Remove button */}
        <button
          onClick={onRemove}
          className="w-5 h-5 rounded bg-[#2a2a2a] text-[#666] hover:bg-[#ff4444] hover:text-white text-xs transition-colors"
          title="Remove effect"
        >
          ×
        </button>
      </div>

      {/* Effect Parameters */}
      {isExpanded && (
        <div className="px-3 pb-3 pt-1 border-t border-[#1a1a1a]">
          <EffectControls effect={effect} onUpdate={onUpdate} color={color} />
        </div>
      )}
    </div>
  );
}

interface EffectControlsProps {
  effect: Effect;
  onUpdate: (params: Partial<EffectParams[EffectType]>) => void;
  color: string;
}

function EffectControls({ effect, onUpdate, color }: EffectControlsProps) {
  const SliderControl = ({ 
    label, 
    value, 
    min, 
    max, 
    step = 0.01, 
    onChange,
    format = (v: number) => v.toFixed(2),
    isLog = false,
  }: { 
    label: string; 
    value: number; 
    min: number; 
    max: number; 
    step?: number;
    onChange: (v: number) => void;
    format?: (v: number) => string;
    isLog?: boolean;
  }) => {
    const displayValue = isLog 
      ? Math.log10(value / min) / Math.log10(max / min)
      : (value - min) / (max - min);
    
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const sliderValue = parseFloat(e.target.value);
      if (isLog) {
        onChange(min * Math.pow(max / min, sliderValue));
      } else {
        onChange(min + sliderValue * (max - min));
      }
    };

    return (
      <div className="flex-1 min-w-[80px]">
        <div className="flex justify-between text-[10px] mb-1">
          <span className="text-[#666]">{label}</span>
          <span className="text-[#888] font-mono">{format(value)}</span>
        </div>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={displayValue}
          onChange={handleChange}
          className="w-full h-1"
          style={{ accentColor: color }}
        />
      </div>
    );
  };

  switch (effect.type) {
    case 'filter': {
      const p = effect.params as EffectParams['filter'];
      return (
        <div className="space-y-3">
          <div className="flex gap-2">
            {(['lowpass', 'highpass', 'bandpass'] as const).map(type => (
              <button
                key={type}
                onClick={() => onUpdate({ type })}
                className={`flex-1 py-1 text-xs rounded transition-colors ${
                  p.type === type
                    ? 'bg-[#ff6b35] text-black'
                    : 'bg-[#1a1a1a] text-[#888] hover:bg-[#2a2a2a]'
                }`}
              >
                {type.toUpperCase().slice(0, 3)}
              </button>
            ))}
          </div>
          <div className="flex gap-3">
            <SliderControl
              label="Frequency"
              value={p.frequency}
              min={20}
              max={20000}
              isLog
              onChange={(v) => onUpdate({ frequency: v })}
              format={(v) => v >= 1000 ? `${(v/1000).toFixed(1)}k` : `${Math.round(v)}`}
            />
            <SliderControl
              label="Resonance"
              value={p.resonance}
              min={0}
              max={20}
              onChange={(v) => onUpdate({ resonance: v })}
              format={(v) => v.toFixed(1)}
            />
          </div>
        </div>
      );
    }

    case 'distortion': {
      const p = effect.params as EffectParams['distortion'];
      return (
        <SliderControl
          label="Amount"
          value={p.amount}
          min={0}
          max={1}
          onChange={(v) => onUpdate({ amount: v })}
          format={(v) => `${Math.round(v * 100)}%`}
        />
      );
    }

    case 'delay': {
      const p = effect.params as EffectParams['delay'];
      return (
        <div className="flex gap-3">
          <SliderControl
            label="Time"
            value={p.time}
            min={0.01}
            max={1}
            onChange={(v) => onUpdate({ time: v })}
            format={(v) => `${Math.round(v * 1000)}ms`}
          />
          <SliderControl
            label="Feedback"
            value={p.feedback}
            min={0}
            max={0.95}
            onChange={(v) => onUpdate({ feedback: v })}
            format={(v) => `${Math.round(v * 100)}%`}
          />
          <SliderControl
            label="Mix"
            value={p.wet}
            min={0}
            max={1}
            onChange={(v) => onUpdate({ wet: v })}
            format={(v) => `${Math.round(v * 100)}%`}
          />
        </div>
      );
    }

    case 'reverb': {
      const p = effect.params as EffectParams['reverb'];
      return (
        <div className="flex gap-3">
          <SliderControl
            label="Decay"
            value={p.decay}
            min={0.1}
            max={10}
            onChange={(v) => onUpdate({ decay: v })}
            format={(v) => `${v.toFixed(1)}s`}
          />
          <SliderControl
            label="Mix"
            value={p.wet}
            min={0}
            max={1}
            onChange={(v) => onUpdate({ wet: v })}
            format={(v) => `${Math.round(v * 100)}%`}
          />
        </div>
      );
    }

    case 'chorus': {
      const p = effect.params as EffectParams['chorus'];
      return (
        <div className="flex gap-3">
          <SliderControl
            label="Rate"
            value={p.frequency}
            min={0.1}
            max={10}
            onChange={(v) => onUpdate({ frequency: v })}
            format={(v) => `${v.toFixed(1)}Hz`}
          />
          <SliderControl
            label="Depth"
            value={p.depth}
            min={0}
            max={1}
            onChange={(v) => onUpdate({ depth: v })}
            format={(v) => `${Math.round(v * 100)}%`}
          />
          <SliderControl
            label="Mix"
            value={p.wet}
            min={0}
            max={1}
            onChange={(v) => onUpdate({ wet: v })}
            format={(v) => `${Math.round(v * 100)}%`}
          />
        </div>
      );
    }

    case 'phaser': {
      const p = effect.params as EffectParams['phaser'];
      return (
        <div className="flex gap-3">
          <SliderControl
            label="Rate"
            value={p.frequency}
            min={0.1}
            max={10}
            onChange={(v) => onUpdate({ frequency: v })}
            format={(v) => `${v.toFixed(1)}Hz`}
          />
          <SliderControl
            label="Octaves"
            value={p.octaves}
            min={1}
            max={6}
            step={1}
            onChange={(v) => onUpdate({ octaves: Math.round(v) })}
            format={(v) => `${Math.round(v)}`}
          />
          <SliderControl
            label="Mix"
            value={p.wet}
            min={0}
            max={1}
            onChange={(v) => onUpdate({ wet: v })}
            format={(v) => `${Math.round(v * 100)}%`}
          />
        </div>
      );
    }

    case 'tremolo': {
      const p = effect.params as EffectParams['tremolo'];
      return (
        <div className="flex gap-3">
          <SliderControl
            label="Rate"
            value={p.frequency}
            min={0.5}
            max={20}
            onChange={(v) => onUpdate({ frequency: v })}
            format={(v) => `${v.toFixed(1)}Hz`}
          />
          <SliderControl
            label="Depth"
            value={p.depth}
            min={0}
            max={1}
            onChange={(v) => onUpdate({ depth: v })}
            format={(v) => `${Math.round(v * 100)}%`}
          />
          <SliderControl
            label="Mix"
            value={p.wet}
            min={0}
            max={1}
            onChange={(v) => onUpdate({ wet: v })}
            format={(v) => `${Math.round(v * 100)}%`}
          />
        </div>
      );
    }

    case 'bitcrusher': {
      const p = effect.params as EffectParams['bitcrusher'];
      return (
        <div className="flex gap-3">
          <SliderControl
            label="Bits"
            value={p.bits}
            min={1}
            max={16}
            step={1}
            onChange={(v) => onUpdate({ bits: Math.round(v) })}
            format={(v) => `${Math.round(v)} bit`}
          />
          <SliderControl
            label="Mix"
            value={p.wet}
            min={0}
            max={1}
            onChange={(v) => onUpdate({ wet: v })}
            format={(v) => `${Math.round(v * 100)}%`}
          />
        </div>
      );
    }

    case 'compressor': {
      const p = effect.params as EffectParams['compressor'];
      return (
        <div className="flex gap-2 flex-wrap">
          <SliderControl
            label="Threshold"
            value={p.threshold}
            min={-60}
            max={0}
            onChange={(v) => onUpdate({ threshold: v })}
            format={(v) => `${Math.round(v)}dB`}
          />
          <SliderControl
            label="Ratio"
            value={p.ratio}
            min={1}
            max={20}
            onChange={(v) => onUpdate({ ratio: v })}
            format={(v) => `${v.toFixed(1)}:1`}
          />
          <SliderControl
            label="Attack"
            value={p.attack}
            min={0.001}
            max={0.5}
            onChange={(v) => onUpdate({ attack: v })}
            format={(v) => `${Math.round(v * 1000)}ms`}
          />
          <SliderControl
            label="Release"
            value={p.release}
            min={0.01}
            max={1}
            onChange={(v) => onUpdate({ release: v })}
            format={(v) => `${Math.round(v * 1000)}ms`}
          />
        </div>
      );
    }

    case 'eq': {
      const p = effect.params as EffectParams['eq'];
      return (
        <div className="flex gap-3">
          <SliderControl
            label="Low"
            value={p.low}
            min={-12}
            max={12}
            onChange={(v) => onUpdate({ low: v })}
            format={(v) => `${v > 0 ? '+' : ''}${v.toFixed(1)}dB`}
          />
          <SliderControl
            label="Mid"
            value={p.mid}
            min={-12}
            max={12}
            onChange={(v) => onUpdate({ mid: v })}
            format={(v) => `${v > 0 ? '+' : ''}${v.toFixed(1)}dB`}
          />
          <SliderControl
            label="High"
            value={p.high}
            min={-12}
            max={12}
            onChange={(v) => onUpdate({ high: v })}
            format={(v) => `${v > 0 ? '+' : ''}${v.toFixed(1)}dB`}
          />
        </div>
      );
    }

    case 'vibrato': {
      const p = effect.params as EffectParams['vibrato'];
      return (
        <div className="flex gap-3">
          <SliderControl
            label="Rate"
            value={p.frequency}
            min={0.5}
            max={20}
            onChange={(v) => onUpdate({ frequency: v })}
            format={(v) => `${v.toFixed(1)}Hz`}
          />
          <SliderControl
            label="Depth"
            value={p.depth}
            min={0}
            max={1}
            onChange={(v) => onUpdate({ depth: v })}
            format={(v) => `${Math.round(v * 100)}%`}
          />
          <SliderControl
            label="Mix"
            value={p.wet}
            min={0}
            max={1}
            onChange={(v) => onUpdate({ wet: v })}
            format={(v) => `${Math.round(v * 100)}%`}
          />
        </div>
      );
    }

    case 'autowah': {
      const p = effect.params as EffectParams['autowah'];
      return (
        <div className="flex gap-2 flex-wrap">
          <SliderControl
            label="Base Freq"
            value={p.baseFrequency}
            min={20}
            max={2000}
            isLog
            onChange={(v) => onUpdate({ baseFrequency: v })}
            format={(v) => `${Math.round(v)}Hz`}
          />
          <SliderControl
            label="Octaves"
            value={p.octaves}
            min={1}
            max={8}
            step={1}
            onChange={(v) => onUpdate({ octaves: Math.round(v) })}
            format={(v) => `${Math.round(v)}`}
          />
          <SliderControl
            label="Sensitivity"
            value={p.sensitivity}
            min={-40}
            max={0}
            onChange={(v) => onUpdate({ sensitivity: v })}
            format={(v) => `${Math.round(v)}dB`}
          />
          <SliderControl
            label="Mix"
            value={p.wet}
            min={0}
            max={1}
            onChange={(v) => onUpdate({ wet: v })}
            format={(v) => `${Math.round(v * 100)}%`}
          />
        </div>
      );
    }

    default:
      return <div className="text-xs text-[#666]">No controls available</div>;
  }
}
