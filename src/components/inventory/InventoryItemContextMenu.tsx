import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  SlidersHorizontal,
  ShoppingCart,
  ShieldCheck,
  Package,
  ArrowRight,
  Sparkles,
  ChevronRight,
  Boxes,
} from 'lucide-react';
import { ProductItem } from '../../types/prodx';

export interface ContextMenuPosition {
  x: number;
  y: number;
}

interface InventoryItemContextMenuProps {
  isOpen: boolean;
  item: ProductItem | null;
  position: ContextMenuPosition;
  onClose: () => void;
  onSelectAction: (action: 'UPDATE_STOCK' | 'GENERATE_REORDER' | 'VIEW_AUDIT', item: ProductItem) => void;
}

export const InventoryItemContextMenu: React.FC<InventoryItemContextMenuProps> = ({
  isOpen,
  item,
  position,
  onClose,
  onSelectAction,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on outside click or escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    const handleMouseDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('mousedown', handleMouseDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('mousedown', handleMouseDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen || !item) return null;

  // Viewport clamping
  const menuWidth = 280;
  const menuHeight = 290;
  const clampedX = Math.max(12, Math.min(position.x, window.innerWidth - menuWidth - 16));
  const clampedY = Math.max(12, Math.min(position.y, window.innerHeight - menuHeight - 16));

  const isLowStock = item.stock <= item.lowStockThreshold;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 pointer-events-auto">
        {/* Invisible backdrop to capture outside clicks */}
        <div className="fixed inset-0 bg-transparent" onClick={onClose} />

        <motion.div
          ref={menuRef}
          initial={{ opacity: 0, scale: 0.92, y: -4 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: -4 }}
          transition={{ duration: 0.12, ease: 'easeOut' }}
          style={{
            position: 'fixed',
            left: `${clampedX}px`,
            top: `${clampedY}px`,
            width: `${menuWidth}px`,
          }}
          className="z-50 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200/90 dark:border-slate-800 rounded-2xl shadow-2xl shadow-slate-900/20 overflow-hidden ring-1 ring-black/5 dark:ring-white/10"
        >
          {/* Menu Item Header */}
          <div className="p-3 bg-slate-50/80 dark:bg-slate-950/60 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                {item.sku}
              </span>
              <span
                className={`text-[10px] font-mono font-black px-2 py-0.5 rounded-full ${
                  isLowStock
                    ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
                    : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                }`}
              >
                {item.stock} in stock
              </span>
            </div>
            <div className="mt-1 font-bold text-xs text-slate-900 dark:text-white truncate">
              {item.nameEn}
            </div>
            <div className="text-[10px] text-slate-400 truncate">{item.nameTh}</div>
          </div>

          {/* Quick Actions List */}
          <div className="p-1.5 space-y-1">
            {/* Action 1: Update Stock Level */}
            <button
              type="button"
              onClick={() => {
                onSelectAction('UPDATE_STOCK', item);
                onClose();
              }}
              className="w-full p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-all text-left flex items-start gap-3 group cursor-pointer"
            >
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 group-hover:bg-emerald-500 group-hover:text-white transition-colors">
                <SlidersHorizontal className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center justify-between">
                  <span>Update Stock Level</span>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                </div>
                <div className="text-[10px] text-slate-400 leading-tight">
                  Recount, adjust shrinkage, or check-in
                </div>
              </div>
            </button>

            {/* Action 2: Generate Reorder Request */}
            <button
              type="button"
              onClick={() => {
                onSelectAction('GENERATE_REORDER', item);
                onClose();
              }}
              className="w-full p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-all text-left flex items-start gap-3 group cursor-pointer"
            >
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 group-hover:bg-amber-500 group-hover:text-white transition-colors">
                <ShoppingCart className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center justify-between">
                  <span>Generate Reorder Request</span>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                </div>
                <div className="text-[10px] text-slate-400 leading-tight">
                  Supplier purchase order &amp; safety buffer
                </div>
              </div>
            </button>

            {/* Action 3: View Audit Trail */}
            <button
              type="button"
              onClick={() => {
                onSelectAction('VIEW_AUDIT', item);
                onClose();
              }}
              className="w-full p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-all text-left flex items-start gap-3 group cursor-pointer"
            >
              <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 group-hover:bg-indigo-500 group-hover:text-white transition-colors">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center justify-between">
                  <span>View Audit Trail</span>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                </div>
                <div className="text-[10px] text-slate-400 leading-tight">
                  Inspect immutable SKU event ledger
                </div>
              </div>
            </button>
          </div>

          {/* Micro hint */}
          <div className="px-3 py-1.5 bg-slate-50 dark:bg-slate-950/60 border-t border-slate-100 dark:border-slate-800 text-[9px] font-mono text-slate-400 flex items-center justify-between">
            <span>PRODX Quick Action</span>
            <span>ESC to dismiss</span>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
