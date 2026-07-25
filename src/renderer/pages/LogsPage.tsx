import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLiveLogs } from '../hooks/useLiveLogs';

type LevelFilter = 'ALL' | 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR' | 'DEBUG';

const LogsPage: React.FC = () => {
  const [logs, clearLocal] = useLiveLogs(1000);
  const [filter, setFilter] = useState<LevelFilter>('ALL');
  const [autoScroll, setAutoScroll] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  
  const filteredLogs = useMemo(
    () => (filter === 'ALL' ? logs : logs.filter((l) => l.level === filter)),
    [logs, filter]
  );
  
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [filteredLogs, autoScroll]);
  
  const getLevelColor = (level: string) => {
    switch (level) {
      case 'ERROR': return 'text-accent-error';
      case 'WARNING': return 'text-accent-warning';
      case 'SUCCESS': return 'text-accent-success';
      case 'INFO': return 'text-text-primary';
      case 'DEBUG': return 'text-text-tertiary';
      default: return 'text-text-secondary';
    }
  };
  
  return (
    <div className="space-y-4 h-full flex flex-col" data-testid="logs-page">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Logs</h1>
        <div className="flex gap-2 items-center">
          <select
            data-testid="log-level-filter"
            value={filter}
            onChange={(e) => setFilter(e.target.value as LevelFilter)}
          >
            <option value="ALL">All Levels</option>
            <option value="INFO">Info</option>
            <option value="SUCCESS">Success</option>
            <option value="WARNING">Warning</option>
            <option value="ERROR">Error</option>
            <option value="DEBUG">Debug</option>
          </select>
          
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              data-testid="logs-autoscroll-checkbox"
              checked={autoScroll}
              onChange={(e) => setAutoScroll(e.target.checked)}
            />
            Auto-scroll
          </label>
          
          <button
            data-testid="logs-clear-btn"
            onClick={clearLocal}
            className="px-3 py-1 bg-bg-tertiary rounded hover:bg-gray-700 text-sm"
          >
            Clear
          </button>
        </div>
      </div>
      
      <div className="flex-1 bg-bg-secondary rounded-lg border border-border-color overflow-hidden flex flex-col">
        <div className="p-2 border-b border-border-color bg-bg-tertiary text-xs font-semibold flex gap-4">
          <div className="w-40">Time</div>
          <div className="w-20">Level</div>
          <div className="w-32">Module</div>
          <div className="flex-1">Message</div>
        </div>
        
        <div
          ref={scrollRef}
          className="flex-1 overflow-auto p-2 font-mono text-xs"
          data-testid="logs-container"
        >
          {filteredLogs.length === 0 ? (
            <div className="text-center py-8 text-text-tertiary">
              No logs to display. Logs will appear here when monitoring runs.
            </div>
          ) : (
            filteredLogs.map((log, i) => (
              <div key={i} className="flex gap-4 py-1 hover:bg-bg-tertiary" data-testid="log-row">
                <div className="w-40 text-text-tertiary">
                  {new Date(log.timestamp).toLocaleTimeString()}
                </div>
                <div className={`w-20 font-semibold ${getLevelColor(log.level)}`} data-testid="log-level">
                  {log.level}
                </div>
                <div className="w-32 text-text-secondary">{log.module}</div>
                <div className="flex-1 whitespace-pre-wrap break-words" data-testid="log-message">
                  {log.message}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default LogsPage;
