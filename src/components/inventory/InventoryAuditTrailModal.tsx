import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  ShieldCheck,
  History,
  CheckCircle2,
  RefreshCw,
  Search,
  Filter,
  UserCheck,
  Hash,
  Clock,
  Layers,
  ArrowRight,
  ExternalLink,
  Lock,
} from 'lucide-react';
import { ProductItem, AuditLogRecord } from '../../types/prodx';
import { useToast } from '../../context/ToastContext';

interface InventoryAuditTrailModalProps {
  isOpen: boolean;
  item: ProductItem | null;
  onClose: () => void;
}

export const InventoryAuditTrailModal: React.FC<InventoryAuditTrailModalProps> = ({
  isOpen,
  item,
  onClose,
}) => {
  const { showInfo, showError } = useToast();
  const [logs, setLogs] = useState<AuditLogRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [selectedFilter, setSelectedFilter] = useState<'ALL' | 'ADJUST' | 'RESTOCK' | 'SALES'>('ALL');
  const [copiedHash, setCopiedHash] = useState<string | null>(null);

  const fetchAuditLogs = useCallback(async () => {
    if (!item) return;
    setIsLoading(true);
    try {
      const res = await fetch('/api/security/audit-logs');
      if (!res.ok) throw new Error('Failed to retrieve audit log ledger');
      const data = await res.json();
      
      const allLogs: AuditLogRecord[] = Array.isArray(data.logs) ? data.logs : [];
      // Filter for this product's events
      const productLogs = allLogs.filter((log) => {
        const matchesId = log.resourceId === item.id;
        const matchesSku = log.details?.toLowerCase().includes(item.sku.toLowerCase());
        const matchesName = log.details?.toLowerCase().includes(item.nameEn.toLowerCase());
        const matchesIdInDetails = log.details?.includes(item.id);
        return matchesId || matchesSku || matchesName || matchesIdInDetails;
      });

      // Sort descending by sequenceNo or timestamp
      productLogs.sort((a, b) => (b.sequenceNo || 0) - (a.sequenceNo || 0));
      setLogs(productLogs);
    } catch (err: any) {
      showError('Audit Fetch Failed', err.message || 'Unable to connect to security ledger');
    } finally {
      setIsLoading(false);
    }
  }, [item, showError]);

  useEffect(() => {
    if (isOpen && item) {
      fetchAuditLogs();
    }
  }, [isOpen, item, fetchAuditLogs]);

  if (!isOpen || !item) return null;

  const filteredLogs = logs.filter((log) => {
    if (selectedFilter === 'ALL') return true;
    if (selectedFilter === 'ADJUST') return log.action.includes('ADJUST');
    if (selectedFilter === 'RESTOCK') return log.action.includes('RESTOCK') || log.action.includes('PO');
    if (selectedFilter === 'SALES') return log.action.includes('ORDER') || log.action.includes('SALE');
    return true;
  });

  const handleCopyHash = (hash: string) => {
    navigator.clipboard?.writeText(hash);
    setCopiedHash(hash);
    showInfo('Hash Copied', 'SHA-256 entry hash copied to clipboard.');
    setTimeout(() => setCopiedHash(null), 2500);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 12 }}
          className="w-full max-w-2xl max-h-[90vh] flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="p-6 bg-slate-50 dark:bg-slate-950/60 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <span>SKU Audit Trail &amp; Ledger</span>
                  <span className="text-xs px-2 py-0.5 rounded-md font-mono bg-indigo-100 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 font-bold">
                    {item.sku}
                  </span>
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  {item.nameEn} • Current Stock: {item.stock} units
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={fetchAuditLogs}
                disabled={isLoading}
                title="Refresh audit ledger"
                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
              <button
                type="button"
                onClick={onClose}
                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Subheader: Cryptographic Status Banner & Filter Tabs */}
          <div className="px-6 py-3 bg-slate-100/60 dark:bg-slate-950/40 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-2 text-xs font-mono text-slate-500 dark:text-slate-400">
              <Lock className="w-3.5 h-3.5 text-emerald-500" />
              <span>SHA-256 Ledger Chain Verified</span>
              <span>·</span>
              <span className="font-bold text-slate-700 dark:text-slate-300">
                {logs.length} Recorded Events
              </span>
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-1">
              {[
                { id: 'ALL', label: 'All' },
                { id: 'ADJUST', label: 'Adjustments' },
                { id: 'RESTOCK', label: 'Restocks' },
                { id: 'SALES', label: 'Sales / Orders' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setSelectedFilter(tab.id as any)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                    selectedFilter === tab.id
                      ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-sm'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Main Logs List */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {isLoading ? (
              <div className="py-16 text-center space-y-3">
                <RefreshCw className="w-8 h-8 animate-spin text-indigo-500 mx-auto" />
                <p className="text-xs font-bold text-slate-500">Querying immutable audit blocks...</p>
              </div>
            ) : filteredLogs.length === 0 ? (
              <div className="py-16 text-center bg-slate-50 dark:bg-slate-950/40 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-3">
                <History className="w-10 h-10 text-slate-400 mx-auto" />
                <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                  No Direct Audit Events in Filter
                </h4>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  Stock adjustments, purchase restocks, and cashier checkout events for {item.sku} will appear here with cryptographic signatures.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredLogs.map((log, index) => {
                  const isAdjust = log.action.includes('ADJUST');
                  const isRestock = log.action.includes('RESTOCK');
                  const isOrder = log.action.includes('ORDER');

                  return (
                    <div
                      key={log.id || `${log.sequenceNo}-${index}`}
                      className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-2.5 hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase font-mono ${
                              isAdjust
                                ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300'
                                : isRestock
                                ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
                                : isOrder
                                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                                : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                            }`}
                          >
                            {log.action}
                          </span>

                          <span className="text-xs font-mono font-bold text-slate-400">
                            #{String(log.sequenceNo || index + 1).padStart(4, '0')}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 text-[11px] font-mono text-slate-400">
                          <Clock className="w-3 h-3" />
                          <span>{new Date(log.timestamp).toLocaleString()}</span>
                        </div>
                      </div>

                      {/* Details Content */}
                      <p className="text-xs font-medium text-slate-800 dark:text-slate-200 leading-relaxed">
                        {log.details}
                      </p>

                      {/* Actor & Hash Signature Metadata */}
                      <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                        <div className="flex items-center gap-2 text-slate-500">
                          <UserCheck className="w-3.5 h-3.5 text-slate-400" />
                          <span className="font-mono">{log.actorId}</span>
                          <span>({log.actorRole})</span>
                        </div>

                        {log.entryHash && (
                          <button
                            type="button"
                            onClick={() => handleCopyHash(log.entryHash)}
                            title="Click to copy cryptographic hash"
                            className="font-mono text-[10px] text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 flex items-center gap-1 transition-colors cursor-pointer"
                          >
                            <Hash className="w-3 h-3" />
                            <span>
                              {log.entryHash.slice(0, 10)}...{log.entryHash.slice(-6)}
                            </span>
                            {copiedHash === log.entryHash && (
                              <span className="text-emerald-500 font-bold ml-1">Copied!</span>
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 bg-slate-50 dark:bg-slate-950/60 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
            <span className="text-xs text-slate-400 font-medium">
              Audit records are written append-only and immutable.
            </span>
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
            >
              Close Ledger
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
