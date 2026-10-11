import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  SlidersHorizontal,
  Package,
  Plus,
  Minus,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  ShieldCheck,
  UserCheck,
  FileText,
  Boxes,
} from 'lucide-react';
import { ProductItem, formatSatangToThb } from '../../types/prodx';
import { useToast } from '../../context/ToastContext';

interface UpdateStockModalProps {
  isOpen: boolean;
  item: ProductItem | null;
  onClose: () => void;
  onStockUpdated: () => void;
}

type ReasonCode =
  | 'RECOUNT'
  | 'DAMAGE'
  | 'SPOILAGE'
  | 'EXPIRY'
  | 'DELIVERY_CHECKIN'
  | 'RETURN_TO_STOCK'
  | 'INTERNAL_USE'
  | 'AUDIT_CORRECTION';

const REASON_OPTIONS: { code: ReasonCode; label: string; desc: string }[] = [
  { code: 'RECOUNT', label: 'Periodic Physical Recount', desc: 'Routine inventory audit count adjustment' },
  { code: 'DELIVERY_CHECKIN', label: 'Supplier Delivery Intake', desc: 'New stock checked in from supplier delivery' },
  { code: 'DAMAGE', label: 'Damaged Goods / Packaging Defect', desc: 'Stock broken or damaged in storage/transit' },
  { code: 'SPOILAGE', label: 'Perishable Spoilage / Prep Loss', desc: 'Beans, dairy, or fresh bakery past usable condition' },
  { code: 'EXPIRY', label: 'Manufacturer Expiry Date Reached', desc: 'Expired ingredients discarded according to safety policy' },
  { code: 'RETURN_TO_STOCK', label: 'Customer Order Return / Restock', desc: 'Undamaged item returned to active inventory' },
  { code: 'INTERNAL_USE', label: 'Staff Cupping & Quality Control', desc: 'Barista dial-in beans or staff training consumption' },
  { code: 'AUDIT_CORRECTION', label: 'Ledger Audit Correction', desc: 'Discrepancy reconciliation approved by supervisor' },
];

