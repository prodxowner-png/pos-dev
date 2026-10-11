import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Split,
  Users,
  Layers,
  CheckCircle2,
  QrCode,
  CreditCard,
  Banknote,
  Printer,
  ArrowRight,
  AlertCircle,
  Receipt,
} from 'lucide-react';
import { ProductItem, PosOrderRecord, formatSatangToThb } from '../types/prodx';
import { useToast } from '../context/ToastContext';

interface CartEntry {
  product: ProductItem;
  qty: number;
}

interface SplitBillModalProps {
  isOpen: boolean;
  onClose: () => void;
  cart: CartEntry[];
  financials: {
    subtotalSatang: number;
    discountSatang: number;
    vatSatang: number;
    totalSatang: number;
  };
  onCheckoutSuccess: (order: PosOrderRecord) => void;
}

type SplitMode = 'EQUAL' | 'BY_ITEM';

export const SplitBillModal: React.FC<SplitBillModalProps> = ({
  isOpen,
  onClose,
  cart,
  financials,
  onCheckoutSuccess,
}) => {
  const { showSuccess, showError, showInfo } = useToast();
  const [splitMode, setSplitMode] = useState<SplitMode>('EQUAL');
  const [payerCount, setPayerCount] = useState<number>(2);

  // For Equal Split: track payment status & method per payer
  const [payerMethods, setPayerMethods] = useState<Record<number, 'PROMPTPAY_QR' | 'CASH' | 'CREDIT_CARD'>>({
    0: 'PROMPTPAY_QR',
    1: 'CASH',
    2: 'CREDIT_CARD',
    3: 'PROMPTPAY_QR',
  });
  const [paidPayers, setPaidPayers] = useState<Record<number, boolean>>({});
  const [submittingPayer, setSubmittingPayer] = useState<number | null>(null);

  // For Item Split: track which bill (1 or 2) each item is allocated to
  // Format: { [productId]: countInBill1 }
  const [itemAllocations, setItemAllocations] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    cart.forEach((c) => {
      initial[c.product.id] = Math.ceil(c.qty / 2);
    });
    return initial;
  });

  const [bill1Method, setBill1Method] = useState<'PROMPTPAY_QR' | 'CASH' | 'CREDIT_CARD'>('PROMPTPAY_QR');
  const [bill2Method, setBill2Method] = useState<'PROMPTPAY_QR' | 'CASH' | 'CREDIT_CARD'>('CASH');
  const [bill1Paid, setBill1Paid] = useState(false);
  const [bill2Paid, setBill2Paid] = useState(false);
  const [submittingBill, setSubmittingBill] = useState<1 | 2 | null>(null);

  // 1. Equal Split exact Satang calculation (Deterministic integer distribution)
  const equalSplits = useMemo(() => {
    const total = financials.totalSatang;
    const base = Math.floor(total / payerCount);
    const remainder = total % payerCount;

    return Array.from({ length: payerCount }, (_, idx) => {
      // The first `remainder` people pay 1 extra satang so sum === totalSatang exactly
      const amountSatang = idx < remainder ? base + 1 : base;
      return {
        payerIndex: idx,
        label: `Payer #${idx + 1}`,
        amountSatang,
        isPaid: !!paidPayers[idx],
        method: payerMethods[idx] || 'PROMPTPAY_QR',
      };
    });
  }, [financials.totalSatang, payerCount, paidPayers, payerMethods]);

  // 2. By-Item Split exact calculations
  const itemSplitCalculations = useMemo(() => {
    let bill1Subtotal = 0;
    let bill2Subtotal = 0;
    const bill1Items: { product: ProductItem; qty: number; lineTotalSatang: number }[] = [];
    const bill2Items: { product: ProductItem; qty: number; lineTotalSatang: number }[] = [];

    cart.forEach((c) => {
      const qty1 = itemAllocations[c.product.id] ?? Math.ceil(c.qty / 2);
      const qty2 = c.qty - qty1;

      if (qty1 > 0) {
        const lineTotal = c.product.priceSatang * qty1;
        bill1Subtotal += lineTotal;
        bill1Items.push({ product: c.product, qty: qty1, lineTotalSatang: lineTotal });
      }
      if (qty2 > 0) {
        const lineTotal = c.product.priceSatang * qty2;
        bill2Subtotal += lineTotal;
        bill2Items.push({ product: c.product, qty: qty2, lineTotalSatang: lineTotal });
      }
    });

    const totalSub = financials.subtotalSatang || 1;
    // Distribute discount proportionally
    const bill1Discount = Math.round((financials.discountSatang * bill1Subtotal) / totalSub);
    const bill2Discount = financials.discountSatang - bill1Discount;

    const bill1Net = Math.max(0, bill1Subtotal - bill1Discount);
    const bill2Net = Math.max(0, bill2Subtotal - bill2Discount);

    const bill1Vat = Math.round(bill1Net * 0.07);
    const bill2Vat = Math.round(bill2Net * 0.07);

    const bill1Total = bill1Net + bill1Vat;
    const bill2Total = bill2Net + bill2Vat;

    return {
      bill1: {
        items: bill1Items,
        subtotalSatang: bill1Subtotal,
        discountSatang: bill1Discount,
        vatSatang: bill1Vat,
        totalSatang: bill1Total,
      },
      bill2: {
        items: bill2Items,
        subtotalSatang: bill2Subtotal,
        discountSatang: bill2Discount,
        vatSatang: bill2Vat,
        totalSatang: bill2Total,
      },
    };
  }, [cart, itemAllocations, financials]);

  if (!isOpen) return null;

  // Process Equal Split payment per individual payer
  const handlePayEqualPayer = async (payerIdx: number, amountSatang: number) => {
    setSubmittingPayer(payerIdx);
    const method = payerMethods[payerIdx] || 'PROMPTPAY_QR';
    const idemKey = `idem-split-eq-${Date.now()}-${payerIdx}-${Math.random().toString(36).slice(2, 6)}`;

    try {
      // Build proportional items breakdown for authoritative inventory ledger
      const lineItems = cart.map((c) => ({
        productId: c.product.id,
        qty: Math.max(1, Math.round(c.qty / payerCount)),
      }));

      const res = await fetch('/api/orders/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: lineItems,
          discountSatang: Math.round(financials.discountSatang / payerCount),
          paymentMethod: method,
          idempotencyKey: idemKey,
          cashierName: 'Split-Tender Cashier',
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setPaidPayers((prev) => ({ ...prev, [payerIdx]: true }));
        onCheckoutSuccess(data.order);
        showSuccess(
          `Payer #${payerIdx + 1} Cleared`,
          `Paid ฿${(amountSatang / 100).toFixed(2)} via ${method.replace('_', ' ')}`
        );
      } else {
        showError('Payment Error', data.error || 'Failed to complete split tender payment');
      }
    } catch (err: any) {
      showError('Connection Error', err?.message || 'Network error during tender');
    } finally {
      setSubmittingPayer(null);
    }
  };

  // Process Item Split payment for Bill 1 or Bill 2
  const handlePayItemBill = async (billNum: 1 | 2) => {
    const calc = billNum === 1 ? itemSplitCalculations.bill1 : itemSplitCalculations.bill2;
    const method = billNum === 1 ? bill1Method : bill2Method;

    if (calc.items.length === 0) {
      showError('Empty Sub-Bill', `Sub-Bill #${billNum} has no items allocated.`);
      return;
    }

    setSubmittingBill(billNum);
    const idemKey = `idem-split-item-b${billNum}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

    try {
      const res = await fetch('/api/orders/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: calc.items.map((i) => ({ productId: i.product.id, qty: i.qty })),
          discountSatang: calc.discountSatang,
          paymentMethod: method,
          idempotencyKey: idemKey,
          cashierName: 'Split-Item Cashier',
        }),
      });

      const data = await res.json();
      if (res.ok) {
        if (billNum === 1) setBill1Paid(true);
        if (billNum === 2) setBill2Paid(true);
        onCheckoutSuccess(data.order);
        showSuccess(
          `Sub-Bill #${billNum} Settled`,
          `Transaction ${data.order.orderNumber} recorded in ledger (฿${(calc.totalSatang / 100).toFixed(2)})`
        );
      } else {
        showError('Payment Error', data.error || 'Failed to settle sub-bill');
      }
    } catch (err: any) {
      showError('Error', err?.message || 'Network error');
    } finally {
      setSubmittingBill(null);
    }
  };

  const allEqualPaid = equalSplits.every((s) => s.isPaid);
  const allItemBillsPaid = (bill1Paid || itemSplitCalculations.bill1.items.length === 0) &&
    (bill2Paid || itemSplitCalculations.bill2.items.length === 0);

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-4 md:p-6 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden text-slate-900 dark:text-slate-100">
        {/* Header */}
        <div className="p-6 md:p-8 flex items-center justify-between border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-2xl border border-emerald-500/20">
              <Split className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xl font-black tracking-tight">Interactive Split Bill Workspace</h3>
              <p className="text-xs text-slate-400 font-mono tracking-tight">
                Authoritative Multi-Tender Settlement · Total: {formatSatangToThb(financials.totalSatang)}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Selector Tabs */}
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-950 rounded-xl border border-slate-200/60 dark:border-slate-800">
            <button
              onClick={() => setSplitMode('EQUAL')}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition-all ${
                splitMode === 'EQUAL'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Equal Payer Split</span>
            </button>
            <button
              onClick={() => setSplitMode('BY_ITEM')}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition-all ${
                splitMode === 'BY_ITEM'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>Item Allocation Split</span>
            </button>
          </div>

          {splitMode === 'EQUAL' && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Party Size:</span>
              <div className="flex items-center gap-1">
                {[2, 3, 4, 5, 6].map((num) => (
                  <button
                    key={num}
                    onClick={() => {
                      setPayerCount(num);
                      setPaidPayers({});
                    }}
                    className={`w-8 h-8 rounded-lg text-xs font-mono font-bold transition-all ${
                      payerCount === num
                        ? 'bg-emerald-600 text-white shadow-md'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200'
                    }`}
                  >
                    {num}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Body View */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6">
          {splitMode === 'EQUAL' ? (
            /* Mode 1: Equal Split Cards */
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {equalSplits.map((split) => {
                const isCurrentSubmitting = submittingPayer === split.payerIndex;
                return (
                  <div
                    key={split.payerIndex}
                    className={`p-5 rounded-3xl border transition-all ${
                      split.isPaid
                        ? 'bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/40'
                        : 'bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 shadow-sm'
                    }`}
                  >
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-7 h-7 rounded-xl flex items-center justify-center text-xs font-bold font-mono ${
                            split.isPaid
                              ? 'bg-emerald-500 text-white'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          {split.payerIndex + 1}
                        </div>
                        <span className="font-extrabold text-sm">{split.label}</span>
                      </div>
                      {split.isPaid ? (
                        <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 text-xs font-bold">
                          <CheckCircle2 className="w-4 h-4" />
                          <span>PAID</span>
                        </div>
                      ) : (
                        <span className="text-[10px] font-bold text-amber-500 uppercase tracking-widest font-mono">
                          PENDING TENDER
                        </span>
                      )}
                    </div>

                    <div className="py-4 space-y-3">
                      <div className="flex items-baseline justify-between">
                        <span className="text-xs text-slate-400 font-medium">Due Amount</span>
                        <div className="text-2xl font-black font-mono tabular-nums text-slate-900 dark:text-white">
                          ฿{(split.amountSatang / 100).toFixed(2)}
                        </div>
                      </div>

                      {/* Payment Method Selector per payer */}
                      {!split.isPaid && (
                        <div className="space-y-1.5 pt-1">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                            Choose Tender Method
                          </span>
                          <div className="grid grid-cols-3 gap-1.5">
                            {[
                              { id: 'PROMPTPAY_QR', label: 'QR', icon: QrCode },
                              { id: 'CASH', label: 'Cash', icon: Banknote },
                              { id: 'CREDIT_CARD', label: 'Card', icon: CreditCard },
                            ].map((m) => {
                              const isSelected = (payerMethods[split.payerIndex] || 'PROMPTPAY_QR') === m.id;
                              return (
                                <button
                                  key={m.id}
                                  type="button"
                                  onClick={() =>
                                    setPayerMethods((prev) => ({
                                      ...prev,
                                      [split.payerIndex]: m.id as any,
                                    }))
                                  }
                                  className={`py-2 px-1 text-[11px] font-bold rounded-xl border flex items-center justify-center gap-1.5 transition-all ${
                                    isSelected
                                      ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 border-slate-900 shadow-sm'
                                      : 'bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800'
                                  }`}
                                >
                                  <m.icon className="w-3.5 h-3.5" />
                                  <span>{m.label}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>

                    {!split.isPaid && (
                      <button
                        onClick={() => handlePayEqualPayer(split.payerIndex, split.amountSatang)}
                        disabled={isCurrentSubmitting}
                        className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-md active:scale-95 flex items-center justify-center gap-2"
                      >
                        {isCurrentSubmitting ? (
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <>
                            <Printer className="w-4 h-4" />
                            <span>Collect ฿{(split.amountSatang / 100).toFixed(2)}</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            /* Mode 2: By-Item Drag/Step Allocation */
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left Column: Item Allocator */}
              <div className="lg:col-span-6 space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-400">
                    Allocate Items to Sub-Bills
                  </h4>
                  <span className="text-[10px] text-slate-500 font-mono">Bill 1 vs Bill 2</span>
                </div>

                <div className="space-y-3">
                  {cart.map((entry) => {
                    const inBill1 = itemAllocations[entry.product.id] ?? Math.ceil(entry.qty / 2);
                    const inBill2 = entry.qty - inBill1;

                    return (
                      <div
                        key={entry.product.id}
                        className="p-3.5 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-2"
                      >
                        <div className="flex justify-between items-center text-xs">
                          <span className="font-bold text-slate-800 dark:text-slate-200">
                            {entry.product.nameEn}
                          </span>
                          <span className="font-mono text-slate-500">
                            {formatSatangToThb(entry.product.priceSatang * entry.qty)}
                          </span>
                        </div>

                        {/* Slider / Stepper */}
                        <div className="flex items-center justify-between gap-3 pt-1">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                              Bill #1: {inBill1}
                            </span>
                          </div>

                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                setItemAllocations((prev) => ({
                                  ...prev,
                                  [entry.product.id]: Math.max(0, inBill1 - 1),
                                }));
                              }}
                              className="w-7 h-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-bold hover:bg-slate-100 flex items-center justify-center active:scale-95"
                            >
                              -
                            </button>
                            <span className="w-8 text-center font-mono font-bold text-xs">{inBill1}</span>
                            <button
                              type="button"
                              onClick={() => {
                                setItemAllocations((prev) => ({
                                  ...prev,
                                  [entry.product.id]: Math.min(entry.qty, inBill1 + 1),
                                }));
                              }}
                              className="w-7 h-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-bold hover:bg-slate-100 flex items-center justify-center active:scale-95"
                            >
                              +
                            </button>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 font-mono">
                              Bill #2: {inBill2}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Right Column: Sub-Bill 1 and Sub-Bill 2 Summaries */}
              <div className="lg:col-span-6 space-y-5">
                {/* Sub-Bill 1 */}
                <div
                  className={`p-5 rounded-3xl border ${
                    bill1Paid
                      ? 'bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-200'
                      : 'bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800'
                  }`}
                >
                  <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-slate-800">
                    <span className="font-extrabold text-xs text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                      Sub-Bill #1
                    </span>
                    {bill1Paid ? (
                      <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">
                        <CheckCircle2 className="w-4 h-4" /> Settle
                      </span>
                    ) : (
                      <div className="flex gap-1">
                        {(['PROMPTPAY_QR', 'CASH', 'CREDIT_CARD'] as const).map((m) => (
                          <button
                            key={m}
                            onClick={() => setBill1Method(m)}
                            className={`px-2 py-0.5 text-[10px] font-bold rounded ${
                              bill1Method === m ? 'bg-emerald-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                            }`}
                          >
                            {m === 'PROMPTPAY_QR' ? 'QR' : m === 'CASH' ? 'Cash' : 'Card'}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="py-3 flex justify-between items-baseline">
                    <span className="text-xs text-slate-400 font-mono">
                      {itemSplitCalculations.bill1.items.length} Lines Allocated
                    </span>
                    <span className="text-xl font-black font-mono">
                      ฿{(itemSplitCalculations.bill1.totalSatang / 100).toFixed(2)}
                    </span>
                  </div>

                  {!bill1Paid && itemSplitCalculations.bill1.items.length > 0 && (
                    <button
                      onClick={() => handlePayItemBill(1)}
                      disabled={submittingBill === 1}
                      className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow active:scale-95"
                    >
                      {submittingBill === 1 ? 'Settling...' : 'Settle Sub-Bill #1'}
                    </button>
                  )}
                </div>

                {/* Sub-Bill 2 */}
                <div
                  className={`p-5 rounded-3xl border ${
                    bill2Paid
                      ? 'bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-200'
                      : 'bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800'
                  }`}
                >
                  <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-slate-800">
                    <span className="font-extrabold text-xs text-amber-600 dark:text-amber-400 uppercase tracking-wider">
                      Sub-Bill #2
                    </span>
                    {bill2Paid ? (
                      <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">
                        <CheckCircle2 className="w-4 h-4" /> Settle
                      </span>
                    ) : (
                      <div className="flex gap-1">
                        {(['PROMPTPAY_QR', 'CASH', 'CREDIT_CARD'] as const).map((m) => (
                          <button
                            key={m}
                            onClick={() => setBill2Method(m)}
                            className={`px-2 py-0.5 text-[10px] font-bold rounded ${
                              bill2Method === m ? 'bg-amber-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                            }`}
                          >
                            {m === 'PROMPTPAY_QR' ? 'QR' : m === 'CASH' ? 'Cash' : 'Card'}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="py-3 flex justify-between items-baseline">
                    <span className="text-xs text-slate-400 font-mono">
                      {itemSplitCalculations.bill2.items.length} Lines Allocated
                    </span>
                    <span className="text-xl font-black font-mono">
                      ฿{(itemSplitCalculations.bill2.totalSatang / 100).toFixed(2)}
                    </span>
                  </div>

                  {!bill2Paid && itemSplitCalculations.bill2.items.length > 0 && (
                    <button
                      onClick={() => handlePayItemBill(2)}
                      disabled={submittingBill === 2}
                      className="w-full py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow active:scale-95"
                    >
                      {submittingBill === 2 ? 'Settling...' : 'Settle Sub-Bill #2'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 flex items-center justify-between">
          <div className="text-xs text-slate-400 font-mono">
            {splitMode === 'EQUAL'
              ? `${Object.keys(paidPayers).length} of ${payerCount} Payers Settled`
              : `${bill1Paid ? 1 : 0} + ${bill2Paid ? 1 : 0} of 2 Sub-Bills Settled`}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-5 py-2.5 bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-bold rounded-xl hover:bg-slate-300 transition-colors"
            >
              {allEqualPaid || allItemBillsPaid ? 'Done' : 'Cancel'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
