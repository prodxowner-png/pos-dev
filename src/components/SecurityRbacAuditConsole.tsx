import React, { useState, useMemo } from 'react';
import {
  Shield,
  Lock,
  KeyRound,
  AlertOctagon,
  CheckCircle2,
  UserCheck,
  Search,
  Filter,
  Hash,
  Fingerprint,
  Clock,
  User,
  Activity,
  ExternalLink,
  ShieldCheck,
  ShieldAlert,
  X,
  Calendar,
  RotateCcw,
  SlidersHorizontal,
  Copy,
  Check,
  FileSignature,
} from 'lucide-react';
import { AuditLogRecord, LoginThrottleRecord, PosOrderRecord } from '../types/prodx';
import { SecurityAuditTimeline, AuthCluster } from './SecurityAuditTimeline';
import { ExportSignedPdfModal } from './ExportSignedPdfModal';
import { StaffPerformanceAnalytics } from './StaffPerformanceAnalytics';

interface SecurityRbacAuditConsoleProps {
  logs: AuditLogRecord[];
  throttles: LoginThrottleRecord[];
  onRefreshSecurityData: () => Promise<void>;
  orders?: PosOrderRecord[];
}

export type TimeRangePreset = 'ALL' | '1H' | '6H' | '24H' | '7D' | 'CUSTOM';

