import React from 'react';
import { CardIcon } from './CardIcons';

type Page = 'monitoring' | 'filters' | 'google' | 'settings' | 'logs' | 'about';

interface SidebarProps {
  currentPage: Page;
  onPageChange: (page: Page) => void;
}

interface NavItem { id: Page; label: string; icon: React.ReactNode; }
interface PlaceholderItem { id: string; label: string; icon: React.ReactNode; hint: string; }

const workspace: NavItem[] = [
  { id: 'monitoring', label: 'Monitoring',      icon: <CardIcon.monitoring /> },
  { id: 'filters',    label: 'Filter Profiles', icon: <CardIcon.filter />     },
  { id: 'google',     label: 'Google Sheets',   icon: <CardIcon.google />     },
  { id: 'settings',   label: 'Settings',        icon: <CardIcon.system />     },
  { id: 'logs',       label: 'Logs',            icon: <CardIcon.log />        },
  { id: 'about',      label: 'About',           icon: <CardIcon.timeline />   },
];

// Iteration 12 will implement Maintenance & Operations. We reserve the
// slot now so the sidebar geometry does not shift when it lands.
const systemPlaceholders: PlaceholderItem[] = [
  { id: 'maintenance', label: 'Maintenance', icon: <CardIcon.wrench />, hint: 'Coming in v1.1' },
];

const Sidebar: React.FC<SidebarProps> = ({ currentPage, onPageChange }) => {
  return (
    <aside className="w-52 bg-bg-secondary border-r border-border-color flex flex-col shrink-0">
      {/* -------- Identity block -------- */}
      <div className="px-3 pt-3 pb-2.5 border-b border-border-color">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-gradient-to-br from-accent-primary to-accent-strong flex items-center justify-center text-white text-[12px] font-bold shadow-sunken shrink-0">
            L
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[11px] uppercase tracking-[0.08em] font-semibold text-text-primary leading-tight">
              Live Deposit Monitor
            </div>
            <div className="text-[9.5px] text-text-tertiary leading-tight mt-[1px]">
              Production Monitoring Console
            </div>
          </div>
        </div>
        <div className="mt-2 flex items-center gap-1.5 text-[9.5px] font-mono">
          <span className="px-1.5 py-[1px] rounded border border-border-color text-text-secondary tabular-nums">
            v1.0.0
          </span>
          <span className="px-1.5 py-[1px] rounded border border-emerald-500/30 bg-emerald-500/8 text-emerald-300">
            PRODUCTION
          </span>
        </div>
      </div>

      {/* -------- Nav -------- */}
      <nav className="flex-1 p-1.5 overflow-y-auto">
        <div className="text-[9.5px] font-semibold uppercase tracking-[0.11em] text-text-muted px-2.5 pt-1 pb-1">
          Workspace
        </div>
        <ul className="space-y-[2px]">
          {workspace.map(item => {
            const active = currentPage === item.id;
            return (
              <li key={item.id}>
                <button
                  data-testid={`sidebar-${item.id}`}
                  aria-current={active ? 'page' : undefined}
                  onClick={() => onPageChange(item.id)}
                  className={`w-full h-[30px] pl-1 pr-2 flex items-center gap-2 rounded-md text-left text-[12.5px] transition-colors ${
                    active
                      ? 'bg-accent-subtle text-white'
                      : 'text-text-secondary hover:bg-white/[0.03] hover:text-text-primary'
                  }`}
                >
                  <span
                    className={`inline-block w-[2px] h-4 rounded-sm ${active ? 'bg-accent-primary' : 'bg-transparent'}`}
                  />
                  <span className={active ? 'text-accent-primary' : 'text-text-tertiary'}>{item.icon}</span>
                  <span className="font-medium truncate">{item.label}</span>
                </button>
              </li>
            );
          })}
        </ul>

        <div className="text-[9.5px] font-semibold uppercase tracking-[0.11em] text-text-muted px-2.5 pt-3 pb-1">
          System
        </div>
        <ul className="space-y-[2px]">
          {systemPlaceholders.map(item => (
            <li key={item.id}>
              <button
                disabled
                data-testid={`sidebar-${item.id}-placeholder`}
                className="w-full h-[30px] pl-1 pr-2 flex items-center gap-2 rounded-md text-left text-[12.5px] text-text-muted opacity-70 cursor-not-allowed"
                title={item.hint}
              >
                <span className="inline-block w-[2px] h-4 rounded-sm bg-transparent" />
                <span className="text-text-muted">{item.icon}</span>
                <span className="font-medium truncate">{item.label}</span>
                <span className="ml-auto text-[9px] uppercase tracking-wider px-1 py-[1px] rounded bg-white/[0.03] border border-border-color text-text-muted">
                  Soon
                </span>
              </button>
            </li>
          ))}
        </ul>
      </nav>

      {/* -------- Footer -------- */}
      <div className="px-3 py-2 border-t border-border-color text-[10px] text-text-muted flex items-center justify-between">
        <span>Electron 28</span>
        <span className="tabular-nums">Node 18.18.2</span>
      </div>
    </aside>
  );
};

export default Sidebar;
