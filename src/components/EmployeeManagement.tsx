import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  UserPlus, 
  Users, 
  ShieldCheck, 
  ShieldAlert, 
  KeyRound, 
  User, 
  X, 
  Check, 
  BadgeCheck, 
  UserX,
  AlertOctagon,
  Edit2,
  Trash2,
  Mail,
  UserCheck,
  Search,
  Eye,
  EyeOff
} from 'lucide-react';
import { mockDb } from '../lib/mockStore';
import { User as UserType } from '../data/schemaData';
import { supabase } from '../lib/supabase';

interface EmployeeManagementProps {
  activeUser: UserType;
  activeTenant: { id: string; company_name: string };
}

export default function EmployeeManagement({ activeUser, activeTenant }: EmployeeManagementProps) {
  const [employees, setEmployees] = useState<UserType[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modals visibility states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<UserType | null>(null);
  const [deletingEmployee, setDeletingEmployee] = useState<UserType | null>(null);

  // Password visibility state
  const [showPassword, setShowPassword] = useState(false);

  // Form states (Add/Edit)
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'FINANCE' | 'STAFF'>('STAFF');

  // Async request and validation feedback states
  const [actionLoading, setActionLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Function to pull employees live from Supabase 'users' table
  const fetchEmployees = async () => {
    setLoading(true);
    setErrorMessage('');
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('tenant_id', activeTenant.id)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      const formatted: UserType[] = (data || []).map((u: any) => ({
        id: u.id,
        tenant_id: u.tenant_id,
        username: u.username || u.email?.split('@')[0] || u.name?.toLowerCase().replace(/\s+/g, ''),
        name: u.name,
        role: u.role,
        email: u.email || `${u.username || u.name?.toLowerCase().replace(/\s+/g, '')}@kantornotaris.com`,
        password: u.password_hash || 'password123'
      }));

      setEmployees(formatted);

      // Keep local mockDb.users in sync so other tabs (e.g. dropdowns) see live users
      const otherTenantsUsers = mockDb.users.filter(u => u.tenant_id !== activeTenant.id);
      mockDb.users = [...otherTenantsUsers, ...formatted];
      mockDb.notify();
    } catch (err: any) {
      console.error('Gagal memuat data karyawan dari Supabase:', err);
      setErrorMessage('Gagal mengambil data karyawan dari database Supabase.');
    } finally {
      setLoading(false);
    }
  };

  // Subscribe/Fetch live data
  useEffect(() => {
    fetchEmployees();
  }, [activeTenant.id]);

  // Fetch current employees/users in the active tenant and filter with search term
  const employeeList = useMemo(() => {
    let list = employees.filter(u => u.tenant_id === activeTenant.id);
    if (searchTerm.trim() !== '') {
      const q = searchTerm.toLowerCase();
      list = list.filter(emp => 
        emp.name.toLowerCase().includes(q) || 
        emp.username.toLowerCase().includes(q) || 
        (emp.email && emp.email.toLowerCase().includes(q))
      );
    }
    return list;
  }, [activeTenant.id, searchTerm, employees]);

  // Dynamic Notaris Utama name fetched from the database
  const notaryName = useMemo(() => {
    const notary = employees.find(e => e.role === 'NOTARIS' && e.tenant_id === activeTenant.id);
    return notary ? notary.name : null;
  }, [employees, activeTenant.id]);

  // Open Add Modal
  const handleOpenAddModal = () => {
    setErrorMessage('');
    setSuccessMessage('');
    setFullName('');
    setUsername('');
    setEmail('');
    setPassword('');
    setRole('STAFF');
    setShowPassword(false);
    setIsAddModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (emp: UserType) => {
    setErrorMessage('');
    setSuccessMessage('');
    setFullName(emp.name);
    setUsername(emp.username);
    setEmail(emp.email || `${emp.username}@kantornotaris.com`);
    setPassword(emp.password || 'password123');
    setRole(emp.role === 'NOTARIS' ? 'STAFF' : emp.role as 'FINANCE' | 'STAFF');
    setShowPassword(false);
    setEditingEmployee(emp);
  };

  // Handle Add Employee (NOTARIS only) - Insert into Supabase LIVE
  const handleAddEmployeeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    // Role Enforcement
    if (activeUser.role !== 'NOTARIS') {
      setErrorMessage('Akses Ditolak: Hanya Notaris Utama yang diizinkan untuk menambahkan karyawan.');
      return;
    }

    if (!fullName.trim() || !username.trim() || !email.trim()) {
      setErrorMessage('Nama Lengkap, Username Sesi, dan Email wajib diisi!');
      return;
    }

    if (username.length < 4) {
      setErrorMessage('Username minimal terdiri dari 4 karakter.');
      return;
    }

    // Check duplicate username inside tenant
    const duplicateUsername = employees.find(
      emp => emp.tenant_id === activeTenant.id && emp.username.toLowerCase() === username.trim().toLowerCase()
    );
    if (duplicateUsername) {
      setErrorMessage(`Username "${username}" sudah digunakan di kantor ini.`);
      return;
    }

    setActionLoading(true);

    try {
      // Direct Supabase query insertion
      const { error } = await supabase.from('users').insert([{
        name: fullName.trim(),
        email: email.trim(),
        role: role,
        tenant_id: activeTenant.id,
        username: username.trim().toLowerCase(),
        password_hash: password || 'password123'
      }]);

      if (error) {
        throw error;
      }

      setSuccessMessage(`Karyawan "${fullName}" berhasil didaftarkan ke Supabase!`);
      setIsAddModalOpen(false);
      
      // Real-time update by re-fetching without reload
      await fetchEmployees();

      // Auto-clear success banner
      setTimeout(() => setSuccessMessage(''), 4000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal mendaftarkan karyawan baru ke server Supabase.');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Edit Employee (NOTARIS only) - Update in Supabase LIVE
  const handleEditEmployeeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (!editingEmployee) return;

    if (activeUser.role !== 'NOTARIS') {
      setErrorMessage('Akses Ditolak: Hanya Notaris Utama yang diizinkan memodifikasi karyawan.');
      return;
    }

    if (!fullName.trim() || !email.trim()) {
      setErrorMessage('Nama Lengkap dan Email wajib diisi!');
      return;
    }

    setActionLoading(true);

    try {
      // Direct Supabase query update
      const { error } = await supabase
        .from('users')
        .update({
          name: fullName.trim(),
          email: email.trim(),
          role: role,
          password_hash: password || 'password123'
        })
        .eq('id', editingEmployee.id);

      if (error) {
        throw error;
      }

      setSuccessMessage(`Data karyawan "${fullName}" berhasil diperbarui di Supabase.`);
      setEditingEmployee(null);

      // Real-time update by re-fetching without reload
      await fetchEmployees();

      // Auto-clear success banner
      setTimeout(() => setSuccessMessage(''), 4000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal memperbarui profil karyawan di Supabase.');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Delete Employee (NOTARIS only) - Delete in Supabase LIVE
  const handleDeleteEmployeeConfirm = async () => {
    if (!deletingEmployee) return;

    if (activeUser.role !== 'NOTARIS') {
      setErrorMessage('Akses Ditolak: Hanya Notaris Utama yang diizinkan untuk menghapus karyawan.');
      return;
    }

    setActionLoading(true);
    setErrorMessage('');

    try {
      // Direct Supabase query deletion
      const { error } = await supabase
        .from('users')
        .delete()
        .eq('id', deletingEmployee.id);

      if (error) {
        throw error;
      }

      setSuccessMessage(`Karyawan "${deletingEmployee.name}" telah dihapus secara permanen dari Supabase.`);
      setDeletingEmployee(null);

      // Real-time update by re-fetching without reload
      await fetchEmployees();

      // Auto-clear success banner
      setTimeout(() => setSuccessMessage(''), 4000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal menghapus karyawan dari database Supabase.');
    } finally {
      setActionLoading(false);
    }
  };

  // Render Loading Spinner
  if (loading) {
    return (
      <div id="loading-container" className="flex flex-col items-center justify-center p-12 bg-slate-900 border border-slate-800 rounded-xl space-y-4 text-center max-w-2xl mx-auto shadow-2xl">
        <div className="w-10 h-10 border-4 border-indigo-600/30 border-t-indigo-500 rounded-full animate-spin" />
        <p className="text-slate-400 text-xs font-sans">Menghubungkan ke Supabase & memuat daftar karyawan...</p>
      </div>
    );
  }



  return (
    <div id="employee-mgmt-container" className="space-y-6">
      
      {/* Search and Quick Action Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-4 rounded-xl shadow-lg">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Cari nama, username, atau email karyawan..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 pl-9 pr-4 py-2 rounded-lg text-slate-100 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        {activeUser.role === 'NOTARIS' && (
          <button
            onClick={handleOpenAddModal}
            className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>Tambah Karyawan Baru</span>
          </button>
        )}
      </div>

      {/* Error Notifications */}
      {errorMessage && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg text-rose-400 text-xs flex items-center gap-2.5"
        >
          <ShieldAlert className="w-5 h-5 shrink-0 text-rose-400" />
          <div className="flex-1">
            <span className="font-bold block uppercase text-[10px] tracking-wider mb-0.5">Database / RLS Policy Error:</span>
            <span>{errorMessage}</span>
          </div>
          <button onClick={() => setErrorMessage('')} className="text-rose-400 hover:text-rose-200">
            <X className="w-4 h-4" />
          </button>
        </motion.div>
      )}

      {/* Success Notifications */}
      {successMessage && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-400 text-xs flex items-center gap-2.5"
        >
          <ShieldCheck className="w-5 h-5 shrink-0 text-emerald-400" />
          <span>{successMessage}</span>
        </motion.div>
      )}

      {/* Employees Table Grid */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
        <div className="px-5 py-4 border-b border-slate-800 flex justify-between items-center bg-slate-900/60">
          <div>
            <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider font-sans flex items-center gap-2">
              <Users className="w-4.5 h-4.5 text-emerald-400" />
              Daftar Karyawan Aktif
            </h3>
            <p className="text-[11px] text-slate-400 mt-1">
              Personil berwenang di bawah kantor {activeTenant.company_name}. Notaris Utama: <strong className="text-indigo-400">{notaryName || 'Memuat...'}</strong>
            </p>
          </div>
          <span className="bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-mono text-[10px] px-2.5 py-0.5 rounded-full font-bold">
            Total: {employeeList.length} Org
          </span>
        </div>

        {employeeList.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-xs font-sans">
            Tidak ada karyawan yang ditemukan untuk pencarian "{searchTerm}"
          </div>
        ) : (
          <div className="divide-y divide-slate-800">
            {employeeList.map((emp) => (
              <div 
                key={emp.id} 
                className="p-4 bg-slate-950/20 hover:bg-slate-950/40 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="flex items-center gap-3.5">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${
                    emp.role === 'NOTARIS' 
                      ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' 
                      : emp.role === 'FINANCE'
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                  }`}>
                    {emp.name.charAt(0)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-100">{emp.name}</span>
                      {emp.role === 'NOTARIS' ? (
                        <span className="bg-rose-500/10 text-[9px] text-rose-400 border border-rose-500/20 px-1.5 py-0.5 rounded font-bold font-mono">
                          NOTARIS UTAMA
                        </span>
                      ) : emp.role === 'FINANCE' ? (
                        <span className="bg-emerald-500/10 text-[9px] text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded font-bold font-mono">
                          FINANCE
                        </span>
                      ) : (
                        <span className="bg-indigo-500/10 text-[9px] text-indigo-400 border border-indigo-500/20 px-1.5 py-0.5 rounded font-bold font-mono">
                          STAFF
                        </span>
                      )}
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-x-3 gap-y-0.5 mt-1 text-[10px] text-slate-400 font-mono">
                      <span>Username: <strong className="text-slate-300">{emp.username}</strong></span>
                      <span className="hidden sm:inline text-slate-700">•</span>
                      <span className="flex items-center gap-1">
                        <Mail className="w-3 h-3 text-slate-500" />
                        {emp.email || `${emp.username}@kantornotaris.com`}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Actions Button */}
                <div className="flex items-center gap-2 self-end sm:self-auto">
                  {activeUser.role === 'NOTARIS' ? (
                    emp.role !== 'NOTARIS' ? (
                      <>
                        <button
                          onClick={() => handleOpenEditModal(emp)}
                          className="bg-slate-900 border border-slate-800 text-slate-300 hover:text-slate-100 hover:bg-slate-800 p-1.5 rounded-lg text-xs transition-all flex items-center gap-1.5 cursor-pointer"
                          title="Edit Profil Karyawan"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                          <span className="text-[10px] font-semibold hidden md:inline">Edit</span>
                        </button>
                        <button
                          onClick={() => {
                            setErrorMessage('');
                            setDeletingEmployee(emp);
                          }}
                          className="bg-rose-950/30 border border-rose-900/30 text-rose-400 hover:text-rose-300 hover:bg-rose-950/60 p-1.5 rounded-lg text-xs transition-all flex items-center gap-1.5 cursor-pointer"
                          title="Hapus Karyawan"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span className="text-[10px] font-semibold hidden md:inline">Hapus</span>
                        </button>
                      </>
                    ) : (
                      <span className="text-[10px] text-slate-500 font-mono italic">Notaris Utama (Owner)</span>
                    )
                  ) : (
                    emp.role === 'NOTARIS' ? (
                      <span className="text-[10px] text-rose-400 font-mono font-bold uppercase tracking-wider">NOTARIS</span>
                    ) : (
                      <span className="text-[10px] text-slate-500 font-mono italic">Terlindungi (Read-Only)</span>
                    )
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Helper Box */}
      <div className="p-4 bg-indigo-500/5 rounded-xl border border-indigo-500/10 text-xs text-slate-400 leading-normal font-sans">
        <h4 className="font-bold text-slate-300 mb-1">💡 Petunjuk Manajemen Karyawan:</h4>
        Setiap data karyawan yang dikonfigurasikan di halaman ini terintegrasi secara dinamis dengan basis data kantor. Begitu Anda mendaftarkan, memperbarui, atau menghapus personil, tindakan ini memicu penulisan instan dengan log audit yang lengkap. Anda juga dapat beralih sesi pengguna di bagian sudut kiri bawah untuk berpindah peran kerja.
      </div>

      {/* --- ADD EMPLOYEE FORM MODAL --- */}
      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-xl shadow-2xl overflow-hidden"
            >
              <div className="px-5 py-4 border-b border-slate-800 flex justify-between items-center bg-slate-950/40">
                <div className="flex items-center gap-2">
                  <UserPlus className="w-5 h-5 text-indigo-400" />
                  <h3 className="font-bold text-slate-100 text-sm font-sans">Daftarkan Karyawan Baru</h3>
                </div>
                <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-slate-200">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleAddEmployeeSubmit} className="p-5 space-y-4 text-xs">
                {errorMessage && (
                  <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg text-rose-400 text-xs flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 shrink-0" />
                    <span>{errorMessage}</span>
                  </div>
                )}

                {/* Full Name */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block font-mono">Nama Lengkap & Gelar</label>
                  <div className="relative">
                    <User className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-500" />
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Contoh: Citra Lestari, S.E. / Budi Santoso"
                      className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                {/* Email */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block font-mono">Alamat Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-500" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Contoh: citra@kantornotaris.com"
                      className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {/* Username */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block font-mono">Username Sesi</label>
                    <input
                      type="text"
                      required
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="citra_finance"
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>

                  {/* Password */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block font-mono">Password</label>
                    <div className="relative">
                      <KeyRound className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-500" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full pl-9 pr-10 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-2 w-5 h-5 flex items-center justify-center text-slate-400 hover:text-slate-200 cursor-pointer"
                        title={showPassword ? "Sembunyikan password" : "Lihat password"}
                      >
                        {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Role Selection */}
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block font-mono">Peran (Role Sistem)</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setRole('STAFF')}
                      className={`p-3 rounded-lg border text-left transition-all cursor-pointer ${
                        role === 'STAFF' 
                          ? 'bg-indigo-600/10 border-indigo-500 text-indigo-400 font-bold' 
                          : 'bg-slate-950 border-slate-850 hover:border-slate-800 text-slate-400'
                      }`}
                    >
                      <div className="font-semibold text-[11px] text-slate-200 mb-0.5">STAFF</div>
                      <div className="text-[9px] text-slate-500 leading-tight">Pengelolaan draf berkas dan akta klien.</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setRole('FINANCE')}
                      className={`p-3 rounded-lg border text-left transition-all cursor-pointer ${
                        role === 'FINANCE' 
                          ? 'bg-emerald-600/10 border-emerald-500 text-emerald-400 font-bold' 
                          : 'bg-slate-950 border-slate-850 hover:border-slate-800 text-slate-400'
                      }`}
                    >
                      <div className="font-semibold text-[11px] text-slate-200 mb-0.5">FINANCE</div>
                      <div className="text-[9px] text-slate-500 leading-tight">Manajemen tagihan keuangan, invoice, & PPh.</div>
                    </button>
                  </div>
                </div>

                {/* Actions Button */}
                <div className="flex gap-3 pt-3 border-t border-slate-800/60">
                  <button
                    type="button"
                    onClick={() => setIsAddModalOpen(false)}
                    className="flex-1 bg-slate-950 border border-slate-800 hover:bg-slate-900 text-slate-300 font-bold py-2 rounded-lg text-xs transition-all uppercase tracking-wide cursor-pointer text-center"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2 rounded-lg text-xs transition-all uppercase tracking-wide cursor-pointer text-center flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    {actionLoading && <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                    <span>Simpan</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- EDIT EMPLOYEE FORM MODAL --- */}
      <AnimatePresence>
        {editingEmployee && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-xl shadow-2xl overflow-hidden"
            >
              <div className="px-5 py-4 border-b border-slate-800 flex justify-between items-center bg-slate-950/40">
                <div className="flex items-center gap-2">
                  <Edit2 className="w-4.5 h-4.5 text-indigo-400" />
                  <h3 className="font-bold text-slate-100 text-sm font-sans">Edit Data Karyawan</h3>
                </div>
                <button onClick={() => setEditingEmployee(null)} className="text-slate-400 hover:text-slate-200">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleEditEmployeeSubmit} className="p-5 space-y-4 text-xs">
                {errorMessage && (
                  <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg text-rose-400 text-xs flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 shrink-0" />
                    <span>{errorMessage}</span>
                  </div>
                )}

                {/* Full Name */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block font-mono">Nama Lengkap & Gelar</label>
                  <div className="relative">
                    <User className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-500" />
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Contoh: Citra Lestari, S.E. / Budi Santoso"
                      className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                {/* Email */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block font-mono">Alamat Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-500" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="citra@kantornotaris.com"
                      className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {/* Username (Locked/Readonly for safety) */}
                  <div className="space-y-1.5 opacity-60">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block font-mono">Username Sesi (Terkunci)</label>
                    <input
                      type="text"
                      disabled
                      value={username}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-850 rounded-lg text-slate-400 text-xs font-mono focus:outline-none cursor-not-allowed"
                    />
                  </div>

                  {/* Password Change Option */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block font-mono">Ganti Password</label>
                    <div className="relative">
                      <KeyRound className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-500" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full pl-9 pr-10 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-2 w-5 h-5 flex items-center justify-center text-slate-400 hover:text-slate-200 cursor-pointer"
                        title={showPassword ? "Sembunyikan password" : "Lihat password"}
                      >
                        {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Role Selection */}
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block font-mono">Peran (Role Sistem)</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setRole('STAFF')}
                      className={`p-3 rounded-lg border text-left transition-all cursor-pointer ${
                        role === 'STAFF' 
                          ? 'bg-indigo-600/10 border-indigo-500 text-indigo-400 font-bold' 
                          : 'bg-slate-950 border-slate-850 hover:border-slate-800 text-slate-400'
                      }`}
                    >
                      <div className="font-semibold text-[11px] text-slate-200 mb-0.5">STAFF</div>
                      <div className="text-[9px] text-slate-500 leading-tight">Pengelolaan draf berkas dan akta klien.</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setRole('FINANCE')}
                      className={`p-3 rounded-lg border text-left transition-all cursor-pointer ${
                        role === 'FINANCE' 
                          ? 'bg-emerald-600/10 border-emerald-500 text-emerald-400 font-bold' 
                          : 'bg-slate-950 border-slate-850 hover:border-slate-800 text-slate-400'
                      }`}
                    >
                      <div className="font-semibold text-[11px] text-slate-200 mb-0.5">FINANCE</div>
                      <div className="text-[9px] text-slate-500 leading-tight">Manajemen tagihan keuangan, invoice, & PPh.</div>
                    </button>
                  </div>
                </div>

                {/* Actions Button */}
                <div className="flex gap-3 pt-3 border-t border-slate-800/60">
                  <button
                    type="button"
                    onClick={() => setEditingEmployee(null)}
                    className="flex-1 bg-slate-950 border border-slate-800 hover:bg-slate-900 text-slate-300 font-bold py-2 rounded-lg text-xs transition-all uppercase tracking-wide cursor-pointer text-center"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2 rounded-lg text-xs transition-all uppercase tracking-wide cursor-pointer text-center flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    {actionLoading && <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                    <span>Simpan Perubahan</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- DELETE CONFIRMATION MODAL --- */}
      <AnimatePresence>
        {deletingEmployee && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-900 border border-slate-800 w-full max-w-sm rounded-xl shadow-2xl p-5 space-y-4"
            >
              <div className="flex items-center gap-3 text-rose-500 border-b border-slate-800 pb-3">
                <Trash2 className="w-6 h-6" />
                <h3 className="font-bold text-slate-100 text-sm font-sans">Konfirmasi Hapus Karyawan</h3>
              </div>

              <div className="space-y-2">
                <p className="text-xs text-slate-300 leading-relaxed">
                  Apakah Anda yakin ingin menghapus akun karyawan <strong>{deletingEmployee.name}</strong> secara permanen dari sistem?
                </p>
                <p className="text-[11px] text-slate-500 font-mono bg-slate-950 p-2 rounded border border-slate-850">
                  Tindakan ini akan menghentikan seluruh hak akses yang dimiliki karyawan ini dan tercatat dalam sistem audit log.
                </p>
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  onClick={() => setDeletingEmployee(null)}
                  className="flex-1 bg-slate-950 border border-slate-800 hover:bg-slate-900 text-slate-300 font-bold py-2 rounded-lg text-xs transition-all uppercase tracking-wide cursor-pointer text-center"
                >
                  Batal
                </button>
                <button
                  onClick={handleDeleteEmployeeConfirm}
                  disabled={actionLoading}
                  className="flex-1 bg-rose-600 hover:bg-rose-500 text-white font-bold py-2 rounded-lg text-xs transition-all uppercase tracking-wide cursor-pointer text-center flex items-center justify-center gap-1"
                >
                  {actionLoading && <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                  <span>Hapus Permanen</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
