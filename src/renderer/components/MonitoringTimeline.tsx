import React, { useMemo } from 'react';
import { useLiveLogs } from '../hooks/useLiveLogs';

/**
 * MonitoringTimeline — iteration 11.1 refinement.
 *
 * Row-based layout: a 3-px vertical strip on the left (semantic color)
 * + timestamp + label + optional detail. Reads more premium than a dot
 * on a vertical line and is a single flex row per event (no absolute
 * positioning), which is also easier for React to reconcile cheaply.
 *
 * Backend log stream is unchanged — this component only parses events
 * from the existing message strings emitted by MonitoringEngine and
 * PlaywrightService today.
 */
interface TimelineEvent {
  time: Date;
  kind: 'start' | 'stop' | 'filter-applying' | 'filter-applied' | 'filter-unavailable' | 'cycle-done' | 'exported' | 'error';
  label: string;
  detail?: string;
}

const MAX_EVENTS = 40;

function parseEvent(msg: string): { kind: TimelineEvent['kind']; label: string; detail?: string } | null {
  const m = msg.replace(/\s+/g, ' ').trim();
  if (/^Starting monitoring/i.test(m))   return { kind: 'start', label: 'Monitoring started' };
  if (/^Stopping monitoring/i.test(m))   return { kind: 'stop',  label: 'Monitoring stopped' };
  const applying = m.match(/^Applying filter:\s+([^(]+)\s*\(/);
  if (applying)                          return { kind: 'filter-applying', label: applying[1].trim(), detail: 'applying filter…' };
  const applied = m.match(/^Filter applied:\s+(.+)$/);
  if (applied)                           return { kind: 'filter-applied', label: applied[1].trim(), detail: 'filter applied' };
  const unavailable = m.match(/\[FILTER PROFILE\]\s+([^—-]+)—?\s*NOT AVAILABLE/);
  if (unavailable)                       return { kind: 'filter-unavailable', label: unavailable[1].trim(), detail: 'unavailable — skipped' };
  const cycleDone = m.match(/Monitoring cycle completed in (\d+)ms/);
  if (cycleDone)                         return { kind: 'cycle-done', label: 'Cycle completed', detail: `${cycleDone[1]} ms` };
  const sheets = m.match(/Google Sheets Batch Append: SUCCESS \((\d+) row/);
  if (sheets)                            return { kind: 'exported', label: 'Sheets export', detail: `${sheets[1]} row(s) appended` };
  return null;
}

const kindStyle: Record<TimelineEvent['kind'], { strip: string; label: string }> = {
  start:                { strip: 'bg-emerald-400', label: 'text-emerald-300' },
  stop:                 { strip: 'bg-gray-500',    label: 'text-gray-300' },
  'filter-applying':    { strip: 'bg-sky-400',     label: 'text-sky-300' },
  'filter-applied':     { strip: 'bg-emerald-400', label: 'text-emerald-300' },
  'filter-unavailable': { strip: 'bg-amber-400',   label: 'text-amber-300' },
  'cycle-done':         { strip: 'bg-emerald-400', label: 'text-emerald-300' },
  exported:             { strip: 'bg-emerald-400', label: 'text-emerald-300' },
  error:                { strip: 'bg-rose-400',    label: 'text-rose-300' },
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
      if (parsed) list.push({ time: new Date(log.timestamp), ...parsed });
    }
    return list.slice(-MAX_EVENTS).reverse();
  }, [logs]);

  return (
    <div className="flex flex-col h-full overflow-hidden" data-testid="monitoring-timeline">
      {events.length === 0 ? (
        <div className="text-center py-8 text-text-tertiary text-xs">
          No timeline events yet.<br />
          <span className="text-text-muted">Events will appear here as monitoring runs.</span>
        </div>
      ) : (
        <ol className="overflow-auto pr-1 -mr-1 space-y-1">
          {events.map((e, i) => {
            const s = kindStyle[e.kind];
            return (
              <li
                key={i}
                data-testid="timeline-event"
                className="flex items-center gap-2 pl-2 pr-2 py-1.5 rounded hover:bg-white/[0.02] group border-l-[3px]"
                style={{ borderLeftColor: 'transparent' }}
              >
                <span className={`inline-block w-[3px] self-stretch rounded-full ${s.strip}`} />
                <span className="text-[11px] font-mono tabular-nums text-text-tertiary w-14 shrink-0">
                  {e.time.toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
                <span className={`text-[12.5px] font-medium ${s.label} truncate`}>
                  {e.label}
                </span>
                {e.detail && (
                  <span className="ml-auto text-[11px] text-text-tertiary tabular-nums truncate max-w-[45%]">
                    {e.detail}
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
};

export default MonitoringTimeline;
