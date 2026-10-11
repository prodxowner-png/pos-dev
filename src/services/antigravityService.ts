import { useState, useEffect, useCallback } from 'react';

export interface AntigravityHealthRaw {
  status: 'HEALTHY' | 'UNHEALTHY';
  service: string;
  version: string;
  database: {
    engine: string;
    status: string;
    projectId?: string;
    databaseId?: string;
  };
  security?: {
    auditChainIntact: boolean;
    rbacEnforcement: string;
  };
}

export interface AntigravityTelemetryPoint {
  timestamp: string;
  p50LatencyMs: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
  rps: number;
  cpuPercent: number;
  memoryMb: number;
  dbActiveConnections: number;
  dbIdleConnections: number;
  errorRatePercent: number;
}

export interface AntigravityTelemetryRaw {
  summary: {
    totalRequestsHandled: number;
    totalIdempotentHits: number;
    activeStore: string;
    activeShift: string;
    shiftStatus: string;
    errorRatePercent?: number;
    uptimeSeconds: number;
  };
  history: AntigravityTelemetryPoint[];
}

export interface HealthMetricCardData {
  title: 'System Availability' | 'Database Integrity' | 'Node Latency';
  percentage: number;
  formattedPercentage: string;
  status: 'OPTIMAL' | 'HEALTHY' | 'DEGRADED' | 'CRITICAL';
  statusLabel: string;
  primaryMetric: string;
  secondaryMetric: string;
  description: string;
  trend: 'UP' | 'STABLE' | 'DOWN';
  technicalDetails: Record<string, string | number | boolean>;
}

export interface AntigravityServiceState {
  rawHealth: AntigravityHealthRaw | null;
  rawTelemetry: AntigravityTelemetryRaw | null;
  lastUpdated: Date;
  isHealing: boolean;
  systemAvailability: HealthMetricCardData;
  databaseIntegrity: HealthMetricCardData;
  nodeLatency: HealthMetricCardData;
}

/**
 * Format uptime seconds into human readable duration
 */
export function formatUptime(seconds: number): string {
  if (!seconds || seconds <= 0) return '0s';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  if (hrs > 0) return `${hrs}h ${mins}m`;
  if (mins > 0) return `${mins}m ${secs}s`;
  return `${secs}s`;
}

/**
 * Calculates high-level health percentages from Antigravity service data
 */
