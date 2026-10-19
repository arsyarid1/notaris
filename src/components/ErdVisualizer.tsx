import { useState } from 'react';
import { Database, Key, Link as LinkIcon, Eye, Zap, ShieldCheck, ChevronRight, HelpCircle } from 'lucide-react';
import { TABLES_METADATA, DbTable } from '../data/schemaData';

export default function ErdVisualizer() {
  const [selectedTable, setSelectedTable] = useState<DbTable>(TABLES_METADATA[0]);

  // Helper to determine relationships for selected table
  const getTableRelations = (tableName: string) => {
    const outgoing: { fromCol: string; toTable: string; toCol: string }[] = [];
    const incoming: { fromTable: string; fromCol: string; toCol: string }[] = [];

    // Find outgoing relationships (foreign keys in the selected table)
    selectedTable.columns.forEach(col => {
      col.constraints.forEach(constraint => {
        if (constraint.includes('REFERENCES')) {
          const match = constraint.match(/REFERENCES\s+(\w+)\((\w+)\)/i);
          if (match) {
            outgoing.push({
              fromCol: col.name,
              toTable: match[1],
              toCol: match[2]
            });
          }
        }
      });
    });

    // Find incoming relationships (other tables referencing this table)
    TABLES_METADATA.forEach(table => {
      if (table.name === tableName) return;
      table.columns.forEach(col => {
        col.constraints.forEach(constraint => {
          if (constraint.includes('REFERENCES')) {
            const match = constraint.match(/REFERENCES\s+(\w+)\((\w+)\)/i);
            if (match && match[1] === tableName) {
              incoming.push({
                fromTable: table.name,
                fromCol: col.name,
                toCol: match[2]
              });
            }
          }
        });
      });
    });

    return { outgoing, incoming };
  };

  const { outgoing, incoming } = getTableRelations(selectedTable.name);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      
      {/* Sidebar - Tables List */}
      <div className="lg:col-span-4 bg-slate-900 border border-slate-800 rounded-xl shadow-lg overflow-hidden flex flex-col h-[650px]">
        <div className="px-5 py-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-indigo-400 animate-pulse" />
            <span className="font-sans font-bold text-slate-200 text-xs tracking-wider uppercase">Daftar Tabel ({TABLES_METADATA.length})</span>
          </div>
          <span className="text-[10px] bg-indigo-500/10 text-indigo-400 font-semibold px-2 py-0.5 rounded-full font-mono border border-indigo-500/20">Postgres</span>
        </div>
        
        <div className="flex-1 overflow-y-auto p-3 space-y-1.5 custom-scrollbar bg-slate-950/40">
          {TABLES_METADATA.map((table) => {
            const isSelected = selectedTable.name === table.name;
            return (
              <button
                key={table.name}
                onClick={() => setSelectedTable(table)}
                className={`w-full text-left px-4 py-3 rounded-lg flex items-center justify-between transition-all group border ${
                  isSelected
                    ? 'bg-indigo-600 border-indigo-700 text-white shadow-md'
                    : 'bg-slate-900/60 border-slate-800/40 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                <div className="flex flex-col min-w-0 pr-2">
                  <span className={`font-mono text-xs font-semibold truncate ${isSelected ? 'text-white' : 'text-slate-200'}`}>
                    {table.name}
                  </span>
                  <span className={`text-[10px] truncate mt-1 ${isSelected ? 'text-indigo-200' : 'text-slate-500'}`}>
                    {table.description}
                  </span>
                </div>
                <ChevronRight className={`w-3.5 h-3.5 flex-shrink-0 transition-transform ${
                  isSelected ? 'translate-x-0.5 text-white' : 'text-slate-500 group-hover:text-slate-300'
                }`} />
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Panel - Table details and ERD viz */}
      <div className="lg:col-span-8 flex flex-col gap-6">
        
        {/* Table Overview & Columns */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-lg p-6">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-800 pb-5">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xl font-bold text-slate-100 tracking-tight">{selectedTable.name}</span>
                <span className="bg-slate-800 text-slate-400 font-mono text-[9px] uppercase font-bold tracking-wider px-2 py-0.5 rounded border border-slate-700">
                  {selectedTable.columns.length} kolom
                </span>
              </div>
              <p className="text-slate-400 font-sans text-xs mt-2.5 leading-relaxed">
                {selectedTable.description}
              </p>
            </div>
          </div>

          {/* Column list */}
          <div className="mt-5">
            <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-3 font-sans">Kamus Data / Struktur Kolom</h4>
            <div className="border border-slate-800 rounded-xl overflow-hidden shadow-sm bg-slate-950">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-800 text-left">
                  <thead className="bg-slate-900 font-sans text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    <tr>
                      <th className="px-4 py-3 w-[220px]">Nama Kolom</th>
                      <th className="px-4 py-3 w-[140px]">Tipe Data</th>
                      <th className="px-4 py-3">Deskripsi & Constraints</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 font-mono text-xs text-slate-300">
                    {selectedTable.columns.map((col) => {
                      const isPK = col.constraints.some(c => c.includes('PRIMARY KEY'));
                      const isFK = col.constraints.some(c => c.includes('REFERENCES'));
                      return (
                        <tr key={col.name} className="hover:bg-slate-900/30 transition-colors">
                          <td className="px-4 py-3 font-bold flex items-center gap-2 text-slate-100">
                            {isPK && <Key className="w-3.5 h-3.5 text-amber-400 fill-amber-400/10" title="Primary Key" />}
                            {isFK && <LinkIcon className="w-3.5 h-3.5 text-indigo-400" title="Foreign Key" />}
                            {!isPK && !isFK && <span className="w-3.5 h-3.5 block shrink-0" />}
                            <span className="truncate">{col.name}</span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="bg-slate-800 border border-slate-700 text-slate-300 px-1.5 py-0.5 rounded text-[11px] font-medium font-mono">
                              {col.type}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-slate-400 font-sans">
                            <div className="font-medium text-slate-300 mb-1 text-xs">{col.description}</div>
                            {col.constraints.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1.5 font-mono text-[9px]">
                                {col.constraints.map((cons, i) => (
                                  <span key={i} className="bg-amber-500/10 text-amber-400 border border-amber-500/20 px-1 py-0.2 rounded font-bold">
                                    {cons}
                                  </span>
                                ))}
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        {/* Visual Relationship Diagram for Selected Table */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-lg p-6">
          <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-4 font-sans">Visualisasi Hubungan (Schema Graph)</h4>
          <div className="bg-slate-950 rounded-xl border border-slate-800 p-6 flex flex-col md:flex-row items-center justify-center gap-8 min-h-[160px]">
            
            {/* Incoming tables */}
            <div className="flex flex-col gap-2 w-full md:w-1/3">
              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest text-center mb-1">Referenced By (Incoming)</span>
              {incoming.length === 0 ? (
                <div className="text-center text-[11px] text-slate-600 py-4 border border-dashed border-slate-800 rounded-lg">Tidak ada referensi masuk</div>
              ) : (
                incoming.map((inc, i) => (
                  <div key={i} className="bg-slate-900 border border-slate-800/80 p-2.5 rounded-lg shadow-sm flex flex-col text-center">
                    <span className="font-mono text-xs font-semibold text-indigo-400">{inc.fromTable}</span>
                    <span className="text-[9px] text-slate-500 font-mono mt-0.5">({inc.fromCol} → {inc.toCol})</span>
                  </div>
                ))
              )}
            </div>

            {/* Selected Table Node */}
            <div className="flex items-center justify-center text-center w-full md:w-1/3 py-4 md:py-0 border-y md:border-y-0 md:border-x border-slate-800 px-4">
              <div className="bg-indigo-600 border border-indigo-700 px-5 py-3.5 rounded-xl shadow-lg text-white w-full max-w-[200px]">
                <span className="font-sans font-bold text-[9px] uppercase tracking-widest text-indigo-200 block mb-1">Active Node</span>
                <span className="font-mono text-xs font-bold block truncate">{selectedTable.name}</span>
              </div>
            </div>

            {/* Outgoing tables */}
            <div className="flex flex-col gap-2 w-full md:w-1/3">
              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest text-center mb-1">References (Outgoing FK)</span>
              {outgoing.length === 0 ? (
                <div className="text-center text-[11px] text-slate-600 py-4 border border-dashed border-slate-800 rounded-lg">Tidak ada referensi keluar</div>
              ) : (
                outgoing.map((out, i) => (
                  <div key={i} className="bg-slate-900 border border-slate-800/80 p-2.5 rounded-lg shadow-sm flex flex-col text-center">
                    <span className="font-mono text-xs font-semibold text-amber-400">{out.toTable}</span>
                    <span className="text-[9px] text-slate-500 font-mono mt-0.5">({out.fromCol} → {out.toCol})</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Security Policies (RLS) & Performance Indexes */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Index Section */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-lg p-6">
            <div className="flex items-center gap-2 mb-4">
              <Zap className="w-4 h-4 text-amber-400" />
              <h4 className="text-xs font-bold text-slate-200 font-sans uppercase tracking-wider">Database Indexes</h4>
            </div>
            <div className="space-y-2">
              {selectedTable.indexes.map((idx, i) => (
                <div key={i} className="bg-slate-950 border border-slate-800 rounded-lg p-3 font-mono text-[10px] text-slate-300 break-all leading-relaxed">
                  {idx}
                </div>
              ))}
              <div className="text-[11px] text-slate-400 mt-3 font-sans flex items-start gap-1.5 leading-relaxed">
                <HelpCircle className="w-3.5 h-3.5 text-slate-500 flex-shrink-0 mt-0.5" />
                <span>Diindeks eksplisit pada <code className="bg-slate-950 border border-slate-800 text-slate-300 px-1 py-0.2 rounded font-mono text-[10px]">tenant_id</code> untuk mengoptimalkan Row Level Security (RLS).</span>
              </div>
            </div>
          </div>

          {/* RLS Policy Section */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-lg p-6">
            <div className="flex items-center gap-2 mb-4">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <h4 className="text-xs font-bold text-slate-200 font-sans uppercase tracking-wider">Row Level Security (RLS) Policies</h4>
            </div>
            <div className="space-y-3">
              {selectedTable.rlsPolicies.map((policy, i) => (
                <div key={i} className="border border-slate-800 rounded-lg p-3.5 bg-emerald-500/5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-slate-100 font-mono truncate mr-2" title={policy.name}>{policy.name}</span>
                    <span className="text-[9px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold px-1.5 py-0.2 rounded">
                      {policy.action}
                    </span>
                  </div>
                  <p className="text-slate-400 text-[11px] mt-2 leading-relaxed">
                    {policy.description}
                  </p>
                  <div className="bg-slate-950 text-amber-400 font-mono text-[10px] p-2 rounded-lg border border-slate-800 mt-2.5 break-all select-all leading-relaxed">
                    USING ({policy.usingExp})
                    {policy.withCheckExp && `\nWITH CHECK (${policy.withCheckExp})`}
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
