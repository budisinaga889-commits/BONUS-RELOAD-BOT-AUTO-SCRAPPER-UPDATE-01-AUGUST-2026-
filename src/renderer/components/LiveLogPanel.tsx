import React, { useEffect, useRef } from 'react';
import { useLiveLogs } from '../hooks/useLiveLogs';

interface LiveLogPanelProps {
  /** How many recent lines to keep in the dashboard tail. */
  maxEntries?: number;
  /** Max panel height in px (scrolls inside). */
  height?: number;
}

/**
 * Compact live-log tail shown on the Monitoring Dashboard.
 * Auto-scrolls to the newest entry. For deep inspection users can jump to the
 * dedicated Logs page.
 */
const LiveLogPanel: React.FC<LiveLogPanelProps> = ({ maxEntries = 200, height = 260 }) => {
  const [logs] = useLiveLogs(maxEntries);
  const scrollRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);
  
  const levelClass = (level: string) => {
    switch (level) {
      case 'ERROR':   return 'text-accent-error';
      case 'WARNING': return 'text-accent-warning';
      case 'SUCCESS': return 'text-accent-success';
      case 'DEBUG':   return 'text-text-tertiary';
      default:        return 'text-text-primary';
    }
  };
  
  return (
    <section
      className="bg-bg-secondary rounded-lg p-6 border border-border-color"
      data-testid="live-log-panel"
    >
      <div className="flex justify-between items-center mb-3">
        <h2 className="text-lg font-semibold">Live Log</h2>
        <span className="text-xs text-text-tertiary" data-testid="live-log-count">
          {logs.length} entries
        </span>
      </div>
      
      <div
        ref={scrollRef}
        className="font-mono text-xs bg-bg-tertiary rounded p-3 overflow-auto border border-border-color"
        style={{ height }}
        data-testid="live-log-scroll"
      >
        {logs.length === 0 ? (
          <div className="text-text-tertiary italic">Waiting for log entries…</div>
        ) : (
          logs.map((log, i) => (
            <div key={i} className="flex gap-2 py-0.5" data-testid="live-log-row">
              <span className="text-text-tertiary shrink-0">
                {new Date(log.timestamp).toLocaleTimeString()}
              </span>
              <span className={`shrink-0 font-semibold w-16 ${levelClass(log.level)}`}>
                {log.level}
              </span>
              <span className="whitespace-pre-wrap break-words">{log.message}</span>
            </div>
          ))
        )}
      </div>
    </section>
  );
};

export default LiveLogPanel;