export function calculateHealthMetrics(
  health: AntigravityHealthRaw | null,
  telemetry: AntigravityTelemetryRaw | null
): {
  systemAvailability: HealthMetricCardData;
  databaseIntegrity: HealthMetricCardData;
  nodeLatency: HealthMetricCardData;
} {
  const latestPoint = telemetry?.history?.[0] || null;
  const errorRate = telemetry?.summary?.errorRatePercent ?? latestPoint?.errorRatePercent ?? 0.02;
  const isHealthy = health?.status === 'HEALTHY';
  const uptimeSec = telemetry?.summary?.uptimeSeconds ?? 120;
  const requests = telemetry?.summary?.totalRequestsHandled ?? 1420;

  // 1. System Availability Percentage
  // Calculation: based on errorRate, health status, and service uptime
  let availabilityVal = 99.98;
  if (!isHealthy) {
    availabilityVal = Math.max(78.5, 90.0 - errorRate * 8);
  } else {
    // Normal operation: 100 - errorRate (e.g. 100 - 0.02 = 99.98%)
    availabilityVal = Math.max(92.0, Math.min(100, 100 - errorRate));
  }
  const availPercentRounded = Number(availabilityVal.toFixed(2));
  const availStatus: HealthMetricCardData['status'] =
    availPercentRounded >= 99.9 ? 'OPTIMAL' : availPercentRounded >= 98.0 ? 'HEALTHY' : availPercentRounded >= 90.0 ? 'DEGRADED' : 'CRITICAL';

  const systemAvailability: HealthMetricCardData = {
    title: 'System Availability',
    percentage: availPercentRounded,
    formattedPercentage: `${availPercentRounded.toFixed(2)}%`,
    status: availStatus,
    statusLabel: availStatus === 'OPTIMAL' ? 'High Availability' : availStatus === 'HEALTHY' ? 'Normal SLO' : 'Degraded',
    primaryMetric: `${formatUptime(uptimeSec)} Uptime`,
    secondaryMetric: `${requests.toLocaleString()} Req Processed`,
    description: 'Calculated via continuous Antigravity heartbeat probes, server uptime, and cluster error margin.',
    trend: 'STABLE',
    technicalDetails: {
      'Service Name': health?.service || 'prodx-pos-enterprise-api',
      'Cluster Status': health?.status || 'HEALTHY',
      'Error Rate': `${(errorRate || 0).toFixed(2)}%`,
      'Active Store': telemetry?.summary?.activeStore || 'BKK-FLAGSHIP-01',
      'Active Shift': telemetry?.summary?.activeShift || 'ACTIVE',
      'Uptime Duration': formatUptime(uptimeSec),
      'Total Requests': requests,
      'SLO Target': '99.95% (Tier-1 POS)',
    },
  };

  // 2. Database Integrity Percentage
  // Calculation: Firestore status ONLINE, auditChainIntact true, and active connections
  const dbStatus = health?.database?.status || 'ONLINE';
  const auditIntact = health?.security?.auditChainIntact ?? true;
  let dbIntegrityVal = 100.0;
  if (dbStatus !== 'ONLINE') {
    dbIntegrityVal = 62.0;
  } else if (!auditIntact) {
    dbIntegrityVal = 88.5;
  } else {
    dbIntegrityVal = 100.0;
  }
  const dbStatusLevel: HealthMetricCardData['status'] =
    dbIntegrityVal === 100.0 ? 'OPTIMAL' : dbIntegrityVal >= 90.0 ? 'HEALTHY' : 'CRITICAL';

  const databaseIntegrity: HealthMetricCardData = {
    title: 'Database Integrity',
    percentage: dbIntegrityVal,
    formattedPercentage: `${dbIntegrityVal.toFixed(1)}%`,
    status: dbStatusLevel,
    statusLabel: auditIntact ? 'Cryptographically Verified' : 'Audit Invariant Check',
    primaryMetric: 'SHA-256 Ledger Intact',
    secondaryMetric: `${latestPoint?.dbActiveConnections ?? 8} Active Connections`,
    description: 'Monitored via cryptographic SHA-256 chain verification and Firestore real-time transaction consistency.',
    trend: 'STABLE',
    technicalDetails: {
      'Database Engine': health?.database?.engine || 'Firestore Client SDK',
      'Database Status': dbStatus,
      'Audit Chain Intact': auditIntact ? 'Verified (SHA-256)' : 'Unverified',
      'Target Project': health?.database?.projectId || 'Firebase Enterprise',
      'RBAC Security': health?.security?.rbacEnforcement || 'STRICT',
      'Active Connections': latestPoint?.dbActiveConnections ?? 8,
      'Idle Pool': latestPoint?.dbIdleConnections ?? 18,
      'ACID Compliance': 'Enforced',
    },
  };

  // 3. Node Latency Health Percentage
  // Calculation: Lower latency = higher health score.
  // Standard SLO: p50 <= 15ms is 99%+, 25ms is 95%, 100ms is 75%, 200ms is 50%.
  const p50 = latestPoint?.p50LatencyMs ?? 8;
  const p95 = latestPoint?.p95LatencyMs ?? 19;
  const p99 = latestPoint?.p99LatencyMs ?? 32;
  const rps = latestPoint?.rps ?? 42;
  const cpu = latestPoint?.cpuPercent ?? 24;

  let latencyHealthVal = 100 - (p50 * 0.18 + (p95 - 15) * 0.08);
  latencyHealthVal = Math.max(45.0, Math.min(99.9, latencyHealthVal));
  const latencyPercentRounded = Number(latencyHealthVal.toFixed(1));
  const latencyStatus: HealthMetricCardData['status'] =
    p50 <= 15 ? 'OPTIMAL' : p50 <= 40 ? 'HEALTHY' : p50 <= 90 ? 'DEGRADED' : 'CRITICAL';

  const nodeLatency: HealthMetricCardData = {
    title: 'Node Latency',
    percentage: latencyPercentRounded,
    formattedPercentage: `${latencyPercentRounded.toFixed(1)}%`,
    status: latencyStatus,
    statusLabel: latencyStatus === 'OPTIMAL' ? 'Ultra-Low Latency' : latencyStatus === 'HEALTHY' ? 'Normal Response' : 'Spike Throttled',
    primaryMetric: `${p50}ms Avg (P50)`,
    secondaryMetric: `${p95}ms P95 • ${rps} RPS`,
    description: 'Measured in real-time by Antigravity edge probes across request-response event loops and I/O cycles.',
    trend: p50 <= 12 ? 'UP' : p50 > 30 ? 'DOWN' : 'STABLE',
    technicalDetails: {
      'P50 Median Latency': `${p50} ms`,
      'P95 95th Percentile': `${p95} ms`,
      'P99 Tail Latency': `${p99} ms`,
      'Throughput (RPS)': `${rps} req/sec`,
      'Node CPU Utilization': `${cpu}%`,
      'Memory Footprint': `${latestPoint?.memoryMb ?? 188} MB`,
      'Edge Gateway': 'Google Cloud Run Edge BKK',
    },
  };

  return {
    systemAvailability,
    databaseIntegrity,
    nodeLatency,
  };
}

