import React from 'react';

/**
 * HeroStat — big-value / small-label metric cell used in numeric
 * KPI cards (Export Statistics, SQLite). Reverses the label/value
 * hierarchy so numbers get scanning priority.
 *
 *   24,708
 *   TODAY'S EXPORT
 *
 * Tokenized sizes: value 20px mono tabular, label 10px uppercase
 * tracked. Row height ~30 px so 5 rows fit in a compact card.
 */
interface HeroStatProps {
  value: React.ReactNode;
  label: string;
  tone?: 'default' | 'success' | 'warning' | 'error' | 'muted';
  testId?: string;
}

const toneClass: Record<NonNullable<HeroStatProps['tone']>, string> = {
  default: 'text-text-primary',
  success: 'text-emerald-300',
  warning: 'text-amber-300',
  error:   'text-rose-300',
  muted:   'text-text-tertiary',
};

const HeroStat: React.FC<HeroStatProps> = ({ value, label, tone = 'default', testId }) => (
  <div className="py-[3px]" data-testid={testId}>
    <div className={`text-[19px] leading-[22px] text-kpi font-medium ${toneClass[tone]}`}>{value}</div>
    <div className="text-[9.5px] leading-3 uppercase tracking-[0.09em] text-text-muted mt-[1px]">{label}</div>
  </div>
);

export default HeroStat;
