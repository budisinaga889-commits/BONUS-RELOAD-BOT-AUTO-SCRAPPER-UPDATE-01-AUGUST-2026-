import React from 'react';

type Page = 'monitoring' | 'filters' | 'google' | 'settings' | 'logs' | 'about';

interface SidebarProps {
  currentPage: Page;
  onPageChange: (page: Page) => void;
}

// Simple inline SVG icon set — no external dependency, no emoji.
const Icon = {
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
  { id: 'monitoring', label: 'Monitoring',       icon: Icon.monitoring },
  { id: 'filters',    label: 'Filter Profiles',  icon: Icon.filters },
  { id: 'google',     label: 'Google Sheets',    icon: Icon.google },
  { id: 'settings',   label: 'Settings',         icon: Icon.settings },
  { id: 'logs',       label: 'Logs',             icon: Icon.logs },
  { id: 'about',      label: 'About',            icon: Icon.about },
];

const Sidebar: React.FC<SidebarProps> = ({ currentPage, onPageChange }) => {
  return (
    <aside className="w-56 bg-bg-secondary border-r border-border-color flex flex-col">
      <div className="px-4 py-4 border-b border-border-color">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-accent-primary flex items-center justify-center text-white text-xs font-bold">L</div>
          <div>
            <h1 className="text-sm font-semibold text-text-primary leading-tight">Live Deposit Monitor</h1>
            <p className="text-[10px] text-text-tertiary">v1.0.0</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-2 space-y-0.5">
        {menuItems.map(item => (
          <button
            key={item.id}
            data-testid={`sidebar-${item.id}`}
            onClick={() => onPageChange(item.id)}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded text-left transition-colors ${
              currentPage === item.id
                ? 'bg-accent-primary/15 text-accent-primary border border-accent-primary/30'
                : 'text-text-secondary hover:bg-bg-tertiary/60 hover:text-text-primary border border-transparent'
            }`}
          >
            <span>{item.icon}</span>
            <span className="text-sm font-medium">{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="p-3 border-t border-border-color text-[10px] text-text-tertiary">
        Production build • Electron 28
      </div>
    </aside>
  );
};

export default Sidebar;
