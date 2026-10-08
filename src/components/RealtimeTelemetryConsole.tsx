import React, { useState } from 'react';
import { Activity, Cpu, Database, Flame, RefreshCw, TerminalSquare, ShieldCheck, Lock, Clock, History, ArrowRight } from 'lucide-react';
import { TelemetryPoint, TelemetrySummary } from '../types/prodx';
import { ShiftLifecycleModal } from './ShiftLifecycleModal';

interface RealtimeTelemetryConsoleProps {
  history: TelemetryPoint[];
  summary: TelemetrySummary;
  onTriggerDrill: (mode: 'SPIKE' | 'NORMAL') => Promise<void>;
  onRefreshData?: () => Promise<void>;
}

export const RealtimeTelemetryConsole: React.FC<RealtimeTelemetryConsoleProps> = ({
  history,
  summary,
  onTriggerDrill,
  onRefreshData,
}) => {
  const [prometheusRaw, setPrometheusRaw] = useState<string | null>(null);
  const [loadingMetrics, setLoadingMetrics] = useState(false);
  const [drillLoading, setDrillLoading] = useState(false);
  const [isShiftModalOpen, setIsShiftModalOpen] = useState(false);
  const [shiftModalInitialStep, setShiftModalInitialStep] = useState<'FINALIZE' | 'PROMPT_NEW' | 'HISTORY'>('FINALIZE');

  const latest: TelemetryPoint = history[history.length - 1] || {
    timestamp: new Date().toISOString(),
    p50LatencyMs: 7,
    p95LatencyMs: 21,
    p99LatencyMs: 38,
    rps: 44,
    cpuPercent: 26,
    memoryMb: 188,
    dbActiveConnections: 7,
    dbIdleConnections: 18,
    errorRatePercent: 0.02,
  };

  const isElevatedLatency = latest.p95LatencyMs > 60;
  const isShiftFinalized = summary.shiftStatus === 'FINALIZED_PENDING_NEW';

  const fetchPrometheusScrape = async () => {
    setLoadingMetrics(true);
    try {
      const res = await fetch('/api/metrics');
      const text = await res.text();
      setPrometheusRaw(text);
    } finally {
      setLoadingMetrics(false);
    }
  };

  const handleDrill = async (mode: 'SPIKE' | 'NORMAL') => {
    setDrillLoading(true);
    try {
      await onTriggerDrill(mode);
    } finally {
      setDrillLoading(false);
    }
  };

  const openFinalizeShiftModal = () => {
    setShiftModalInitialStep(isShiftFinalized ? 'PROMPT_NEW' : 'FINALIZE');
    setIsShiftModalOpen(true);
  };

  const openShiftHistoryModal = () => {
    setShiftModalInitialStep('HISTORY');
    setIsShiftModalOpen(true);
  };

  return (
    <div className="space-y-8 max-w-full overflow-hidden">
      {/* Active Shift Telemetry Governance Panel */}
      <div className={`p-6 rounded-[1.5rem] border transition-all ${
        isShiftFinalized
          ? 'bg-amber-50 border-amber-200 shadow-sm'
          : 'bg-white border-slate-200 shadow-sm'
      }`}>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-4 text-[10px] font-bold tracking-tight text-slate-500 uppercase">
              <div className="flex items-center gap-1.5">
                <span className="font-mono tracking-widest text-slate-400">Shift Target</span>
              </div>
              <span aria-hidden="true" className="text-slate-200">·</span>
              <span className="px-2 py-0.5 rounded bg-slate-900 text-white font-mono tracking-wider font-black">
                {summary.activeShift}
              </span>
              <span aria-hidden="true" className="text-slate-200">·</span>
              <div className={`flex items-center gap-1.5 font-bold ${
                isShiftFinalized ? 'text-amber-600' : 'text-emerald-600'
              }`}>
                <div className={`w-1.5 h-1.5 rounded-full ${
                  isShiftFinalized ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'
                }`} />
                <span>{isShiftFinalized ? 'FINALIZED' : 'ACTIVE_OPERATIONAL'}</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-x-8 gap-y-3 text-[13px] text-slate-600 font-medium">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-slate-300" />
                <span className="font-mono tabular-nums">
                  Started: {summary.shiftStartedAt ? new Date(summary.shiftStartedAt).toLocaleTimeString('th-TH') : '08:00 AM'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">Orders</span>
                <span className="font-bold text-slate-900 tabular-nums font-mono">{summary.shiftOrdersCount ?? 0}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">Revenue</span>
                <span className="font-bold text-emerald-700 tabular-nums font-mono">
                  ฿{(((summary.shiftSalesSatang ?? 0) / 100)).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>

          {/* Action Buttons for Ending Shift */}
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              onClick={openShiftHistoryModal}
              className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-semibold rounded-xl transition-all shadow-sm flex items-center gap-1.5 active:scale-95"
            >
              <History className="w-3.5 h-3.5 text-slate-400" />
              <span>Shift History</span>
            </button>

            <button
              onClick={openFinalizeShiftModal}
              className={`px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 shadow-sm active:scale-95 ${
                isShiftFinalized
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20'
                  : 'bg-slate-900 hover:bg-slate-800 text-white'
              }`}
            >
              {isShiftFinalized ? (
                <>
                  <ArrowRight className="w-4 h-4" />
                  <span>Prompt New Shift Identifier</span>
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4 text-emerald-400" />
                  <span>End Shift & Finalize Audit</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Header & Chaos Latency Drill Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8 pb-10 border-b border-slate-200">
        <div className="min-w-0 flex items-center gap-6">
          <div className="p-4 bg-emerald-50 rounded-2xl shrink-0 border border-emerald-100/50">
            <Activity className="w-8 h-8 text-emerald-600" />
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-3 text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">
              <span className="text-emerald-600">LIVE FEED</span>
              <span aria-hidden="true" className="text-slate-200">/</span>
              <span>PROMETHEUS SCRAPE ACTIVE</span>
            </div>
            <h2 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight [text-wrap:balance]">
              System Telemetry Console
            </h2>
            <p className="text-sm md:text-base text-slate-500 font-medium leading-relaxed max-w-2xl [text-wrap:balance]">
              Real-time observation of API throughput, resource utilization, and distributional latency 
              with automated drift detection.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <button
            onClick={() => handleDrill(isElevatedLatency ? 'NORMAL' : 'SPIKE')}
            disabled={drillLoading}
            className={`flex-1 sm:flex-initial px-6 py-3 text-xs font-bold uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-3 shadow-lg active:scale-95 ${
              isElevatedLatency
                ? 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-emerald-600/20'
                : 'bg-white text-slate-900 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            <Flame className="w-4 h-4 shrink-0" />
            <span>
              {isElevatedLatency
                ? 'Restore Baseline'
                : 'Simulate High Load'}
            </span>
          </button>

          <button
            onClick={fetchPrometheusScrape}
            disabled={loadingMetrics}
            className="flex-1 sm:flex-initial px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-xs font-bold uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-2 shadow-sm active:scale-95"
          >
            <TerminalSquare className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Raw Metrics</span>
          </button>
        </div>
      </div>

      {/* Primary KPI Strip - Standardized Atomic Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-full">
        <div className="p-6 bg-white border border-slate-200 rounded-2xl shadow-sm space-y-4 group hover:border-emerald-200 transition-all">
          <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-[0.15em]">
            <span>API Latency</span>
            <Activity className="w-4 h-4 text-emerald-600 shrink-0 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 tracking-tighter">
            {latest.p50LatencyMs} <span className="text-slate-300 font-normal">/</span>{' '}
            <span className={isElevatedLatency ? 'text-amber-600' : 'text-emerald-600'}>
              {latest.p95LatencyMs}
            </span>{' '}
            <span className="text-slate-300 font-normal">/</span> {latest.p99LatencyMs}
            <span className="text-xs ml-1.5 text-slate-400 font-sans font-medium">ms</span>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest">
            <div className={`w-1 h-1 rounded-full ${isElevatedLatency ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`} />
            <span className={isElevatedLatency ? 'text-amber-600' : 'text-slate-500'}>
              {isElevatedLatency ? 'Elevated Drift' : 'Nominal Baseline'}
            </span>
          </div>
        </div>

        <div className="p-6 bg-white border border-slate-200 rounded-2xl shadow-sm space-y-4 group hover:border-emerald-200 transition-all">
          <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-[0.15em]">
            <span>Throughput</span>
            <RefreshCw className="w-4 h-4 text-emerald-600 shrink-0 group-hover:rotate-180 transition-transform duration-700" />
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 tracking-tighter">
            {latest.rps} <span className="text-xs font-sans font-medium text-slate-400 ml-1">req/s</span>
          </div>
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest tabular-nums">
            Total: {summary.totalRequestsHandled.toLocaleString()}
          </div>
        </div>

        <div className="p-6 bg-white border border-slate-200 rounded-2xl shadow-sm space-y-4 group hover:border-emerald-200 transition-all">
          <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-[0.15em]">
            <span>DB Pool</span>
            <Database className="w-4 h-4 text-emerald-600 shrink-0 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 tracking-tighter">
            {latest.dbActiveConnections} <span className="text-slate-300 font-normal">/</span> {latest.dbIdleConnections}
          </div>
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
            Active vs Idle Pool
          </div>
        </div>

        <div className="p-6 bg-white border border-slate-200 rounded-2xl shadow-sm space-y-4 group hover:border-emerald-200 transition-all">
          <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-[0.15em]">
            <span>Resources</span>
            <Cpu className="w-4 h-4 text-emerald-600 shrink-0 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 tracking-tighter">
            {latest.cpuPercent}% <span className="text-slate-300 font-normal">/</span> {latest.memoryMb}MB
          </div>
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest font-mono">
            SYS: CORE_CPU_ALLOC
          </div>
        </div>
      </div>

      {/* Real-Time Latency Bar Chart & Time-Series Log */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start max-w-full">
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 space-y-6 shadow-sm overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-slate-900 tracking-tight">
                Latency Distribution
              </h3>
              <p className="text-xs text-slate-500 font-normal leading-relaxed">Rolling 18-sample telemetry (p95 vs p50)</p>
            </div>
            <div className="flex items-center gap-4 text-[10px] font-bold uppercase tracking-widest shrink-0">
              <div className="flex items-center gap-1.5 text-emerald-600">
                <div className="w-2 h-2 rounded-full bg-emerald-600" />
                <span>p95</span>
              </div>
              <div className="flex items-center gap-1.5 text-slate-400">
                <div className="w-2 h-2 rounded-full bg-slate-300" />
                <span>p50</span>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto max-w-full no-scrollbar pb-2">
            <div className="h-56 pt-8 pb-2 px-2 bg-slate-50 border border-slate-200/60 rounded-2xl flex items-end gap-3 min-w-[500px] sm:min-w-0 w-full relative">
              {history.map((pt, index) => {
                const p95HeightPercent = Math.min(100, Math.max(10, Math.round((pt.p95LatencyMs / 180) * 100)));
                const p50HeightPercent = Math.min(100, Math.max(6, Math.round((pt.p50LatencyMs / 180) * 100)));
                const isHigh = pt.p95LatencyMs > 60;

                return (
                  <div key={index} className="flex-1 h-full flex flex-col justify-end items-center gap-2 group">
                    <div className="text-[9px] font-mono font-bold tabular-nums text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">
                      {pt.p95LatencyMs}
                    </div>
                    <div className="w-full flex items-end justify-center gap-1 h-40">
                      <div
                        className={`w-1/2 rounded-full transition-all duration-300 ${
                          isHigh ? 'bg-amber-500' : 'bg-emerald-600'
                        }`}
                        style={{ height: `${p95HeightPercent}%` }}
                      />
                      <div
                        className="w-1/2 bg-slate-300 rounded-full transition-all duration-300"
                        style={{ height: `${p50HeightPercent}%` }}
                      />
                    </div>
                    <div className="text-[9px] font-mono font-bold text-slate-400 tabular-nums">
                      {new Date(pt.timestamp).toLocaleTimeString('th-TH', {
                        second: '2-digit',
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right 5 Cols: Recent Telemetry Samples Table */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
            <h3 className="text-[11px] font-bold text-slate-900 uppercase tracking-widest">Execution Ledger</h3>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest font-mono">Interval 4s</span>
          </div>
          <div className="overflow-x-auto max-w-full">
            <table className="w-full text-left border-collapse text-xs font-medium min-w-[320px]">
              <thead>
                <tr className="border-b border-slate-100 text-slate-500 bg-slate-50/50">
                  <th className="py-4 px-6 text-[10px] font-bold uppercase tracking-widest">Time</th>
                  <th className="py-4 px-6 text-[10px] font-bold uppercase tracking-widest text-right">RPS</th>
                  <th className="py-4 px-6 text-[10px] font-bold uppercase tracking-widest text-right">p95</th>
                  <th className="py-4 px-6 text-[10px] font-bold uppercase tracking-widest text-right">Pool</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {[...history].reverse().slice(0, 8).map((pt, i) => (
                  <tr key={i} className="hover:bg-slate-50 transition-colors">
                    <td className="py-4 px-6 text-slate-600 tabular-nums font-mono">
                      {new Date(pt.timestamp).toLocaleTimeString('th-TH', { hour12: false })}
                    </td>
                    <td className="py-4 px-6 text-right text-slate-900 font-bold tabular-nums font-mono">{pt.rps}</td>
                    <td
                      className={`py-4 px-6 text-right font-bold font-mono tabular-nums ${
                        pt.p95LatencyMs > 60 ? 'text-amber-600' : 'text-emerald-600'
                      }`}
                    >
                      {pt.p95LatencyMs}ms
                    </td>
                    <td className="py-4 px-6 text-right text-slate-400 tabular-nums font-mono">
                      {pt.dbActiveConnections}/{pt.dbActiveConnections + pt.dbIdleConnections}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Optional Prometheus Raw Scrape Output */}
      {prometheusRaw && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4 shadow-xl relative overflow-hidden">
          <div className="flex items-center justify-between relative z-10">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase tracking-widest font-mono">
              Prometheus Exposition Format
            </span>
            <button
              onClick={() => setPrometheusRaw(null)}
              className="text-[10px] font-bold text-slate-400 hover:text-slate-900 uppercase tracking-widest transition-colors"
            >
              Dismiss
            </button>
          </div>
          <pre className="p-4 bg-slate-50 rounded-lg text-[11px] font-mono text-emerald-700 overflow-x-auto border border-slate-100 relative z-10 leading-relaxed shadow-inner">
            {prometheusRaw}
          </pre>
        </div>
      )}

      {/* Official Shift Lifecycle Modal */}
      <ShiftLifecycleModal
        isOpen={isShiftModalOpen}
        onClose={() => setIsShiftModalOpen(false)}
        telemetrySummary={summary}
        initialStep={shiftModalInitialStep}
        onShiftUpdated={async () => {
          if (onRefreshData) {
            await onRefreshData();
          }
        }}
      />
    </div>
  );
};
