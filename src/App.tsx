import React, { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ShoppingBag,
  Database,
  Container,
  Activity,
  ShieldCheck,
  Calculator,
  Server,
  Download,
  RefreshCw,
  Smartphone,
  Tablet,
  Monitor,
  Maximize2,
  Sun,
  Moon,
} from 'lucide-react';
import {
  ProductItem,
  PosOrderRecord,
  MigrationItem,
  DbInvariant,
  AuditLogRecord,
  LoginThrottleRecord,
  TelemetryPoint,
  TelemetrySummary,
  Latency24hPoint,
  ServiceResourceAllocation,
  CloudPricingUnit,
  formatSatangToThb,
} from './types/prodx';
import { PosTerminalWorkspace } from './components/PosTerminalWorkspace';
import { DatabaseMigrationConsole } from './components/DatabaseMigrationConsole';
import { DockerCicdBlueprintView } from './components/DockerCicdBlueprintView';
import { RealtimeTelemetryConsole } from './components/RealtimeTelemetryConsole';
import { SecurityRbacAuditConsole } from './components/SecurityRbacAuditConsole';
import { InfraCostEstimationView } from './components/InfraCostEstimationView';
import { BackendConnectionView } from './components/BackendConnectionView';
import { ShiftLifecycleModal } from './components/ShiftLifecycleModal';
import { AntigravityHealthCheck } from './components/AntigravityHealthCheck';
import { KitchenDisplayWorkspace } from './components/KitchenDisplayWorkspace';
import { NotificationBell } from './components/NotificationBell';
import { PredictiveInventoryConsole } from './components/PredictiveInventoryConsole';
import { CustomerFacingDisplay } from './components/CustomerFacingDisplay';
import { NetworkResilienceOverlay } from './components/NetworkResilienceOverlay';
import { AnimatedMetricValue } from './components/AnimatedMetricValue';
import { useNetworkResilience } from './context/NetworkResilienceContext';
import { Wifi, WifiOff } from 'lucide-react';

type ActiveModule = 'POS' | 'INVENTORY' | 'CUSTOMER_DISPLAY' | 'KDS' | 'MIGRATIONS' | 'BACKEND_CONNECT' | 'DOCKER_CICD' | 'COST_ESTIMATOR' | 'TELEMETRY' | 'SECURITY';
type DeviceViewMode = 'AUTO' | 'MOBILE' | 'TABLET' | 'DESKTOP';

