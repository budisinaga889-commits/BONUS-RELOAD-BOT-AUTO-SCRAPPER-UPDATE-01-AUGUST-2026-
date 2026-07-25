import React from 'react';

/**
 * Compact info card — iteration 11.1 refinements:
 *   - Tighter padding (py-2 header, p-3 body) to fit more information above the fold
 *   - Subtle top-highlight on the card via `shadow-card` (1px inner rgba white 2%)
 *   - Header uses uppercase micro-caps for a professional operator-tool feel
 *   - No decorative shadows or blur
 */
interface InfoCardProps {
  title: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  testId?: string;
  children: React.ReactNode;
}

const InfoCard: React.FC<InfoCardProps> = ({
  title, icon, action, className, bodyClassName, testId, children
}) => {
  return (
    <section
      data-testid={testId}
      className={`bg-bg-secondary border border-border-color rounded-md shadow-card flex flex-col ${className || ''}`}
    >
      <header className="flex items-center justify-between px-3 h-8 border-b border-border-color/80">
        <div className="flex items-center gap-1.5">
          {icon && <span className="text-text-tertiary">{icon}</span>}
          <h3 className="text-[10.5px] uppercase tracking-[0.08em] font-semibold text-text-tertiary">
            {title}
          </h3>
        </div>
        {action}
      </header>
      <div className={`px-3 py-2.5 flex-1 ${bodyClassName || ''}`}>{children}</div>
    </section>
  );
};

/**
 * Single row inside a card: label on left, value on right.
 * Iteration 11.1: tighter, tabular numerals by default.
 */
export const InfoRow: React.FC<{ label: string; children: React.ReactNode; className?: string }> = ({
  label, children, className
}) => (
  <div className={`flex items-center justify-between py-[5px] text-[12.5px] ${className || ''}`}>
    <span className="text-text-secondary">{label}</span>
    <span className="text-text-primary text-right truncate max-w-[62%] text-tabular">{children}</span>
  </div>
);

export default InfoCard;
