import React, { useState } from 'react';
import { Database, CheckCircle2, ShieldAlert, Play, FileCode2, Search } from 'lucide-react';
import { MigrationItem, DbInvariant } from '../types/prodx';

interface DatabaseMigrationConsoleProps {
  migrations: MigrationItem[];
  invariants: DbInvariant[];
  onVerifyMigrations: () => Promise<void>;
}

export const DatabaseMigrationConsole: React.FC<DatabaseMigrationConsoleProps> = ({
  migrations,
  invariants,
  onVerifyMigrations,
}) => {
  const [selectedMilestone, setSelectedMilestone] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [verifying, setVerifying] = useState(false);
  const [selectedMigration, setSelectedMigration] = useState<MigrationItem | null>(migrations[29] || migrations[0] || null);

  const milestones = ['ALL', 'M0', 'M1', 'M1.1', 'M1.2', 'M1.3', 'M2', 'M3', 'M4', 'M5', 'M6'];

  const filteredMigrations = migrations.filter((m) => {
    const matchesMilestone = selectedMilestone === 'ALL' || m.milestone === selectedMilestone;
    const q = searchQuery.trim().toLowerCase();
    const matchesSearch =
      !q ||
      m.filename.toLowerCase().includes(q) ||
      m.description.toLowerCase().includes(q) ||
      m.version.includes(q);
    return matchesMilestone && matchesSearch;
  });

  const handleRunVerify = async () => {
    setVerifying(true);
    try {
      await onVerifyMigrations();
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="space-y-8 max-w-full overflow-hidden">
      {/* Header & Automated Verification Trigger */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8 pb-10 border-b border-slate-200">
        <div className="min-w-0 flex items-center gap-6">
          <div className="p-4 bg-emerald-50 rounded-2xl shrink-0 border border-emerald-100/50">
            <Database className="w-8 h-8 text-emerald-600" />
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-3 text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">
              <span className="text-emerald-600">PostgreSQL 16.4</span>
              <span aria-hidden="true" className="text-slate-200">/</span>
              <span>SHA-256 Checksum Verified</span>
            </div>
            <h2 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight [text-wrap:balance]">
              Database Migration Engine
            </h2>
            <p className="text-sm md:text-base text-slate-500 font-medium leading-relaxed max-w-2xl [text-wrap:balance]">
              Automated schema lifecycle management with advisory locking, atomic transitions, 
              and real-time financial invariant enforcement.
            </p>
          </div>
        </div>

        <button
          onClick={handleRunVerify}
          disabled={verifying}
          className="px-6 py-3.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-bold uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-3 shadow-lg shadow-emerald-600/20 active:scale-95 whitespace-nowrap"
        >
          <Play className="w-4 h-4 shrink-0" />
          <span>{verifying ? 'Verifying Integrity...' : 'Verify Schema'}</span>
        </button>
      </div>

      {/* Database Invariants Grid */}
      <div className="space-y-4">
        <div className="flex items-center gap-3 px-1">
          <div className="p-2 bg-emerald-50 rounded-lg">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          </div>
          <h3 className="text-base font-bold text-slate-900 tracking-tight">
            Financial Integrity Invariants
          </h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {invariants.map((inv) => (
            <div
              key={inv.id}
              className="p-5 bg-white border border-slate-200 rounded-xl flex flex-col justify-between space-y-4 shadow-sm hover:border-emerald-600/30 transition-colors"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold font-mono text-slate-500 uppercase tracking-widest">{inv.code}</span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase tracking-wider">
                    {inv.status}
                  </span>
                </div>
                <h4 className="text-sm font-bold text-slate-900 mt-4 tracking-tight">{inv.title}</h4>
                <div className="mt-3 p-3 bg-slate-50 border border-slate-100 rounded-lg text-[11px] text-slate-600 font-mono break-all leading-relaxed">
                  {inv.rule}
                </div>
              </div>
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pt-4 border-t border-slate-100 font-mono tabular-nums">
                Verified: {new Date(inv.lastVerifiedAt).toLocaleTimeString('th-TH', { hour12: false })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Filter Bar & SQL Inspector Split View */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-8 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-1 p-1 bg-slate-100/80 rounded-xl border border-slate-200/60 overflow-x-auto no-scrollbar scroll-smooth">
              {milestones.map((ms) => {
                const isActive = selectedMilestone === ms;
                return (
                  <button
                    key={ms}
                    onClick={() => setSelectedMilestone(ms)}
                    className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all whitespace-nowrap min-h-[36px] flex items-center ${
                      isActive
                        ? 'bg-white text-slate-900 shadow-sm border border-slate-200/60 font-bold'
                        : 'text-slate-500 hover:text-slate-900 hover:bg-white/60'
                    }`}
                  >
                    {ms}
                  </button>
                );
              })}
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search migrations..."
                className="w-full pl-10 pr-4 py-2.5 bg-slate-100 border-transparent rounded-2xl text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-emerald-600/20 transition-all"
              />
            </div>
          </div>

          <div className="overflow-hidden border border-slate-200 rounded-xl bg-white shadow-sm">
            <div className="overflow-x-auto max-w-full">
              <table className="w-full text-left border-collapse text-xs min-w-[620px]">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500">
                    <th className="py-4 px-6 text-[10px] font-bold uppercase tracking-widest">Version</th>
                    <th className="py-4 px-6 text-[10px] font-bold uppercase tracking-widest">Milestone</th>
                    <th className="py-4 px-6 text-[10px] font-bold uppercase tracking-widest">Filename</th>
                    <th className="py-4 px-6 text-[10px] font-bold uppercase tracking-widest text-right">Execution</th>
                    <th className="py-4 px-6 text-[10px] font-bold uppercase tracking-widest text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredMigrations.map((m) => {
                    const isSelected = selectedMigration?.version === m.version;
                    return (
                      <tr
                        key={m.version}
                        onClick={() => setSelectedMigration(m)}
                        className={`cursor-pointer transition-colors ${
                          isSelected ? 'bg-emerald-50/50' : 'hover:bg-slate-50/50'
                        }`}
                      >
                        <td className="py-4 px-6 font-mono font-bold text-slate-500 tabular-nums">#{m.version}</td>
                        <td className="py-4 px-6">
                          <span className="px-1.5 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-bold rounded font-mono border border-slate-200">{m.milestone}</span>
                        </td>
                        <td className="py-4 px-6">
                          <div className="font-bold text-slate-900 text-sm tracking-tight">{m.filename}</div>
                          <div className="text-[11px] text-slate-500 font-normal mt-0.5">{m.description}</div>
                        </td>
                        <td className="py-4 px-6 font-mono tabular-nums text-right text-slate-500 font-bold">
                          {m.executionMs}ms
                        </td>
                        <td className="py-4 px-6 text-right whitespace-nowrap">
                          <span className="inline-flex items-center gap-1.5 text-emerald-600 font-bold uppercase text-[10px] tracking-wider">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            {m.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right 4 Cols: SQL DDL Preview & Lock Status */}
        <div className="lg:col-span-4 bg-white border border-slate-200 rounded-2xl p-8 space-y-6 shadow-xl sticky top-28 overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 pb-5 relative z-10">
            <div className="flex items-center gap-3">
              <FileCode2 className="w-5 h-5 text-emerald-600" />
              <h4 className="text-xs font-bold uppercase tracking-widest text-slate-900">Schema Inspector</h4>
            </div>
            <span className="text-[10px] font-bold font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
              {selectedMigration ? `V${selectedMigration.version}` : ''}
            </span>
          </div>

          {selectedMigration ? (
            <div className="space-y-6 text-xs relative z-10">
              <div className="space-y-2">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Migration Identity</div>
                <div className="font-mono text-slate-900 font-bold text-[13px] break-all leading-relaxed">{selectedMigration.filename}</div>
              </div>
              
              <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100 font-mono tabular-nums">
                <div className="space-y-1">
                  <div className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Duration</div>
                  <div className="text-slate-900 font-bold">{selectedMigration.executionMs}ms</div>
                </div>
                <div className="space-y-1 text-right">
                  <div className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Checksum</div>
                  <div className="text-slate-900 font-bold truncate">{selectedMigration.checksum.slice(0, 8)}</div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">DDL Preview (Read-Only)</div>
                <pre className="p-5 bg-slate-50 border border-slate-200 rounded-xl text-[12px] font-mono text-emerald-700 overflow-x-auto whitespace-pre-wrap leading-relaxed shadow-inner h-[240px] custom-scrollbar">
                  {selectedMigration.sqlPreview}
                </pre>
              </div>

              <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl space-y-2">
                <div className="font-bold text-emerald-700 flex items-center gap-2 text-[10px] uppercase tracking-widest">
                  <Database className="w-3.5 h-3.5" />
                  <span>Transactional Lock Active</span>
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed font-normal">
                  Prevents schema corruption during concurrent deployment rollouts.
                </p>
              </div>
            </div>
          ) : (
            <div className="text-xs text-slate-500 font-bold uppercase tracking-widest flex items-center gap-3 py-12 justify-center opacity-40">
              <ShieldAlert className="w-5 h-5" />
              <span>Select Migration</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
