import React from 'react';

type Page = 'monitoring' | 'filters' | 'google' | 'settings' | 'logs' | 'about';

interface SidebarProps {
  currentPage: Page;
  onPageChange: (page: Page) => void;
}

const menuItems: { id: Page; label: string; icon: string }[] = [
  { id: 'monitoring', label: 'Monitoring', icon: '📊' },
  { id: 'filters', label: 'Filter Profiles', icon: '🎯' },
  { id: 'google', label: 'Google Sheets', icon: '📄' },
  { id: 'settings', label: 'Settings', icon: '⚙️' },
  { id: 'logs', label: 'Logs', icon: '📋' },
  { id: 'about', label: 'About', icon: 'ℹ️' },
];

const Sidebar: React.FC<SidebarProps> = ({ currentPage, onPageChange }) => {
  return (
    <aside className="w-56 bg-bg-secondary border-r border-border-color flex flex-col">
      <div className="p-4 border-b border-border-color">
        <h1 className="text-lg font-bold text-text-primary">Deposit Monitor</h1>
        <p className="text-xs text-text-tertiary mt-1">v1.0.0</p>
      </div>
      
      <nav className="flex-1 p-2">
        {menuItems.map(item => (
          <button
            key={item.id}
            data-testid={`sidebar-${item.id}`}
            onClick={() => onPageChange(item.id)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded text-left transition-colors ${
              currentPage === item.id
                ? 'bg-accent-primary text-white'
                : 'text-text-secondary hover:bg-bg-tertiary hover:text-text-primary'
            }`}
          >
            <span className="text-lg">{item.icon}</span>
            <span className="text-sm font-medium">{item.label}</span>
          </button>
        ))}
      </nav>
    </aside>
  );
};

export default Sidebar;
