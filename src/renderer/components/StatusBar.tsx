import React, { useEffect, useState } from 'react';
import { useMonitoringStore } from '../store/monitoring-store';

const StatusBar: React.FC = () => {
  const { monitoringState, isMonitoring, browserConnected, googleConnected } = useMonitoringStore();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [cpuUsage, setCpuUsage] = useState(0);
  const [memoryUsage, setMemoryUsage] = useState(0);
  
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
      // Simulate CPU/Memory (in real app, get from main process)
      if (typeof performance !== 'undefined' && (performance as any).memory) {
        const memMB = Math.round((performance as any).memory.usedJSHeapSize / 1048576);
        setMemoryUsage(memMB);
      }
    }, 1000);
    
    return () => clearInterval(timer);
  }, []);
  
  return (
    <div className="h-8 bg-bg-secondary border-t border-border-color px-4 flex items-center justify-between text-xs text-text-secondary">
      <div className="flex items-center gap-4">
        <span data-testid="status-time">{currentTime.toLocaleTimeString()}</span>
        <span data-testid="status-monitoring">
          {isMonitoring ? '🟢' : '⚪'} {monitoringState}
        </span>
        <span data-testid="status-browser">
          Browser: {browserConnected ? '🟢' : '🔴'}
        </span>
        <span data-testid="status-google">
          Google: {googleConnected ? '🟢' : '🔴'}
        </span>
      </div>
      
      <div className="flex items-center gap-4">
        <span data-testid="status-memory">Memory: {memoryUsage} MB</span>
      </div>
    </div>
  );
};

export default StatusBar;
