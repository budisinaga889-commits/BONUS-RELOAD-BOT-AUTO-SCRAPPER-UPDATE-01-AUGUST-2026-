import React from 'react';

/**
 * Professional status badge used across the app.
 * Consistent color mapping (per Iteration 11 spec):
 *   🟢 running / connected / ok    → success
 *   🟡 waiting / warn / paused     → warning
 *   🔵 processing / info           → info
 *   🔴 error / disconnected        → error
 *   ⚪ stopped / idle / neutral    → neutral
 */
export type BadgeTone = 'success' | 'warning' | 'info' | 'error' | 'neutral';

interface StatusBadgeProps {
  tone: BadgeTone;
  label: string;
  size?: 'sm' | 'md';
  testId?: string;
  className?: string;
}

const toneStyle: Record<BadgeTone, { dot: string; text: string; bg: string; border: string }> = {
  success: { dot: 'bg-emerald-500', text: 'text-emerald-300',  bg: 'bg-emerald-500/10',  border: 'border-emerald-500/30' },
  warning: { dot: 'bg-amber-400',   text: 'text-amber-300',    bg: 'bg-amber-500/10',    border: 'border-amber-500/30'   },
  info:    { dot: 'bg-blue-500',    text: 'text-blue-300',     bg: 'bg-blue-500/10',     border: 'border-blue-500/30'    },
  error:   { dot: 'bg-red-500',     text: 'text-red-300',      bg: 'bg-red-500/10',      border: 'border-red-500/30'     },
  neutral: { dot: 'bg-gray-400',    text: 'text-text-secondary', bg: 'bg-gray-500/10',   border: 'border-gray-500/30'    },
};

const StatusBadge: React.FC<StatusBadgeProps> = ({ tone, label, size = 'md', testId, className }) => {
  const t = toneStyle[tone];
  const padding = size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs';
  const dotSize = size === 'sm' ? 'w-1.5 h-1.5' : 'w-2 h-2';
  return (
    <span
      data-testid={testId}
      className={`inline-flex items-center gap-1.5 rounded-full border ${t.bg} ${t.border} ${t.text} ${padding} font-medium tracking-wide ${className || ''}`}
    >
      <span className={`${dotSize} rounded-full ${t.dot}`} />
      <span>{label}</span>
    </span>
  );
};

export default StatusBadge;
