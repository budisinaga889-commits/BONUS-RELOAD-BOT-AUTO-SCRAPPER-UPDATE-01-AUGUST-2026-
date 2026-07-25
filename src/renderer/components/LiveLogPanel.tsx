import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLiveLogs } from '../hooks/useLiveLogs';

interface LiveLogPanelProps {
  /** How many recent lines to keep in the dashboard tail. */
  maxEntries?: number;
  /** Max panel height in px (scrolls inside). Set to null for flex-1. */
  height?: number | null;
  /** Title shown in the header. */
  title?: string;
  /** Compact mode for the dashboard footer variant. */
  compact?: boolean;
}

/**
 * LiveLogPanel — operator-friendly live log tail.
 *
 * Controls: search filter, pause auto-scroll, copy visible lines,
 * jump to bottom, clear local buffer. The backend log stream is
 * untouched — only the presentation reacts.
 */
const LiveLogPanel: React.FC<LiveLogPanelProps> = ({
  maxEntries = 200, height = 260, title = 'Live Log', compact = false
}) => {
  const [logs, clearLocal] = useLiveLogs(maxEntries);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState('');
  const [paused, setPaused] = useState(false);

  const filtered = useMemo(() => {
    if (!query.trim()) return logs;
    const q = query.toLowerCase();
    return logs.filter(l =>
      (l.message || '').toLowerCase().includes(q) ||
      (l.module || '').toLowerCase().includes(q) ||
      (l.level || '').toLowerCase().includes(q)
    );
  }, [logs, query]);

  useEffect(() => {
    if (!paused && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [filtered, paused]);

  const levelClass = (level: string) => {
    switch (level) {
      case 'ERROR':   return 'text-red-400';
      case 'WARNING': return 'text-amber-400';
      case 'SUCCESS': return 'text-emerald-400';
      case 'DEBUG':   return 'text-text-tertiary';
      default:        return 'text-text-primary';
    }
  };

  const handleCopy = async () => {
    const text = filtered.map(l =>
      `${new Date(l.timestamp).toLocaleTimeString()}  ${l.level.padEnd(7)}  ${l.module}  ${l.message}`
    ).join('\n');
    try {
      await navigator.clipboard.writeText(text);
    } catch { /* clipboard denied — ignore */ }
  };

  const jumpToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  };

  const containerStyle = height ? { height } : undefined;
  const scrollClass = height ? '' : 'flex-1';

  return (
    <section
      className={`bg-bg-secondary border border-border-color rounded-md flex flex-col ${compact ? '' : ''}`}
      data-testid="live-log-panel"
    >
      <header className="flex items-center justify-between gap-2 px-4 py-2 border-b border-border-color">
        <div className="flex items-center gap-2">
          <h3 className="text-xs uppercase tracking-wider font-semibold text-text-secondary">{title}</h3>
          <span className="text-[11px] text-text-tertiary" data-testid="live-log-count">
            {filtered.length}/{logs.length}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <input
            data-testid="live-log-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search…"
            className="h-7 text-xs px-2 w-40 bg-bg-tertiary border border-border-color rounded"
          />
          <button
            data-testid="live-log-pause"
            onClick={() => setPaused(p => !p)}
            title={paused ? 'Resume auto-scroll' : 'Pause auto-scroll'}
            className={`h-7 px-2 text-xs rounded border ${paused ? 'bg-amber-500/10 border-amber-500/40 text-amber-300' : 'bg-bg-tertiary border-border-color text-text-secondary hover:text-text-primary'}`}
          >
            {paused ? 'Paused' : 'Live'}
          </button>
          <button
            data-testid="live-log-copy"
            onClick={handleCopy}
            title="Copy visible lines"
            className="h-7 px-2 text-xs rounded bg-bg-tertiary border border-border-color text-text-secondary hover:text-text-primary"
          >
            Copy
          </button>
          <button
            data-testid="live-log-jump"
            onClick={jumpToBottom}
            title="Jump to bottom"
            className="h-7 px-2 text-xs rounded bg-bg-tertiary border border-border-color text-text-secondary hover:text-text-primary"
          >
            ↓
          </button>
          <button
            data-testid="live-log-clear"
            onClick={clearLocal}
            title="Clear local buffer (does not affect log files)"
            className="h-7 px-2 text-xs rounded bg-bg-tertiary border border-border-color text-text-secondary hover:text-text-primary"
          >
            Clear
          </button>
        </div>
      </header>

      <div
        ref={scrollRef}
        className={`font-mono text-[11px] overflow-auto p-2 ${scrollClass}`}
        style={containerStyle}
        data-testid="live-log-scroll"
      >
        {filtered.length === 0 ? (
          <div className="text-text-tertiary italic px-2 py-4">
            {logs.length === 0 ? 'Waiting for log entries…' : 'No entries match the search.'}
          </div>
        ) : (
          filtered.map((log, i) => (
            <div key={i} className="flex gap-2 py-0.5 hover:bg-bg-tertiary/40 rounded px-1" data-testid="live-log-row">
              <span className="text-text-tertiary shrink-0 tabular-nums">
                {new Date(log.timestamp).toLocaleTimeString([], { hour12: false })}
              </span>
              <span className={`shrink-0 font-semibold w-14 ${levelClass(log.level)}`}>
                {log.level}
              </span>
              <span className="whitespace-pre-wrap break-words leading-snug">{log.message}</span>
            </div>
          ))
        )}
      </div>
    </section>
  );
};

export default LiveLogPanel;
