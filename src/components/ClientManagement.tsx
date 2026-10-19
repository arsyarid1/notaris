import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, 
  Plus, 
  Search, 
  User, 
  Mail, 
  Phone, 
  Edit2, 
  Trash2, 
  X, 
  Check, 
  Briefcase, 
  ShieldAlert, 
  Filter,
  Loader2
} from 'lucide-react';
import { mockDb } from '../lib/mockStore';
import { Client, User as UserType } from '../data/schemaData';
import { supabase } from '../lib/supabase';

interface ClientManagementProps {
  activeUser: UserType;
  activeTenant: { id: string; company_name: string };
}

export default function ClientManagement({ activeUser, activeTenant }: ClientManagementProps) {
  const [storeTick, setStoreTick] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modal & Toast states
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [clientToDelete, setClientToDelete] = useState<Client | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  
  // Form states
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    assigned_to_user_name: ''
  });
  
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Helper to show floating toast
  const showToast = (type: 'success' | 'error', text: string) => {
    setToastMessage({ type, text });
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  // Subscribe to reactive store & Supabase Realtime channel
  useEffect(() => {
    mockDb.fetchAndSyncAll();
    mockDb.setupRealtimeSubscriptions();

    const unsubscribe = mockDb.subscribe(() => {
      setStoreTick(prev => prev + 1);
    });

    const channel = supabase
      .channel('realtime-clients-channel')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'clients' },
        (payload) => {
          console.log('Realtime change on clients detected in ClientManagement:', payload);
          mockDb.fetchAndSyncAll();
        }
      )
      .subscribe();

    return () => {
      unsubscribe();
      supabase.removeChannel(channel);
    };
  }, []);

  // Fetch tenant users (for assignment selection)
  const staffList = useMemo(() => {
    return mockDb.users.filter(u => u.tenant_id === activeTenant.id);
  }, [activeTenant.id, storeTick]);

  // Fetch and filter clients
  const clientList = useMemo(() => {
    let list = mockDb.clients.filter(c => c.tenant_id === activeTenant.id || c.tenant_id === activeUser.tenant_id || !c.tenant_id);
    
    // STAFF can only see their assigned or unassigned clients
    if (activeUser.role === 'STAFF') {
      list = list.filter(c => 
        !c.assigned_to_user_name || 
        c.assigned_to_user_name === 'Belum Ditugaskan' || 
        c.assigned_to_user_name.toLowerCase().includes(activeUser.name.toLowerCase())
      );
    }
    
    // Search query filter
    if (searchQuery.trim() !== '') {
      const query = searchQuery.toLowerCase();
      list = list.filter(c => 
        c.name.toLowerCase().includes(query) || 
        c.email.toLowerCase().includes(query) || 
        c.phone.includes(query) ||
        c.assigned_to_user_name.toLowerCase().includes(query)
      );
    }
    
    return list;
  }, [activeTenant.id, activeUser, searchQuery, storeTick]);

  // Handle open add modal
  const openAddModal = () => {
    setFormData({
      name: '',
      email: '',
      phone: '',
      assigned_to_user_name: staffList[0]?.name || activeUser.name
    });
    setErrorMessage('');
    setSuccessMessage('');
    setIsAddOpen(true);
  };

  // Handle open edit modal
  const openEditModal = (client: Client) => {
    setEditingClient(client);
    setFormData({
      name: client.name,
      email: client.email || '',
      phone: client.phone || '',
      assigned_to_user_name: client.assigned_to_user_name
    });
    setErrorMessage('');
    setSuccessMessage('');
  };

  // Form Submit (Add/Edit)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (!formData.name || !formData.name.trim()) {
      const msg = 'Nama klien/instansi wajib diisi!';
      setErrorMessage(msg);
      showToast('error', msg);
      return;
    }

    setIsSubmitting(true);

    try {
      const cleanName = formData.name.trim();
      const cleanEmail = formData.email && formData.email.trim() !== '' ? formData.email.trim() : '';
      const cleanPhone = formData.phone && formData.phone.trim() !== '' ? formData.phone.trim() : '';
      const assignedTo = formData.assigned_to_user_name || activeUser?.name || 'Belum Ditugaskan';
      const tenantId = activeTenant?.id || activeUser?.tenant_id || 'a0000000-0000-0000-0000-000000000001';

      if (editingClient) {
        await mockDb.updateClient(
          tenantId,
          editingClient.id,
          cleanName,
          cleanEmail,
          cleanPhone,
          assignedTo
        );
        const msg = 'Data klien berhasil diperbarui!';
        setSuccessMessage(msg);
        showToast('success', msg);
        setTimeout(() => setEditingClient(null), 800);
      } else {
        await mockDb.addClient(
          tenantId,
          cleanName,
          cleanEmail,
          cleanPhone,
          assignedTo
        );
        const msg = 'Klien baru berhasil ditambahkan!';
        setSuccessMessage(msg);
        showToast('success', msg);
        setTimeout(() => setIsAddOpen(false), 800);
      }
    } catch (err: any) {
      console.warn('Notice saat memproses data klien:', err);
      const errMsg = err.message || 'Terjadi kesalahan sistem saat menyimpan data klien.';
      setErrorMessage(errMsg);
      showToast('error', errMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete Client Handler
  const confirmDelete = async () => {
    if (!clientToDelete) return;
    setIsDeleting(true);
    try {
      await mockDb.deleteClient(activeTenant.id, clientToDelete.id, activeUser.name);
      const msg = `Klien "${clientToDelete.name}" berhasil dihapus dari sistem.`;
      showToast('success', msg);
      setClientToDelete(null);
    } catch (err: any) {
      console.warn('Gagal menghapus klien:', err);
      const errMsg = err.message || 'Gagal menghapus data klien.';
      showToast('error', errMsg);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div id="client-mgmt-container" className="space-y-6 relative">
      {/* Floating Toast Notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className={`fixed top-5 right-5 z-[100] px-4 py-3 rounded-xl shadow-2xl border flex items-center gap-3 text-xs font-semibold max-w-md ${
              toastMessage.type === 'success'
                ? 'bg-emerald-950/95 border-emerald-500/40 text-emerald-200'
                : 'bg-rose-950/95 border-rose-500/40 text-rose-200'
            }`}
          >
            {toastMessage.type === 'success' ? (
              <Check className="w-5 h-5 text-emerald-400 shrink-0" />
            ) : (
              <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0" />
            )}
            <span>{toastMessage.text}</span>
            <button onClick={() => setToastMessage(null)} className="ml-auto text-slate-400 hover:text-slate-100 p-1">
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header Panel */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-500/10 text-indigo-400 p-2.5 rounded-lg border border-indigo-500/20">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                Manajemen Klien Kantor Notaris
              </h2>
              <p className="text-xs text-slate-400">
                Penyekatan Row-Level Security: {activeUser.role === 'STAFF' ? 'Diperketat (Milik Pribadi)' : 'Hak Akses Penuh'}
              </p>
            </div>
          </div>
          
          <button
            onClick={openAddModal}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-medium text-xs rounded-lg shadow transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Daftarkan Klien Baru
          </button>
        </div>

        {/* Info Box */}
        <div className="mt-4 p-3 bg-indigo-500/5 rounded-lg border border-indigo-500/10 text-[11px] text-slate-400 flex items-start gap-2 leading-relaxed">
          <Filter className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
          <div>
            {activeUser.role === 'STAFF' ? (
              <span>Sesuai aturan keamanan RLS Postgres, Anda masuk dengan peran <strong>STAFF</strong>. Sistem membatasi tampilan agar Anda <strong>hanya melihat klien yang ditugaskan kepada Anda</strong> ({activeUser.name}).</span>
            ) : (
              <span>Sesuai aturan RLS Postgres, peran Anda sebagai <strong>{activeUser.role}</strong> memiliki hak administratif untuk <strong>melihat seluruh data klien</strong> di bawah kantor {activeTenant.company_name}.</span>
            )}
          </div>
        </div>
      </div>

      {/* Filter and Search */}
      <div className="flex items-center bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 shadow-inner">
        <Search className="w-4 h-4 text-slate-500 shrink-0 mr-3" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Cari berdasarkan nama klien, email, telepon, atau staf penanggung jawab..."
          className="bg-transparent text-slate-200 placeholder:text-slate-500 focus:outline-none text-xs w-full font-sans"
        />
        {searchQuery && (
          <button onClick={() => setSearchQuery('')} className="text-slate-500 hover:text-slate-300">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Clients Table/Grid */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow">
        {clientList.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <Users className="w-12 h-12 text-slate-700 mx-auto mb-3" />
            <p className="text-sm font-medium text-slate-400">Tidak ada data klien ditemukan</p>
            <p className="text-xs text-slate-600 mt-1">Coba sesuaikan pencarian Anda atau tambahkan klien baru.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/40 text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">
                  <th className="py-3 px-6">Nama Klien / Perusahaan</th>
                  <th className="py-3 px-6">Informasi Kontak</th>
                  <th className="py-3 px-6">Staf Penanggung Jawab</th>
                  <th className="py-3 px-6 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-xs">
                {clientList.map((client) => (
                  <tr key={client.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-3.5 px-6 font-medium text-slate-200">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-indigo-400 font-bold font-mono">
                          {client.name.charAt(0)}
                        </div>
                        <div>
                          <span className="block font-semibold text-slate-200">{client.name}</span>
                          <span className="text-[10px] text-slate-500 font-mono">ID: {client.id}</span>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-6 space-y-1">
                      <div className="flex items-center gap-1.5 text-slate-300">
                        <Mail className="w-3.5 h-3.5 text-slate-500" />
                        <span>{client.email}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-slate-400">
                        <Phone className="w-3.5 h-3.5 text-slate-500" />
                        <span>{client.phone}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-6">
                      <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-slate-950 border border-slate-800 text-slate-300">
                        <User className="w-3.5 h-3.5 text-indigo-400" />
                        {client.assigned_to_user_name}
                      </span>
                    </td>
                    <td className="py-3.5 px-6">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => openEditModal(client)}
                          className="p-1.5 hover:bg-indigo-600/15 hover:text-indigo-400 text-slate-400 rounded transition-all cursor-pointer"
                          title="Edit Klien"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setClientToDelete(client)}
                          className="p-1.5 hover:bg-rose-500/15 hover:text-rose-400 text-slate-400 rounded transition-all cursor-pointer"
                          title="Hapus Klien"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ADD / EDIT MODAL */}
      <AnimatePresence>
        {(isAddOpen || editingClient) && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-900 border border-slate-800 rounded-xl p-6 w-full max-w-md shadow-2xl relative"
            >
              <button
                onClick={() => { setIsAddOpen(false); setEditingClient(null); }}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>

              <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider font-sans mb-4 flex items-center gap-2">
                <Users className="w-4 h-4 text-indigo-400" />
                {editingClient ? 'Ubah Data Klien' : 'Daftarkan Klien Baru'}
              </h3>

              <form onSubmit={handleSubmit} className="space-y-4">
                {errorMessage && (
                  <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg text-rose-400 text-xs flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 shrink-0" />
                    <span>{errorMessage}</span>
                  </div>
                )}

                {successMessage && (
                  <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-400 text-xs flex items-center gap-2">
                    <Check className="w-4 h-4 shrink-0" />
                    <span>{successMessage}</span>
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Nama Klien / Instansi</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Contoh: PT Indonesia Raya / Siti Rahmah"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Email Korespondensi</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="Contoh: klien@email.com"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Nomor Telepon (WhatsApp)</label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                    placeholder="Contoh: 0812XXXXXXXX"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Staff Penanggung Jawab</label>
                  <select
                    value={formData.assigned_to_user_name}
                    onChange={(e) => setFormData(prev => ({ ...prev, assigned_to_user_name: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    {staffList.map(staff => (
                      <option key={staff.id} value={staff.name}>
                        {staff.name} ({staff.role})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="pt-2 flex justify-end gap-3 text-xs font-semibold">
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => { setIsAddOpen(false); setEditingClient(null); }}
                    className="px-4 py-2 hover:bg-slate-800 text-slate-400 rounded-lg transition-colors disabled:opacity-50"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer"
                  >
                    {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    {isSubmitting ? 'Menyimpan...' : (editingClient ? 'Simpan Perubahan' : 'Daftarkan Klien')}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* DELETE CONFIRMATION MODAL */}
      <AnimatePresence>
        {clientToDelete && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-900 border border-slate-800 rounded-xl p-6 w-full max-w-sm shadow-2xl relative space-y-4"
            >
              <div className="flex items-center gap-3 text-rose-400">
                <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20">
                  <Trash2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-100">Hapus Data Klien</h3>
                  <p className="text-xs text-slate-400">Konfirmasi Penghapusan</p>
                </div>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed bg-slate-950/50 p-3 rounded-lg border border-slate-800">
                Apakah Anda yakin ingin menghapus klien <strong className="text-white">{clientToDelete.name}</strong> ({clientToDelete.email || clientToDelete.phone || 'Tanpa Kontak'}) dari sistem kantor?
              </p>

              <div className="flex justify-end gap-2.5 text-xs font-semibold pt-1">
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={() => setClientToDelete(null)}
                  className="px-4 py-2 hover:bg-slate-800 text-slate-400 rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={confirmDelete}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white rounded-lg transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer shadow-lg shadow-rose-950/40"
                >
                  {isDeleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {isDeleting ? 'Menghapus...' : 'Ya, Hapus Klien'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
