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

type ActiveModule = 'POS' | 'MIGRATIONS' | 'BACKEND_CONNECT' | 'DOCKER_CICD' | 'COST_ESTIMATOR' | 'TELEMETRY' | 'SECURITY';
type DeviceViewMode = 'AUTO' | 'MOBILE' | 'TABLET' | 'DESKTOP';

export default function App() {
  const [activeModule, setActiveModule] = useState<ActiveModule>('POS');
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
        setOrders(ordData.orders || []);
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

  // Poll real-time telemetry every 4 seconds
  useEffect(() => {
    const timer = setInterval(async () => {
      try {
        const res = await fetch('/api/telemetry');
        if (res.ok) {
          const data = await res.json();
          setTelemetryHistory(data.history || []);
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

  const latestTelemetry = telemetryHistory[telemetryHistory.length - 1];

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 flex flex-col max-w-full overflow-x-hidden min-w-0 font-sans selection:bg-emerald-100 selection:text-emerald-900">
      {/* Header Bar - Strict Enterprise Elevation & Alignment */}
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-40 px-6 py-3.5 flex items-center justify-between gap-4 max-w-full overflow-hidden">
        {/* Brand Zone: Single text element wordmark */}
        <div className="flex items-center gap-4 shrink-0">
          <a
            href="/"
            onClick={(e) => {
              e.preventDefault();
              setActiveModule('POS');
            }}
            className="text-xl font-bold tracking-tight text-slate-900 whitespace-nowrap hover:opacity-80 transition-opacity"
          >
            PRODX
          </a>
        </div>

        {/* Zone 2: Main Navigation Links - Refined Segmented Control */}
        <nav className="hidden lg:flex items-center gap-1 p-1 bg-slate-100 rounded-xl border border-slate-200/60">
          {[
            { id: 'POS', label: 'POS' },
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
                className={`whitespace-nowrap transition-all px-4 py-1.5 rounded-lg text-sm font-medium ${
                  isActive
                    ? 'bg-white text-slate-900 shadow-sm border border-slate-200/60'
                    : 'text-slate-500 hover:text-slate-900 hover:bg-white/60'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Primary Actions & Device Selection */}
        <div className="flex items-center gap-3 shrink-0">
          {/* Device Switcher - Refined */}
          <div className="hidden xl:flex items-center p-1 bg-slate-100 rounded-lg border border-slate-200/60">
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
                    ? 'bg-white text-emerald-600 shadow-sm border border-slate-200/40' 
                    : 'text-slate-400 hover:text-slate-600'
                }`}
                title={d.title}
              >
                <d.icon className="w-3.5 h-3.5" />
              </button>
            ))}
          </div>

          <button
            onClick={fetchAllEnterpriseData}
            className="hidden sm:flex items-center justify-center p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors border border-transparent hover:border-slate-200"
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
      <div className="flex lg:hidden items-center gap-2 px-4 py-3 bg-white border-b border-slate-200 overflow-x-auto no-scrollbar sticky top-[61px] z-30">
        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl border border-slate-200/60">
          {[
            { id: 'POS', label: 'POS' },
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
                    ? 'bg-white text-slate-900 shadow-sm border border-slate-200/60'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      <main
        className={`flex-1 w-full mx-auto p-6 md:p-8 space-y-10 transition-all ${
          deviceViewMode === 'MOBILE'
            ? 'max-w-[430px] border-x border-slate-200 bg-white shadow-2xl rounded-2xl my-6'
            : deviceViewMode === 'TABLET'
            ? 'max-w-[840px] border-x border-slate-200 bg-white shadow-xl my-4'
            : 'max-w-[1440px]'
        }`}
      >
        {/* Global Summary Strip - Clean Metadata & Refined Typography */}
        <section className="flex flex-col lg:flex-row lg:items-end justify-between gap-8 pb-10 border-b border-slate-200">
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-3 text-xs font-bold tracking-tight text-slate-500">
              <div className="flex items-center gap-1.5 text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="uppercase font-mono">PRODUCTION_READY</span>
              </div>
              <span aria-hidden="true" className="text-slate-300">·</span>
              <div className="flex items-center gap-1.5">
                <span className="uppercase font-mono tracking-wider">STORE: {telemetrySummary.activeStore}</span>
              </div>
              <span aria-hidden="true" className="text-slate-300">·</span>
              <button
                onClick={() => setIsGlobalShiftModalOpen(true)}
                className={`flex items-center gap-1.5 transition-colors group ${
                  telemetrySummary.shiftStatus === 'FINALIZED_PENDING_NEW'
                    ? 'text-amber-600 hover:text-amber-700'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${
                  telemetrySummary.shiftStatus === 'FINALIZED_PENDING_NEW' ? 'bg-amber-500 animate-pulse' : 'bg-slate-400 group-hover:bg-slate-900'
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
              <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 tracking-tight [text-wrap:balance]">
                Cloud Terminal Workspace
              </h1>
              <p className="text-base text-slate-500 font-medium max-w-2xl leading-relaxed [text-wrap:balance]">
                Enterprise-grade POS environment with secure ledger persistence, 
                real-time telemetry, and automated compliance auditing.
              </p>
            </div>
          </div>

          {/* Standardized Atomic Financial Metric Cards - Tabular Figures Only */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 lg:gap-16 shrink-0 border-l border-slate-100 lg:pl-16">
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.15em]">Net Sales</span>
              <div className="flex items-baseline gap-1 font-mono font-bold text-2xl lg:text-3xl text-slate-900 tabular-nums tracking-tighter">
                <span className="text-slate-300 text-lg font-sans font-medium">฿</span>
                <span>{(completedSalesSatang / 100).toLocaleString('th-TH', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
            
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.15em]">Engine</span>
              <div className="flex items-baseline gap-2 font-mono font-bold text-2xl lg:text-3xl text-slate-900 tabular-nums tracking-tighter">
                <span className="text-emerald-600">LIVE</span>
                <span className="text-[10px] font-bold text-emerald-600/60 uppercase tracking-widest font-sans">v4.2</span>
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.15em]">Latency</span>
              <div className="flex items-baseline gap-1 font-mono font-bold text-2xl lg:text-3xl text-slate-900 tabular-nums tracking-tighter">
                <span>{latestTelemetry ? latestTelemetry.p95LatencyMs : '19'}</span>
                <span className="text-slate-300 text-sm font-sans font-medium">ms</span>
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.15em]">Security</span>
              <div className="flex items-baseline gap-2 font-mono font-bold text-2xl lg:text-3xl text-slate-900 tabular-nums tracking-tighter">
                <span>{auditLogs.length}</span>
                <div className="flex items-center text-emerald-600" title="Verified Audit Chain">
                  <ShieldCheck className="w-4 h-4" />
                </div>
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
                    onTriggerDrill={handleTriggerDrill}
                    onRefreshData={fetchAllEnterpriseData}
                  />
                )}

                {activeModule === 'SECURITY' && (
                  <SecurityRbacAuditConsole
                    logs={auditLogs}
                    throttles={throttles}
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
      />
      <AntigravityHealthCheck />
    </div>
  );
}
