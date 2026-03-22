import { useState, useEffect, useCallback, ReactNode } from 'react';
import { 
  Activity, 
  Server, 
  Clock, 
  RefreshCw, 
  Terminal, 
  Info, 
  Globe, 
  Cpu, 
  ShieldCheck,
  AlertCircle,
  CheckCircle2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface HealthStatus {
  status: 'ok' | 'error';
  timestamp: string;
  uptime: number;
  server: string;
}

interface ServerInfo {
  hostname: string;
  platform: string;
  release: string;
  arch: string;
  ip: string;
  env: string;
}

interface LogEntry {
  id: string;
  timestamp: string;
  status: 'ONLINE' | 'OFFLINE';
  latency: number;
  mode: 'Backend' | 'Frontend-only';
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || process.env.VITE_API_URL || window.location.origin;
console.log(`[Monitor] Initialized with API_URL: "${API_URL}"`);

export default function App() {
  const [status, setStatus] = useState<'ONLINE' | 'OFFLINE' | 'CHECKING'>('CHECKING');
  const [latency, setLatency] = useState<number | null>(null);
  const [lastChecked, setLastChecked] = useState<string | null>(null);
  const [serverInfo, setServerInfo] = useState<ServerInfo | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [mode, setMode] = useState<'Backend' | 'Frontend-only'>('Frontend-only');
  const [isAutoRefresh, setIsAutoRefresh] = useState(true);
  const [logFilter, setLogFilter] = useState<'ALL' | 'ONLINE' | 'OFFLINE'>('ALL');
  const [errorDetail, setErrorDetail] = useState<string | null>(null);

  const checkStatus = useCallback(async () => {
    setStatus('CHECKING');
    setErrorDetail(null);
    const startTime = performance.now();
    const timestamp = new Date().toLocaleTimeString();

    console.log(`[Monitor] Checking status at ${timestamp}...`);

    try {
      // Use AbortController for better compatibility
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      // Try backend first
      const response = await fetch(`${API_URL}/api/health`, { 
        cache: 'no-store',
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        const data: HealthStatus = await response.json();
        const endTime = performance.now();
        const currentLatency = Math.round(endTime - startTime);
        
        console.log(`[Monitor] Backend ONLINE (${currentLatency}ms)`);
        setStatus('ONLINE');
        setLatency(currentLatency);
        setLastChecked(timestamp);
        setMode('Backend');
        setErrorDetail(null);
        
        // Fetch info if online
        fetchInfo();

        addLog({
          id: Math.random().toString(36).substr(2, 9),
          timestamp,
          status: 'ONLINE',
          latency: currentLatency,
          mode: 'Backend'
        });
      } else {
        throw new Error(`Server error: ${response.status}`);
      }
    } catch (error: any) {
      console.warn('[Monitor] Backend check failed:', error);
      
      let backendError = 'Failed to reach API endpoint';
      if (error.name === 'AbortError') {
        backendError = 'Backend connection timed out';
      } else if (error.message?.includes('Server error')) {
        backendError = error.message;
      }
      
      setErrorDetail(backendError);

      // Fallback: ping self
      try {
        const fallbackStartTime = performance.now();
        const fallbackController = new AbortController();
        const fallbackTimeoutId = setTimeout(() => fallbackController.abort(), 5000);

        const fallbackResponse = await fetch(window.location.origin, { 
          method: 'HEAD',
          cache: 'no-store',
          signal: fallbackController.signal
        });
        
        clearTimeout(fallbackTimeoutId);
        
        const fallbackEndTime = performance.now();
        const currentLatency = Math.round(fallbackEndTime - fallbackStartTime);

        if (fallbackResponse.ok || fallbackResponse.status === 404) {
          console.log(`[Monitor] Frontend-only ONLINE (${currentLatency}ms)`);
          setStatus('ONLINE');
          setLatency(currentLatency);
          setLastChecked(timestamp);
          setMode('Frontend-only');
          
          addLog({
            id: Math.random().toString(36).substr(2, 9),
            timestamp,
            status: 'ONLINE',
            latency: currentLatency,
            mode: 'Frontend-only'
          });
        } else {
          throw new Error('Fallback ping failed');
        }
      } catch (fallbackError) {
        console.error('[Monitor] All checks failed');
        setStatus('OFFLINE');
        setLatency(null);
        setLastChecked(timestamp);
        
        addLog({
          id: Math.random().toString(36).substr(2, 9),
          timestamp,
          status: 'OFFLINE',
          latency: 0,
          mode: 'Frontend-only'
        });
      }
    }
  }, []);

  const fetchInfo = async () => {
    try {
      const response = await fetch(`${API_URL}/api/info`);
      if (response.ok) {
        const data: ServerInfo = await response.json();
        setServerInfo(data);
      }
    } catch (e) {
      console.error('Failed to fetch server info', e);
    }
  };

  const addLog = (log: LogEntry) => {
    setLogs(prev => [log, ...prev].slice(0, 5));
  };

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isAutoRefresh) {
      interval = setInterval(checkStatus, 10000);
    }
    return () => clearInterval(interval);
  }, [isAutoRefresh, checkStatus]);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-zinc-100 font-sans p-4 md:p-8 selection:bg-emerald-500/30">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-emerald-500/10 rounded-lg">
                <Activity className="w-6 h-6 text-emerald-500" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight">VPS Deployment Status</h1>
            </div>
            <p className="text-zinc-500 text-sm">Real-time monitoring and health diagnostics</p>
          </div>
          
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsAutoRefresh(!isAutoRefresh)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
                isAutoRefresh 
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' 
                : 'bg-zinc-800/50 border-zinc-700/50 text-zinc-400'
              }`}
            >
              {isAutoRefresh ? 'Auto-refresh On' : 'Auto-refresh Off'}
            </button>
            <button 
              onClick={checkStatus}
              disabled={status === 'CHECKING'}
              className="flex items-center gap-2 px-4 py-2 bg-white text-black rounded-xl font-medium hover:bg-zinc-200 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${status === 'CHECKING' ? 'animate-spin' : ''}`} />
              Check Status
            </button>
          </div>
        </header>

        {/* Main Status Card */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative group"
        >
          <div className="absolute -inset-0.5 bg-gradient-to-r from-emerald-500/20 to-blue-500/20 rounded-3xl blur opacity-30 group-hover:opacity-50 transition duration-1000"></div>
          <div className="relative bg-zinc-900/50 backdrop-blur-xl border border-white/10 rounded-3xl p-8 overflow-hidden">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {/* Status Indicator */}
              <div className="space-y-4">
                <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Current Status</span>
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                      status === 'ONLINE' ? 'bg-emerald-500/20' : 
                      status === 'OFFLINE' ? 'bg-red-500/20' : 'bg-zinc-800'
                    }`}>
                      {status === 'ONLINE' ? (
                        <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                      ) : status === 'OFFLINE' ? (
                        <AlertCircle className="w-6 h-6 text-red-500" />
                      ) : (
                        <RefreshCw className="w-6 h-6 text-zinc-500 animate-spin" />
                      )}
                    </div>
                    {status === 'ONLINE' && (
                      <div className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-2 border-[#0a0a0a] animate-pulse"></div>
                    )}
                  </div>
                  <div>
                    <h2 className={`text-3xl font-bold ${
                      status === 'ONLINE' ? 'text-emerald-500' : 
                      status === 'OFFLINE' ? 'text-red-500' : 'text-zinc-400'
                    }`}>
                      {status}
                    </h2>
                    <div className="space-y-1 mt-1">
                      <p className="text-zinc-500 text-xs">
                        {mode === 'Backend' ? '✔ Connected to Backend' : '⚠ Running in Frontend-only Mode'}
                      </p>
                      {errorDetail && (
                        <p className="text-red-400/80 text-[10px] font-medium flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          {errorDetail}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Latency */}
              <div className="space-y-4">
                <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Response Time</span>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-500/10 rounded-lg">
                    <Clock className="w-5 h-5 text-blue-500" />
                  </div>
                  <div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-bold text-white">{latency ?? '--'}</span>
                      <span className="text-zinc-500 font-medium">ms</span>
                    </div>
                    <p className="text-zinc-500 text-xs mt-1">Network latency</p>
                  </div>
                </div>
              </div>

              {/* Last Checked */}
              <div className="space-y-4">
                <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Last Checked</span>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-500/10 rounded-lg">
                    <ShieldCheck className="w-5 h-5 text-purple-500" />
                  </div>
                  <div>
                    <span className="text-xl font-bold text-white block">{lastChecked ?? 'Never'}</span>
                    <p className="text-zinc-500 text-xs mt-1">System timestamp</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Server Info */}
          <motion.section 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-zinc-900/30 border border-white/5 rounded-2xl p-6 space-y-4"
          >
            <div className="flex items-center gap-2 text-zinc-400">
              <Info className="w-4 h-4" />
              <h3 className="text-sm font-semibold uppercase tracking-wider">Server Information</h3>
            </div>
            
            <div className="space-y-3">
              <InfoItem icon={<Globe className="w-4 h-4" />} label="Hostname" value={serverInfo?.hostname ?? 'Unknown'} />
              <InfoItem icon={<Server className="w-4 h-4" />} label="IP Address" value={serverInfo?.ip ?? 'Unknown'} />
              <InfoItem icon={<Cpu className="w-4 h-4" />} label="Platform" value={`${serverInfo?.platform ?? 'Unknown'} (${serverInfo?.arch ?? 'Unknown'})`} />
              <InfoItem icon={<ShieldCheck className="w-4 h-4" />} label="Release" value={serverInfo?.release ?? 'Unknown'} />
              <InfoItem icon={<Terminal className="w-4 h-4" />} label="Environment" value={serverInfo?.env ?? 'Unknown'} />
            </div>
          </motion.section>

          {/* Logs */}
          <motion.section 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-zinc-900/30 border border-white/5 rounded-2xl p-6 space-y-4"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-zinc-400">
                <Terminal className="w-4 h-4" />
                <h3 className="text-sm font-semibold uppercase tracking-wider">Status History</h3>
              </div>
              
              <div className="flex bg-zinc-800/50 p-1 rounded-lg border border-white/5">
                {(['ALL', 'ONLINE', 'OFFLINE'] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setLogFilter(f)}
                    className={`px-2 py-1 text-[10px] font-bold rounded-md transition-all ${
                      logFilter === f 
                        ? 'bg-zinc-700 text-white shadow-sm' 
                        : 'text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <AnimatePresence initial={false}>
                {logs.filter(l => logFilter === 'ALL' || l.status === logFilter).length === 0 ? (
                  <p className="text-zinc-600 text-xs italic">No matching logs recorded yet...</p>
                ) : (
                  logs
                    .filter(l => logFilter === 'ALL' || l.status === logFilter)
                    .map((log) => (
                    <motion.div 
                      key={log.id}
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="flex items-center justify-between py-2 border-b border-white/5 last:border-0"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-1.5 h-1.5 rounded-full ${log.status === 'ONLINE' ? 'bg-emerald-500' : 'bg-red-500'}`}></div>
                        <span className="text-xs font-mono text-zinc-400">{log.timestamp}</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-500 font-mono">
                          {log.mode}
                        </span>
                        <span className="text-xs font-bold text-zinc-300">
                          {log.latency}ms
                        </span>
                      </div>
                    </motion.div>
                  ))
                )}
              </AnimatePresence>
            </div>
          </motion.section>
        </div>

        {/* Footer */}
        <footer className="pt-8 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-4 text-zinc-600 text-xs">
          <p>© 2026 VPS Deployment Monitor • Production Ready</p>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
              API Stable
            </span>
            <span className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-blue-500"></div>
              Frontend Optimized
            </span>
          </div>
        </footer>
      </div>
    </div>
  );
}

function InfoItem({ icon, label, value }: { icon: ReactNode, label: string, value: string }) {
  return (
    <div className="flex items-center justify-between group">
      <div className="flex items-center gap-2 text-zinc-500 group-hover:text-zinc-400 transition-colors">
        {icon}
        <span className="text-xs font-medium">{label}</span>
      </div>
      <span className="text-xs font-mono text-zinc-300 bg-zinc-800/50 px-2 py-1 rounded-md border border-white/5">
        {value}
      </span>
    </div>
  );
}
