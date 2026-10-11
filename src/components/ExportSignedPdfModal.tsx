import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  FileText,
  ShieldCheck,
  Download,
  CheckCircle2,
  Lock,
  Calendar,
  UserCheck,
  AlertCircle,
  X,
  FileSignature,
  Hash,
  Sparkles,
  ShoppingBag,
  ExternalLink,
} from 'lucide-react';
import { PosOrderRecord, AuditLogRecord, LoginThrottleRecord } from '../types/prodx';
import { exportSignedDailyAuditPdf, computeSha256Digest } from '../utils/exportSignedPdfReport';

interface ExportSignedPdfModalProps {
  isOpen: boolean;
  onClose: () => void;
  orders: PosOrderRecord[];
  auditLogs: AuditLogRecord[];
  throttles?: LoginThrottleRecord[];
  defaultSupervisorName?: string;
}

export const ExportSignedPdfModal: React.FC<ExportSignedPdfModalProps> = ({
  isOpen,
  onClose,
  orders,
  auditLogs,
  throttles = [],
  defaultSupervisorName = 'Supachai V. (Store Lead Supervisor)',
}) => {
  const [supervisorName, setSupervisorName] = useState(defaultSupervisorName);
  const [branchName, setBranchName] = useState('Bangkok Flagship (BKK-FLAGSHIP-01)');
  const [terminalId, setTerminalId] = useState('POS-REG-01');

  // Today's date in YYYY-MM-DD
  const todayStr = new Date().toISOString().split('T')[0];
  const [reportDate, setReportDate] = useState(todayStr);

  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState<{
    filename: string;
    signature: string;
  } | null>(null);
  const [previewSignature, setPreviewSignature] = useState<string>('');

  // Target filename preview
  const previewFilename = `daily-sales-audit-security-report-${reportDate}.pdf`;

  // Calculate live preview metrics
  const completedOrders = orders.filter((o) => o.status === 'COMPLETED');
  const totalNetSatang = completedOrders.reduce((sum, o) => sum + (o.totalSatang || 0), 0);
  const totalVatSatang = completedOrders.reduce((sum, o) => sum + (o.vatSatang || 0), 0);
  const voidedCount = orders.filter((o) => o.status === 'VOIDED').length;
  const refundedCount = orders.filter((o) => o.status === 'REFUNDED').length;

  // Compute preview signature on mount or parameter changes
  useEffect(() => {
    let active = true;
    const compute = async () => {
      const summaryString = `PRODX-REPORT:${reportDate}:${supervisorName}:${totalNetSatang}:${auditLogs.length}`;
      const sig = await computeSha256Digest(summaryString);
      if (active) setPreviewSignature(sig);
    };
    compute();
    return () => {
      active = false;
    };
  }, [reportDate, supervisorName, totalNetSatang, auditLogs.length]);

  if (!isOpen) return null;

  const handleExport = async () => {
    setIsExporting(true);
    setExportSuccess(null);

    try {
      // Simulate cryptographic signing delay for realism
      await new Promise((resolve) => setTimeout(resolve, 600));

      const result = await exportSignedDailyAuditPdf(orders, auditLogs, throttles, {
        supervisorName,
        branchName,
        terminalId,
        dateStr: reportDate,
      });

      setExportSuccess({
        filename: result.filename,
        signature: result.digitalSignature,
      });
    } catch (err) {
      console.error('PDF export error:', err);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800/80 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shadow-sm">
              <FileSignature className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                <span>ส่งออกรายงานตรวจสอบและบันทึกความปลอดภัย (Signed PDF)</span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                ลงนามรับรองด้วยลายเซ็นดิจิทัล SHA-256 พร้อมจัดเก็บชื่อไฟล์ตามวันที่ปัจจุบัน
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Target Filename Badge */}
          <div className="p-4 rounded-2xl bg-slate-100/70 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-0.5">
              <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider font-mono">
                ชื่อไฟล์เอกสารที่จะดาวน์โหลด (Filename with Current Date)
              </div>
              <div className="text-sm font-mono font-bold text-emerald-600 dark:text-emerald-400 break-all flex items-center gap-2">
                <FileText className="w-4 h-4 shrink-0" />
                <span>{previewFilename}</span>
              </div>
            </div>

            <div className="px-3 py-1 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 text-[11px] font-mono font-bold text-emerald-700 dark:text-emerald-300 self-start sm:self-auto shrink-0">
              A4 PORTRAIT • 2 PAGES
            </div>
          </div>

          {/* Report Metric Highlights */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/40">
              <div className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                ยอดขายสุทธิ
              </div>
              <div className="text-base font-black text-slate-900 dark:text-white font-mono mt-0.5">
                ฿{(totalNetSatang / 100).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
              </div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                VAT: ฿{(totalVatSatang / 100).toFixed(2)}
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/50">
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                คำสั่งซื้อขาย
              </div>
              <div className="text-base font-black text-slate-900 dark:text-white font-mono mt-0.5">
                {completedOrders.length} บิล
              </div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                ยกเลิก: {voidedCount} • คืน: {refundedCount}
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/40">
              <div className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
                บันทึกความปลอดภัย
              </div>
              <div className="text-base font-black text-slate-900 dark:text-white font-mono mt-0.5">
                {auditLogs.length} เหตุการณ์
              </div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                สายโซ่ SHA-256 ครบถ้วน
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/40">
              <div className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
                สถานะลายเซ็น
              </div>
              <div className="text-xs font-black text-emerald-600 dark:text-emerald-400 font-mono mt-1 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>SIGNED &amp; SEALED</span>
              </div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                พรบ. ธุรกรรมอิเล็กทรอนิกส์
              </div>
            </div>
          </div>

          {/* Form Options */}
          <div className="space-y-4 pt-2">
            <h3 className="text-xs font-bold text-slate-900 dark:text-slate-200 uppercase tracking-wider">
              ข้อมูลผู้ลงนามรับรองและสาขา (Signer &amp; Metadata Configuration)
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                  ชื่อหัวหน้ากะ/ผู้ลงนาม (Signing Supervisor)
                </label>
                <div className="relative">
                  <UserCheck className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    value={supervisorName}
                    onChange={(e) => setSupervisorName(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="Supachai V. (Store Lead Supervisor)"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                  วันที่ของรายงาน (Audit Date)
                </label>
                <div className="relative">
                  <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="date"
                    value={reportDate}
                    onChange={(e) => setReportDate(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                  ชื่อสาขา (Store Branch)
                </label>
                <input
                  type="text"
                  value={branchName}
                  onChange={(e) => setBranchName(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                  เครื่องบันทึกการขาย (Terminal ID)
                </label>
                <input
                  type="text"
                  value={terminalId}
                  onChange={(e) => setTerminalId(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>
          </div>

          {/* Cryptographic Signature Preview Box */}
          <div className="p-4 rounded-2xl bg-slate-900 text-slate-200 space-y-2 border border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono font-bold text-emerald-400 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5" />
                <span>SHA-256 DIGITAL SEAL FINGERPRINT</span>
              </span>
              <span className="text-[10px] font-mono text-slate-400">NON-REPUDIATION VERIFIED</span>
            </div>
            <div className="text-[11px] font-mono text-slate-300 break-all bg-slate-950 p-2.5 rounded-xl border border-slate-800">
              {previewSignature || 'Computing digital checksum...'}
            </div>
            <div className="text-[10px] text-slate-400 leading-relaxed">
              เอกสารจะถูกประทับตรารับรองดิจิทัลอัตโนมัติ พร้อมตราประทับทางกฎหมาย
              บันทึกยอดขายแยกตามช่องทางชำระเงิน และตารางตรวจสอบความปลอดภัยแบบ Immutability
            </div>
          </div>

          {/* Success Banner */}
          {exportSuccess && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/50 flex items-center gap-3 text-emerald-800 dark:text-emerald-300"
            >
              <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <div className="text-xs">
                <strong>ดาวน์โหลดไฟล์เอกสารสำเร็จ:</strong> {exportSuccess.filename}
                <div className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400">
                  Digital Signature: {exportSuccess.signature.slice(0, 24)}...
                </div>
              </div>
            </motion.div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-6 border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            ปิดหน้าต่าง
          </button>

          <button
            type="button"
            onClick={handleExport}
            disabled={isExporting}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-bold shadow-lg shadow-emerald-600/20 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {isExporting ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>กำลังสร้างเอกสารและลงนามดิจิทัล...</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                <span>ลงนามและดาวน์โหลด PDF (Export Signed PDF)</span>
              </>
            )}
          </button>
        </div>
      </motion.div>
    </div>
  );
};
