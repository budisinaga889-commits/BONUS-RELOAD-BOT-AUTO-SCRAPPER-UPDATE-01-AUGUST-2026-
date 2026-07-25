import React, { useMemo } from 'react';
import { useLiveLogs } from '../hooks/useLiveLogs';

/**
 * MonitoringTimeline
 *
 * Purely a presentation layer over the existing log stream. Parses recent
 * log entries into a compact operator timeline so the dashboard shows
 * "what happened, when" without asking the operator to read raw logs.
 *
 * Backend log format is NOT changed — we only pattern-match a handful of
 * well-known log messages emitted today by MonitoringEngine and
 * PlaywrightService (e.g. "Applying filter:", "Filter applied:",
 * "Cycle completed", "[STAGE] Google Sheets Batch Append: SUCCESS",
 * "[FILTER PROFILE] ... NOT AVAILABLE", "Starting monitoring...",
 * "Stopping monitoring...", "Monitoring cycle completed").
 */
interface TimelineEvent {
  time: Date;
  kind: 'start' | 'stop' | 'filter-applying' | 'filter-applied' | 'filter-unavailable' | 'cycle-done' | 'exported' | 'error';
  label: string;
  detail?: string;
}

const MAX_EVENTS = 40;

function parseEvent(msg: string): { kind: TimelineEvent['kind']; label: string; detail?: string } | null {
  // Trim leading whitespace so multi-line blocks (like the [FILTER PROFILE] block) match.
  const m = msg.replace(/\s+/g, ' ').trim();
  if (/^Starting monitoring/i.test(m))      return { kind: 'start', label: 'Monitoring Started' };
  if (/^Stopping monitoring/i.test(m))      return { kind: 'stop',  label: 'Monitoring Stopped' };
  const applying = m.match(/^Applying filter:\s+([^(]+)\s*\(/);
  if (applying)                             return { kind: 'filter-applying', label: applying[1].trim() };
  const applied = m.match(/^Filter applied:\s+(.+)$/);
  if (applied)                              return { kind: 'filter-applied', label: applied[1].trim() };
  const unavailable = m.match(/\[FILTER PROFILE\]\s+([^—-]+)—?\s*NOT AVAILABLE/);
  if (unavailable)                          return { kind: 'filter-unavailable', label: unavailable[1].trim(), detail: 'Skipped — not available' };
  const cycleDone = m.match(/Monitoring cycle completed in (\d+)ms/);
  if (cycleDone)                            return { kind: 'cycle-done', label: 'Cycle completed', detail: `${cycleDone[1]} ms` };
  const sheets = m.match(/Google Sheets Batch Append: SUCCESS \((\d+) row/);
  if (sheets)                               return { kind: 'exported', label: 'Google Sheets Export', detail: `${sheets[1]} row(s) appended` };
  return null;
}

const kindStyle: Record<TimelineEvent['kind'], { color: string; symbol: string }> = {
  start:                { color: 'text-emerald-400', symbol: '●' },
  stop:                 { color: 'text-gray-400',    symbol: '●' },
  'filter-applying':    { color: 'text-blue-400',    symbol: '●' },
  'filter-applied':     { color: 'text-emerald-400', symbol: '●' },
  'filter-unavailable': { color: 'text-amber-400',   symbol: '●' },
  'cycle-done':         { color: 'text-emerald-400', symbol: '●' },
  exported:             { color: 'text-emerald-400', symbol: '●' },
  error:                { color: 'text-red-400',     symbol: '●' },
};

const MonitoringTimeline: React.FC = () => {
  const [logs] = useLiveLogs(400);

  const events = useMemo<TimelineEvent[]>(() => {
    const list: TimelineEvent[] = [];
    for (const log of logs) {
      if (log.level === 'ERROR') {
        list.push({ time: new Date(log.timestamp), kind: 'error', label: 'Error', detail: log.message.slice(0, 80) });
        continue;
      }
      const parsed = parseEvent(log.message);
      if (parsed) {
        list.push({ time: new Date(log.timestamp), ...parsed });
      }
    }
    // newest first, capped
    return list.slice(-MAX_EVENTS).reverse();
  }, [logs]);

  return (
    <div className="flex flex-col h-full" data-testid="monitoring-timeline">
      {events.length === 0 ? (
        <div className="text-center py-6 text-text-tertiary text-sm">
          No timeline events yet. Events will appear here as monitoring runs.
        </div>
      ) : (
        <ol className="relative border-l border-border-color pl-4 space-y-2.5 overflow-auto pr-2">
          {events.map((e, i) => {
            const s = kindStyle[e.kind];
            return (
              <li key={i} className="flex items-start gap-3" data-testid="timeline-event">
                <span className={`absolute -left-[7px] mt-1 text-[10px] ${s.color}`}>{s.symbol}</span>
                <div className="w-14 shrink-0 text-xs font-mono text-text-tertiary tabular-nums">
                  {e.time.toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </div>
                <div className="flex-1 min-w-0">
                  <div className={`text-sm font-medium ${s.color}`}>{e.label}</div>
                  {e.detail && (
                    <div className="text-xs text-text-secondary truncate">{e.detail}</div>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
};

export default MonitoringTimeline;
