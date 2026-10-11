import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Users,
  BarChart3,
  Zap,
  Clock,
  TrendingUp,
  TrendingDown,
  Award,
  ArrowUpDown,
  Download,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  SlidersHorizontal,
  Layers,
  PieChart,
  Info,
  ShieldCheck,
  KeyRound,
  Search,
  FileText,
  ChevronRight,
  Filter,
  RotateCcw,
} from 'lucide-react';
import { PosOrderRecord, AuditLogRecord, formatSatangToThb } from '../types/prodx';

export interface StaffPerformanceMetric {
  id: string;
  name: string;
  role: 'CASHIER' | 'SHIFT_SUPERVISOR' | 'STORE_MANAGER';
  avatarInitials: string;
  avgCheckoutSpeedSeconds: number;
  totalOrders: number;
  totalSalesThb: number;
  refundCount: number;
  refundRatePct: number;
  voidCount: number;
  supervisorOverrideCount: number;
  efficiencyScore: number; // 0 - 100
  efficiencyGrade: 'A+' | 'A' | 'B+' | 'B' | 'C';
  speedVsBenchmarkPct: number; // negative means faster
}

interface StaffPerformanceAnalyticsProps {
  orders?: PosOrderRecord[];
  auditLogs?: AuditLogRecord[];
  onRefreshSecurityData?: () => Promise<void>;
}

// Store Benchmark Target Constants
const STORE_BENCHMARK_CHECKOUT_SPEED = 22.0; // target 22 seconds per order
const REFUND_ALERT_THRESHOLD_PCT = 3.5; // alert if refund rate > 3.5%

