import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  ShoppingCart,
  Zap,
  TrendingUp,
  Package,
  Calendar,
  Truck,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Plus,
  Minus,
  FileText,
  DollarSign,
  Printer,
  Sparkles,
} from 'lucide-react';
import { ProductItem, formatSatangToThb } from '../../types/prodx';
import { useToast } from '../../context/ToastContext';

interface GenerateReorderModalProps {
  isOpen: boolean;
  item: ProductItem | null;
  suggestedQty?: number;
  onClose: () => void;
  onStockUpdated: () => void;
}

interface SupplierOption {
  name: string;
  leadTimeHours: number;
  minOrderUnits: number;
  contactEmail: string;
  terms: string;
}

const SUPPLIERS: Record<string, SupplierOption[]> = {
  COFFEE: [
    {
      name: 'Chiang Rai Origin Farms (Direct Single-Origin)',
      leadTimeHours: 24,
      minOrderUnits: 10,
      contactEmail: 'orders@chiangraiorigin.co.th',
      terms: 'Net 14 Days',
    },
    {
      name: 'Royal Project Agricultural Development Co-op',
      leadTimeHours: 48,
      minOrderUnits: 20,
      contactEmail: 'wholesale@royalprojectthailand.com',
      terms: 'Net 30 Days',
    },
  ],
  BAKERY: [
    {
      name: 'AOP French Bakery Supplies & Viennoiserie Co., Ltd.',
      leadTimeHours: 12,
      minOrderUnits: 10,
      contactEmail: 'bkk.orders@aopbakery.asia',
      terms: 'Same-day Morning Delivery',
    },
    {
      name: 'Artisan Bangkok Patisserie Logistics',
      leadTimeHours: 18,
      minOrderUnits: 15,
      contactEmail: 'supply@artisanbkk.com',
      terms: 'Net 7 Days',
    },
  ],
  BEVERAGE: [
    {
      name: 'Bangkok Cold Brew Roasters & Tonics Logistics',
      leadTimeHours: 24,
      minOrderUnits: 12,
      contactEmail: 'fulfillment@bkkcoldbrew.com',
      terms: 'Net 14 Days',
    },
    {
      name: 'Uji Direct Tea Import Co., Ltd.',
      leadTimeHours: 36,
      minOrderUnits: 10,
      contactEmail: 'wholesale@ujidirect.jp',
      terms: 'Net 30 Days',
    },
  ],
  MERCHANDISE: [
    {
      name: 'PRODX Global Retail Supply Network',
      leadTimeHours: 48,
      minOrderUnits: 25,
      contactEmail: 'procure@prodx.global',
      terms: 'Net 30 Days',
    },
  ],
};