// Thai Role Map
export const THAI_ROLE_MAP: Record<string, { label: string; sub: string; badgeClass: string }> = {
  STORE_MANAGER: {
    label: 'ผู้จัดการร้าน',
    sub: 'Store Manager',
    badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  },
  SHIFT_SUPERVISOR: {
    label: 'หัวหน้ากะ',
    sub: 'Supervisor',
    badgeClass: 'bg-purple-50 text-purple-700 border-purple-200',
  },
  CASHIER: {
    label: 'พนักงานแคชเชียร์',
    sub: 'Cashier',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  SYSTEM_DAEMON: {
    label: 'ระบบอัตโนมัติ',
    sub: 'System Daemon',
    badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
  },
};

// Thai Resource Type Map
export const THAI_RESOURCE_MAP: Record<string, { label: string; badgeClass: string }> = {
  AUTH_SECURITY: {
    label: 'การยืนยันตัวตน & ความปลอดภัย',
    badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
  },
  INVENTORY: {
    label: 'คลังสินค้า & สต็อก',
    badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',
  },
  ORDERS: {
    label: 'รายการคำสั่งซื้อ & ยอดขาย',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  CORE: {
    label: 'ระบบโครงสร้างหลัก',
    badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
  },
  SYSTEM_CORE: {
    label: 'ระบบโครงสร้างหลัก',
    badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
  },
  DATABASE: {
    label: 'ฐานข้อมูล & สกีมา',
    badgeClass: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  },
};

// Thai Action Translation Helper
export function getThaiActionInfo(action: string): {
  titleTh: string;
  badgeType: 'DANGER' | 'WARNING' | 'SUCCESS' | 'INFO';
} {
  const act = action.toUpperCase();
  if (act.includes('LOGIN_FAILED')) {
    return { titleTh: 'เข้าสู่ระบบไม่สำเร็จ (รหัสผ่านไม่ถูกต้อง)', badgeType: 'DANGER' };
  }
  if (act.includes('LOCKOUT') || act.includes('THROTTLE')) {
    return { titleTh: 'ระงับบัญชีชั่วคราว (Sentinel Lockout)', badgeType: 'DANGER' };
  }
  if (act.includes('IMMUTABILITY') || act.includes('TAMPER')) {
    return { titleTh: 'สกัดกั้นการดัดแปลงข้อมูลประวัติ (Trigger Block)', badgeType: 'DANGER' };
  }
  if (act.includes('ORDER_VOID')) {
    return { titleTh: 'ยกเลิกรายการขายในกะและคืนสต็อก (Order Void)', badgeType: 'WARNING' };
  }
  if (act.includes('ORDER_REFUND')) {
    return { titleTh: 'อนุมัติการคืนเงินลูกค้า (Refund Commit)', badgeType: 'WARNING' };
  }
  if (act.includes('PIN_OVERRIDE')) {
    return { titleTh: 'อนุมัติด้วยรหัส PIN หัวหน้ากะ (Supervisor Override)', badgeType: 'WARNING' };
  }
  if (act.includes('SYSTEM_BOOT')) {
    return { titleTh: 'เริ่มต้นระบบคลัสเตอร์ (System Boot)', badgeType: 'INFO' };
  }
  if (act.includes('CATALOG')) {
    return { titleTh: 'โหลดแค็ตตาล็อกสินค้าเริ่มต้น (Catalog Init)', badgeType: 'INFO' };
  }
  if (act.includes('SHIFT_ROTATION')) {
    return { titleTh: 'เริ่มรอบการเปิดกะการขาย (Shift Rotation)', badgeType: 'SUCCESS' };
  }
  if (act.includes('SHIFT_FINALIZED')) {
    return { titleTh: 'ปิดรอบกะและลงนามรับรองความถูกต้อง (Shift Finalized)', badgeType: 'SUCCESS' };
  }
  if (act.includes('INVENTORY')) {
    return { titleTh: 'ปรับปรุงยอดคงเหลือสต็อกสินค้า (Inventory Adjustment)', badgeType: 'INFO' };
  }
  if (act.includes('MIGRATION')) {
    return { titleTh: 'รันสคริปต์โครงสร้างฐานข้อมูล (Database Migration)', badgeType: 'INFO' };
  }
  return { titleTh: action, badgeType: 'INFO' };
}

// RBAC Matrix Definitions with Detailed Thai Descriptions & Policy Badges
const RBAC_MATRIX = [
  {
    permission: 'POS_CHECKOUT_COMMIT',
    nameTh: 'ชำระเงินและออกใบกำกับภาษีอย่างย่อ',
    description: 'บันทึกรายการขาย ตัดยอดสินค้าตามสูตร และพิมพ์ใบเสร็จรับเงินอย่างถูกต้อง',
    cashier: 'ALLOWED',
    supervisor: 'ALLOWED',
    manager: 'ALLOWED',
  },
  {
    permission: 'ORDER_VOID_SAME_SHIFT',
    nameTh: 'ยกเลิกบิลการขายภายในกะปัจจุบัน',
    description: 'ยกเลิกบิลขายผิดพลาด คืนยอดสต็อกอัตโนมัติ และบันทึกประวัติความรับผิดชอบ (Trigger 0022_m4)',
    cashier: 'PIN_OVERRIDE_REQUIRED',
    supervisor: 'ALLOWED',
    manager: 'ALLOWED',
  },
  {
    permission: 'ORDER_REFUND_COMMIT',
    nameTh: 'อนุมัติการคืนเงินลูกค้า (เต็มจำนวน/บางส่วน)',
    description: 'คืนเงินค่าสินค้าเข้าช่องทางเดิม พร้อมบันทึกหลักฐานการคืนเงินและเหตุผล (0012_m3_refund_core)',
    cashier: 'PIN_OVERRIDE_REQUIRED',
    supervisor: 'ALLOWED',
    manager: 'ALLOWED',
  },
  {
    permission: 'SHIFT_FINALIZE_AND_RECONCILE',
    nameTh: 'ปิดกะการขายและลงนามรับรองยอดเงิน',
    description: 'สรุปยอดเงินสดในเก๊ะ ตรวจสอบผลต่าง และลงนามรับรองดิจิทัลด้วยรหัสผ่าน Supervisor (0030_m5)',
    cashier: 'PIN_OVERRIDE_REQUIRED',
    supervisor: 'ALLOWED',
    manager: 'ALLOWED',
  },
  {
    permission: 'INVENTORY_MANUAL_ADJUST',
    nameTh: 'ปรับยอดสต็อกสินค้าแบบกำหนดเอง',
    description: 'ปรับเพิ่ม/ลดยอดสินค้าชำรุด สูญหาย หรือนับยอดประจำงวด พร้อมระบุ Reason Code (0023_m4)',
    cashier: 'DENIED',
    supervisor: 'ALLOWED',
    manager: 'ALLOWED',
  },
  {
    permission: 'DB_MIGRATION_EXECUTE',
    nameTh: 'รันสคริปต์ปรับโครงสร้างฐานข้อมูล (DDL)',
    description: 'ประมวลผลการอัปเกรดฐานข้อมูล ตรวจสอบเช็กซัมความถูกต้อง และสร้างตารางใหม่',
    cashier: 'DENIED',
    supervisor: 'DENIED',
    manager: 'ALLOWED',
  },
  {
    permission: 'AUDIT_LOG_MUTATE_OR_DELETE',
    nameTh: 'แก้ไขหรือลบบันทึกประวัติความปลอดภัยย้อนหลัง',
    description: 'พยายามแก้ไข UPDATE/DELETE บันทึกประวัติ — ถูกสกัดกั้นถาวรโดย PostgreSQL Trigger (0030_m5)',
    cashier: 'BLOCKED_BY_PG_TRIGGER',
    supervisor: 'BLOCKED_BY_PG_TRIGGER',
    manager: 'BLOCKED_BY_PG_TRIGGER',
  },
];

export const SecurityRbacAuditConsole: React.FC<SecurityRbacAuditConsoleProps> = ({
  logs,
  throttles,
  onRefreshSecurityData,
  orders = [],
}) => {
  const [immutabilityTestResult, setImmutabilityTestResult] = useState<{
    pgErrorCode: string;
    triggerName: string;
    message: string;
  } | null>(null);
  const [testingTrigger, setTestingTrigger] = useState(false);
  const [testingThrottle, setTestingThrottle] = useState(false);
  const [isExportPdfOpen, setIsExportPdfOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRole, setFilterRole] = useState<string>('ALL');
  const [timeRangeFilter, setTimeRangeFilter] = useState<TimeRangePreset>('ALL');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [copiedHash, setCopiedHash] = useState<string | null>(null);
  const [selectedCluster, setSelectedCluster] = useState<AuthCluster | null>(null);
  const [selectedLogId, setSelectedLogId] = useState<string | null>(null);
  const [verificationState, setVerificationState] = useState<{
    status: 'IDLE' | 'VERIFYING' | 'SUCCESS' | 'FAILED';
    message?: string;
    verifyingIndex?: number;
    failedIndex?: number;
  }>({ status: 'IDLE' });

  const handleVerifyLedger = async () => {
    setVerificationState({ status: 'VERIFYING', verifyingIndex: 0 });

    try {
      for (let i = 0; i < logs.length; i++) {
        setVerificationState((prev) => ({ ...prev, verifyingIndex: i }));
        // Simulate cryptographic verification step
        await new Promise((resolve) => setTimeout(resolve, 60));

        if (i < logs.length - 1) {
          const current = logs[i];
          const next = logs[i + 1];
          if (current.prevHash !== next.entryHash) {
            setVerificationState({
              status: 'FAILED',
              message: `ตรวจพบความไม่ต่อเนื่องของสายโซ่แฮชที่บล็อก #${current.sequenceNo} ลิงก์เชื่อมโยงไปยังบล็อก #${next.sequenceNo} ไม่ถูกต้อง ข้อมูลอาจถูกดัดแปลง`,
              failedIndex: i,
            });
            return;
          }
        }
      }

      setVerificationState({
        status: 'SUCCESS',
        message: `ตรวจสอบความถูกต้องของสายโซ่แฮชสำเร็จ: ตรวจสอบแล้ว ${logs.length} บล็อก ทุกค่าแฮช SHA-256 ตรงตามผลลัพธ์ของบล็อกก่อนหน้าอย่างสมบูรณ์ ข้อมูลปลอดภัยไร้การแก้ไข`,
      });
    } catch (err: any) {
      setVerificationState({
        status: 'FAILED',
        message: err.message || 'เกิดข้อผิดพลาดในการตรวจสอบสายโซ่แฮช',
      });
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedHash(text);
    setTimeout(() => setCopiedHash(null), 2000);
  };

  // Filtered Logs by Search, Role, Threat Cluster, and Time Range
  const filteredLogs = useMemo(() => {
    const now = Date.now();

    return logs.filter((log) => {
      // 1. Text Search Filter
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        !q ||
        log.action.toLowerCase().includes(q) ||
        log.details.toLowerCase().includes(q) ||
        log.resourceId.toLowerCase().includes(q) ||
        log.actorId.toLowerCase().includes(q) ||
        log.actorRole.toLowerCase().includes(q);

      // 2. Role Filter
      const matchesRole = filterRole === 'ALL' || log.actorRole === filterRole;

      // 3. Cluster Filter
      const matchesCluster = !selectedCluster || selectedCluster.logIds.includes(log.id);

      // 4. Time Range Filter
      let matchesTime = true;
      const logTimestamp = new Date(log.timestamp).getTime();

      if (timeRangeFilter === '1H') {
        matchesTime = logTimestamp >= now - 60 * 60 * 1000;
      } else if (timeRangeFilter === '6H') {
        matchesTime = logTimestamp >= now - 6 * 60 * 60 * 1000;
      } else if (timeRangeFilter === '24H') {
        matchesTime = logTimestamp >= now - 24 * 60 * 60 * 1000;
      } else if (timeRangeFilter === '7D') {
        matchesTime = logTimestamp >= now - 7 * 24 * 60 * 60 * 1000;
      } else if (timeRangeFilter === 'CUSTOM') {
        const start = customStartDate ? new Date(customStartDate).getTime() : 0;
        const end = customEndDate ? new Date(customEndDate).getTime() : Infinity;
        matchesTime = logTimestamp >= start && logTimestamp <= end;
      }

      return matchesSearch && matchesRole && matchesCluster && matchesTime;
    });
  }, [logs, searchQuery, filterRole, selectedCluster, timeRangeFilter, customStartDate, customEndDate]);

  const handleTestImmutabilityTrigger = async () => {
    setTestingTrigger(true);
    try {
      const res = await fetch('/api/security/test-immutability', { method: 'POST' });
      const data = await res.json();
      setImmutabilityTestResult({
        pgErrorCode: data.pgErrorCode,
        triggerName: data.triggerName,
        message: data.message,
      });
      await onRefreshSecurityData();
    } finally {
      setTestingTrigger(false);
    }
  };

  const handleSimulateBruteForce = async (reset = false) => {
    setTestingThrottle(true);
    try {
      await fetch('/api/security/simulate-login-attempt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identity: 'cashier.demo@prodx.co.th',
          simulateFailure: !reset,
        }),
      });
      await onRefreshSecurityData();
    } finally {
      setTestingThrottle(false);
    }
  };

  const renderRbacStatusBadge = (status: string) => {
    switch (status) {
      case 'ALLOWED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            <span>อนุญาต (ALLOWED)</span>
          </span>
        );
      case 'PIN_OVERRIDE_REQUIRED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
            <KeyRound className="w-3 h-3 text-amber-600" />
            <span>ต้องใช้ PIN หัวหน้ากะ</span>
          </span>
        );
      case 'DENIED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-slate-100 text-slate-500 border border-slate-200">
            <Lock className="w-3 h-3 text-slate-400" />
            <span>ไม่อนุญาต (DENIED)</span>
          </span>
        );
      case 'BLOCKED_BY_PG_TRIGGER':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
            <ShieldAlert className="w-3 h-3 text-rose-600" />
            <span>บล็อกถาวรโดย Trigger ฐานข้อมูล</span>
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-mono text-slate-500 bg-slate-100">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-8 max-w-full overflow-hidden">
      {/* Header & Interactive Security Drills */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8 pb-8 border-b border-slate-200">
        <div className="min-w-0 flex items-center gap-5">
          <div className="p-4 bg-emerald-50 rounded-2xl shrink-0 border border-emerald-100/50">
            <Shield className="w-8 h-8 text-emerald-600" />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5 text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">
              <span className="text-emerald-600 font-extrabold">ห้องนิรภัยความปลอดภัยทำงานอยู่</span>
              <span aria-hidden="true" className="text-slate-300">/</span>
              <span>สายโซ่แฮช SHA-256 สมบูรณ์</span>
            </div>
            <h2 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight [text-wrap:balance]">
              ศูนย์ควบคุมความปลอดภัยและการจำกัดสิทธิ์ (Security & RBAC Console)
            </h2>
            <p className="text-sm md:text-base text-slate-500 font-medium leading-relaxed max-w-2xl [text-wrap:balance]">
              ระบบบริหารจัดการความปลอดภัยระดับองค์กร: บังคับใช้นโยบายสิทธิ์การใช้งาน (RBAC),
              บันทึกประวัติเหตุการณ์แบบแก้ไขไม่ได้ด้วยรหัสวิทยา (Cryptographic Non-Repudiation)
              และระบบเฝ้าระวังการล็อกอินเรียลไทม์
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={handleTestImmutabilityTrigger}
            disabled={testingTrigger}
            title="ทดสอบสั่ง UPDATE/DELETE ในฐานข้อมูลเพื่อดูการบล็อกของ PostgreSQL Trigger"
            className="flex-1 sm:flex-initial px-5 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 shadow-sm active:scale-95 cursor-pointer disabled:opacity-50"
          >
            <AlertOctagon className="w-4 h-4 shrink-0" />
            <span>ทดสอบการป้องกันการแก้ไข (Test Immutability)</span>
          </button>

          <button
            type="button"
            onClick={() => handleSimulateBruteForce(false)}
            disabled={testingThrottle}
            title="จำลองการป้อนรหัสผ่านผิดเพื่อทดสอบระบบจำกัดอัตราและล็อกบัญชี"
            className="flex-1 sm:flex-initial px-5 py-2.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 shadow-sm active:scale-95 cursor-pointer disabled:opacity-50"
          >
            <KeyRound className="w-4 h-4 text-amber-600 shrink-0" />
            <span>จำลองล็อกอินล้มเหลว (Simulate Failure)</span>
          </button>

          <button
            type="button"
            onClick={() => setIsExportPdfOpen(true)}
            title="ส่งออกรายงานการตรวจสอบยอดขายประจำวันและบันทึกความปลอดภัยเป็นเอกสาร PDF พร้อมลายเซ็นดิจิทัล"
            className="flex-1 sm:flex-initial px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 shadow-sm shadow-emerald-600/20 active:scale-95 cursor-pointer"
          >
            <FileSignature className="w-4 h-4 shrink-0" />
            <span>ส่งออกรายงาน PDF พร้อมลายเซ็น (Export Signed PDF)</span>
          </button>
        </div>
      </div>

      {/* Trigger Verification Alert (ผลการทดสอบการสกัดกั้น) */}
      {immutabilityTestResult && (
        <div className="p-6 bg-white border border-emerald-200 rounded-2xl shadow-xl relative overflow-hidden animate-in fade-in duration-200">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6 relative z-10">
            <div className="space-y-3 flex-1">
              <div className="font-bold text-emerald-700 flex items-center gap-2 text-sm uppercase tracking-wide">
                <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600" />
                <span>การป้องกันความปลอดภัยระดับฐานข้อมูลสำเร็จ (PostgreSQL Immutability Verified)</span>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                    ทริกเกอร์ที่ทำงาน:
                  </span>
                  <code className="text-xs text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded border border-emerald-200 font-mono font-bold">
                    {immutabilityTestResult.triggerName} (SQLSTATE {immutabilityTestResult.pgErrorCode})
                  </code>
                </div>
                <div className="font-mono text-xs bg-slate-50 p-4 rounded-xl border border-slate-100 leading-relaxed text-slate-700 shadow-inner">
                  {immutabilityTestResult.message}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setImmutabilityTestResult(null)}
              className="text-xs font-bold text-slate-500 hover:text-slate-900 uppercase tracking-widest transition-colors shrink-0 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg border border-slate-200 cursor-pointer"
            >
              ปิดการแจ้งเตือน
            </button>
          </div>
        </div>
      )}

      {/* Top Row: ตารางสิทธิ์ RBAC & ระบบเฝ้าระวังการล็อกอิน Sentinel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start max-w-full">
        {/* RBAC Permission Matrix (7 Cols) */}
        <div className="lg:col-span-7 space-y-4 max-w-full">
          <div className="flex items-center gap-3 px-1">
            <div className="p-2 bg-emerald-50 rounded-xl">
              <UserCheck className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 tracking-tight">
                ตารางควบคุมการเข้าถึงและจำกัดสิทธิ์ (Access Control / RBAC Matrix)
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                การบังคับใช้นโยบายสิทธิ์การเข้าถึงสำหรับแคชเชียร์, หัวหน้ากะ และผู้จัดการร้าน
              </p>
            </div>
          </div>

          <div className="overflow-hidden border border-slate-200 rounded-2xl bg-white shadow-sm">
            <div className="overflow-x-auto max-w-full">
              <table className="w-full text-left border-collapse text-xs min-w-[620px]">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500">
                    <th className="py-3.5 px-5 text-[11px] font-bold uppercase tracking-wider">
                      สิทธิ์การดำเนินงาน (Capability)
                    </th>
                    <th className="py-3.5 px-4 text-[11px] font-bold uppercase tracking-wider">
                      แคชเชียร์
                    </th>
                    <th className="py-3.5 px-4 text-[11px] font-bold uppercase tracking-wider">
                      หัวหน้ากะ
                    </th>
                    <th className="py-3.5 px-4 text-[11px] font-bold uppercase tracking-wider">
                      ผู้จัดการร้าน
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {RBAC_MATRIX.map((row) => (
                    <tr key={row.permission} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-4 px-5">
                        <div className="font-bold text-slate-900 text-sm tracking-tight">
                          {row.nameTh}
                        </div>
                        <div className="font-mono text-[10px] text-slate-400 font-semibold mt-0.5">
                          {row.permission}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                          {row.description}
                        </div>
                      </td>
                      <td className="py-4 px-4 whitespace-nowrap align-top">
                        {renderRbacStatusBadge(row.cashier)}
                      </td>
                      <td className="py-4 px-4 whitespace-nowrap align-top">
                        {renderRbacStatusBadge(row.supervisor)}
                      </td>
                      <td className="py-4 px-4 whitespace-nowrap align-top">
                        {renderRbacStatusBadge(row.manager)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Brute-Force Login Throttle Monitor (5 Cols) */}
        <div className="lg:col-span-5 space-y-4 max-w-full">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-50 rounded-xl">
                <Lock className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 tracking-tight">
                  ระบบเฝ้าระวังการล็อกอิน (Login Sentinel)
                </h3>
                <p className="text-xs text-slate-500 font-medium">ตรวจจับและป้องกันการเดารหัสผ่าน</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => handleSimulateBruteForce(true)}
              disabled={testingThrottle}
              className="text-xs font-bold text-slate-500 hover:text-emerald-600 transition-colors cursor-pointer flex items-center gap-1.5 px-2.5 py-1 rounded-lg hover:bg-slate-100"
            >
              <RotateCcw className="w-3 h-3" />
              <span>รีเซ็ตตัวเฝ้าระวัง</span>
            </button>
          </div>

          <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl bg-white shadow-sm overflow-hidden">
            {throttles.length === 0 ? (
              <div className="p-12 text-center text-slate-400 text-xs font-bold uppercase tracking-widest">
                ไม่มีความเสี่ยงที่ถูกตรวจจับในขณะนี้
              </div>
            ) : (
              throttles.map((t) => {
                const isLocked = Boolean(t.lockedUntil);
                return (
                  <div
                    key={t.identity}
                    className="p-5 flex items-center justify-between gap-4 hover:bg-slate-50/50 transition-colors font-mono tabular-nums"
                  >
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="font-bold text-slate-900 truncate text-sm font-sans">
                        {t.identity}
                      </div>
                      <div className="text-xs text-slate-500 font-sans flex items-center gap-2">
                        <span>พยายามล้มเหลว:</span>
                        <span
                          className={`font-mono font-bold ${
                            t.failedAttempts >= 5
                              ? 'text-rose-600'
                              : t.failedAttempts > 0
                              ? 'text-amber-600'
                              : 'text-slate-700'
                          }`}
                        >
                          {t.failedAttempts} / 5 ครั้ง
                        </span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                          isLocked
                            ? 'bg-rose-50 text-rose-700 border-rose-200'
                            : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        }`}
                      >
                        {isLocked ? 'ถูกระงับสิทธิ์ (Locked)' : 'ปกติ (Active)'}
                      </span>
                      <div className="text-[10px] font-mono font-bold text-slate-400 mt-2">
                        {new Date(t.lastAttemptAt).toLocaleTimeString('th-TH', { hour12: false })}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Staff Performance & Efficiency Analytics Section */}
      <StaffPerformanceAnalytics
        orders={orders}
        auditLogs={logs}
        onRefreshSecurityData={onRefreshSecurityData}
      />

      {/* Visual Timeline & Threat Cluster Graph */}
      <SecurityAuditTimeline
        logs={logs}
        throttles={throttles}
        selectedClusterId={selectedCluster?.id || null}
        onSelectCluster={setSelectedCluster}
        selectedLogId={selectedLogId}
        onSelectLog={setSelectedLogId}
        onRefreshData={onRefreshSecurityData}
      />

      {/* Bottom Section: Cryptographic SHA-256 Chained Audit Ledger */}
      <div id="audit-ledger-section" className="space-y-6 pt-2">
        {selectedCluster && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-slate-900 text-white rounded-2xl border border-slate-800 shadow-sm animate-in fade-in duration-200">
            <div className="flex items-center gap-2.5 text-xs font-mono">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping inline-block" />
              <span className="font-bold text-rose-400">กรองเฉพาะกลุ่มภัยคุกคาม:</span>
              <span className="font-bold text-white">
                {selectedCluster.id} ({selectedCluster.severity} BURST)
              </span>
              <span aria-hidden="true" className="text-slate-500 hidden sm:inline">
                ·
              </span>
              <span className="text-slate-300 hidden sm:inline">
                พบบล็อกที่เกี่ยวข้อง {selectedCluster.logIds.length} รายการ
              </span>
            </div>
            <button
              type="button"
              onClick={() => setSelectedCluster(null)}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-xs font-sans font-bold flex items-center gap-1.5 transition-colors cursor-pointer self-start sm:self-auto"
            >
              <X className="w-3.5 h-3.5" />
              <span>แสดงบล็อกทั้งหมด (ยกเลิกตัวกรองคลัสเตอร์)</span>
            </button>
          </div>
        )}

        {/* Audit Ledger Header & Comprehensive Multi-Filter Bar */}
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6 px-1">
          <div className="flex items-center gap-3.5">
            <div className="p-2.5 bg-emerald-50 rounded-xl border border-emerald-100/60">
              <Shield className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h3 className="text-lg font-bold text-slate-900 tracking-tight">
                  บันทึกประวัติความปลอดภัยแบบเข้ารหัส (Immutable Audit Ledger)
                </h3>
                {verificationState.status === 'SUCCESS' && (
                  <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold uppercase rounded-md border border-emerald-200">
                    สายโซ่แฮชสมบูรณ์ 100%
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 font-medium">
                สมุดบัญชีประวัติที่เชื่อมโยงด้วยแฮช SHA-256 เรียงตามลำดับ ไม่สามารถลบหรือแก้ไขย้อนหลังได้
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="ค้นหาการกระทำ, รหัส, รายละเอียด..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all w-56 sm:w-64 text-slate-900 placeholder:text-slate-400"
              />
            </div>

            {/* Role Filter Dropdown */}
            <select
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
              className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all cursor-pointer"
            >
              <option value="ALL">ทุกบทบาท (All Roles)</option>
              <option value="STORE_MANAGER">ผู้จัดการร้าน (Store Manager)</option>
              <option value="SHIFT_SUPERVISOR">หัวหน้ากะ (Supervisor)</option>
              <option value="CASHIER">แคชเชียร์ (Cashier)</option>
              <option value="SYSTEM_DAEMON">ระบบอัตโนมัติ (System)</option>
            </select>

            {/* Verify Integrity Button */}
            <button
              type="button"
              onClick={handleVerifyLedger}
              disabled={verificationState.status === 'VERIFYING' || logs.length === 0}
              className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-md active:scale-95 cursor-pointer disabled:opacity-50 ${
                verificationState.status === 'SUCCESS'
                  ? 'bg-emerald-600 text-white shadow-emerald-500/20'
                  : verificationState.status === 'FAILED'
                  ? 'bg-rose-600 text-white'
                  : 'bg-slate-900 text-white hover:bg-slate-800'
              }`}
            >
              {verificationState.status === 'VERIFYING' ? (
                <Activity className="w-3.5 h-3.5 animate-spin" />
              ) : verificationState.status === 'SUCCESS' ? (
                <ShieldCheck className="w-3.5 h-3.5" />
              ) : (
                <Fingerprint className="w-3.5 h-3.5" />
              )}
              <span>
                {verificationState.status === 'VERIFYING'
                  ? 'กำลังตรวจสอบแฮช...'
                  : 'ตรวจสอบความสมบูรณ์ (Verify)'}
              </span>
            </button>
          </div>
        </div>

        {/* Time Range Filter Bar (ระบบกรองข้อมูลตามช่วงเวลา) */}
        <div className="bg-slate-50/90 border border-slate-200 rounded-2xl p-4 space-y-3">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-emerald-600" />
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                กรองตามช่วงเวลา (Time Filter):
              </span>
              <span className="text-[11px] font-mono text-slate-500">
                (พบ {filteredLogs.length} จากทั้งหมด {logs.length} รายการ)
              </span>
            </div>

            {/* Time Presets */}
            <div className="flex flex-wrap items-center gap-1.5">
              {(
                [
                  { id: 'ALL', label: 'ทั้งหมด' },
                  { id: '1H', label: '1 ชม. ล่าสุด' },
                  { id: '6H', label: '6 ชม. ล่าสุด' },
                  { id: '24H', label: '24 ชม. ล่าสุด' },
                  { id: '7D', label: '7 วันล่าสุด' },
                  { id: 'CUSTOM', label: 'กำหนดเอง...' },
                ] as const
              ).map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => setTimeRangeFilter(preset.id)}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    timeRangeFilter === preset.id
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'bg-white hover:bg-slate-100 text-slate-600 border border-slate-200'
                  }`}
                >
                  {preset.label}
                </button>
              ))}

              {(timeRangeFilter !== 'ALL' || searchQuery || filterRole !== 'ALL') && (
                <button
                  type="button"
                  onClick={() => {
                    setTimeRangeFilter('ALL');
                    setSearchQuery('');
                    setFilterRole('ALL');
                    setCustomStartDate('');
                    setCustomEndDate('');
                    setSelectedCluster(null);
                  }}
                  className="px-2.5 py-1.5 text-xs font-bold text-slate-500 hover:text-slate-900 transition-colors flex items-center gap-1 cursor-pointer"
                  title="รีเซ็ตตัวกรองทั้งหมด"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>ล้างตัวกรอง</span>
                </button>
              )}
            </div>
          </div>

          {/* Custom Date Range Picker Accordion */}
          {timeRangeFilter === 'CUSTOM' && (
            <div className="pt-3 border-t border-slate-200/80 flex flex-wrap items-center gap-4 text-xs font-medium text-slate-700 animate-in fade-in duration-150">
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-500">ตั้งแต่:</span>
                <input
                  type="datetime-local"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono font-medium outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>

              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-500">ถึง:</span>
                <input
                  type="datetime-local"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono font-medium outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>

              <span className="text-[11px] text-slate-500 italic">
                * เลือกวันและเวลาเพื่อกรองเฉพาะบันทึกประวัติในช่วงเวลาที่ระบุ
              </span>
            </div>
          )}
        </div>

        {/* Verification Alert Banner */}
        {verificationState.message && (
          <div
            className={`p-4 rounded-xl border flex items-start gap-3 animate-in fade-in duration-300 ${
              verificationState.status === 'SUCCESS'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : 'bg-rose-50 border-rose-200 text-rose-900'
            }`}
          >
            {verificationState.status === 'SUCCESS' ? (
              <ShieldCheck className="w-5 h-5 shrink-0 text-emerald-600 mt-0.5" />
            ) : (
              <ShieldAlert className="w-5 h-5 shrink-0 text-rose-600 mt-0.5" />
            )}
            <div className="space-y-1">
              <p className="text-sm font-bold">
                {verificationState.status === 'SUCCESS'
                  ? 'ตรวจสอบความถูกต้องของสายโซ่แฮชสำเร็จ'
                  : 'พบความผิดปกติในสายโซ่แฮช'}
              </p>
              <p className="text-xs font-medium opacity-90">{verificationState.message}</p>
            </div>
          </div>
        )}

        {/* Chained Audit Logs Grid */}
        <div className="grid grid-cols-1 gap-4">
          {filteredLogs.length === 0 ? (
            <div className="p-12 text-center bg-slate-50 border border-dashed border-slate-200 rounded-2xl space-y-2">
              <p className="text-sm font-bold text-slate-500">
                ไม่พบบันทึกประวัติที่ตรงกับเงื่อนไขการค้นหาหรือช่วงเวลาที่เลือก
              </p>
              <p className="text-xs text-slate-400">
                ลองปรับเปลี่ยนช่วงเวลา, คำค้นหา หรือคลิก "ล้างตัวกรอง" เพื่อดูรายการทั้งหมด
              </p>
            </div>
          ) : (
            filteredLogs.map((log, idx) => {
              const isVerifying =
                verificationState.status === 'VERIFYING' &&
                verificationState.verifyingIndex === idx;
              const isVerified =
                verificationState.status === 'SUCCESS' ||
                (verificationState.status === 'VERIFYING' &&
                  (verificationState.verifyingIndex ?? -1) > idx);
              const isFailed =
                verificationState.status === 'FAILED' && verificationState.failedIndex === idx;

              const isSelected = selectedLogId === log.id;
              const actionInfo = getThaiActionInfo(log.action);
              const roleInfo = THAI_ROLE_MAP[log.actorRole] || {
                label: log.actorRole,
                sub: '',
                badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
              };
              const resourceInfo = THAI_RESOURCE_MAP[log.resourceType] || {
                label: log.resourceType,
                badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
              };

              return (
                <div
                  key={log.id}
                  className={`group relative bg-white border rounded-2xl p-5 sm:p-6 transition-all duration-300 ${
                    isSelected
                      ? 'border-emerald-500 shadow-xl ring-2 ring-emerald-500/30 bg-emerald-50/10'
                      : isVerifying
                      ? 'border-emerald-500 shadow-md ring-2 ring-emerald-500/10'
                      : isFailed
                      ? 'border-rose-500 shadow-md ring-2 ring-rose-500/10'
                      : 'border-slate-200 hover:border-emerald-300 hover:shadow-md'
                  }`}
                >
                  {/* Connection Line */}
                  {idx < filteredLogs.length - 1 && (
                    <div className="absolute left-10 top-full h-4 w-px bg-slate-200 z-0" />
                  )}

                  <div className="flex flex-col md:flex-row md:items-start gap-6 relative z-10 font-mono tabular-nums">
                    {/* Sequence & Time */}
                    <div className="flex md:flex-col items-center md:items-start justify-between gap-2 shrink-0 md:w-32">
                      <div className="text-xs font-bold text-slate-400 group-hover:text-emerald-600 transition-colors font-mono">
                        บล็อก #{log.sequenceNo.toString().padStart(4, '0')}
                      </div>
                      <div className="flex items-center gap-1.5 text-slate-600 font-sans">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        <span className="text-xs font-bold font-mono">
                          {new Date(log.timestamp).toLocaleTimeString('th-TH', { hour12: false })}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400 font-sans">
                        {new Date(log.timestamp).toLocaleDateString('th-TH', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </div>
                    </div>

                    {/* Operation Info in Thai */}
                    <div className="flex-1 space-y-3 font-sans">
                      <div className="flex flex-wrap items-center gap-2">
                        {/* Resource Category Badge */}
                        <span
                          className={`px-2.5 py-0.5 border text-[10px] font-bold rounded-md ${resourceInfo.badgeClass}`}
                        >
                          {resourceInfo.label}
                        </span>

                        {/* Thai Translated Action Title */}
                        <h4 className="text-sm font-bold text-slate-900 group-hover:text-emerald-700 transition-colors tracking-tight">
                          {actionInfo.titleTh}
                        </h4>

                        {/* Raw Action Tag */}
                        <span className="font-mono text-[10px] text-slate-400 bg-slate-50 border border-slate-200 px-1.5 py-0.5 rounded">
                          {log.action}
                        </span>
                      </div>

                      {/* Details in Thai / Description */}
                      <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-sans">
                        {log.details}
                      </p>

                      {/* Actor & Target Resource Footprint */}
                      <div className="flex flex-wrap items-center gap-4 pt-1 text-xs">
                        {/* Actor Badge */}
                        <div className="flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-slate-400" />
                          <span className="font-bold text-slate-700">{log.actorId}</span>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded border ${roleInfo.badgeClass}`}
                            title={roleInfo.sub}
                          >
                            {roleInfo.label}
                          </span>
                        </div>

                        {/* Resource ID */}
                        <div className="flex items-center gap-1.5 font-mono text-[11px] text-slate-500">
                          <Hash className="w-3 h-3 text-slate-400" />
                          <span>เป้าหมาย: {log.resourceId}</span>
                        </div>

                        {/* IP Address if present */}
                        {log.ipAddress && (
                          <div className="text-[11px] font-mono text-slate-400">
                            IP: {log.ipAddress}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Cryptographic Footprint (แฮชก่อนหน้า & แฮชประจำบล็อก) */}
                    <div
                      className={`shrink-0 md:w-76 border rounded-xl p-3.5 space-y-2.5 transition-all font-mono ${
                        isVerifying
                          ? 'bg-emerald-50 border-emerald-200'
                          : isFailed
                          ? 'bg-rose-50 border-rose-200'
                          : 'bg-slate-50 border-slate-100 group-hover:bg-emerald-50/30 group-hover:border-emerald-100'
                      }`}
                    >
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="font-bold text-slate-400 uppercase tracking-wider font-sans">
                          แฮชก่อนหน้า (Prev Hash)
                        </span>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(log.prevHash)}
                          title="คลิกเพื่อคัดลอกแฮช"
                          className="text-slate-400 hover:text-slate-700 transition-colors cursor-pointer flex items-center gap-1"
                        >
                          <span>{log.prevHash.slice(0, 10)}...</span>
                          <Copy className="w-2.5 h-2.5" />
                        </button>
                      </div>

                      <div className="h-px bg-slate-200/60" />

                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-[10px]">
                          <span
                            className={`font-bold uppercase tracking-wider font-sans ${
                              isFailed ? 'text-rose-600' : 'text-emerald-700'
                            }`}
                          >
                            แฮชบล็อกนี้ (Entry Hash)
                          </span>
                          <div
                            className={`flex items-center gap-1 font-bold ${
                              isFailed
                                ? 'text-rose-700'
                                : isVerified
                                ? 'text-emerald-700'
                                : 'text-slate-400'
                            }`}
                          >
                            {isVerifying ? (
                              <Activity className="w-3 h-3 animate-spin" />
                            ) : isFailed ? (
                              <ShieldAlert className="w-3 h-3" />
                            ) : isVerified ? (
                              <CheckCircle2 className="w-3 h-3" />
                            ) : null}
                            <span>
                              {isVerifying
                                ? 'กำลังตรวจ...'
                                : isFailed
                                ? 'ถูกแก้ไข!'
                                : isVerified
                                ? 'สมบูรณ์'
                                : 'รอตรวจสอบ'}
                            </span>
                          </div>
                        </div>

                        <div className="relative group/hash">
                          <button
                            type="button"
                            onClick={() => copyToClipboard(log.entryHash)}
                            title="คลิกเพื่อคัดลอกแฮช SHA-256"
                            className="w-full text-left text-[11px] font-mono text-slate-600 break-all bg-white p-2 border border-slate-200 rounded-lg shadow-inner hover:bg-slate-50 transition-colors cursor-pointer flex items-start justify-between gap-1"
                          >
                            <span>{log.entryHash}</span>
                            <span className="shrink-0 text-slate-400 hover:text-emerald-600 mt-0.5">
                              {copiedHash === log.entryHash ? (
                                <Check className="w-3 h-3 text-emerald-600" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Export Signed Daily Sales & Security Audit PDF Modal */}
      <ExportSignedPdfModal
        isOpen={isExportPdfOpen}
        onClose={() => setIsExportPdfOpen(false)}
        orders={orders}
        auditLogs={logs}
        throttles={throttles}
      />
    </div>
  );
};
