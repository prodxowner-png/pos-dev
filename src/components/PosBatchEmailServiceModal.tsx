import React, { useState, useEffect } from 'react';
import {
  Mail,
  Send,
  CheckCircle2,
  AlertCircle,
  Clock,
  RefreshCw,
  X,
  Filter,
  Sparkles,
  Edit2,
  Check,
  History,
  ShieldCheck,
  Zap,
  Users,
  Search,
  CheckSquare,
  Square
} from 'lucide-react';
import { PosOrderRecord, formatSatangToThb } from '../types/prodx';

interface PosBatchEmailServiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  orders: PosOrderRecord[];
  onOrdersUpdated?: (updatedOrders: PosOrderRecord[]) => void;
}

interface ReceiptHistoryLog {
  id: string;
  batchId?: string;
  orderId: string;
  orderNumber: string;
  recipientEmail: string;
  totalSatang: number;
  sentAt: string;
  status: string;
  dispatchMode?: string;
}

export const PosBatchEmailServiceModal: React.FC<PosBatchEmailServiceModalProps> = ({
  isOpen,
  onClose,
  orders,
  onOrdersUpdated
}) => {
  const [activeTab, setActiveTab] = useState<'DISPATCH' | 'HISTORY'>('DISPATCH');
  const [localOrders, setLocalOrders] = useState<PosOrderRecord[]>([]);
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set());
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'SENT' | 'FAILED'>('PENDING');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [forceResend, setForceResend] = useState<boolean>(false);
  const [autoShiftDispatch, setAutoShiftDispatch] = useState<boolean>(() => {
    return localStorage.getItem('prodx_auto_batch_email_receipts') === 'true';
  });

  // Inline editing state
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [editingEmailInput, setEditingEmailInput] = useState<string>('');

  // Execution state
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [dispatchResult, setDispatchResult] = useState<{
    batchId: string;
    sentCount: number;
    failedCount: number;
    skippedCount: number;
    message: string;
  } | null>(null);

  // History state
  const [historyLogs, setHistoryLogs] = useState<ReceiptHistoryLog[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState<boolean>(false);

  // Synchronize orders on mount or when props change
  useEffect(() => {
    if (isOpen) {
      setLocalOrders(orders);
      fetchHistory();
    }
  }, [isOpen, orders]);

  // Handle auto-shift dispatch setting save
  const handleToggleAutoShift = (enabled: boolean) => {
    setAutoShiftDispatch(enabled);
    localStorage.setItem('prodx_auto_batch_email_receipts', enabled ? 'true' : 'false');
  };

  const fetchHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const res = await fetch('/api/receipts/history');
      if (res.ok) {
        const data = await res.json();
        if (data.history) {
          setHistoryLogs(data.history);
        }
      }
    } catch (err) {
      console.error('Failed to load receipt history:', err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  if (!isOpen) return null;

  // Filter orders where an email exists or is being added
  const eligibleOrders = localOrders.filter((ord) => {
    const email = ord.customerEmail || (ord as any).recipientEmail;
    const hasEmail = Boolean(email && email.includes('@'));
    
    // Status match
    let matchesStatus = true;
    const currentStatus = ord.emailReceiptStatus || 'PENDING';
    if (statusFilter === 'PENDING') matchesStatus = currentStatus === 'PENDING' || !ord.emailReceiptStatus;
    else if (statusFilter === 'SENT') matchesStatus = currentStatus === 'SENT';
    else if (statusFilter === 'FAILED') matchesStatus = currentStatus === 'FAILED';

    // Search query match
    let matchesSearch = true;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      matchesSearch =
        ord.orderNumber.toLowerCase().includes(q) ||
        (ord.customerName || '').toLowerCase().includes(q) ||
        (email || '').toLowerCase().includes(q);
    }

    return hasEmail && matchesStatus && matchesSearch;
  });

  // Calculate metrics
  const totalWithEmail = localOrders.filter((o) => Boolean(o.customerEmail || (o as any).recipientEmail)).length;
  const pendingCount = localOrders.filter(
    (o) => Boolean(o.customerEmail || (o as any).recipientEmail) && (!o.emailReceiptStatus || o.emailReceiptStatus === 'PENDING')
  ).length;
  const sentCount = localOrders.filter(
    (o) => Boolean(o.customerEmail || (o as any).recipientEmail) && o.emailReceiptStatus === 'SENT'
  ).length;
  const failedCount = localOrders.filter(
    (o) => Boolean(o.customerEmail || (o as any).recipientEmail) && o.emailReceiptStatus === 'FAILED'
  ).length;

  const toggleSelectOrder = (id: string) => {
    const next = new Set(selectedOrderIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedOrderIds(next);
  };

  const selectAllEligible = () => {
    if (selectedOrderIds.size === eligibleOrders.length) {
      setSelectedOrderIds(new Set());
    } else {
      setSelectedOrderIds(new Set(eligibleOrders.map((o) => o.id)));
    }
  };

  const handleSaveInlineEmail = (orderId: string) => {
    if (!editingEmailInput.includes('@')) return;
    const nextOrders = localOrders.map((ord) => {
      if (ord.id === orderId) {
        return {
          ...ord,
          customerEmail: editingEmailInput,
          emailReceiptStatus: 'PENDING' as const
        };
      }
      return ord;
    });
    setLocalOrders(nextOrders);
    if (onOrdersUpdated) onOrdersUpdated(nextOrders);
    setEditingOrderId(null);
    setEditingEmailInput('');
  };

  const handleTriggerBatchDispatch = async () => {
    const ordersToProcess =
      selectedOrderIds.size > 0
        ? localOrders.filter((o) => selectedOrderIds.has(o.id))
        : eligibleOrders;

    if (ordersToProcess.length === 0) return;

    setIsProcessing(true);
    setProgressPercent(15);
    setDispatchResult(null);

    try {
      const interval = setInterval(() => {
        setProgressPercent((prev) => (prev >= 85 ? 85 : prev + 15));
      }, 250);

      const response = await fetch('/api/receipts/batch-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer prodx-cashier-session'
        },
        body: JSON.stringify({
          forceResend,
          orders: ordersToProcess
        })
      });

      clearInterval(interval);
      setProgressPercent(100);

      const data = await response.json();
      if (data.ok) {
        setDispatchResult({
          batchId: data.batchId,
          sentCount: data.sentCount,
          failedCount: data.failedCount,
          skippedCount: data.skippedCount,
          message: data.message
        });

        // Update local orders state
        const sentMap = new Map<string, string>();
        if (data.results) {
          data.results.forEach((r: any) => sentMap.set(r.orderId, r.status));
        }

        const updated = localOrders.map((ord) => {
          if (sentMap.has(ord.id)) {
            const status = sentMap.get(ord.id) as 'SENT' | 'FAILED';
            return {
              ...ord,
              emailReceiptStatus: status,
              emailSentAt: new Date().toISOString()
            };
          }
          return ord;
        });

        setLocalOrders(updated);
        if (onOrdersUpdated) onOrdersUpdated(updated);
        fetchHistory();
      } else {
        alert(`Batch email service error: ${data.message || data.error}`);
      }
    } catch (err: any) {
      alert(`Network error triggering batch email service: ${err.message}`);
    } finally {
      setIsProcessing(false);
      setSelectedOrderIds(new Set());
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-5xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 py-5 border-b border-slate-800 bg-slate-900/90 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Mail className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white tracking-wide">
                  Automated Batch Email Receipt Service
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                  <Zap className="w-3 h-3" /> ONLINE
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Bulk dispatch digital receipts to customers who provided an email during POS transactions
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="bg-slate-800/80 border border-slate-700/60 rounded-xl p-1 flex items-center gap-1 text-xs">
              <button
                onClick={() => setActiveTab('DISPATCH')}
                className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                  activeTab === 'DISPATCH'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <Send className="w-3.5 h-3.5" />
                  <span>Batch Queue</span>
                  {pendingCount > 0 && (
                    <span className="bg-amber-500 text-slate-950 text-[10px] font-bold rounded-full px-1.5 py-0.2">
                      {pendingCount}
                    </span>
                  )}
                </div>
              </button>
              <button
                onClick={() => setActiveTab('HISTORY')}
                className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                  activeTab === 'HISTORY'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <History className="w-3.5 h-3.5" />
                  <span>Audit Logs</span>
                </div>
              </button>
            </div>

            <button
              onClick={onClose}
              className="w-9 h-9 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors border border-slate-700/50"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Quick Stats Metrics Banner */}
        <div className="px-6 py-3 bg-slate-950/60 border-b border-slate-800/80 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-2.5 flex items-center justify-between">
            <div>
              <div className="text-slate-400 text-[10px] uppercase tracking-wider">Recorded Customer Emails</div>
              <div className="text-base font-bold text-white mt-0.5">{totalWithEmail} Orders</div>
            </div>
            <Users className="w-5 h-5 text-indigo-400 opacity-60" />
          </div>

          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-2.5 flex items-center justify-between">
            <div>
              <div className="text-amber-400 text-[10px] uppercase tracking-wider">Pending Email Queue</div>
              <div className="text-base font-bold text-amber-300 mt-0.5">{pendingCount} Ready</div>
            </div>
            <Clock className="w-5 h-5 text-amber-400 opacity-60 animate-spin-slow" />
          </div>

          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-2.5 flex items-center justify-between">
            <div>
              <div className="text-emerald-400 text-[10px] uppercase tracking-wider">Dispatched Receipts</div>
              <div className="text-base font-bold text-emerald-300 mt-0.5">{sentCount} Sent</div>
            </div>
            <CheckCircle2 className="w-5 h-5 text-emerald-400 opacity-60" />
          </div>

          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-2.5 flex items-center justify-between">
            <div>
              <div className="text-rose-400 text-[10px] uppercase tracking-wider">Dispatch Failures</div>
              <div className="text-base font-bold text-rose-300 mt-0.5">{failedCount} Failed</div>
            </div>
            <AlertCircle className="w-5 h-5 text-rose-400 opacity-60" />
          </div>
        </div>

        {/* Main Content Body */}
        <div className="p-6 flex-1 overflow-y-auto space-y-4">
          {activeTab === 'DISPATCH' && (
            <>
              {/* Batch Settings Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/90 border border-slate-800 p-3 rounded-2xl">
                <div className="flex items-center gap-2 flex-1 min-w-[220px]">
                  <div className="relative w-full">
                    <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
                    <input
                      type="text"
                      placeholder="Search order #, customer name or email..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 rounded-xl p-1 text-xs font-mono">
                    <button
                      onClick={() => setStatusFilter('PENDING')}
                      className={`px-2.5 py-1 rounded-lg transition-colors ${
                        statusFilter === 'PENDING'
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Pending ({pendingCount})
                    </button>
                    <button
                      onClick={() => setStatusFilter('SENT')}
                      className={`px-2.5 py-1 rounded-lg transition-colors ${
                        statusFilter === 'SENT'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Sent ({sentCount})
                    </button>
                    <button
                      onClick={() => setStatusFilter('ALL')}
                      className={`px-2.5 py-1 rounded-lg transition-colors ${
                        statusFilter === 'ALL'
                          ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      All ({totalWithEmail})
                    </button>
                  </div>

                  <label className="flex items-center gap-2 text-xs font-mono text-slate-300 bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 cursor-pointer hover:border-slate-700">
                    <input
                      type="checkbox"
                      checked={forceResend}
                      onChange={(e) => setForceResend(e.target.checked)}
                      className="rounded border-slate-700 text-indigo-600 focus:ring-indigo-500 bg-slate-900"
                    />
                    <span>Force Re-send All</span>
                  </label>
                </div>
              </div>

              {/* Progress Bar when Processing */}
              {isProcessing && (
                <div className="bg-slate-950 border border-indigo-500/40 rounded-2xl p-4 space-y-2">
                  <div className="flex items-center justify-between text-xs font-mono text-indigo-300">
                    <div className="flex items-center gap-2">
                      <RefreshCw className="w-4 h-4 animate-spin text-indigo-400" />
                      <span>Automated Service Dispatching Receipts in Batch...</span>
                    </div>
                    <span>{progressPercent}%</span>
                  </div>
                  <div className="w-full bg-slate-900 rounded-full h-2.5 overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-400 h-2.5 rounded-full transition-all duration-300"
                      style={{ width: `${progressPercent}%` }}
                    ></div>
                  </div>
                </div>
              )}

              {/* Success Result Banner */}
              {dispatchResult && (
                <div className="bg-emerald-950/40 border border-emerald-500/40 rounded-2xl p-4 flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                  <div className="space-y-1 text-xs">
                    <div className="font-bold text-emerald-300 font-mono">
                      {dispatchResult.message} (Batch ID: {dispatchResult.batchId})
                    </div>
                    <div className="text-slate-300 flex items-center gap-3 font-mono">
                      <span>✅ Sent: <strong>{dispatchResult.sentCount}</strong></span>
                      <span>⚠️ Skipped: <strong>{dispatchResult.skippedCount}</strong></span>
                      {dispatchResult.failedCount > 0 && (
                        <span className="text-rose-400">❌ Failed: <strong>{dispatchResult.failedCount}</strong></span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Orders Table */}
              <div className="border border-slate-800 rounded-2xl overflow-hidden bg-slate-950/80">
                <div className="px-4 py-3 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between text-xs text-slate-400 font-mono">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={selectAllEligible}
                      className="flex items-center gap-1.5 hover:text-white transition-colors"
                    >
                      {selectedOrderIds.size > 0 && selectedOrderIds.size === eligibleOrders.length ? (
                        <CheckSquare className="w-4 h-4 text-indigo-400" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-600" />
                      )}
                      <span>Select All ({eligibleOrders.length})</span>
                    </button>
                    {selectedOrderIds.size > 0 && (
                      <span className="text-indigo-400 font-bold">
                        ({selectedOrderIds.size} Selected)
                      </span>
                    )}
                  </div>
                  <div>Showing {eligibleOrders.length} eligible customer transactions</div>
                </div>

                {eligibleOrders.length === 0 ? (
                  <div className="py-12 text-center space-y-3">
                    <Mail className="w-10 h-10 text-slate-600 mx-auto" />
                    <div className="text-slate-400 text-sm font-medium">No customer orders matching the filter</div>
                    <p className="text-slate-500 text-xs max-w-sm mx-auto">
                      Customers who provide an email address during transaction checkout will automatically queue here for batch receipt dispatch.
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-800/60 max-h-[380px] overflow-y-auto">
                    {eligibleOrders.map((ord) => {
                      const email = ord.customerEmail || (ord as any).recipientEmail || '';
                      const isSelected = selectedOrderIds.has(ord.id);
                      const isEditingThis = editingOrderId === ord.id;
                      const status = ord.emailReceiptStatus || 'PENDING';

                      return (
                        <div
                          key={ord.id}
                          className={`p-3.5 flex flex-wrap items-center justify-between gap-3 transition-colors ${
                            isSelected ? 'bg-indigo-950/20' : 'hover:bg-slate-900/60'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => toggleSelectOrder(ord.id)}
                              className="text-slate-500 hover:text-indigo-400 transition-colors"
                            >
                              {isSelected ? (
                                <CheckSquare className="w-4 h-4 text-indigo-400" />
                              ) : (
                                <Square className="w-4 h-4 text-slate-600" />
                              )}
                            </button>

                            <div className="space-y-0.5">
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-bold text-white text-xs">{ord.orderNumber}</span>
                                {ord.queueNumber && (
                                  <span className="text-[10px] bg-slate-800 text-slate-300 font-mono px-1.5 py-0.2 rounded">
                                    Queue #{ord.queueNumber}
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-slate-400 font-mono">
                                {new Date(ord.createdAt).toLocaleString('th-TH', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                  day: '2-digit',
                                  month: 'short'
                                })} • Cashier: {ord.cashierName}
                              </div>
                            </div>
                          </div>

                          {/* Email Address Column with inline editor */}
                          <div className="flex items-center gap-2 min-w-[220px]">
                            {isEditingThis ? (
                              <div className="flex items-center gap-1">
                                <input
                                  type="email"
                                  value={editingEmailInput}
                                  onChange={(e) => setEditingEmailInput(e.target.value)}
                                  className="bg-slate-900 border border-indigo-500 rounded px-2 py-1 text-xs text-white focus:outline-none"
                                  placeholder="customer@email.com"
                                  autoFocus
                                />
                                <button
                                  onClick={() => handleSaveInlineEmail(ord.id)}
                                  className="p-1 rounded bg-emerald-600 text-white hover:bg-emerald-500"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => setEditingOrderId(null)}
                                  className="p-1 rounded bg-slate-800 text-slate-400 hover:text-white"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5 group">
                                <span className="text-xs font-mono text-indigo-300 font-medium">
                                  {email || 'No email set'}
                                </span>
                                <button
                                  onClick={() => {
                                    setEditingOrderId(ord.id);
                                    setEditingEmailInput(email);
                                  }}
                                  className="opacity-0 group-hover:opacity-100 p-1 text-slate-500 hover:text-white transition-opacity"
                                  title="Edit customer email"
                                >
                                  <Edit2 className="w-3 h-3" />
                                </button>
                              </div>
                            )}
                          </div>

                          {/* Total Amount & Status Tag */}
                          <div className="flex items-center gap-4">
                            <div className="text-right font-mono">
                              <div className="text-xs font-bold text-emerald-400">
                                {formatSatangToThb(ord.totalSatang)}
                              </div>
                              <div className="text-[10px] text-slate-500">{ord.paymentMethod}</div>
                            </div>

                            <div>
                              {status === 'SENT' && (
                                <span className="px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                                  <CheckCircle2 className="w-3 h-3" /> SENT
                                </span>
                              )}
                              {status === 'PENDING' && (
                                <span className="px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold bg-amber-500/10 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                                  <Clock className="w-3 h-3 animate-pulse" /> QUEUED
                                </span>
                              )}
                              {status === 'FAILED' && (
                                <span className="px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold bg-rose-500/10 text-rose-400 border border-rose-500/30 flex items-center gap-1">
                                  <AlertCircle className="w-3 h-3" /> FAILED
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}

          {activeTab === 'HISTORY' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs font-mono text-slate-400 bg-slate-900 p-3 rounded-2xl border border-slate-800">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>Immutable Audit Logs for Batch Email Receipts</span>
                </div>
                <button
                  onClick={fetchHistory}
                  className="flex items-center gap-1 text-indigo-400 hover:text-indigo-300"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoadingHistory ? 'animate-spin' : ''}`} />
                  <span>Refresh Log</span>
                </button>
              </div>

              <div className="border border-slate-800 rounded-2xl overflow-hidden bg-slate-950/80 max-h-[420px] overflow-y-auto divide-y divide-slate-800/60">
                {historyLogs.length === 0 ? (
                  <div className="py-12 text-center text-slate-500 text-xs font-mono">
                    No batch receipt email logs recorded yet.
                  </div>
                ) : (
                  historyLogs.map((log) => (
                    <div key={log.id} className="p-3.5 flex items-center justify-between text-xs font-mono hover:bg-slate-900/50">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white">{log.orderNumber}</span>
                          <span className="text-slate-400">→</span>
                          <span className="text-indigo-300">{log.recipientEmail}</span>
                        </div>
                        <div className="text-[10px] text-slate-500">
                          {new Date(log.sentAt).toLocaleString('th-TH')} • Mode: {log.dispatchMode || 'BATCH_SERVICE'}
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="text-emerald-400 font-bold">
                          {formatSatangToThb(log.totalSatang)}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold">
                          {log.status}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Controls */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-900/90 flex flex-wrap items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-xs font-mono text-slate-400 hover:text-white cursor-pointer">
            <input
              type="checkbox"
              checked={autoShiftDispatch}
              onChange={(e) => handleToggleAutoShift(e.target.checked)}
              className="rounded border-slate-700 text-indigo-600 focus:ring-indigo-500 bg-slate-950"
            />
            <span>Auto-trigger batch email dispatch at Shift Close</span>
          </label>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold font-mono text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 transition-colors"
            >
              Close
            </button>

            {activeTab === 'DISPATCH' && (
              <button
                onClick={handleTriggerBatchDispatch}
                disabled={isProcessing || (selectedOrderIds.size === 0 && eligibleOrders.length === 0)}
                className="px-5 py-2.5 rounded-xl text-xs font-bold font-mono text-white bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 hover:from-indigo-500 hover:to-purple-500 active:scale-95 disabled:opacity-50 transition-all shadow-lg shadow-indigo-500/20 flex items-center gap-2"
              >
                {isProcessing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Processing Batch...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-amber-300 animate-bounce" />
                    <span>
                      Trigger Batch Email Dispatch{' '}
                      {selectedOrderIds.size > 0
                        ? `(${selectedOrderIds.size})`
                        : `(${eligibleOrders.length})`}
                    </span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
