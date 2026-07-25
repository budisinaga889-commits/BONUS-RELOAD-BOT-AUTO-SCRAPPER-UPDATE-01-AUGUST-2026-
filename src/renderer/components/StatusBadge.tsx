import React from 'react';

/**
 * Professional status badge — refined for iteration 11.1.
 *
 * Design tokens:
 *   - 1-px solid dot on left, semantic color
 *   - subtle tinted background (10% alpha), 30% alpha border
 *   - tabular numerals so "3/17" style values don't shift width
 *   - two sizes: sm (11px) and md (12px)
 *
 * Semantic tones (matching iteration 11 spec):
 *   🟢 success  — running / connected / ok
 *   🟡 warning  — waiting / paused
 *   🔵 info     — processing
 *   🔴 error    — disconnected / fail
 *   ⚪ neutral  — stopped / idle
 */
export type BadgeTone = 'success' | 'warning' | 'info' | 'error' | 'neutral';

interface StatusBadgeProps {
  tone: BadgeTone;
  label: string;
  size?: 'sm' | 'md';
  testId?: string;
  className?: string;
  /** Suppress the dot for spots that already have a leading icon. */
  hideDot?: boolean;
}

const toneStyle: Record<BadgeTone, { dot: string; text: string; bg: string; border: string }> = {
  success: { dot: 'bg-emerald-400', text: 'text-emerald-300', bg: 'bg-emerald-500/10', border: 'border-emerald-500/25' },
  warning: { dot: 'bg-amber-400',   text: 'text-amber-300',   bg: 'bg-amber-500/10',   border: 'border-amber-500/25'   },
  info:    { dot: 'bg-sky-400',     text: 'text-sky-300',     bg: 'bg-sky-500/10',     border: 'border-sky-500/25'     },
  error:   { dot: 'bg-rose-400',    text: 'text-rose-300',    bg: 'bg-rose-500/10',    border: 'border-rose-500/25'    },
  neutral: { dot: 'bg-gray-500',    text: 'text-gray-300',    bg: 'bg-white/[0.04]',   border: 'border-white/10'       },
};

const StatusBadge: React.FC<StatusBadgeProps> = ({ tone, label, size = 'md', testId, className, hideDot }) => {
  const t = toneStyle[tone];
  const isSm = size === 'sm';
  const padding = isSm ? 'px-1.5 py-[1px] text-[10.5px]' : 'px-2 py-[2px] text-[11.5px]';
  const dot     = isSm ? 'w-1 h-1' : 'w-1.5 h-1.5';
  return (
    <span
      data-testid={testId}
      className={`inline-flex items-center gap-1.5 rounded-full border ${t.bg} ${t.border} ${t.text} ${padding} font-medium tracking-wide text-tabular ${className || ''}`}
    >
      {!hideDot && <span className={`${dot} rounded-full ${t.dot}`} />}
      <span>{label}</span>
    </span>
  );
};

export default StatusBadge;
