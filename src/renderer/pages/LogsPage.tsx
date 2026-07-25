import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLiveLogs } from '../hooks/useLiveLogs';

type LevelFilter = 'ALL' | 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR' | 'DEBUG';

const LogsPage: React.FC = () => {
  const [logs, clearLocal] = useLiveLogs(2000);
  const [filter, setFilter] = useState<LevelFilter>('ALL');
  const [query, setQuery] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);
  const [paused, setPaused] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const filteredLogs = useMemo(() => {
    const q = query.trim().toLowerCase();
    return logs.filter(l => {
      if (filter !== 'ALL' && l.level !== filter) return false;
      if (!q) return true;
      return (l.message || '').toLowerCase().includes(q)
        || (l.module || '').toLowerCase().includes(q)
        || (l.level || '').toLowerCase().includes(q);
    });
  }, [logs, filter, query]);

  useEffect(() => {
    if (autoScroll && !paused && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [filteredLogs, autoScroll, paused]);

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'ERROR':   return 'text-red-400';
      case 'WARNING': return 'text-amber-400';
      case 'SUCCESS': return 'text-emerald-400';
      case 'INFO':    return 'text-text-primary';
      case 'DEBUG':   return 'text-text-tertiary';
      default:        return 'text-text-secondary';
    }
  };

  const handleCopy = async () => {
    const text = filteredLogs.map(l =>
      `${new Date(l.timestamp).toLocaleTimeString()}  ${l.level.padEnd(7)}  ${l.module}  ${l.message}`
    ).join('\n');
    try { await navigator.clipboard.writeText(text); } catch { /* ignore */ }
  };

  const jumpToBottom = () => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  };

  return (
    <div className="space-y-3 h-full flex flex-col" data-testid="logs-page">
      <div className="flex justify-between items-center">
        <h1 className="text-xl font-semibold">Logs</h1>
        <span className="text-xs text-text-tertiary">
          Showing <span data-testid="logs-visible-count">{filteredLogs.length}</span> of {logs.length}
        </span>
      </div>

      <div className="bg-bg-secondary border border-border-color rounded-md flex flex-col flex-1 overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 px-3 py-2 border-b border-border-color">
          <select
            data-testid="log-level-filter"
            value={filter}
            onChange={(e) => setFilter(e.target.value as LevelFilter)}
            className="h-8 text-sm px-2"
          >
            <option value="ALL">All Levels</option>
            <option value="INFO">Info</option>
            <option value="SUCCESS">Success</option>
            <option value="WARNING">Warning</option>
            <option value="ERROR">Error</option>
            <option value="DEBUG">Debug</option>
          </select>
          <input
            data-testid="logs-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search message, module, level…"
            className="flex-1 h-8 text-sm px-2 min-w-[180px]"
          />
          <label className="flex items-center gap-1 text-xs text-text-secondary" title="Auto-scroll to newest">
            <input
              type="checkbox"
              data-testid="logs-autoscroll-checkbox"
              checked={autoScroll}
              onChange={(e) => setAutoScroll(e.target.checked)}
              className="h-3.5 w-3.5"
            />
            Auto-scroll
          </label>
          <button
            data-testid="logs-pause-btn"
            onClick={() => setPaused(p => !p)}
            className={`h-8 px-3 text-xs rounded border ${paused ? 'bg-amber-500/10 border-amber-500/40 text-amber-300' : 'bg-bg-tertiary border-border-color text-text-secondary hover:text-text-primary'}`}
          >
            {paused ? 'Paused' : 'Live'}
          </button>
          <button
            data-testid="logs-copy-btn"
            onClick={handleCopy}
            className="h-8 px-3 text-xs rounded bg-bg-tertiary border border-border-color text-text-secondary hover:text-text-primary"
          >
            Copy Selection
          </button>
          <button
            data-testid="logs-jump-btn"
            onClick={jumpToBottom}
            className="h-8 px-3 text-xs rounded bg-bg-tertiary border border-border-color text-text-secondary hover:text-text-primary"
          >
            Jump to Bottom
          </button>
          <button
            data-testid="logs-clear-btn"
            onClick={clearLocal}
            className="h-8 px-3 text-xs rounded bg-bg-tertiary border border-border-color text-text-secondary hover:text-text-primary"
            title="Clear the local buffer (does not affect log files)"
          >
            Clear
          </button>
        </div>

        <div className="px-3 py-1.5 border-b border-border-color bg-bg-tertiary text-[11px] font-semibold flex gap-4 text-text-secondary">
          <div className="w-32">Time</div>
          <div className="w-16">Level</div>
          <div className="w-32">Module</div>
          <div className="flex-1">Message</div>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-auto p-2 font-mono text-[11px]" data-testid="logs-container">
          {filteredLogs.length === 0 ? (
            <div className="text-center py-8 text-text-tertiary">
              No logs to display. Logs will appear here when monitoring runs.
            </div>
          ) : (
            filteredLogs.map((log, i) => (
              <div key={i} className="flex gap-4 py-0.5 hover:bg-bg-tertiary/40 rounded px-1" data-testid="log-row">
                <div className="w-32 text-text-tertiary tabular-nums">
                  {new Date(log.timestamp).toLocaleTimeString([], { hour12: false })}
                </div>
                <div className={`w-16 font-semibold ${getLevelColor(log.level)}`} data-testid="log-level">
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
