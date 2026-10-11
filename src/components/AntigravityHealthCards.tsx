import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Activity,
  Database,
  Cpu,
  RefreshCw,
  ShieldCheck,
  Zap,
  TrendingUp,
  X,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  Server,
  Layers,
  Sparkles,
} from 'lucide-react';
import {
  useAntigravityHealth,
  HealthMetricCardData,
} from '../services/antigravityService';

export const AntigravityHealthCards: React.FC = () => {
  const {
    state,
    loading,
    isHealing,
    refresh,
    runSelfHealing,
    systemAvailability,
    databaseIntegrity,
    nodeLatency,
  } = useAntigravityHealth(3500);

  const [selectedMetric, setSelectedMetric] = useState<HealthMetricCardData | null>(null);
  const [showRawValues, setShowRawValues] = useState<boolean>(false);
  const [optimizing, setOptimizing] = useState<boolean>(false);
  const [drillSuccess, setDrillSuccess] = useState<string | null>(null);

  // Theme-aware state: Automatically detects dark mode switches in real-time
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return document.documentElement.classList.contains('dark') || 
             window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const checkTheme = () => {
      setIsDarkMode(document.documentElement.classList.contains('dark'));
    };

    checkTheme();

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'class') {
          checkTheme();
        }
      });
    });

    observer.observe(document.documentElement, { attributes: true });

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleSystemChange = () => {
      if (!document.documentElement.classList.contains('dark') && !document.documentElement.classList.contains('light')) {
        setIsDarkMode(mediaQuery.matches);
      }
    };
    mediaQuery.addEventListener('change', handleSystemChange);

    return () => {
      observer.disconnect();
      mediaQuery.removeEventListener('change', handleSystemChange);
    };
  }, []);

  const cards: Array<{
    data: HealthMetricCardData;
    icon: React.ElementType;
    color: string;
    bgColor: string;
    borderColor: string;
    ringColor: string;
    badgeText: string;
  }> = [
    {
      data: systemAvailability,
      icon: Activity,
      color: 'text-emerald-500',
      bgColor: 'bg-emerald-500/10',
      borderColor: 'border-emerald-500/20 hover:border-emerald-500/40',
      ringColor: 'focus:ring-emerald-500/30',
      badgeText: 'High Availability SLO',
    },
    {
      data: databaseIntegrity,
      icon: Database,
      color: 'text-sky-500',
      bgColor: 'bg-sky-500/10',
      borderColor: 'border-sky-500/20 hover:border-sky-500/40',
      ringColor: 'focus:ring-sky-500/30',
      badgeText: 'SHA-256 Verified',
    },
    {
      data: nodeLatency,
      icon: Cpu,
      color: 'text-violet-500',
      bgColor: 'bg-violet-500/10',
      borderColor: 'border-violet-500/20 hover:border-violet-500/40',
      ringColor: 'focus:ring-violet-500/30',
      badgeText: 'Ultra-Low Edge',
    },
  ];

  const handleRunOptimization = async () => {
    setOptimizing(true);
    setDrillSuccess(null);
    try {
      await runSelfHealing('NORMAL');
      setDrillSuccess('Antigravity optimization executed successfully: cluster latency stabilized & cache primed.');
      setTimeout(() => setDrillSuccess(null), 5000);
    } finally {
      setOptimizing(false);
    }
  };

  return (
    <div className="w-full space-y-3 mb-6">
      {/* Header bar with Antigravity indicator and controls */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-900 dark:bg-slate-800 text-white rounded-lg text-[10px] font-mono font-semibold tracking-wider uppercase shadow-xs">
            <Sparkles className="w-3 h-3 text-emerald-400 animate-pulse" />
            <span>Antigravity Service Engine</span>
          </div>
          <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 hidden sm:inline">
            Live infrastructure & database health telemetry
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowRawValues(!showRawValues)}
            title="Toggle between Percentage Health Score and Raw Technical Telemetry"
            className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg border transition-all ${
              showRawValues
                ? 'bg-slate-900 text-white border-slate-900 dark:bg-slate-800 dark:border-slate-700'
                : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-800 dark:hover:border-slate-700 dark:hover:bg-slate-800'
            }`}
          >
            {showRawValues ? 'Show Percentages' : 'Show Raw Units'}
          </button>

          <button
            onClick={refresh}
            disabled={loading || isHealing}
            title="Probe Antigravity Health Now"
            className="p-1.5 text-slate-400 hover:text-slate-800 dark:hover:text-white bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg transition-colors hover:shadow-xs disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading || isHealing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* The Three Interactive Health Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {cards.map(({ data, icon: Icon, color, bgColor, borderColor, badgeText }) => {
          const isOptimal = data.status === 'OPTIMAL';
          const isCritical = data.status === 'CRITICAL';

          return (
            <motion.div
              key={data.title}
              whileHover={{ y: -2, transition: { duration: 0.15 } }}
              whileTap={{ scale: 0.99 }}
              onClick={() => setSelectedMetric(data)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  setSelectedMetric(data);
                }
              }}
              className={`group relative bg-white dark:bg-slate-900 border rounded-2xl p-4.5 cursor-pointer shadow-xs hover:shadow-md transition-all duration-200 text-left overflow-hidden ${
                isDarkMode ? 'border-slate-800/85 hover:border-slate-700' : borderColor
              }`}
            >
              {/* Subtle accent glow on top right */}
              <div
                className={`absolute -top-10 -right-10 w-24 h-24 rounded-full blur-2xl opacity-15 pointer-events-none ${
                  isCritical ? 'bg-rose-500' : isOptimal ? 'bg-emerald-500' : 'bg-sky-500'
                }`}
              />

              <div className="relative z-10 flex flex-col justify-between h-full space-y-3">
                {/* Top Row: Icon + Title + Live Beacon */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className={`p-2 rounded-xl ${bgColor} ${color} transition-transform group-hover:scale-105 duration-200`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-slate-900 dark:text-white tracking-tight group-hover:text-slate-950 dark:group-hover:text-cyan-400">
                        {data.title}
                      </h3>
                      <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-400 block">
                        {badgeText}
                      </span>
                    </div>
                  </div>

                  {/* Pulsing Beacon Status */}
                  <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-850 text-[10px] font-mono font-medium text-slate-600 dark:text-slate-400">
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        isCritical
                          ? 'bg-rose-500 animate-ping'
                          : isOptimal
                          ? 'bg-emerald-500 animate-pulse'
                          : 'bg-amber-500 animate-pulse'
                      }`}
                    />
                    <span>{data.status}</span>
                  </div>
                </div>

                {/* Main Metric Value Display */}
                <div className="space-y-1 pt-1">
                  <div className="flex items-baseline justify-between">
                    <div className="font-mono text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight tabular-nums">
                      {showRawValues ? (
                        <span className="text-xl">{data.primaryMetric}</span>
                      ) : (
                        <span>{data.formattedPercentage}</span>
                      )}
                    </div>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                      {showRawValues ? 'Live Metric' : 'Health Score'}
                    </span>
                  </div>

                  {/* Mini-progress bar */}
                  <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(100, Math.max(0, data.percentage))}%` }}
                      transition={{ duration: 0.8, ease: 'easeOut' }}
                      className={`h-full rounded-full ${
                        isCritical
                          ? 'bg-rose-500'
                          : data.percentage >= 98
                          ? 'bg-emerald-500'
                          : 'bg-amber-500'
                      }`}
                    />
                  </div>
                </div>

                {/* Bottom Row: Secondary stats & interactive hint */}
                <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-800/80 text-[11px]">
                  <span className="text-slate-600 dark:text-slate-400 font-mono tabular-nums truncate max-w-[190px]">
                    {showRawValues ? data.formattedPercentage : data.primaryMetric}
                  </span>
                  <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white flex items-center gap-0.5 transition-colors">
                    <span>Inspect</span>
                    <ExternalLink className="w-3 h-3 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                  </span>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Interactive Detail Modal / Inspector */}
      <AnimatePresence>
        {selectedMetric && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.2 }}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden text-left"
            >
              {/* Modal Header */}
              <div className="p-6 bg-slate-50 dark:bg-slate-950/50 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs text-slate-900 dark:text-white">
                    {selectedMetric.title === 'System Availability' && <Activity className="w-5 h-5 text-emerald-600" />}
                    {selectedMetric.title === 'Database Integrity' && <Database className="w-5 h-5 text-sky-600" />}
                    {selectedMetric.title === 'Node Latency' && <Cpu className="w-5 h-5 text-violet-600" />}
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">{selectedMetric.title}</h3>
                    <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 font-medium">
                      <span>Antigravity Diagnostic Inspector</span>
                      <span>•</span>
                      <span className="font-mono text-emerald-600 font-semibold">{selectedMetric.statusLabel}</span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => setSelectedMetric(null)}
                  className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-xl hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 space-y-6">
                {/* Big Score Card */}
                <div className="p-5 bg-slate-950 border border-slate-800 text-white rounded-2xl flex items-center justify-between shadow-inner">
                  <div>
                    <div className="text-[10px] font-mono uppercase tracking-widest text-slate-400 dark:text-slate-500">
                      Antigravity Health Score
                    </div>
                    <div className="font-mono text-4xl font-extrabold text-emerald-400 tracking-tight tabular-nums mt-1">
                      {selectedMetric.formattedPercentage}
                    </div>
                    <div className="text-xs text-slate-300 dark:text-slate-400 font-medium mt-1">
                      {selectedMetric.primaryMetric} • {selectedMetric.secondaryMetric}
                    </div>
                  </div>

                  <div className="text-right space-y-1">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-500/20 text-emerald-400 text-xs font-mono font-bold rounded-full border border-emerald-500/30">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {selectedMetric.status}
                    </span>
                    <div className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">
                      Last probed: {state.lastUpdated.toLocaleTimeString()}
                    </div>
                  </div>
                </div>

                {/* Description */}
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-normal bg-slate-50 dark:bg-slate-950/30 p-3.5 rounded-xl border border-slate-100 dark:border-slate-800">
                  {selectedMetric.description}
                </p>

                {/* Technical Parameter Grid */}
                <div className="space-y-2">
                  <div className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                    Telemetry Parameters
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {Object.entries(selectedMetric.technicalDetails).map(([key, val]) => (
                      <div
                        key={key}
                        className="p-2.5 bg-slate-50 dark:bg-slate-950/30 border border-slate-200/70 dark:border-slate-800 rounded-xl flex flex-col justify-between"
                      >
                        <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-400">{key}</span>
                        <span className="font-mono font-bold text-slate-900 dark:text-white tabular-nums truncate">
                          {String(val)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Toast message if drill run */}
                {drillSuccess && (
                  <div className="p-3 bg-emerald-50/10 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40 text-emerald-800 dark:text-emerald-300 rounded-xl text-xs font-medium flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>{drillSuccess}</span>
                  </div>
                )}
              </div>

              {/* Modal Actions */}
              <div className="p-5 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    onClick={refresh}
                    disabled={loading}
                    className="flex-1 sm:flex-none px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                    <span>Probe Antigravity</span>
                  </button>
                  <button
                    onClick={handleRunOptimization}
                    disabled={optimizing || isHealing}
                    className="flex-1 sm:flex-none px-4 py-2 bg-slate-900 hover:bg-slate-800 dark:bg-slate-850 dark:hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-1.5 shadow-xs disabled:opacity-60 cursor-pointer"
                  >
                    <Zap className={`w-3.5 h-3.5 text-amber-400 ${optimizing ? 'animate-spin' : ''}`} />
                    <span>{optimizing ? 'Optimizing...' : 'Run Self-Healing Hotfix'}</span>
                  </button>
                </div>

                <button
                  onClick={() => setSelectedMetric(null)}
                  className="w-full sm:w-auto px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white transition-colors cursor-pointer"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
