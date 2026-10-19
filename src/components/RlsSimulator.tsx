import { useState, useEffect } from 'react';
import {
  MOCK_TENANTS,
  MOCK_USERS,
  MOCK_CLIENTS,
  MOCK_ORDERS,
  MOCK_TASKS,
  MOCK_INVOICES,
  MOCK_AUDIT_LOGS,
  MOCK_ANNOUNCEMENTS,
  User,
  Tenant
} from '../data/schemaData';
import { ShieldAlert, Play, Database, CheckCircle2, AlertTriangle, HelpCircle, Terminal, RefreshCw, KeyRound, UserCheck, CircleDot } from 'lucide-react';

interface RlsSimulatorProps {
  selectedUserId: string;
  setSelectedUserId: (userId: string) => void;
}

export default function RlsSimulator({ selectedUserId, setSelectedUserId }: RlsSimulatorProps) {
  const [selectedTable, setSelectedTable] = useState<string>('clients');
  const [simulationLogs, setSimulationLogs] = useState<string[]>([]);
  const [queryResults, setQueryResults] = useState<any[]>([]);
  const [activePolicyName, setActivePolicyName] = useState<string>('');
  const [activePolicyCode, setActivePolicyCode] = useState<string>('');
  const [writeSimulationResult, setWriteSimulationResult] = useState<{ status: 'idle' | 'success' | 'error'; message: string }>({ status: 'idle', message: '' });

  // Get active user details
  const activeUser = MOCK_USERS.find(u => u.id === selectedUserId) as User || MOCK_USERS[1];
  const activeTenant = MOCK_TENANTS.find(t => t.id === activeUser.tenant_id) as Tenant;

  // Run simulated SELECT query when user, table, or tenant changes
  const runSimulatedQuery = () => {
    const logs: string[] = [];
    logs.push(`-- 1. Menginisialisasi Sesi Koneksi dari Middleware Server`);
    logs.push(`SET LOCAL app.current_tenant_id = '${activeUser.tenant_id}';`);
    logs.push(`SET LOCAL app.current_user_id = '${activeUser.id}';`);
    logs.push(`SET LOCAL app.current_user_role = '${activeUser.role}';`);
    logs.push(``);
    logs.push(`-- 2. Menjalankan Kueri Aplikasi (Abstraksi ORM / Query Builder)`);
    logs.push(`SELECT * FROM ${selectedTable};`);

    setSimulationLogs(logs);

    let results: any[] = [];
    let appliedPolicy = 'tenant_isolation_policy';
    let policyCode = `tenant_id = current_setting('app.current_tenant_id')::uuid`;

    // Simulate PostgreSQL RLS Filtering engine
    if (selectedTable === 'clients') {
      results = MOCK_CLIENTS.filter(c => c.tenant_id === activeUser.tenant_id);
      appliedPolicy = 'rls_tenant_clients';
    } else if (selectedTable === 'orders') {
      results = MOCK_ORDERS.filter(o => o.tenant_id === activeUser.tenant_id);
      appliedPolicy = 'rls_tenant_orders';
    } else if (selectedTable === 'tasks') {
      results = MOCK_TASKS.filter(t => t.tenant_id === activeUser.tenant_id);
      appliedPolicy = 'rls_tenant_tasks';
    } else if (selectedTable === 'invoices') {
      results = MOCK_INVOICES.filter(i => i.tenant_id === activeUser.tenant_id);
      appliedPolicy = 'rls_invoice_select';
      policyCode = `tenant_id = current_setting('app.current_tenant_id')::uuid`;
    } else if (selectedTable === 'announcements') {
      results = MOCK_ANNOUNCEMENTS.filter(a => {
        const isCorrectTenant = a.tenant_id === activeUser.tenant_id;
        const roleMatches = a.target_role === 'ALL' || a.target_role === activeUser.role || activeUser.role === 'NOTARIS';
        return isCorrectTenant && roleMatches;
      });
      appliedPolicy = 'rls_announcement_select';
      policyCode = `tenant_id = current_setting('app.current_tenant_id')::uuid AND (target_role = 'ALL' OR target_role = current_setting('app.current_user_role') OR current_setting('app.current_user_role') = 'NOTARIS')`;
    } else if (selectedTable === 'audit_logs') {
      results = MOCK_AUDIT_LOGS.filter(al => al.tenant_id === activeUser.tenant_id);
      appliedPolicy = 'rls_audit_select';
      policyCode = `tenant_id = current_setting('app.current_tenant_id')::uuid`;
    }

    setQueryResults(results);
    setActivePolicyName(appliedPolicy);
    setActivePolicyCode(policyCode);
  };

  useEffect(() => {
    runSimulatedQuery();
    setWriteSimulationResult({ status: 'idle', message: '' });
  }, [selectedUserId, selectedTable]);

  // Simulate a write operation (e.g. Delete an invoice or add a client)
  const handleSimulateInsertClient = () => {
    setWriteSimulationResult({
      status: 'success',
      message: `BERHASIL: Klien baru berhasil disimpan! Row Level Security berhasil memvalidasi WITH CHECK CONSTRAINT (tenant_id = '${activeUser.tenant_id}').`
    });
  };

  const handleSimulateDeleteInvoice = () => {
    if (activeUser.role === 'STAFF') {
      setWriteSimulationResult({
        status: 'error',
        message: `POSTGRES_SECURITY_VIOLATION [Error 42501]: Operasi DELETE ditolak oleh RLS Policy "rls_invoice_write". User peran 'STAFF' tidak memiliki hak penulisan keuangan.`
      });
    } else {
      setWriteSimulationResult({
        status: 'success',
        message: `BERHASIL: Transaksi disetujui. Invoice dihapus dari database. Sesi valid untuk Peran '${activeUser.role}' pada Tenant ID '${activeUser.tenant_id}'.`
      });
    }
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
      
      {/* Simulation Controls Sidebar */}
      <div className="xl:col-span-4 space-y-6">
        
        {/* Step 1: Set Active Session Context */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-lg p-5 space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
            <KeyRound className="w-4 h-4 text-indigo-400" />
            <h4 className="font-sans font-bold text-slate-200 text-xs uppercase tracking-wide">1. Sesi Login (Context)</h4>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-2 tracking-wider">Ganti Akun Personil:</label>
            <select
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 font-sans text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium"
            >
              {MOCK_USERS.map((u) => {
                const tenantName = MOCK_TENANTS.find(t => t.id === u.tenant_id)?.company_name.split(' ')[2] || 'Kantor';
                return (
                  <option key={u.id} value={u.id}>
                    {u.name.split(',')[0]} ({u.role} - {tenantName})
                  </option>
                );
              })}
            </select>
          </div>

          {/* Context Badge Cards */}
          <div className="bg-slate-950 border border-slate-800/60 rounded-lg p-3.5 space-y-2.5 text-[10px] font-mono">
            <div className="flex items-center justify-between">
              <span className="text-slate-500">app.current_tenant_id:</span>
              <span className="text-indigo-400 font-bold bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded truncate max-w-[130px]" title={activeUser.tenant_id}>
                {activeUser.tenant_id}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">app.current_user_role:</span>
              <span className="text-amber-400 font-bold bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded">
                {activeUser.role}
              </span>
            </div>
            <div className="flex items-center justify-between border-t border-slate-800/60 pt-2 mt-2 font-sans text-[11px] text-slate-400">
              <div className="flex items-start gap-1.5 min-w-0">
                <CircleDot className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0 mt-0.5" />
                <span className="truncate">Kantor: <strong className="text-slate-200">{activeTenant?.company_name}</strong></span>
              </div>
            </div>
          </div>
        </div>

        {/* Step 2: Choose Query Target */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-lg p-5 space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
            <Database className="w-4 h-4 text-indigo-400" />
            <h4 className="font-sans font-bold text-slate-200 text-xs uppercase tracking-wide">2. Target Query (SELECT)</h4>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {[
              { id: 'clients', label: 'Clients' },
              { id: 'orders', label: 'Orders' },
              { id: 'tasks', label: 'Tasks' },
              { id: 'invoices', label: 'Invoices' },
              { id: 'announcements', label: 'Announcements' },
              { id: 'audit_logs', label: 'Audit Logs' }
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setSelectedTable(t.id)}
                className={`px-3 py-2 text-xs font-semibold rounded-lg text-center transition-all border ${
                  selectedTable === t.id
                    ? 'bg-indigo-600 border-indigo-700 text-white shadow-md'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Step 3: Write Simulation Playground */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-lg p-5 space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
            <ShieldAlert className="w-4 h-4 text-amber-500" />
            <h4 className="font-sans font-bold text-slate-200 text-xs uppercase tracking-wide">3. Uji Coba Write RLS (Simulasi)</h4>
          </div>

          <p className="text-[11px] text-slate-400 font-sans leading-relaxed">
            Uji kekuatan Row Level Security PostgreSQL untuk operasi penulisan berdasarkan peran aktif.
          </p>

          <div className="flex flex-col gap-2 pt-1">
            <button
              onClick={handleSimulateInsertClient}
              className="w-full py-2 bg-slate-950 hover:bg-slate-800 text-slate-300 hover:text-white rounded-lg text-xs font-semibold font-sans transition-all border border-slate-800"
            >
              Simulasikan INSERT Klien Baru
            </button>
            <button
              onClick={handleSimulateDeleteInvoice}
              className="w-full py-2 bg-rose-950/20 hover:bg-rose-950/40 text-rose-400 border border-rose-900/40 rounded-lg text-xs font-semibold font-sans transition-all"
            >
              Simulasikan DELETE Invoice Finansial
            </button>
          </div>

          {/* Write result feedback */}
          {writeSimulationResult.status !== 'idle' && (
            <div className={`p-3 rounded-lg border text-xs font-sans flex items-start gap-2 ${
              writeSimulationResult.status === 'success'
                ? 'bg-emerald-950/40 border-emerald-900/50 text-emerald-300'
                : 'bg-rose-950/40 border-rose-900/50 text-rose-300 font-mono text-[10px] leading-relaxed'
            }`}>
              {writeSimulationResult.status === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
              )}
              <span>{writeSimulationResult.message}</span>
            </div>
          )}
        </div>

      </div>

      {/* Simulator Sandbox Terminal & Results Grid */}
      <div className="xl:col-span-8 flex flex-col gap-6">
        
        {/* Simulated Session Commands Terminal */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-lg overflow-hidden">
          <div className="px-5 py-3 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-amber-500" />
              <span className="font-mono text-xs font-bold text-slate-300">Transaction Session Log (Simulasi RLS)</span>
            </div>
            <span className="text-[10px] font-mono text-slate-500">PostgreSQL Session Context</span>
          </div>

          <div className="p-5 bg-slate-950 font-mono text-xs text-slate-300 space-y-1">
            {simulationLogs.map((log, i) => (
              <div key={i} className={log.startsWith('--') ? 'text-slate-500' : 'text-amber-400'}>
                {log}
              </div>
            ))}
          </div>
        </div>

        {/* Database Query Results Table */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-lg overflow-hidden flex-1 flex flex-col">
          <div className="px-5 py-3.5 bg-slate-950 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-indigo-400" />
              <span className="font-sans font-bold text-slate-200 text-xs uppercase tracking-wide">Hasil Query Output ({queryResults.length} baris)</span>
            </div>
            <div className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold px-2 py-0.5 rounded flex items-center gap-1 font-mono">
              <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>RLS Active Policy: {activePolicyName}</span>
            </div>
          </div>

          {/* Active Policy Constraint banner */}
          <div className="px-5 py-2.5 bg-indigo-950/40 border-b border-indigo-900/60 text-xs font-sans text-indigo-300">
            <strong>Kondisi Policy Terpilih:</strong> <code className="bg-indigo-950 border border-indigo-800 text-indigo-200 font-mono px-1.5 py-0.5 rounded text-[10px]">{activePolicyCode}</code>
          </div>

          {/* Results table */}
          <div className="overflow-x-auto flex-1 p-3 bg-slate-950">
            {queryResults.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-center py-12 px-4">
                <ShieldAlert className="w-8 h-8 text-slate-600 mb-2" />
                <h5 className="font-sans font-bold text-slate-400 text-xs">Tidak Ada Baris Terfilter</h5>
                <p className="text-slate-500 text-[11px] mt-1 max-w-sm font-sans">
                  Row Level Security mengisolasi tenant ini secara total. Tidak ada baris yang dikembalikan karena tenant ID saat ini tidak memiliki kecocokan baris data.
                </p>
              </div>
            ) : (
              <table className="min-w-full divide-y divide-slate-800 text-left">
                <thead className="bg-slate-900/60 font-sans text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  {selectedTable === 'clients' && (
                    <tr>
                      <th className="px-4 py-3">Nama Klien</th>
                      <th className="px-4 py-3">Email</th>
                      <th className="px-4 py-3">No. Telepon</th>
                      <th className="px-4 py-3">Penanggung Jawab</th>
                    </tr>
                  )}
                  {selectedTable === 'orders' && (
                    <tr>
                      <th className="px-4 py-3">ID Order</th>
                      <th className="px-4 py-3">Nama Berkas Akta</th>
                      <th className="px-4 py-3">Klien</th>
                      <th className="px-4 py-3">Status Berkas</th>
                    </tr>
                  )}
                  {selectedTable === 'tasks' && (
                    <tr>
                      <th className="px-4 py-3">Tugas Kerja</th>
                      <th className="px-4 py-3">Order Akta Induk</th>
                      <th className="px-4 py-3">Deskripsi</th>
                      <th className="px-4 py-3">Status</th>
                    </tr>
                  )}
                  {selectedTable === 'invoices' && (
                    <tr>
                      <th className="px-4 py-3">ID Invoice</th>
                      <th className="px-4 py-3">Order Akta</th>
                      <th className="px-4 py-3">Nominal (Rupiah)</th>
                      <th className="px-4 py-3">Tipe</th>
                      <th className="px-4 py-3">Status Tagihan</th>
                    </tr>
                  )}
                  {selectedTable === 'announcements' && (
                    <tr>
                      <th className="px-4 py-3">Judul Pengumuman</th>
                      <th className="px-4 py-3">Konten</th>
                      <th className="px-4 py-3">Target Pembaca</th>
                      <th className="px-4 py-3">Pembuat</th>
                    </tr>
                  )}
                  {selectedTable === 'audit_logs' && (
                    <tr>
                      <th className="px-4 py-3">Waktu Aktivitas</th>
                      <th className="px-4 py-3">Aksi Log</th>
                      <th className="px-4 py-3">Deskripsi Perubahan</th>
                      <th className="px-4 py-3">Pelaku</th>
                    </tr>
                  )}
                </thead>
                <tbody className="divide-y divide-slate-900 text-xs text-slate-300">
                  {selectedTable === 'clients' && queryResults.map((row) => (
                    <tr key={row.id} className="hover:bg-slate-900/40 transition-all">
                      <td className="px-4 py-3 font-semibold text-slate-100">{row.name}</td>
                      <td className="px-4 py-3 font-mono text-[11px] text-slate-400">{row.email}</td>
                      <td className="px-4 py-3 text-slate-400">{row.phone}</td>
                      <td className="px-4 py-3 font-sans font-medium text-indigo-400">{row.assigned_to_user_name}</td>
                    </tr>
                  ))}
                  {selectedTable === 'orders' && queryResults.map((row) => (
                    <tr key={row.id} className="hover:bg-slate-900/40 transition-all">
                      <td className="px-4 py-3 font-mono text-[10px] text-slate-500">{row.id.split('-')[0]}...</td>
                      <td className="px-4 py-3 font-semibold text-slate-100">{row.title}</td>
                      <td className="px-4 py-3 text-slate-400">{row.client_name}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          row.status === 'DONE' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                          row.status === 'ON_PROGRESS' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' :
                          row.status === 'SIGNING' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'bg-slate-800 text-slate-400'
                        }`}>
                          {row.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {selectedTable === 'tasks' && queryResults.map((row) => (
                    <tr key={row.id} className="hover:bg-slate-900/40 transition-all">
                      <td className="px-4 py-3 font-semibold text-slate-100">{row.title}</td>
                      <td className="px-4 py-3 text-slate-400">{row.order_title}</td>
                      <td className="px-4 py-3 text-slate-400 font-sans max-w-xs truncate" title={row.description}>{row.description}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          row.status === 'DONE' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                          row.status === 'ON_PROGRESS' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' : 'bg-slate-800 text-slate-400'
                        }`}>
                          {row.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {selectedTable === 'invoices' && queryResults.map((row) => (
                    <tr key={row.id} className="hover:bg-slate-900/40 transition-all">
                      <td className="px-4 py-3 font-mono text-[10px] text-slate-500">{row.id.split('-')[0]}...</td>
                      <td className="px-4 py-3 text-slate-400">{row.order_title}</td>
                      <td className="px-4 py-3 font-bold text-slate-100">Rp {row.amount.toLocaleString('id-ID')}</td>
                      <td className="px-4 py-3 font-mono text-[10px] font-bold">
                        <span className="bg-amber-500/10 border border-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded">
                          {row.billing_type}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          row.status === 'PAID' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        }`}>
                          {row.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {selectedTable === 'announcements' && queryResults.map((row) => (
                    <tr key={row.id} className="hover:bg-slate-900/40 transition-all">
                      <td className="px-4 py-3 font-semibold text-slate-100">{row.title}</td>
                      <td className="px-4 py-3 text-slate-400 font-sans max-w-xs" title={row.content}>{row.content}</td>
                      <td className="px-4 py-3 font-bold font-mono text-[10px] text-slate-500">{row.target_role}</td>
                      <td className="px-4 py-3 text-indigo-400 font-medium">{row.created_by_name}</td>
                    </tr>
                  ))}
                  {selectedTable === 'audit_logs' && queryResults.map((row) => (
                    <tr key={row.id} className="hover:bg-slate-900/40 transition-all">
                      <td className="px-4 py-3 font-mono text-[10px] text-slate-500">{new Date(row.created_at).toLocaleString('id-ID')}</td>
                      <td className="px-4 py-3 font-bold text-slate-100 font-mono text-[11px]">{row.action}</td>
                      <td className="px-4 py-3 text-slate-400 font-sans max-w-xs">{row.description}</td>
                      <td className="px-4 py-3 font-medium text-indigo-400">{row.user_name}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

      </div>

    </div>
  );
}
