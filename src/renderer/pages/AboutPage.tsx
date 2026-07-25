import React from 'react';

const AboutPage: React.FC = () => {
  return (
    <div className="space-y-6" data-testid="about-page">
      <h1 className="text-2xl font-bold">About</h1>
      
      <section className="bg-bg-secondary rounded-lg p-6 border border-border-color">
        <div className="text-center mb-6">
          <h2 className="text-3xl font-bold mb-2">Live Deposit Monitor</h2>
          <p className="text-text-secondary">Production-Grade Desktop Monitoring System</p>
        </div>
        
        <div className="space-y-3">
          <div className="flex justify-between border-b border-border-color pb-2">
            <span className="text-text-secondary">Application Version</span>
            <span className="font-mono">1.0.0</span>
          </div>
          <div className="flex justify-between border-b border-border-color pb-2">
            <span className="text-text-secondary">Build Version</span>
            <span className="font-mono">production</span>
          </div>
          <div className="flex justify-between border-b border-border-color pb-2">
            <span className="text-text-secondary">Electron Version</span>
            <span className="font-mono">28.2.0</span>
          </div>
          <div className="flex justify-between border-b border-border-color pb-2">
            <span className="text-text-secondary">Node Version</span>
            <span className="font-mono">20.x</span>
          </div>
          <div className="flex justify-between border-b border-border-color pb-2">
            <span className="text-text-secondary">React Version</span>
            <span className="font-mono">18.2.0</span>
          </div>
          <div className="flex justify-between border-b border-border-color pb-2">
            <span className="text-text-secondary">Playwright Version</span>
            <span className="font-mono">1.42.0</span>
          </div>
          <div className="flex justify-between border-b border-border-color pb-2">
            <span className="text-text-secondary">Database Schema Version</span>
            <span className="font-mono">1</span>
          </div>
        </div>
      </section>
      
      <section className="bg-bg-secondary rounded-lg p-6 border border-border-color">
        <h3 className="text-lg font-semibold mb-3">Features</h3>
        <ul className="space-y-2 text-sm text-text-secondary">
          <li>✅ Read-only deposit transaction monitoring</li>
          <li>✅ Priority-based filter profiles (first-match-wins)</li>
          <li>✅ Adaptive pagination (Process Date comparison)</li>
          <li>✅ SHA-1 fingerprint deduplication</li>
          <li>✅ Two-stage duplicate detection</li>
          <li>✅ Google Sheets batch export</li>
          <li>✅ Persistent browser sessions</li>
          <li>✅ 24/7 continuous monitoring</li>
          <li>✅ Auto-recovery after crashes</li>
          <li>✅ System tray integration</li>
        </ul>
      </section>
    </div>
  );
};

export default AboutPage;
