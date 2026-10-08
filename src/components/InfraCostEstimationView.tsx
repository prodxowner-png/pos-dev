import React, { useState, useMemo } from 'react';
import {
  Calculator,
  Server,
  Cloud,
  DollarSign,
  TrendingDown,
  Sliders,
  Layers,
  ArrowRight,
  ShieldCheck,
  RotateCcw,
  Download,
} from 'lucide-react';
import {
  CloudProviderId,
  ServiceResourceAllocation,
  CloudPricingUnit,
  ServiceCostLine,
  InfraEstimateResult,
  formatSatangToThb,
} from '../types/prodx';

interface InfraCostEstimationViewProps {
  initialServices?: ServiceResourceAllocation[];
  initialProviders?: CloudPricingUnit[];
}

const DEFAULT_SERVICES: ServiceResourceAllocation[] = [
  {
    id: 'prodx-app',
    name: 'prodx-pos-app (Stateless Node.js + React)',
    containerImage: 'ghcr.io/prodx-org/prodx-pos:latest',
    role: 'API_FRONTEND',
    instances: 2,
    cpuCores: 1,
    memoryGb: 2,
    storageGb: 10,
    storageType: 'EPHEMERAL',
    networkEgressGbMonthly: 120,
    highAvailability: true,
  },
  {
    id: 'postgres-primary',
    name: 'postgres-primary (PostgreSQL 16 HA)',
    containerImage: 'postgres:16-alpine',
    role: 'DATABASE',
    instances: 2,
    cpuCores: 2,
    memoryGb: 4,
    storageGb: 80,
    storageType: 'PERSISTENT_SSD',
    networkEgressGbMonthly: 40,
    highAvailability: true,
  },
  {
    id: 'redis-cache',
    name: 'redis-cache (Redis 7 In-Memory AOF)',
    containerImage: 'redis:7-alpine',
    role: 'CACHE',
    instances: 1,
    cpuCores: 0.5,
    memoryGb: 1,
    storageGb: 10,
    storageType: 'PERSISTENT_SSD',
    networkEgressGbMonthly: 15,
    highAvailability: false,
  },
  {
    id: 'prometheus-telemetry',
    name: 'prometheus (Monitoring & Metrics Engine)',
    containerImage: 'prom/prometheus:v2.51.0',
    role: 'OBSERVABILITY',
    instances: 1,
    cpuCores: 0.5,
    memoryGb: 1,
    storageGb: 40,
    storageType: 'PERSISTENT_SSD',
    networkEgressGbMonthly: 25,
    highAvailability: false,
  },
];

const DEFAULT_PROVIDERS: CloudPricingUnit[] = [
  {
    providerId: 'GCP_CLOUD_RUN',
    providerName: 'Google Cloud Platform (Cloud Run + Cloud SQL)',
    region: 'asia-southeast1 (Bangkok / Singapore)',
    currencyThbRate: 35.5,
    vcpuPerHourUsd: 0.024,
    ramGbPerHourUsd: 0.0035,
    storageSsdGbPerMonthUsd: 0.17,
    egressGbUsd: 0.08,
    managedPostgresBaseFeeUsd: 15.0,
    managedRedisBaseFeeUsd: 8.0,
    slaPercent: 99.99,
  },
  {
    providerId: 'AWS_ECS_FARGATE',
    providerName: 'Amazon Web Services (ECS Fargate + RDS Aurora)',
    region: 'ap-southeast-1 (Singapore)',
    currencyThbRate: 35.5,
    vcpuPerHourUsd: 0.0275,
    ramGbPerHourUsd: 0.0038,
    storageSsdGbPerMonthUsd: 0.19,
    egressGbUsd: 0.09,
    managedPostgresBaseFeeUsd: 22.0,
    managedRedisBaseFeeUsd: 12.0,
    slaPercent: 99.99,
  },
  {
    providerId: 'AZURE_CONTAINER_APPS',
    providerName: 'Microsoft Azure (Container Apps + Flexible Postgres)',
    region: 'southeastasia (Singapore)',
    currencyThbRate: 35.5,
    vcpuPerHourUsd: 0.026,
    ramGbPerHourUsd: 0.0036,
    storageSsdGbPerMonthUsd: 0.18,
    egressGbUsd: 0.085,
    managedPostgresBaseFeeUsd: 18.0,
    managedRedisBaseFeeUsd: 9.5,
    slaPercent: 99.95,
  },
  {
    providerId: 'RAILWAY_ENTERPRISE',
    providerName: 'Railway Enterprise Cloud (Container PaaS)',
    region: 'ap-southeast (Singapore)',
    currencyThbRate: 35.5,
    vcpuPerHourUsd: 0.021,
    ramGbPerHourUsd: 0.0031,
    storageSsdGbPerMonthUsd: 0.15,
    egressGbUsd: 0.05,
    managedPostgresBaseFeeUsd: 10.0,
    managedRedisBaseFeeUsd: 5.0,
    slaPercent: 99.95,
  },
];

