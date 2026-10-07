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
    <div className="space-y-8">
      {/* Header & Export Strip */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-zinc-200">
        <div>
          <h2 className="text-xl font-bold text-zinc-900 tracking-tight">
            01. Cloud Infrastructure TCO Estimator
          </h2>
          <p className="text-sm text-zinc-600 mt-2 leading-relaxed">
            Projected hosting costs based on <code className="bg-zinc-100 px-1 rounded text-zinc-900">docker-compose.yml</code> microservices architecture (Node.js App, PostgreSQL 16 HA, Redis 7, Prometheus).
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleResetToDefault}
            className="px-4 py-2 bg-white hover:bg-zinc-50 text-zinc-600 border border-zinc-200 text-xs font-bold rounded-xl transition-all flex items-center gap-2 shadow-sm active:scale-95"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Reset</span>
          </button>
          <button
            onClick={exportTcoReport}
            className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-2 shadow-md active:scale-95"
          >
            <Download className="w-4 h-4" />
            <span>Export Report</span>
          </button>
        </div>
      </div>

      {/* Top Controls: Cloud Provider & Commitment Plan Selector */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Provider Cards (8 Cols) */}
        <div className="lg:col-span-8 space-y-4">
          <label className="text-xs text-zinc-500 font-bold uppercase tracking-wider block px-1">
            Cloud Provider Model
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {providers.map((p) => {
              const isSelected = p.providerId === selectedProviderId;
              return (
                <button
                  key={p.providerId}
                  onClick={() => setSelectedProviderId(p.providerId)}
                  className={`p-4 text-left rounded-xl border transition-all ${
                    isSelected
                      ? 'bg-zinc-900 border-zinc-900 text-white shadow-lg'
                      : 'bg-white border-zinc-200 hover:border-zinc-400'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-sm font-bold truncate ${isSelected ? 'text-white' : 'text-zinc-900'}`}>{p.providerName}</span>
                    <Cloud className={`w-4 h-4 shrink-0 ${isSelected ? 'text-emerald-400' : 'text-zinc-400'}`} />
                  </div>
                  <div className={`text-[11px] font-mono mt-1 ${isSelected ? 'text-zinc-400' : 'text-zinc-500'}`}>{p.region}</div>
                  <div className={`text-[11px] font-mono tabular-nums mt-2 flex items-center gap-2 ${isSelected ? 'text-zinc-500' : 'text-zinc-400'}`}>
                    <span>${p.vcpuPerHourUsd}/vCPU-hr</span>
                    <span>·</span>
                    <span>SLA {p.slaPercent}%</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Commitment & Business Volume Controls (4 Cols) */}
        <div className="lg:col-span-4 bg-white border border-zinc-200 rounded-xl p-5 space-y-4 shadow-sm">
          <div>
            <label className="text-xs text-zinc-500 font-bold uppercase tracking-wider block mb-2">
              Reserved Savings
            </label>
            <div className="grid grid-cols-3 gap-1 bg-zinc-100 p-1 rounded-lg">
              <button
                onClick={() => setCommitmentPlan('ON_DEMAND')}
                className={`py-1.5 text-[10px] font-bold uppercase tracking-wider rounded transition-all ${
                  commitmentPlan === 'ON_DEMAND'
                    ? 'bg-white text-zinc-900 shadow-sm'
                    : 'text-zinc-500 hover:text-zinc-700'
                }`}
              >
                On-Demand
              </button>
              <button
                onClick={() => setCommitmentPlan('ONE_YEAR_RESERVED')}
                className={`py-1.5 text-[10px] font-bold uppercase tracking-wider rounded transition-all ${
                  commitmentPlan === 'ONE_YEAR_RESERVED'
                    ? 'bg-white text-zinc-900 shadow-sm'
                    : 'text-zinc-500 hover:text-zinc-700'
                }`}
              >
                1 Year
              </button>
              <button
                onClick={() => setCommitmentPlan('THREE_YEAR_RESERVED')}
                className={`py-1.5 text-[10px] font-bold uppercase tracking-wider rounded transition-all ${
                  commitmentPlan === 'THREE_YEAR_RESERVED'
                    ? 'bg-white text-zinc-900 shadow-sm'
                    : 'text-zinc-500 hover:text-zinc-700'
                }`}
              >
                3 Years
              </button>
            </div>
          </div>

          <div>
            <div className="flex justify-between text-xs font-bold text-zinc-500 mb-2">
              <span className="uppercase tracking-wider">Transactions/mo</span>
              <span className="font-mono tabular-nums text-zinc-900">{projectedMonthlyTransactions.toLocaleString()}</span>
            </div>
            <input
              type="range"
              min="10000"
              max="300000"
              step="5000"
              value={projectedMonthlyTransactions}
              onChange={(e) => setProjectedMonthlyTransactions(Number(e.target.value))}
              className="w-full accent-zinc-900 h-1.5 bg-zinc-200 rounded-lg cursor-pointer"
            />
          </div>

          <div>
            <div className="flex justify-between text-xs font-bold text-zinc-500 mb-2">
              <span className="uppercase tracking-wider">Store Branches</span>
              <span className="font-mono tabular-nums text-zinc-900">{branchStoresCount}</span>
            </div>
            <input
              type="range"
              min="1"
              max="20"
              step="1"
              value={branchStoresCount}
              onChange={(e) => setBranchStoresCount(Number(e.target.value))}
              className="w-full accent-zinc-900 h-1.5 bg-zinc-200 rounded-lg cursor-pointer"
            />
          </div>
        </div>
      </div>

      {/* Main KPI Summary Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 bg-white border border-zinc-200 rounded-xl shadow-sm space-y-2">
          <div className="flex items-center justify-between text-[11px] font-bold text-zinc-500 uppercase tracking-widest">
            <span>Monthly Hosting</span>
            <DollarSign className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-xl font-bold font-mono tabular-nums text-emerald-600">
            ฿{estimation.monthlyTotalThb.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-zinc-500 font-medium font-mono tabular-nums">
            ${estimation.monthlyTotalUsd.toFixed(2)} USD / mo
          </div>
        </div>

        <div className="p-5 bg-white border border-zinc-200 rounded-xl shadow-sm space-y-2">
          <div className="flex items-center justify-between text-[11px] font-bold text-zinc-500 uppercase tracking-widest">
            <span>Annual TCO</span>
            <Calculator className="w-4 h-4 text-zinc-400" />
          </div>
          <div className="text-xl font-bold font-mono tabular-nums text-zinc-900">
            ฿{estimation.annualTotalThb.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-zinc-500 font-medium font-mono tabular-nums">
            ${estimation.annualTotalUsd.toFixed(2)} USD / yr
          </div>
        </div>

        <div className="p-5 bg-white border border-zinc-200 rounded-xl shadow-sm space-y-2">
          <div className="flex items-center justify-between text-[11px] font-bold text-zinc-500 uppercase tracking-widest">
            <span>Cost Per Order</span>
            <TrendingDown className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-xl font-bold font-mono tabular-nums text-emerald-600">
            {formatSatangToThb(estimation.costPerTransactionSatang)}
          </div>
          <div className="text-[11px] text-zinc-500 font-medium">
            {estimation.costPerTransactionSatang} satang per sale
          </div>
        </div>

        <div className="p-5 bg-white border border-zinc-200 rounded-xl shadow-sm space-y-2">
          <div className="flex items-center justify-between text-[11px] font-bold text-zinc-500 uppercase tracking-widest">
            <span>Savings Tier</span>
            <ShieldCheck className="w-4 h-4 text-zinc-400" />
          </div>
          <div className="text-xl font-bold font-mono tabular-nums text-zinc-900">
            {estimation.reserveDiscountAppliedPercent > 0 ? `SAVE ${estimation.reserveDiscountAppliedPercent}%` : 'ON-DEMAND (0%)'}
          </div>
          <div className="text-[11px] text-zinc-500 font-medium uppercase tracking-wider">
            {commitmentPlan === 'ON_DEMAND' ? 'Pay as you go' : 'Reserved instance pricing'}
          </div>
        </div>
      </div>

      {/* Two Column Layout: Microservice Resource Adjuster & Cost Line Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left 7 Cols: Interactive Resource Allocation Matrix */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <Sliders className="w-5 h-5 text-zinc-900" />
              <h3 className="text-base font-bold text-zinc-900 tracking-tight">
                Resource Allocation Matrix
              </h3>
            </div>
            <span className="text-[10px] font-bold font-mono text-zinc-400 uppercase tracking-widest">{services.length} Microservices</span>
          </div>

          <div className="space-y-4">
            {services.map((svc) => (
              <div
                key={svc.id}
                className="p-5 bg-white border border-zinc-200 rounded-xl space-y-4 hover:border-zinc-400 transition-colors shadow-sm"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-100 pb-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-700 text-[10px] font-bold rounded uppercase tracking-wider border border-emerald-100">{svc.role}</span>
                      <h4 className="text-sm font-bold text-zinc-900">{svc.name}</h4>
                    </div>
                    <div className="text-[11px] text-zinc-500 font-mono">Image: {svc.containerImage}</div>
                  </div>

                  {/* Instance Multiplier */}
                  <div className="flex items-center gap-2 bg-zinc-100 p-1 rounded-lg border border-zinc-200">
                    <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider px-2">Replicas</span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleUpdateInstances(svc.id, -1)}
                        disabled={svc.instances <= 1}
                        className="w-7 h-7 text-zinc-900 bg-white hover:bg-zinc-50 border border-zinc-200 disabled:opacity-30 rounded-md text-xs flex items-center justify-center font-bold shadow-sm"
                      >
                        -
                      </button>
                      <span className="w-8 text-center font-mono tabular-nums text-xs font-bold text-zinc-900">
                        {svc.instances}
                      </span>
                      <button
                        onClick={() => handleUpdateInstances(svc.id, 1)}
                        disabled={svc.instances >= 16}
                        className="w-7 h-7 text-zinc-900 bg-white hover:bg-zinc-50 border border-zinc-200 disabled:opacity-30 rounded-md text-xs flex items-center justify-center font-bold shadow-sm"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>

                {/* Resource sliders for CPU, Memory and Storage */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className="space-y-1">
                    <div className="flex justify-between text-zinc-400">
                      <span>vCPU Cores</span>
                      <span className="font-mono tabular-nums text-zinc-200">{svc.cpuCores} cores</span>
                    </div>
                    <div className="flex gap-1">
                      {[0.5, 1, 2, 4].map((c) => (
                        <button
                          key={c}
                          onClick={() => handleUpdateCores(svc.id, c)}
                          className={`flex-1 py-1 font-mono text-[11px] rounded transition-colors ${
                            svc.cpuCores === c ? 'bg-emerald-600 text-white' : 'bg-zinc-50 text-zinc-400 hover:text-white'
                          }`}
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-zinc-400">
                      <span>RAM Memory</span>
                      <span className="font-mono tabular-nums text-zinc-200">{svc.memoryGb} GB</span>
                    </div>
                    <div className="flex gap-1">
                      {[1, 2, 4, 8].map((m) => (
                        <button
                          key={m}
                          onClick={() => handleUpdateMemory(svc.id, m)}
                          className={`flex-1 py-1 font-mono text-[11px] rounded transition-colors ${
                            svc.memoryGb === m ? 'bg-emerald-600 text-white' : 'bg-zinc-50 text-zinc-400 hover:text-white'
                          }`}
                        >
                          {m}G
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1 bg-zinc-50/60 p-2 rounded border border-zinc-200/60 flex flex-col justify-center">
                    <div className="flex justify-between text-[11px] text-zinc-400">
                      <span>Disk & Egress</span>
                      <span className="font-mono text-zinc-300">{svc.storageGb} GB SSD</span>
                    </div>
                    <div className="text-[11px] text-zinc-400 font-mono mt-0.5">
                      Network: {svc.networkEgressGbMonthly} GB/เดือน
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right 5 Cols: Cost Share & Monthly Line Item Invoice */}
        <div className="lg:col-span-5 bg-white border border-zinc-200 rounded-xl p-6 space-y-6 shadow-sm sticky top-20">
          <div className="flex items-center justify-between border-b border-zinc-100 pb-4">
            <div className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-zinc-900" />
              <h3 className="text-base font-bold text-zinc-900 tracking-tight">Component Breakdown</h3>
            </div>
            <span className="text-[10px] font-bold font-mono text-zinc-400 uppercase tracking-widest">
              Rate: 35.5 THB/$
            </span>
          </div>

          {/* Microservice Share Bars */}
          <div className="space-y-4">
            {estimation.lineItems.map((item) => (
              <div key={item.serviceId} className="space-y-2">
                <div className="flex justify-between text-[11px] font-bold uppercase tracking-tight">
                  <span className="text-zinc-500 truncate max-w-[200px]">{item.name.split(' ')[0]}</span>
                  <span className="text-zinc-900 font-mono tabular-nums">
                    ฿{item.totalServiceMonthlyThb.toFixed(2)} ({item.costSharePercent.toFixed(1)}%)
                  </span>
                </div>
                <div className="w-full bg-zinc-100 h-2 rounded-full overflow-hidden flex">
                  <div
                    className="bg-zinc-900 h-full rounded-full transition-all duration-300"
                    style={{ width: `${Math.max(4, item.costSharePercent)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Detailed Itemized Costs Table */}
          <div className="space-y-3 pt-4 border-t border-zinc-100">
            <div className="flex justify-between text-xs font-medium text-zinc-600">
              <span>Compute Processing</span>
              <span className="font-mono tabular-nums text-zinc-900 font-bold">
                ${estimation.lineItems.reduce((acc, i) => acc + i.computeCostUsd, 0).toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between text-xs font-medium text-zinc-600">
              <span>RAM Provisioning</span>
              <span className="font-mono tabular-nums text-zinc-900 font-bold">
                ${estimation.lineItems.reduce((acc, i) => acc + i.ramCostUsd, 0).toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between text-xs font-medium text-zinc-600">
              <span>SSD Storage</span>
              <span className="font-mono tabular-nums text-zinc-900 font-bold">
                ${estimation.lineItems.reduce((acc, i) => acc + i.storageCostUsd, 0).toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between text-xs font-medium text-zinc-600">
              <span>Network Egress</span>
              <span className="font-mono tabular-nums text-zinc-900 font-bold">
                ${estimation.lineItems.reduce((acc, i) => acc + i.egressCostUsd, 0).toFixed(2)}
              </span>
            </div>

            {estimation.reserveDiscountAppliedPercent > 0 && (
              <div className="flex justify-between text-xs font-bold text-emerald-600 pt-1">
                <span>COMMITMENT DISCOUNT</span>
                <span className="font-mono tabular-nums">-{estimation.reserveDiscountAppliedPercent}%</span>
              </div>
            )}

            <div className="flex justify-between text-base font-bold text-zinc-900 pt-4 border-t border-zinc-100">
              <span className="tracking-tight">Monthly Total</span>
              <span className="font-mono tabular-nums text-emerald-600">
                ฿{estimation.monthlyTotalThb.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          {/* Cloud Architectural Advice Callout */}
          <div className="p-4 bg-zinc-50 border border-zinc-200 rounded-xl space-y-2 leading-relaxed">
            <div className="flex items-center gap-2 text-[10px] font-bold text-zinc-900 uppercase tracking-widest">
              <Server className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>Cost Strategy Advice</span>
            </div>
            <p className="text-xs text-zinc-600 font-normal">
              For {branchStoresCount} branches processing ~{projectedMonthlyTransactions.toLocaleString()} orders/mo, 
              stateless containers on a PaaS runtime offer ~38% better TCO than per-invocation serverless models due to sustained DB connection pooling.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
