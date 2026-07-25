import React from 'react';
import InfoCard, { InfoRow } from '../components/InfoCard';

const AboutPage: React.FC = () => {
  return (
    <div className="space-y-5 max-w-3xl" data-testid="about-page">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded bg-accent-primary flex items-center justify-center text-white text-lg font-bold">L</div>
        <div>
          <h1 className="text-xl font-semibold">Live Deposit Monitor</h1>
          <p className="text-xs text-text-tertiary">Production-grade desktop monitoring system</p>
        </div>
      </div>

      <InfoCard title="Version Info">
        <InfoRow label="Application Version"><span className="font-mono">1.0.0</span></InfoRow>
        <InfoRow label="Build"><span className="font-mono">production</span></InfoRow>
        <InfoRow label="Electron"><span className="font-mono">28.3.3</span></InfoRow>
        <InfoRow label="Node (embedded)"><span className="font-mono">18.18.2</span></InfoRow>
        <InfoRow label="React"><span className="font-mono">18.2.0</span></InfoRow>
        <InfoRow label="Playwright"><span className="font-mono">1.42.0</span></InfoRow>
        <InfoRow label="Database Schema"><span className="font-mono">1</span></InfoRow>
      </InfoCard>

      <InfoCard title="Feature Highlights">
        <ul className="space-y-1.5 text-sm text-text-secondary">
          <li>• Read-only deposit transaction monitoring</li>
          <li>• Priority-based filter profiles (first-match-wins)</li>
          <li>• Adaptive pagination (Process Date comparison)</li>
          <li>• SHA-1 fingerprint deduplication</li>
          <li>• Two-stage duplicate detection</li>
          <li>• Google Sheets batch export</li>
          <li>• Persistent browser sessions</li>
          <li>• 24/7 continuous monitoring</li>
          <li>• Auto-recovery after crashes</li>
          <li>• System tray integration</li>
        </ul>
      </InfoCard>
    </div>
  );
};

export default AboutPage;