export default function App() {
  // Check if opened as secondary monitor presentation receiver or popup
  const isStandaloneCustomerDisplay =
    typeof window !== 'undefined' &&
    (window.location.search.includes('display=customer') ||
      window.location.pathname === '/customer-display');

  if (isStandaloneCustomerDisplay) {
    return <CustomerFacingDisplay isStandalone={true} />;
  }

  const {
    effectiveIsOnline,
    pendingCount,
    expandOverlay: openNetworkResilienceOverlay,
  } = useNetworkResilience();

  const [activeModule, setActiveModule] = useState<ActiveModule>('POS');
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('prodx-theme');
      if (saved === 'light' || saved === 'dark') return saved;
      if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        return 'dark';
      }
    }
    return 'light';
  });

  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('prodx-theme', theme);
  }, [theme]);
  const [deviceViewMode, setDeviceViewMode] = useState<DeviceViewMode>('AUTO');
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [orders, setOrders] = useState<PosOrderRecord[]>([]);
  const [migrations, setMigrations] = useState<MigrationItem[]>([]);
  const [invariants, setInvariants] = useState<DbInvariant[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogRecord[]>([]);
  const [throttles, setThrottles] = useState<LoginThrottleRecord[]>([]);
  const [infraServices, setInfraServices] = useState<ServiceResourceAllocation[]>([]);
  const [infraProviders, setInfraProviders] = useState<CloudPricingUnit[]>([]);
  const [telemetryHistory, setTelemetryHistory] = useState<TelemetryPoint[]>([]);
  const [latency24h, setLatency24h] = useState<Latency24hPoint[]>([]);
  const [telemetrySummary, setTelemetrySummary] = useState<TelemetrySummary>({
    totalRequestsHandled: 0,
    totalIdempotentHits: 0,
    activeStore: 'BKK-FLAGSHIP-01',
    activeShift: 'SH-2026-AM',
    shiftStatus: 'ACTIVE',
    uptimeSeconds: 0,
  });
  const [isGlobalShiftModalOpen, setIsGlobalShiftModalOpen] = useState(false);
  const [loadingInitial, setLoadingInitial] = useState(true);

  const fetchAllEnterpriseData = useCallback(async () => {
    try {
      const [catRes, ordRes, migRes, secRes, telRes, costRes] = await Promise.all([
        fetch('/api/catalog'),
        fetch('/api/orders'),
        fetch('/api/db/migrations'),
        fetch('/api/security/audit-logs'),
        fetch('/api/telemetry'),
        fetch('/api/infra-cost'),
      ]);

      if (catRes.ok) {
        const catData = await catRes.json();
        setProducts(catData.products || []);
      }
      if (ordRes.ok) {
        const ordData = await ordRes.json();
        const rawOrders: PosOrderRecord[] = ordData.orders || [];
        const uniqueOrdersMap = new Map<string, PosOrderRecord>();
        for (const o of rawOrders) {
          const key = o.id || o.orderNumber;
          if (key && !uniqueOrdersMap.has(key)) {
            uniqueOrdersMap.set(key, o);
          }
        }
        setOrders(Array.from(uniqueOrdersMap.values()));
      }
      if (migRes.ok) {
        const migData = await migRes.json();
        setMigrations(migData.migrations || []);
        setInvariants(migData.invariants || []);
      }
      if (secRes.ok) {
        const secData = await secRes.json();
        setAuditLogs(secData.logs || []);
        setThrottles(secData.throttles || []);
      }
      if (telRes.ok) {
        const telData = await telRes.json();
        setTelemetryHistory(telData.history || []);
        if (telData.latency24h) {
          setLatency24h(telData.latency24h);
        }
        if (telData.summary) {
          setTelemetrySummary(telData.summary);
        }
      }
      if (costRes.ok) {
        const costData = await costRes.json();
        if (costData.services) setInfraServices(costData.services);
        if (costData.providers) setInfraProviders(costData.providers);
      }
    } finally {
      setLoadingInitial(false);
    }
  }, []);

  useEffect(() => {
    fetchAllEnterpriseData();
  }, [fetchAllEnterpriseData]);

  useEffect(() => {
    const handleRefresh = () => {
      fetchAllEnterpriseData();
    };
    window.addEventListener('prodx-refresh-data', handleRefresh);
    return () => window.removeEventListener('prodx-refresh-data', handleRefresh);
  }, [fetchAllEnterpriseData]);

  // Poll real-time telemetry every 4 seconds
  useEffect(() => {
    const timer = setInterval(async () => {
      try {
        const res = await fetch('/api/telemetry');
        if (res.ok) {
          const data = await res.json();
          setTelemetryHistory(data.history || []);
          if (data.latency24h) {
            setLatency24h(data.latency24h);
          }
          if (data.summary) {
            setTelemetrySummary(data.summary);
          }
        }
      } catch {
        // Ignore transient network errors
      }
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  const handleVerifyMigrations = async () => {
    const res = await fetch('/api/db/migrations/verify', { method: 'POST' });
    if (res.ok) {
      await fetchAllEnterpriseData();
    }
  };

  const handleTriggerDrill = async (mode: 'SPIKE' | 'NORMAL') => {
    const res = await fetch('/api/telemetry/drill', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode }),
    });
    if (res.ok) {
      await fetchAllEnterpriseData();
    }
  };

  const exportProductionReadinessManifest = () => {
    const report = {
      project: 'PRODX Enterprise POS & Cloud Ops',
      exportedAt: new Date().toISOString(),
      storeBranch: telemetrySummary.activeStore,
      activeShift: telemetrySummary.activeShift,
      migrationsVerified: migrations.length,
      invariantsEnforced: invariants.length,
      committedOrdersCount: orders.length,
      auditChainBlocks: auditLogs.length,
      latestTelemetry: telemetryHistory[telemetryHistory.length - 1] || null,
    };
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `prodx-production-manifest-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const completedSalesSatang = orders
    .filter((o) => o.status === 'COMPLETED')
    .reduce((sum, o) => sum + o.totalSatang, 0);

  const activeKdsCount = orders.filter(o => o.status === 'COMPLETED' && (o.kdsStatus || 'PENDING') !== 'COMPLETED').length;
  const inventoryReorderAlertCount = products.filter(p => p.stock <= p.lowStockThreshold).length;
  const latestTelemetry = telemetryHistory[telemetryHistory.length - 1];

  return (
    <div className={`min-h-screen flex flex-col max-w-full overflow-x-hidden min-w-0 font-sans selection:bg-emerald-100 selection:text-emerald-900 transition-colors duration-300 ${
      theme === 'dark' ? 'bg-slate-950 text-slate-100' : 'bg-[#F8FAFC] text-slate-900'
    }`}>
      {/* Header Bar - Strict Enterprise Elevation & Alignment */}
      <header className={`backdrop-blur-md border-b sticky top-0 z-40 px-6 py-3.5 flex items-center justify-between gap-4 max-w-full overflow-hidden transition-colors duration-300 ${
        theme === 'dark' ? 'bg-slate-900/80 border-slate-800 text-white' : 'bg-white/80 border-slate-200 text-slate-900'
      }`}>
        {/* Brand Zone: Single text element wordmark */}
        <div className="flex items-center gap-4 shrink-0">
          <a
            href="/"
            onClick={(e) => {
              e.preventDefault();
              setActiveModule('POS');
            }}
            className={`text-xl font-bold tracking-tight whitespace-nowrap hover:opacity-80 transition-all duration-300 ${
              theme === 'dark' ? 'text-white' : 'text-slate-900'
            }`}
          >
            PRODX
          </a>
        </div>

        {/* Zone 2: Main Navigation Links - Refined Segmented Control */}
        <nav className={`hidden lg:flex items-center gap-1 p-1 rounded-xl border transition-colors duration-300 ${
          theme === 'dark' ? 'bg-slate-950 border-slate-800' : 'bg-slate-100 border-slate-200/60'
        }`}>
          {[
            { id: 'POS', label: 'POS' },
            { id: 'INVENTORY', label: 'Inventory', badge: inventoryReorderAlertCount },
            { id: 'CUSTOMER_DISPLAY', label: 'Customer Screen' },
            { id: 'KDS', label: 'Kitchen KDS', badge: activeKdsCount },
            { id: 'MIGRATIONS', label: 'DB' },
            { id: 'BACKEND_CONNECT', label: 'Network' },
            { id: 'DOCKER_CICD', label: 'Deploy' },
            { id: 'TELEMETRY', label: 'Monitor' },
            { id: 'SECURITY', label: 'Security' },
            { id: 'COST_ESTIMATOR', label: 'Cost TCO' },
          ].map((tab) => {
            const isActive = activeModule === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveModule(tab.id as ActiveModule)}
                className={`whitespace-nowrap transition-all px-3.5 py-1.5 rounded-lg text-sm font-semibold tracking-tight flex items-center gap-1.5 cursor-pointer ${
                  isActive
                    ? theme === 'dark'
                      ? 'bg-slate-800 text-white shadow-sm border border-slate-700'
                      : 'bg-white text-slate-900 shadow-sm border border-slate-200/60'
                    : theme === 'dark'
                      ? 'text-slate-400 hover:text-white hover:bg-slate-800/40'
                      : 'text-slate-500 hover:text-slate-900 hover:bg-white/60'
                }`}
              >
                <span>{tab.label}</span>
                {typeof tab.badge === 'number' && tab.badge > 0 && (
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-black ${
                    isActive ? 'bg-amber-500 text-slate-950' : 'bg-amber-500/20 text-amber-500'
                  }`}>
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Primary Actions & Device Selection */}
        <div className="flex items-center gap-3 shrink-0">
          {/* Device Switcher - Refined */}
          <div className={`hidden xl:flex items-center p-1 rounded-lg border transition-colors duration-300 ${
            theme === 'dark' ? 'bg-slate-950 border-slate-800' : 'bg-slate-100 border-slate-200/60'
          }`}>
            {[
              { id: 'AUTO', icon: Maximize2, title: 'Auto' },
              { id: 'MOBILE', icon: Smartphone, title: 'Mobile' },
              { id: 'TABLET', icon: Tablet, title: 'Tablet' },
              { id: 'DESKTOP', icon: Monitor, title: 'Desktop' },
            ].map((d) => (
              <button
                key={d.id}
                onClick={() => setDeviceViewMode(d.id as any)}
                className={`p-1.5 rounded-md transition-all ${
                  deviceViewMode === d.id 
                    ? theme === 'dark'
                      ? 'bg-slate-800 text-emerald-400 shadow-sm border border-slate-700'
                      : 'bg-white text-emerald-600 shadow-sm border border-slate-200/40' 
                    : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
                }`}
                title={d.title}
              >
                <d.icon className="w-3.5 h-3.5" />
              </button>
            ))}
          </div>

          {/* Network Resilience Status Button */}
          <button
            onClick={openNetworkResilienceOverlay}
            className={`p-2 rounded-lg transition-all border shadow-sm flex items-center gap-1.5 cursor-pointer ${
              !effectiveIsOnline
                ? 'bg-amber-500/15 border-amber-500/50 text-amber-500 animate-pulse ring-2 ring-amber-500/20'
                : theme === 'dark'
                ? 'bg-slate-800 border-slate-700 text-emerald-400 hover:text-emerald-300 hover:bg-slate-700'
                : 'bg-white border-slate-200 text-emerald-600 hover:text-emerald-700 hover:bg-slate-50'
            }`}
            title={
              !effectiveIsOnline
                ? `Offline Mode Active (${pendingCount} Pending Sync)`
                : 'Network Online (Connected)'
            }
          >
            {!effectiveIsOnline ? (
              <>
                <WifiOff className="w-4 h-4 text-amber-400" />
                {pendingCount > 0 && (
                  <span className="font-mono text-[10px] font-black px-1.5 py-0.5 rounded bg-amber-500 text-slate-950">
                    {pendingCount}
                  </span>
                )}
              </>
            ) : (
              <Wifi className="w-4 h-4" />
            )}
          </button>

          {/* Theme Toggle Button */}
          <button
            onClick={() => setTheme(prev => prev === 'light' ? 'dark' : 'light')}
            className={`p-2 rounded-lg transition-all border shadow-sm flex items-center justify-center cursor-pointer ${
              theme === 'dark' 
                ? 'bg-slate-800 border-slate-700 text-amber-400 hover:text-amber-300 hover:bg-slate-700' 
                : 'bg-white border-slate-200 text-slate-500 hover:text-slate-900 hover:bg-slate-50'
            }`}
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          {/* System Notifications Bell with Critical Alert Sentinel */}
          <NotificationBell
            theme={theme}
            onNavigateModule={(mod) => setActiveModule(mod)}
          />

          <button
            onClick={fetchAllEnterpriseData}
            className={`hidden sm:flex items-center justify-center p-2 rounded-lg transition-colors border ${
              theme === 'dark'
                ? 'text-slate-400 border-slate-800 hover:text-white hover:bg-slate-800'
                : 'text-slate-400 border-transparent hover:border-slate-200 hover:text-slate-900 hover:bg-slate-100'
            }`}
            title="Refresh Data"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          
          <button
            onClick={exportProductionReadinessManifest}
            className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold shadow-md shadow-slate-900/10 transition-all active:scale-95 whitespace-nowrap"
          >
            Export Manifest
          </button>
        </div>
      </header>

      {/* Mobile Navigation - Refined Horizontal Scroller */}
      <div className="flex lg:hidden items-center gap-2 px-4 py-3 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 overflow-x-auto no-scrollbar sticky top-[61px] z-30 transition-colors duration-300">
        <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-950 rounded-xl border border-slate-200/60 dark:border-slate-800">
          {[
            { id: 'POS', label: 'POS' },
            { id: 'INVENTORY', label: 'Inventory' },
            { id: 'KDS', label: 'KDS' },
            { id: 'MIGRATIONS', label: 'DB' },
            { id: 'BACKEND_CONNECT', label: 'Network' },
            { id: 'DOCKER_CICD', label: 'Deploy' },
            { id: 'TELEMETRY', label: 'Monitor' },
            { id: 'SECURITY', label: 'Security' },
            { id: 'COST_ESTIMATOR', label: 'Cost' },
          ].map((tab) => {
            const isActive = activeModule === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveModule(tab.id as ActiveModule)}
                className={`whitespace-nowrap transition-all text-xs px-3.5 py-1.5 rounded-lg font-bold ${
                  isActive
                    ? theme === 'dark'
                      ? 'bg-slate-800 text-white shadow-sm border border-slate-700'
                      : 'bg-white text-slate-900 shadow-sm border border-slate-200/60'
                    : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      <main
        className={`flex-1 w-full mx-auto p-6 md:p-8 space-y-10 transition-all duration-300 ${
          deviceViewMode === 'MOBILE'
            ? 'max-w-[430px] border-x border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl rounded-2xl my-6'
            : deviceViewMode === 'TABLET'
            ? 'max-w-[840px] border-x border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl my-4'
            : 'max-w-[1440px]'
        }`}
      >
        {/* Global Summary Strip - Clean Metadata & Refined Typography */}
        <section className="flex flex-col lg:flex-row lg:items-end justify-between gap-8 pb-10 border-b border-slate-200 dark:border-slate-800">
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-3 text-xs font-bold tracking-tight text-slate-500 dark:text-slate-400">
              <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-100 dark:border-emerald-900/40">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="uppercase font-mono">PRODUCTION_READY</span>
              </div>
              <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">·</span>
              <div className="flex items-center gap-1.5">
                <span className="uppercase font-mono tracking-wider">STORE: {telemetrySummary.activeStore}</span>
              </div>
              <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">·</span>
              <button
                onClick={() => setIsGlobalShiftModalOpen(true)}
                className={`flex items-center gap-1.5 transition-colors group ${
                  telemetrySummary.shiftStatus === 'FINALIZED_PENDING_NEW'
                    ? 'text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${
                  telemetrySummary.shiftStatus === 'FINALIZED_PENDING_NEW' ? 'bg-amber-500 animate-pulse' : 'bg-slate-400 dark:bg-slate-600 group-hover:bg-slate-900 dark:group-hover:bg-white'
                }`} />
                <span className="uppercase font-mono tracking-wider font-bold">
                  SHIFT: {telemetrySummary.activeShift}
                </span>
                <span className="text-[10px] opacity-60 font-sans italic">
                  {telemetrySummary.shiftStatus === 'FINALIZED_PENDING_NEW' ? '(Finalized)' : '(Manage)'}
                </span>
              </button>
            </div>

            <div className="space-y-2">
              <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight [text-wrap:balance]">
                Cloud Terminal Workspace
              </h1>
              <p className="text-base text-slate-500 dark:text-slate-400 font-medium max-w-2xl leading-relaxed [text-wrap:balance]">
                Enterprise-grade POS environment with secure ledger persistence, 
                real-time telemetry, and automated compliance auditing.
              </p>
            </div>
          </div>

          {/* Standardized Atomic Financial Metric Cards - Tabular Figures Only with Animated Count-Up */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 lg:gap-16 shrink-0 border-l border-slate-100 dark:border-slate-800 lg:pl-16">
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.15em]">Net Sales</span>
              <div className="flex items-baseline gap-1 font-mono font-bold text-2xl lg:text-3xl text-slate-900 dark:text-white tabular-nums tracking-tighter">
                <AnimatedMetricValue
                  value={completedSalesSatang / 100}
                  decimals={2}
                  duration={1000}
                  formatter={(val) => val.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  prefix={<span className="text-slate-300 dark:text-slate-600 text-lg font-sans font-medium">฿</span>}
                />
              </div>
            </div>
            
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.15em]">Engine</span>
              <div className="flex items-baseline gap-2 font-mono font-bold text-2xl lg:text-3xl text-slate-900 dark:text-white tabular-nums tracking-tighter">
                <span className="text-emerald-600 dark:text-emerald-400">LIVE</span>
                <span className="text-[10px] font-bold text-emerald-600/60 uppercase tracking-widest font-sans">v4.2</span>
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.15em]">Latency</span>
              <div className="flex items-baseline gap-1 font-mono font-bold text-2xl lg:text-3xl text-slate-900 dark:text-white tabular-nums tracking-tighter">
                <AnimatedMetricValue
                  value={latestTelemetry ? latestTelemetry.p95LatencyMs : 19}
                  decimals={0}
                  duration={600}
                  suffix={<span className="text-slate-300 dark:text-slate-600 text-sm font-sans font-medium">ms</span>}
                />
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.15em]">Security</span>
              <div className="flex items-baseline gap-2 font-mono font-bold text-2xl lg:text-3xl text-slate-900 dark:text-white tabular-nums tracking-tighter">
                <AnimatedMetricValue
                  value={auditLogs.length}
                  decimals={0}
                  duration={800}
                  suffix={
                    <div className="flex items-center text-emerald-600 dark:text-emerald-400 inline-flex ml-1" title="Verified Audit Chain">
                      <ShieldCheck className="w-4 h-4" />
                    </div>
                  }
                />
              </div>
            </div>
          </div>
        </section>

        {/* Active Workspace View with AnimatePresence */}
        <div className="relative">
          {loadingInitial && products.length === 0 ? (
            <div className="py-16 text-center space-y-2">
              <div className="text-sm font-mono text-slate-400">
                กำลังโหลดสถานะฐานข้อมูลและระบบตรวจสอบความปลอดภัย PRODX...
              </div>
            </div>
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={activeModule}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                {activeModule === 'POS' && (
                  <PosTerminalWorkspace
                    products={products}
                    orders={orders}
                    onOrderCreated={() => fetchAllEnterpriseData()}
                    onOrderOverridden={() => fetchAllEnterpriseData()}
                    onStockAdjusted={() => fetchAllEnterpriseData()}
                  />
                )}

                {activeModule === 'INVENTORY' && (
                  <PredictiveInventoryConsole
                    products={products}
                    orders={orders}
                    onStockReplenished={() => fetchAllEnterpriseData()}
                  />
                )}

                {activeModule === 'CUSTOMER_DISPLAY' && (
                  <CustomerFacingDisplay isStandalone={false} />
                )}

                {activeModule === 'KDS' && (
                  <KitchenDisplayWorkspace
                    orders={orders}
                    onOrderStatusUpdated={() => fetchAllEnterpriseData()}
                  />
                )}

                {activeModule === 'MIGRATIONS' && (
                  <DatabaseMigrationConsole
                    migrations={migrations}
                    invariants={invariants}
                    onVerifyMigrations={handleVerifyMigrations}
                  />
                )}

                {activeModule === 'BACKEND_CONNECT' && (
                  <BackendConnectionView onBackendVerified={fetchAllEnterpriseData} />
                )}

                {activeModule === 'DOCKER_CICD' && <DockerCicdBlueprintView />}

                {activeModule === 'COST_ESTIMATOR' && (
                  <InfraCostEstimationView
                    initialServices={infraServices}
                    initialProviders={infraProviders}
                  />
                )}

                {activeModule === 'TELEMETRY' && (
                  <RealtimeTelemetryConsole
                    history={telemetryHistory}
                    summary={telemetrySummary}
                    latency24h={latency24h}
                    onTriggerDrill={handleTriggerDrill}
                    onRefreshData={fetchAllEnterpriseData}
                  />
                )}

                {activeModule === 'SECURITY' && (
                  <SecurityRbacAuditConsole
                    logs={auditLogs}
                    throttles={throttles}
                    orders={orders}
                    onRefreshSecurityData={fetchAllEnterpriseData}
                  />
                )}
              </motion.div>
            </AnimatePresence>
          )}
        </div>
      </main>

      {/* Global Header-Triggered Shift Lifecycle Modal */}
      <ShiftLifecycleModal
        isOpen={isGlobalShiftModalOpen}
        onClose={() => setIsGlobalShiftModalOpen(false)}
        telemetrySummary={telemetrySummary}
        onShiftUpdated={fetchAllEnterpriseData}
        orders={orders}
        auditLogs={auditLogs}
        throttles={throttles}
      />
      <AntigravityHealthCheck />
      <NetworkResilienceOverlay />
    </div>
  );
}
