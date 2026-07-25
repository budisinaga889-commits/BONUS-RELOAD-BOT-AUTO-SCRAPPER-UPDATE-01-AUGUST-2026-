import React, { useMemo } from 'react';
import { useLiveLogs } from '../hooks/useLiveLogs';
import { EventIcon } from './CardIcons';

/**
 * MonitoringTimeline — iteration 11.2 refinement:
 *   - Semantic SVG icon per event kind (start/stop/apply/applied/skip/cycle/export/error)
 *   - 3-px semantic-color strip on the left of each row
 *   - Timestamp + label + optional detail, single flex-row per event
 *
 * Backend log stream is untouched. This component only parses events
 * from message strings already emitted by MonitoringEngine and
 * PlaywrightService.
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
  if (applying)                          return { kind: 'filter-applying', label: applying[1].trim(), detail: 'applying…' };
  const applied = m.match(/^Filter applied:\s+(.+)$/);
  if (applied)                           return { kind: 'filter-applied', label: applied[1].trim(), detail: 'filter applied' };
  const unavailable = m.match(/\[FILTER PROFILE\]\s+([^—-]+)—?\s*NOT AVAILABLE/);
  if (unavailable)                       return { kind: 'filter-unavailable', label: unavailable[1].trim(), detail: 'not available — skipped' };
  const cycleDone = m.match(/Monitoring cycle completed in (\d+)ms/);
  if (cycleDone)                         return { kind: 'cycle-done', label: 'Cycle completed', detail: `${cycleDone[1]} ms` };
  const sheets = m.match(/Google Sheets Batch Append: SUCCESS \((\d+) row/);
  if (sheets)                            return { kind: 'exported', label: 'Sheets export', detail: `${sheets[1]} row(s)` };
  return null;
}

const kindStyle: Record<TimelineEvent['kind'], { strip: string; text: string; icon: React.ReactNode }> = {
  start:                { strip: 'bg-emerald-400', text: 'text-emerald-300', icon: <EventIcon.start />       },
  stop:                 { strip: 'bg-gray-500',    text: 'text-gray-300',    icon: <EventIcon.stop />        },
  'filter-applying':    { strip: 'bg-sky-400',     text: 'text-sky-300',     icon: <EventIcon.applying />    },
  'filter-applied':     { strip: 'bg-emerald-400', text: 'text-emerald-300', icon: <EventIcon.applied />     },
  'filter-unavailable': { strip: 'bg-amber-400',   text: 'text-amber-300',   icon: <EventIcon.unavailable /> },
  'cycle-done':         { strip: 'bg-emerald-400', text: 'text-emerald-300', icon: <EventIcon.cycle />       },
  exported:             { strip: 'bg-emerald-400', text: 'text-emerald-300', icon: <EventIcon.export />      },
  error:                { strip: 'bg-rose-400',    text: 'text-rose-300',    icon: <EventIcon.error />       },
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
                className="flex items-center gap-2 pl-1 pr-2 py-1.5 rounded hover:bg-white/[0.02]"
              >
                <span className={`inline-block w-[3px] self-stretch rounded-full ${s.strip}`} />
                <span className={`shrink-0 ${s.text}`}>{s.icon}</span>
                <span className="text-[10.5px] font-mono tabular-nums text-text-tertiary w-12 shrink-0">
                  {e.time.toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
                <span className={`text-[12px] font-medium ${s.text} truncate`}>{e.label}</span>
                {e.detail && (
                  <span className="ml-auto text-[10.5px] text-text-tertiary tabular-nums truncate max-w-[42%]">
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
