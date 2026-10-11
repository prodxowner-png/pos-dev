import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  QrCode,
  CreditCard,
  Banknote,
  Wallet,
  CheckCircle2,
  Copy,
  Download,
  Tv,
  RefreshCw,
  Clock,
  ShieldCheck,
  Check,
  AlertCircle,
  ArrowRight,
  Receipt,
  Building2,
  Sparkles,
  Zap,
  PhoneCall,
  User,
  ShoppingBag,
  FileCheck2,
  Sliders,
  Volume2,
  VolumeX,
  History,
  ListFilter,
  Search,
  Trash2,
  ExternalLink,
  Activity,
  CheckCircle,
  XCircle,
  Filter,
} from 'lucide-react';
import { CartEntry, PosOrderRecord, formatSatangToThb, CustomerMember } from '../types/prodx';
import { generatePromptPayPayload, generateQrDataUrl } from '../utils/promptpayQr';
import { playPaymentConfirmationPing } from '../utils/paymentAudio';
import { paymentService, PaymentCheckLog, PaymentStatus } from '../services/paymentService';

interface PosPaymentTabProps {
  cart: CartEntry[];
  subtotalSatang: number;
  discountSatang: number;
  taxSatang: number;
  totalSatang: number;
  activeCustomer: CustomerMember | null;
  cashierName?: string;
  storeId?: string;
  onCompleteOrder: (paymentDetails: {
    method: 'PROMPTPAY_QR' | 'CASH' | 'CREDIT_CARD' | 'SPLIT' | 'TRUEMONEY';
    cashTenderedSatang?: number;
    changeSatang?: number;
    transactionRef?: string;
    customerNotes?: string;
  }) => Promise<void>;
  onSendToCustomerDisplay?: (payload: { type: string; data: any }) => void;
  recentOrders?: PosOrderRecord[];
}

