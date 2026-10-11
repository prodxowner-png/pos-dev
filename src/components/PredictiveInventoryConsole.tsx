import React, { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import {
  Sparkles,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Package,
  Clock,
  DollarSign,
  ArrowUpRight,
  RefreshCw,
  Search,
  Plus,
  ShieldCheck,
  Zap,
  MoreVertical,
  SlidersHorizontal,
  Scan,
} from 'lucide-react';
import { ProductItem, PosOrderRecord, formatSatangToThb } from '../types/prodx';
import { useToast } from '../context/ToastContext';
import { StockPredictionWidget } from './StockPredictionWidget';
import {
  useInventoryQuickActions,
  InventoryQuickActionController,
} from './inventory/InventoryQuickActionController';
import { BarcodeStockVerifierModal } from './inventory/BarcodeStockVerifierModal';

interface PredictiveInventoryConsoleProps {
  products: ProductItem[];
  orders: PosOrderRecord[];
  onStockReplenished: () => void;
}

export const PredictiveInventoryConsole: React.FC<PredictiveInventoryConsoleProps> = ({
  products,
  orders,
  onStockReplenished,
}) => {
  const { showSuccess, showError, showInfo } = useToast();
  const quickActions = useInventoryQuickActions();
  const [activeView, setActiveView] = useState<'PREDICTIONS_WIDGET' | 'CATALOG_LEDGER'>('PREDICTIONS_WIDGET');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [filterRisk, setFilterRisk] = useState<'ALL' | 'CRITICAL' | 'WARNING'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [replenishingId, setReplenishingId] = useState<string | null>(null);
  const [isScannerOpen, setIsScannerOpen] = useState<boolean>(false);

  // Calculate real-time item velocity & runout metrics
  const analyzedProducts = useMemo(() => {
    // 1. Calculate units sold from ledger
    const soldCounts: Record<string, number> = {};
    orders.forEach((o) => {
      if (o.status === 'COMPLETED') {
        o.items.forEach((item) => {
          soldCounts[item.productId] = (soldCounts[item.productId] || 0) + item.qty;
        });
      }
    });

    // Assume 8 active trading hours for the shift period
    const tradingHours = 8;

    return products.map((p) => {
      const unitsSold = soldCounts[p.id] || 0;
      // Minimum baseline velocity for demonstration if no sales yet
      const hourlyVelocity = Math.max(0.25, Number((unitsSold / tradingHours).toFixed(2)));
      const hoursUntilStockout = Number((p.stock / hourlyVelocity).toFixed(1));
      
      let riskLevel: 'CRITICAL' | 'WARNING' | 'HEALTHY' = 'HEALTHY';
      if (p.stock <= p.lowStockThreshold || hoursUntilStockout <= 6) {
        riskLevel = 'CRITICAL';
      } else if (hoursUntilStockout <= 24 || p.stock <= p.lowStockThreshold * 1.5) {
        riskLevel = 'WARNING';
      }

      // AI Reorder Algorithm:
      // Reorder Qty = (Hourly Velocity * 48hr cycle buffer) + Safety Stock - Current Stock
      const leadTimeHours = 24;
      const targetBuffer = Math.ceil(hourlyVelocity * leadTimeHours * 2.5);
      const suggestedReorderQty = Math.max(20, Math.ceil(targetBuffer - p.stock));
      const totalPoCostSatang = suggestedReorderQty * p.costSatang;

      return {
        ...p,
        unitsSold,
        hourlyVelocity,
        hoursUntilStockout,
        riskLevel,
        suggestedReorderQty,
        totalPoCostSatang,
      };
    });
  }, [products, orders]);

  // Executive Metric Summaries
  const executiveMetrics = useMemo(() => {
    const criticalCount = analyzedProducts.filter((p) => p.riskLevel === 'CRITICAL').length;
    const warningCount = analyzedProducts.filter((p) => p.riskLevel === 'WARNING').length;
    const totalInventoryValueSatang = analyzedProducts.reduce(
      (sum, p) => sum + p.stock * p.costSatang,
      0
    );
    const suggestedPoTotalSatang = analyzedProducts
      .filter((p) => p.riskLevel !== 'HEALTHY')
      .reduce((sum, p) => sum + p.totalPoCostSatang, 0);

    return {
      criticalCount,
      warningCount,
      totalInventoryValueSatang,
      suggestedPoTotalSatang,
    };
  }, [analyzedProducts]);

  // Filtered view
  const displayItems = analyzedProducts.filter((p) => {
    if (selectedCategory !== 'ALL' && p.category !== selectedCategory) return false;
    if (filterRisk !== 'ALL' && p.riskLevel !== filterRisk) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        p.nameEn.toLowerCase().includes(q) ||
        p.nameTh.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q)
      );
    }
    return true;
  });

  // Authorize One-Click Restock PO
  const handleAuthorizePo = async (product: typeof analyzedProducts[0]) => {
    setReplenishingId(product.id);
    try {
      const res = await fetch('/api/inventory/adjust', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: product.id,
          deltaQty: product.suggestedReorderQty,
          reasonCode: 'AI_PREDICTIVE_RESTOCK',
          actorName: 'AI Inventory Agent',
        }),
      });

      if (res.ok) {
        showSuccess(
          'Restock PO Executed',
          `Added ${product.suggestedReorderQty} units to ${product.nameEn}. Inventory ledger updated.`
        );
        onStockReplenished();
      } else {
        const err = await res.json();
        showError('PO Execution Failed', err.error || 'Could not adjust inventory');
      }
    } catch (err: any) {
      showError('Network Error', err?.message || 'Failed to dispatch inventory adjustment');
    } finally {
      setReplenishingId(null);
    }
  };

  return (
    <div className="space-y-8 font-sans">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-slate-200 dark:border-slate-800">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold text-emerald-600 dark:text-emerald-400">
            <Sparkles className="w-4 h-4 animate-pulse" />
            <span className="uppercase font-mono tracking-widest">
              AI-POWERED PREDICTIVE STOCK INTELLIGENCE
            </span>
          </div>
          <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            Inventory Forecast & Auto-Restock Studio
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-2xl font-medium">
            Real-time sales velocity modeling, stockout runout forecasting, and automated 
            Purchase Order generation based on authoritative ledger transactions.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start md:self-end">
          <button
            type="button"
            onClick={() => setIsScannerOpen(true)}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-md shadow-emerald-600/20 cursor-pointer active:scale-95"
            title="เปิดกล้องสแกนบาร์โค้ดสินค้า เพื่อเช็กสต็อกและเติมสินค้าด่วน"
          >
            <Scan className="w-4 h-4 text-emerald-200" />
            <span>สแกนบาร์โค้ดสินค้า (QR / Barcode Scanner)</span>
          </button>

          <button
            type="button"
            onClick={onStockReplenished}
            className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Refresh Analysis</span>
          </button>
        </div>
      </div>

      {/* Studio View Selector Tabs */}
      <div className="flex p-1.5 bg-slate-100 dark:bg-slate-950 rounded-2xl border border-slate-200/80 dark:border-slate-800 max-w-md">
        <button
          type="button"
          onClick={() => setActiveView('PREDICTIONS_WIDGET')}
          className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeView === 'PREDICTIONS_WIDGET'
              ? 'bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-sm border border-slate-200 dark:border-slate-700'
              : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          <span>AI Stockout Predictions</span>
          {executiveMetrics.criticalCount > 0 && (
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveView('CATALOG_LEDGER')}
          className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeView === 'CATALOG_LEDGER'
              ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm border border-slate-200 dark:border-slate-700'
              : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Package className="w-4 h-4" />
          <span>Catalog & Fast Restock</span>
        </button>
      </div>

      {activeView === 'PREDICTIONS_WIDGET' ? (
        <StockPredictionWidget
          products={products}
          orders={orders}
          onStockReplenished={onStockReplenished}
        />
      ) : (
        <div className="space-y-8 animate-in fade-in duration-200">
          {/* KPI Cards Row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl space-y-2 shadow-sm">
          <div className="flex items-center justify-between text-xs font-bold text-slate-400 uppercase tracking-wider">
            <span>Critical Stock Risk</span>
            <AlertTriangle className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-3xl font-black font-mono text-rose-600 tabular-nums">
            {executiveMetrics.criticalCount} SKUs
          </div>
          <div className="text-[11px] text-slate-500 font-medium">
            Estimated depletion &lt; 6 operational hours
          </div>
        </div>

        <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl space-y-2 shadow-sm">
          <div className="flex items-center justify-between text-xs font-bold text-slate-400 uppercase tracking-wider">
            <span>Warning Buffer</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-3xl font-black font-mono text-amber-600 tabular-nums">
            {executiveMetrics.warningCount} SKUs
          </div>
          <div className="text-[11px] text-slate-500 font-medium">
            Runout projected within 24 hours
          </div>
        </div>

        <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl space-y-2 shadow-sm">
          <div className="flex items-center justify-between text-xs font-bold text-slate-400 uppercase tracking-wider">
            <span>Current Capital Tied</span>
            <Package className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-black font-mono text-slate-900 dark:text-white tabular-nums tracking-tight">
            ฿{(executiveMetrics.totalInventoryValueSatang / 100).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-slate-500 font-medium">
            Valued at raw unit supplier cost
          </div>
        </div>

        <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl space-y-2 shadow-sm">
          <div className="flex items-center justify-between text-xs font-bold text-slate-400 uppercase tracking-wider">
            <span>Recommended PO Budget</span>
            <Zap className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400 tabular-nums tracking-tight">
            ฿{(executiveMetrics.suggestedPoTotalSatang / 100).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-slate-500 font-medium">
            Safety rebalance for 48h sales window
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
        <div className="flex flex-wrap items-center gap-1.5 w-full md:w-auto">
          {['ALL', 'COFFEE', 'BAKERY', 'BEVERAGE', 'MERCHANDISE'].map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                selectedCategory === cat
                  ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {cat.charAt(0) + cat.slice(1).toLowerCase()}
            </button>
          ))}
          <div className="h-4 w-px bg-slate-200 dark:bg-slate-800 mx-1 hidden sm:block" />
          {(['ALL', 'CRITICAL', 'WARNING'] as const).map((r) => (
            <button
              key={r}
              onClick={() => setFilterRisk(r)}
              className={`px-2.5 py-1.5 text-[11px] font-bold rounded-lg transition-all ${
                filterRisk === r
                  ? 'bg-emerald-600 text-white'
                  : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
              }`}
            >
              {r === 'ALL' ? 'All Risks' : `${r} Only`}
            </button>
          ))}
        </div>

        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search SKU or name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-medium"
          />
        </div>
      </div>

      {/* Quick Action Hint Bar */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-100/70 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 rounded-2xl text-[11px] text-slate-500 dark:text-slate-400 font-medium">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="w-3.5 h-3.5 text-emerald-500" />
          <span>
            <strong className="text-slate-700 dark:text-slate-200">Quick Actions:</strong> Right-click or long-press any item to Update Stock, Generate Reorder PO, or View Audit Trail.
          </span>
        </div>
        <span className="hidden sm:inline font-mono text-[10px] text-slate-400">Context Menu • Touch Long-press</span>
      </div>

      {/* Predictive Forecast Table */}
      <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-3xl bg-white dark:bg-slate-900 shadow-sm">
        <table className="w-full text-left border-collapse min-w-[900px]">
          <thead>
            <tr className="text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50/60 dark:bg-slate-950/60 border-b border-slate-100 dark:border-slate-800">
              <th className="py-4 px-6">Product / SKU</th>
              <th className="py-4 px-6">Current Stock</th>
              <th className="py-4 px-6">Sales Velocity</th>
              <th className="py-4 px-6">Runout Time</th>
              <th className="py-4 px-6">Status</th>
              <th className="py-4 px-6">AI Reorder PO</th>
              <th className="py-4 px-6 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {displayItems.map((item) => (
              <tr
                key={item.id}
                onContextMenu={(e) => quickActions.handleContextMenu(e, item, item.suggestedReorderQty)}
                onTouchStart={(e) => quickActions.handleTouchStart(e, item, item.suggestedReorderQty)}
                onTouchMove={quickActions.handleTouchMove}
                onTouchEnd={quickActions.handleTouchEnd}
                onTouchCancel={quickActions.handleTouchEnd}
                className="group hover:bg-slate-50 dark:hover:bg-slate-950/50 transition-colors cursor-context-menu"
              >
                <td className="py-4 px-6">
                  <div className="font-bold text-slate-900 dark:text-white text-sm">
                    {item.nameEn}
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono">
                    <span>{item.sku}</span>
                    <span>·</span>
                    <span>{item.category}</span>
                  </div>
                </td>

                <td className="py-4 px-6">
                  <div className="font-mono font-bold text-base tabular-nums">
                    {item.stock} <span className="text-xs text-slate-400 font-sans font-normal">units</span>
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono">
                    Threshold: {item.lowStockThreshold}
                  </div>
                </td>

                <td className="py-4 px-6 font-mono">
                  <div className="flex items-center gap-1.5 font-bold text-sm text-slate-800 dark:text-slate-200">
                    <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
                    <span>{item.hourlyVelocity}</span>
                    <span className="text-xs text-slate-400 font-normal">u/hr</span>
                  </div>
                  <div className="text-[10px] text-slate-400">
                    {item.unitsSold} sold this shift
                  </div>
                </td>

                <td className="py-4 px-6 font-mono">
                  <div className={`font-black text-sm tabular-nums ${
                    item.riskLevel === 'CRITICAL' ? 'text-rose-600' : item.riskLevel === 'WARNING' ? 'text-amber-600' : 'text-slate-700 dark:text-slate-300'
                  }`}>
                    {item.hoursUntilStockout} hrs
                  </div>
                  <div className="text-[10px] text-slate-400 font-sans">
                    {item.hoursUntilStockout <= 24 ? 'Urgent depletion' : 'Safe buffer'}
                  </div>
                </td>

                <td className="py-4 px-6">
                  <span
                    className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider inline-flex items-center gap-1 ${
                      item.riskLevel === 'CRITICAL'
                        ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-200 dark:border-rose-900/40'
                        : item.riskLevel === 'WARNING'
                        ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200 dark:border-amber-900/40'
                        : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/40'
                    }`}
                  >
                    {item.riskLevel}
                  </span>
                </td>

                <td className="py-4 px-6 font-mono">
                  <div className="font-bold text-xs text-slate-900 dark:text-white">
                    +{item.suggestedReorderQty} units
                  </div>
                  <div className="text-[10px] text-slate-400">
                    Est. PO: ฿{(item.totalPoCostSatang / 100).toFixed(2)}
                  </div>
                </td>

                <td className="py-4 px-6 text-right">
                  <div className="inline-flex items-center gap-2">
                    <button
                      onClick={() => handleAuthorizePo(item)}
                      disabled={replenishingId === item.id}
                      className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all active:scale-95 inline-flex items-center gap-1.5 shadow-sm cursor-pointer"
                    >
                      {replenishingId === item.id ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <>
                          <Plus className="w-3.5 h-3.5" />
                          <span>Authorize PO</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      title="Quick Actions (Right-click or Long-press)"
                      onClick={(e) => quickActions.handleQuickActionClick(e, item, item.suggestedReorderQty)}
                      className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )}

  {/* Quick Action Context Menu & Associated Modals */}
  <InventoryQuickActionController
    state={quickActions.state}
    onCloseMenu={quickActions.closeMenu}
    onCloseModal={quickActions.closeModal}
    onSelectAction={quickActions.openActionModal}
    onStockUpdated={onStockReplenished}
  />

  {/* Real-time Camera QR / Barcode Stock Verifier Modal */}
  <BarcodeStockVerifierModal
    isOpen={isScannerOpen}
    onClose={() => setIsScannerOpen(false)}
    products={products}
    onStockUpdated={onStockReplenished}
  />
</div>
);
};
