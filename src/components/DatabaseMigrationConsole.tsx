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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-zinc-200">
        <div className="min-w-0">
          <h2 className="text-xl font-bold text-zinc-900 tracking-tight">
            Database Engine
          </h2>
          <p className="text-sm text-zinc-500 mt-1 font-medium leading-relaxed">
            Automated PostgreSQL migration lifecycle with advisory locking and SHA-256 checksum integrity.
          </p>
        </div>

        <button
          onClick={handleRunVerify}
          disabled={verifying}
          className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold uppercase tracking-widest rounded-full transition-all flex items-center gap-2 shadow-sm whitespace-nowrap"
        >
          <Play className="w-4 h-4 shrink-0" />
          <span>{verifying ? 'Running...' : 'Verify Schema'}</span>
        </button>
      </div>

      {/* Database Invariants Grid */}
      <div className="space-y-4">
        <div className="flex items-center gap-3 px-1">
          <div className="p-2 bg-emerald-50 rounded-lg">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          </div>
          <h3 className="text-base font-bold text-zinc-900 tracking-tight">
            Financial Integrity Invariants
          </h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {invariants.map((inv) => (
            <div
              key={inv.id}
              className="p-5 bg-white border border-zinc-200 rounded-xl flex flex-col justify-between space-y-4 shadow-sm hover:border-zinc-400 transition-colors"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold font-mono text-zinc-400 uppercase tracking-widest">{inv.code}</span>
                  <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100 uppercase tracking-wider">{inv.status}</span>
                </div>
                <h4 className="text-sm font-bold text-zinc-900 mt-4 tracking-tight">{inv.title}</h4>
                <div className="mt-3 p-3 bg-zinc-50 border border-zinc-100 rounded-lg text-[11px] text-zinc-600 font-mono break-all leading-relaxed">
                  {inv.rule}
                </div>
              </div>
              <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest pt-4 border-t border-zinc-100">
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
            <div className="flex items-center gap-2 p-1 bg-zinc-100 rounded-2xl overflow-x-auto no-scrollbar scroll-smooth">
              {milestones.map((ms) => (
                <button
                  key={ms}
                  onClick={() => setSelectedMilestone(ms)}
                  className={`px-4 py-1.5 text-xs font-bold rounded-xl transition-all whitespace-nowrap min-h-[36px] flex items-center ${
                    selectedMilestone === ms
                      ? 'bg-white text-zinc-900 shadow-sm border border-zinc-200'
                      : 'text-zinc-500 hover:text-zinc-900'
                  }`}
                >
                  {ms}
                </button>
              ))}
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-zinc-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search migrations..."
                className="w-full pl-10 pr-4 py-2.5 bg-zinc-100 border-transparent rounded-xl text-xs text-zinc-900 placeholder:text-zinc-400 focus:bg-white focus:ring-2 focus:ring-emerald-600/20 transition-all"
              />
            </div>
          </div>

          <div className="overflow-hidden border border-zinc-200 rounded-xl bg-white shadow-sm">
            <div className="overflow-x-auto max-w-full">
              <table className="w-full text-left border-collapse text-xs min-w-[620px]">
                <thead>
                  <tr className="bg-zinc-50 border-b border-zinc-200 text-zinc-500">
                    <th className="py-4 px-6 text-[10px] font-bold uppercase tracking-widest">Version</th>
                    <th className="py-4 px-6 text-[10px] font-bold uppercase tracking-widest">Milestone</th>
                    <th className="py-4 px-6 text-[10px] font-bold uppercase tracking-widest">Filename</th>
                    <th className="py-4 px-6 text-[10px] font-bold uppercase tracking-widest text-right">Execution</th>
                    <th className="py-4 px-6 text-[10px] font-bold uppercase tracking-widest text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {filteredMigrations.map((m) => {
                    const isSelected = selectedMigration?.version === m.version;
                    return (
                      <tr
                        key={m.version}
                        onClick={() => setSelectedMigration(m)}
                        className={`cursor-pointer transition-colors ${
                          isSelected ? 'bg-emerald-50/50' : 'hover:bg-zinc-50/50'
                        }`}
                      >
                        <td className="py-4 px-6 font-mono font-bold text-zinc-400 tabular-nums">#{m.version}</td>
                        <td className="py-4 px-6">
                          <span className="px-1.5 py-0.5 bg-zinc-100 text-zinc-600 text-[10px] font-bold rounded font-mono border border-zinc-200">{m.milestone}</span>
                        </td>
                        <td className="py-4 px-6">
                          <div className="font-bold text-zinc-900 text-sm tracking-tight">{m.filename}</div>
                          <div className="text-[11px] text-zinc-500 font-normal mt-0.5">{m.description}</div>
                        </td>
                        <td className="py-4 px-6 font-mono tabular-nums text-right text-zinc-500 font-bold">
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
        <div className="lg:col-span-4 bg-zinc-950 text-white rounded-xl p-8 space-y-6 shadow-2xl sticky top-28 overflow-hidden border border-zinc-800">
          <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-500/5 blur-[80px] rounded-full" />
          <div className="flex items-center justify-between border-b border-white/5 pb-5 relative z-10">
            <div className="flex items-center gap-3">
              <FileCode2 className="w-5 h-5 text-emerald-500" />
              <h4 className="text-xs font-bold uppercase tracking-widest">Schema Inspector</h4>
            </div>
            <span className="text-[10px] font-bold font-mono text-zinc-500 bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800">
              {selectedMigration ? `V${selectedMigration.version}` : ''}
            </span>
          </div>

          {selectedMigration ? (
            <div className="space-y-6 text-xs relative z-10">
              <div className="space-y-2">
                <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Migration Identity</div>
                <div className="font-mono text-zinc-200 font-bold text-[13px] break-all leading-relaxed">{selectedMigration.filename}</div>
              </div>
              
              <div className="grid grid-cols-2 gap-4 bg-zinc-900/50 p-4 rounded-xl border border-white/5 font-mono tabular-nums">
                <div className="space-y-1">
                  <div className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider">Duration</div>
                  <div className="text-zinc-300 font-bold">{selectedMigration.executionMs}ms</div>
                </div>
                <div className="space-y-1 text-right">
                  <div className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider">Checksum</div>
                  <div className="text-zinc-300 truncate">{selectedMigration.checksum.slice(0, 8)}</div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">DDL Preview (Read-Only)</div>
                <pre className="p-5 bg-zinc-900 border border-white/5 rounded-xl text-[12px] font-mono text-emerald-400 overflow-x-auto whitespace-pre-wrap leading-relaxed shadow-inner h-[240px] custom-scrollbar">
                  {selectedMigration.sqlPreview}
                </pre>
              </div>

              <div className="p-4 bg-emerald-500/5 border border-emerald-500/10 rounded-xl space-y-2">
                <div className="font-bold text-emerald-500 flex items-center gap-2 text-[10px] uppercase tracking-widest">
                  <Database className="w-3.5 h-3.5" />
                  <span>Transactional Lock Active</span>
                </div>
                <p className="text-[11px] text-zinc-500 leading-relaxed font-normal">
                  Prevents schema corruption during concurrent deployment rollouts.
                </p>
              </div>
            </div>
          ) : (
            <div className="text-xs text-zinc-500 font-bold uppercase tracking-widest flex items-center gap-3 py-12 justify-center opacity-40">
              <ShieldAlert className="w-5 h-5" />
              <span>Select Migration</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
