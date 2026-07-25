import React from 'react';

/**
 * Compact information card used across the operator dashboard.
 *
 * Consistent header + body layout. No behaviour — purely presentational.
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
      className={`bg-bg-secondary border border-border-color rounded-md flex flex-col ${className || ''}`}
    >
      <header className="flex items-center justify-between px-4 py-2.5 border-b border-border-color">
        <div className="flex items-center gap-2">
          {icon && <span className="text-text-secondary">{icon}</span>}
          <h3 className="text-xs uppercase tracking-wider font-semibold text-text-secondary">{title}</h3>
        </div>
        {action}
      </header>
      <div className={`p-4 flex-1 ${bodyClassName || ''}`}>{children}</div>
    </section>
  );
};

/**
 * Consistent single-row inside a card: `Label ................ Value`.
 */
export const InfoRow: React.FC<{ label: string; children: React.ReactNode; className?: string }> = ({
  label, children, className
}) => (
  <div className={`flex items-center justify-between py-1.5 text-sm ${className || ''}`}>
    <span className="text-text-secondary">{label}</span>
    <span className="text-text-primary text-right truncate max-w-[60%]">{children}</span>
  </div>
);

export default InfoCard;
