import React, { useEffect, useState } from 'react';
import { useMonitoringStore } from '../store/monitoring-store';
import StatusBadge, { BadgeTone } from './StatusBadge';

const stateTone = (state: string, isMonitoring: boolean): { tone: BadgeTone; label: string } => {
  if (!isMonitoring) return { tone: 'neutral', label: 'Stopped' };
  switch (state) {
    case 'IDLE':                return { tone: 'neutral', label: 'Idle' };
    case 'SLEEPING':            return { tone: 'warning', label: 'Waiting' };
    case 'ERROR':               return { tone: 'error',   label: 'Error' };
    case 'PAUSED':              return { tone: 'warning', label: 'Paused' };
    default:                    return { tone: 'info',    label: 'Processing' };
  }
};

const StatusBar: React.FC = () => {
  const { monitoringState, isMonitoring, browserConnected, googleConnected, sqliteReady } = useMonitoringStore();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [memoryUsage, setMemoryUsage] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
      if (typeof performance !== 'undefined' && (performance as any).memory) {
        const memMB = Math.round((performance as any).memory.usedJSHeapSize / 1048576);
        setMemoryUsage(memMB);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const state = stateTone(monitoringState, isMonitoring);

  return (
    <div className="h-8 bg-bg-secondary border-t border-border-color px-3 flex items-center justify-between text-[11px] text-text-secondary">
      <div className="flex items-center gap-3">
        <span data-testid="status-time" className="font-mono tabular-nums">
          {currentTime.toLocaleTimeString([], { hour12: false })}
        </span>
        <span className="flex items-center gap-1.5" data-testid="status-monitoring">
          <StatusBadge tone={state.tone} label={state.label} size="sm" />
          <span className="text-text-tertiary font-mono">{monitoringState}</span>
        </span>
        <span className="flex items-center gap-1.5" data-testid="status-browser">
          Browser <StatusBadge tone={browserConnected ? 'success' : 'neutral'} label={browserConnected ? 'On' : 'Off'} size="sm" />
        </span>
        <span className="flex items-center gap-1.5" data-testid="status-google">
          Google <StatusBadge tone={googleConnected ? 'success' : 'neutral'} label={googleConnected ? 'On' : 'Off'} size="sm" />
        </span>
        <span className="flex items-center gap-1.5" data-testid="status-sqlite-bar">
          SQLite <StatusBadge tone={sqliteReady ? 'success' : 'error'} label={sqliteReady ? 'OK' : 'Fail'} size="sm" />
        </span>
      </div>
      <div className="flex items-center gap-4">
        <span data-testid="status-memory" className="font-mono tabular-nums">Memory {memoryUsage} MB</span>
      </div>
    </div>
  );
};

export default StatusBar;
