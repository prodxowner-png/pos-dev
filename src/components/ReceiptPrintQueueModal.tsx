import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Printer,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Clock,
  Wifi,
  WifiOff,
  Trash2,
  X,
  Play,
  RotateCcw,
  FileText,
  Copy,
  Check,
  Zap,
  Sparkles,
  SlidersHorizontal,
  Search,
  Filter,
  CheckCheck,
  AlertTriangle,
  Info,
} from 'lucide-react';
import { PosOrderRecord, formatSatangToThb } from '../types/prodx';
import { useToast } from '../context/ToastContext';

export interface ReceiptPrintJob {
  id: string;
  orderNumber: string;
  orderId: string;
  customerName?: string;
  itemsCount: number;
  totalSatang: number;
  paymentMethod: string;
  printerTarget: string;
  status: 'QUEUED' | 'PRINTING' | 'COMPLETED' | 'FAILED' | 'OFFLINE_RETRY';
  attemptsCount: number;
  maxAttempts: number;
  createdAt: string;
  updatedAt: string;
  errorMessage?: string;
  rawEscPosPayload?: string;
}

export interface PrinterHardwareStatus {
  id: string;
  name: string;
  ipAddress: string;
  connectionType: 'USB_DIRECT' | 'LAN_NETWORK' | 'BLUETOOTH';
  isOnline: boolean;
  paperStatus: 'OK' | 'LOW' | 'OUT';
  coverStatus: 'CLOSED' | 'OPEN';
  pingMs: number;
}

interface ReceiptPrintQueueModalProps {
  isOpen: boolean;
  onClose: () => void;
  recentOrders?: PosOrderRecord[];
}

