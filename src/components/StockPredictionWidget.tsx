import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Sparkles,
  AlertTriangle,
  Clock,
  TrendingUp,
  Package,
  RefreshCw,
  Search,
  CheckCircle2,
  ShoppingCart,
  Zap,
  ShieldAlert,
  ChevronRight,
  Info,
  Calendar,
  Layers,
  ArrowRight,
  Check,
  TrendingDown,
  Cpu,
  MoreVertical,
  SlidersHorizontal,
} from 'lucide-react';
import {
  ProductItem,
  PosOrderRecord,
  StockPredictionItem,
  InventoryAiForecastSummary,
  formatSatangToThb,
} from '../types/prodx';
import { useToast } from '../context/ToastContext';
import {
  useInventoryQuickActions,
  InventoryQuickActionController,
} from './inventory/InventoryQuickActionController';

export interface StockPredictionWidgetProps {
  products: ProductItem[];
  orders: PosOrderRecord[];
  onStockReplenished?: () => void;
  compact?: boolean;
}

export const StockPredictionWidget: React.FC<StockPredictionWidgetProps> = ({
  products,
  orders,
  onStockReplenished,
  compact = false,
}) => {
  const { showSuccess, showError, showInfo } = useToast();
  const quickActions = useInventoryQuickActions();
  const [predictions, setPredictions] = useState<StockPredictionItem[]>([]);
  const [aiSummary, setAiSummary] = useState<InventoryAiForecastSummary | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isGeneratingAi, setIsGeneratingAi] = useState<boolean>(false);
  const [filterMode, setFilterMode] = useState<
    'ALL' | 'REORDER_ONLY' | 'CRITICAL' | 'COFFEE' | 'BAKERY' | 'BEVERAGE' | 'MERCHANDISE'
  >('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortBy, setSortBy] = useState<'DAYS_TO_STOCKOUT' | 'VELOCITY' | 'STOCK' | 'PO_COST'>(
    'DAYS_TO_STOCKOUT'
  );
  const [executingPoSku, setExecutingPoSku] = useState<string | null>(null);

  // Client-side fallback prediction calculation in case API is temporarily unavailable
  const fallbackPredictions = useMemo<StockPredictionItem[]>(() => {
    const completedOrders = orders.filter((o) => o.status === 'COMPLETED');
    const soldCounts: Record<string, number> = {};
    completedOrders.forEach((o) => {
      o.items.forEach((it) => {
        soldCounts[it.productId] = (soldCounts[it.productId] || 0) + it.qty;
      });
    });

    const tradingHours = 8;
    const storeHoursPerDay = 12;

    return products.map((prod) => {
      const sold = soldCounts[prod.id] || 0;
      const categoryFloorHourly: Record<string, number> = {
        COFFEE: 1.8,
        BAKERY: 1.2,
        BEVERAGE: 0.9,
        MERCHANDISE: 0.2,
      };
      const minHourly = categoryFloorHourly[prod.category] || 0.5;
      const hourlyVelocity = Math.max(minHourly, Number((sold / tradingHours + minHourly * 0.4).toFixed(2)));
      const dailyVelocity = Math.max(0.5, Number((hourlyVelocity * storeHoursPerDay).toFixed(1)));

      const daysToStockout = Number((prod.stock / dailyVelocity).toFixed(1));
      const hoursToStockout = Number((prod.stock / hourlyVelocity).toFixed(1));
      const projectedMs = Date.now() + Math.round(daysToStockout * 86400000);
      const projectedStockoutDate = new Date(projectedMs).toISOString();

      const stockAboveThreshold = prod.stock - prod.lowStockThreshold;
      const daysUntilThreshold = Number((stockAboveThreshold / dailyVelocity).toFixed(1));

      const isBelowThreshold = prod.stock <= prod.lowStockThreshold;
      const willBreachSoon = daysUntilThreshold <= 3.0 || daysToStockout <= 3.5;
      const reorderRecommended = isBelowThreshold || willBreachSoon;

      let reorderUrgency: 'CRITICAL' | 'WARNING' | 'HEALTHY' = 'HEALTHY';
      let reorderReason = 'Adequate stock buffer available for current sales run-rate.';

      if (isBelowThreshold || daysToStockout <= 1.5) {
        reorderUrgency = 'CRITICAL';
        reorderReason = isBelowThreshold
          ? `Stock (${prod.stock}) has fallen below threshold (${prod.lowStockThreshold}). Immediate stockout in ${daysToStockout} days.`
          : `Urgent stockout alert: projected depletion in ${daysToStockout} days (${hoursToStockout}h).`;
      } else if (willBreachSoon) {
        reorderUrgency = 'WARNING';
        reorderReason = `Projected to fall below threshold (${prod.lowStockThreshold}) in ${
          daysUntilThreshold > 0 ? daysUntilThreshold : 0.5
        } days (Daily run-rate: ${dailyVelocity} u/day).`;
      }

      const targetBuffer = Math.ceil(dailyVelocity * 3.0 + prod.lowStockThreshold * 1.5);
      const suggestedReorderQty = Math.max(20, Math.ceil(targetBuffer - prod.stock));
      const totalPoCostSatang = suggestedReorderQty * prod.costSatang;

      return {
        productId: prod.id,
        sku: prod.sku,
        nameTh: prod.nameTh,
        nameEn: prod.nameEn,
        category: prod.category,
        currentStock: prod.stock,
        lowStockThreshold: prod.lowStockThreshold,
        costSatang: prod.costSatang,
        priceSatang: prod.priceSatang,
        dailyVelocity,
        hourlyVelocity,
        historicalUnitsSold: sold,
        daysToStockout,
        hoursToStockout,
        projectedStockoutDate,
        daysUntilThreshold,
        reorderRecommended,
        reorderUrgency,
        reorderReason,
        suggestedReorderQty,
        totalPoCostSatang,
        confidenceScore: Math.min(98, Math.max(84, 86 + sold * 2)),
        demandTrend: sold > 4 ? 'SURGING' : 'STEADY',
      };
    });
  }, [products, orders]);

  // Fetch predictions from authoritative backend
  const fetchPredictions = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/inventory/predictions');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.predictions) && data.predictions.length > 0) {
          setPredictions(data.predictions);
          return;
        }
      }
      setPredictions(fallbackPredictions);
    } catch {
      setPredictions(fallbackPredictions);
    } finally {
      setIsLoading(false);
    }
  }, [fallbackPredictions]);

  useEffect(() => {
    fetchPredictions();
  }, [fetchPredictions]);

  // Trigger Gemini AI Forecast
  const handleGenerateAiForecast = async () => {
    setIsGeneratingAi(true);
    try {
      const res = await fetch('/api/inventory/ai-forecast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (res.ok) {
        const data: InventoryAiForecastSummary = await res.json();
        setAiSummary(data);
        if (data.predictions && data.predictions.length > 0) {
          setPredictions(data.predictions);
        }
        showSuccess(
          'Gemini Forecast Generated',
          `AI stockout risk model refreshed. ${data.itemsNeedingReorder} items flagged for replenishment.`
        );
      } else {
        throw new Error('Could not generate Gemini prediction briefing.');
      }
    } catch (err: any) {
      showError('AI Forecast Failed', err.message || 'Network error executing Gemini prediction');
    } finally {
      setIsGeneratingAi(false);
    }
  };

  // Authorize Restock PO
  const handleExecuteReorderPo = async (item: StockPredictionItem) => {
    setExecutingPoSku(item.sku);
    try {
      const res = await fetch('/api/inventory/adjust', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: item.productId,
          deltaQty: item.suggestedReorderQty,
          reasonCode: 'AI_REORDER_RECOMMENDED_EXECUTION',
          actorName: 'AI Inventory Agent (Gemini)',
        }),
      });

      if (res.ok) {
        showSuccess(
          'Reorder PO Dispatched',
          `Authorized +${item.suggestedReorderQty} units for ${item.nameEn}. Stock replenished and ledger updated.`
        );
        if (onStockReplenished) {
          onStockReplenished();
        }
        await fetchPredictions();
      } else {
        const data = await res.json();
        showError('Restock Failed', data.error || 'Server rejected reorder transaction.');
      }
    } catch (err: any) {
      showError('Network Error', err.message || 'Failed to dispatch reorder adjustment.');
    } finally {
      setExecutingPoSku(null);
    }
  };

  const activePredictions = predictions.length > 0 ? predictions : fallbackPredictions;

  // Filtered & Sorted items
  const filteredItems = useMemo(() => {
    return activePredictions
      .filter((item) => {
        if (filterMode === 'REORDER_ONLY' && !item.reorderRecommended) return false;
        if (filterMode === 'CRITICAL' && item.reorderUrgency !== 'CRITICAL') return false;
        if (
          ['COFFEE', 'BAKERY', 'BEVERAGE', 'MERCHANDISE'].includes(filterMode) &&
          item.category !== filterMode
        ) {
          return false;
        }
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          return (
            item.nameEn.toLowerCase().includes(q) ||
            item.nameTh.toLowerCase().includes(q) ||
            item.sku.toLowerCase().includes(q)
          );
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'DAYS_TO_STOCKOUT') {
          return a.daysToStockout - b.daysToStockout;
        }
        if (sortBy === 'VELOCITY') {
          return b.dailyVelocity - a.dailyVelocity;
        }
        if (sortBy === 'STOCK') {
          return a.currentStock - b.currentStock;
        }
        if (sortBy === 'PO_COST') {
          return b.totalPoCostSatang - a.totalPoCostSatang;
        }
        return 0;
      });
  }, [activePredictions, filterMode, searchQuery, sortBy]);

  // Executive Metrics
  const reorderCount = activePredictions.filter((p) => p.reorderRecommended).length;
  const criticalCount = activePredictions.filter((p) => p.reorderUrgency === 'CRITICAL').length;
  const totalRecommendedPoSatang = activePredictions
    .filter((p) => p.reorderRecommended)
    .reduce((acc, it) => acc + it.totalPoCostSatang, 0);
  const avgDaysToStockout = (
    activePredictions.reduce((acc, it) => acc + it.daysToStockout, 0) /
    (activePredictions.length || 1)
  ).toFixed(1);

  return (
    <div className="space-y-6 font-sans">
      {/* Hero Intelligence Header & AI Action Bar */}
      <div className="p-6 md:p-8 rounded-[2.5rem] bg-gradient-to-br from-slate-900 via-slate-950 to-emerald-950 text-white shadow-xl border border-emerald-500/20 relative overflow-hidden">
        {/* Subtle decorative glow */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-10 -left-10 w-72 h-72 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-3 max-w-2xl">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5 shadow-sm">
                <Sparkles className="w-3.5 h-3.5 animate-pulse" />
                <span>AI Stockout Prediction Engine</span>
              </span>
              <span className="px-2.5 py-1 rounded-full text-[10px] font-mono font-bold bg-white/10 text-slate-300 border border-white/10">
                {aiSummary ? aiSummary.modelUsed : 'gemini-3.8-flash ready'}
              </span>
              {reorderCount > 0 && (
                <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-500/20 text-rose-300 border border-rose-500/30 flex items-center gap-1 animate-pulse">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>{reorderCount} Reorders Recommended</span>
                </span>
              )}
            </div>

            <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              Predictive Runout & Restock Intelligence
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 font-medium leading-relaxed">
              Analyzes historical POS transaction velocity and hourly consumption curves to calculate{' '}
              <strong className="text-emerald-400 font-bold">Days-to-Stockout</strong> and flag proactive{' '}
              <strong className="text-amber-400 font-bold">Reorder Recommended</strong> alerts before safety thresholds are breached.
            </p>
          </div>

          {/* Quick AI Trigger & Refresh */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={handleGenerateAiForecast}
              disabled={isGeneratingAi}
              className="py-3 px-5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 active:scale-95 text-slate-950 font-black text-xs uppercase tracking-wider shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
            >
              {isGeneratingAi ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Analyzing Historical Trends...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Run Gemini AI Forecast</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={fetchPredictions}
              className="p-3 rounded-2xl bg-white/10 hover:bg-white/20 text-slate-200 transition-all flex items-center justify-center cursor-pointer border border-white/10"
              title="Refresh Velocity Calculations"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* AI Strategic Executive Summary Callout if available */}
        {aiSummary && (
          <div className="mt-6 pt-6 border-t border-white/10 space-y-3 animate-in fade-in duration-300">
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-400">
              <Cpu className="w-4 h-4" />
              <span className="uppercase tracking-widest font-mono text-[11px]">
                Gemini 3.8 Flash Supply Chain Briefing
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-200 font-medium bg-black/30 p-4 rounded-2xl border border-white/10 leading-relaxed">
              {aiSummary.executiveSummary}
            </p>
            {aiSummary.macroInsights && aiSummary.macroInsights.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-1 text-[11px] text-slate-300">
                {aiSummary.macroInsights.map((insight, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-2 bg-white/5 p-2.5 rounded-xl border border-white/5"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                    <span>{insight}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* KPI Metric Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Reorder Recommended Alerts */}
        <div
          className={`p-5 rounded-3xl border transition-all shadow-sm ${
            reorderCount > 0
              ? 'bg-amber-500/10 dark:bg-amber-950/20 border-amber-500/30'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-bold text-slate-400 uppercase tracking-wider">
            <span>Reorder Recommended</span>
            <AlertTriangle
              className={`w-4 h-4 ${reorderCount > 0 ? 'text-amber-500 animate-bounce' : 'text-slate-400'}`}
            />
          </div>
          <div className="mt-2 text-3xl font-black font-mono text-amber-600 dark:text-amber-400 tabular-nums">
            {reorderCount} <span className="text-sm font-sans font-bold text-slate-400">SKUs</span>
          </div>
          <div className="mt-1 text-[11px] text-slate-500 font-medium">
            Items projected to breach safety threshold soon
          </div>
        </div>

        {/* Metric 2: Critical Stockout (< 1.5 Days) */}
        <div
          className={`p-5 rounded-3xl border transition-all shadow-sm ${
            criticalCount > 0
              ? 'bg-rose-500/10 dark:bg-rose-950/20 border-rose-500/30'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-bold text-slate-400 uppercase tracking-wider">
            <span>Immediate Stockout Risk</span>
            <ShieldAlert
              className={`w-4 h-4 ${criticalCount > 0 ? 'text-rose-600 animate-pulse' : 'text-slate-400'}`}
            />
          </div>
          <div className="mt-2 text-3xl font-black font-mono text-rose-600 dark:text-rose-400 tabular-nums">
            {criticalCount} <span className="text-sm font-sans font-bold text-slate-400">SKUs</span>
          </div>
          <div className="mt-1 text-[11px] text-slate-500 font-medium">
            Depletion within &le; 1.5 operational days
          </div>
        </div>

        {/* Metric 3: Average Days-to-Stockout */}
        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-xs font-bold text-slate-400 uppercase tracking-wider">
            <span>Avg Days-to-Stockout</span>
            <Clock className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="mt-2 text-3xl font-black font-mono text-slate-900 dark:text-white tabular-nums">
            {avgDaysToStockout}{' '}
            <span className="text-sm font-sans font-bold text-slate-400">Days</span>
          </div>
          <div className="mt-1 text-[11px] text-slate-500 font-medium">
            Weighted across full active store catalog
          </div>
        </div>

        {/* Metric 4: Recommended PO Investment */}
        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-xs font-bold text-slate-400 uppercase tracking-wider">
            <span>Restock PO Budget</span>
            <Zap className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="mt-2 text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400 tabular-nums">
            ฿{(totalRecommendedPoSatang / 100).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
          </div>
          <div className="mt-1 text-[11px] text-slate-500 font-medium">
            Target 72h replenishment safety buffer
          </div>
        </div>
      </div>

      {/* Filter, Search & Sorting Controls */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
        {/* Filter Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 w-full md:w-auto">
          {[
            { id: 'ALL', label: 'All Items' },
            { id: 'REORDER_ONLY', label: `Reorder Recommended (${reorderCount})`, alert: reorderCount > 0 },
            { id: 'CRITICAL', label: `Critical (${criticalCount})`, danger: criticalCount > 0 },
            { id: 'COFFEE', label: 'Coffee' },
            { id: 'BAKERY', label: 'Bakery' },
            { id: 'BEVERAGE', label: 'Beverage' },
            { id: 'MERCHANDISE', label: 'Merch' },
          ].map((tab) => {
            const isActive = filterMode === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilterMode(tab.id as any)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  isActive
                    ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-sm'
                    : tab.alert
                    ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20'
                    : tab.danger
                    ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <span>{tab.label}</span>
                {tab.alert && !isActive && (
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />
                )}
              </button>
            );
          })}
        </div>

        {/* Search & Sort */}
        <div className="flex items-center gap-2.5 w-full md:w-auto">
          <div className="relative flex-1 sm:w-60">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search SKU or item..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-medium focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            />
          </div>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer"
          >
            <option value="DAYS_TO_STOCKOUT">Fewest Days-to-Stockout</option>
            <option value="VELOCITY">Highest Velocity</option>
            <option value="STOCK">Lowest Stock Count</option>
            <option value="PO_COST">Highest Reorder Cost</option>
          </select>
        </div>
      </div>

      {/* Quick Action Hint Banner */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-100/70 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 rounded-2xl text-[11px] text-slate-500 dark:text-slate-400 font-medium">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="w-3.5 h-3.5 text-emerald-500" />
          <span>
            <strong className="text-slate-700 dark:text-slate-200">Quick Actions:</strong> Right-click or long-press any card for one-tap options to Update Stock, Generate Reorder PO, or View Audit Trail.
          </span>
        </div>
        <span className="hidden sm:inline font-mono text-[10px] text-slate-400">Context Menu • Touch Long-press</span>
      </div>

      {/* Main Stockout Predictions List / Cards */}
      <div className="space-y-4">
        {filteredItems.length === 0 ? (
          <div className="py-16 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-3">
            <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
            <h4 className="text-base font-black text-slate-900 dark:text-white">
              No Items Match Filter Criteria
            </h4>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              All inventory levels are safe and no stockout thresholds are projected to be breached in this view.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {filteredItems.map((item) => {
              const isUrgent = item.reorderUrgency === 'CRITICAL';
              const isWarning = item.reorderUrgency === 'WARNING';
              const stockPercent = Math.min(100, Math.round((item.currentStock / (item.lowStockThreshold * 2.5)) * 100));

              const rawProd: ProductItem = products.find((p) => p.id === item.productId) || {
                id: item.productId,
                sku: item.sku,
                barcode: item.sku,
                nameTh: item.nameTh,
                nameEn: item.nameEn,
                category: item.category,
                priceSatang: item.priceSatang,
                costSatang: item.costSatang,
                stock: item.currentStock,
                lowStockThreshold: item.lowStockThreshold,
                taxRatePercent: 7,
              };

              return (
                <div
                  key={item.productId}
                  onContextMenu={(e) => quickActions.handleContextMenu(e, rawProd, item.suggestedReorderQty)}
                  onTouchStart={(e) => quickActions.handleTouchStart(e, rawProd, item.suggestedReorderQty)}
                  onTouchMove={quickActions.handleTouchMove}
                  onTouchEnd={quickActions.handleTouchEnd}
                  onTouchCancel={quickActions.handleTouchEnd}
                  className={`p-6 rounded-3xl border transition-all duration-200 cursor-context-menu ${
                    item.reorderRecommended
                      ? isUrgent
                        ? 'bg-rose-500/5 dark:bg-rose-950/20 border-rose-500/40 shadow-sm ring-1 ring-rose-500/20'
                        : 'bg-amber-500/5 dark:bg-amber-950/20 border-amber-500/40 shadow-sm ring-1 ring-amber-500/20'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                    {/* Item Identification & Reorder Alert Banner */}
                    <div className="space-y-2.5 flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        {/* REORDER RECOMMENDED ALERT BADGE */}
                        {item.reorderRecommended && (
                          <div
                            className={`px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 shadow-sm ${
                              isUrgent
                                ? 'bg-rose-600 text-white animate-pulse'
                                : 'bg-amber-500 text-slate-950 font-extrabold'
                            }`}
                          >
                            <AlertTriangle className="w-3.5 h-3.5" />
                            <span>REORDER RECOMMENDED</span>
                          </div>
                        )}

                        <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                          {item.sku}
                        </span>

                        <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                          {item.category}
                        </span>

                        {item.demandTrend === 'SURGING' && (
                          <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                            <TrendingUp className="w-3 h-3" />
                            <span>Surging Demand</span>
                          </span>
                        )}
                      </div>

                      <div>
                        <h4 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">
                          {item.nameEn}
                        </h4>
                        <p className="text-xs text-slate-400 font-medium">{item.nameTh}</p>
                      </div>

                      {/* Explicit Reorder Reason Explanation */}
                      {item.reorderRecommended ? (
                        <div
                          className={`p-3 rounded-2xl text-xs font-medium flex items-center gap-2.5 ${
                            isUrgent
                              ? 'bg-rose-100/80 dark:bg-rose-900/30 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800/40'
                              : 'bg-amber-100/80 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/40'
                          }`}
                        >
                          <Info className="w-4 h-4 shrink-0" />
                          <span>{item.reorderReason}</span>
                        </div>
                      ) : (
                        <div className="text-xs text-slate-400 flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                          <span>Stock buffer is healthy. Projected depletion safely beyond lead time.</span>
                        </div>
                      )}

                      {/* AI Generated Specific Note if available */}
                      {item.aiForecastNotes && (
                        <div className="text-[11px] text-emerald-700 dark:text-emerald-300 bg-emerald-500/5 p-2 rounded-xl border border-emerald-500/20 italic">
                          &ldquo;{item.aiForecastNotes}&rdquo;
                        </div>
                      )}
                    </div>

                    {/* Central Metrics Grid: Stock vs Days-to-Stockout */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-6 lg:gap-8 items-center bg-slate-50/70 dark:bg-slate-950/60 p-4 rounded-2xl border border-slate-100 dark:border-slate-800/80 shrink-0">
                      {/* 1. Current Stock & Threshold */}
                      <div className="space-y-1">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                          Current Stock
                        </span>
                        <div className="text-2xl font-black font-mono tabular-nums text-slate-900 dark:text-white">
                          {item.currentStock}{' '}
                          <span className="text-xs font-sans text-slate-400 font-normal">units</span>
                        </div>
                        <div className="text-[10px] text-slate-400 font-medium">
                          Threshold: <span className="font-mono font-bold">{item.lowStockThreshold}</span>
                        </div>
                        {/* Gauge bar */}
                        <div className="w-24 h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden mt-1.5">
                          <div
                            className={`h-full rounded-full transition-all ${
                              item.currentStock <= item.lowStockThreshold
                                ? 'bg-rose-500'
                                : item.daysToStockout <= 3.5
                                ? 'bg-amber-500'
                                : 'bg-emerald-500'
                            }`}
                            style={{ width: `${Math.max(8, stockPercent)}%` }}
                          />
                        </div>
                      </div>

                      {/* 2. Calculated Days-to-Stockout (Highlighted) */}
                      <div className="space-y-1">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                          Days-to-Stockout
                        </span>
                        <div
                          className={`text-2xl font-black font-mono tabular-nums tracking-tight ${
                            item.daysToStockout <= 1.5
                              ? 'text-rose-600 dark:text-rose-400'
                              : item.daysToStockout <= 3.5
                              ? 'text-amber-600 dark:text-amber-400'
                              : 'text-emerald-600 dark:text-emerald-400'
                          }`}
                        >
                          {item.daysToStockout}{' '}
                          <span className="text-xs font-sans font-bold text-slate-400">Days</span>
                        </div>
                        <div className="text-[10px] text-slate-400 font-medium">
                          ~{item.hoursToStockout}h runtime left
                        </div>
                      </div>

                      {/* 3. Daily Sales Velocity */}
                      <div className="space-y-1 col-span-2 sm:col-span-1">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                          Sales Velocity
                        </span>
                        <div className="text-xl font-bold font-mono text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                          <TrendingUp className="w-4 h-4 text-emerald-500" />
                          <span>{item.dailyVelocity}</span>
                          <span className="text-xs font-normal text-slate-400 font-sans">u/day</span>
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {item.historicalUnitsSold} sold this shift ({item.hourlyVelocity} u/h)
                        </div>
                      </div>
                    </div>

                    {/* Right Action: Reorder Recommendation & PO Button + Quick Actions */}
                    <div className="flex flex-col sm:flex-row lg:flex-col items-stretch lg:items-end justify-center gap-2.5 shrink-0 min-w-[200px]">
                      <div className="text-left lg:text-right space-y-0.5">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          Suggested Reorder PO
                        </span>
                        <div className="text-sm font-black font-mono text-slate-900 dark:text-white">
                          +{item.suggestedReorderQty} units
                        </div>
                        <div className="text-[11px] font-mono text-slate-500">
                          Est. Cost: ฿{(item.totalPoCostSatang / 100).toFixed(2)}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 w-full">
                        <button
                          type="button"
                          onClick={() => handleExecuteReorderPo(item)}
                          disabled={executingPoSku === item.sku}
                          className={`flex-1 py-3 px-4 rounded-2xl text-xs font-black transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer uppercase tracking-wider ${
                            item.reorderRecommended
                              ? isUrgent
                                ? 'bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white shadow-rose-600/20'
                                : 'bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-slate-950 shadow-amber-500/20'
                              : 'bg-slate-900 hover:bg-slate-800 active:bg-slate-950 text-white'
                          }`}
                        >
                          {executingPoSku === item.sku ? (
                            <>
                              <RefreshCw className="w-4 h-4 animate-spin" />
                              <span>Dispatching PO...</span>
                            </>
                          ) : (
                            <>
                              <ShoppingCart className="w-4 h-4" />
                              <span>Authorize PO (+{item.suggestedReorderQty})</span>
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          title="Quick Actions (Right-click or Long-press)"
                          onClick={(e) => quickActions.handleQuickActionClick(e, rawProd, item.suggestedReorderQty)}
                          className="p-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-2xl transition-all cursor-pointer shadow-sm"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Quick Action Context Menu & Associated Modals */}
      <InventoryQuickActionController
        state={quickActions.state}
        onCloseMenu={quickActions.closeMenu}
        onCloseModal={quickActions.closeModal}
        onSelectAction={quickActions.openActionModal}
        onStockUpdated={() => {
          fetchPredictions();
          onStockReplenished?.();
        }}
      />
    </div>
  );
};

export default StockPredictionWidget;
