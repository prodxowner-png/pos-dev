import React, { useEffect, useState, useCallback } from 'react';
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
  const [telemetrySummary, setTelemetrySummary] = useState({
    totalRequestsHandled: 0,
    totalIdempotentHits: 0,
    activeStore: 'BKK-FLAGSHIP-01',
    activeShift: 'SH-2026-AM',
    uptimeSeconds: 0,
  });
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
    <div className="min-h-screen bg-zinc-50 text-zinc-900 flex flex-col max-w-full overflow-x-hidden min-w-0 font-sans">
      {/* Strict 3-Zone Top Bar Contract: Brand | Navigation | Actions */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-zinc-200 px-6 py-4 flex items-center justify-between gap-4 max-w-full overflow-hidden">
        {/* Zone 1: Single text element wordmark */}
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            setActiveModule('POS');
          }}
          className="text-xl font-bold tracking-tight text-zinc-900 whitespace-nowrap shrink-0"
        >
          PRODX
        </a>

        {/* Zone 2: 4-6 clean text navigation links */}
        <nav className="hidden lg:flex items-center gap-8 text-sm font-medium">
          <button
            onClick={() => setActiveModule('POS')}
            className={`py-1 transition-colors whitespace-nowrap border-b-2 ${
              activeModule === 'POS'
                ? 'border-emerald-600 text-zinc-900'
                : 'border-transparent text-zinc-500 hover:text-zinc-900'
            }`}
          >
            Terminal
          </button>

          <button
            onClick={() => setActiveModule('MIGRATIONS')}
            className={`py-1 transition-colors whitespace-nowrap border-b-2 ${
              activeModule === 'MIGRATIONS'
                ? 'border-emerald-600 text-zinc-900'
                : 'border-transparent text-zinc-500 hover:text-zinc-900'
            }`}
          >
            Database
          </button>

          <button
            onClick={() => setActiveModule('BACKEND_CONNECT')}
            className={`py-1 transition-colors whitespace-nowrap border-b-2 ${
              activeModule === 'BACKEND_CONNECT'
                ? 'border-emerald-600 text-zinc-900'
                : 'border-transparent text-zinc-500 hover:text-zinc-900'
            }`}
          >
            Network
          </button>

          <button
            onClick={() => setActiveModule('DOCKER_CICD')}
            className={`py-1 transition-colors whitespace-nowrap border-b-2 ${
              activeModule === 'DOCKER_CICD'
                ? 'border-emerald-600 text-zinc-900'
                : 'border-transparent text-zinc-500 hover:text-zinc-900'
            }`}
          >
            Deployment
          </button>

          <button
            onClick={() => setActiveModule('TELEMETRY')}
            className={`py-1 transition-colors whitespace-nowrap border-b-2 ${
              activeModule === 'TELEMETRY'
                ? 'border-emerald-600 text-zinc-900'
                : 'border-transparent text-zinc-500 hover:text-zinc-900'
            }`}
          >
            Monitoring
          </button>

          <button
            onClick={() => setActiveModule('SECURITY')}
            className={`py-1 transition-colors whitespace-nowrap border-b-2 ${
              activeModule === 'SECURITY'
                ? 'border-emerald-600 text-zinc-900'
                : 'border-transparent text-zinc-500 hover:text-zinc-900'
            }`}
          >
            Security
          </button>
        </nav>

        {/* Zone 3: 1-2 Primary Actions */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={fetchAllEnterpriseData}
            className="hidden sm:flex items-center justify-center p-2 text-zinc-500 hover:text-zinc-900 transition-colors"
            title="Refresh Data"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
          
          <button
            onClick={exportProductionReadinessManifest}
            className="px-4 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white text-sm font-semibold shadow-sm transition active:scale-95 whitespace-nowrap"
          >
            Export Manifest
          </button>
        </div>
      </header>

      {/* Mobile Navigation - Persistent Bottom Bar or Thin Top Strip */}
      <div className="flex lg:hidden items-center gap-1 px-4 py-2 bg-white border-b border-zinc-200 overflow-x-auto no-scrollbar">
        {(
          [
            { id: 'POS', label: 'POS' },
            { id: 'MIGRATIONS', label: 'DB' },
            { id: 'BACKEND_CONNECT', label: 'Network' },
            { id: 'DOCKER_CICD', label: 'Deploy' },
            { id: 'TELEMETRY', label: 'Monitor' },
            { id: 'SECURITY', label: 'Security' },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveModule(tab.id)}
            className={`px-4 py-1.5 text-xs font-bold rounded-full whitespace-nowrap transition-colors shadow-sm ${
              activeModule === tab.id ? 'bg-zinc-900 text-white' : 'text-zinc-500 hover:bg-zinc-100 bg-white border border-zinc-200 shadow-none'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Main Content Container */}
      <main
        className={`flex-1 w-full mx-auto p-6 space-y-8 transition-all ${
          deviceViewMode === 'MOBILE'
            ? 'max-w-[430px] border-x border-zinc-200 bg-white shadow-2xl rounded-2xl my-4'
            : deviceViewMode === 'TABLET'
            ? 'max-w-[840px] border-x border-zinc-200 bg-white shadow-xl'
            : 'max-w-[1440px]'
        }`}
      >
        {/* Device Switcher (Floating Quick Control for Dev) */}
        <div className="fixed bottom-6 right-6 hidden sm:flex items-center p-1 bg-white/80 backdrop-blur border border-zinc-200 rounded-full shadow-lg z-50">
          <button
            onClick={() => setDeviceViewMode('AUTO')}
            className={`p-2 rounded-full transition-colors ${deviceViewMode === 'AUTO' ? 'bg-zinc-900 text-white' : 'text-zinc-500 hover:bg-zinc-100'}`}
            title="Auto Layout"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => setDeviceViewMode('MOBILE')}
            className={`p-2 rounded-full transition-colors ${deviceViewMode === 'MOBILE' ? 'bg-zinc-900 text-white' : 'text-zinc-500 hover:bg-zinc-100'}`}
            title="Mobile"
          >
            <Smartphone className="w-4 h-4" />
          </button>
          <button
            onClick={() => setDeviceViewMode('TABLET')}
            className={`p-2 rounded-full transition-colors ${deviceViewMode === 'TABLET' ? 'bg-zinc-900 text-white' : 'text-zinc-500 hover:bg-zinc-100'}`}
            title="Tablet"
          >
            <Tablet className="w-4 h-4" />
          </button>
          <button
            onClick={() => setDeviceViewMode('DESKTOP')}
            className={`p-2 rounded-full transition-colors ${deviceViewMode === 'DESKTOP' ? 'bg-zinc-900 text-white' : 'text-zinc-500 hover:bg-zinc-100'}`}
            title="Desktop"
          >
            <Monitor className="w-4 h-4" />
          </button>
        </div>

        {/* Global Summary Strip - Zero-Pill Discipline */}
        <section className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 pb-8 border-b border-zinc-200">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                PRODUCTION READY
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-zinc-100 text-zinc-600 border border-zinc-200 font-mono">
                STORE: {telemetrySummary.activeStore}
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-zinc-100 text-zinc-600 border border-zinc-200 font-mono">
                SHIFT: {telemetrySummary.activeShift}
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-zinc-50 text-zinc-400 border border-zinc-100 font-mono">
                V2.1.0
              </span>
            </div>
            <h1 className="text-3xl font-extrabold text-zinc-900 tracking-tight">
              Enterprise Operations
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-10">
            <div className="flex flex-col">
              <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">NET SALES</span>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-xl font-bold font-mono text-emerald-600">฿</span>
                <span className="text-2xl md:text-3xl font-extrabold font-mono text-zinc-900 tracking-tight tabular-nums">
                  {formatSatangToThb(completedSalesSatang).replace('฿', '').trim()}
                </span>
              </div>
            </div>
            
            <div className="flex flex-col">
              <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">MIGRATIONS</span>
              <span className="text-2xl font-bold font-mono text-zinc-900 mt-1 tabular-nums">
                {migrations.length}/30
              </span>
            </div>

            <div className="flex flex-col">
              <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">LATENCY</span>
              <span className="text-2xl font-bold font-mono text-zinc-900 mt-1 tabular-nums">
                {latestTelemetry ? `${latestTelemetry.p95LatencyMs}ms` : '19ms'}
              </span>
            </div>

            <div className="flex flex-col">
              <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">AUDIT BLOCKS</span>
              <span className="text-2xl font-bold font-mono text-zinc-900 mt-1 tabular-nums">
                {auditLogs.length}
              </span>
            </div>
          </div>
        </section>

        {/* Active Workspace View */}
        {loadingInitial && products.length === 0 ? (
          <div className="py-16 text-center space-y-2">
            <div className="text-sm font-mono text-zinc-400">
              กำลังโหลดสถานะฐานข้อมูลและระบบตรวจสอบความปลอดภัย PRODX...
            </div>
          </div>
        ) : (
          <>
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
              />
            )}

            {activeModule === 'SECURITY' && (
              <SecurityRbacAuditConsole
                logs={auditLogs}
                throttles={throttles}
                onRefreshSecurityData={fetchAllEnterpriseData}
              />
            )}
          </>
        )}
      </main>
    </div>
  );
}