export const GenerateReorderModal: React.FC<GenerateReorderModalProps> = ({
  isOpen,
  item,
  suggestedQty,
  onClose,
  onStockUpdated,
}) => {
  const { showSuccess, showError } = useToast();

  const defaultReorder = suggestedQty || (item ? Math.max(20, item.lowStockThreshold * 2) : 25);
  const [reorderQty, setReorderQty] = useState<number>(defaultReorder);
  const [selectedSupplierIndex, setSelectedSupplierIndex] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [createdPoReceipt, setCreatedPoReceipt] = useState<{
    poNumber: string;
    generatedAt: string;
    units: number;
    totalCostSatang: number;
    supplier: string;
  } | null>(null);

  React.useEffect(() => {
    if (item) {
      setReorderQty(suggestedQty || Math.max(20, item.lowStockThreshold * 2));
      setSelectedSupplierIndex(0);
      setCreatedPoReceipt(null);
    }
  }, [item, suggestedQty]);

  if (!isOpen || !item) return null;

  const supplierList = SUPPLIERS[item.category] || SUPPLIERS.COFFEE;
  const currentSupplier = supplierList[selectedSupplierIndex] || supplierList[0];

  const unitCostSatang = item.costSatang;
  const totalCostSatang = reorderQty * unitCostSatang;
  const projectedBalance = item.stock + reorderQty;

  const handleAuthorizePo = async () => {
    if (reorderQty <= 0) return;

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/inventory/restock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: item.id,
          restockQty: reorderQty,
          supplierName: currentSupplier.name,
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to submit purchase order');
      }

      const data = await res.json();
      const poNum = `PO-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;

      setCreatedPoReceipt({
        poNumber: poNum,
        generatedAt: new Date().toISOString(),
        units: reorderQty,
        totalCostSatang,
        supplier: currentSupplier.name,
      });

      showSuccess(
        'Purchase Order Generated',
        `Reorder #${poNum} for +${reorderQty} units of ${item.sku} dispatched to ${currentSupplier.name}. Stock updated to ${projectedBalance} units.`
      );
      onStockUpdated();
    } catch (err: any) {
      showError('PO Generation Failed', err.message || 'Could not communicate with procurement service');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 12 }}
          className="w-full max-w-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="p-6 bg-slate-50 dark:bg-slate-950/60 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                <ShoppingCart className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <span>Generate Purchase Reorder</span>
                  <span className="text-xs px-2 py-0.5 rounded-md font-mono bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                    {item.sku}
                  </span>
                </h3>
                <p className="text-xs text-slate-500 font-medium">{item.nameEn}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              disabled={isSubmitting}
              className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {createdPoReceipt ? (
            /* Official PO Slip Confirmation View */
            <div className="p-6 space-y-6">
              <div className="p-5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 flex items-start gap-4">
                <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="text-sm font-black text-emerald-900 dark:text-emerald-200">
                    Purchase Order Dispatched & Stock Replenished
                  </h4>
                  <p className="text-xs text-emerald-700 dark:text-emerald-400">
                    Your authoritative PO was committed to the database ledger and transmitted to the supplier.
                  </p>
                </div>
              </div>

              {/* PO Receipt Slip */}
              <div className="p-6 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-mono text-xs space-y-4">
                <div className="flex items-center justify-between border-b border-dashed border-slate-300 dark:border-slate-700 pb-3">
                  <span className="font-bold text-slate-900 dark:text-white">PRODX PROCUREMENT VOUCHER</span>
                  <span className="text-emerald-600 font-black">{createdPoReceipt.poNumber}</span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600 dark:text-slate-400">
                  <div>Date: {new Date(createdPoReceipt.generatedAt).toLocaleString()}</div>
                  <div className="text-right">Carrier: Standard Freight</div>
                  <div className="col-span-2">Supplier: {createdPoReceipt.supplier}</div>
                  <div className="col-span-2">Item: {item.nameEn} ({item.sku})</div>
                </div>

                <div className="border-t border-dashed border-slate-300 dark:border-slate-700 pt-3 flex justify-between items-center text-sm">
                  <span className="font-bold text-slate-900 dark:text-white">
                    Replenishment Units:
                  </span>
                  <span className="font-black text-emerald-600">+{createdPoReceipt.units} units</span>
                </div>

                <div className="flex justify-between items-center text-sm border-b border-dashed border-slate-300 dark:border-slate-700 pb-3">
                  <span className="font-bold text-slate-900 dark:text-white">PO Total Cost:</span>
                  <span className="font-black text-slate-900 dark:text-white">
                    ฿{(createdPoReceipt.totalCostSatang / 100).toFixed(2)}
                  </span>
                </div>

                <div className="text-center text-[10px] text-slate-400 pt-1">
                  Immutable Ledger Hash &amp; Audit Sequence Recorded
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-black shadow-md cursor-pointer"
                >
                  Done
                </button>
              </div>
            </div>
          ) : (
            /* Order Generation Form */
            <div className="p-6 space-y-6">
              {/* Context Summary */}
              <div className="grid grid-cols-3 gap-3 p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800">
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    Current Stock
                  </span>
                  <div className="text-2xl font-black font-mono text-slate-700 dark:text-slate-300 tabular-nums">
                    {item.stock} <span className="text-xs font-normal">units</span>
                  </div>
                  <div className="text-[10px] text-slate-400">Threshold: {item.lowStockThreshold}</div>
                </div>

                <div className="space-y-1 text-center border-x border-slate-200 dark:border-slate-800 px-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    Unit Cost
                  </span>
                  <div className="text-2xl font-black font-mono text-slate-900 dark:text-white tabular-nums">
                    ฿{(item.costSatang / 100).toFixed(2)}
                  </div>
                  <div className="text-[10px] text-slate-400">Supplier wholesale</div>
                </div>

                <div className="space-y-1 text-right">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    Projected Balance
                  </span>
                  <div className="text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400 tabular-nums">
                    +{projectedBalance} <span className="text-xs font-normal">units</span>
                  </div>
                  <div className="text-[10px] text-slate-400">After intake check-in</div>
                </div>
              </div>

              {/* Quantity Stepper */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Reorder Batch Size (Units)
                  </label>
                  {suggestedQty && (
                    <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                      <Sparkles className="w-3 h-3" />
                      <span>AI Optimal: {suggestedQty} units</span>
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setReorderQty((prev) => Math.max(5, prev - 5))}
                    className="p-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl text-slate-700 dark:text-slate-200 cursor-pointer"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <input
                    type="number"
                    min={1}
                    value={reorderQty}
                    onChange={(e) => setReorderQty(Math.max(1, parseInt(e.target.value, 10) || 1))}
                    className="flex-1 py-3 px-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-center font-mono font-black text-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500"
                  />
                  <button
                    type="button"
                    onClick={() => setReorderQty((prev) => prev + 5)}
                    className="p-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl text-slate-700 dark:text-slate-200 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>

                {/* Quick Presets */}
                <div className="flex items-center gap-2 pt-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mr-1">
                    Presets:
                  </span>
                  {[10, 20, 25, 50, 100].map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => setReorderQty(q)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                        reorderQty === q
                          ? 'bg-amber-500 text-slate-950 font-black'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                      }`}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>

              {/* Supplier Selection */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Approved Supplier Vendor
                </label>
                <div className="space-y-2">
                  {supplierList.map((sup, idx) => (
                    <div
                      key={sup.name}
                      onClick={() => setSelectedSupplierIndex(idx)}
                      className={`p-3.5 rounded-2xl border cursor-pointer transition-all flex items-center justify-between ${
                        selectedSupplierIndex === idx
                          ? 'bg-amber-500/10 border-amber-500/40 ring-1 ring-amber-500/30'
                          : 'bg-slate-50 dark:bg-slate-950/40 border-slate-200 dark:border-slate-800 hover:border-slate-300'
                      }`}
                    >
                      <div className="space-y-0.5">
                        <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                          <span>{sup.name}</span>
                          {selectedSupplierIndex === idx && (
                            <span className="w-2 h-2 rounded-full bg-amber-500" />
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400 flex items-center gap-3">
                          <span className="flex items-center gap-1">
                            <Truck className="w-3 h-3 text-slate-400" />
                            <span>ETA: {sup.leadTimeHours}h</span>
                          </span>
                          <span>·</span>
                          <span>Terms: {sup.terms}</span>
                        </div>
                      </div>
                      <div className="text-right font-mono text-xs font-bold text-slate-700 dark:text-slate-300">
                        Min: {sup.minOrderUnits}u
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Total Purchase Order Cost Summary */}
              <div className="p-4 rounded-2xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-amber-800 dark:text-amber-400 uppercase tracking-wider block">
                    Total PO Reorder Budget
                  </span>
                  <div className="text-xs text-amber-700 dark:text-amber-300">
                    {reorderQty} units × ฿{(unitCostSatang / 100).toFixed(2)}
                  </div>
                </div>
                <div className="text-2xl font-black font-mono text-amber-900 dark:text-amber-200">
                  ฿{(totalCostSatang / 100).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                </div>
              </div>

              {/* Footer */}
              <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isSubmitting}
                  className="px-4 py-2.5 text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleAuthorizePo}
                  disabled={isSubmitting || reorderQty <= 0}
                  className="px-6 py-2.5 bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-slate-950 rounded-xl text-xs font-black shadow-lg shadow-amber-500/20 inline-flex items-center gap-2 cursor-pointer"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Transmitting PO...</span>
                    </>
                  ) : (
                    <>
                      <FileText className="w-3.5 h-3.5" />
                      <span>Authorize &amp; Restock PO</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
