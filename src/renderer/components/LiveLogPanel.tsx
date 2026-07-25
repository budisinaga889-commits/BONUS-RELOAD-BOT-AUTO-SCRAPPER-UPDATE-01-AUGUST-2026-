import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLiveLogs } from '../hooks/useLiveLogs';

interface LiveLogPanelProps {
  maxEntries?: number;
  height?: number | null;
  title?: string;
  compact?: boolean;
}

/**
 * LiveLogPanel — iteration 11.1 refinement.
 *
 * Improvements:
 *   - Level shown as a fixed-width, uppercase micro-chip (INFO/WARN/ERR)
 *     — reads more premium than colored plain text and doesn't shift width
 *   - Row height reduced 20 -> 18 px for higher information density
 *   - Row hover uses a 4% white tint (no background gradient)
 *   - Controls row uses smaller inputs so the panel header stays compact
 *
 * Performance: the local buffer stays capped at `maxEntries`, and the
 * filter memo only recomputes when `logs` or `query` change. No timers,
 * no intersection observers, no observer resizes.
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
      (l.module  || '').toLowerCase().includes(q) ||
      (l.level   || '').toLowerCase().includes(q)
    );
  }, [logs, query]);

  useEffect(() => {
    if (!paused && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [filtered, paused]);

  const handleCopy = async () => {
    const text = filtered.map(l =>
      `${new Date(l.timestamp).toLocaleTimeString()}  ${l.level.padEnd(7)}  ${l.module}  ${l.message}`
    ).join('\n');
    try { await navigator.clipboard.writeText(text); } catch { /* ignore */ }
  };

  const jumpToBottom = () => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  };

  const containerStyle = height ? { height } : undefined;
  const scrollClass = height ? '' : 'flex-1';

  const levelChip = (level: string) => {
    switch (level) {
      case 'ERROR':   return { bg: 'bg-rose-500/15',    text: 'text-rose-300',    label: 'ERR ' };
      case 'WARNING': return { bg: 'bg-amber-500/15',   text: 'text-amber-300',   label: 'WARN' };
      case 'SUCCESS': return { bg: 'bg-emerald-500/15', text: 'text-emerald-300', label: 'OK  ' };
      case 'DEBUG':   return { bg: 'bg-white/[0.04]',   text: 'text-text-tertiary', label: 'DBG ' };
      default:        return { bg: 'bg-sky-500/10',     text: 'text-sky-300',     label: 'INFO' };
    }
  };

  const btn = 'h-6 px-2 text-[11px] rounded border border-border-color bg-bg-tertiary text-text-secondary hover:text-text-primary hover:border-border-strong';

  return (
    <section
      className={`bg-bg-secondary border border-border-color rounded-md shadow-card flex flex-col overflow-hidden ${compact ? '' : ''}`}
      data-testid="live-log-panel"
    >
      <header className="flex items-center justify-between gap-2 px-3 h-8 border-b border-border-color/80">
        <div className="flex items-center gap-2">
          <h3 className="text-[10.5px] uppercase tracking-[0.08em] font-semibold text-text-tertiary">{title}</h3>
          <span className="text-[10.5px] text-text-muted tabular-nums" data-testid="live-log-count">
            {filtered.length}/{logs.length}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <input
            data-testid="live-log-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search…"
            className="h-6 text-[11px] px-2 w-40"
          />
          <button
            data-testid="live-log-pause"
            onClick={() => setPaused(p => !p)}
            title={paused ? 'Resume auto-scroll' : 'Pause auto-scroll'}
            className={paused
              ? 'h-6 px-2 text-[11px] rounded border bg-amber-500/10 border-amber-500/40 text-amber-300'
              : btn}
          >
            {paused ? 'Paused' : 'Live'}
          </button>
          <button data-testid="live-log-copy"  onClick={handleCopy}     title="Copy visible lines" className={btn}>Copy</button>
          <button data-testid="live-log-jump"  onClick={jumpToBottom}   title="Jump to bottom"     className={btn}>↓</button>
          <button data-testid="live-log-clear" onClick={clearLocal}     title="Clear local buffer" className={btn}>Clear</button>
        </div>
      </header>

      <div
        ref={scrollRef}
        className={`font-mono text-[11.5px] overflow-auto ${scrollClass}`}
        style={containerStyle}
        data-testid="live-log-scroll"
      >
        {filtered.length === 0 ? (
          <div className="text-text-muted italic px-3 py-4 text-xs">
            {logs.length === 0 ? 'Waiting for log entries…' : 'No entries match the search.'}
          </div>
        ) : (
          <div className="py-1">
            {filtered.map((log, i) => {
              const chip = levelChip(log.level);
              return (
                <div
                  key={i}
                  className="flex items-baseline gap-2 px-3 py-[3px] hover:bg-white/[0.03]"
                  data-testid="live-log-row"
                >
                  <span className="text-text-muted shrink-0 tabular-nums text-[10.5px]">
                    {new Date(log.timestamp).toLocaleTimeString([], { hour12: false })}
                  </span>
                  <span className={`shrink-0 inline-flex items-center justify-center w-11 h-[15px] text-[9.5px] font-semibold rounded-sm tracking-wider ${chip.bg} ${chip.text}`}>
                    {chip.label.trim()}
                  </span>
                  <span className="whitespace-pre-wrap break-words leading-snug text-text-primary">
                    {log.message}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
};

export default LiveLogPanel;
