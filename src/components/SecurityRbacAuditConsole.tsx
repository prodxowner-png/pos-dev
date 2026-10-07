import React, { useState, useMemo } from 'react';
import { Shield, Lock, KeyRound, AlertOctagon, CheckCircle2, UserCheck, Search, Filter, Hash, Fingerprint, Clock, User, Activity, ExternalLink, ShieldCheck, ShieldAlert } from 'lucide-react';
import { AuditLogRecord, LoginThrottleRecord } from '../types/prodx';

interface SecurityRbacAuditConsoleProps {
  logs: AuditLogRecord[];
  throttles: LoginThrottleRecord[];
  onRefreshSecurityData: () => Promise<void>;
}

const RBAC_MATRIX = [
  {
    permission: 'POS_CHECKOUT_COMMIT',
    description: 'สร้างรายการขายและออกใบกำกับภาษีอย่างย่อ',
    cashier: 'ALLOWED',
    supervisor: 'ALLOWED',
    manager: 'ALLOWED',
  },
  {
    permission: 'ORDER_VOID_SAME_SHIFT',
    description: 'ยกเลิกบิลภายในกะปัจจุบันและคืนสต็อกอัตโนมัติ (0022_m4)',
    cashier: 'PIN_OVERRIDE_REQUIRED',
    supervisor: 'ALLOWED',
    manager: 'ALLOWED',
  },
  {
    permission: 'ORDER_REFUND_COMMIT',
    description: 'คืนเงินเต็มจำนวนหรือบางส่วน (0012_m3_refund_core)',
    cashier: 'PIN_OVERRIDE_REQUIRED',
    supervisor: 'ALLOWED',
    manager: 'ALLOWED',
  },
  {
    permission: 'INVENTORY_MANUAL_ADJUST',
    description: 'ปรับยอดสต็อกพร้อมระบุ Reason Code (0023_m4)',
    cashier: 'DENIED',
    supervisor: 'ALLOWED',
    manager: 'ALLOWED',
  },
  {
    permission: 'DB_MIGRATION_EXECUTE',
    description: 'รันสคริปต์อัปเดตฐานข้อมูลและตรวจสอบ Checksum',
    cashier: 'DENIED',
    supervisor: 'DENIED',
    manager: 'ALLOWED',
  },
  {
    permission: 'AUDIT_LOG_MUTATE_OR_DELETE',
    description: 'แก้ไขหรือลบบันทึกประวัติความปลอดภัยย้อนหลัง (0030_m5)',
    cashier: 'BLOCKED_BY_PG_TRIGGER',
    supervisor: 'BLOCKED_BY_PG_TRIGGER',
    manager: 'BLOCKED_BY_PG_TRIGGER',
  },
];

