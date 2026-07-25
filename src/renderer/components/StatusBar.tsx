import React, { useEffect, useState } from 'react';
import { useMonitoringStore } from '../store/monitoring-store';
import StatusBadge, { BadgeTone } from './StatusBadge';

const stateTone = (state: string, isMonitoring: boolean): { tone: BadgeTone; label: string } => {
  if (!isMonitoring) return { tone: 'neutral', label: 'Stopped' };
  switch (state) {
    case 'IDLE':     return { tone: 'neutral', label: 'Idle' };
    case 'SLEEPING': return { tone: 'warning', label: 'Waiting' };
    case 'ERROR':    return { tone: 'error',   label: 'Error' };
    case 'PAUSED':   return { tone: 'warning', label: 'Paused' };
    default:         return { tone: 'info',    label: 'Processing' };
  }
};

const StatusBar: React.FC = () => {
  const { monitoringState, isMonitoring, browserConnected, googleConnected, sqliteReady } = useMonitoringStore();
  const [now, setNow] = useState(new Date());
  const [memMB, setMemMB] = useState(0);

  useEffect(() => {
    const t = setInterval(() => {
      setNow(new Date());
      const perf: any = performance as any;
      if (perf && perf.memory) setMemMB(Math.round(perf.memory.usedJSHeapSize / 1048576));
    }, 1000);
    return () => clearInterval(t);
  }, []);

  const state = stateTone(monitoringState, isMonitoring);

  const separator = <span className="w-px h-3 bg-border-color mx-1.5" />;

  return (
    <div className="h-7 bg-bg-secondary border-t border-border-color px-3 flex items-center justify-between text-[11px] text-text-secondary select-none">
      <div className="flex items-center gap-1.5">
        <span data-testid="status-time" className="font-mono tabular-nums text-text-tertiary">
          {now.toLocaleTimeString([], { hour12: false })}
        </span>
        {separator}
        <span className="flex items-center gap-1.5" data-testid="status-monitoring">
          <StatusBadge tone={state.tone} label={state.label} size="sm" />
          <span className="text-text-muted font-mono">{monitoringState}</span>
        </span>
        {separator}
        <span className="flex items-center gap-1" data-testid="status-browser">
          <span className="text-text-tertiary">Browser</span>
          <StatusBadge tone={browserConnected ? 'success' : 'neutral'} label={browserConnected ? 'On' : 'Off'} size="sm" />
        </span>
        <span className="flex items-center gap-1" data-testid="status-google">
          <span className="text-text-tertiary">Google</span>
          <StatusBadge tone={googleConnected ? 'success' : 'neutral'} label={googleConnected ? 'On' : 'Off'} size="sm" />
        </span>
        <span className="flex items-center gap-1" data-testid="status-sqlite-bar">
          <span className="text-text-tertiary">SQLite</span>
          <StatusBadge tone={sqliteReady ? 'success' : 'error'} label={sqliteReady ? 'OK' : 'Fail'} size="sm" />
        </span>
      </div>
      <div className="flex items-center gap-3">
        <span data-testid="status-memory" className="font-mono tabular-nums text-text-tertiary">
          {memMB} MB
        </span>
      </div>
    </div>
  );
};

export default StatusBar;
