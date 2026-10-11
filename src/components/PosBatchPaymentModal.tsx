import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Layers,
  CheckCircle2,
  X,
  Search,
  CheckSquare,
  Square,
  CreditCard,
  QrCode,
  Banknote,
  Building2,
  FileText,
  Printer,
  Mail,
  Send,
  History,
  ShieldCheck,
  Zap,
  AlertCircle,
  Copy,
  Check,
  Receipt,
  User,
  Hash,
  Calendar,
  Sparkles,
} from 'lucide-react';
import { PosOrderRecord, BatchCheckoutRecord, formatSatangToThb } from '../types/prodx';
import { generateConsolidatedReceiptHtml } from '../lib/batchReceiptService';
import { useToast } from '../context/ToastContext';

interface PosBatchPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  orders: PosOrderRecord[];
  onBatchCheckoutSuccess: (batchRecord: BatchCheckoutRecord) => void;
}

export const PosBatchPaymentModal: React.FC<PosBatchPaymentModalProps> = ({
  isOpen,
  onClose,
  orders,
  onBatchCheckoutSuccess,
}) => {
  const { showSuccess, showError, showWarning } = useToast();

  const [activeTab, setActiveTab] = useState<'NEW_BATCH' | 'HISTORY'>('NEW_BATCH');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set());

  // Payment Configuration State
  const [paymentMethod, setPaymentMethod] = useState<'PROMPTPAY_QR' | 'CASH' | 'CREDIT_CARD' | 'CORPORATE_BILL'>('PROMPTPAY_QR');
  const [cashTenderedInput, setCashTenderedInput] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [taxId, setTaxId] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [cardLast4, setCardLast4] = useState('');

  // Processing & Results State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeBatchReceipt, setActiveBatchReceipt] = useState<BatchCheckoutRecord | null>(null);
  const [historyBatches, setHistoryBatches] = useState<BatchCheckoutRecord[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [recipientEmail, setRecipientEmail] = useState('');
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [copiedHash, setCopiedHash] = useState(false);

  // Eligible Completed Orders
  const eligibleOrders = useMemo(() => {
    return orders.filter((o) => o.status === 'COMPLETED' && !o.isBatchConsolidated);
  }, [orders]);

  // Filtered Orders
  const filteredEligibleOrders = useMemo(() => {
    if (!searchQuery.trim()) return eligibleOrders;
    const q = searchQuery.toLowerCase();
    return eligibleOrders.filter(
      (o) =>
        o.orderNumber.toLowerCase().includes(q) ||
        (o.queueNumber && o.queueNumber.toLowerCase().includes(q)) ||
        (o.customerName && o.customerName.toLowerCase().includes(q)) ||
        (o.cashierName && o.cashierName.toLowerCase().includes(q))
    );
  }, [eligibleOrders, searchQuery]);

  // Selected Orders Objects
  const selectedOrdersList = useMemo(() => {
    return eligibleOrders.filter((o) => selectedOrderIds.has(o.id));
  }, [eligibleOrders, selectedOrderIds]);

  // Financial Tally
  const financialTally = useMemo(() => {
    let subtotalSatang = 0;
    let discountSatang = 0;
    let vatSatang = 0;
    let totalSatang = 0;
    let totalItems = 0;

    selectedOrdersList.forEach((o) => {
      subtotalSatang += o.subtotalSatang || 0;
      discountSatang += o.discountSatang || 0;
      vatSatang += o.vatSatang || 0;
      totalSatang += o.totalSatang || 0;
      totalItems += (o.items || []).reduce((acc, it) => acc + it.qty, 0);
    });

    return { subtotalSatang, discountSatang, vatSatang, totalSatang, totalItems };
  }, [selectedOrdersList]);

  // Calculated Change
  const cashTenderedSatang = Math.round((parseFloat(cashTenderedInput) || 0) * 100);
  const changeDueSatang = Math.max(0, cashTenderedSatang - financialTally.totalSatang);

  // Fetch Batch History
  const fetchBatchHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const res = await fetch('/api/orders/batch-checkouts');
      if (res.ok) {
        const data = await res.json();
        setHistoryBatches(data.batchTransactions || []);
      }
    } catch (err: any) {
      console.error('Failed to load batch history', err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  useEffect(() => {
    if (isOpen && activeTab === 'HISTORY') {
      fetchBatchHistory();
    }
  }, [isOpen, activeTab]);

  // Select / Deselect Handlers
  const toggleSelectOrder = (id: string) => {
    setSelectedOrderIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedOrderIds.size === filteredEligibleOrders.length && filteredEligibleOrders.length > 0) {
      setSelectedOrderIds(new Set());
    } else {
      setSelectedOrderIds(new Set(filteredEligibleOrders.map((o) => o.id)));
    }
  };

  // Execute Batch Checkout
  const handleExecuteBatchCheckout = async () => {
    if (selectedOrdersList.length === 0) {
      showWarning('เลือกลูกค้า/ออเดอร์', 'กรุณาเลือกอย่างน้อย 1 ออเดอร์เพื่อทำการชำระเงินรวมบิล');
      return;
    }

    if (paymentMethod === 'CASH' && cashTenderedSatang < financialTally.totalSatang) {
      showWarning('จำนวนเงินไม่พอ', 'เงินสดที่รับมาไม่เพียงพอกับยอดชำระสุทธิ');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        orderIds: selectedOrdersList.map((o) => o.id),
        orderNumbers: selectedOrdersList.map((o) => o.orderNumber),
        paymentMethod,
        cashTenderedSatang: paymentMethod === 'CASH' ? cashTenderedSatang : undefined,
        cashChangeSatang: paymentMethod === 'CASH' ? changeDueSatang : undefined,
        cardLast4: paymentMethod === 'CREDIT_CARD' ? cardLast4 : undefined,
        customerOrCompanyName: companyName.trim() || undefined,
        taxId: taxId.trim() || undefined,
        contactEmail: contactEmail.trim() || undefined,
        notes: notes.trim() || undefined,
        cashierName: 'POS Operator (Nattapong S.)',
      };

      const res = await fetch('/api/orders/batch-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok && data.batchTransaction) {
        showSuccess(
          'ชำระเงินรวมบิลสำเร็จ',
          `สร้างบิลรวมสำเร็จ เลขที่ ${data.batchTransaction.batchNumber} (รวม ${selectedOrdersList.length} ออเดอร์)`
        );
        setActiveBatchReceipt(data.batchTransaction);
        if (contactEmail.trim()) setRecipientEmail(contactEmail.trim());
        onBatchCheckoutSuccess(data.batchTransaction);
        setSelectedOrderIds(new Set());
      } else {
        showError('เกิดข้อผิดพลาดในการรวมชำระ', data.error || 'Failed to execute batch checkout');
      }
    } catch (err: any) {
      showError('Network Error', err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Dispatch Email Receipt
  const handleSendBatchReceiptEmail = async () => {
    if (!activeBatchReceipt || !recipientEmail) {
      showWarning('ระบุอีเมล', 'กรุณาระบุอีเมลผู้รับใบเสร็จ');
      return;
    }
    setIsSendingEmail(true);
    try {
      const res = await fetch('/api/receipts/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order: {
            id: activeBatchReceipt.id,
            orderNumber: activeBatchReceipt.batchNumber,
            storeId: activeBatchReceipt.storeId,
            shiftId: activeBatchReceipt.shiftId,
            cashierName: activeBatchReceipt.cashierName,
            items: [],
            subtotalSatang: activeBatchReceipt.subtotalSatang,
            discountSatang: activeBatchReceipt.discountSatang,
            vatSatang: activeBatchReceipt.vatSatang,
            totalSatang: activeBatchReceipt.totalSatang,
            paymentMethod: activeBatchReceipt.paymentMethod,
            customerName: activeBatchReceipt.customerOrCompanyName,
            idempotencyKey: activeBatchReceipt.settlementHash,
            createdAt: activeBatchReceipt.createdAt,
            status: 'COMPLETED',
          },
          recipientEmail,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        showSuccess('ส่งใบเสร็จดิจิทัลสำเร็จ', `จัดส่งใบเสร็จรวมไปยัง ${recipientEmail} เรียบร้อยแล้ว`);
      } else {
        showError('ส่งอีเมลไม่สำเร็จ', data.error || 'Failed to send email');
      }
    } catch (err: any) {
      showError('Error', err.message);
    } finally {
      setIsSendingEmail(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] max-w-6xl w-full flex flex-col max-h-[92vh] overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-800 font-sans">
        
        {/* Header Bar */}
        <div className="p-6 bg-slate-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0 border-b border-slate-800">
          <div className="flex items-center gap-3.5">
            <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-2xl border border-emerald-500/20">
              <Layers className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black tracking-tight text-white">
                  โหมดชำระเงินรวม (Batch Payment Mode)
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  POS Enterprise
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                รวบรวมออเดอร์ที่ทำรายการเสร็จแล้วหลายบิลเพื่อชำระเงินครั้งเดียว พร้อมออกใบเสร็จรับเงินรวมยอด (Consolidated Master Receipt)
              </p>
            </div>
          </div>

          {/* Tab Navigation & Close */}
          <div className="flex items-center gap-3">
            <div className="flex bg-slate-800 p-1 rounded-xl border border-slate-700/60">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('NEW_BATCH');
                  setActiveBatchReceipt(null);
                }}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                  activeTab === 'NEW_BATCH'
                    ? 'bg-emerald-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>รวมชำระใหม่</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('HISTORY');
                  setActiveBatchReceipt(null);
                }}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                  activeTab === 'HISTORY'
                    ? 'bg-emerald-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <History className="w-3.5 h-3.5" />
                <span>ประวัติบิลรวม</span>
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-10 h-10 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition-all cursor-pointer shrink-0"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body View Router */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50 dark:bg-slate-950">
          
          {/* VIEW 1: ACTIVE BATCH RECEIPT PREVIEW */}
          {activeBatchReceipt ? (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
                  <div>
                    <h3 className="text-sm font-bold text-emerald-900 dark:text-emerald-200">
                      ทำรายการชำระเงินรวมบิลสำเร็จ (Batch Checkout Finalized)
                    </h3>
                    <p className="text-xs text-emerald-700 dark:text-emerald-400">
                      เลขที่บิลรวม: <span className="font-mono font-bold">{activeBatchReceipt.batchNumber}</span> • รวม {activeBatchReceipt.totalOrdersCount} บิล ({activeBatchReceipt.totalItemsCount} ชิ้น)
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => {
                      const printWin = window.open('', '_blank');
                      if (printWin) {
                        printWin.document.write(generateConsolidatedReceiptHtml(activeBatchReceipt));
                        printWin.document.close();
                        printWin.focus();
                        printWin.print();
                      }
                    }}
                    className="flex-1 sm:flex-initial px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                  >
                    <Printer className="w-4 h-4" />
                    <span>พิมพ์ใบเสร็จรวม</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveBatchReceipt(null)}
                    className="px-4 py-2 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl transition-all cursor-pointer"
                  >
                    ทำรายการถัดไป
                  </button>
                </div>
              </div>

              {/* Email Dispatch Box */}
              <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300">
                  <Mail className="w-4 h-4 text-emerald-500" />
                  <span>จัดส่งใบเสร็จดิจิทัลแบบรวมยอดไปยังลูกค้า / แผนกการเงิน (Digital E-Receipt Dispatch)</span>
                </div>
                <div className="flex gap-2">
                  <input
                    type="email"
                    value={recipientEmail}
                    onChange={(e) => setRecipientEmail(e.target.value)}
                    placeholder="ระบุอีเมลผู้รับ (เช่น finance@corporate.com)"
                    className="flex-1 px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={handleSendBatchReceiptEmail}
                    disabled={isSendingEmail || !recipientEmail}
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-2 cursor-pointer shrink-0 shadow-sm shadow-emerald-600/20"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{isSendingEmail ? 'กำลังส่ง...' : 'ส่งอีเมล'}</span>
                  </button>
                </div>
              </div>

              {/* Receipt HTML Preview Frame */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-inner bg-slate-900">
                <iframe
                  title="Consolidated Master Receipt Preview"
                  srcDoc={generateConsolidatedReceiptHtml(activeBatchReceipt)}
                  className="w-full h-[520px] bg-white border-0"
                />
              </div>
            </div>
          ) : activeTab === 'NEW_BATCH' ? (
            
            /* VIEW 2: NEW BATCH CHECKOUT WORKSPACE */
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* Left Column: Order Selection Matrix (7 Cols) */}
              <div className="lg:col-span-7 space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="ค้นหาตามเลขที่ออเดอร์, คิว, ชื่อลูกค้า หรือแคชเชียร์..."
                      className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-xs dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-sm"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleSelectAll}
                    className="px-4 py-2.5 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-2xl transition-all cursor-pointer shrink-0 flex items-center gap-2 shadow-sm"
                  >
                    <CheckSquare className="w-4 h-4 text-emerald-500" />
                    <span>
                      {selectedOrderIds.size === filteredEligibleOrders.length && filteredEligibleOrders.length > 0
                        ? 'ยกเลิกทั้งหมด'
                        : 'เลือกทั้งหมด'}
                    </span>
                  </button>
                </div>

                {/* Orders Checklist */}
                <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1">
                  {filteredEligibleOrders.length === 0 ? (
                    <div className="p-12 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl space-y-3">
                      <Receipt className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto" />
                      <p className="text-sm font-bold text-slate-600 dark:text-slate-400">
                        ไม่พบบิลที่รอชำระเงินรวมในขณะนี้
                      </p>
                      <p className="text-xs text-slate-400 max-w-sm mx-auto">
                        ออเดอร์ทั้งหมดในระบบได้รับการชำระเงินแล้ว หรือถูกนำไปรวมชำระในบิลอื่นเรียบร้อยแล้ว
                      </p>
                    </div>
                  ) : (
                    filteredEligibleOrders.map((ord, idx) => {
                      const isSelected = selectedOrderIds.has(ord.id);
                      const itemCount = (ord.items || []).reduce((acc, it) => acc + it.qty, 0);
                      const ordTime = new Date(ord.createdAt).toLocaleTimeString('th-TH', {
                        hour: '2-digit',
                        minute: '2-digit',
                      });

                      return (
                        <div
                          key={`${ord.id}-${idx}`}
                          onClick={() => toggleSelectOrder(ord.id)}
                          className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-4 ${
                            isSelected
                              ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-500 shadow-md shadow-emerald-500/10'
                              : 'bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/80 border-slate-200 dark:border-slate-800 shadow-sm'
                          }`}
                        >
                          <div className="flex items-center gap-3.5">
                            <div className="shrink-0 text-emerald-600">
                              {isSelected ? (
                                <CheckSquare className="w-5 h-5 text-emerald-600" />
                              ) : (
                                <Square className="w-5 h-5 text-slate-300 dark:text-slate-700" />
                              )}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-mono font-black text-slate-900 dark:text-white">
                                  {ord.orderNumber}
                                </span>
                                {ord.queueNumber && (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                                    คิว: {ord.queueNumber}
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-3">
                                <span>{ordTime} น.</span>
                                <span>•</span>
                                <span>{itemCount} รายการ</span>
                                <span>•</span>
                                <span>โดย {ord.cashierName}</span>
                              </div>
                            </div>
                          </div>

                          <div className="text-right">
                            <div className="text-sm font-mono font-black text-slate-900 dark:text-white">
                              {formatSatangToThb(ord.totalSatang)}
                            </div>
                            <div className="text-[10px] text-slate-400 uppercase font-semibold">
                              {ord.paymentMethod}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Right Column: Checkout Config & Consolidated Tally (5 Cols) */}
              <div className="lg:col-span-5 space-y-5">
                
                {/* Financial Summary Card */}
                <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-md space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                    <h3 className="text-xs font-extrabold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                      สรุปยอดชำระเงินรวม (Consolidated Tally)
                    </h3>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                      เลือกแล้ว {selectedOrdersList.length} บิล ({financialTally.totalItems} ชิ้น)
                    </span>
                  </div>

                  <div className="space-y-2 text-xs font-mono">
                    <div className="flex justify-between text-slate-600 dark:text-slate-400">
                      <span>ยอดรวมสินค้า (Subtotal)</span>
                      <span>{formatSatangToThb(financialTally.subtotalSatang)}</span>
                    </div>
                    {financialTally.discountSatang > 0 && (
                      <div className="flex justify-between text-amber-600 dark:text-amber-400">
                        <span>ส่วนลดสะสม (Discounts)</span>
                        <span>-{formatSatangToThb(financialTally.discountSatang)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-slate-600 dark:text-slate-400">
                      <span>ภาษีมูลค่าเพิ่ม VAT 7%</span>
                      <span>{formatSatangToThb(financialTally.vatSatang)}</span>
                    </div>

                    <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-between items-baseline">
                      <span className="text-sm font-bold text-slate-900 dark:text-white">
                        ยอดชำระรวมสุทธิ (Net Total)
                      </span>
                      <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                        {formatSatangToThb(financialTally.totalSatang)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Payment Tender Method Selector */}
                <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-md space-y-4">
                  <h3 className="text-xs font-extrabold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                    ช่องทางชำระเงิน (Payment Tender)
                  </h3>

                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: 'PROMPTPAY_QR', label: 'PromptPay QR', icon: QrCode, color: 'text-indigo-500' },
                      { id: 'CASH', label: 'เงินสด (Cash)', icon: Banknote, color: 'text-emerald-500' },
                      { id: 'CREDIT_CARD', label: 'บัตรเครดิตองค์กร', icon: CreditCard, color: 'text-blue-500' },
                      { id: 'CORPORATE_BILL', label: 'บิลองค์กร / PO', icon: Building2, color: 'text-purple-500' },
                    ].map((m) => {
                      const IconComponent = m.icon;
                      const isSelected = paymentMethod === m.id;
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => setPaymentMethod(m.id as any)}
                          className={`p-3 rounded-2xl border text-xs font-bold transition-all cursor-pointer flex items-center gap-2.5 ${
                            isSelected
                              ? 'bg-slate-900 text-white border-slate-900 shadow-md'
                              : 'bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          <IconComponent className={`w-4 h-4 ${isSelected ? 'text-emerald-400' : m.color}`} />
                          <span className="truncate">{m.label}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Cash Tender Calculation Input */}
                  {paymentMethod === 'CASH' && (
                    <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                      <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">
                        จำนวนเงินสดที่รับมา (บาท)
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="number"
                          value={cashTenderedInput}
                          onChange={(e) => setCashTenderedInput(e.target.value)}
                          placeholder="0.00"
                          className="flex-1 px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-mono font-bold dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                        <button
                          type="button"
                          onClick={() => setCashTenderedInput((financialTally.totalSatang / 100).toString())}
                          className="px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-bold rounded-xl dark:text-slate-200"
                        >
                          พอดี
                        </button>
                      </div>
                      {cashTenderedSatang > 0 && (
                        <div className="text-xs flex justify-between font-mono pt-1">
                          <span className="text-slate-500">เงินทอน (Change Due):</span>
                          <span className="font-bold text-emerald-600">{formatSatangToThb(changeDueSatang)}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Corporate Info Form Fields */}
                  <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        placeholder="ชื่อบริษัท / ลูกค้า (ระบุเพื่อพิมพ์หัวบิล)"
                        className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                      <input
                        type="text"
                        value={taxId}
                        onChange={(e) => setTaxId(e.target.value)}
                        placeholder="เลขประจำตัวผู้เสียภาษี 13 หลัก"
                        className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                    <input
                      type="text"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="หมายเหตุ / เลขอ้างอิงโครงการ (เช่น มื้อรับรองลูกค้า VIP)"
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                {/* Finalize Action Button */}
                <button
                  type="button"
                  onClick={handleExecuteBatchCheckout}
                  disabled={isSubmitting || selectedOrdersList.length === 0}
                  className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] disabled:opacity-50 text-white font-extrabold text-sm rounded-2xl transition-all flex items-center justify-center gap-2 shadow-xl shadow-emerald-600/25 cursor-pointer"
                >
                  <Zap className="w-5 h-5 fill-current" />
                  <span>
                    {isSubmitting
                      ? 'กำลังประมวลผลการชำระเงิน...'
                      : `ยืนยันการชำระเงินรวม (${selectedOrdersList.length} บิล • ${formatSatangToThb(financialTally.totalSatang)})`}
                  </span>
                </button>
              </div>
            </div>
          ) : (
            
            /* VIEW 3: BATCH HISTORY ARCHIVE */
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <History className="w-4 h-4 text-emerald-500" />
                  <span>ประวัติรายการชำระเงินรวมบิล (Consolidated Master Receipts Archive)</span>
                </h3>
                <button
                  type="button"
                  onClick={fetchBatchHistory}
                  className="px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-bold rounded-xl dark:text-slate-300 hover:bg-slate-50 cursor-pointer"
                >
                  {isLoadingHistory ? 'กำลังโหลด...' : 'รีเฟรช'}
                </button>
              </div>

              {historyBatches.length === 0 ? (
                <div className="p-12 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl space-y-2">
                  <FileText className="w-10 h-10 text-slate-300 mx-auto" />
                  <p className="text-xs font-bold text-slate-600 dark:text-slate-400">
                    ยังไม่มีประวัติการชำระเงินรวมบิลในระบบ
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {historyBatches.map((batch) => {
                    const batchDate = new Date(batch.createdAt).toLocaleString('th-TH', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    });

                    return (
                      <div
                        key={batch.id}
                        className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-mono font-black text-emerald-600 dark:text-emerald-400">
                              {batch.batchNumber}
                            </span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                              {batch.paymentMethod}
                            </span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              {batch.totalOrdersCount} บิลรวม
                            </span>
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-3">
                            <span>{batchDate}</span>
                            <span>•</span>
                            <span>โดย {batch.cashierName}</span>
                            {batch.customerOrCompanyName && (
                              <>
                                <span>•</span>
                                <span className="font-semibold text-slate-700 dark:text-slate-200">
                                  {batch.customerOrCompanyName}
                                </span>
                              </>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-4 justify-between sm:justify-end">
                          <div className="text-right">
                            <div className="text-base font-mono font-black text-slate-900 dark:text-white">
                              {formatSatangToThb(batch.totalSatang)}
                            </div>
                            <div className="text-[10px] text-slate-400">รวมภาษี VAT 7% แล้ว</div>
                          </div>

                          <button
                            type="button"
                            onClick={() => setActiveBatchReceipt(batch)}
                            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
                          >
                            <Receipt className="w-3.5 h-3.5 text-emerald-400" />
                            <span>ดูใบเสร็จ</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