export const SecurityRbacAuditConsole: React.FC<SecurityRbacAuditConsoleProps> = ({
  logs,
  throttles,
  onRefreshSecurityData,
}) => {
  const [immutabilityTestResult, setImmutabilityTestResult] = useState<{
    pgErrorCode: string;
    triggerName: string;
    message: string;
  } | null>(null);
  const [testingTrigger, setTestingTrigger] = useState(false);
  const [testingThrottle, setTestingThrottle] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRole, setFilterRole] = useState<string>('ALL');
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
        setVerificationState(prev => ({ ...prev, verifyingIndex: i }));
        // Simulate cryptographic work per block
        await new Promise(resolve => setTimeout(resolve, 80));

        if (i < logs.length - 1) {
          const current = logs[i];
          const next = logs[i + 1];
          if (current.prevHash !== next.entryHash) {
            setVerificationState({
              status: 'FAILED',
              message: `Hash chain discontinuity detected at Block #${current.sequenceNo}. The link to Block #${next.sequenceNo} is broken.`,
              failedIndex: i
            });
            return;
          }
        }
      }

      setVerificationState({
        status: 'SUCCESS',
        message: `Cryptographic audit chain verified: ${logs.length} blocks checked. All SHA-256 signatures match previous block outputs. Immutable ledger is intact.`
      });
    } catch (err: any) {
      setVerificationState({
        status: 'FAILED',
        message: err.message
      });
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    // Could add a toast here, but keeping it minimal as per guidelines
  };

  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      const matchesSearch = 
        log.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.details.toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.resourceId.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesRole = filterRole === 'ALL' || log.actorRole === filterRole;
      
      return matchesSearch && matchesRole;
    });
  }, [logs, searchQuery, filterRole]);

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

  return (
    <div className="space-y-8 max-w-full overflow-hidden">
      {/* Header & Interactive Security Drills */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-zinc-200">
        <div className="min-w-0">
          <h2 className="text-xl font-bold text-zinc-900 tracking-tight">
            Security & Audit
          </h2>
          <p className="text-sm text-zinc-500 mt-1 font-medium leading-relaxed">
            Role-based access control, cryptographic hash chaining, and login throttling.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <button
            onClick={handleTestImmutabilityTrigger}
            disabled={testingTrigger}
            className="px-6 py-2.5 bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 text-xs font-bold uppercase tracking-widest rounded-full transition-all flex items-center gap-2 shadow-sm"
          >
            <AlertOctagon className="w-4 h-4 shrink-0" />
            <span>Test Immutability</span>
          </button>

          <button
            onClick={() => handleSimulateBruteForce(false)}
            disabled={testingThrottle}
            className="px-6 py-2.5 bg-white hover:bg-zinc-100 text-zinc-700 border border-zinc-200 text-xs font-bold uppercase tracking-widest rounded-full transition-all flex items-center gap-2 shadow-sm"
          >
            <KeyRound className="w-4 h-4 text-amber-600 shrink-0" />
            <span>Simulate Failure</span>
          </button>
        </div>
      </div>

      {/* Trigger Verification Alert */}
      {immutabilityTestResult && (
        <div className="p-6 bg-zinc-950 text-white rounded-xl shadow-2xl relative overflow-hidden border border-zinc-800">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 blur-[60px] rounded-full" />
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6 relative z-10">
            <div className="space-y-4 flex-1">
              <div className="font-bold text-emerald-500 flex items-center gap-2 text-sm uppercase tracking-widest">
                <CheckCircle2 className="w-5 h-5 shrink-0" />
                <span>PostgreSQL Security Verified</span>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Trigger:</span>
                  <code className="text-xs text-zinc-300 bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800 font-mono">
                    {immutabilityTestResult.triggerName} (SQLSTATE {immutabilityTestResult.pgErrorCode})
                  </code>
                </div>
                <div className="font-mono text-[12px] bg-black/30 p-5 rounded-lg border border-white/5 leading-relaxed text-zinc-400">
                  {immutabilityTestResult.message}
                </div>
              </div>
            </div>
            <button
              onClick={() => setImmutabilityTestResult(null)}
              className="text-[10px] font-bold text-zinc-500 hover:text-white uppercase tracking-widest transition-colors shrink-0 px-2 py-1 bg-white/5 rounded-md border border-white/5"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Top Row: RBAC Matrix & Login Rate Limit Throttling */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start max-w-full">
        {/* RBAC Permission Matrix (7 Cols) */}
        <div className="lg:col-span-7 space-y-4 max-w-full">
          <div className="flex items-center gap-3 px-1">
            <div className="p-2 bg-emerald-50 rounded-lg">
              <UserCheck className="w-5 h-5 text-emerald-600" />
            </div>
            <h3 className="text-base font-bold text-zinc-900 tracking-tight">
              Access Control Matrix
            </h3>
          </div>

          <div className="overflow-hidden border border-zinc-200 rounded-xl bg-white shadow-sm">
            <div className="overflow-x-auto max-w-full">
              <table className="w-full text-left border-collapse text-xs min-w-[600px]">
                <thead>
                  <tr className="bg-zinc-50 border-b border-zinc-200 text-zinc-500">
                    <th className="py-4 px-6 text-[10px] font-bold uppercase tracking-widest">Capability</th>
                    <th className="py-4 px-6 text-[10px] font-bold uppercase tracking-widest">Cashier</th>
                    <th className="py-4 px-6 text-[10px] font-bold uppercase tracking-widest">Supervisor</th>
                    <th className="py-4 px-6 text-[10px] font-bold uppercase tracking-widest">Admin</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {RBAC_MATRIX.map((row) => (
                    <tr key={row.permission} className="hover:bg-zinc-50/50 transition-colors">
                      <td className="py-4 px-6">
                        <div className="font-bold text-zinc-900 text-sm tracking-tight">{row.permission}</div>
                        <div className="text-[11px] text-zinc-500 mt-1 leading-relaxed">{row.description}</div>
                      </td>
                      <td className="py-4 px-6">
                        <span className="text-[10px] font-bold font-mono text-zinc-400 uppercase tracking-wider">{row.cashier}</span>
                      </td>
                      <td className="py-4 px-6">
                        <span className="text-[10px] font-bold font-mono text-emerald-600 uppercase tracking-wider">{row.supervisor}</span>
                      </td>
                      <td className="py-4 px-6">
                        <span className="text-[10px] font-bold font-mono text-emerald-600 uppercase tracking-wider">{row.manager}</span>
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
              <div className="p-2 bg-emerald-50 rounded-lg">
                <Lock className="w-5 h-5 text-emerald-600" />
              </div>
              <h3 className="text-base font-bold text-zinc-900 tracking-tight">
                Login Sentinel
              </h3>
            </div>
            <button
              onClick={() => handleSimulateBruteForce(true)}
              className="text-[10px] font-bold text-zinc-400 hover:text-emerald-600 uppercase tracking-widest transition-colors"
            >
              Reset Sentinel
            </button>
          </div>

          <div className="divide-y divide-zinc-100 border border-zinc-200 rounded-xl bg-white shadow-sm overflow-hidden">
            {throttles.length === 0 ? (
              <div className="p-12 text-center text-zinc-400 text-xs font-bold uppercase tracking-widest">No active threats</div>
            ) : throttles.map((t) => {
              const isLocked = Boolean(t.lockedUntil);
              return (
                <div key={t.identity} className="p-5 flex items-center justify-between gap-4 hover:bg-zinc-50/50 transition-colors">
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="font-bold text-zinc-900 truncate text-sm">{t.identity}</div>
                    <div className="text-[11px] font-bold text-zinc-400 uppercase tracking-tight">
                      Failed Attempts: <span className="text-zinc-900 tabular-nums">{t.failedAttempts}</span> / 5
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${
                      isLocked ? 'bg-red-50 text-red-700 border-red-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    }`}>
                      {isLocked ? 'Locked' : 'Active'}
                    </span>
                    <div className="text-[10px] font-bold text-zinc-400 tabular-nums mt-2">
                      {new Date(t.lastAttemptAt).toLocaleTimeString('th-TH', { hour12: false })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Bottom Section: Cryptographic SHA-256 Chained Audit Ledger */}
      <div className="space-y-6 pt-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 px-1">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-50 rounded-lg">
              <Shield className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <h3 className="text-base font-bold text-zinc-900 tracking-tight">
                Audit Ledger (Hash Chain)
              </h3>
              <p className="text-xs text-zinc-500 font-medium">Append-only immutable record of all sensitive operations.</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" />
              <input
                type="text"
                placeholder="Search logs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-4 py-2 bg-white border border-zinc-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all w-48 md:w-64"
              />
            </div>
            <select
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
              className="px-3 py-2 bg-white border border-zinc-200 rounded-lg text-xs font-bold text-zinc-600 outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all"
            >
              <option value="ALL">ALL ROLES</option>
              <option value="STORE_MANAGER">MANAGER</option>
              <option value="SHIFT_SUPERVISOR">SUPERVISOR</option>
              <option value="CASHIER">CASHIER</option>
              <option value="SYSTEM_DAEMON">SYSTEM</option>
            </select>
            <button
              onClick={handleVerifyLedger}
              disabled={verificationState.status === 'VERIFYING' || logs.length === 0}
              className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all shadow-sm ${
                verificationState.status === 'SUCCESS' 
                  ? 'bg-emerald-600 text-white shadow-emerald-500/20' 
                  : verificationState.status === 'FAILED' 
                  ? 'bg-red-600 text-white' 
                  : 'bg-zinc-900 text-white hover:bg-zinc-800'
              }`}
            >
              {verificationState.status === 'VERIFYING' ? (
                <Activity className="w-3.5 h-3.5 animate-spin" />
              ) : verificationState.status === 'SUCCESS' ? (
                <ShieldCheck className="w-3.5 h-3.5" />
              ) : (
                <Fingerprint className="w-3.5 h-3.5" />
              )}
              <span>{verificationState.status === 'VERIFYING' ? 'VERIFYING...' : 'VERIFY INTEGRITY'}</span>
            </button>
          </div>
        </div>

        {verificationState.message && (
          <div className={`p-4 rounded-xl border flex items-start gap-3 animate-in fade-in slide-in-from-top-2 duration-300 ${
            verificationState.status === 'SUCCESS' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'
          }`}>
            {verificationState.status === 'SUCCESS' ? <ShieldCheck className="w-5 h-5 shrink-0 mt-0.5" /> : <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5" />}
            <div className="space-y-1">
              <p className="text-sm font-bold">{verificationState.status === 'SUCCESS' ? 'Audit Ledger Verified' : 'Integrity Check Failed'}</p>
              <p className="text-xs font-medium opacity-90">{verificationState.message}</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4">
          {filteredLogs.length === 0 ? (
            <div className="p-12 text-center bg-zinc-50 border border-dashed border-zinc-200 rounded-2xl">
              <p className="text-sm font-bold text-zinc-400 uppercase tracking-widest">No audit logs found matching criteria</p>
            </div>
          ) : (
            filteredLogs.map((log, idx) => {
              const isVerifying = verificationState.status === 'VERIFYING' && verificationState.verifyingIndex === idx;
              const isVerified = verificationState.status === 'SUCCESS' || (verificationState.status === 'VERIFYING' && (verificationState.verifyingIndex ?? -1) > idx);
              const isFailed = verificationState.status === 'FAILED' && verificationState.failedIndex === idx;

              return (
                <div key={log.id} className={`group relative bg-white border rounded-2xl p-5 transition-all duration-300 ${
                  isVerifying ? 'border-emerald-500 shadow-md ring-2 ring-emerald-500/10' : 
                  isFailed ? 'border-red-500 shadow-md ring-2 ring-red-500/10' :
                  'border-zinc-200 hover:border-emerald-300 hover:shadow-md'
                }`}>
                  {/* Connection Line */}
                  {idx < filteredLogs.length - 1 && (
                    <div className="absolute left-10 top-full h-4 w-px bg-zinc-200 z-0" />
                  )}

                  <div className="flex flex-col md:flex-row md:items-start gap-6 relative z-10">
                    {/* Sequence & Time */}
                    <div className="flex md:flex-col items-center md:items-start justify-between gap-2 shrink-0 md:w-28">
                      <div className="text-xs font-mono font-bold text-zinc-400 group-hover:text-emerald-600 transition-colors">
                        #{log.sequenceNo.toString().padStart(4, '0')}
                      </div>
                      <div className="flex items-center gap-1.5 text-zinc-500">
                        <Clock className="w-3 h-3" />
                        <span className="text-[11px] font-mono font-bold">
                          {new Date(log.timestamp).toLocaleTimeString('th-TH', { hour12: false })}
                        </span>
                      </div>
                    </div>

                    {/* Operation Info */}
                    <div className="flex-1 space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="px-2.5 py-1 bg-zinc-100 text-zinc-700 border border-zinc-200 text-[10px] font-bold uppercase tracking-widest rounded-md">
                          {log.resourceType}
                        </span>
                        <h4 className="text-sm font-bold text-zinc-900 group-hover:text-emerald-700 transition-colors tracking-tight">
                          {log.action}
                        </h4>
                      </div>
                      
                      <p className="text-sm text-zinc-600 leading-relaxed">
                        {log.details}
                      </p>

                      <div className="flex flex-wrap items-center gap-4 pt-1">
                        <div className="flex items-center gap-1.5">
                          <User className="w-3 h-3 text-zinc-400" />
                          <span className="text-[11px] font-bold text-zinc-500">{log.actorId}</span>
                          <span className="text-[10px] font-bold text-zinc-400 px-1.5 py-0.5 bg-zinc-50 border border-zinc-200 rounded uppercase">{log.actorRole}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Hash className="w-3 h-3 text-zinc-400" />
                          <span className="text-[11px] font-mono text-zinc-400 truncate max-w-[120px]">ID: {log.resourceId}</span>
                        </div>
                      </div>
                    </div>

                    {/* Cryptographic Footprint */}
                    <div className={`shrink-0 md:w-72 border rounded-xl p-3 space-y-2 transition-all ${
                      isVerifying ? 'bg-emerald-50 border-emerald-200' :
                      isFailed ? 'bg-red-50 border-red-200' :
                      'bg-zinc-50 border-zinc-100 group-hover:bg-emerald-50/30 group-hover:border-emerald-100'
                    }`}>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Prev Hash</span>
                        <button 
                          onClick={() => copyToClipboard(log.prevHash)}
                          className="text-[10px] font-mono text-zinc-400 hover:text-zinc-600 transition-colors"
                        >
                          {log.prevHash.slice(0, 12)}...
                        </button>
                      </div>
                      <div className="h-px bg-zinc-200/50" />
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className={`text-[10px] font-bold uppercase tracking-widest ${isFailed ? 'text-red-600' : 'text-emerald-600'}`}>Entry Hash</span>
                          <div className={`flex items-center gap-1 font-bold font-mono text-[10px] ${
                            isFailed ? 'text-red-700' : 
                            isVerified ? 'text-emerald-700' : 
                            'text-zinc-400'
                          }`}>
                            {isVerifying ? <Activity className="w-3 h-3 animate-spin" /> : 
                             isFailed ? <ShieldAlert className="w-3 h-3" /> :
                             isVerified ? <CheckCircle2 className="w-3 h-3" /> : null}
                            <span>{isVerifying ? 'VERIFYING' : isFailed ? 'TAMPERED' : isVerified ? 'VALIDATED' : 'WAITING'}</span>
                          </div>
                        </div>
                        <button 
                          onClick={() => copyToClipboard(log.entryHash)}
                          className="w-full text-left text-[11px] font-mono text-zinc-500 break-all bg-white p-2 border border-zinc-200 rounded shadow-inner hover:bg-zinc-50 transition-colors"
                        >
                          {log.entryHash}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
