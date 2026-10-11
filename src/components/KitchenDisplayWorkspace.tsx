import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Coffee,
  Clock,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Volume2,
  VolumeX,
  ChefHat,
  Filter,
  Flame,
  BellRing,
  RefreshCw,
  ShoppingBag,
  User,
  Sparkles,
} from 'lucide-react';
import { PosOrderRecord, OrderItemLine } from '../types/prodx';
import { useToast } from '../context/ToastContext';

interface KitchenDisplayWorkspaceProps {
  orders: PosOrderRecord[];
  onOrderStatusUpdated?: (order: PosOrderRecord) => void;
}

type StationFilter = 'ALL' | 'BARISTA' | 'KITCHEN';
type StatusTab = 'ACTIVE' | 'PENDING' | 'PREPARING' | 'READY' | 'COMPLETED';

// Web Audio API Synthesized Chime (zero external audio file dependency)
const playChimeSound = (type: 'READY' | 'BUMP' | 'ALERT' = 'READY') => {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();

    if (type === 'READY') {
      // 2-tone pleasant dinner bell
      const now = ctx.currentTime;
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(587.33, now); // D5
      osc1.frequency.exponentialRampToValueAtTime(880, now + 0.15); // A5
      gain1.gain.setValueAtTime(0.3, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.8);

      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(880, now + 0.2); // A5
      osc2.frequency.exponentialRampToValueAtTime(1174.66, now + 0.35); // D6
      gain2.gain.setValueAtTime(0.25, now + 0.2);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 1.2);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.2);
      osc2.stop(now + 1.2);
    } else if (type === 'ALERT') {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(440, now);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.3);
    } else {
      // Simple bump tick
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(659.25, now);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.2);
    }
  } catch (err) {
    // Audio context may be suspended before user gesture
  }
};

