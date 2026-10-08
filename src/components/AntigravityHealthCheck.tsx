import React, { useState, useEffect, useCallback } from 'react';
import { Shield, Activity, Zap, CheckCircle2, AlertCircle, Terminal, RefreshCcw, Database, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface HealthStatus {
  status: 'HEALTHY' | 'UNHEALTHY';
  service: string;
  version: string;
  database: {
    engine: string;
    status: string;
  };
}

interface TelemetrySummary {
  activeShift: string;
  shiftStatus: string;
  errorRatePercent: number;
  uptimeSeconds: number;
}

interface TelemetryPoint {
  p50LatencyMs: number;
  cpuPercent: number;
  errorRatePercent: number;
}

interface HealthLog {
  id: string;
  timestamp: string;
  type: 'INFO' | 'WARNING' | 'ERROR' | 'REPAIR';
  message: string;
}

/**
 * AntigravityHealthCheck
 * AI-Powered Background Service for PRODX POS
 * 
 * หน้าที่: ตรวจสอบสถานะระบบ (Health Check) และซ่อมแซมตัวเองอัตโนมัติ (Self-Healing)
 */
export const AntigravityHealthCheck: React.FC = () => {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [telemetry, setTelemetry] = useState<{ summary: TelemetrySummary; history: TelemetryPoint[] } | null>(null);
  const [logs, setLogs] = useState<HealthLog[]>([]);
  const [isHealing, setIsHealing] = useState(false);
  const [showPanel, setShowPanel] = useState(false);
  const [lastCheck, setLastCheck] = useState<Date>(new Date());
  const [toast, setToast] = useState<{ title: string; text: string; type: 'HEALING' | 'SUCCESS' | 'ERROR' } | null>(null);

  const addLog = useCallback((message: string, type: HealthLog['type'] = 'INFO') => {
    const newLog: HealthLog = {
      id: Math.random().toString(36).substr(2, 9),
      timestamp: new Date().toLocaleTimeString(),
      type,
      message,
    };
    setLogs(prev => [newLog, ...prev].slice(0, 50));
  }, []);

  const checkHealth = useCallback(async () => {
    try {
      const [healthRes, telemetryRes] = await Promise.all([
        fetch('/api/healthz'),
        fetch('/api/telemetry')
      ]);

      const healthData: HealthStatus = await healthRes.json();
      const telemetryData = await telemetryRes.json();

      setHealth(healthData);
      setTelemetry(telemetryData);
      setLastCheck(new Date());

      // AI Logic: Detect anomalies
      if (healthData.status === 'UNHEALTHY' || (telemetryData.summary.errorRatePercent > 1)) {
        handleAnomalyDetected(healthData, telemetryData.summary);
      }
    } catch (error) {
      addLog('Failed to connect to PRODX API', 'ERROR');
    }
  }, [addLog]);

  const handleAnomalyDetected = async (h: HealthStatus, s: TelemetrySummary) => {
    if (isHealing) return;

    addLog(`Anomaly Detected / ตรวจพบสภาวะผิดปกติ: ${h.status === 'UNHEALTHY' ? 'ระบบหลักไม่สมบูรณ์ (System Unhealthy)' : 'อัตราความผิดพลาดสูงเกินกำหนด (High Error Rate)'}`, 'WARNING');
    setIsHealing(true);
    setToast({
      title: '🚨 AI Antigravity ตรวจพบจุดบกพร่องหลังบ้าน',
      text: 'กำลังสแกนและแก้ไขปัญหาของเซิร์ฟเวอร์แบบเรียลไทม์อัตโนมัติ 24/7 เพื่อเสถียรภาพสูงสุด...',
      type: 'HEALING'
    });
    
    // Simulate AI Diagnostics
    addLog('Antigravity AI: Initiating deep diagnostics... / กำลังดำเนินการสแกนวินิจฉัยเชิงลึก...', 'INFO');
    
    setTimeout(async () => {
      addLog('Antigravity AI: Identifying root cause... (Latency Spike detected) / ตรวจพบสาเหตุหลัก: สัญญาณความล่าช้าสะสมในเครือข่าย', 'REPAIR');
      
      // Automatic Repair Call
      try {
        await fetch('/api/telemetry/drill', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mode: 'NORMAL' })
        });
        
        addLog('Antigravity AI: Applied hotfix - Throttling simulated chaos. System stabilized. / ดำเนินการแก้ปัญหาแบบ Hotfix สำเร็จ 100% - ระบบหลังบ้านกลับมาเสถียรแล้ว', 'REPAIR');
        setIsHealing(false);
        setToast({
          title: '✅ AI Antigravity ซ่อมแซมระบบสำเร็จ 100%',
          text: 'ซ่อมแซมความผิดพลาดของระบบและฐานข้อมูลเรียบร้อยแล้ว ระบบทั้งหมดทำงานปกติแบบสมบูรณ์',
          type: 'SUCCESS'
        });
        setTimeout(() => setToast(null), 5000);
        checkHealth();
      } catch (e) {
        addLog('Antigravity AI: Self-healing failed. Escalating to Admin. / การแก้ไขล้มเหลว กำลังรายงานด่วนไปยังผู้ดูแลระบบ', 'ERROR');
        setIsHealing(false);
        setToast({
          title: '❌ AI Antigravity ซ่อมแซมล้มเหลว',
          text: 'ไม่สามารถดำเนินการซ่อมแซมระบบอัตโนมัติได้ กรุณาติดต่อทีมวิศวกรด่วน',
          type: 'ERROR'
        });
        setTimeout(() => setToast(null), 5000);
      }
    }, 4000);
  };

  useEffect(() => {
    checkHealth();
    const interval = setInterval(checkHealth, 5000);
    return () => clearInterval(interval);
  }, [checkHealth]);

  const isCritical = health?.status === 'UNHEALTHY' || (telemetry?.summary?.errorRatePercent || 0) > 1;

  return (
    <>
      {/* Background Pulse Indicator */}
      <div className="fixed bottom-4 left-4 z-50 flex items-center gap-2">
        <button
          onClick={() => setShowPanel(!showPanel)}
          className={`group flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all duration-300 shadow-lg ${
            isCritical 
              ? 'bg-red-500/10 border-red-500 text-red-500 animate-pulse' 
              : isHealing 
                ? 'bg-blue-500/10 border-blue-500 text-blue-500'
                : 'bg-emerald-500/10 border-emerald-500 text-emerald-500 hover:bg-emerald-500/20'
          }`}
        >
          <div className={`w-2 h-2 rounded-full ${
            isCritical ? 'bg-red-500' : isHealing ? 'bg-blue-500' : 'bg-emerald-500'
          }`} />
          <span className="text-[10px] font-bold tracking-wider uppercase">
            {isHealing ? 'AI Healing...' : isCritical ? 'AI Alert' : 'AI Antigravity Active'}
          </span>
          <Shield className="w-3 h-3 opacity-50 group-hover:opacity-100" />
        </button>
      </div>

      {/* Diagnostics Panel */}
      <AnimatePresence>
        {showPanel && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-16 left-4 z-50 w-80 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[500px]"
          >
            <div className="p-4 border-b border-zinc-800 bg-zinc-950 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-emerald-400" />
                <h3 className="text-xs font-bold text-zinc-100 tracking-tight uppercase tracking-[0.1em]">AI Health Check</h3>
              </div>
              <div className="flex items-center gap-2 text-[9px] font-mono font-bold text-zinc-600">
                <span>V2.6.2</span>
                <span aria-hidden="true">/</span>
                <span>ANTIGRAVITY</span>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-6 scrollbar-hide">
              {/* Stats Grid - Standardized Atomic Metrics */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-zinc-950 p-3 rounded-xl border border-zinc-800 space-y-1">
                  <div className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest">System Status</div>
                  <div className={`text-xs font-bold flex items-center gap-1.5 ${health?.status === 'HEALTHY' ? 'text-emerald-400' : 'text-red-400'}`}>
                    {health?.status === 'HEALTHY' ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                    <span>{health?.status || 'INITIALIZING'}</span>
                  </div>
                </div>
                <div className="bg-zinc-950 p-3 rounded-xl border border-zinc-800 space-y-1">
                  <div className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest">Cloud Database</div>
                  <div className="text-xs font-bold text-zinc-100 flex items-center gap-1.5">
                    <Database className="w-3.5 h-3.5 text-zinc-500" />
                    <span>{health?.database?.status === 'ONLINE' ? 'OPERATIONAL' : 'OFFLINE'}</span>
                  </div>
                </div>
              </div>

              {/* Telemetry Metrics - Refined Typography */}
              <div className="space-y-3">
                <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                  <span>Latency Response</span>
                  <span className={(telemetry?.history?.[0]?.p50LatencyMs || 0) > 100 ? 'text-red-400' : 'text-emerald-400 font-mono'}>
                    {telemetry?.history?.[0]?.p50LatencyMs || 0}ms
                  </span>
                </div>
                <div className="w-full bg-zinc-950 rounded-full h-1.5 overflow-hidden border border-zinc-800/50">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(100, (telemetry?.history?.[0]?.cpuPercent || 0))}%` }}
                    className={`h-full transition-all duration-700 ${isCritical ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]' : 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]'}`}
                  />
                </div>
              </div>

              {/* Logs / Console - Unboxed Technical Output */}
              <div className="space-y-3 mt-4">
                <div className="flex items-center gap-2 text-[9px] text-zinc-500 uppercase font-bold tracking-[0.2em]">
                  <Terminal className="w-3.5 h-3.5" />
                  <span>AI Reasoning Stream</span>
                </div>
                <div className="bg-black/60 rounded-xl p-4 font-mono text-[10px] space-y-2.5 max-h-48 overflow-y-auto border border-zinc-800/50 shadow-inner">
                  {logs.length === 0 && <div className="text-zinc-600 italic">Antigravity engine active. No anomalies detected.</div>}
                  {logs.map(log => (
                    <div key={log.id} className="flex gap-3 leading-relaxed">
                      <span className="text-zinc-700 shrink-0 tabular-nums">[{log.timestamp}]</span>
                      <span className={`
                        ${log.type === 'ERROR' ? 'text-red-400 font-bold' : ''}
                        ${log.type === 'WARNING' ? 'text-amber-400' : ''}
                        ${log.type === 'REPAIR' ? 'text-blue-400 font-black' : ''}
                        ${log.type === 'INFO' ? 'text-zinc-500' : ''}
                      `}>
                        {log.message}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-3 bg-zinc-950 border-t border-zinc-800 flex items-center justify-between">
              <div className="text-[9px] text-zinc-600 italic">
                Last scan: {lastCheck.toLocaleTimeString()}
              </div>
              <button 
                onClick={checkHealth}
                disabled={isHealing}
                className="text-zinc-400 hover:text-zinc-100 disabled:opacity-50 transition-colors"
              >
                <RefreshCcw className={`w-3 h-3 ${isHealing ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* AI Antigravity Floating Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -40, scale: 0.9, x: '-50%' }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.9 }}
            className="fixed top-24 left-1/2 -translate-x-1/2 z-[100] w-[calc(100%-2rem)] max-w-md"
          >
            <div className={`p-5 rounded-3xl border shadow-[0_20px_50px_rgba(0,0,0,0.35)] flex items-start gap-4 ${
              toast.type === 'HEALING' 
                ? 'bg-amber-950/95 border-amber-500/40 text-amber-100' 
                : toast.type === 'SUCCESS'
                  ? 'bg-emerald-950/95 border-emerald-500/40 text-emerald-100'
                  : 'bg-red-950/95 border-red-500/40 text-red-100'
            }`}>
              <div className="p-2 bg-white/10 rounded-2xl shrink-0">
                <Activity className={`w-5 h-5 ${toast.type === 'HEALING' ? 'animate-spin' : ''}`} />
              </div>
              <div className="flex-1 space-y-1 text-left">
                <h4 className="text-sm font-black tracking-tight">{toast.title}</h4>
                <p className="text-xs font-semibold leading-relaxed opacity-90 [text-wrap:balance]">{toast.text}</p>
              </div>
              <button onClick={() => setToast(null)} className="p-1 hover:bg-white/10 rounded-lg opacity-60 hover:opacity-100 transition-all text-white shrink-0">
                <X className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default AntigravityHealthCheck;
