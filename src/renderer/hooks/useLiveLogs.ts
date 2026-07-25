import { useEffect, useRef, useState } from 'react';
import { LogEntry } from '../../types/monitoring';

/**
 * useLiveLogs — subscribes to the main process log stream and returns a
 * bounded, most-recent-first-appended array of entries.
 *
 * - Backfills the ring buffer from the main process on first mount.
 * - Attaches an IPC listener via `window.electron.onLogEntry`.
 * - Caps the local buffer at `maxEntries` to keep the DOM light.
 */
export function useLiveLogs(maxEntries: number = 500): [LogEntry[], () => void] {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const maxRef = useRef(maxEntries);
  maxRef.current = maxEntries;
  
  useEffect(() => {
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;
    
    (async () => {
      if (!window.electron) return;
      
      // Backfill
      try {
        const res = await window.electron.getRecentLogs(maxRef.current);
        if (!cancelled && res && res.success && Array.isArray(res.data)) {
          setLogs(res.data.map(normalize));
        }
      } catch {
        /* ignore backfill errors — live stream still works */
      }
      
      if (cancelled) return;
      
      // Live subscription
      unsubscribe = window.electron.onLogEntry((entry: any) => {
        setLogs((prev) => {
          const next = prev.length >= maxRef.current
            ? prev.slice(prev.length - maxRef.current + 1)
            : prev.slice();
          next.push(normalize(entry));
          return next;
        });
      });
    })();
    
    return () => {
      cancelled = true;
      if (unsubscribe) unsubscribe();
    };
  }, []);
  
  const clear = () => setLogs([]);
  return [logs, clear];
}

function normalize(e: any): LogEntry {
  return {
    timestamp: e.timestamp instanceof Date ? e.timestamp : new Date(e.timestamp),
    level: e.level,
    module: e.module || 'main',
    message: e.message,
    meta: e.meta
  };
}