export const ReceiptPrintQueueModal: React.FC<ReceiptPrintQueueModalProps> = ({
  isOpen,
  onClose,
  recentOrders = [],
}) => {
  const { showSuccess, showError, showInfo } = useToast();

  // Hardware Status State
  const [primaryPrinter, setPrimaryPrinter] = useState<PrinterHardwareStatus>({
    id: 'PRN-01',
    name: 'EPSON TM-T88VI Thermal Printer',
    ipAddress: '192.168.1.150',
    connectionType: 'LAN_NETWORK',
    isOnline: true,
    paperStatus: 'OK',
    coverStatus: 'CLOSED',
    pingMs: 4,
  });

  // Print Queue State
  const [printQueue, setPrintQueue] = useState<ReceiptPrintJob[]>([]);
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'QUEUED' | 'PRINTING' | 'FAILED' | 'COMPLETED'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [retryingJobId, setRetryingJobId] = useState<string | null>(null);
  const [isRetryingAll, setIsRetryingAll] = useState<boolean>(false);
  const [viewingPayloadJob, setViewingPayloadJob] = useState<ReceiptPrintJob | null>(null);
  const [copiedPayload, setCopiedPayload] = useState<boolean>(false);

  // Initialize Print Queue with Seed Jobs & Recent Orders
  useEffect(() => {
    const initialJobs: ReceiptPrintJob[] = [
      {
        id: 'PRINT-JOB-101',
        orderNumber: 'PX-179139001',
        orderId: 'ord-001',
        customerName: 'Somchai Prasert',
        itemsCount: 3,
        totalSatang: 38500,
        paymentMethod: 'PROMPTPAY_QR',
        printerTarget: 'EPSON TM-T88VI (Front POS Counter)',
        status: 'COMPLETED',
        attemptsCount: 1,
        maxAttempts: 3,
        createdAt: new Date(Date.now() - 15 * 60000).toLocaleTimeString('th-TH'),
        updatedAt: new Date(Date.now() - 15 * 60000).toLocaleTimeString('th-TH'),
        rawEscPosPayload: '\x1b\x40\x1b\x61\x01PRODX MINIMART FLAGSHIP\nRECEIPT #PX-179139001\x1b\x61\x00',
      },
      {
        id: 'PRINT-JOB-102',
        orderNumber: 'PX-179139002',
        orderId: 'ord-002',
        customerName: 'Ananya Thani',
        itemsCount: 2,
        totalSatang: 19500,
        paymentMethod: 'CASH',
        printerTarget: 'EPSON TM-T88VI (Front POS Counter)',
        status: 'FAILED',
        attemptsCount: 3,
        maxAttempts: 3,
        createdAt: new Date(Date.now() - 8 * 60000).toLocaleTimeString('th-TH'),
        updatedAt: new Date(Date.now() - 2 * 60000).toLocaleTimeString('th-TH'),
        errorMessage: 'Printer Offline - Network Connection Timeout (192.168.1.150:9100)',
        rawEscPosPayload: '\x1b\x40\x1b\x61\x01PRODX MINIMART FLAGSHIP\nRECEIPT #PX-179139002\x1b\x61\x00',
      },
      {
        id: 'PRINT-JOB-103',
        orderNumber: 'PX-179139003',
        orderId: 'ord-003',
        customerName: 'General Customer',
        itemsCount: 1,
        totalSatang: 6500,
        paymentMethod: 'CREDIT_CARD',
        printerTarget: 'EPSON TM-T88VI (Front POS Counter)',
        status: 'QUEUED',
        attemptsCount: 0,
        maxAttempts: 3,
        createdAt: new Date(Date.now() - 1 * 60000).toLocaleTimeString('th-TH'),
        updatedAt: new Date(Date.now() - 1 * 60000).toLocaleTimeString('th-TH'),
        rawEscPosPayload: '\x1b\x40\x1b\x61\x01PRODX MINIMART FLAGSHIP\nRECEIPT #PX-179139003\x1b\x61\x00',
      },
    ];

    // Merge completed recent orders into queue if not present
    if (recentOrders && recentOrders.length > 0) {
      recentOrders.slice(0, 5).forEach((ord, idx) => {
        const exists = initialJobs.some((j) => j.orderNumber === ord.orderNumber);
        if (!exists) {
          initialJobs.unshift({
            id: `PRINT-JOB-${Date.now()}-${idx}`,
            orderNumber: ord.orderNumber,
            orderId: ord.id,
            customerName: ord.cashierName || 'POS Customer',
            itemsCount: ord.items?.length || 1,
            totalSatang: ord.totalSatang || 15000,
            paymentMethod: ord.paymentMethod || 'PROMPTPAY_QR',
            printerTarget: 'EPSON TM-T88VI (Front POS Counter)',
            status: 'COMPLETED',
            attemptsCount: 1,
            maxAttempts: 3,
            createdAt: new Date(ord.createdAt || Date.now()).toLocaleTimeString('th-TH'),
            updatedAt: new Date(ord.createdAt || Date.now()).toLocaleTimeString('th-TH'),
            rawEscPosPayload: `\x1b\x40\x1b\x61\x01PRODX MINIMART\nRECEIPT #${ord.orderNumber}\nTOTAL: ${formatSatangToThb(ord.totalSatang)}\x1b\x61\x00`,
          });
        }
      });
    }

    setPrintQueue(initialJobs);
  }, [recentOrders]);

  // Queue Statistics
  const queueMetrics = useMemo(() => {
    const total = printQueue.length;
    const queuedCount = printQueue.filter((j) => j.status === 'QUEUED').length;
    const printingCount = printQueue.filter((j) => j.status === 'PRINTING').length;
    const failedCount = printQueue.filter((j) => j.status === 'FAILED' || j.status === 'OFFLINE_RETRY').length;
    const completedCount = printQueue.filter((j) => j.status === 'COMPLETED').length;

    return { total, queuedCount, printingCount, failedCount, completedCount };
  }, [printQueue]);

  // Filtered Queue List
  const filteredQueue = useMemo(() => {
    return printQueue.filter((job) => {
      // Filter by Status Tab
      if (filterStatus !== 'ALL') {
        if (filterStatus === 'FAILED' && (job.status === 'FAILED' || job.status === 'OFFLINE_RETRY')) {
          // match
        } else if (job.status !== filterStatus) {
          return false;
        }
      }
      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        return (
          job.orderNumber.toLowerCase().includes(q) ||
          job.id.toLowerCase().includes(q) ||
          (job.customerName && job.customerName.toLowerCase().includes(q)) ||
          job.paymentMethod.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [printQueue, filterStatus, searchQuery]);

  // Single Job Retry Handler
  const handleRetryJob = async (jobId: string) => {
    const targetJob = printQueue.find((j) => j.id === jobId);
    if (!targetJob) return;

    if (!primaryPrinter.isOnline) {
      showError('Printer Disconnected', 'Cannot send job: Printer is currently simulated OFFLINE.');
      setPrintQueue((prev) =>
        prev.map((j) =>
          j.id === jobId
            ? {
                ...j,
                status: 'FAILED',
                attemptsCount: j.attemptsCount + 1,
                errorMessage: `Connection Refused: Printer ${primaryPrinter.name} is offline (${primaryPrinter.ipAddress})`,
                updatedAt: new Date().toLocaleTimeString('th-TH'),
              }
            : j
        )
      );
      return;
    }

    setRetryingJobId(jobId);

    // Transition to PRINTING
    setPrintQueue((prev) =>
      prev.map((j) =>
        j.id === jobId
          ? {
              ...j,
              status: 'PRINTING',
              updatedAt: new Date().toLocaleTimeString('th-TH'),
            }
          : j
      )
    );

    // Simulate print transmission delay
    await new Promise((r) => setTimeout(r, 1200));

    setPrintQueue((prev) =>
      prev.map((j) =>
        j.id === jobId
          ? {
              ...j,
              status: 'COMPLETED',
              attemptsCount: j.attemptsCount + 1,
              errorMessage: undefined,
              updatedAt: new Date().toLocaleTimeString('th-TH'),
            }
          : j
      )
    );

    setRetryingJobId(null);
    showSuccess('Receipt Printed', `Successfully printed receipt for Order #${targetJob.orderNumber}.`);
  };

  // Retry All Failed Jobs
  const handleRetryAllFailed = async () => {
    const failedJobs = printQueue.filter((j) => j.status === 'FAILED' || j.status === 'OFFLINE_RETRY');
    if (failedJobs.length === 0) return;

    if (!primaryPrinter.isOnline) {
      showError('Printer Offline', 'Cannot flush print queue: Primary thermal printer is offline.');
      return;
    }

    setIsRetryingAll(true);

    for (const job of failedJobs) {
      await handleRetryJob(job.id);
    }

    setIsRetryingAll(false);
    showSuccess('Queue Flushed', `All failed print jobs re-transmitted to thermal printer.`);
  };

  // Dispatch Test Sample Print Job
  const handleSendTestPrint = () => {
    const testJobId = `PRINT-TEST-${Date.now()}`;
    const testJob: ReceiptPrintJob = {
      id: testJobId,
      orderNumber: `PX-TEST-${Math.floor(100 + Math.random() * 900)}`,
      orderId: 'ord-test-sample',
      customerName: 'Hardware Diagnostics Test',
      itemsCount: 1,
      totalSatang: 100,
      paymentMethod: 'PROMPTPAY_QR',
      printerTarget: primaryPrinter.name,
      status: primaryPrinter.isOnline ? 'COMPLETED' : 'FAILED',
      attemptsCount: 1,
      maxAttempts: 3,
      createdAt: new Date().toLocaleTimeString('th-TH'),
      updatedAt: new Date().toLocaleTimeString('th-TH'),
      errorMessage: primaryPrinter.isOnline ? undefined : 'Printer Offline - ESC/POS Communication Error',
      rawEscPosPayload: '\x1b\x40\x1b\x61\x01*** PRODX PRINTER TEST ***\nOK 200 SUCCESS\x1b\x61\x00',
    };

    setPrintQueue((prev) => [testJob, ...prev]);

    if (primaryPrinter.isOnline) {
      showSuccess('Test Print Dispatched', `Sample receipt sent to ${primaryPrinter.name}`);
    } else {
      showError('Test Print Failed', `Printer ${primaryPrinter.name} is offline`);
    }
  };

  // Remove Job
  const handleRemoveJob = (jobId: string) => {
    setPrintQueue((prev) => prev.filter((j) => j.id !== jobId));
    showInfo('Job Removed', 'Print job discarded from queue.');
  };

  // Clear All Completed Jobs
  const handleClearCompleted = () => {
    setPrintQueue((prev) => prev.filter((j) => j.status !== 'COMPLETED'));
    showInfo('Queue Cleaned', 'Cleared completed print records from history.');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 overflow-y-auto font-sans">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl text-white w-full max-w-5xl overflow-hidden relative"
      >
        {/* Top Header Bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 rounded-2xl">
              <Printer className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-3 h-3 text-indigo-400 animate-pulse" />
                  Thermal Printer Spooler Studio
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  Spool Queue: {queueMetrics.total} Jobs
                </span>
              </div>
              <h3 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                <span>คิวพิมพ์ใบเสร็จรับเงิน (Receipt Print Queue Visualizer)</span>
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleSendTestPrint}
              className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer flex items-center gap-1.5"
            >
              <Printer className="w-4 h-4" />
              <span>พิมพ์ใบเสร็จทดสอบ (Test Print)</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-xl transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Main Body */}
        <div className="p-6 space-y-6">
          {/* Printer Hardware Status & Diagnostics Widget */}
          <div className="bg-slate-950 border border-slate-800 rounded-3xl p-5 space-y-4 shadow-inner">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-3">
              <div className="flex items-center gap-3">
                <div
                  className={`p-2.5 rounded-2xl border ${
                    primaryPrinter.isOnline
                      ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                      : 'bg-rose-500/20 text-rose-400 border-rose-500/40'
                  }`}
                >
                  {primaryPrinter.isOnline ? <Wifi className="w-5 h-5" /> : <WifiOff className="w-5 h-5" />}
                </div>

                <div>
                  <div className="flex items-center gap-2 font-bold text-sm text-white">
                    <span>{primaryPrinter.name}</span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase ${
                        primaryPrinter.isOnline
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                      }`}
                    >
                      {primaryPrinter.isOnline ? 'ONLINE' : 'OFFLINE'}
                    </span>
                  </div>
                  <div className="text-xs text-slate-400 font-mono">
                    IP: {primaryPrinter.ipAddress} · Interface: {primaryPrinter.connectionType} · Ping: {primaryPrinter.pingMs}ms
                  </div>
                </div>
              </div>

              {/* Hardware Offline Simulation Toggle */}
              <div className="flex items-center gap-3">
                <div className="text-right text-xs font-mono">
                  <div className="text-slate-400 text-[10px]">จำลองสถานะเครื่องพิมพ์</div>
                  <div className="font-bold text-slate-200">
                    {primaryPrinter.isOnline ? 'เชื่อมต่อปกติ (Connected)' : 'ตัดการเชื่อมต่อ (Disconnected)'}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setPrimaryPrinter((prev) => ({
                      ...prev,
                      isOnline: !prev.isOnline,
                    }))
                  }
                  className={`px-3 py-2 rounded-xl border text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    primaryPrinter.isOnline
                      ? 'bg-rose-500/20 border-rose-500/40 text-rose-400 hover:bg-rose-500/30'
                      : 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/30'
                  }`}
                  title="จำลองสถานะสายหลุด/เครื่องพิมพ์ปิดอยู่ เพื่อทดสอบคิวล้มเหลว"
                >
                  {primaryPrinter.isOnline ? <WifiOff className="w-3.5 h-3.5" /> : <Wifi className="w-3.5 h-3.5" />}
                  <span>{primaryPrinter.isOnline ? 'จำลองเน็ตหลุด (Disconnect)' : 'จำลองต่อสาย (Connect)'}</span>
                </button>
              </div>
            </div>

            {/* Diagnostic Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
              <div className="bg-slate-900 p-2.5 rounded-2xl border border-slate-800">
                <div className="text-[10px] text-slate-400 uppercase">สถานะกระดาษความร้อน</div>
                <div className="font-bold text-emerald-400">NORMAL (OK)</div>
              </div>

              <div className="bg-slate-900 p-2.5 rounded-2xl border border-slate-800">
                <div className="text-[10px] text-slate-400 uppercase">ฝาครอบเครื่องพิมพ์</div>
                <div className="font-bold text-slate-200">CLOSED</div>
              </div>

              <div className="bg-slate-900 p-2.5 rounded-2xl border border-slate-800">
                <div className="text-[10px] text-slate-400 uppercase">โปรโตคอลการสั่งพิมพ์</div>
                <div className="font-bold text-indigo-400">ESC/POS Thermal Standard</div>
              </div>

              <div className="bg-slate-900 p-2.5 rounded-2xl border border-slate-800">
                <div className="text-[10px] text-slate-400 uppercase">คิวตกค้างรอพิมพ์</div>
                <div className={`font-bold ${queueMetrics.failedCount > 0 ? 'text-rose-400 animate-pulse' : 'text-slate-200'}`}>
                  {queueMetrics.queuedCount + queueMetrics.failedCount} งาน
                </div>
              </div>
            </div>
          </div>

          {/* Metric Summary Counters & Quick Action Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 space-y-1">
              <div className="text-[10px] font-mono font-bold text-slate-400 uppercase">คิวทั้งหมด (TOTAL JOBS)</div>
              <div className="text-2xl font-black text-white font-mono tabular-nums">{queueMetrics.total}</div>
            </div>

            <div className="bg-amber-500/10 p-3.5 rounded-2xl border border-amber-500/20 space-y-1">
              <div className="text-[10px] font-mono font-bold text-amber-400 uppercase">รอดำเนินการ (QUEUED)</div>
              <div className="text-2xl font-black text-amber-400 font-mono tabular-nums">{queueMetrics.queuedCount}</div>
            </div>

            <div className="bg-rose-500/10 p-3.5 rounded-2xl border border-rose-500/20 space-y-1">
              <div className="text-[10px] font-mono font-bold text-rose-400 uppercase">พิมพ์ล้มเหลว (FAILED/OFFLINE)</div>
              <div className="text-2xl font-black text-rose-400 font-mono tabular-nums">{queueMetrics.failedCount}</div>
            </div>

            <div className="bg-emerald-500/10 p-3.5 rounded-2xl border border-emerald-500/20 space-y-1">
              <div className="text-[10px] font-mono font-bold text-emerald-400 uppercase">พิมพ์สำเร็จ (COMPLETED)</div>
              <div className="text-2xl font-black text-emerald-400 font-mono tabular-nums">{queueMetrics.completedCount}</div>
            </div>
          </div>

          {/* Controls Bar: Filters, Search, & Queue Control */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-950 p-3 rounded-2xl border border-slate-800">
            {/* Filter Tabs */}
            <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl text-xs font-medium overflow-x-auto border border-slate-800">
              {[
                { id: 'ALL', label: `ทั้งหมด (${queueMetrics.total})` },
                { id: 'QUEUED', label: `รอคิว (${queueMetrics.queuedCount})` },
                { id: 'FAILED', label: `ล้มเหลว (${queueMetrics.failedCount})` },
                { id: 'COMPLETED', label: `สำเร็จ (${queueMetrics.completedCount})` },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFilterStatus(tab.id as any)}
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap font-bold text-xs ${
                    filterStatus === tab.id
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Search Box & Quick Controls */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1 sm:w-48">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="ค้นหาเลขบิล, ชื่อ..."
                  className="w-full pl-8 pr-3 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-xs font-medium text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {queueMetrics.failedCount > 0 && (
                <button
                  type="button"
                  onClick={handleRetryAllFailed}
                  disabled={isRetryingAll}
                  className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold transition-all shadow cursor-pointer flex items-center gap-1.5 whitespace-nowrap"
                  title="ลองส่งข้อมูลพิมพ์ใหม่สำหรับทุกรายการที่ล้มเหลว"
                >
                  <RotateCcw className={`w-3.5 h-3.5 ${isRetryingAll ? 'animate-spin' : ''}`} />
                  <span>ลองใหม่อีกครั้งทั้งหมด ({queueMetrics.failedCount})</span>
                </button>
              )}

              {queueMetrics.completedCount > 0 && (
                <button
                  type="button"
                  onClick={handleClearCompleted}
                  className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1"
                  title="ล้างรายการที่พิมพ์สำเร็จแล้ว"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">ล้างประวัติ</span>
                </button>
              )}
            </div>
          </div>

          {/* Queue List Table */}
          <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-950">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900 text-slate-400 uppercase font-mono font-bold text-[10px] border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">เวลา / Job ID</th>
                  <th className="py-3 px-4">หมายเลขบิล (Order No.)</th>
                  <th className="py-3 px-4">ยอดเงิน (THB)</th>
                  <th className="py-3 px-4">เครื่องพิมพ์เป้าหมาย</th>
                  <th className="py-3 px-4">สถานะ (Status)</th>
                  <th className="py-3 px-4 text-right">การดำเนินการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 font-mono">
                {filteredQueue.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-500 font-sans text-xs">
                      ไม่พบคิวพิมพ์ใบเสร็จตามเงื่อนไขที่เลือก
                    </td>
                  </tr>
                ) : (
                  filteredQueue.map((job) => {
                    const isQueued = job.status === 'QUEUED';
                    const isPrinting = job.status === 'PRINTING';
                    const isCompleted = job.status === 'COMPLETED';
                    const isFailed = job.status === 'FAILED' || job.status === 'OFFLINE_RETRY';

                    return (
                      <tr
                        key={job.id}
                        className="hover:bg-slate-900/60 transition-colors text-slate-300"
                      >
                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="font-bold text-white text-xs">{job.createdAt}</div>
                          <div className="text-[10px] text-slate-400">{job.id}</div>
                        </td>

                        <td className="py-3 px-4 whitespace-nowrap font-sans font-bold text-slate-200">
                          <div className="flex items-center gap-1.5">
                            <FileText className="w-3.5 h-3.5 text-indigo-400" />
                            <span>{job.orderNumber}</span>
                          </div>
                          {job.customerName && (
                            <div className="text-[10px] text-slate-400 font-mono font-normal">
                              {job.customerName} ({job.itemsCount} รายการ)
                            </div>
                          )}
                        </td>

                        <td className="py-3 px-4 font-bold text-emerald-400 whitespace-nowrap">
                          {formatSatangToThb(job.totalSatang)}
                        </td>

                        <td className="py-3 px-4 text-slate-400 text-[11px] whitespace-nowrap">
                          {job.printerTarget}
                        </td>

                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="space-y-1">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold ${
                                isCompleted
                                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                  : isFailed
                                  ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30 animate-pulse'
                                  : isPrinting
                                  ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'
                                  : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                              }`}
                            >
                              {isCompleted && <CheckCircle2 className="w-3 h-3 text-emerald-400" />}
                              {isFailed && <AlertCircle className="w-3 h-3 text-rose-400" />}
                              {isPrinting && <RefreshCw className="w-3 h-3 text-indigo-400 animate-spin" />}
                              {isQueued && <Clock className="w-3 h-3 text-amber-400" />}
                              <span>
                                {isCompleted
                                  ? 'COMPLETED'
                                  : isFailed
                                  ? `FAILED (Try ${job.attemptsCount}/${job.maxAttempts})`
                                  : isPrinting
                                  ? 'PRINTING...'
                                  : 'QUEUED'}
                              </span>
                            </span>

                            {job.errorMessage && (
                              <div className="text-[10px] text-rose-400 font-mono max-w-xs truncate" title={job.errorMessage}>
                                {job.errorMessage}
                              </div>
                            )}
                          </div>
                        </td>

                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Individual Retry Button for Failed or Queued Jobs */}
                            {(isFailed || isQueued) && (
                              <button
                                type="button"
                                onClick={() => handleRetryJob(job.id)}
                                disabled={retryingJobId === job.id}
                                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1 active:scale-95 shadow"
                              >
                                <RotateCcw className={`w-3 h-3 ${retryingJobId === job.id ? 'animate-spin' : ''}`} />
                                <span>ลองพิมพ์ใหม่ (Retry)</span>
                              </button>
                            )}

                            {/* View Raw Payload */}
                            {job.rawEscPosPayload && (
                              <button
                                type="button"
                                onClick={() => setViewingPayloadJob(job)}
                                className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors cursor-pointer"
                                title="ดูคำสั่ง ESC/POS Raw Data"
                              >
                                <FileText className="w-3.5 h-3.5" />
                              </button>
                            )}

                            {/* Remove / Cancel Job */}
                            <button
                              type="button"
                              onClick={() => handleRemoveJob(job.id)}
                              className="p-1.5 bg-slate-800 hover:bg-rose-500/20 hover:text-rose-400 text-slate-400 rounded-lg transition-colors cursor-pointer"
                              title="ยกเลิกงานพิมพ์นี้"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* View ESC/POS Raw Payload Drawer / Modal */}
        <AnimatePresence>
          {viewingPayloadJob && (
            <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="bg-slate-900 border border-slate-800 rounded-3xl p-6 text-white max-w-lg w-full space-y-4 shadow-2xl relative"
              >
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <FileText className="w-5 h-5 text-indigo-400" />
                    <h4 className="text-sm font-bold">ESC/POS Raw Command Stream</h4>
                  </div>
                  <button
                    type="button"
                    onClick={() => setViewingPayloadJob(null)}
                    className="text-slate-400 hover:text-white"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-1 text-xs">
                  <div>Job ID: <span className="font-mono text-indigo-400 font-bold">{viewingPayloadJob.id}</span></div>
                  <div>Order No: <span className="font-mono text-emerald-400 font-bold">#{viewingPayloadJob.orderNumber}</span></div>
                  <div>Target Printer: <span className="font-mono text-slate-300">{viewingPayloadJob.printerTarget}</span></div>
                </div>

                <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 font-mono text-[11px] text-emerald-400 space-y-1 overflow-x-auto max-h-48 leading-relaxed">
                  <div>{viewingPayloadJob.rawEscPosPayload}</div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(viewingPayloadJob.rawEscPosPayload || '');
                      setCopiedPayload(true);
                      setTimeout(() => setCopiedPayload(false), 2000);
                    }}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    {copiedPayload ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedPayload ? 'คัดลอกแล้ว' : 'คัดลอก ESC/POS Data'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setViewingPayloadJob(null)}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
                  >
                    ปิด
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};
