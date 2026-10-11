import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  WifiOff,
  Wifi,
  Database,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ArrowRight,
  ChevronRight,
  Download,
  Layers,
  HardDrive,
  Zap,
  Play,
  X,
  Maximize2,
  Minimize2,
  Server,
  ShieldCheck,
  Eye,
  ShoppingBag,
} from 'lucide-react';
import { useNetworkResilience } from '../context/NetworkResilienceContext';
import { formatSatangToThb } from '../types/prodx';

export const NetworkResilienceOverlay: React.FC = () => {
  const {
    effectiveIsOnline,
    isOnline,
    isSimulatedOffline,
    setSimulatedOffline,
    disconnectedAt,
    pendingTransactions,
    pendingCount,
    totalPendingSatang,
    isSyncing,
    syncProgress,
    isOverlayOpen,
    isMinimized,
    dismissOverlay,
    expandOverlay,
    toggleSimulatedOffline,
    syncPendingTransactions,
    checkConnectionNow,
    createMockOfflineOrder,
    clearPendingQueue,
  } = useNetworkResilience();

  const [isQueueListExpanded, setIsQueueListExpanded] = useState<boolean>(true);
  const [isCheckingConnection, setIsCheckingConnection] = useState<boolean>(false);

  const handleSyncAllNow = async () => {
    if (pendingCount === 0 || isSyncing) return;
    if (isSimulatedOffline) {
      setSimulatedOffline(false);
    }
    await syncPendingTransactions();
  };

  // Time elapsed since disconnected
  const timeElapsedStr = React.useMemo(() => {
    if (!disconnectedAt) return 'Just now';
    const seconds = Math.max(1, Math.round((Date.now() - disconnectedAt.getTime()) / 1000));
    if (seconds < 60) return `${seconds}s ago`;
    const mins = Math.floor(seconds / 60);
    return `${mins}m ${seconds % 60}s ago`;
  }, [disconnectedAt]);

  const handleCheckConnection = async () => {
    setIsCheckingConnection(true);
    await checkConnectionNow();
    setTimeout(() => setIsCheckingConnection(false), 600);
  };

  const handleExportJson = () => {
    const dataStr =
      'data:text/json;charset=utf-8,' +
      encodeURIComponent(JSON.stringify(pendingTransactions, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute(
      'download',
      `prodx-offline-wal-backup-${new Date().toISOString().slice(0, 19)}.json`
    );
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <>
      {/* 1. Full Glassmorphism Visual Overlay (triggers when offline and not minimized) */}
      <AnimatePresence>
        {!effectiveIsOnline && isOverlayOpen && !isMinimized && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-950/80 backdrop-blur-md overflow-y-auto"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="relative w-full max-w-3xl bg-slate-900 border border-amber-500/30 rounded-3xl shadow-2xl overflow-hidden text-slate-100 my-auto"
            >
              {/* Subtle Ambient Alert Aura */}
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-amber-500 via-rose-500 to-amber-500 animate-pulse" />

              {/* Header Banner */}
              <div className="p-6 sm:p-8 space-y-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="relative p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-2xl shrink-0">
                      <WifiOff className="w-8 h-8 text-amber-400" />
                      <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-rose-500" />
                      </span>
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-xs font-mono text-amber-400 font-bold uppercase tracking-widest">
                        <span>Network Resilience Engaged</span>
                        <span aria-hidden="true" className="text-slate-600">·</span>
                        <span>Disconnected {timeElapsedStr}</span>
                      </div>
                      <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                        Terminal in Offline Mode
                      </h2>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={dismissOverlay}
                    title="Minimize to Persistent Floating Bar (Continue Checkout)"
                    className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer shrink-0"
                  >
                    <Minimize2 className="w-5 h-5" />
                  </button>
                </div>

                <p className="text-sm text-slate-300 font-medium leading-relaxed">
                  Cloud network connection has been severed. The terminal is operating autonomously using
                  local SQLite & Write-Ahead-Log (WAL) storage. You can continue scanning barcodes,
                  ringing up sales, and printing receipts. All transactions are securely cached on device
                  and will sync to the database automatically when reconnected.
                </p>

                {/* KPI Highlight: Real-Time Pending Count Counter */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* Big Live Pending Counter */}
                  <div className="sm:col-span-2 p-5 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-center justify-between gap-4 relative overflow-hidden">
                    <div className="space-y-1 relative z-10">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-amber-300 flex items-center gap-2 font-mono">
                        <Database className="w-3.5 h-3.5" />
                        <span>Pending Cloud Sync Queue</span>
                        <span className="inline-block w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                      </div>
                      <div className="text-4xl sm:text-5xl font-black text-white font-mono tracking-tight tabular-nums flex items-baseline gap-2">
                        <span>{pendingCount}</span>
                        <span className="text-xs font-medium text-amber-300/80 font-sans uppercase">
                          {pendingCount === 1 ? 'Transaction' : 'Transactions'} Waiting
                        </span>
                      </div>
                      <div className="text-xs text-slate-300 font-medium">
                        Queue Value:{' '}
                        <span className="font-bold text-white font-mono">
                          ฿{formatSatangToThb(totalPendingSatang)}
                        </span>
                      </div>
                    </div>

                    <div className="shrink-0 text-right space-y-2 relative z-10 flex flex-col items-end">
                      <button
                        type="button"
                        onClick={handleSyncAllNow}
                        disabled={isSyncing || pendingCount === 0}
                        title="Process and commit all pending transactions to cloud database now"
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 shadow-md shadow-emerald-600/20 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                        <span>{isSyncing ? 'Processing...' : 'Sync All Now'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={createMockOfflineOrder}
                        title="Add a simulated sale to verify real-time counter increment"
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-300 hover:text-white text-[11px] font-bold rounded-xl transition-all flex items-center gap-1.5 border border-slate-700 cursor-pointer"
                      >
                        <ShoppingBag className="w-3 h-3 text-amber-400" />
                        <span>+ Test Sale</span>
                      </button>
                    </div>

                    {/* Background Decorative Grid */}
                    <div className="absolute right-0 bottom-0 opacity-5 pointer-events-none">
                      <HardDrive className="w-32 h-32 text-amber-400 -mr-6 -mb-6" />
                    </div>
                  </div>

                  {/* Engine Specs */}
                  <div className="p-5 bg-slate-800/60 border border-slate-700/60 rounded-2xl space-y-3 font-mono text-xs">
                    <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider font-sans">
                      Device Reliability
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Local Engine:</span>
                        <span className="text-emerald-400 font-bold">WAL IndexedDB</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Data Integrity:</span>
                        <span className="text-emerald-400 font-bold">SHA-256 Chained</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Sync Status:</span>
                        <span className="text-amber-400 font-bold">Paused (Offline)</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Queue Inspector: Real-Time Breakdown of Pending Transactions */}
                <div className="border border-slate-800 rounded-2xl bg-slate-950/60 overflow-hidden">
                  <div
                    onClick={() => setIsQueueListExpanded(!isQueueListExpanded)}
                    className="p-4 flex items-center justify-between bg-slate-800/40 hover:bg-slate-800/70 transition-colors cursor-pointer select-none"
                  >
                    <div className="flex items-center gap-2">
                      <Layers className="w-4 h-4 text-amber-400" />
                      <span className="text-xs font-bold text-white uppercase tracking-wider font-mono">
                        Write-Ahead-Log Outbox ({pendingCount} Records)
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-slate-400 font-mono">
                      <span>Click to {isQueueListExpanded ? 'Collapse' : 'Expand'}</span>
                      <ChevronRight
                        className={`w-4 h-4 transition-transform duration-200 ${
                          isQueueListExpanded ? 'rotate-90' : ''
                        }`}
                      />
                    </div>
                  </div>

                  {isQueueListExpanded && (
                    <div className="max-h-56 overflow-y-auto divide-y divide-slate-800/80 p-2 font-mono text-xs">
                      {pendingTransactions.length === 0 ? (
                        <div className="p-8 text-center text-slate-500 space-y-2">
                          <CheckCircle2 className="w-6 h-6 text-emerald-500 mx-auto" />
                          <p className="font-sans font-bold text-slate-400">
                            Outbox queue is empty
                          </p>
                          <p className="text-[11px] font-sans">
                            Any sales completed in offline mode will safely register here in real time.
                          </p>
                        </div>
                      ) : (
                        pendingTransactions.map((tx, idx) => (
                          <div
                            key={tx.idempotencyKey || idx}
                            className="p-3 hover:bg-slate-900/60 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg"
                          >
                            <div className="space-y-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-amber-400">
                                  #{idx + 1} {tx.orderNumber || 'PX-WAL'}
                                </span>
                                <span className="text-slate-500 text-[10px]">
                                  {tx.idempotencyKey.slice(0, 16)}...
                                </span>
                              </div>
                              <div className="text-slate-400 text-[11px] font-sans line-clamp-1">
                                {tx.items?.map((it) => `${it.qty}x ${it.nameEn || it.nameTh || 'Item'}`).join(', ') || 'Order items'}
                              </div>
                            </div>

                            <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0">
                              <div className="text-right">
                                <div className="text-sm font-bold text-white">
                                  ฿{formatSatangToThb(tx.totalSatang || 0)}
                                </div>
                                <div className="text-[10px] text-slate-500 uppercase">
                                  {tx.paymentMethod || 'CASH'}
                                </div>
                              </div>
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                Pending Sync
                              </span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>

                {/* Sync Progress Bar (If sync active) */}
                {isSyncing && syncProgress && (
                  <div className="space-y-2 p-4 bg-emerald-950/30 border border-emerald-500/30 rounded-xl font-mono text-xs">
                    <div className="flex items-center justify-between text-emerald-300">
                      <span className="flex items-center gap-2 font-bold">
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Synchronizing WAL Outbox to Cloud Database...</span>
                      </span>
                      <span>
                        {syncProgress.synced} / {syncProgress.total} Complete
                      </span>
                    </div>
                    <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 transition-all duration-300"
                        style={{
                          width: `${(syncProgress.synced / syncProgress.total) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* Footer Controls & Primary Actions */}
                <div className="pt-4 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={handleCheckConnection}
                      disabled={isCheckingConnection}
                      className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-300 hover:text-white text-xs font-bold rounded-xl transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      <RefreshCw
                        className={`w-3.5 h-3.5 text-slate-400 ${
                          isCheckingConnection ? 'animate-spin' : ''
                        }`}
                      />
                      <span>Ping Health</span>
                    </button>

                    <button
                      type="button"
                      onClick={toggleSimulatedOffline}
                      className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-300 hover:text-white text-xs font-bold rounded-xl transition-all flex items-center gap-2 cursor-pointer"
                    >
                      <Wifi className="w-3.5 h-3.5 text-emerald-400" />
                      <span>{isSimulatedOffline ? 'Restore Connection' : 'Sever Connection'}</span>
                    </button>

                    {pendingCount > 0 && (
                      <button
                        type="button"
                        onClick={handleExportJson}
                        title="Download raw WAL transactions backup JSON"
                        className="px-3 py-2 bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5 inline mr-1" />
                        <span>Backup JSON</span>
                      </button>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
                    {/* Sync All Now Manual Trigger Button */}
                    <button
                      type="button"
                      onClick={handleSyncAllNow}
                      disabled={isSyncing || pendingCount === 0}
                      title="Manually trigger immediate sync replay for all pending offline transactions"
                      className="flex-1 sm:flex-initial px-5 py-3 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-lg shadow-emerald-600/20 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                      <span>
                        {isSyncing
                          ? `Syncing (${syncProgress?.synced || 0}/${syncProgress?.total || pendingCount})...`
                          : 'Sync All Now'}
                      </span>
                    </button>

                    {/* Primary Button: Minimize and continue taking orders */}
                    <button
                      type="button"
                      onClick={dismissOverlay}
                      className="flex-1 sm:flex-initial px-6 py-3 bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-lg shadow-amber-500/20 cursor-pointer flex items-center justify-center gap-2"
                    >
                      <span>Continue Taking Sales (Offline)</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 2. Persistent Floating HUD Bar (Visible when in offline mode, so cashiers are informed in real-time) */}
      <AnimatePresence>
        {!effectiveIsOnline && isMinimized && (
          <motion.div
            initial={{ y: -40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -40, opacity: 0 }}
            className="fixed top-3 left-1/2 -translate-x-1/2 z-40 max-w-xl w-[92%] sm:w-auto"
          >
            <div className="flex items-center justify-between gap-4 px-4 py-2.5 bg-slate-900/95 text-white border border-amber-500/40 rounded-full shadow-2xl backdrop-blur-md">
              <div
                onClick={expandOverlay}
                className="flex items-center gap-3 cursor-pointer group"
              >
                <div className="relative flex items-center justify-center">
                  <span className="animate-ping absolute inline-flex h-3 w-3 rounded-full bg-amber-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500" />
                </div>

                <div className="flex items-center gap-2 text-xs font-mono">
                  <span className="font-extrabold text-amber-400 uppercase tracking-wider">
                    Offline Mode
                  </span>
                  <span aria-hidden="true" className="text-slate-600">·</span>
                  <span className="text-slate-300 font-bold group-hover:text-white transition-colors">
                    {pendingCount} Pending Sync
                  </span>
                  {totalPendingSatang > 0 && (
                    <>
                      <span aria-hidden="true" className="text-slate-600">·</span>
                      <span className="text-slate-400 font-bold">
                        ฿{formatSatangToThb(totalPendingSatang)}
                      </span>
                    </>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={createMockOfflineOrder}
                  title="Add quick offline test sale"
                  className="px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-[11px] font-bold rounded-full transition-colors cursor-pointer font-mono"
                >
                  + Sale
                </button>

                {pendingCount > 0 && (
                  <button
                    type="button"
                    onClick={handleSyncAllNow}
                    disabled={isSyncing}
                    title="Process and commit all pending transactions to database now"
                    className="px-2.5 py-1 bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-300 text-[11px] font-bold rounded-full transition-colors cursor-pointer font-mono flex items-center gap-1 border border-emerald-500/30 disabled:opacity-40"
                  >
                    <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
                    <span>Sync All</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={toggleSimulatedOffline}
                  title="Restore network connection"
                  className="px-2.5 py-1 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-[11px] font-bold rounded-full transition-colors cursor-pointer font-mono flex items-center gap-1"
                >
                  <Wifi className="w-3 h-3" />
                  <span>Online</span>
                </button>

                <button
                  type="button"
                  onClick={expandOverlay}
                  title="Expand Network Resilience details"
                  className="p-1 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