export const InfraCostEstimationView: React.FC<InfraCostEstimationViewProps> = ({
  initialServices,
  initialProviders,
}) => {
  const [services, setServices] = useState<ServiceResourceAllocation[]>(
    initialServices && initialServices.length > 0 ? initialServices : DEFAULT_SERVICES
  );
  const [providers] = useState<CloudPricingUnit[]>(
    initialProviders && initialProviders.length > 0 ? initialProviders : DEFAULT_PROVIDERS
  );

  const [selectedProviderId, setSelectedProviderId] = useState<CloudProviderId>('GCP_CLOUD_RUN');
  const [commitmentPlan, setCommitmentPlan] = useState<'ON_DEMAND' | 'ONE_YEAR_RESERVED' | 'THREE_YEAR_RESERVED'>(
    'ON_DEMAND'
  );
  const [projectedMonthlyTransactions, setProjectedMonthlyTransactions] = useState<number>(65000);
  const [branchStoresCount, setBranchStoresCount] = useState<number>(3);

  const hoursPerMonth = 730;

  const activeProvider = useMemo(() => {
    return providers.find((p) => p.providerId === selectedProviderId) || providers[0];
  }, [providers, selectedProviderId]);

  // Commitment discount rate: On-Demand 0%, 1-Year 28%, 3-Year 45%
  const reserveDiscount = useMemo(() => {
    if (commitmentPlan === 'ONE_YEAR_RESERVED') return 0.28;
    if (commitmentPlan === 'THREE_YEAR_RESERVED') return 0.45;
    return 0;
  }, [commitmentPlan]);

  // Compute breakdown per service based on current allocation and provider rates
  const estimation: InfraEstimateResult = useMemo(() => {
    const p = activeProvider;
    let rawTotalMonthlyUsd = 0;

    const lines: ServiceCostLine[] = services.map((svc) => {
      const totalCores = svc.cpuCores * svc.instances;
      const totalRam = svc.memoryGb * svc.instances;

      const computeCostUsd = totalCores * p.vcpuPerHourUsd * hoursPerMonth;
      const ramCostUsd = totalRam * p.ramGbPerHourUsd * hoursPerMonth;
      const storageCostUsd = svc.storageGb * p.storageSsdGbPerMonthUsd;
      const egressCostUsd = svc.networkEgressGbMonthly * p.egressGbUsd;

      let baseManagedFee = 0;
      if (svc.role === 'DATABASE') baseManagedFee = p.managedPostgresBaseFeeUsd;
      if (svc.role === 'CACHE') baseManagedFee = p.managedRedisBaseFeeUsd;

      const rawServiceTotal = computeCostUsd + ramCostUsd + storageCostUsd + egressCostUsd + baseManagedFee;
      const discountedServiceTotal = rawServiceTotal * (1 - reserveDiscount);

      rawTotalMonthlyUsd += discountedServiceTotal;

      return {
        serviceId: svc.id,
        name: svc.name,
        role: svc.role,
        computeCostUsd,
        ramCostUsd,
        storageCostUsd,
        egressCostUsd,
        totalServiceMonthlyUsd: discountedServiceTotal,
        totalServiceMonthlyThb: discountedServiceTotal * p.currencyThbRate,
        costSharePercent: 0, // computed below
      };
    });

    const linesWithShare = lines.map((l) => ({
      ...l,
      costSharePercent: rawTotalMonthlyUsd > 0 ? (l.totalServiceMonthlyUsd / rawTotalMonthlyUsd) * 100 : 0,
    }));

    const monthlyTotalUsd = rawTotalMonthlyUsd;
    const monthlyTotalThb = monthlyTotalUsd * p.currencyThbRate;
    const annualTotalUsd = monthlyTotalUsd * 12;
    const annualTotalThb = monthlyTotalThb * 12;

    // Cost per transaction in Satang
    const safeTxCount = Math.max(1, projectedMonthlyTransactions);
    const costPerTransactionThb = monthlyTotalThb / safeTxCount;
    const costPerTransactionSatang = Math.round(costPerTransactionThb * 100);

    return {
      provider: p,
      hoursPerMonth,
      lineItems: linesWithShare,
      monthlyTotalUsd,
      monthlyTotalThb,
      annualTotalUsd,
      annualTotalThb,
      costPerTransactionSatang,
      projectedTransactionsMonthly: safeTxCount,
      reserveDiscountAppliedPercent: reserveDiscount * 100,
    };
  }, [services, activeProvider, reserveDiscount, projectedMonthlyTransactions]);

  // Quick allocation modifier
  const handleUpdateInstances = (serviceId: string, delta: number) => {
    setServices((prev) =>
      prev.map((s) => {
        if (s.id !== serviceId) return s;
        const next = Math.max(1, Math.min(16, s.instances + delta));
        return { ...s, instances: next };
      })
    );
  };

  const handleUpdateCores = (serviceId: string, cores: number) => {
    setServices((prev) =>
      prev.map((s) => (s.id === serviceId ? { ...s, cpuCores: cores } : s))
    );
  };

  const handleUpdateMemory = (serviceId: string, memoryGb: number) => {
    setServices((prev) =>
      prev.map((s) => (s.id === serviceId ? { ...s, memoryGb: memoryGb } : s))
    );
  };

  const handleResetToDefault = () => {
    setServices(DEFAULT_SERVICES);
    setSelectedProviderId('GCP_CLOUD_RUN');
    setCommitmentPlan('ON_DEMAND');
    setProjectedMonthlyTransactions(65000);
    setBranchStoresCount(3);
  };

  const exportTcoReport = () => {
    const reportData = {
      title: 'PRODX Enterprise Infrastructure Cost Projection (TCO Audit)',
      generatedAt: new Date().toISOString(),
      architecture: 'Docker Compose Microservices (App, Postgres, Redis, Prometheus)',
      provider: activeProvider.providerName,
      region: activeProvider.region,
      commitmentTier: commitmentPlan,
      exchangeRate: `${activeProvider.currencyThbRate} THB/USD`,
      projectedMonthlyTransactions,
      branchStoresCount,
      estimatedMonthlyUsd: Number(estimation.monthlyTotalUsd.toFixed(2)),
      estimatedMonthlyThb: Number(estimation.monthlyTotalThb.toFixed(2)),
      estimatedAnnualThb: Number(estimation.annualTotalThb.toFixed(2)),
      costPerTransactionThb: (estimation.costPerTransactionSatang / 100).toFixed(4),
      costPerTransactionSatang: estimation.costPerTransactionSatang,
      breakdownByMicroservice: estimation.lineItems.map((item) => ({
        service: item.name,
        role: item.role,
        monthlyUsd: Number(item.totalServiceMonthlyUsd.toFixed(2)),
        monthlyThb: Number(item.totalServiceMonthlyThb.toFixed(2)),
        sharePercentage: Number(item.costSharePercent.toFixed(1)),
      })),
    };

    const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `prodx-infra-cost-estimate-${selectedProviderId.toLowerCase()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-8 max-w-full overflow-hidden">
      {/* Header & Export Strip */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8 pb-10 border-b border-slate-200">
        <div className="min-w-0 flex items-center gap-6">
          <div className="p-4 bg-indigo-50 rounded-2xl shrink-0 border border-indigo-100/50">
            <Calculator className="w-8 h-8 text-indigo-600" />
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-3 text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">
              <span className="text-indigo-600">Financial Modeling</span>
              <span aria-hidden="true" className="text-slate-200">/</span>
              <span>TCO Projection</span>
            </div>
            <h2 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight [text-wrap:balance]">
              Infrastructure Cost Engine
            </h2>
            <p className="text-sm md:text-base text-slate-500 font-medium leading-relaxed max-w-2xl [text-wrap:balance]">
              Projected hosting costs based on microservices orchestration, commitment tiers, 
              and regional currency fluctuation modeling.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={handleResetToDefault}
            className="px-5 py-2.5 bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-2 shadow-sm active:scale-95"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Reset</span>
          </button>
          <button
            onClick={exportTcoReport}
            className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg active:scale-95"
          >
            <Download className="w-4 h-4" />
            <span>Export TCO</span>
          </button>
        </div>
      </div>

      {/* Top Controls: Cloud Provider & Commitment Plan Selector */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Provider Cards (8 Cols) */}
        <div className="lg:col-span-8 space-y-4">
          <label className="text-xs text-slate-500 font-bold uppercase tracking-wider block px-1">
            Cloud Provider Model
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {providers.map((p) => {
              const isSelected = p.providerId === selectedProviderId;
              return (
                <button
                  key={p.providerId}
                  onClick={() => setSelectedProviderId(p.providerId)}
                  className={`p-5 text-left rounded-2xl border transition-all ${
                    isSelected
                      ? 'bg-slate-900 border-slate-900 text-white shadow-lg ring-4 ring-slate-900/5'
                      : 'bg-white border-slate-200 hover:border-slate-400'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-sm font-bold truncate ${isSelected ? 'text-white' : 'text-slate-900'}`}>{p.providerName}</span>
                    <Cloud className={`w-4 h-4 shrink-0 ${isSelected ? 'text-emerald-400' : 'text-slate-400'}`} />
                  </div>
                  <div className={`text-[11px] font-mono mb-3 ${isSelected ? 'text-slate-400' : 'text-slate-500'}`}>{p.region}</div>
                  <div className={`text-[10px] font-mono tabular-nums flex items-center gap-2 ${isSelected ? 'text-slate-500' : 'text-slate-400'}`}>
                    <span className="px-1.5 py-0.5 bg-slate-800/50 rounded border border-white/10 tracking-tighter">${p.vcpuPerHourUsd}/vCPU-hr</span>
                    <span>·</span>
                    <span>SLA {p.slaPercent}%</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Commitment & Business Volume Controls (4 Cols) */}
        <div className="lg:col-span-4 bg-white border border-slate-200 rounded-2xl p-6 space-y-6 shadow-sm">
          <div>
            <label className="text-[10px] text-slate-400 font-bold uppercase tracking-widest block mb-3 px-1">
              Reserved Savings
            </label>
            <div className="grid grid-cols-3 gap-1 bg-slate-100/80 p-1.5 rounded-xl border border-slate-200/60">
              {(['ON_DEMAND', 'ONE_YEAR_RESERVED', 'THREE_YEAR_RESERVED'] as const).map((plan) => (
                <button
                  key={plan}
                  onClick={() => setCommitmentPlan(plan)}
                  className={`py-2 text-[9px] font-bold uppercase tracking-wider rounded-lg transition-all ${
                    commitmentPlan === plan
                      ? 'bg-white text-slate-900 shadow-sm border border-slate-200/50'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {plan === 'ON_DEMAND' ? 'On-Demand' : plan === 'ONE_YEAR_RESERVED' ? '1 Year' : '3 Years'}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">
              <span>Transactions/mo</span>
              <span className="font-mono tabular-nums text-slate-900">{projectedMonthlyTransactions.toLocaleString()}</span>
            </div>
            <input
              type="range"
              min="10000"
              max="300000"
              step="5000"
              value={projectedMonthlyTransactions}
              onChange={(e) => setProjectedMonthlyTransactions(Number(e.target.value))}
              className="w-full accent-slate-900 h-1 bg-slate-100 rounded-lg cursor-pointer"
            />
          </div>

          <div className="space-y-3 pt-2">
            <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">
              <span>Store Branches</span>
              <span className="font-mono tabular-nums text-slate-900">{branchStoresCount}</span>
            </div>
            <input
              type="range"
              min="1"
              max="20"
              step="1"
              value={branchStoresCount}
              onChange={(e) => setBranchStoresCount(Number(e.target.value))}
              className="w-full accent-slate-900 h-1 bg-slate-100 rounded-lg cursor-pointer"
            />
          </div>
        </div>
      </div>

      {/* Main KPI Summary Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="p-6 bg-white border border-slate-200 rounded-2xl shadow-sm group hover:border-emerald-200 transition-colors">
          <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">
            <span>Monthly Hosting</span>
            <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg group-hover:bg-emerald-600 group-hover:text-white transition-colors">
              <DollarSign className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 mb-1">
            ฿{estimation.monthlyTotalThb.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-slate-500 font-medium font-mono tabular-nums">
            ${estimation.monthlyTotalUsd.toFixed(2)} USD / mo
          </div>
        </div>

        <div className="p-6 bg-white border border-slate-200 rounded-2xl shadow-sm group hover:border-slate-400 transition-colors">
          <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">
            <span>Annual TCO</span>
            <div className="p-1.5 bg-slate-50 text-slate-400 rounded-lg group-hover:bg-slate-900 group-hover:text-white transition-colors">
              <Calculator className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 mb-1">
            ฿{estimation.annualTotalThb.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-slate-500 font-medium font-mono tabular-nums">
            ${estimation.annualTotalUsd.toFixed(2)} USD / yr
          </div>
        </div>

        <div className="p-6 bg-white border border-slate-200 rounded-2xl shadow-sm group hover:border-emerald-200 transition-colors">
          <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">
            <span>Cost Per Order</span>
            <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg group-hover:bg-emerald-600 group-hover:text-white transition-colors">
              <TrendingDown className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-emerald-600 mb-1">
            {formatSatangToThb(estimation.costPerTransactionSatang)}
          </div>
          <div className="text-[11px] text-slate-500 font-medium uppercase tracking-tight">
            {estimation.costPerTransactionSatang} satang / sale
          </div>
        </div>

        <div className="p-6 bg-white border border-slate-200 rounded-2xl shadow-sm group hover:border-indigo-200 transition-colors">
          <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">
            <span>Savings Tier</span>
            <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg group-hover:bg-indigo-600 group-hover:text-white transition-colors">
              <ShieldCheck className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 mb-1 uppercase tracking-tighter">
            {estimation.reserveDiscountAppliedPercent > 0 ? `SAVE ${estimation.reserveDiscountAppliedPercent}%` : 'Standard'}
          </div>
          <div className="text-[11px] text-slate-500 font-medium uppercase tracking-widest">
            {commitmentPlan === 'ON_DEMAND' ? 'Pay as you go' : 'Reserved Term'}
          </div>
        </div>
      </div>

      {/* Two Column Layout: Microservice Resource Adjuster & Cost Line Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left 7 Cols: Interactive Resource Allocation Matrix */}
        <div className="lg:col-span-7 space-y-6">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <Sliders className="w-5 h-5 text-indigo-500" />
              Resource Allocation Matrix
            </h3>
            <span className="text-[10px] font-bold font-mono text-slate-400 uppercase tracking-widest px-2 py-1 bg-slate-100 rounded-md">
              {services.length} Microservices
            </span>
          </div>

          <div className="space-y-4">
            {services.map((svc) => (
              <div
                key={svc.id}
                className="p-6 bg-white border border-slate-200 rounded-2xl space-y-6 hover:border-indigo-200 transition-all shadow-sm"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="px-1.5 py-0.5 bg-slate-100 text-slate-600 text-[9px] font-bold rounded-md uppercase tracking-widest border border-slate-200">{svc.role}</span>
                      <h4 className="text-base font-bold text-slate-800">{svc.name.split(' (')[0]}</h4>
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono italic">{svc.containerImage}</div>
                  </div>

                  {/* Instance Multiplier */}
                  <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-xl border border-slate-200">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-2">Instances</span>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleUpdateInstances(svc.id, -1)}
                        disabled={svc.instances <= 1}
                        className="w-8 h-8 text-slate-900 bg-white hover:bg-slate-50 border border-slate-200 disabled:opacity-30 rounded-lg text-sm flex items-center justify-center font-bold shadow-sm transition-all active:scale-95"
                      >
                        -
                      </button>
                      <span className="w-8 text-center font-mono tabular-nums text-sm font-bold text-slate-900">
                        {svc.instances}
                      </span>
                      <button
                        onClick={() => handleUpdateInstances(svc.id, 1)}
                        disabled={svc.instances >= 16}
                        className="w-8 h-8 text-slate-900 bg-white hover:bg-slate-50 border border-slate-200 disabled:opacity-30 rounded-lg text-sm flex items-center justify-center font-bold shadow-sm transition-all active:scale-95"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>

                {/* Resource sliders for CPU, Memory and Storage */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                  <div className="space-y-3">
                    <div className="flex justify-between text-[11px] font-bold text-slate-400 uppercase tracking-widest px-1">
                      <span>vCPU Cores</span>
                      <span className="font-mono tabular-nums text-indigo-600">{svc.cpuCores} cores</span>
                    </div>
                    <div className="flex gap-1.5 p-1 bg-slate-50 rounded-xl border border-slate-200/60">
                      {[0.5, 1, 2, 4].map((c) => (
                        <button
                          key={c}
                          onClick={() => handleUpdateCores(svc.id, c)}
                          className={`flex-1 py-1.5 font-mono text-[10px] font-bold rounded-lg transition-all ${
                            svc.cpuCores === c 
                              ? 'bg-white text-indigo-600 shadow-sm border border-indigo-100 ring-2 ring-indigo-500/10' 
                              : 'text-slate-400 hover:text-slate-600 hover:bg-white/50'
                          }`}
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex justify-between text-[11px] font-bold text-slate-400 uppercase tracking-widest px-1">
                      <span>RAM Memory</span>
                      <span className="font-mono tabular-nums text-indigo-600">{svc.memoryGb} GB</span>
                    </div>
                    <div className="flex gap-1.5 p-1 bg-slate-50 rounded-xl border border-slate-200/60">
                      {[1, 2, 4, 8].map((m) => (
                        <button
                          key={m}
                          onClick={() => handleUpdateMemory(svc.id, m)}
                          className={`flex-1 py-1.5 font-mono text-[10px] font-bold rounded-lg transition-all ${
                            svc.memoryGb === m 
                              ? 'bg-white text-indigo-600 shadow-sm border border-indigo-100 ring-2 ring-indigo-500/10' 
                              : 'text-slate-400 hover:text-slate-600 hover:bg-white/50'
                          }`}
                        >
                          {m}G
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2 bg-slate-50 p-4 rounded-xl border border-slate-200/80 flex flex-col justify-center">
                    <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                      <span>SSD / Network</span>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <div className="text-[11px] font-bold text-slate-700 flex items-center justify-between">
                        <span>Persistence</span>
                        <span className="font-mono">{svc.storageGb} GB</span>
                      </div>
                      <div className="text-[11px] font-medium text-slate-400 flex items-center justify-between">
                        <span>Egress</span>
                        <span className="font-mono">{svc.networkEgressGbMonthly} GB</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right 5 Cols: Cost Share & Monthly Line Item Invoice */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-6 space-y-6 shadow-sm sticky top-20">
          <div className="flex items-center justify-between border-b border-slate-100 pb-5">
            <h3 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <Layers className="w-5 h-5 text-indigo-500" />
              Bill Component Breakdown
            </h3>
            <span className="text-[9px] font-bold font-mono text-slate-400 px-2 py-1 bg-slate-50 rounded border border-slate-200 uppercase tracking-widest">
              35.5 THB/USD
            </span>
          </div>

          {/* Microservice Share Bars */}
          <div className="space-y-5">
            {estimation.lineItems.map((item) => (
              <div key={item.serviceId} className="space-y-2.5">
                <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-widest px-0.5">
                  <span className="text-slate-500 truncate max-w-[160px]">{item.name.split(' ')[0]}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400 text-[10px] font-medium">{item.costSharePercent.toFixed(1)}%</span>
                    <span className="text-slate-900 font-mono tabular-nums tracking-tighter">
                      ฿{item.totalServiceMonthlyThb.toFixed(2)}
                    </span>
                  </div>
                </div>
                <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden flex">
                  <div
                    className="bg-slate-900 h-full rounded-full transition-all duration-500 ease-out"
                    style={{ width: `${Math.max(4, item.costSharePercent)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Detailed Itemized Costs Table */}
          <div className="space-y-4 pt-6 border-t border-slate-100">
            <div className="flex justify-between text-[11px] font-bold text-slate-400 uppercase tracking-widest px-1">
              <span>Cloud Infrastructure Item</span>
              <span className="text-right">Monthly (USD)</span>
            </div>
            
            <div className="space-y-3 px-1">
              {[
                { label: 'Compute Engine / Fargate', value: estimation.lineItems.reduce((acc, i) => acc + i.computeCostUsd, 0) },
                { label: 'RAM / Memory Allocation', value: estimation.lineItems.reduce((acc, i) => acc + i.ramCostUsd, 0) },
                { label: 'Persistent SSD / Block Storage', value: estimation.lineItems.reduce((acc, i) => acc + i.storageCostUsd, 0) },
                { label: 'Network Ingress & Egress', value: estimation.lineItems.reduce((acc, i) => acc + i.egressCostUsd, 0) },
              ].map((row, idx) => (
                <div key={idx} className="flex justify-between text-xs font-medium text-slate-600 group">
                  <span className="group-hover:text-slate-900 transition-colors">{row.label}</span>
                  <span className="font-mono tabular-nums text-slate-800 font-bold">${row.value.toFixed(2)}</span>
                </div>
              ))}
            </div>

            {estimation.reserveDiscountAppliedPercent > 0 && (
              <div className="flex justify-between text-[10px] font-bold text-emerald-600 bg-emerald-50 px-3 py-2 rounded-lg border border-emerald-100 uppercase tracking-widest animate-in fade-in slide-in-from-top-2 duration-300">
                <span>Commitment Tier Discount</span>
                <span className="font-mono tabular-nums">-{estimation.reserveDiscountAppliedPercent}% Applied</span>
              </div>
            )}

            <div className="flex justify-between items-baseline pt-4 border-t border-slate-100">
              <span className="text-sm font-bold text-slate-900 tracking-tight uppercase">Monthly Total</span>
              <div className="text-right">
                <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 tracking-tighter">
                  ฿{estimation.monthlyTotalThb.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                  VAT 7% Estimated: ฿{(estimation.monthlyTotalThb * 0.07).toFixed(2)}
                </div>
              </div>
            </div>
          </div>

          {/* Cloud Architectural Advice Callout */}
          <div className="p-5 bg-indigo-50/50 border border-indigo-100 rounded-2xl space-y-3 leading-relaxed shadow-inner">
            <div className="flex items-center gap-2 text-[10px] font-bold text-indigo-900 uppercase tracking-widest">
              <Server className="w-4 h-4 text-indigo-600 shrink-0" />
              <span>Architectural Strategy</span>
            </div>
            <p className="text-xs text-indigo-800 font-medium leading-relaxed">
              For {branchStoresCount} branches processing ~{projectedMonthlyTransactions.toLocaleString()} orders/mo, 
              stateless containers on a PaaS runtime offer ~38% better TCO than serverless models due to sustained DB connection pooling.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
