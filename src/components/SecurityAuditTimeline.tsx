import React, { useState, useMemo } from 'react';
import {
  Shield,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  Flame,
  KeyRound,
  Lock,
  Unlock,
  Fingerprint,
  Activity,
  Clock,
  Terminal,
  Hash,
  Eye,
  RefreshCw,
  Zap,
  SlidersHorizontal,
  X,
  ChevronRight,
  TrendingUp,
} from 'lucide-react';
import { AuditLogRecord, LoginThrottleRecord } from '../types/prodx';

export interface AuthCluster {
  id: string;
  label: string;
  severity: 'CRITICAL' | 'HIGH' | 'ELEVATED' | 'NOMINAL';
  startTime: string;
  endTime: string;
  durationSeconds: number;
  totalAttempts: number;
  failedCount: number;
  successCount: number;
  peakVelocity: number; // attempts per minute
  targetIdentities: string[];
  sourceIps: string[];
  peakRiskScore: number;
  logIds: string[];
  primaryVector: string;
  isLockoutEnforced: boolean;
}

interface SecurityAuditTimelineProps {
  logs: AuditLogRecord[];
  throttles: LoginThrottleRecord[];
  selectedClusterId: string | null;
  onSelectCluster: (cluster: AuthCluster | null) => void;
  selectedLogId: string | null;
  onSelectLog: (logId: string | null) => void;
  onRefreshData: () => Promise<void>;
}

// Compute individual risk score for an audit log
export function computeLogRiskScore(log: AuditLogRecord): number {
  const act = log.action.toUpperCase();
  const det = log.details.toLowerCase();

  if (act.includes('IMMUTABILITY') || det.includes('tamper') || det.includes('trigger block')) {
    return 95;
  }
  if (det.includes('lockout') || act.includes('LOCKOUT')) {
    return 90;
  }
  if (act.includes('LOGIN_FAILED') || det.includes('failed login') || det.includes('invalid credential')) {
    return 75;
  }
  if (act.includes('PIN_OVERRIDE') || act.includes('ORDER_VOID') || det.includes('override')) {
    return 55;
  }
  if (act.includes('THROTTLE_RESET')) {
    return 30;
  }
  if (act.includes('WEBAUTHN') || act.includes('BIOMETRIC')) {
    return 20;
  }
  if (log.resourceType === 'AUTH_SECURITY' || act.includes('AUTH') || act.includes('LOGIN')) {
    return 25;
  }
  if (log.resourceType === 'INVENTORY' && act.includes('ADJUST')) {
    return 20;
  }
  return 5;
}