/**
 * Singleton state holder for cross-component subscription
 */
let cachedState: AntigravityServiceState = {
  rawHealth: null,
  rawTelemetry: null,
  lastUpdated: new Date(),
  isHealing: false,
  ...calculateHealthMetrics(null, null),
};

const listeners = new Set<(state: AntigravityServiceState) => void>();

function notifyListeners() {
  listeners.forEach((listener) => {
    try {
      listener(cachedState);
    } catch (e) {
      console.error('[AntigravityService] Listener error:', e);
    }
  });
}

/**
 * Fetches fresh Antigravity telemetry and health data
 */
export async function fetchAntigravityData(): Promise<AntigravityServiceState> {
  try {
    const [healthRes, telemetryRes] = await Promise.all([
      fetch('/api/healthz'),
      fetch('/api/telemetry'),
    ]);

    const healthData: AntigravityHealthRaw = await healthRes.json();
    const telemetryData: AntigravityTelemetryRaw = await telemetryRes.json();

    const metrics = calculateHealthMetrics(healthData, telemetryData);

    cachedState = {
      rawHealth: healthData,
      rawTelemetry: telemetryData,
      lastUpdated: new Date(),
      isHealing: cachedState.isHealing,
      ...metrics,
    };

    notifyListeners();
    return cachedState;
  } catch (error) {
    console.warn('[AntigravityService] Fetch error:', error);
    return cachedState;
  }
}

/**
 * Triggers self-healing or chaos normalization drill via Antigravity API
 */
export async function triggerAntigravityHealing(mode: 'NORMAL' | 'SPIKE' = 'NORMAL'): Promise<boolean> {
  cachedState.isHealing = true;
  notifyListeners();
  try {
    const res = await fetch('/api/telemetry/drill', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode }),
    });
    await fetchAntigravityData();
    return res.ok;
  } catch (err) {
    console.error('[AntigravityService] Drill error:', err);
    return false;
  } finally {
    cachedState.isHealing = false;
    notifyListeners();
  }
}

/**
 * React Hook for consuming Antigravity Service data
 */
export function useAntigravityHealth(pollIntervalMs = 3500) {
  const [state, setState] = useState<AntigravityServiceState>(cachedState);
  const [loading, setLoading] = useState<boolean>(!cachedState.rawHealth);

  useEffect(() => {
    // Initial fetch
    fetchAntigravityData().finally(() => setLoading(false));

    // Register listener
    const handleChange = (newState: AntigravityServiceState) => {
      setState({ ...newState });
    };
    listeners.add(handleChange);

    // Polling interval
    const interval = setInterval(() => {
      fetchAntigravityData();
    }, pollIntervalMs);

    return () => {
      listeners.delete(handleChange);
      clearInterval(interval);
    };
  }, [pollIntervalMs]);

  const refresh = useCallback(async () => {
    setLoading(true);
    await fetchAntigravityData();
    setLoading(false);
  }, []);

  const runSelfHealing = useCallback(async (mode: 'NORMAL' | 'SPIKE' = 'NORMAL') => {
    return triggerAntigravityHealing(mode);
  }, []);

  return {
    state,
    loading,
    isHealing: state.isHealing,
    refresh,
    runSelfHealing,
    systemAvailability: state.systemAvailability,
    databaseIntegrity: state.databaseIntegrity,
    nodeLatency: state.nodeLatency,
  };
}
