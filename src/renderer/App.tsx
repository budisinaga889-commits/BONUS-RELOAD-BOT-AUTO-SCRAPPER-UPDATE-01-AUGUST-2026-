import React, { useEffect, useState } from 'react';
import { Toaster } from 'react-hot-toast';
import Sidebar from './components/Sidebar';
import StatusBar from './components/StatusBar';
import MonitoringPage from './pages/MonitoringPage';
import FilterProfilesPage from './pages/FilterProfilesPage';
import GoogleSheetsPage from './pages/GoogleSheetsPage';
import SettingsPage from './pages/SettingsPage';
import LogsPage from './pages/LogsPage';
import AboutPage from './pages/AboutPage';
import { useMonitoringStore } from './store/monitoring-store';

type Page = 'monitoring' | 'filters' | 'google' | 'settings' | 'logs' | 'about';

const App: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<Page>('monitoring');
  const { setMonitoringState, setExportStats } = useMonitoringStore();
  
  useEffect(() => {
    // Set up IPC event listeners
    if (window.electron) {
      window.electron.onStateChange((state) => {
        setMonitoringState(state as any);
      });
      
      window.electron.onStatsUpdate((stats) => {
        setExportStats(stats);
      });
    }
  }, []);
  
  const renderPage = () => {
    switch (currentPage) {
      case 'monitoring': return <MonitoringPage />;
      case 'filters': return <FilterProfilesPage />;
      case 'google': return <GoogleSheetsPage />;
      case 'settings': return <SettingsPage />;
      case 'logs': return <LogsPage />;
      case 'about': return <AboutPage />;
      default: return <MonitoringPage />;
    }
  };
  
  return (
    <div className="flex flex-col h-screen bg-bg-primary text-text-primary">
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3000,
          style: {
            background: '#242424',
            color: '#e0e0e0',
            border: '1px solid #333333'
          }
        }}
      />
      
      <div className="flex flex-1 overflow-hidden">
        <Sidebar currentPage={currentPage} onPageChange={setCurrentPage} />
        <main className="flex-1 overflow-auto p-6">
          {renderPage()}
        </main>
      </div>
      
      <StatusBar />
    </div>
  );
};

export default App;