export const SecurityAuditTimeline: React.FC<SecurityAuditTimelineProps> = ({
  logs,
  throttles,
  selectedClusterId,
  onSelectCluster,
  selectedLogId,
  onSelectLog,
  onRefreshData,
}) => {
  const [viewMode, setViewMode] = useState<'TEMPORAL' | 'SEQUENCE'>('TEMPORAL');
  const [riskFilter, setRiskFilter] = useState<'ALL' | 'HIGH_RISK_ONLY' | 'AUTH_ONLY'>('ALL');
  const [isSimulatingBurst, setIsSimulatingBurst] = useState(false);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);
  const [activeForensicCluster, setActiveForensicCluster] = useState<AuthCluster | null>(null);

  // Chronologically sorted logs (ascending: oldest to newest for graph plotting)
  const chronologicalLogs = useMemo(() => {
    return [...logs].sort((a, b) => {
      const timeDiff = new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
      if (timeDiff !== 0) return timeDiff;
      return a.sequenceNo - b.sequenceNo;
    });
  }, [logs]);

  // Cluster Detection Engine: Identifies bursts of authentication attempts
  const detectedClusters = useMemo<AuthCluster[]>(() => {
    if (chronologicalLogs.length === 0) return [];

    const clusters: AuthCluster[] = [];
    const authLogs = chronologicalLogs.filter(
      (l) =>
        l.resourceType === 'AUTH_SECURITY' ||
        l.action.includes('LOGIN') ||
        l.action.includes('AUTH') ||
        l.action.includes('PIN') ||
        l.action.includes('OVERRIDE') ||
        l.action.includes('IMMUTABILITY') ||
        l.details.toLowerCase().includes('failed login')
    );

    if (authLogs.length === 0) return [];

    let currentBatch: AuditLogRecord[] = [];

    for (let i = 0; i < authLogs.length; i++) {
      const current = authLogs[i];

      if (currentBatch.length === 0) {
        currentBatch.push(current);
        continue;
      }

      const prev = currentBatch[currentBatch.length - 1];
      const timeDeltaSec = Math.abs(
        (new Date(current.timestamp).getTime() - new Date(prev.timestamp).getTime()) / 1000
      );

      // Same cluster if within 15 minutes or matching target/IP with high risk
      const isCloseInTime = timeDeltaSec <= 900;
      const isRelatedTarget =
        current.resourceId === prev.resourceId || current.ipAddress === prev.ipAddress;

      if (isCloseInTime && isRelatedTarget) {
        currentBatch.push(current);
      } else {
        // Evaluate batch
        if (currentBatch.length >= 2 || currentBatch.some((l) => computeLogRiskScore(l) >= 70)) {
          clusters.push(buildClusterRecord(currentBatch, clusters.length + 1));
        }
        currentBatch = [current];
      }
    }

    if (currentBatch.length >= 2 || currentBatch.some((l) => computeLogRiskScore(l) >= 70)) {
      clusters.push(buildClusterRecord(currentBatch, clusters.length + 1));
    }

    return clusters;
  }, [chronologicalLogs]);

  function buildClusterRecord(batch: AuditLogRecord[], idx: number): AuthCluster {
    const start = batch[0];
    const end = batch[batch.length - 1];
    const startTime = start.timestamp;
    const endTime = end.timestamp;
    const durationSeconds = Math.max(
      1,
      Math.round((new Date(endTime).getTime() - new Date(startTime).getTime()) / 1000)
    );

    const failedCount = batch.filter(
      (l) =>
        l.action.includes('LOGIN_FAILED') ||
        l.details.toLowerCase().includes('failed login') ||
        l.details.toLowerCase().includes('tamper')
    ).length;

    const successCount = batch.length - failedCount;
    const durationMinutes = Math.max(0.1, durationSeconds / 60);
    const peakVelocity = parseFloat((batch.length / durationMinutes).toFixed(1));

    const targetIdentities = Array.from(new Set(batch.map((l) => l.resourceId)));
    const sourceIps = Array.from(new Set(batch.map((l) => l.ipAddress)));
    const scores = batch.map(computeLogRiskScore);
    const peakRiskScore = Math.max(...scores);

    const isLockoutEnforced = batch.some(
      (l) => l.details.toLowerCase().includes('lockout') || l.action.includes('LOCKOUT')
    );

    let severity: AuthCluster['severity'] = 'NOMINAL';
    let primaryVector = 'Routine Access Verification';

    if (isLockoutEnforced || failedCount >= 4 || peakRiskScore >= 90) {
      severity = 'CRITICAL';
      primaryVector = 'High-Frequency Credential Stuffing / Brute-Force Spray';
    } else if (failedCount >= 2 || peakRiskScore >= 70) {
      severity = 'HIGH';
      primaryVector = 'Repeated Password Guessing Anomaly';
    } else if (batch.some((l) => l.action.includes('OVERRIDE') || l.action.includes('VOID'))) {
      severity = 'ELEVATED';
      primaryVector = 'Privilege Escalation / Supervisor Override Cluster';
    }

    return {
      id: `CL-${String(idx).padStart(2, '0')}`,
      label: `Cluster #${idx}`,
      severity,
      startTime,
      endTime,
      durationSeconds,
      totalAttempts: batch.length,
      failedCount,
      successCount,
      peakVelocity,
      targetIdentities,
      sourceIps,
      peakRiskScore,
      logIds: batch.map((l) => l.id),
      primaryVector,
      isLockoutEnforced,
    };
  }

  // Filtered logs for display based on active user filter
  const displayLogs = useMemo(() => {
    return chronologicalLogs.filter((log) => {
      const risk = computeLogRiskScore(log);
      if (riskFilter === 'HIGH_RISK_ONLY') {
        return risk >= 50;
      }
      if (riskFilter === 'AUTH_ONLY') {
        return (
          log.resourceType === 'AUTH_SECURITY' ||
          log.action.includes('LOGIN') ||
          log.action.includes('AUTH') ||
          log.action.includes('OVERRIDE') ||
          log.action.includes('PIN')
        );
      }
      return true;
    });
  }, [chronologicalLogs, riskFilter]);

  // Graph Layout Math
  const graphDimensions = {
    width: 1000,
    height: 260,
    paddingTop: 36,
    paddingBottom: 40,
    paddingLeft: 56,
    paddingRight: 40,
  };

  const plotArea = {
    width: graphDimensions.width - graphDimensions.paddingLeft - graphDimensions.paddingRight,
    height: graphDimensions.height - graphDimensions.paddingTop - graphDimensions.paddingBottom,
  };

  // Coordinates mapping
  const logCoordinates = useMemo(() => {
    if (displayLogs.length === 0) return [];

    const minTime =
      displayLogs.length > 0 ? new Date(displayLogs[0].timestamp).getTime() : Date.now() - 3600000;
    const maxTime =
      displayLogs.length > 0
        ? new Date(displayLogs[displayLogs.length - 1].timestamp).getTime()
        : Date.now();
    const timeSpan = Math.max(60000, maxTime - minTime);

    return displayLogs.map((log, index) => {
      let x = 0;
      if (viewMode === 'TEMPORAL') {
        const t = new Date(log.timestamp).getTime();
        const ratio = (t - minTime) / timeSpan;
        x = graphDimensions.paddingLeft + ratio * plotArea.width;
      } else {
        // Sequence index layout
        const ratio = displayLogs.length > 1 ? index / (displayLogs.length - 1) : 0.5;
        x = graphDimensions.paddingLeft + ratio * plotArea.width;
      }

      const risk = computeLogRiskScore(log);
      // y-coordinate: Risk 0 at bottom, Risk 100 at top
      const y =
        graphDimensions.paddingTop +
        plotArea.height -
        (risk / 100) * plotArea.height;

      // Check if inside any cluster
      const parentCluster = detectedClusters.find((c) => c.logIds.includes(log.id));

      return {
        log,
        x,
        y,
        risk,
        cluster: parentCluster,
      };
    });
  }, [displayLogs, viewMode, detectedClusters, plotArea, graphDimensions]);

  // SVG Area / Path generator
  const trendPathData = useMemo(() => {
    if (logCoordinates.length < 2) return '';
    const points = logCoordinates.map((pt) => `${pt.x},${pt.y}`);
    return `M ${points.join(' L ')}`;
  }, [logCoordinates]);

  const areaFillData = useMemo(() => {
    if (logCoordinates.length < 2) return '';
    const first = logCoordinates[0];
    const last = logCoordinates[logCoordinates.length - 1];
    const baselineY = graphDimensions.paddingTop + plotArea.height;
    return `M ${first.x},${baselineY} L ${logCoordinates
      .map((pt) => `${pt.x},${pt.y}`)
      .join(' L ')} L ${last.x},${baselineY} Z`;
  }, [logCoordinates, graphDimensions, plotArea]);

  // Cluster Zones on SVG
  const clusterRegions = useMemo(() => {
    return detectedClusters.map((cluster) => {
      const clusterPoints = logCoordinates.filter((pt) => cluster.logIds.includes(pt.log.id));
      if (clusterPoints.length === 0) return null;

      const xs = clusterPoints.map((p) => p.x);
      const minX = Math.max(graphDimensions.paddingLeft, Math.min(...xs) - 18);
      const maxX = Math.min(
        graphDimensions.width - graphDimensions.paddingRight,
        Math.max(...xs) + 18
      );
      const width = Math.max(36, maxX - minX);

      return {
        cluster,
        minX,
        width,
        centerY: graphDimensions.paddingTop + 14,
      };
    }).filter(Boolean);
  }, [detectedClusters, logCoordinates, graphDimensions]);

  // Trigger rapid burst simulation
  const handleTriggerBurstAttack = async () => {
    setIsSimulatingBurst(true);
    try {
      await fetch('/api/security/simulate-cluster-attack', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identity: 'cashier.demo@prodx.co.th',
          attackerIp: '10.24.0.89',
          count: 5,
        }),
      });
      await onRefreshData();
    } catch (err) {
      console.error('Failed to trigger burst attack:', err);
    } finally {
      setIsSimulatingBurst(false);
    }
  };

  const handleResetSentinel = async () => {
    try {
      await fetch('/api/security/simulate-login-attempt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identity: 'cashier.demo@prodx.co.th',
          simulateFailure: false,
        }),
      });
      await onRefreshData();
    } catch (err) {
      console.error('Failed to reset sentinel:', err);
    }
  };

  const activeClusterObj = useMemo(() => {
    if (!selectedClusterId) return null;
    return detectedClusters.find((c) => c.id === selectedClusterId) || null;
  }, [selectedClusterId, detectedClusters]);

  const activeHoveredPoint = useMemo(() => {
    if (!hoveredNodeId) return null;
    return logCoordinates.find((p) => p.log.id === hoveredNodeId) || null;
  }, [hoveredNodeId, logCoordinates]);

  // Total summary numbers
  const highRiskClusterCount = detectedClusters.filter(
    (c) => c.severity === 'CRITICAL' || c.severity === 'HIGH'
  ).length;

  return (
    <div className="space-y-6">
      {/* Executive SecOps Header & Graph Controls */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6 pb-6 border-b border-slate-100">
          <div className="space-y-1.5 min-w-0">
            <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
              <span className="font-bold text-emerald-600">วิเคราะห์ข้อมูลเรียงลำดับ</span>
              <span aria-hidden="true">·</span>
              <span>หน้าต่างเวลา 15 นาที</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono text-slate-400">SHA-256 Chained</span>
            </div>
            <h3 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
              <span>ไทม์ไลน์ความปลอดภัย & กราฟกลุ่มภัยคุกคาม (Threat Cluster Graph)</span>
              {highRiskClusterCount > 0 && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                  <Flame className="w-3.5 h-3.5 animate-pulse" />
                  <span>ตรวจพบ {highRiskClusterCount} กลุ่มภัยคุกคามความเสี่ยงสูง</span>
                </span>
              )}
            </h3>
            <p className="text-xs text-slate-500 font-medium max-w-2xl leading-relaxed">
              การจับคู่บล็อกประวัติแบบเรียงตามเวลา พร้อมวิเคราะห์อัตราความถี่ (Velocity Analysis), 
              ตรวจจับการโจมตีแบบ Brute-Force อัตโนมัติ และติดตามการระงับสิทธิ์บัญชี
            </p>
          </div>

          {/* Quick Interactive Actions */}
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            {/* View Mode Toggle */}
            <div className="flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => setViewMode('TEMPORAL')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  viewMode === 'TEMPORAL'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Clock className="w-3.5 h-3.5 inline mr-1.5" />
                <span>แกนเวลา (Temporal)</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('SEQUENCE')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  viewMode === 'SEQUENCE'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Hash className="w-3.5 h-3.5 inline mr-1.5" />
                <span>ลำดับบล็อก (Sequence)</span>
              </button>
            </div>

            {/* Drill Buttons */}
            <button
              type="button"
              onClick={handleTriggerBurstAttack}
              disabled={isSimulatingBurst}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-2 shadow-sm shadow-rose-600/20 cursor-pointer disabled:opacity-50"
            >
              {isSimulatingBurst ? (
                <Activity className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Zap className="w-3.5 h-3.5" />
              )}
              <span>จำลองการโจมตีกลุ่ม (5x Fails)</span>
            </button>

            <button
              type="button"
              onClick={handleResetSentinel}
              className="px-3.5 py-2 bg-white hover:bg-slate-50 active:scale-95 text-slate-700 border border-slate-200 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5 text-emerald-600" />
              <span>รีเซ็ตตัวเฝ้าระวัง</span>
            </button>
          </div>
        </div>

        {/* Filter Strip & Key Indicators */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mr-1">
              ตัวกรองกราฟ:
            </span>
            <div className="flex items-center p-1 bg-slate-100 rounded-lg text-xs font-bold">
              <button
                type="button"
                onClick={() => setRiskFilter('ALL')}
                className={`px-3 py-1 rounded-md transition-colors cursor-pointer ${
                  riskFilter === 'ALL'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                ทุกเหตุการณ์ ({logs.length})
              </button>
              <button
                type="button"
                onClick={() => setRiskFilter('HIGH_RISK_ONLY')}
                className={`px-3 py-1 rounded-md transition-colors cursor-pointer ${
                  riskFilter === 'HIGH_RISK_ONLY'
                    ? 'bg-rose-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                เฉพาะความเสี่ยงสูง (
                {logs.filter((l) => computeLogRiskScore(l) >= 50).length}
                )
              </button>
              <button
                type="button"
                onClick={() => setRiskFilter('AUTH_ONLY')}
                className={`px-3 py-1 rounded-md transition-colors cursor-pointer ${
                  riskFilter === 'AUTH_ONLY'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                การยืนยันตัวตน (
                {
                  logs.filter(
                    (l) =>
                      l.resourceType === 'AUTH_SECURITY' ||
                      l.action.includes('LOGIN') ||
                      l.action.includes('PIN')
                  ).length
                }
                )
              </button>
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs font-mono text-slate-500">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 ring-2 ring-rose-200 inline-block" />
              <span>Failed / Lockout</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 ring-2 ring-amber-200 inline-block" />
              <span>PIN / Override</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-emerald-200 inline-block" />
              <span>Verified Biometric</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-slate-400 inline-block" />
              <span>Ledger Block</span>
            </div>
          </div>
        </div>

        {/* SVG Graph Viewport */}
        <div className="relative border border-slate-200 rounded-xl bg-slate-950 p-3 overflow-hidden shadow-inner select-none">
          {/* Lockout Limit Annotation Header */}
          <div className="absolute top-4 right-6 flex items-center gap-2 text-[10px] font-mono text-rose-400 font-bold tracking-wider z-10 pointer-events-none">
            <span className="w-4 border-t-2 border-dashed border-rose-500" />
            <span>SENTINEL LOCKOUT THRESHOLD (SCORE 75 / 5 ATTEMPTS)</span>
          </div>

          <svg
            viewBox={`0 0 ${graphDimensions.width} ${graphDimensions.height}`}
            className="w-full h-auto max-h-[320px] overflow-visible"
            onMouseLeave={() => {
              setHoveredNodeId(null);
              setTooltipPos(null);
            }}
          >
            <defs>
              {/* Background & Waveform Gradients */}
              <linearGradient id="gridLineFade" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#334155" stopOpacity="0.1" />
                <stop offset="50%" stopColor="#334155" stopOpacity="0.4" />
                <stop offset="100%" stopColor="#334155" stopOpacity="0.1" />
              </linearGradient>

              <linearGradient id="riskAreaGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.35" />
                <stop offset="50%" stopColor="#e11d48" stopOpacity="0.15" />
                <stop offset="100%" stopColor="#0f172a" stopOpacity="0.0" />
              </linearGradient>

              <linearGradient id="criticalClusterGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ef4444" stopOpacity="0.25" />
                <stop offset="100%" stopColor="#ef4444" stopOpacity="0.03" />
              </linearGradient>

              <linearGradient id="elevatedClusterGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.2" />
                <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.02" />
              </linearGradient>

              {/* Pulse Glow Filters */}
              <filter id="glowRose" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="4" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* Horizontal Grid Lines */}
            {[25, 50, 75, 100].map((val) => {
              const y =
                graphDimensions.paddingTop +
                plotArea.height -
                (val / 100) * plotArea.height;
              const isThreshold = val === 75;
              return (
                <g key={val}>
                  <line
                    x1={graphDimensions.paddingLeft}
                    y1={y}
                    x2={graphDimensions.width - graphDimensions.paddingRight}
                    y2={y}
                    stroke={isThreshold ? '#f43f5e' : '#1e293b'}
                    strokeWidth={isThreshold ? 1.5 : 1}
                    strokeDasharray={isThreshold ? '4 4' : '2 2'}
                  />
                  <text
                    x={graphDimensions.paddingLeft - 8}
                    y={y + 3}
                    textAnchor="end"
                    className={`font-mono text-[9px] font-bold ${
                      isThreshold ? 'fill-rose-400' : 'fill-slate-500'
                    }`}
                  >
                    {val === 75 ? '75*' : val}
                  </text>
                </g>
              );
            })}

            {/* Y-Axis Label */}
            <text
              x={14}
              y={graphDimensions.height / 2}
              textAnchor="middle"
              transform={`rotate(-90 14 ${graphDimensions.height / 2})`}
              className="font-mono text-[9px] font-bold fill-slate-500 uppercase tracking-widest"
            >
              Risk Index (0-100)
            </text>

            {/* Cluster Shaded Bounding Zones */}
            {clusterRegions.map((region) => {
              if (!region) return null;
              const { cluster, minX, width } = region;
              const isSelected = selectedClusterId === cluster.id;
              const isCritical = cluster.severity === 'CRITICAL';
              const gradId = isCritical ? 'url(#criticalClusterGrad)' : 'url(#elevatedClusterGrad)';

              return (
                <g
                  key={cluster.id}
                  className="cursor-pointer transition-all"
                  onClick={() => {
                    const nextId = selectedClusterId === cluster.id ? null : cluster.id;
                    onSelectCluster(nextId ? cluster : null);
                    setActiveForensicCluster(nextId ? cluster : null);
                  }}
                >
                  {/* Shaded Background Box */}
                  <rect
                    x={minX}
                    y={graphDimensions.paddingTop}
                    width={width}
                    height={plotArea.height}
                    fill={gradId}
                    rx={6}
                    stroke={
                      isSelected
                        ? '#38bdf8'
                        : isCritical
                        ? '#f43f5e'
                        : '#f59e0b'
                    }
                    strokeWidth={isSelected ? 2 : 1}
                    strokeDasharray={isSelected ? 'none' : '3 3'}
                    className="transition-colors hover:fill-opacity-50"
                  />

                  {/* Cluster Header Label */}
                  <g transform={`translate(${minX + 6}, ${graphDimensions.paddingTop + 14})`}>
                    <rect
                      x={0}
                      y={-10}
                      width={Math.max(80, width - 12)}
                      height={18}
                      rx={3}
                      fill={isCritical ? '#450a0a' : '#451a03'}
                      stroke={isCritical ? '#f43f5e' : '#f59e0b'}
                      strokeWidth={0.8}
                    />
                    <text
                      x={6}
                      y={2}
                      className="font-mono text-[9px] font-bold fill-white uppercase"
                    >
                      {cluster.id} · {cluster.totalAttempts}x {cluster.severity}
                    </text>
                  </g>
                </g>
              );
            })}

            {/* Area under the curve */}
            {areaFillData && (
              <path d={areaFillData} fill="url(#riskAreaGrad)" pointerEvents="none" />
            )}

            {/* Connecting Trend Line */}
            {trendPathData && (
              <path
                d={trendPathData}
                fill="none"
                stroke="#0284c7"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="opacity-75"
              />
            )}

            {/* Sequential Event Nodes */}
            {logCoordinates.map(({ log, x, y, risk, cluster }) => {
              const isHovered = hoveredNodeId === log.id;
              const isSelected = selectedLogId === log.id;
              const isFailed =
                log.action.includes('LOGIN_FAILED') ||
                log.details.toLowerCase().includes('failed login') ||
                log.details.toLowerCase().includes('tamper');
              const isOverride =
                log.action.includes('OVERRIDE') || log.action.includes('VOID');
              const isBiometric =
                log.action.includes('WEBAUTHN') || log.action.includes('BIOMETRIC');

              let nodeColor = '#64748b'; // Slate neutral
              let radius = 4;

              if (isFailed) {
                nodeColor = '#f43f5e'; // Rose
                radius = 6;
              } else if (isOverride) {
                nodeColor = '#f59e0b'; // Amber
                radius = 5.5;
              } else if (isBiometric) {
                nodeColor = '#10b981'; // Emerald
                radius = 5;
              } else if (log.resourceType === 'AUTH_SECURITY') {
                nodeColor = '#38bdf8'; // Sky
                radius = 4.5;
              }

              return (
                <g
                  key={log.id}
                  className="cursor-pointer transition-transform"
                  onMouseEnter={(e) => {
                    setHoveredNodeId(log.id);
                    const rect = e.currentTarget.getBoundingClientRect();
                    setTooltipPos({ x: rect.left, y: rect.top });
                  }}
                  onClick={() => {
                    onSelectLog(selectedLogId === log.id ? null : log.id);
                    if (cluster) {
                      onSelectCluster(cluster);
                      setActiveForensicCluster(cluster);
                    }
                  }}
                >
                  {/* Outer pulse ring for high risk or selected */}
                  {(isFailed || isSelected || isHovered) && (
                    <circle
                      cx={x}
                      cy={y}
                      r={radius + 4}
                      fill={nodeColor}
                      opacity={isSelected ? 0.4 : isHovered ? 0.35 : 0.2}
                      className={isFailed ? 'animate-ping' : ''}
                    />
                  )}

                  {/* Core Node Circle */}
                  <circle
                    cx={x}
                    cy={y}
                    r={isSelected ? radius + 2 : radius}
                    fill={nodeColor}
                    stroke={isSelected ? '#ffffff' : '#0f172a'}
                    strokeWidth={isSelected ? 2 : 1}
                    filter={isFailed ? 'url(#glowRose)' : undefined}
                  />

                  {/* Sequence Number Label above node for important events */}
                  {(isFailed || isOverride || isSelected) && (
                    <text
                      x={x}
                      y={y - 8}
                      textAnchor="middle"
                      className="font-mono text-[8px] font-bold fill-slate-300 pointer-events-none"
                    >
                      #{log.sequenceNo}
                    </text>
                  )}
                </g>
              );
            })}

            {/* X-Axis Baseline & Tick Marks */}
            <line
              x1={graphDimensions.paddingLeft}
              y1={graphDimensions.paddingTop + plotArea.height}
              x2={graphDimensions.width - graphDimensions.paddingRight}
              y2={graphDimensions.paddingTop + plotArea.height}
              stroke="#334155"
              strokeWidth={1}
            />

            {/* X-Axis Tick Labels */}
            {logCoordinates.length > 0 && (
              <>
                <text
                  x={graphDimensions.paddingLeft}
                  y={graphDimensions.paddingTop + plotArea.height + 18}
                  textAnchor="start"
                  className="font-mono text-[9px] fill-slate-400 font-bold"
                >
                  {viewMode === 'TEMPORAL'
                    ? new Date(logCoordinates[0].log.timestamp).toLocaleTimeString('th-TH', {
                        hour12: false,
                      })
                    : `#${logCoordinates[0].log.sequenceNo} (Genesis)`}
                </text>

                <text
                  x={graphDimensions.width - graphDimensions.paddingRight}
                  y={graphDimensions.paddingTop + plotArea.height + 18}
                  textAnchor="end"
                  className="font-mono text-[9px] fill-slate-400 font-bold"
                >
                  {viewMode === 'TEMPORAL'
                    ? new Date(
                        logCoordinates[logCoordinates.length - 1].log.timestamp
                      ).toLocaleTimeString('th-TH', { hour12: false })
                    : `#${logCoordinates[logCoordinates.length - 1].log.sequenceNo} (Latest)`}
                </text>
              </>
            )}
          </svg>

          {/* Interactive Floating Hover HUD Tooltip */}
          {activeHoveredPoint && tooltipPos && (
            <div
              className="absolute z-20 pointer-events-none bg-slate-900/95 text-white border border-slate-700/80 rounded-xl p-3 shadow-2xl backdrop-blur-md text-xs font-sans max-w-xs transition-opacity duration-150"
              style={{
                left: Math.min(
                  plotArea.width - 100,
                  Math.max(20, activeHoveredPoint.x - 110)
                ),
                top: Math.max(10, activeHoveredPoint.y - 120),
              }}
            >
              <div className="flex items-center justify-between gap-3 pb-1.5 border-b border-slate-800 font-mono text-[10px]">
                <span className="font-bold text-slate-400">
                  Block #{activeHoveredPoint.log.sequenceNo}
                </span>
                <span className="text-emerald-400">
                  {new Date(activeHoveredPoint.log.timestamp).toLocaleTimeString('th-TH', {
                    hour12: false,
                  })}
                </span>
              </div>
              <div className="pt-2 space-y-1">
                <div className="font-bold text-slate-200 text-xs truncate">
                  {activeHoveredPoint.log.action}
                </div>
                <div className="text-[11px] text-slate-400 line-clamp-2">
                  {activeHoveredPoint.log.details}
                </div>
                <div className="flex items-center justify-between text-[10px] font-mono pt-1 text-slate-400">
                  <span>IP: {activeHoveredPoint.log.ipAddress}</span>
                  <span
                    className={`font-bold ${
                      activeHoveredPoint.risk >= 70
                        ? 'text-rose-400'
                        : activeHoveredPoint.risk >= 40
                        ? 'text-amber-400'
                        : 'text-emerald-400'
                    }`}
                  >
                    Risk: {activeHoveredPoint.risk}/100
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Detected Clusters Summary Strip */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-slate-900 uppercase tracking-widest">
                Detected Authentication Clusters ({detectedClusters.length})
              </span>
              <span className="text-xs text-slate-400">· Click card to inspect cluster</span>
            </div>
            {selectedClusterId && (
              <button
                type="button"
                onClick={() => {
                  onSelectCluster(null);
                  setActiveForensicCluster(null);
                }}
                className="text-xs font-bold text-slate-500 hover:text-slate-900 transition-colors cursor-pointer flex items-center gap-1"
              >
                <X className="w-3.5 h-3.5" />
                <span>Clear Cluster Filter</span>
              </button>
            )}
          </div>

          {detectedClusters.length === 0 ? (
            <div className="p-6 text-center border border-dashed border-slate-200 rounded-xl text-slate-400 text-xs font-bold uppercase tracking-wider">
              No abnormal authentication bursts detected in current ledger scope
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {detectedClusters.map((cluster) => {
                const isSelected = selectedClusterId === cluster.id;
                const isCritical = cluster.severity === 'CRITICAL';
                const isHigh = cluster.severity === 'HIGH';

                return (
                  <div
                    key={cluster.id}
                    onClick={() => {
                      const next = isSelected ? null : cluster;
                      onSelectCluster(next);
                      setActiveForensicCluster(next);
                    }}
                    className={`p-4 rounded-xl border transition-all cursor-pointer space-y-3 ${
                      isSelected
                        ? 'bg-slate-900 text-white border-slate-900 shadow-md ring-2 ring-emerald-500/20'
                        : isCritical
                        ? 'bg-rose-50/50 hover:bg-rose-50 border-rose-200'
                        : isHigh
                        ? 'bg-amber-50/50 hover:bg-amber-50 border-amber-200'
                        : 'bg-white hover:bg-slate-50 border-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className={`font-mono text-xs font-bold px-2 py-0.5 rounded ${
                            isSelected
                              ? 'bg-slate-800 text-white'
                              : isCritical
                              ? 'bg-rose-100 text-rose-800'
                              : isHigh
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {cluster.id}
                        </span>
                        <span
                          className={`text-xs font-bold truncate ${
                            isSelected
                              ? 'text-white'
                              : isCritical
                              ? 'text-rose-900'
                              : 'text-slate-900'
                          }`}
                        >
                          {cluster.severity} BURST
                        </span>
                      </div>
                      <span className="font-mono text-[11px] tabular-nums text-slate-400 shrink-0">
                        {cluster.totalAttempts} attempts
                      </span>
                    </div>

                    <div className="space-y-1">
                      <div
                        className={`text-xs font-medium leading-snug line-clamp-2 ${
                          isSelected ? 'text-slate-300' : 'text-slate-600'
                        }`}
                      >
                        {cluster.primaryVector}
                      </div>
                      <div className="flex items-center gap-2 text-[11px] font-mono text-slate-400">
                        <span>IP: {cluster.sourceIps.join(', ') || '10.24.0.12'}</span>
                        <span aria-hidden="true">·</span>
                        <span>{cluster.durationSeconds}s duration</span>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-100/50 flex items-center justify-between text-[11px] font-bold">
                      <span
                        className={
                          cluster.failedCount > 0 ? 'text-rose-500' : 'text-emerald-500'
                        }
                      >
                        {cluster.failedCount} Failed · {cluster.successCount} Allowed
                      </span>
                      <span className="text-xs text-emerald-600 flex items-center gap-1">
                        <span>Inspect</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Forensic Cluster Deep-Dive Drawer (When a cluster is active) */}
        {activeForensicCluster && (
          <div className="p-5 bg-slate-900 text-white rounded-xl border border-slate-800 space-y-4 animate-in fade-in duration-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
                  <span className="text-emerald-400 font-bold">Forensic Incident Audit</span>
                  <span>/</span>
                  <span>{activeForensicCluster.id}</span>
                  <span>/</span>
                  <span className="text-rose-400 font-bold">
                    Peak Risk Score: {activeForensicCluster.peakRiskScore}/100
                  </span>
                </div>
                <h4 className="text-base font-extrabold text-white">
                  {activeForensicCluster.primaryVector}
                </h4>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    const el = document.getElementById('audit-ledger-section');
                    if (el) el.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-bold rounded-lg transition-all cursor-pointer"
                >
                  Scroll to Ledger Blocks
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onSelectCluster(null);
                    setActiveForensicCluster(null);
                  }}
                  className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 font-mono text-xs">
              <div className="p-3 bg-slate-800/60 rounded-lg space-y-1">
                <div className="text-[10px] text-slate-400 uppercase">Target Identity</div>
                <div className="font-bold text-white truncate">
                  {activeForensicCluster.targetIdentities.join(', ') || 'System Default'}
                </div>
              </div>
              <div className="p-3 bg-slate-800/60 rounded-lg space-y-1">
                <div className="text-[10px] text-slate-400 uppercase">Attacker Origin IP</div>
                <div className="font-bold text-rose-400">
                  {activeForensicCluster.sourceIps.join(', ') || '10.24.0.12'}
                </div>
              </div>
              <div className="p-3 bg-slate-800/60 rounded-lg space-y-1">
                <div className="text-[10px] text-slate-400 uppercase">Attack Velocity</div>
                <div className="font-bold text-white">
                  {activeForensicCluster.peakVelocity} attempts/min
                </div>
              </div>
              <div className="p-3 bg-slate-800/60 rounded-lg space-y-1">
                <div className="text-[10px] text-slate-400 uppercase">Sentinel Lockout</div>
                <div
                  className={`font-bold ${
                    activeForensicCluster.isLockoutEnforced
                      ? 'text-rose-400'
                      : 'text-amber-400'
                  }`}
                >
                  {activeForensicCluster.isLockoutEnforced
                    ? '15-min Lockout Active'
                    : 'Threshold Pending'}
                </div>
              </div>
            </div>

            <div className="text-xs text-slate-400 flex items-center gap-2 pt-1">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>
                All {activeForensicCluster.logIds.length} sequential attempts cryptographically
                sealed in SHA-256 blockchain ledger. Non-repudiation verified.
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