export const KitchenDisplayWorkspace: React.FC<KitchenDisplayWorkspaceProps> = ({
  orders,
  onOrderStatusUpdated,
}) => {
  const { showSuccess, showWarning, showError: showToastError } = useToast();
  const [stationFilter, setStationFilter] = useState<StationFilter>('ALL');
  const [statusTab, setStatusTab] = useState<StatusTab>('ACTIVE');
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [currentTime, setCurrentTime] = useState<number>(Date.now());
  const [checkedItemIds, setCheckedItemIds] = useState<Record<string, boolean>>({});
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);

  // Update clock every second for live ticket timers
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Filter orders according to station
  const stationFilteredOrders = useMemo(() => {
    return orders.filter((order) => {
      if (order.status !== 'COMPLETED') return false; // Only non-voided/non-refunded orders

      if (stationFilter === 'BARISTA') {
        // Must contain coffee or beverage items
        return order.items.some((i) => i.sku.includes('CF') || i.sku.includes('BV'));
      }
      if (stationFilter === 'KITCHEN') {
        // Must contain bakery items
        return order.items.some((i) => i.sku.includes('BK'));
      }
      return true;
    });
  }, [orders, stationFilter]);

  // Status filtered orders
  const displayedOrders = useMemo(() => {
    return stationFilteredOrders.filter((order) => {
      const kdsStatus = order.kdsStatus || 'PENDING';
      if (statusTab === 'ACTIVE') {
        return kdsStatus === 'PENDING' || kdsStatus === 'PREPARING' || kdsStatus === 'READY';
      }
      return kdsStatus === statusTab;
    });
  }, [stationFilteredOrders, statusTab]);

  // Calculate ticket SLA elapsed time in seconds
  const getElapsedSeconds = useCallback((createdAt: string) => {
    const createdMs = new Date(createdAt).getTime();
    return Math.max(0, Math.floor((currentTime - createdMs) / 1000));
  }, [currentTime]);

  const formatElapsed = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Advance KDS Stage
  const handleAdvanceStatus = async (order: PosOrderRecord, nextStatus: 'PREPARING' | 'READY' | 'COMPLETED') => {
    setUpdatingOrderId(order.id);
    try {
      const res = await fetch(`/api/orders/${order.id}/kds-status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: nextStatus,
          stationName: stationFilter === 'ALL' ? 'CENTRAL_KDS' : stationFilter,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        if (soundEnabled) {
          if (nextStatus === 'READY') playChimeSound('READY');
          else playChimeSound('BUMP');
        }
        if (onOrderStatusUpdated) {
          onOrderStatusUpdated(data.order);
        }
        if (nextStatus === 'READY') {
          showSuccess('Order Ready!', `Ticket #${order.queueNumber || order.orderNumber} is ready for customer pickup.`);
        } else if (nextStatus === 'COMPLETED') {
          showSuccess('Order Collected', `Ticket #${order.queueNumber || order.orderNumber} fulfilled.`);
        }
      } else {
        showToastError('KDS Error', data.error || 'Failed to advance status');
      }
    } catch (err: any) {
      showToastError('KDS Error', err.message);
    } finally {
      setUpdatingOrderId(null);
    }
  };

  // Call / Announce Customer Bell
  const handleAnnounceTicket = (order: PosOrderRecord) => {
    if (soundEnabled) playChimeSound('READY');
    showSuccess('Chime Sounded', `Calling customer for Ticket #${order.queueNumber || order.orderNumber}!`);
  };

  const toggleItemCheck = (orderId: string, itemIdx: number) => {
    const key = `${orderId}-${itemIdx}`;
    setCheckedItemIds((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Metrics
  const activeCount = stationFilteredOrders.filter((o) => (o.kdsStatus || 'PENDING') !== 'COMPLETED').length;
  const pendingCount = stationFilteredOrders.filter((o) => (o.kdsStatus || 'PENDING') === 'PENDING').length;
  const preparingCount = stationFilteredOrders.filter((o) => o.kdsStatus === 'PREPARING').length;
  const readyCount = stationFilteredOrders.filter((o) => o.kdsStatus === 'READY').length;

  return (
    <div className="space-y-6 max-w-full">
      {/* Top Header & Controls */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-2xl shrink-0">
            <ChefHat className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
                Kitchen & Barista Display System (KDS)
              </h1>
              <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider animate-pulse">
                LIVE
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium">
              Zero-latency order orchestration, prep timing SLA, and ticket bump engine
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Station Filter */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-950 border border-slate-200/60 dark:border-slate-800 rounded-xl text-xs font-bold">
            <button
              onClick={() => setStationFilter('ALL')}
              className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                stationFilter === 'ALL'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
              }`}
            >
              All Stations
            </button>
            <button
              onClick={() => setStationFilter('BARISTA')}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                stationFilter === 'BARISTA'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
              }`}
            >
              <Coffee className="w-3.5 h-3.5 text-amber-500" />
              <span>Barista</span>
            </button>
            <button
              onClick={() => setStationFilter('KITCHEN')}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                stationFilter === 'KITCHEN'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
              }`}
            >
              <Flame className="w-3.5 h-3.5 text-rose-500" />
              <span>Kitchen</span>
            </button>
          </div>

          {/* Sound Toggle */}
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`p-2.5 rounded-xl border transition-colors cursor-pointer ${
              soundEnabled
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700'
            }`}
            title={soundEnabled ? 'Chime Sound Enabled' : 'Chime Sound Muted'}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* KPI & Status Filter Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <button
          onClick={() => setStatusTab('ACTIVE')}
          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
            statusTab === 'ACTIVE'
              ? 'bg-slate-900 dark:bg-slate-800 text-white border-slate-900 shadow-md ring-2 ring-emerald-500/30'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
          }`}
        >
          <div className="text-[10px] uppercase font-bold tracking-widest text-slate-400">In Production</div>
          <div className="text-2xl font-black font-mono mt-1">{activeCount}</div>
          <div className="text-[10px] text-emerald-400 font-bold mt-0.5">Active Prep Tickets</div>
        </button>

        <button
          onClick={() => setStatusTab('PENDING')}
          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
            statusTab === 'PENDING'
              ? 'bg-amber-600 text-white border-amber-600 shadow-md'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-amber-300'
          }`}
        >
          <div className="text-[10px] uppercase font-bold tracking-widest text-slate-400">Queue Stage</div>
          <div className="text-2xl font-black font-mono mt-1 text-amber-500 dark:text-amber-400">{pendingCount}</div>
          <div className="text-[10px] text-slate-500 font-bold mt-0.5">Waiting for Barista</div>
        </button>

        <button
          onClick={() => setStatusTab('PREPARING')}
          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
            statusTab === 'PREPARING'
              ? 'bg-blue-600 text-white border-blue-600 shadow-md'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-blue-300'
          }`}
        >
          <div className="text-[10px] uppercase font-bold tracking-widest text-slate-400">Brewing / Cooking</div>
          <div className="text-2xl font-black font-mono mt-1 text-blue-500 dark:text-blue-400">{preparingCount}</div>
          <div className="text-[10px] text-slate-500 font-bold mt-0.5">In Progress</div>
        </button>

        <button
          onClick={() => setStatusTab('READY')}
          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
            statusTab === 'READY'
              ? 'bg-emerald-600 text-white border-emerald-600 shadow-md'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-emerald-300'
          }`}
        >
          <div className="text-[10px] uppercase font-bold tracking-widest text-slate-400">Ready at Counter</div>
          <div className="text-2xl font-black font-mono mt-1 text-emerald-500 dark:text-emerald-400">{readyCount}</div>
          <div className="text-[10px] text-slate-500 font-bold mt-0.5">Awaiting Customer</div>
        </button>
      </div>

      {/* Ticket Grid (KDS Kanban Board) */}
      {displayedOrders.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-16 text-center space-y-3">
          <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto text-slate-400">
            <CheckCircle2 className="w-8 h-8 text-emerald-500" />
          </div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white">All Clear! No Orders In This Station</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            New sales placed at the POS cash register will automatically appear on this screen.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          <AnimatePresence>
            {displayedOrders.map((order, idx) => {
              const kdsStatus = order.kdsStatus || 'PENDING';
              const elapsedSec = getElapsedSeconds(order.createdAt);
              const isOverdue = elapsedSec > 300; // SLA Alert: > 5 mins
              const isWarning = elapsedSec > 180 && !isOverdue; // SLA Warning: > 3 mins

              return (
                <motion.div
                  key={`${order.id}-${idx}`}
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className={`flex flex-col bg-white dark:bg-slate-900 rounded-3xl border shadow-sm overflow-hidden transition-all ${
                    kdsStatus === 'READY'
                      ? 'border-emerald-500 dark:border-emerald-500 ring-2 ring-emerald-500/20'
                      : isOverdue
                      ? 'border-rose-500 dark:border-rose-500 ring-2 ring-rose-500/20 animate-pulse'
                      : isWarning
                      ? 'border-amber-400 dark:border-amber-500'
                      : 'border-slate-200 dark:border-slate-800'
                  }`}
                >
                  {/* Ticket Header */}
                  <div className={`p-4 border-b flex items-center justify-between ${
                    kdsStatus === 'READY'
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-100 dark:border-emerald-900'
                      : isOverdue
                      ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-100 dark:border-rose-900'
                      : 'bg-slate-50 dark:bg-slate-950 border-slate-100 dark:border-slate-800'
                  }`}>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xl font-black font-mono text-slate-900 dark:text-white">
                          #{order.queueNumber || order.orderNumber.slice(-4)}
                        </span>
                        <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                          kdsStatus === 'READY'
                            ? 'bg-emerald-600 text-white'
                            : kdsStatus === 'PREPARING'
                            ? 'bg-blue-600 text-white'
                            : 'bg-amber-500 text-slate-950'
                        }`}>
                          {kdsStatus}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                        {order.customerName ? `Customer: ${order.customerName}` : order.orderNumber}
                      </div>
                    </div>

                    {/* Timer SLA Badge */}
                    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-mono font-bold ${
                      isOverdue
                        ? 'bg-rose-600 text-white animate-bounce'
                        : isWarning
                        ? 'bg-amber-500 text-slate-950'
                        : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                    }`}>
                      <Clock className="w-3.5 h-3.5" />
                      <span>{formatElapsed(elapsedSec)}</span>
                    </div>
                  </div>

                  {/* Ticket Items List */}
                  <div className="p-4 flex-1 space-y-3 overflow-y-auto max-h-60 no-scrollbar">
                    {order.items.map((item, idx) => {
                      const itemKey = `${order.id}-${idx}`;
                      const isChecked = !!checkedItemIds[itemKey];

                      return (
                        <div
                          key={idx}
                          onClick={() => toggleItemCheck(order.id, idx)}
                          className={`p-2.5 rounded-xl border transition-all cursor-pointer select-none flex items-start gap-2.5 ${
                            isChecked
                              ? 'bg-slate-50 dark:bg-slate-950 border-slate-200/60 dark:border-slate-800 opacity-40 line-through'
                              : 'bg-slate-50/70 dark:bg-slate-950/70 border-slate-200/40 dark:border-slate-800 hover:border-slate-300'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {}}
                            className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-bold text-slate-900 dark:text-white">
                                {item.nameTh}
                              </span>
                              <span className="font-mono font-black text-emerald-600 dark:text-emerald-400 text-sm">
                                x{item.qty}
                              </span>
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono">
                              SKU: {item.sku}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Ticket Action Bump Footer */}
                  <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-950/40 space-y-2">
                    {kdsStatus === 'PENDING' && (
                      <button
                        type="button"
                        onClick={() => handleAdvanceStatus(order, 'PREPARING')}
                        disabled={updatingOrderId === order.id}
                        className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl transition-all shadow-md shadow-blue-600/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                      >
                        {updatingOrderId === order.id ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Flame className="w-4 h-4" />}
                        <span>Start Brewing / Prep</span>
                      </button>
                    )}

                    {kdsStatus === 'PREPARING' && (
                      <button
                        type="button"
                        onClick={() => handleAdvanceStatus(order, 'READY')}
                        disabled={updatingOrderId === order.id}
                        className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl transition-all shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                      >
                        {updatingOrderId === order.id ? <RefreshCw className="w-4 h-4 animate-spin" /> : <BellRing className="w-4 h-4" />}
                        <span>Mark Ready & Chime</span>
                      </button>
                    )}

                    {kdsStatus === 'READY' && (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleAnnounceTicket(order)}
                          className="px-3 py-3 bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-md"
                          title="Call Customer with Bell"
                        >
                          <BellRing className="w-4 h-4" />
                          <span className="hidden sm:inline">Call</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAdvanceStatus(order, 'COMPLETED')}
                          disabled={updatingOrderId === order.id}
                          className="flex-1 py-3 bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                        >
                          {updatingOrderId === order.id ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                          <span>Fulfilled / Done</span>
                        </button>
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
};