export const UpdateStockModal: React.FC<UpdateStockModalProps> = ({
  isOpen,
  item,
  onClose,
  onStockUpdated,
}) => {
  const { showSuccess, showError, showWarning } = useToast();
  const [mode, setMode] = useState<'DELTA' | 'ABSOLUTE'>('DELTA');
  const [deltaQty, setDeltaQty] = useState<number>(0);
  const [absoluteStock, setAbsoluteStock] = useState<number>(item?.stock || 0);
  const [reasonCode, setReasonCode] = useState<ReasonCode>('RECOUNT');
  const [actorName, setActorName] = useState<string>('usr-mgr-01 (Store Manager)');
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Sync state when item changes
  React.useEffect(() => {
    if (item) {
      setAbsoluteStock(item.stock);
      setDeltaQty(0);
      setNotes('');
    }
  }, [item]);

  if (!isOpen || !item) return null;

  const currentStock = item.stock;
  const calculatedNewStock = mode === 'DELTA' ? currentStock + deltaQty : absoluteStock;
  const effectiveDelta = mode === 'DELTA' ? deltaQty : absoluteStock - currentStock;

  const isStockNegative = calculatedNewStock < 0;
  const hasNoChange = effectiveDelta === 0;

  const handleApplyPresetDelta = (amount: number) => {
    if (mode === 'DELTA') {
      setDeltaQty((prev) => prev + amount);
    } else {
      setAbsoluteStock((prev) => Math.max(0, prev + amount));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (hasNoChange) {
      showWarning('No Stock Change', 'Please adjust quantity by at least 1 unit.');
      return;
    }
    if (isStockNegative) {
      showError('Invalid Stock', 'Inventory cannot be reduced below 0 units.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/inventory/adjust', {
        method: 'POST',
        Hheaders: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: item.id,
          deltaQty: effectiveDelta,
          reasonCode,
          actorName: actorName.split(' ')[0],
          notes: notes.trim() || undefined,
        }),
      } as any);

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to adjust stock level');
      }

      showSuccess(
        'Stock Level Updated',
        `${item.sku} adjusted by ${effectiveDelta > 0 ? `+${effectiveDelta}` : effectiveDelta} units. New balance: ${calculatedNewStock} units.`
      );
      onStockUpdated();
      onClose();
    } catch (err: any) {
      showError('Adjustment Failed', err.message || 'Server error while updating inventory');
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
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <SlidersHorizontal className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <span>Update Stock Level</span>
                  <span className="text-xs px-2 py-0.5 rounded-md font-mono bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                    {item.sku}
                  </span>
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  {item.nameEn} ({item.nameTh})
                </p>
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

          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {/* Current vs New Balance Metric Comparison */}
            <div className="grid grid-cols-3 gap-3 p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800">
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  On-Hand Balance
                </span>
                <div className="text-2xl font-black font-mono text-slate-700 dark:text-slate-300 tabular-nums">
                  {currentStock} <span className="text-xs font-normal">units</span>
                </div>
                <div className="text-[10px] text-slate-400">Threshold: {item.lowStockThreshold}</div>
              </div>

              <div className="space-y-1 text-center border-x border-slate-200 dark:border-slate-800 px-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  Adjustment (Δ)
                </span>
                <div
                  className={`text-2xl font-black font-mono tabular-nums ${
                    effectiveDelta > 0
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : effectiveDelta < 0
                      ? 'text-rose-600 dark:text-rose-400'
                      : 'text-slate-400'
                  }`}
                >
                  {effectiveDelta > 0 ? `+${effectiveDelta}` : effectiveDelta}
                </div>
                <div className="text-[10px] text-slate-400">
                  {effectiveDelta === 0 ? 'No change' : effectiveDelta > 0 ? 'Adding' : 'Deducting'}
                </div>
              </div>

              <div className="space-y-1 text-right">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  New Balance
                </span>
                <div
                  className={`text-2xl font-black font-mono tabular-nums ${
                    isStockNegative
                      ? 'text-rose-600'
                      : calculatedNewStock <= item.lowStockThreshold
                      ? 'text-amber-600'
                      : 'text-slate-900 dark:text-white'
                  }`}
                >
                  {calculatedNewStock} <span className="text-xs font-normal">units</span>
                </div>
                <div className="text-[10px] text-slate-400">
                  {isStockNegative
                    ? 'Invalid (Below zero)'
                    : calculatedNewStock <= item.lowStockThreshold
                    ? 'Will trigger alert'
                    : 'Healthy buffer'}
                </div>
              </div>
            </div>

            {/* Mode Selector */}
            <div className="flex items-center gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs font-bold">
              <button
                type="button"
                onClick={() => setMode('DELTA')}
                className={`flex-1 py-2 px-3 rounded-lg transition-all ${
                  mode === 'DELTA'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Relative Delta (+ / -)
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('ABSOLUTE');
                  setAbsoluteStock(currentStock + deltaQty);
                }}
                className={`flex-1 py-2 px-3 rounded-lg transition-all ${
                  mode === 'ABSOLUTE'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Exact Physical Count
              </button>
            </div>

            {/* Quantity Controls */}
            {mode === 'DELTA' ? (
              <div className="space-y-3">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Adjust Quantity (Delta)
                </label>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setDeltaQty((prev) => prev - 1)}
                    className="p-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl text-slate-700 dark:text-slate-200"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <input
                    type="number"
                    value={deltaQty}
                    onChange={(e) => setDeltaQty(parseInt(e.target.value, 10) || 0)}
                    className="flex-1 py-3 px-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-center font-mono font-black text-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={() => setDeltaQty((prev) => prev + 1)}
                    className="p-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl text-slate-700 dark:text-slate-200"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Physical Count Verified On Shelf
                </label>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setAbsoluteStock((prev) => Math.max(0, prev - 1))}
                    className="p-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl text-slate-700 dark:text-slate-200"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <input
                    type="number"
                    min={0}
                    value={absoluteStock}
                    onChange={(e) => setAbsoluteStock(Math.max(0, parseInt(e.target.value, 10) || 0))}
                    className="flex-1 py-3 px-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-center font-mono font-black text-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={() => setAbsoluteStock((prev) => prev + 1)}
                    className="p-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl text-slate-700 dark:text-slate-200"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* Quick Preset Buttons */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mr-1">
                Presets:
              </span>
              {[-10, -5, -1, 1, 5, 10, 25].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => handleApplyPresetDelta(preset)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-all ${
                    preset > 0
                      ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300'
                      : 'bg-rose-50 text-rose-700 hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-300'
                  }`}
                >
                  {preset > 0 ? `+${preset}` : preset}
                </button>
              ))}
            </div>

            {/* Reason Code Dropdown (Financial & Audit Requirement) */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                <span>Reason Code (Immutable Audit Requirement)</span>
                <span className="text-[10px] text-emerald-600 font-normal">SOX / ISO-Audit</span>
              </label>
              <select
                value={reasonCode}
                onChange={(e) => setReasonCode(e.target.value as ReasonCode)}
                className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-emerald-500"
              >
                {REASON_OPTIONS.map((opt) => (
                  <option key={opt.code} value={opt.code}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-slate-400 italic">
                {REASON_OPTIONS.find((o) => o.code === reasonCode)?.desc}
              </p>
            </div>

            {/* Supervisor / Actor & Notes */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-500">Authorizing Actor</label>
                <div className="flex items-center gap-2 px-3 py-2 bg-slate-100 dark:bg-slate-800/80 rounded-xl text-xs font-mono font-bold text-slate-700 dark:text-slate-300">
                  <UserCheck className="w-3.5 h-3.5 text-emerald-500" />
                  <span>{actorName}</span>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-500">Audit Notes (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Broken bag in carton batch #202"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-medium"
                />
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2.5 text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || hasNoChange || isStockNegative}
                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-50 text-white rounded-xl text-xs font-black shadow-lg shadow-emerald-600/20 inline-flex items-center gap-2 cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Updating Ledger...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Apply Stock Update</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