export const PosPaymentTab: React.FC<PosPaymentTabProps> = ({
  cart,
  subtotalSatang,
  discountSatang,
  taxSatang,
  totalSatang,
  activeCustomer,
  cashierName = 'Cashier Staff',
  storeId = 'BKK-FLAGSHIP-01',
  onCompleteOrder,
  onSendToCustomerDisplay,
  recentOrders = [],
}) => {
  // Payment Type State
  const [paymentType, setPaymentType] = useState<'PROMPTPAY_QR' | 'TRUEMONEY' | 'CREDIT_CARD' | 'CASH' | 'SPLIT'>('PROMPTPAY_QR');

  // Amount Mode State (Default to Cart Total if cart has items, else Custom Amount)
  const cartAmountThb = totalSatang / 100;
  const [isUsingCartBalance, setIsUsingCartBalance] = useState<boolean>(cart.length > 0);
  const [customAmountThb, setCustomAmountThb] = useState<string>(cartAmountThb > 0 ? cartAmountThb.toFixed(2) : '150.00');

  // Computed Active Amount
  const activeAmountThb = useMemo(() => {
    if (isUsingCartBalance) {
      return cartAmountThb;
    }
    const parsed = parseFloat(customAmountThb);
    return isNaN(parsed) || parsed < 0 ? 0 : parsed;
  }, [isUsingCartBalance, cartAmountThb, customAmountThb]);

  // Merchant Configuration
  const [merchantTarget, setMerchantTarget] = useState<string>('0105562098712'); // PRODX Tax ID
  const [merchantName, setMerchantName] = useState<string>('PRODX Minimart Flagship Store');
  const [ref1, setRef1] = useState<string>(`ORD-${Date.now().toString().slice(-6)}`);
  const [ref2, setRef2] = useState<string>(activeCustomer ? activeCustomer.phone : 'POS-COUNTER-01');

  // Generated QR Payload & Data URL State
  const [qrPayload, setQrPayload] = useState<string>('');
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [isGeneratingQr, setIsGeneratingQr] = useState<boolean>(false);
  const [copiedPayload, setCopiedPayload] = useState<boolean>(false);
  const [sentToDisplay, setSentToDisplay] = useState<boolean>(false);

  // Countdown Timer & Payment Status
  const [countdownSeconds, setCountdownSeconds] = useState<number>(300); // 5 minutes timer
  const [paymentStatus, setPaymentStatus] = useState<'WAITING' | 'VERIFYING' | 'SUCCESS' | 'FAILED'>('WAITING');
  const [transactionRefId, setTransactionRefId] = useState<string>('');
  const [isProcessingCheckout, setIsProcessingCheckout] = useState<boolean>(false);

  // Audio Feedback State for QR Payment Confirmation
  const [isAudioMuted, setIsAudioMuted] = useState<boolean>(false);

  // Audio feedback effect: Play subtle 'ping' sound when QR payment confirmation is received
  useEffect(() => {
    if (paymentStatus === 'SUCCESS' && !isAudioMuted) {
      playPaymentConfirmationPing(0.25);
    }
  }, [paymentStatus, isAudioMuted]);

  // Polling Mechanism State for Backend Status Checks
  const [pollCheckCount, setPollCheckCount] = useState<number>(0);
  const [lastPolledAt, setLastPolledAt] = useState<string | null>(null);
  const [isManualChecking, setIsManualChecking] = useState<boolean>(false);

  // Payment History Tracking State
  const [paymentHistory, setPaymentHistory] = useState<PaymentCheckLog[]>([]);
  const [historyFilter, setHistoryFilter] = useState<'ALL' | 'SUCCESS' | 'WAITING' | 'FAILED'>('ALL');
  const [historySearch, setHistorySearch] = useState<string>('');

  // Fetch initial payment history logs from backend on mount
  useEffect(() => {
    paymentService
      .fetchHistory()
      .then((data) => {
        if (data && Array.isArray(data.logs) && data.logs.length > 0) {
          setPaymentHistory(data.logs as PaymentCheckLog[]);
        }
      })
      .catch((err) => console.warn('Initial payment history load error:', err));
  }, []);

  // Subscribe to real-time payment webhook events
  useEffect(() => {
    const unsubscribe = paymentService.subscribeToWebhookEvents((webhookRes) => {
      if (webhookRes.transaction && webhookRes.transaction.ref1 === ref1) {
        if (webhookRes.transaction.status === 'SUCCESS') {
          const txId = webhookRes.transaction.transactionRefId || `TXN-WH-${Math.floor(100000 + Math.random() * 900000)}`;
          setTransactionRefId(txId);
          setPaymentStatus('SUCCESS');

          if (isUsingCartBalance && cart.length > 0) {
            setIsProcessingCheckout(true);
            onCompleteOrder({
              method: paymentType === 'TRUEMONEY' ? 'TRUEMONEY' : 'PROMPTPAY_QR',
              transactionRef: txId,
              customerNotes: `PromptPay QR Paid & Confirmed via Real-Time Webhook (Ref1: ${ref1})`,
            }).finally(() => setIsProcessingCheckout(false));
          }
        }
      }
    });
    return () => unsubscribe();
  }, [ref1, isUsingCartBalance, cart.length, paymentType, onCompleteOrder]);

  // Helper function to record a payment check log entry
  const addPaymentCheckLog = (logEntry: Omit<PaymentCheckLog, 'id' | 'timestamp'>) => {
    const newLog: PaymentCheckLog = {
      ...logEntry,
      id: `LOG-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      timestamp: new Date().toLocaleTimeString('th-TH'),
    };

    setPaymentHistory((prev) => [newLog, ...prev]);
    paymentService.logCheck(newLog).catch(() => {});
  };

  // Cash Tender State
  const [cashTenderedThb, setCashTenderedThb] = useState<string>('');
  const cashTenderedSatang = Math.round((parseFloat(cashTenderedThb) || 0) * 100);
  const changeSatang = Math.max(0, cashTenderedSatang - Math.round(activeAmountThb * 100));

  // Bank Slip OCR Verification Simulation
  const [isVerifyingSlip, setIsVerifyingSlip] = useState<boolean>(false);
  const [slipResult, setSlipResult] = useState<{
    valid: boolean;
    transId?: string;
    senderName?: string;
    amountThb?: number;
    timestamp?: string;
  } | null>(null);

  // Generate QR Code on Parameter Change
  useEffect(() => {
    let isMounted = true;
    const updateQr = async () => {
      setIsGeneratingQr(true);
      const payload = generatePromptPayPayload({
        target: merchantTarget,
        amount: activeAmountThb,
        ref1,
        ref2,
      });
      if (isMounted) {
        setQrPayload(payload);
      }
      const dataUrl = await generateQrDataUrl(payload, 360);
      if (isMounted) {
        setQrDataUrl(dataUrl);
        setIsGeneratingQr(false);
      }
    };

    updateQr();
    return () => {
      isMounted = false;
    };
  }, [merchantTarget, activeAmountThb, ref1, ref2, paymentType]);

  // Register QR transaction session on backend API whenever parameters change
  useEffect(() => {
    if (paymentType !== 'PROMPTPAY_QR' && paymentType !== 'TRUEMONEY') return;
    if (!ref1) return;

    paymentService
      .initQrSession({
        ref1,
        ref2,
        amountThb: activeAmountThb,
        paymentMethod: paymentType,
      })
      .catch((err) => console.warn('[Payment Gateway] Failed to register QR session:', err));

    addPaymentCheckLog({
      ref1,
      ref2,
      amountThb: activeAmountThb,
      paymentMethod: paymentType,
      type: 'QR_GENERATED',
      status: 'WAITING',
      checkNumber: 0,
      message: 'QR code generated and payment session initialized',
    });

    setPollCheckCount(0);
    setLastPolledAt(null);
    setPaymentStatus('WAITING');
  }, [ref1, ref2, activeAmountThb, paymentType]);

  // Polling Mechanism: Automatically check transaction confirmation status via paymentService
  useEffect(() => {
    if (paymentStatus !== 'WAITING') return;
    if (paymentType !== 'PROMPTPAY_QR' && paymentType !== 'TRUEMONEY') return;
    if (!ref1) return;

    const controller = paymentService.startPolling({
      ref1,
      ref2,
      amountThb: activeAmountThb,
      paymentMethod: paymentType,
      initialDelayMs: 1200,
      intervalMs: 2500,
      onCheck: (_res, count) => {
        setPollCheckCount(count);
        setLastPolledAt(new Date().toLocaleTimeString('th-TH'));
      },
      onSuccess: async (res) => {
        const txId = res.transactionRefId || `TXN-PP-${Math.floor(10000000 + Math.random() * 90000000)}`;
        setTransactionRefId(txId);
        setPaymentStatus('SUCCESS');

        // Auto-trigger order completion if cart balance is selected
        if (isUsingCartBalance && cart.length > 0) {
          setIsProcessingCheckout(true);
          try {
            await onCompleteOrder({
              method: paymentType === 'TRUEMONEY' ? 'TRUEMONEY' : 'PROMPTPAY_QR',
              transactionRef: txId,
              customerNotes: `PromptPay QR Paid & Confirmed via API Service Polling (Ref1: ${ref1})`,
            });
          } finally {
            setIsProcessingCheckout(false);
          }
        }
      },
      onFailed: () => {
        setPaymentStatus('FAILED');
      },
    });

    return () => {
      controller.stop();
    };
  }, [ref1, ref2, paymentStatus, paymentType, activeAmountThb, isUsingCartBalance, cart.length, onCompleteOrder]);

  // Countdown timer effect
  useEffect(() => {
    if (paymentStatus !== 'WAITING') return;
    const interval = setInterval(() => {
      setCountdownSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [paymentStatus]);

  // Manual Check Handler
  const handleManualCheckStatus = async () => {
    if (!ref1) return;
    setIsManualChecking(true);
    try {
      const data = await paymentService.checkStatus(ref1);
      setLastPolledAt(new Date().toLocaleTimeString('th-TH'));
      const nextCheck = pollCheckCount + 1;
      setPollCheckCount(nextCheck);

      const isSuccess = data.status === 'SUCCESS';
      const txId = isSuccess ? (data.transactionRefId || `TXN-PP-${Math.floor(10000000 + Math.random() * 90000000)}`) : undefined;

      addPaymentCheckLog({
        ref1,
        ref2,
        amountThb: activeAmountThb,
        paymentMethod: paymentType,
        type: 'MANUAL_CHECK',
        status: isSuccess ? 'SUCCESS' : 'WAITING',
        checkNumber: nextCheck,
        transactionRefId: txId,
        message: isSuccess
          ? 'Transaction confirmed via manual status check'
          : 'Manual status check executed - WAITING',
      });

      if (data.status === 'SUCCESS') {
        setTransactionRefId(txId || '');
        setPaymentStatus('SUCCESS');

        if (isUsingCartBalance && cart.length > 0) {
          setIsProcessingCheckout(true);
          try {
            await onCompleteOrder({
              method: paymentType === 'TRUEMONEY' ? 'TRUEMONEY' : 'PROMPTPAY_QR',
              transactionRef: txId,
              customerNotes: `PromptPay QR Paid & Confirmed via Manual API Service Check (Ref1: ${ref1})`,
            });
          } finally {
            setIsProcessingCheckout(false);
          }
        }
      }
    } catch (err) {
      console.error('Manual status check error:', err);
    } finally {
      setIsManualChecking(false);
    }
  };

  // Reset Countdown when Regenerated
  const handleRegenerateQr = () => {
    setCountdownSeconds(300);
    setPaymentStatus('WAITING');
    setSlipResult(null);
    setPollCheckCount(0);
    setLastPolledAt(null);
    setRef1(`ORD-${Date.now().toString().slice(-6)}`);
  };

  // Broadcast QR to Customer Display
  const handleSendToDisplay = () => {
    if (onSendToCustomerDisplay) {
      onSendToCustomerDisplay({
        type: 'PROMPTPAY_QR_DISPLAY',
        data: {
          qrDataUrl,
          amountThb: activeAmountThb,
          merchantName,
          ref1,
          itemsCount: isUsingCartBalance ? cart.reduce((acc, c) => acc + c.qty, 0) : 1,
        },
      });
      setSentToDisplay(true);
      setTimeout(() => setSentToDisplay(false), 3000);
    }
  };

  // Copy Payload
  const handleCopyPayload = () => {
    navigator.clipboard.writeText(qrPayload);
    setCopiedPayload(true);
    setTimeout(() => setCopiedPayload(false), 2500);
  };

  // Download QR Code Image
  const handleDownloadQr = () => {
    if (!qrDataUrl) return;
    const link = document.createElement('a');
    link.href = qrDataUrl;
    link.download = `PromptPay_QR_${ref1}_THB${activeAmountThb}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Simulate Customer Scan & Bank Webhook Payment
  const handleSimulatePaymentSuccess = async () => {
    setPaymentStatus('VERIFYING');
    await new Promise((r) => setTimeout(r, 600));

    const simulatedTxId = `TXN-WH-${Math.floor(10000000 + Math.random() * 90000000)}`;

    try {
      // Trigger webhook via paymentService
      await paymentService.triggerWebhook({
        ref1,
        ref2,
        amountThb: activeAmountThb,
        transactionRefId: simulatedTxId,
        payerName: 'KBank Mobile Banking (Webhook)',
        status: 'SUCCESS',
        event: 'PAYMENT_RECEIVED',
      });
    } catch (e) {
      console.warn('Failed to trigger payment webhook:', e);
      // Fallback direct confirm
      await paymentService.confirmPayment({
        ref1,
        transactionRefId: simulatedTxId,
        payerName: 'KBank Mobile Banking (Simulated)',
        status: 'SUCCESS',
      });
    }

    setTransactionRefId(simulatedTxId);
    setPaymentStatus('SUCCESS');

    // If there is an active cart, auto-trigger checkout completion!
    if (isUsingCartBalance && cart.length > 0) {
      setIsProcessingCheckout(true);
      try {
        await onCompleteOrder({
          method: paymentType === 'TRUEMONEY' ? 'TRUEMONEY' : 'PROMPTPAY_QR',
          transactionRef: simulatedTxId,
          customerNotes: `PromptPay QR Paid via Webhook (Ref1: ${ref1})`,
        });
      } finally {
        setIsProcessingCheckout(false);
      }
    }
  };

  // Simulate Bank Slip Verification OCR
  const handleSimulateSlipUpload = async () => {
    setIsVerifyingSlip(true);
    await new Promise((r) => setTimeout(r, 1000));
    setIsVerifyingSlip(false);
    const transId = `SLIP-OCR-${Math.floor(100000 + Math.random() * 900000)}`;

    try {
      await paymentService.confirmPayment({
        ref1,
        transactionRefId: transId,
        payerName: 'SOMCHAI J. (KBank)',
        status: 'SUCCESS',
      });
    } catch (e) {
      console.warn('Failed to confirm payment on backend:', e);
    }

    addPaymentCheckLog({
      ref1,
      ref2,
      amountThb: activeAmountThb,
      paymentMethod: paymentType,
      type: 'SLIP_OCR',
      status: 'SUCCESS',
      checkNumber: pollCheckCount + 1,
      transactionRefId: transId,
      message: 'Bank slip OCR verified and matched with bank gateway',
    });

    setSlipResult({
      valid: true,
      transId,
      senderName: 'SOMCHAI J. (KBank)',
      amountThb: activeAmountThb,
      timestamp: new Date().toLocaleTimeString('th-TH'),
    });
    setPaymentStatus('SUCCESS');
    setTransactionRefId(transId);
  };

  // Direct Cash / Card Checkout trigger
  const handleDirectMethodCheckout = async () => {
    if (cart.length === 0) return;
    setIsProcessingCheckout(true);
    try {
      await onCompleteOrder({
        method: paymentType,
        cashTenderedSatang: paymentType === 'CASH' ? cashTenderedSatang : undefined,
        changeSatang: paymentType === 'CASH' ? changeSatang : undefined,
        transactionRef: `EDC-${Date.now().toString().slice(-8)}`,
      });
    } finally {
      setIsProcessingCheckout(false);
    }
  };

  // Filtered payment history list based on active tab & search query
  const filteredPaymentHistory = useMemo(() => {
    return paymentHistory.filter((log) => {
      // Filter by Status Tab
      if (historyFilter !== 'ALL' && log.status !== historyFilter) {
        return false;
      }
      // Search query filter
      if (historySearch.trim()) {
        const q = historySearch.toLowerCase().trim();
        const matchesRef1 = log.ref1?.toLowerCase().includes(q);
        const matchesRef2 = log.ref2?.toLowerCase().includes(q);
        const matchesTxn = log.transactionRefId?.toLowerCase().includes(q);
        const matchesMsg = log.message?.toLowerCase().includes(q);
        const matchesType = log.type?.toLowerCase().includes(q);
        return matchesRef1 || matchesRef2 || matchesTxn || matchesMsg || matchesType;
      }
      return true;
    });
  }, [paymentHistory, historyFilter, historySearch]);

  const historyMetrics = useMemo(() => {
    const total = paymentHistory.length;
    const successCount = paymentHistory.filter((l) => l.status === 'SUCCESS').length;
    const waitingCount = paymentHistory.filter((l) => l.status === 'WAITING' || l.status === 'PENDING').length;
    const failedCount = paymentHistory.filter((l) => l.status === 'FAILED').length;
    const totalConfirmedThb = paymentHistory
      .filter((l) => l.status === 'SUCCESS')
      .reduce((acc, l) => acc + (l.amountThb || 0), 0);

    return { total, successCount, waitingCount, failedCount, totalConfirmedThb };
  }, [paymentHistory]);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden">
        <div className="absolute -right-10 -bottom-10 w-60 h-60 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-full text-[11px] font-mono font-bold uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                PromptPay Dynamic Gateway Ready
              </span>
              <span className="text-xs text-slate-400 font-mono">Store: {storeId}</span>
            </div>
            <h2 className="text-2xl font-black tracking-tight flex items-center gap-2">
              <QrCode className="w-7 h-7 text-emerald-400" />
              <span>ศูนย์ชำระเงินและเครื่องสร้าง QR Code</span>
            </h2>
            <p className="text-xs text-slate-400">
              รองรับ PromptPay QR, TrueMoney, บัตรเครดิต/เดบิต, เงินสด และตรวจสอบสลิปอัตโนมัติ
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {/* Audio Feedback Quick Control Widget */}
            <div className="flex items-center gap-2 bg-slate-800/80 border border-slate-700/60 rounded-2xl p-2">
              <button
                type="button"
                onClick={() => {
                  const nextMuted = !isAudioMuted;
                  setIsAudioMuted(nextMuted);
                  if (!nextMuted) {
                    playPaymentConfirmationPing(0.25);
                  }
                }}
                className={`px-3 py-1.5 rounded-xl border text-xs font-mono font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  isAudioMuted
                    ? 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
                    : 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/30'
                }`}
                title={isAudioMuted ? 'เปิดเสียงแจ้งเตือน (Unmute)' : 'ปิดเสียงแจ้งเตือน (Mute)'}
              >
                {isAudioMuted ? <VolumeX className="w-3.5 h-3.5 text-slate-400" /> : <Volume2 className="w-3.5 h-3.5 text-emerald-400" />}
                <span className="text-[11px]">{isAudioMuted ? 'Muted' : 'Sound ON'}</span>
              </button>

              <button
                type="button"
                onClick={() => playPaymentConfirmationPing(0.3)}
                className="px-2.5 py-1.5 bg-slate-700/80 hover:bg-slate-600 border border-slate-600/80 rounded-xl text-[11px] font-mono text-emerald-400 hover:text-emerald-300 transition-all cursor-pointer flex items-center gap-1 shadow-sm active:scale-95"
                title="ทดสอบเสียงปิ๊งยืนยันชำระเงิน (Test Audio Ping)"
              >
                <span>🔊 Test Ping</span>
              </button>
            </div>

            <div className="bg-slate-800/80 border border-slate-700/60 rounded-2xl px-4 py-2.5 text-right font-mono">
              <div className="text-[10px] text-slate-400 uppercase tracking-widest">ยอดชำระสุทธิ (THB)</div>
              <div className="text-2xl font-black text-emerald-400 tabular-nums">
                ฿{activeAmountThb.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Method Selector & Order Context (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Payment Method Selector Grid */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-5 shadow-sm space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-2">
              <Sliders className="w-4 h-4 text-emerald-500" />
              1. เลือกช่องทางการชำระเงิน (Select Payment Method)
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[
                {
                  id: 'PROMPTPAY_QR',
                  title: 'PromptPay QR',
                  subtitle: 'สแกนพร้อมเพย์ทุกธนาคาร',
                  icon: QrCode,
                  badge: 'ยอดนิยม',
                  color: 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400',
                },
                {
                  id: 'TRUEMONEY',
                  title: 'TrueMoney Wallet',
                  subtitle: 'แสกนผ่าน E-Wallet',
                  icon: Wallet,
                  color: 'border-orange-500 bg-orange-50/50 dark:bg-orange-950/30 text-orange-600 dark:text-orange-400',
                },
                {
                  id: 'CREDIT_CARD',
                  title: 'Credit / EDC Card',
                  subtitle: 'แตะ/เสียบบัตร Contactless',
                  icon: CreditCard,
                  color: 'border-purple-500 bg-purple-50/50 dark:bg-purple-950/30 text-purple-600 dark:text-purple-400',
                },
                {
                  id: 'CASH',
                  title: 'Cash / เงินสด',
                  subtitle: 'คำนวณเงินทอนอัตโนมัติ',
                  icon: Banknote,
                  color: 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400',
                },
              ].map((m) => {
                const isSelected = paymentType === m.id;
                const IconComponent = m.icon;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setPaymentType(m.id as any)}
                    className={`p-3.5 rounded-2xl border text-left transition-all relative flex flex-col justify-between cursor-pointer ${
                      isSelected
                        ? `${m.color} ring-2 ring-emerald-500/30 shadow-md`
                        : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    {m.badge && (
                      <span className="absolute top-2 right-2 px-1.5 py-0.5 bg-indigo-600 text-white rounded-full text-[9px] font-bold">
                        {m.badge}
                      </span>
                    )}
                    <IconComponent className="w-6 h-6 mb-2" />
                    <div>
                      <div className="font-bold text-xs">{m.title}</div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight mt-0.5">{m.subtitle}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Amount Source & Custom Input */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-2">
                <ShoppingBag className="w-4 h-4 text-emerald-500" />
                2. แหล่งที่มาของยอดเงิน (Amount Source)
              </h3>
              {cart.length > 0 && (
                <span className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 rounded-full text-[10px] font-bold">
                  {cart.length} รายการในตะกร้า
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setIsUsingCartBalance(true)}
                disabled={cart.length === 0}
                className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                  isUsingCartBalance
                    ? 'border-emerald-500 bg-emerald-50/40 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-200 font-bold'
                    : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 opacity-70'
                }`}
              >
                <div className="text-xs font-bold">ดึงยอดจากตะกร้าสินค้า POS</div>
                <div className="text-[11px] font-mono mt-1 text-emerald-600 dark:text-emerald-400">
                  ฿{cartAmountThb.toFixed(2)} THB
                </div>
              </button>

              <button
                type="button"
                onClick={() => setIsUsingCartBalance(false)}
                className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                  !isUsingCartBalance
                    ? 'border-emerald-500 bg-emerald-50/40 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-200 font-bold'
                    : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 opacity-70'
                }`}
              >
                <div className="text-xs font-bold">ระบุยอดเงินเอง (Custom Amount)</div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  กรอกยอดอิสระ
                </div>
              </button>
            </div>

            {!isUsingCartBalance && (
              <div className="space-y-3 pt-2">
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-base font-bold text-slate-400">฿</span>
                  <input
                    type="number"
                    step="0.01"
                    value={customAmountThb}
                    onChange={(e) => setCustomAmountThb(e.target.value)}
                    placeholder="0.00"
                    className="w-full pl-9 pr-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-lg font-mono font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div className="flex flex-wrap gap-2">
                  {[50, 100, 200, 500, 1000].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setCustomAmountThb(amt.toString())}
                      className="px-3 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-xs font-mono font-bold text-slate-700 dark:text-slate-300 transition-colors"
                    >
                      +฿{amt}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* PromptPay & Cash Options Configuration */}
          {paymentType === 'PROMPTPAY_QR' || paymentType === 'TRUEMONEY' ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-5 shadow-sm space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-emerald-500" />
                3. บัญชีร้านค้าและอ้างอิง (Merchant & Reference Config)
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block text-slate-500 dark:text-slate-400 font-medium mb-1">
                    หมายเลขพร้อมเพย์ร้านค้า (PromptPay ID / Tax ID)
                  </label>
                  <input
                    type="text"
                    value={merchantTarget}
                    onChange={(e) => setMerchantTarget(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl font-mono font-bold text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-slate-500 dark:text-slate-400 font-medium mb-1">
                    ชื่อบัญชีผู้รับเงิน (Merchant Name)
                  </label>
                  <input
                    type="text"
                    value={merchantName}
                    onChange={(e) => setMerchantName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl font-medium text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-slate-500 dark:text-slate-400 font-medium mb-1">
                    หมายเลขอ้างอิง Ref 1 (Order No.)
                  </label>
                  <input
                    type="text"
                    value={ref1}
                    onChange={(e) => setRef1(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl font-mono font-bold text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-slate-500 dark:text-slate-400 font-medium mb-1">
                    หมายเลขอ้างอิง Ref 2 (Customer / Phone)
                  </label>
                  <input
                    type="text"
                    value={ref2}
                    onChange={(e) => setRef2(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl font-mono font-bold text-slate-900 dark:text-white"
                  />
                </div>
              </div>
            </div>
          ) : paymentType === 'CASH' ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-5 shadow-sm space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-2">
                <Banknote className="w-4 h-4 text-emerald-500" />
                3. คำนวณรับเงินสดและเงินทอน (Cash Tender & Change Calculator)
              </h3>

              <div className="space-y-3">
                <label className="block text-xs text-slate-500 dark:text-slate-400 font-medium">
                  จำนวนเงินสดที่รับมา (Tendered Amount in THB)
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-mono font-bold text-slate-400">฿</span>
                  <input
                    type="number"
                    value={cashTenderedThb}
                    onChange={(e) => setCashTenderedThb(e.target.value)}
                    placeholder={activeAmountThb.toString()}
                    className="w-full pl-9 pr-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xl font-mono font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div className="flex flex-wrap gap-2">
                  {[
                    Math.ceil(activeAmountThb),
                    100,
                    500,
                    1000,
                  ].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setCashTenderedThb(preset.toString())}
                      className="px-3.5 py-1.5 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 rounded-xl text-xs font-mono font-bold transition-colors cursor-pointer"
                    >
                      แบงก์ ฿{preset}
                    </button>
                  ))}
                </div>

                {cashTenderedSatang > 0 && (
                  <div className="p-4 bg-slate-900 text-white rounded-2xl flex items-center justify-between font-mono">
                    <span className="text-xs text-slate-400 uppercase tracking-widest">เงินทอน (Change Due):</span>
                    <span className={`text-2xl font-black ${changeSatang >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {formatSatangToThb(changeSatang)}
                    </span>
                  </div>
                )}

                {isUsingCartBalance && cart.length > 0 && (
                  <button
                    type="button"
                    onClick={handleDirectMethodCheckout}
                    disabled={isProcessingCheckout || cashTenderedSatang < Math.round(activeAmountThb * 100)}
                    className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-sm font-bold transition-all shadow-lg shadow-emerald-600/20 cursor-pointer flex items-center justify-center gap-2"
                  >
                    <CheckCircle2 className="w-5 h-5" />
                    <span>ยืนยันรับเงินสดและปิดการขาย (Complete Cash Order)</span>
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-5 shadow-sm space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-purple-500" />
                3. เครื่อง EDC บัตรเครดิต / Contactless NFC
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                พร้อมเชื่อมต่อเครื่องรูดบัตร EDC หรือแตะเพื่อจ่าย (Visa / MasterCard / PromptCard / Apple Pay)
              </p>

              {isUsingCartBalance && cart.length > 0 && (
                <button
                  type="button"
                  onClick={handleDirectMethodCheckout}
                  disabled={isProcessingCheckout}
                  className="w-full py-3.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-sm font-bold transition-all shadow-lg shadow-purple-600/20 cursor-pointer flex items-center justify-center gap-2"
                >
                  <CreditCard className="w-5 h-5" />
                  <span>ส่งยอดไปยังเครื่อง EDC และยืนยันการชำระ</span>
                </button>
              )}
            </div>
          )}

          {/* Slip Upload Simulator */}
          {(paymentType === 'PROMPTPAY_QR' || paymentType === 'TRUEMONEY') && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-2">
                  <FileCheck2 className="w-4 h-4 text-indigo-500" />
                  ตรวจสอบสลิปโอนเงิน (Bank Slip Verification OCR)
                </h3>
                <span className="text-[10px] bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-full font-mono font-bold">
                  API Connected
                </span>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-3">
                <button
                  type="button"
                  onClick={handleSimulateSlipUpload}
                  disabled={isVerifyingSlip}
                  className="flex-1 py-2.5 px-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 transition-colors cursor-pointer flex items-center justify-center gap-2"
                >
                  {isVerifyingSlip ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-indigo-500" />
                      <span>กำลังสแกน OCR สลิป...</span>
                    </>
                  ) : (
                    <>
                      <FileCheck2 className="w-4 h-4 text-indigo-500" />
                      <span>จำลองการอัปโหลดสลิปโอนเงิน (Simulate Slip OCR)</span>
                    </>
                  )}
                </button>
              </div>

              {slipResult && (
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-2xl text-xs space-y-1 font-mono text-emerald-900 dark:text-emerald-200">
                  <div className="flex items-center justify-between font-bold">
                    <span>STATUS: VALID SLIP MATCHED</span>
                    <span className="text-[10px] bg-emerald-600 text-white px-1.5 py-0.2 rounded">SCB API</span>
                  </div>
                  <div>Sender: {slipResult.senderName}</div>
                  <div>Amount: ฿{slipResult.amountThb?.toFixed(2)} THB</div>
                  <div>Trans ID: {slipResult.transId}</div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Column: Dynamic EMVCo QR Code Visualizer & Live Actions (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl text-white space-y-5 text-center relative overflow-hidden">
            <div className="absolute top-0 right-0 left-0 h-1.5 bg-gradient-to-r from-emerald-500 via-indigo-500 to-purple-500" />

            {/* Merchant Badge Header */}
            <div className="flex items-center justify-between text-xs border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-left">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold font-mono">
                  PP
                </div>
                <div>
                  <div className="font-bold text-white text-xs">{merchantName}</div>
                  <div className="text-[10px] text-slate-400 font-mono">PromptPay ID: {merchantTarget}</div>
                </div>
              </div>

              <div className="flex items-center gap-1 font-mono text-[11px] text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-1 rounded-xl">
                <Clock className="w-3.5 h-3.5" />
                <span>
                  {Math.floor(countdownSeconds / 60)}:{(countdownSeconds % 60).toString().padStart(2, '0')}
                </span>
              </div>
            </div>

            {/* Main QR Code Card Container */}
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 260, damping: 20 }}
              className="bg-white p-5 rounded-3xl border-4 border-slate-800 shadow-inner max-w-xs mx-auto space-y-3 relative group"
            >
              {/* PromptPay Thai Header Logo */}
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <div className="text-[10px] font-black text-slate-800 uppercase tracking-tight">PROMPTPAY / พร้อมเพย์</div>
                <div className="text-[9px] font-mono font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded flex items-center gap-1">
                  <Sparkles className="w-2.5 h-2.5 text-emerald-500 animate-pulse" />
                  <span>EMVCo Thai QR</span>
                </div>
              </div>

              {/* QR Image Frame with Smooth Scale & Fade-in Animation */}
              <div className="relative flex items-center justify-center min-h-[210px] bg-white rounded-2xl overflow-hidden p-2">
                <AnimatePresence mode="wait">
                  {isGeneratingQr ? (
                    <motion.div
                      key="generating-qr"
                      initial={{ opacity: 0, scale: 0.88 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.88 }}
                      transition={{ duration: 0.2 }}
                      className="flex flex-col items-center gap-2.5 text-slate-400 py-8"
                    >
                      <RefreshCw className="w-8 h-8 animate-spin text-emerald-500" />
                      <span className="text-xs font-mono font-medium">Generating EMVCo Payload...</span>
                    </motion.div>
                  ) : qrDataUrl ? (
                    <motion.div
                      key={qrDataUrl}
                      initial={{ opacity: 0, scale: 0.78, y: 12, filter: 'blur(8px)' }}
                      animate={{ opacity: 1, scale: 1, y: 0, filter: 'blur(0px)' }}
                      exit={{ opacity: 0, scale: 0.85, filter: 'blur(6px)' }}
                      transition={{
                        type: 'spring',
                        stiffness: 280,
                        damping: 22,
                        mass: 0.8,
                      }}
                      className="relative flex flex-col items-center justify-center w-full"
                    >
                      <motion.img
                        src={qrDataUrl}
                        alt="PromptPay EMVCo QR Code"
                        className="w-full h-auto max-w-[220px] object-contain mx-auto rounded-xl shadow-sm cursor-pointer"
                        whileHover={{ scale: 1.04, rotate: 0.5 }}
                        whileTap={{ scale: 0.98 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                      />
                    </motion.div>
                  ) : (
                    <motion.div
                      key="qr-error"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="text-xs text-rose-500 font-mono py-8"
                    >
                      Error generating QR code
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Overlay Success Badge on Backend Confirmation with Smooth Spring Scale & Fade */}
                <AnimatePresence>
                  {paymentStatus === 'SUCCESS' && (
                    <motion.div
                      key="success-overlay"
                      initial={{ opacity: 0, scale: 0.6, backdropFilter: 'blur(0px)' }}
                      animate={{ opacity: 1, scale: 1, backdropFilter: 'blur(8px)' }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      transition={{
                        type: 'spring',
                        stiffness: 300,
                        damping: 22,
                        mass: 0.9,
                      }}
                      className="absolute inset-0 bg-emerald-600/95 backdrop-blur-md rounded-2xl flex flex-col items-center justify-center text-white p-4 space-y-2.5 shadow-2xl z-20 overflow-hidden"
                    >
                      {/* Pulse Wave Rings on Success */}
                      <motion.div
                        initial={{ scale: 0.5, opacity: 0 }}
                        animate={{ scale: [1, 1.45, 1.85], opacity: [0.7, 0.35, 0] }}
                        transition={{ repeat: Infinity, duration: 2.2, ease: 'easeOut' }}
                        className="absolute w-36 h-36 rounded-full border-2 border-white/60 pointer-events-none"
                      />

                      <motion.div
                        initial={{ scale: 0, rotate: -60 }}
                        animate={{ scale: 1, rotate: 0 }}
                        transition={{
                          type: 'spring',
                          stiffness: 340,
                          damping: 18,
                          delay: 0.1,
                        }}
                        className="p-3 bg-white/20 rounded-full border border-white/40 backdrop-blur-md shadow-lg"
                      >
                        <CheckCircle2 className="w-14 h-14 text-white drop-shadow-md" />
                      </motion.div>

                      <motion.div
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.18 }}
                        className="font-black text-xl text-center text-white tracking-wide"
                      >
                        ชำระเงินสำเร็จแล้ว!
                      </motion.div>

                      <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.25 }}
                        className="text-xs font-mono bg-emerald-800/90 px-2.5 py-1 rounded-lg border border-emerald-400/50 shadow-inner flex items-center gap-1.5"
                      >
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-300" />
                        <span>Ref: {transactionRefId}</span>
                      </motion.div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* QR Details Footer */}
              <div className="border-t border-slate-200 pt-2 text-slate-800 font-mono text-center">
                <div className="text-[10px] text-slate-500 uppercase">ยอดชำระสุทธิ (Amount)</div>
                <div className="text-2xl font-black text-emerald-600 tabular-nums">
                  ฿{activeAmountThb.toFixed(2)}
                </div>
              </div>
            </motion.div>

            {/* Real-Time Backend Polling Status Widget with Animated Transitions */}
            {(paymentType === 'PROMPTPAY_QR' || paymentType === 'TRUEMONEY') && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.1 }}
                className="bg-slate-800/90 border border-slate-700/80 rounded-2xl p-3 text-left space-y-2 shadow-lg"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="relative flex h-2.5 w-2.5">
                      {paymentStatus === 'WAITING' && (
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                      )}
                      <span
                        className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                          paymentStatus === 'SUCCESS'
                            ? 'bg-emerald-500 shadow-sm shadow-emerald-400'
                            : paymentStatus === 'FAILED'
                            ? 'bg-rose-500'
                            : 'bg-emerald-400'
                        }`}
                      />
                    </span>
                    <AnimatePresence mode="wait">
                      <motion.span
                        key={paymentStatus}
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 4 }}
                        className="text-[11px] font-bold text-slate-200"
                      >
                        {paymentStatus === 'SUCCESS'
                          ? 'ชำระเงินสำเร็จแล้ว (Confirmed via API)'
                          : paymentStatus === 'FAILED'
                          ? 'การชำระเงินล้มเหลว'
                          : 'ระบบตรวจสอบยอดชำระอัตโนมัติ (Polling Active)'}
                      </motion.span>
                    </AnimatePresence>
                  </div>

                  <button
                    type="button"
                    onClick={handleManualCheckStatus}
                    disabled={isManualChecking || paymentStatus === 'SUCCESS'}
                    className="px-2 py-1 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 rounded-lg text-slate-200 transition-colors cursor-pointer text-[10px] font-mono flex items-center gap-1.5"
                    title="ตรวจสอบสถานะทันที"
                  >
                    <RefreshCw className={`w-3 h-3 ${isManualChecking ? 'animate-spin text-emerald-400' : ''}`} />
                    <span>เช็กทันที</span>
                  </button>
                </div>

                <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 border-t border-slate-700/50 pt-1.5">
                  <div className="flex items-center gap-2">
                    <span>
                      เช็กสถานะแล้ว: <strong className="text-emerald-400">{pollCheckCount}</strong> ครั้ง
                    </span>
                    <span className="text-slate-600">|</span>
                    <span>
                      ล่าสุด: <strong className="text-slate-300">{lastPolledAt || 'รอดำเนินการ'}</strong>
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => playPaymentConfirmationPing(0.25)}
                    className="text-emerald-400 hover:text-emerald-300 transition-colors flex items-center gap-1 text-[10px] cursor-pointer"
                    title="ทดสอบเสียงปิ๊งยืนยันชำระเงิน"
                  >
                    <Volume2 className="w-3 h-3 text-emerald-400" />
                    <span>Ping Sound</span>
                  </button>
                </div>
              </motion.div>
            )}

            {/* Primary Action Buttons */}
            <div className="space-y-2 pt-1">
              <button
                type="button"
                onClick={handleSendToDisplay}
                className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl text-xs font-bold transition-all shadow-lg shadow-emerald-600/30 cursor-pointer flex items-center justify-center gap-2"
              >
                <Tv className="w-4 h-4" />
                <span>{sentToDisplay ? 'ส่งไปยังหน้าจอแสดงผลลูกค้าแล้ว!' : 'แสดง QR บนหน้าจอลูกค้า (Customer Screen)'}</span>
              </button>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handleCopyPayload}
                  className="py-2 px-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-xs font-medium text-slate-200 transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                >
                  {copiedPayload ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
                  <span>{copiedPayload ? 'คัดลอกแล้ว' : 'คัดลอก Payload'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleDownloadQr}
                  className="py-2 px-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-xs font-medium text-slate-200 transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5 text-indigo-400" />
                  <span>ดาวน์โหลด PNG</span>
                </button>
              </div>

              {/* Simulation Trigger Button */}
              <button
                type="button"
                onClick={handleSimulatePaymentSuccess}
                disabled={paymentStatus === 'SUCCESS' || isProcessingCheckout}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-2xl text-xs font-bold transition-all shadow-md shadow-indigo-600/20 cursor-pointer flex items-center justify-center gap-2"
              >
                <Zap className="w-4 h-4 text-amber-300" />
                <span>
                  {paymentStatus === 'VERIFYING'
                    ? 'กำลังตรวจสอบการชำระเงิน...'
                    : paymentStatus === 'SUCCESS'
                    ? 'ชำระเงินเรียบร้อยแล้ว'
                    : 'จำลองลูกค้าแสกนและชำระเงิน (Simulate Paid Webhook)'}
                </span>
              </button>
            </div>
          </div>

          {/* Quick Settlement Summary & Cart Preview */}
          {isUsingCartBalance && cart.length > 0 && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-5 shadow-sm space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center justify-between">
                <span>สรุปรายการสินค้าที่จะปิดการขาย</span>
                <span className="font-mono text-emerald-600 dark:text-emerald-400">{cart.length} SKUs</span>
              </h4>

              <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1 divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                {cart.map((item, idx) => (
                  <div key={`${item.product.id}-${idx}`} className="pt-1.5 flex items-center justify-between">
                    <div>
                      <div className="font-medium text-slate-800 dark:text-slate-200">{item.product.nameTh}</div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        {item.qty} x {formatSatangToThb(item.product.priceSatang)}
                      </div>
                    </div>
                    <div className="font-mono font-bold text-slate-900 dark:text-white">
                      {formatSatangToThb(item.product.priceSatang * item.qty)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Payment History Section */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider flex items-center gap-1">
                <History className="w-3 h-3 text-indigo-500" />
                <span>Payment Audit Log</span>
              </span>
              <span className="text-xs text-slate-400 font-mono">
                Real-Time Poll Checks: {paymentHistory.length} Recorded
              </span>
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span>ประวัติการตรวจสอบสถานะการชำระเงิน (Payment History & Status Checks)</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              บันทึกผลการเช็ก Polling, Manual Check, Webhook Simulation และ Slip OCR พร้อมเวลาอ้างอิง
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                fetch('/api/payment/history')
                  .then((res) => (res.ok ? res.json() : null))
                  .then((data) => {
                    if (data && Array.isArray(data.logs)) {
                      setPaymentHistory(data.logs);
                    }
                  });
              }}
              className="px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5 text-indigo-500" />
              <span>โหลดซ้ำ</span>
            </button>

            <button
              type="button"
              onClick={() => setPaymentHistory([])}
              disabled={paymentHistory.length === 0}
              className="px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-rose-500/10 hover:text-rose-600 text-slate-500 dark:text-slate-400 rounded-xl text-xs font-bold transition-all cursor-pointer disabled:opacity-40 flex items-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>ล้างประวัติ</span>
            </button>
          </div>
        </div>

        {/* Metric Summary Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-2xl border border-slate-100 dark:border-slate-800">
            <div className="text-[10px] uppercase font-mono font-bold text-slate-400">จำนวนการเช็กทั้งหมด</div>
            <div className="text-lg font-black text-slate-900 dark:text-white tabular-nums font-mono">
              {historyMetrics.total} <span className="text-xs font-normal text-slate-400">รายการ</span>
            </div>
          </div>

          <div className="bg-emerald-50/50 dark:bg-emerald-950/30 p-3 rounded-2xl border border-emerald-200/50 dark:border-emerald-800/50">
            <div className="text-[10px] uppercase font-mono font-bold text-emerald-600 dark:text-emerald-400">ชำระเงินสำเร็จ (CONFIRMED)</div>
            <div className="text-lg font-black text-emerald-600 dark:text-emerald-400 tabular-nums font-mono">
              {historyMetrics.successCount} <span className="text-xs font-normal text-emerald-600/70">รายการ</span>
            </div>
          </div>

          <div className="bg-amber-50/50 dark:bg-amber-950/30 p-3 rounded-2xl border border-amber-200/50 dark:border-amber-800/50">
            <div className="text-[10px] uppercase font-mono font-bold text-amber-600 dark:text-amber-400">กำลังรอชำระ (WAITING)</div>
            <div className="text-lg font-black text-amber-600 dark:text-amber-400 tabular-nums font-mono">
              {historyMetrics.waitingCount} <span className="text-xs font-normal text-amber-600/70">รายการ</span>
            </div>
          </div>

          <div className="bg-indigo-50/50 dark:bg-indigo-950/30 p-3 rounded-2xl border border-indigo-200/50 dark:border-indigo-800/50">
            <div className="text-[10px] uppercase font-mono font-bold text-indigo-600 dark:text-indigo-400">ยอดเงินยืนยันแล้วสุทธิ</div>
            <div className="text-lg font-black text-indigo-600 dark:text-indigo-400 tabular-nums font-mono">
              ฿{historyMetrics.totalConfirmedThb.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
        </div>

        {/* Filters & Search Control Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Status Filter Tabs */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-2xl text-xs font-medium overflow-x-auto">
            {[
              { id: 'ALL', label: `ทั้งหมด (${historyMetrics.total})` },
              { id: 'SUCCESS', label: `สำเร็จ (${historyMetrics.successCount})` },
              { id: 'WAITING', label: `รอชำระ (${historyMetrics.waitingCount})` },
              { id: 'FAILED', label: `ล้มเหลว (${historyMetrics.failedCount})` },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setHistoryFilter(tab.id as any)}
                className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer whitespace-nowrap font-bold text-xs ${
                  historyFilter === tab.id
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div className="relative min-w-[240px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={historySearch}
              onChange={(e) => setHistorySearch(e.target.value)}
              placeholder="ค้นหา Ref1, Ref2, Txn ID..."
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            {historySearch && (
              <button
                type="button"
                onClick={() => setHistorySearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* History Table / List View */}
        <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-950/80 text-slate-500 dark:text-slate-400 uppercase font-mono font-bold text-[10px] border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="py-3 px-4">เวลา (Time)</th>
                <th className="py-3 px-4">ประเภทการเช็ก (Type)</th>
                <th className="py-3 px-4">Ref 1 / Ref 2</th>
                <th className="py-3 px-4">ยอดเงิน (THB)</th>
                <th className="py-3 px-4">สถานะ (Status)</th>
                <th className="py-3 px-4">Transaction Ref ID</th>
                <th className="py-3 px-4 text-right">การดำเนินการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 font-mono">
              {filteredPaymentHistory.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400 font-sans text-xs">
                    ไม่พบประวัติการตรวจสอบสถานะการชำระเงินที่ตรงเงื่อนไข
                  </td>
                </tr>
              ) : (
                filteredPaymentHistory.map((item) => {
                  const isSuccess = item.status === 'SUCCESS';
                  const isFailed = item.status === 'FAILED';
                  return (
                    <tr
                      key={item.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors text-slate-700 dark:text-slate-300"
                    >
                      <td className="py-3 px-4 font-bold text-slate-900 dark:text-white whitespace-nowrap">
                        {item.timestamp}
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[10px] font-bold ${
                            item.type === 'AUTO_POLL'
                              ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800'
                              : item.type === 'MANUAL_CHECK'
                              ? 'bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-800'
                              : item.type === 'WEBHOOK_SIM'
                              ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800'
                              : item.type === 'SLIP_OCR'
                              ? 'bg-cyan-50 dark:bg-cyan-950/60 text-cyan-600 dark:text-cyan-400 border border-cyan-200 dark:border-cyan-800'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700'
                          }`}
                        >
                          {item.type === 'AUTO_POLL' && <Activity className="w-3 h-3 animate-pulse" />}
                          {item.type === 'MANUAL_CHECK' && <RefreshCw className="w-3 h-3" />}
                          {item.type === 'WEBHOOK_SIM' && <Zap className="w-3 h-3 text-amber-500" />}
                          {item.type === 'SLIP_OCR' && <FileCheck2 className="w-3 h-3 text-cyan-500" />}
                          {item.type === 'QR_GENERATED' && <QrCode className="w-3 h-3" />}
                          <span>
                            {item.type === 'AUTO_POLL'
                              ? `Auto Poll #${item.checkNumber}`
                              : item.type === 'MANUAL_CHECK'
                              ? 'Manual Check'
                              : item.type === 'WEBHOOK_SIM'
                              ? 'Webhook Sim'
                              : item.type === 'SLIP_OCR'
                              ? 'Slip OCR'
                              : 'QR Created'}
                          </span>
                        </span>
                      </td>

                      <td className="py-3 px-4 font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                        <div>{item.ref1}</div>
                        {item.ref2 && <div className="text-[10px] text-slate-400 font-normal">{item.ref2}</div>}
                      </td>

                      <td className="py-3 px-4 font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                        ฿{item.amountThb.toFixed(2)}
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold ${
                            isSuccess
                              ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                              : isFailed
                              ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800'
                              : 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800'
                          }`}
                        >
                          {isSuccess ? (
                            <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                          ) : isFailed ? (
                            <AlertCircle className="w-3 h-3 text-rose-500" />
                          ) : (
                            <Clock className="w-3 h-3 text-amber-500 animate-spin" />
                          )}
                          <span>{isSuccess ? 'SUCCESS' : isFailed ? 'FAILED' : 'WAITING'}</span>
                        </span>
                      </td>

                      <td className="py-3 px-4 font-mono text-[11px] text-slate-600 dark:text-slate-300 whitespace-nowrap">
                        {item.transactionRefId ? (
                          <span className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded font-bold text-slate-800 dark:text-slate-200">
                            {item.transactionRefId}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic text-[10px]">-</span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        {item.status === 'WAITING' && (
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                const res = await fetch(`/api/payment/status?ref1=${encodeURIComponent(item.ref1)}`);
                                if (res.ok) {
                                  const data = await res.json();
                                  addPaymentCheckLog({
                                    ref1: item.ref1,
                                    ref2: item.ref2,
                                    amountThb: item.amountThb,
                                    paymentMethod: item.paymentMethod,
                                    type: 'MANUAL_CHECK',
                                    status: data.status === 'SUCCESS' ? 'SUCCESS' : 'WAITING',
                                    checkNumber: item.checkNumber + 1,
                                    transactionRefId: data.transactionRefId,
                                    message: 'Re-checked payment status via history table',
                                  });
                                }
                              } catch (e) {
                                console.error('Re-check error:', e);
                              }
                            }}
                            className="px-2.5 py-1 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 text-indigo-600 dark:text-indigo-400 rounded-lg text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1 ml-auto"
                          >
                            <RefreshCw className="w-2.5 h-2.5" />
                            <span>เช็กซ้ำ</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