export const StaffPerformanceAnalytics: React.FC<StaffPerformanceAnalyticsProps> = ({
  orders = [],
  auditLogs = [],
  onRefreshSecurityData,
}) => {
  // Filter & Control States
  const [activeChartView, setActiveChartView] = useState<'ALL' | 'SPEED' | 'REFUND' | 'SALES'>('ALL');
  const [sortBy, setSortBy] = useState<'EFFICIENCY' | 'SPEED' | 'REFUND' | 'SALES'>('EFFICIENCY');
  const [roleFilter, setRoleFilter] = useState<'ALL' | 'CASHIER' | 'SHIFT_SUPERVISOR' | 'STORE_MANAGER'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [copiedNotification, setCopiedNotification] = useState<string | null>(null);

  // Compute Base Staff Performance Metrics
  const staffMetrics = useMemo(() => {
    // Default Seed Baseline Staff Roster
    const seedStaff: StaffPerformanceMetric[] = [
      {
        id: 'usr-cashier-01',
        name: 'Nattapong S. (ณัฐพงษ์ ส.)',
        role: 'CASHIER',
        avatarInitials: 'NS',
        avgCheckoutSpeedSeconds: 17.8,
        totalOrders: 164,
        totalSalesThb: 54280.0,
        refundCount: 2,
        refundRatePct: 1.22,
        voidCount: 1,
        supervisorOverrideCount: 2,
        efficiencyScore: 96.8,
        efficiencyGrade: 'A+',
        speedVsBenchmarkPct: -19.1,
      },
      {
        id: 'usr-cashier-02',
        name: 'Somchai K. (สมชาย ก.)',
        role: 'CASHIER',
        avatarInitials: 'SK',
        avgCheckoutSpeedSeconds: 21.2,
        totalOrders: 138,
        totalSalesThb: 42150.0,
        refundCount: 3,
        refundRatePct: 2.17,
        voidCount: 2,
        supervisorOverrideCount: 4,
        efficiencyScore: 92.4,
        efficiencyGrade: 'A',
        speedVsBenchmarkPct: -3.6,
      },
      {
        id: 'usr-supervisor-01',
        name: 'Ananya T. (อนัญญ์สิริ ต.)',
        role: 'SHIFT_SUPERVISOR',
        avatarInitials: 'AT',
        avgCheckoutSpeedSeconds: 19.5,
        totalOrders: 92,
        totalSalesThb: 36800.0,
        refundCount: 1,
        refundRatePct: 1.09,
        voidCount: 0,
        supervisorOverrideCount: 18,
        efficiencyScore: 95.1,
        efficiencyGrade: 'A+',
        speedVsBenchmarkPct: -11.4,
      },
      {
        id: 'usr-cashier-03',
        name: 'Wichai R. (วิชัย ร.)',
        role: 'CASHIER',
        avatarInitials: 'WR',
        avgCheckoutSpeedSeconds: 28.6,
        totalOrders: 74,
        totalSalesThb: 21450.0,
        refundCount: 5,
        refundRatePct: 6.76,
        voidCount: 4,
        supervisorOverrideCount: 9,
        efficiencyScore: 78.2,
        efficiencyGrade: 'B',
        speedVsBenchmarkPct: 30.0,
      },
      {
        id: 'usr-manager-01',
        name: 'Pravit M. (ประวิตร ม.)',
        role: 'STORE_MANAGER',
        avatarInitials: 'PM',
        avgCheckoutSpeedSeconds: 23.4,
        totalOrders: 45,
        totalSalesThb: 18900.0,
        refundCount: 0,
        refundRatePct: 0.0,
        voidCount: 1,
        supervisorOverrideCount: 24,
        efficiencyScore: 91.0,
        efficiencyGrade: 'A',
        speedVsBenchmarkPct: 6.4,
      },
    ];

    // Merge real orders data if available
    if (orders && orders.length > 0) {
      const orderGroups: Record<string, PosOrderRecord[]> = {};
      orders.forEach((ord) => {
        const key = ord.cashierName || 'POS Staff';
        if (!orderGroups[key]) orderGroups[key] = [];
        orderGroups[key].push(ord);
      });

      // Update existing seed metrics or augment with real totals
      Object.entries(orderGroups).forEach(([cashierName, ords]) => {
        const found = seedStaff.find((s) => s.name.toLowerCase().includes(cashierName.toLowerCase()));
        const orderCount = ords.length;
        const totalSalesThb = ords.reduce((acc, o) => acc + (o.totalSatang || 0) / 100, 0);

        if (found) {
          found.totalOrders += orderCount;
          found.totalSalesThb += totalSalesThb;
        } else {
          seedStaff.push({
            id: `usr-dyn-${cashierName.replace(/\s+/g, '-').toLowerCase()}`,
            name: cashierName,
            role: 'CASHIER',
            avatarInitials: cashierName.slice(0, 2).toUpperCase(),
            avgCheckoutSpeedSeconds: 22.5,
            totalOrders: orderCount,
            totalSalesThb,
            refundCount: 1,
            refundRatePct: (1 / (orderCount || 1)) * 100,
            voidCount: 0,
            supervisorOverrideCount: 1,
            efficiencyScore: 89.5,
            efficiencyGrade: 'A',
            speedVsBenchmarkPct: 2.3,
          });
        }
      });
    }

    // Merge audit log overrides if available
    if (auditLogs && auditLogs.length > 0) {
      auditLogs.forEach((log) => {
        if (log.action.includes('PIN_OVERRIDE') || log.action.includes('ORDER_VOID') || log.action.includes('REFUND')) {
          const match = seedStaff.find((s) => s.id === log.actorId || log.actorId.includes(s.avatarInitials));
          if (match) {
            if (log.action.includes('PIN_OVERRIDE')) match.supervisorOverrideCount += 1;
            if (log.action.includes('REFUND')) match.refundCount += 1;
            if (log.action.includes('VOID')) match.voidCount += 1;
          }
        }
      });
    }

    return seedStaff;
  }, [orders, auditLogs]);

  // Filtered & Sorted Staff Roster
  const processedStaff = useMemo(() => {
    return staffMetrics
      .filter((staff) => {
        if (roleFilter !== 'ALL' && staff.role !== roleFilter) return false;
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          return (
            staff.name.toLowerCase().includes(q) ||
            staff.role.toLowerCase().includes(q) ||
            staff.id.toLowerCase().includes(q)
          );
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'EFFICIENCY') return b.efficiencyScore - a.efficiencyScore;
        if (sortBy === 'SPEED') return a.avgCheckoutSpeedSeconds - b.avgCheckoutSpeedSeconds; // lower speed is faster!
        if (sortBy === 'REFUND') return a.refundRatePct - b.refundRatePct; // lower refund rate is better!
        if (sortBy === 'SALES') return b.totalSalesThb - a.totalSalesThb;
        return 0;
      });
  }, [staffMetrics, roleFilter, searchQuery, sortBy]);

  // Overall Store Metrics Summary
  const storeKPIs = useMemo(() => {
    const totalStaffCount = staffMetrics.length;
    const avgStoreSpeed =
      staffMetrics.reduce((acc, s) => acc + s.avgCheckoutSpeedSeconds, 0) / (totalStaffCount || 1);
    const overallRefundRate =
      staffMetrics.reduce((acc, s) => acc + s.refundRatePct, 0) / (totalStaffCount || 1);
    const topPerformer = [...staffMetrics].sort((a, b) => b.efficiencyScore - a.efficiencyScore)[0];
    const totalStoreSales = staffMetrics.reduce((acc, s) => acc + s.totalSalesThb, 0);
    const totalOverrides = staffMetrics.reduce((acc, s) => acc + s.supervisorOverrideCount, 0);

    return {
      totalStaffCount,
      avgStoreSpeed,
      overallRefundRate,
      topPerformer,
      totalStoreSales,
      totalOverrides,
    };
  }, [staffMetrics]);

  // Refresh Trigger
  const handleRefresh = async () => {
    setIsRefreshing(true);
    if (onRefreshSecurityData) {
      await onRefreshSecurityData();
    }
    setTimeout(() => setIsRefreshing(false), 600);
  };

  // Export Staff Efficiency Report
  const handleExportCsv = () => {
    const headers = [
      'Staff ID',
      'Name',
      'Role',
      'Avg Checkout Speed (s)',
      'Total Orders',
      'Total Sales (THB)',
      'Refund Count',
      'Refund Rate (%)',
      'Void Count',
      'Supervisor Overrides',
      'Efficiency Score',
      'Grade',
    ];
    const rows = processedStaff.map((s) => [
      s.id,
      `"${s.name}"`,
      s.role,
      s.avgCheckoutSpeedSeconds.toFixed(1),
      s.totalOrders,
      s.totalSalesThb.toFixed(2),
      s.refundCount,
      s.refundRatePct.toFixed(2),
      s.voidCount,
      s.supervisorOverrideCount,
      s.efficiencyScore.toFixed(1),
      s.efficiencyGrade,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `PRODX_Staff_Performance_Report_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setCopiedNotification('ส่งออกรายงานประสิทธิภาพพนักงาน (CSV) เรียบร้อยแล้ว!');
    setTimeout(() => setCopiedNotification(null), 3000);
  };

  // Max scale calculation for charts
  const maxCheckoutSpeed = useMemo(
    () => Math.max(...staffMetrics.map((s) => s.avgCheckoutSpeedSeconds), STORE_BENCHMARK_CHECKOUT_SPEED) * 1.15,
    [staffMetrics]
  );
  const maxRefundRate = useMemo(
    () => Math.max(...staffMetrics.map((s) => s.refundRatePct), REFUND_ALERT_THRESHOLD_PCT) * 1.25,
    [staffMetrics]
  );
  const maxSales = useMemo(() => Math.max(...staffMetrics.map((s) => s.totalSalesThb)), [staffMetrics]);

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-6">
      {/* Notification Toast */}
      <AnimatePresence>
        {copiedNotification && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-3 bg-emerald-600 text-white rounded-2xl text-xs font-bold shadow-lg flex items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-200" />
              <span>{copiedNotification}</span>
            </div>
            <button
              type="button"
              onClick={() => setCopiedNotification(null)}
              className="text-white/80 hover:text-white"
            >
              ✕
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header Banner */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-indigo-500" />
              <span>RBAC Staff Performance & Productivity Analytics</span>
            </span>
            <span className="text-xs text-slate-400 font-mono">
              Monitored: {storeKPIs.totalStaffCount} Staff Members
            </span>
          </div>

          <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            <span>การวิเคราะห์ประสิทธิภาพและการปฏิบัติงานของพนักงาน (Staff Efficiency)</span>
          </h3>

          <p className="text-xs text-slate-500 dark:text-slate-400">
            เปรียบเทียบความเร็วเช็กเอาต์ (Avg Checkout Speed), อัตราการขอคืนเงิน/ยกเลิกบิล (Refund Rate) และประวัติ PIN Override เชิงลึก
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="px-3.5 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
            title="อัปเดตข้อมูลประสิทธิภาพพนักงาน"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-indigo-500 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>อัปเดตข้อมูล</span>
          </button>

          <button
            type="button"
            onClick={handleExportCsv}
            className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-600/20 cursor-pointer flex items-center gap-1.5"
            title="ส่งออกรายงาน CSV ประสิทธิภาพพนักงาน"
          >
            <Download className="w-3.5 h-3.5" />
            <span>ส่งออก CSV</span>
          </button>
        </div>
      </div>

      {/* KPI Overview Summary Bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* KPI 1: Store Avg Speed */}
        <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-[10px] font-mono font-bold uppercase tracking-wider">
            <span>ความเร็วเช็กเอาต์เฉลี่ยรวม</span>
            <Clock className="w-3.5 h-3.5 text-indigo-500" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900 dark:text-white font-mono tabular-nums">
              {storeKPIs.avgStoreSpeed.toFixed(1)}s
            </span>
            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-0.5">
              <TrendingUp className="w-3 h-3" />
              <span>เป้าหมาย {STORE_BENCHMARK_CHECKOUT_SPEED}s</span>
            </span>
          </div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400">
            ระยะเวลาทำรายการเฉลี่ยต่อบิลในร้าน
          </div>
        </div>

        {/* KPI 2: Overall Refund Rate */}
        <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-[10px] font-mono font-bold uppercase tracking-wider">
            <span>อัตราส่วนการขอคืนเงินรวม</span>
            <RotateCcw className="w-3.5 h-3.5 text-amber-500" />
          </div>
          <div className="flex items-baseline gap-2">
            <span
              className={`text-2xl font-black font-mono tabular-nums ${
                storeKPIs.overallRefundRate > REFUND_ALERT_THRESHOLD_PCT
                  ? 'text-rose-600 dark:text-rose-400'
                  : 'text-emerald-600 dark:text-emerald-400'
              }`}
            >
              {storeKPIs.overallRefundRate.toFixed(2)}%
            </span>
            <span className="text-[10px] text-slate-400 font-bold">
              เกณฑ์เฝ้าระวัง {REFUND_ALERT_THRESHOLD_PCT}%
            </span>
          </div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400">
            สัดส่วนการ Refund / Void ต่อรายการขาย
          </div>
        </div>

        {/* KPI 3: Top Performer */}
        <div className="bg-emerald-50/50 dark:bg-emerald-950/30 p-4 rounded-2xl border border-emerald-200/60 dark:border-emerald-800/60 space-y-1">
          <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400 text-[10px] font-mono font-bold uppercase tracking-wider">
            <span>พนักงานประสิทธิภาพสูงสุด</span>
            <Award className="w-3.5 h-3.5 text-emerald-500" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-lg font-black text-emerald-900 dark:text-emerald-200 truncate">
              {storeKPIs.topPerformer?.name.split(' ')[0]}
            </span>
            <span className="px-2 py-0.5 bg-emerald-600 text-white rounded text-[10px] font-mono font-bold">
              Grade {storeKPIs.topPerformer?.efficiencyGrade}
            </span>
          </div>
          <div className="text-[10px] text-emerald-700 dark:text-emerald-300 font-mono">
            Score: {storeKPIs.topPerformer?.efficiencyScore.toFixed(1)} / 100
          </div>
        </div>

        {/* KPI 4: Total Overrides Logged */}
        <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-[10px] font-mono font-bold uppercase tracking-wider">
            <span>PIN Overrides Logged</span>
            <KeyRound className="w-3.5 h-3.5 text-purple-500" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900 dark:text-white font-mono tabular-nums">
              {storeKPIs.totalOverrides}
            </span>
            <span className="text-[10px] text-slate-400 font-bold">ครั้งในระบบ</span>
          </div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400">
            การอนุมัติสิทธิ์พิเศษโดย Supervisor
          </div>
        </div>
      </div>

      {/* Control & Filter Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-50 dark:bg-slate-950 p-3 rounded-2xl border border-slate-200/80 dark:border-slate-800">
        {/* Chart View Toggle Tabs */}
        <div className="flex items-center gap-1 bg-white dark:bg-slate-900 p-1 rounded-xl text-xs font-medium border border-slate-200 dark:border-slate-800 overflow-x-auto">
          {[
            { id: 'ALL', label: 'กราฟเปรียบเทียบทั้งหมด' },
            { id: 'SPEED', label: 'ความเร็วเช็กเอาต์ (Speed)' },
            { id: 'REFUND', label: 'อัตราคืนเงิน (Refund Rate)' },
            { id: 'SALES', label: 'ยอดขายรวม (Sales Volume)' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveChartView(tab.id as any)}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap font-bold text-xs ${
                activeChartView === tab.id
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Sort & Role Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Role Filter */}
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as any)}
            className="px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
          >
            <option value="ALL">ทุกบทบาท (All Roles)</option>
            <option value="CASHIER">แคชเชียร์เท่านั้น (Cashiers)</option>
            <option value="SHIFT_SUPERVISOR">หัวหน้ากะ (Supervisors)</option>
            <option value="STORE_MANAGER">ผู้จัดการร้าน (Managers)</option>
          </select>

          {/* Sort By Selector */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
          >
            <option value="EFFICIENCY">เรียงตาม: คะแนนประสิทธิภาพ</option>
            <option value="SPEED">เรียงตาม: ความเร็วเช็กเอาต์</option>
            <option value="REFUND">เรียงตาม: อัตราคืนเงินต่ำที่สุด</option>
            <option value="SALES">เรียงตาม: ยอดขายรวมสูงสุด</option>
          </select>

          {/* Search Box */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ค้นหาชื่อพนักงาน..."
              className="pl-8 pr-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 w-36 sm:w-44"
            />
          </div>
        </div>
      </div>

      {/* Comparative Bar Charts Display Container */}
      <div className="space-y-6">
        {/* CHART 1: Comparative Bar Chart - Average Checkout Speed (เวลาเช็กเอาต์เฉลี่ย) */}
        {(activeChartView === 'ALL' || activeChartView === 'SPEED') && (
          <div className="bg-slate-50/70 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/60 dark:border-slate-800 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-indigo-500" />
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                    1. เปรียบเทียบความเร็วเช็กเอาต์เฉลี่ยต่อบิล (Avg Checkout Speed in Seconds)
                  </h4>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  ค่าน้อย = คิดเงินเร็ว | เส้นประแสดงเป้าหมายมาตรฐานร้าน ({STORE_BENCHMARK_CHECKOUT_SPEED} วินาที)
                </p>
              </div>

              <div className="flex items-center gap-3 text-[10px] font-mono">
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  <span>เร็วกว่าเป้าหมาย (&le;20s)</span>
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
                  <span>ปกติ (20-25s)</span>
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                  <span>ช้ากว่าเป้าหมาย (&gt;25s)</span>
                </span>
              </div>
            </div>

            {/* Comparative Bar Graph Stack */}
            <div className="space-y-3 relative pt-2">
              {/* Target Benchmark Line Marker */}
              <div
                className="absolute top-0 bottom-0 border-r-2 border-dashed border-indigo-400 dark:border-indigo-500 z-10 pointer-events-none"
                style={{
                  left: `${(STORE_BENCHMARK_CHECKOUT_SPEED / maxCheckoutSpeed) * 100}%`,
                }}
              >
                <span className="absolute -top-3 -translate-x-1/2 bg-indigo-600 text-white text-[9px] font-mono font-bold px-1.5 py-0.5 rounded shadow">
                  Target {STORE_BENCHMARK_CHECKOUT_SPEED}s
                </span>
              </div>

              {processedStaff.map((staff) => {
                const pct = Math.min(100, (staff.avgCheckoutSpeedSeconds / maxCheckoutSpeed) * 100);
                const isFast = staff.avgCheckoutSpeedSeconds <= 20.0;
                const isSlow = staff.avgCheckoutSpeedSeconds > 25.0;

                const gradientClass = isFast
                  ? 'from-emerald-500 to-teal-600'
                  : isSlow
                  ? 'from-amber-500 to-rose-500'
                  : 'from-indigo-500 to-blue-600';

                return (
                  <div key={`speed-${staff.id}`} className="space-y-1 group">
                    <div className="flex items-center justify-between text-xs font-mono">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-6 h-6 rounded-lg bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 flex items-center justify-center font-bold text-[10px] shrink-0">
                          {staff.avatarInitials}
                        </span>
                        <span className="font-bold text-slate-900 dark:text-slate-100 truncate font-sans">
                          {staff.name}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 font-sans">
                          {staff.role}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-bold text-slate-900 dark:text-white tabular-nums">
                          {staff.avgCheckoutSpeedSeconds.toFixed(1)}s
                        </span>
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                            staff.speedVsBenchmarkPct <= 0
                              ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                              : 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300'
                          }`}
                        >
                          {staff.speedVsBenchmarkPct <= 0
                            ? `${Math.abs(staff.speedVsBenchmarkPct).toFixed(1)}% เร็วกว่า`
                            : `${staff.speedVsBenchmarkPct.toFixed(1)}% ช้ากว่า`}
                        </span>
                      </div>
                    </div>

                    {/* Bar Track */}
                    <div className="h-6 bg-slate-200/60 dark:bg-slate-800/80 rounded-xl overflow-hidden relative p-0.5">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.8, ease: 'easeOut' }}
                        className={`h-full rounded-lg bg-gradient-to-r ${gradientClass} flex items-center justify-end pr-2 text-[10px] font-bold text-white shadow-sm`}
                      >
                        {pct > 18 && <span>{staff.avgCheckoutSpeedSeconds.toFixed(1)}s</span>}
                      </motion.div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* CHART 2: Comparative Bar Chart - Refund & Void Frequency Rate (อัตราคืนเงินและยกเลิกบิล) */}
        {(activeChartView === 'ALL' || activeChartView === 'REFUND') && (
          <div className="bg-slate-50/70 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/60 dark:border-slate-800 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <RotateCcw className="w-4 h-4 text-rose-500" />
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                    2. เปรียบเทียบอัตราส่วนการขอคืนเงินและยกเลิกบิล (Refund & Void Frequency %)
                  </h4>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  ค่าน้อย = มีความแม่นยำสูง | เส้นประแสดงเกณฑ์เฝ้าระวังความเสี่ยงสูง ({REFUND_ALERT_THRESHOLD_PCT}%)
                </p>
              </div>

              <div className="flex items-center gap-3 text-[10px] font-mono">
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-cyan-500" />
                  <span>ปกติ (&le;2%)</span>
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                  <span>ปานกลาง (2-3.5%)</span>
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
                  <span>สูงผิดปกติ (&gt;3.5%)</span>
                </span>
              </div>
            </div>

            {/* Comparative Bar Graph Stack */}
            <div className="space-y-3 relative pt-2">
              {/* Alert Threshold Marker Line */}
              <div
                className="absolute top-0 bottom-0 border-r-2 border-dashed border-rose-500 z-10 pointer-events-none"
                style={{
                  left: `${(REFUND_ALERT_THRESHOLD_PCT / maxRefundRate) * 100}%`,
                }}
              >
                <span className="absolute -top-3 -translate-x-1/2 bg-rose-600 text-white text-[9px] font-mono font-bold px-1.5 py-0.5 rounded shadow">
                  Limit {REFUND_ALERT_THRESHOLD_PCT}%
                </span>
              </div>

              {processedStaff.map((staff) => {
                const pct = Math.min(100, (staff.refundRatePct / maxRefundRate) * 100);
                const isHighRisk = staff.refundRatePct > REFUND_ALERT_THRESHOLD_PCT;
                const isModerate = staff.refundRatePct > 2.0 && !isHighRisk;

                const gradientClass = isHighRisk
                  ? 'from-rose-500 to-red-600 animate-pulse'
                  : isModerate
                  ? 'from-amber-500 to-orange-500'
                  : 'from-cyan-500 to-blue-600';

                return (
                  <div key={`refund-${staff.id}`} className="space-y-1 group">
                    <div className="flex items-center justify-between text-xs font-mono">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-6 h-6 rounded-lg bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 flex items-center justify-center font-bold text-[10px] shrink-0">
                          {staff.avatarInitials}
                        </span>
                        <span className="font-bold text-slate-900 dark:text-slate-100 truncate font-sans">
                          {staff.name}
                        </span>
                        {isHighRisk && (
                          <span className="px-1.5 py-0.2 bg-rose-100 dark:bg-rose-950 text-rose-600 dark:text-rose-400 rounded text-[9px] font-bold flex items-center gap-1 font-sans">
                            <AlertTriangle className="w-2.5 h-2.5" />
                            <span>เฝ้าระวัง</span>
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-bold text-slate-900 dark:text-white tabular-nums">
                          {staff.refundRatePct.toFixed(2)}%
                        </span>
                        <span className="text-[10px] text-slate-400 font-sans">
                          ({staff.refundCount} คืน / {staff.totalOrders} บิล)
                        </span>
                      </div>
                    </div>

                    {/* Bar Track */}
                    <div className="h-6 bg-slate-200/60 dark:bg-slate-800/80 rounded-xl overflow-hidden relative p-0.5">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.8, ease: 'easeOut' }}
                        className={`h-full rounded-lg bg-gradient-to-r ${gradientClass} flex items-center justify-end pr-2 text-[10px] font-bold text-white shadow-sm`}
                      >
                        {pct > 15 && <span>{staff.refundRatePct.toFixed(1)}%</span>}
                      </motion.div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* CHART 3: Comparative Bar Chart - Sales Output & Order Volume (ยอดขายรวมและจำนวนบิล) */}
        {(activeChartView === 'ALL' || activeChartView === 'SALES') && (
          <div className="bg-slate-50/70 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200/60 dark:border-slate-800 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-emerald-500" />
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                    3. เปรียบเทียบยอดขายรวมและจำนวนบิลสำเร็จ (Total Sales THB & Order Volume)
                  </h4>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  แสดงยอดขายสุทธิที่พนักงานแต่ละคนประมวลผลสำเร็จในระบบ
                </p>
              </div>
            </div>

            {/* Comparative Bar Graph Stack */}
            <div className="space-y-3 pt-1">
              {processedStaff.map((staff) => {
                const pct = Math.min(100, (staff.totalSalesThb / maxSales) * 100);

                return (
                  <div key={`sales-${staff.id}`} className="space-y-1 group">
                    <div className="flex items-center justify-between text-xs font-mono">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-6 h-6 rounded-lg bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 flex items-center justify-center font-bold text-[10px] shrink-0">
                          {staff.avatarInitials}
                        </span>
                        <span className="font-bold text-slate-900 dark:text-slate-100 truncate font-sans">
                          {staff.name}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-[10px] text-slate-400">
                          {staff.totalOrders} บิล
                        </span>
                        <span className="font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                          ฿{staff.totalSalesThb.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>

                    {/* Bar Track */}
                    <div className="h-6 bg-slate-200/60 dark:bg-slate-800/80 rounded-xl overflow-hidden relative p-0.5">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.8, ease: 'easeOut' }}
                        className="h-full rounded-lg bg-gradient-to-r from-emerald-500 via-teal-500 to-indigo-600 flex items-center justify-end pr-2 text-[10px] font-bold text-white shadow-sm"
                      >
                        {pct > 20 && <span>฿{staff.totalSalesThb.toLocaleString()}</span>}
                      </motion.div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Detailed Staff Performance Leaderboard & Audit Table */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Award className="w-4 h-4 text-indigo-500" />
            <span>ตารางประเมินผลประสิทธิภาพพนักงานรายบุคคล (Staff Performance Leaderboard)</span>
          </h4>
          <span className="text-[10px] font-mono text-slate-400">
            {processedStaff.length} Members Monitored
          </span>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-950/80 text-slate-500 dark:text-slate-400 uppercase font-mono font-bold text-[10px] border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="py-3.5 px-4">พนักงาน (Staff Member)</th>
                <th className="py-3.5 px-4">บทบาท (Role)</th>
                <th className="py-3.5 px-4">ความเร็วเช็กเอาต์เฉลี่ย</th>
                <th className="py-3.5 px-4">จำนวนบิล / ยอดขาย</th>
                <th className="py-3.5 px-4">อัตราขอคืนเงิน / ยกเลิก</th>
                <th className="py-3.5 px-4">PIN Overrides</th>
                <th className="py-3.5 px-4">เกรดประสิทธิภาพ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 font-mono">
              {processedStaff.map((staff) => {
                const isSelected = selectedStaffId === staff.id;
                const isHighRiskRefund = staff.refundRatePct > REFUND_ALERT_THRESHOLD_PCT;

                return (
                  <tr
                    key={staff.id}
                    onClick={() => setSelectedStaffId(isSelected ? null : staff.id)}
                    className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors cursor-pointer ${
                      isSelected ? 'bg-indigo-50/40 dark:bg-indigo-950/30' : ''
                    }`}
                  >
                    <td className="py-3.5 px-4 font-sans font-bold text-slate-900 dark:text-white whitespace-nowrap">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 font-mono font-bold text-xs flex items-center justify-center">
                          {staff.avatarInitials}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900 dark:text-white text-xs">{staff.name}</div>
                          <div className="text-[10px] text-slate-400 font-mono">{staff.id}</div>
                        </div>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 font-sans whitespace-nowrap">
                      <span className="px-2.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg text-[10px] font-bold border border-slate-200 dark:border-slate-700">
                        {staff.role}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 font-mono whitespace-nowrap">
                      <div className="font-bold text-slate-900 dark:text-slate-100">
                        {staff.avgCheckoutSpeedSeconds.toFixed(1)} วินาที
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {staff.speedVsBenchmarkPct <= 0
                          ? `(-${Math.abs(staff.speedVsBenchmarkPct).toFixed(1)}% เร็วกว่าเป้าหมาย)`
                          : `(+${staff.speedVsBenchmarkPct.toFixed(1)}% ช้ากว่าเป้าหมาย)`}
                      </div>
                    </td>

                    <td className="py-3.5 px-4 font-mono whitespace-nowrap">
                      <div className="font-bold text-emerald-600 dark:text-emerald-400">
                        ฿{staff.totalSalesThb.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {staff.totalOrders} รายการขาย
                      </div>
                    </td>

                    <td className="py-3.5 px-4 font-mono whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          isHighRiskRefund
                            ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800'
                            : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                        }`}
                      >
                        {isHighRiskRefund ? (
                          <AlertTriangle className="w-3 h-3 text-rose-500" />
                        ) : (
                          <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                        )}
                        <span>{staff.refundRatePct.toFixed(2)}%</span>
                      </span>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        {staff.refundCount} คืนเงิน / {staff.voidCount} ยกเลิก
                      </div>
                    </td>

                    <td className="py-3.5 px-4 font-mono whitespace-nowrap">
                      <span className="bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 px-2 py-0.5 rounded border border-purple-200 dark:border-purple-800 font-bold text-[10px]">
                        {staff.supervisorOverrideCount} ครั้ง
                      </span>
                    </td>

                    <td className="py-3.5 px-4 font-mono whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2.5 py-1 rounded-xl text-xs font-black text-white ${
                            staff.efficiencyGrade === 'A+'
                              ? 'bg-emerald-600'
                              : staff.efficiencyGrade === 'A'
                              ? 'bg-teal-600'
                              : staff.efficiencyGrade === 'B+'
                              ? 'bg-indigo-600'
                              : 'bg-amber-600'
                          }`}
                        >
                          Grade {staff.efficiencyGrade}
                        </span>
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                          {staff.efficiencyScore.toFixed(1)} / 100
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
