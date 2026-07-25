import React from 'react';

type Page = 'monitoring' | 'filters' | 'google' | 'settings' | 'logs' | 'about';

interface SidebarProps {
  currentPage: Page;
  onPageChange: (page: Page) => void;
}

// Inline SVG icon set — no external deps, no emoji.
const I = {
  monitoring: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
      <path d="M3 3v18h18" /><path d="M7 15l4-4 3 3 5-6" />
    </svg>
  ),
  filters: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
      <path d="M4 5h16l-6 8v6l-4-2v-4L4 5z" />
    </svg>
  ),
  google: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
      <rect x="4" y="3" width="16" height="18" rx="2" /><path d="M8 8h8M8 12h8M8 16h5" />
    </svg>
  ),
  settings: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.35.14.67.35.94.62.27.27.48.6.62.94Z" />
    </svg>
  ),
  logs: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M8 13h8M8 17h8M8 9h2" />
    </svg>
  ),
  about: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
      <circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" />
    </svg>
  ),
};

const menuItems: { id: Page; label: string; icon: React.ReactNode }[] = [
  { id: 'monitoring', label: 'Monitoring',      icon: I.monitoring },
  { id: 'filters',    label: 'Filter Profiles', icon: I.filters    },
  { id: 'google',     label: 'Google Sheets',   icon: I.google     },
  { id: 'settings',   label: 'Settings',        icon: I.settings   },
  { id: 'logs',       label: 'Logs',            icon: I.logs       },
  { id: 'about',      label: 'About',           icon: I.about      },
];

const Sidebar: React.FC<SidebarProps> = ({ currentPage, onPageChange }) => {
  return (
    <aside className="w-52 bg-bg-secondary border-r border-border-color flex flex-col shrink-0">
      {/* Brand */}
      <div className="h-12 px-3 flex items-center gap-2 border-b border-border-color">
        <div className="w-6 h-6 rounded-md bg-gradient-to-br from-accent-primary to-accent-strong flex items-center justify-center text-white text-[11px] font-bold shadow-sunken">
          L
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[12.5px] font-semibold text-text-primary leading-tight truncate">Live Deposit Monitor</div>
          <div className="text-[10px] text-text-muted leading-tight">v1.0.0</div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-1.5 overflow-y-auto">
        <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-text-muted px-2.5 pt-1 pb-1">
          Workspace
        </div>
        <ul className="space-y-[2px]">
          {menuItems.map(item => {
            const active = currentPage === item.id;
            return (
              <li key={item.id}>
                <button
                  data-testid={`sidebar-${item.id}`}
                  aria-current={active ? 'page' : undefined}
                  onClick={() => onPageChange(item.id)}
                  className={`w-full h-[30px] px-2.5 flex items-center gap-2 rounded-md text-left text-[13px] transition-colors ${
                    active
                      ? 'bg-accent-subtle text-white'
                      : 'text-text-secondary hover:bg-white/[0.03] hover:text-text-primary'
                  }`}
                >
                  {/* Active indicator: 2-px vertical strip */}
                  <span
                    className={`inline-block w-[2px] h-4 rounded-sm ${active ? 'bg-accent-primary' : 'bg-transparent'}`}
                  />
                  <span className={active ? 'text-accent-primary' : 'text-text-tertiary'}>
                    {item.icon}
                  </span>
                  <span className="font-medium truncate">{item.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Footer */}
      <div className="px-3 py-2 border-t border-border-color text-[10px] text-text-muted flex items-center justify-between">
        <span>Production</span>
        <span className="tabular-nums">Electron 28</span>
      </div>
    </aside>
  );
};

export default Sidebar;
