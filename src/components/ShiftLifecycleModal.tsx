import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ShieldCheck,
  KeyRound,
  CheckCircle2,
  Clock,
  ArrowRight,
  Lock,
  AlertCircle,
  User,
  FileText,
  RefreshCw,
  History,
  X,
  Coins,
  Sparkles,
} from 'lucide-react';
import { TelemetrySummary, ShiftRecord } from '../types/prodx';

interface ShiftLifecycleModalProps {
  isOpen: boolean;
  onClose: () => void;
  telemetrySummary: TelemetrySummary;
  onShiftUpdated: () => Promise<void>;
  initialStep?: 'FINALIZE' | 'PROMPT_NEW' | 'HISTORY';
}

export const ShiftLifecycleModal: React.FC<ShiftLifecycleModalProps> = ({
  isOpen,
  onClose,
  telemetrySummary,
  onShiftUpdated,
  initialStep = 'FINALIZE',
}) => {
  const [step, setStep] = useState<'FINALIZE' | 'PROMPT_NEW' | 'HISTORY'>(
    telemetrySummary.shiftStatus === 'FINALIZED_PENDING_NEW' ? 'PROMPT_NEW' : initialStep
  );
  
  // Finalize Form
  const [supervisorPin, setSupervisorPin] = useState('');
  const [finalizedBy, setFinalizedBy] = useState('Supachai V. (Shift Supervisor)');
  const [handoverNotes, setHandoverNotes] = useState('Drawer float verified. POS terminals reconciled.');
  const [finalizeLoading, setFinalizeLoading] = useState(false);
  const [finalizeError, setFinalizeError] = useState<string | null>(null);
  const [finalizedResult, setFinalizedResult] = useState<{
    finalizedShift: ShiftRecord;
    auditLog: any;
  } | null>(null);

  // New Shift Form
  const defaultNextShift = telemetrySummary.activeShift.includes('AM')
    ? telemetrySummary.activeShift.replace('AM', 'PM')
    : telemetrySummary.activeShift.includes('PM')
    ? telemetrySummary.activeShift.replace('PM', 'NIGHT')
    : `SH-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`;

  const [newShiftId, setNewShiftId] = useState(defaultNextShift);
  const [newCashierName, setNewCashierName] = useState('Waraporn K. (Cashier)');
  const [openingFloatThb, setOpeningFloatThb] = useState('3000.00');
  const [newShiftNotes, setNewShiftNotes] = useState('Opening register drawer float ฿3,000 verified.');
  const [startLoading, setStartLoading] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  // History state
  const [shiftHistoryList, setShiftHistoryList] = useState<ShiftRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    if (telemetrySummary.shiftStatus === 'FINALIZED_PENDING_NEW') {
      setStep('PROMPT_NEW');
    } else {
      setStep(initialStep);
    }
    setFinalizeError(null);
    setStartError(null);
  }, [isOpen, telemetrySummary.shiftStatus, initialStep]);

  const loadHistory = async () => {
    setLoadingHistory(true);
    try {
      const res = await fetch('/api/shift/history');
      if (res.ok) {
        const data = await res.json();
        setShiftHistoryList(data.history || []);
      }
    } catch {
      // Ignore
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    if (step === 'HISTORY') {
      loadHistory();
    }
  }, [step]);

  if (!isOpen) return null;

  const handleFinalizeShift = async (e: React.FormEvent) => {
    e.preventDefault();
    setFinalizeError(null);
    setFinalizeLoading(true);

    try {
      const res = await fetch('/api/shift/finalize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supervisorPin: supervisorPin.trim(),
          finalizedBy: finalizedBy.trim(),
          handoverNotes: handoverNotes.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setFinalizeError(data.message || data.error || 'Failed to finalize shift');
        return;
      }

      setFinalizedResult({
        finalizedShift: data.finalizedShift,
        auditLog: data.auditLog,
      });

      // Update next shift suggestion based on finalized shift
      const nextId = data.finalizedShift.shiftId.includes('AM')
        ? data.finalizedShift.shiftId.replace('AM', 'PM')
        : data.finalizedShift.shiftId.includes('PM')
        ? data.finalizedShift.shiftId.replace('PM', 'NIGHT')
        : `SH-${new Date().getFullYear()}-REV2`;
      setNewShiftId(nextId);

      await onShiftUpdated();
      // Officially ended and finalized in audit log -> transition to prompting for new shift identifier!
      setStep('PROMPT_NEW');
    } catch (err: any) {
      setFinalizeError(err.message || 'Network error while finalizing shift');
    } finally {
      setFinalizeLoading(false);
    }
  };

  const handleStartNewShift = async (e: React.FormEvent) => {
    e.preventDefault();
    setStartError(null);
    setStartLoading(true);

    try {
      const floatSatang = Math.round((parseFloat(openingFloatThb) || 0) * 100);
      const res = await fetch('/api/shift/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          newShiftId: newShiftId.trim().toUpperCase(),
          cashierName: newCashierName.trim(),
          openingFloatSatang: floatSatang,
          notes: newShiftNotes.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setStartError(data.message || data.error || 'Failed to start new shift');
        return;
      }

      await onShiftUpdated();
      onClose();
    } catch (err: any) {
      setStartError(err.message || 'Network error while activating new shift');
    } finally {
      setStartLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-8 py-6 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-5">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
              <ShieldCheck className="w-7 h-7" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-3 text-[10px] font-bold text-emerald-400 uppercase tracking-[0.2em]">
                <span>Governance Module</span>
                <span aria-hidden="true" className="text-white/20">/</span>
                <span>SHA-256 Ledger</span>
              </div>
              <h3 className="text-xl font-extrabold tracking-tight text-white">
                Shift Lifecycle & Telemetry Control
              </h3>
              <p className="text-xs text-slate-400 font-medium max-w-md">
                Official shift reconciliation, audit log finalization, and secure operator handover.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-500 hover:text-white rounded-xl hover:bg-white/10 transition-all active:scale-90"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Tab Stepper Bar */}
        <div className="flex items-center justify-between px-6 py-2.5 bg-slate-50 border-b border-slate-200 text-xs font-semibold">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setStep('FINALIZE')}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
                step === 'FINALIZE'
                  ? 'bg-white text-slate-900 shadow-sm border border-slate-200 font-bold'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <span className="w-4 h-4 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-mono">
                1
              </span>
              <span>End & Finalize Current Shift</span>
            </button>

            <span className="text-slate-300">→</span>

            <button
              onClick={() => setStep('PROMPT_NEW')}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
                step === 'PROMPT_NEW'
                  ? 'bg-white text-emerald-700 shadow-sm border border-emerald-200 font-bold'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <span className="w-4 h-4 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-[10px] font-mono">
                2
              </span>
              <span>Prompt New Shift Identifier</span>
            </button>
          </div>

          <button
            onClick={() => setStep('HISTORY')}
            className={`px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 transition-all text-xs ${
              step === 'HISTORY'
                ? 'bg-white text-slate-900 shadow-sm border border-slate-200 font-bold'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <History className="w-3.5 h-3.5 text-slate-400" />
            <span>Shift Ledger</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          <AnimatePresence mode="wait">
            {/* STEP 1: FINALIZE SHIFT */}
            {step === 'FINALIZE' && (
              <motion.form
                key="finalize"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                onSubmit={handleFinalizeShift}
                className="space-y-6"
              >
                {/* Active Shift Metrics Callout */}
                <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-xl space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                        Active Shift Target
                      </span>
                      <span className="px-2.5 py-0.5 rounded-md font-mono text-sm font-extrabold bg-slate-900 text-white tracking-wider">
                        {telemetrySummary.activeShift}
                      </span>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                        READY TO FINALIZE
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-slate-500 font-mono">
                      <Clock className="w-3.5 h-3.5" />
                      <span>
                        Started:{' '}
                        {telemetrySummary.shiftStartedAt
                          ? new Date(telemetrySummary.shiftStartedAt).toLocaleTimeString('th-TH')
                          : '08:00 AM'}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-200/60">
                    <div className="p-2.5 bg-white rounded-lg border border-slate-200/60">
                      <div className="text-[10px] uppercase font-bold text-slate-400">Shift Orders</div>
                      <div className="text-lg font-mono font-bold text-slate-900">
                        {telemetrySummary.shiftOrdersCount ?? 0}
                        <span className="text-xs text-slate-400 font-sans ml-1">orders</span>
                      </div>
                    </div>

                    <div className="p-2.5 bg-white rounded-lg border border-slate-200/60">
                      <div className="text-[10px] uppercase font-bold text-slate-400">Shift Net Sales</div>
                      <div className="text-lg font-mono font-bold text-slate-900">
                        ฿{(((telemetrySummary.shiftSalesSatang ?? 0) / 100)).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                      </div>
                    </div>

                    <div className="p-2.5 bg-white rounded-lg border border-slate-200/60">
                      <div className="text-[10px] uppercase font-bold text-slate-400">Estimated VAT</div>
                      <div className="text-lg font-mono font-bold text-slate-900">
                        ฿{(((telemetrySummary.shiftSalesSatang ?? 0) * 0.07 / 100)).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                      </div>
                    </div>

                    <div className="p-2.5 bg-white rounded-lg border border-slate-200/60">
                      <div className="text-[10px] uppercase font-bold text-slate-400">Store Branch</div>
                      <div className="text-sm font-mono font-bold text-slate-700 truncate mt-1">
                        {telemetrySummary.activeStore}
                      </div>
                    </div>
                  </div>
                </div>

                {finalizeError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                    <span>{finalizeError}</span>
                  </div>
                )}

                {/* Supervisor Authorization Section */}
                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-widest flex items-center gap-1.5">
                    <KeyRound className="w-4 h-4 text-emerald-600" />
                    Supervisor Cryptographic Authorization
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-700">Supervisor Sign-Off Name</label>
                      <div className="relative">
                        <User className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                        <input
                          type="text"
                          value={finalizedBy}
                          onChange={(e) => setFinalizedBy(e.target.value)}
                          required
                          className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                          placeholder="e.g. Supachai V. (Supervisor)"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-semibold text-slate-700">Supervisor Security PIN</label>
                        <span className="text-[10px] font-mono text-emerald-600">Hint: 2580 or 9999</span>
                      </div>
                      <div className="relative">
                        <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                        <input
                          type="password"
                          maxLength={6}
                          value={supervisorPin}
                          onChange={(e) => setSupervisorPin(e.target.value)}
                          required
                          className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-mono tracking-widest text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                          placeholder="Enter PIN"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700">Shift Handover & Reconciliation Notes</label>
                    <div className="relative">
                      <FileText className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                      <textarea
                        rows={2}
                        value={handoverNotes}
                        onChange={(e) => setHandoverNotes(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                        placeholder="Reconciliation details, cash drawer float, turnover remarks..."
                      />
                    </div>
                  </div>
                </div>

                {/* Submit Action */}
                <div className="pt-4 border-t border-slate-200 flex items-center justify-between gap-3">
                  <div className="text-[11px] text-slate-500 leading-tight">
                    Officially closes <span className="font-mono font-bold text-slate-800">{telemetrySummary.activeShift}</span> and commits a cryptographic block to the audit ledger.
                  </div>

                  <button
                    type="submit"
                    disabled={finalizeLoading}
                    className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 active:scale-95 text-white font-semibold text-xs uppercase tracking-wider rounded-xl shadow-md transition-all flex items-center gap-2 shrink-0 disabled:opacity-50"
                  >
                    {finalizeLoading ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin text-emerald-400" />
                        <span>Sealing Audit...</span>
                      </>
                    ) : (
                      <>
                        <Lock className="w-4 h-4 text-emerald-400" />
                        <span>Finalize Shift & Proceed</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>
              </motion.form>
            )}

            {/* STEP 2: PROMPT FOR NEW SHIFT IDENTIFIER */}
            {step === 'PROMPT_NEW' && (
              <motion.form
                key="prompt_new"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                onSubmit={handleStartNewShift}
                className="space-y-6"
              >
                {/* Audit Seal Success Banner */}
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl space-y-2">
                  <div className="flex items-center gap-2 text-emerald-800 font-bold text-sm">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Previous Shift Finalized in Immutable Audit Ledger!</span>
                  </div>
                  <p className="text-xs text-emerald-700 leading-relaxed">
                    Shift audit log entry was successfully sealed with SHA-256 hash chaining. Please specify the new active shift identifier to resume POS sales tracking in telemetry.
                  </p>
                  {finalizedResult && (
                    <div className="pt-2 border-t border-emerald-200/60 flex items-center gap-3 text-[11px] font-mono text-emerald-900">
                      <span>Ledger Seq #{finalizedResult.auditLog.sequenceNo}</span>
                      <span>Hash: {finalizedResult.auditLog.entryHash}</span>
                    </div>
                  )}
                </div>

                {startError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                    <span>{startError}</span>
                  </div>
                )}

                {/* Prompt New Shift Inputs */}
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                        New Shift Identifier <span className="text-rose-500">*</span>
                      </label>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-slate-400">Presets:</span>
                        {['SH-2026-PM', 'SH-2026-NIGHT', 'SH-2026-AM'].map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => setNewShiftId(preset)}
                            className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                          >
                            {preset}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="relative">
                      <Sparkles className="w-4 h-4 text-emerald-600 absolute left-3 top-3" />
                      <input
                        type="text"
                        value={newShiftId}
                        onChange={(e) => setNewShiftId(e.target.value)}
                        required
                        className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-base font-mono font-bold tracking-wider text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none uppercase"
                        placeholder="e.g. SH-2026-PM"
                      />
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Standard format: SH-[YEAR]-[SESSION] (e.g. SH-2026-PM, SH-2026-NIGHT, or branch-specific code).
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-700">Assigned Cashier / Operator</label>
                      <div className="relative">
                        <User className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                        <input
                          type="text"
                          value={newCashierName}
                          onChange={(e) => setNewCashierName(e.target.value)}
                          required
                          className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                          placeholder="Cashier Name"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-700">Opening Cash Float (฿ THB)</label>
                      <div className="relative">
                        <Coins className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                        <input
                          type="number"
                          step="0.01"
                          value={openingFloatThb}
                          onChange={(e) => setOpeningFloatThb(e.target.value)}
                          required
                          className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-mono text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                          placeholder="3000.00"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700">Opening Turnover Remarks</label>
                    <textarea
                      rows={2}
                      value={newShiftNotes}
                      onChange={(e) => setNewShiftNotes(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                      placeholder="Float breakdown, till verification remarks..."
                    />
                  </div>
                </div>

                {/* Submit Action */}
                <div className="pt-4 border-t border-slate-200 flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => setStep('FINALIZE')}
                    className="text-xs text-slate-500 hover:text-slate-800 font-semibold transition-colors"
                  >
                    ← Back to Finalization
                  </button>

                  <button
                    type="submit"
                    disabled={startLoading}
                    className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-md shadow-emerald-600/20 transition-all flex items-center gap-2 disabled:opacity-50"
                  >
                    {startLoading ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Activating Shift...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Activate Shift ({newShiftId})</span>
                      </>
                    )}
                  </button>
                </div>
              </motion.form>
            )}

            {/* STEP 3: SHIFT LEDGER HISTORY */}
            {step === 'HISTORY' && (
              <motion.div
                key="history"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-4"
              >
                <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-widest flex items-center gap-1.5">
                    <History className="w-4 h-4 text-emerald-600" />
                    Historical Reconciled Shifts
                  </h4>
                  <button
                    onClick={loadHistory}
                    disabled={loadingHistory}
                    className="text-xs text-slate-500 hover:text-slate-900 flex items-center gap-1"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${loadingHistory ? 'animate-spin' : ''}`} />
                    <span>Refresh</span>
                  </button>
                </div>

                {shiftHistoryList.length === 0 ? (
                  <div className="py-12 text-center text-slate-400 text-sm space-y-2">
                    <History className="w-8 h-8 mx-auto opacity-30" />
                    <p>No previous shifts have been finalized yet.</p>
                    <p className="text-xs text-slate-400">
                      When you officially end the active shift, its audited summary and cryptographic seal will be listed here.
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
                    {shiftHistoryList.map((record, i) => (
                      <div key={i} className="py-3 px-2 hover:bg-slate-50 rounded-lg transition-colors space-y-1.5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-slate-900 text-sm">
                              {record.shiftId}
                            </span>
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                              FINALIZED
                            </span>
                          </div>
                          <div className="font-mono text-xs font-bold text-emerald-700">
                            ฿{(record.totalSalesSatang / 100).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center justify-between text-xs text-slate-500 gap-2">
                          <span>Orders: {record.ordersCount}</span>
                          <span>Closed: {new Date(record.endedAt || '').toLocaleString('th-TH')}</span>
                          <span>By: {record.finalizedBy || record.cashierName}</span>
                        </div>

                        {record.auditLogHash && (
                          <div className="text-[10px] font-mono text-slate-400 truncate">
                            Seal Hash: {record.auditLogHash}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};
