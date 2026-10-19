import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Briefcase, 
  Plus, 
  Search, 
  Clock, 
  CheckCircle2, 
  ArrowRight, 
  X, 
  AlertCircle,
  FileText,
  TrendingUp,
  User,
  Activity,
  UserCheck,
  Lock,
  Sparkles,
  UserPlus,
  Mail,
  Phone,
  Trash2
} from 'lucide-react';
import { mockDb, deduplicateTemplates } from '../lib/mockStore';
import { Order, User as UserType } from '../data/schemaData';
import { supabase } from '../lib/supabase';

// Helper for UUID Validation & Sanitation
const isValidUuid = (val: string | null | undefined): boolean => {
  if (!val) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);
};

const sanitizeUuid = (val: string | null | undefined): string | null => {
  if (!val) return null;
  return isValidUuid(val) ? val : null;
};

interface OrderManagementProps {
  activeUser: UserType;
  activeTenant: { id: string; company_name: string };
}

export default function OrderManagement({ activeUser, activeTenant }: OrderManagementProps) {
  const [storeTick, setStoreTick] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Create state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Delete Order State
  const [deleteConfirmOrder, setDeleteConfirmOrder] = useState<Order | null>(null);
  const [isDeletingOrder, setIsDeletingOrder] = useState(false);

  // Add Client sub-form states
  const [isAddingClient, setIsAddingClient] = useState(false);
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [newClientEmail, setNewClientEmail] = useState('');
  const [newClientPhone, setNewClientPhone] = useState('');
  const [newClientAssignedTo, setNewClientAssignedTo] = useState('');

  // Subscribe
  useEffect(() => {
    const unsubscribe = mockDb.subscribe(() => {
      setStoreTick(prev => prev + 1);
    });
    return () => unsubscribe();
  }, []);

  // Fetch clients
  const clients = useMemo(() => {
    return mockDb.clients.filter(c => c.tenant_id === activeTenant.id);
  }, [activeTenant.id, storeTick]);

  // Live order templates state
  const [liveTemplates, setLiveTemplates] = useState<any[]>([]);

  const fetchLiveTemplates = async () => {
    if (mockDb.isSupabaseConfigured()) {
      try {
        const { data, error } = await supabase
          .from('order_templates')
          .select('*');

        if (!error && data && data.length > 0) {
          const mapped = data.map((t: any) => ({
            id: t.id,
            tenant_id: t.tenant_id,
            name: t.name,
            checklists: Array.isArray(t.checklists) ? t.checklists : (Array.isArray(t.checklist_items) ? t.checklist_items : []),
            checklist_items: Array.isArray(t.checklists) ? t.checklists : (Array.isArray(t.checklist_items) ? t.checklist_items : [])
          }));
          setLiveTemplates(deduplicateTemplates(mapped));
          return;
        }
      } catch (err) {
        console.warn("Gagal mengambil live order_templates di OrderManagement:", err);
      }
    }
    setLiveTemplates(deduplicateTemplates(mockDb.orderTemplates));
  };

  useEffect(() => {
    fetchLiveTemplates();
  }, [activeTenant.id, storeTick]);

  // Fetch templates
  const templates = useMemo(() => {
    const raw = liveTemplates.length > 0 
      ? liveTemplates 
      : mockDb.orderTemplates;
    return deduplicateTemplates(raw);
  }, [storeTick, liveTemplates]);

  // Fetch non-notary employees
  const employees = useMemo(() => {
    return mockDb.users.filter(u => u.tenant_id === activeTenant.id && u.role !== 'NOTARIS');
  }, [activeTenant.id, storeTick]);

  useEffect(() => {
    if (clients.length > 0 && !selectedClientId) {
      setSelectedClientId(clients[0].id);
    }
  }, [clients, selectedClientId]);

  useEffect(() => {
    if (templates.length > 0 && !selectedTemplateId) {
      setSelectedTemplateId(templates[0].id);
    }
  }, [templates, selectedTemplateId]);

  useEffect(() => {
    if (employees.length > 0 && !selectedEmployeeId) {
      setSelectedEmployeeId(employees[0].id);
    }
  }, [employees, selectedEmployeeId]);

  const orders = useMemo(() => {
    let list = mockDb.orders.filter(o => o.tenant_id === activeTenant.id);
    
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      list = list.filter(o => 
        o.title.toLowerCase().includes(q) || 
        o.client_name.toLowerCase().includes(q) || 
        o.status.toLowerCase().includes(q)
      );
    }
    return list;
  }, [activeTenant.id, searchQuery, storeTick]);

  // Handle creating a client inline during order creation
  const handleCreateClientInOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (!newClientName.trim() || !newClientEmail.trim() || !newClientPhone.trim()) {
      setErrorMessage('Semua field klien wajib diisi!');
      return;
    }

    try {
      const assignedName = newClientAssignedTo || (employees[0]?.name || activeUser.name);
      
      const newClient = await mockDb.addClient(
        activeTenant.id,
        newClientName.trim(),
        newClientEmail.trim(),
        newClientPhone.trim(),
        assignedName
      );

      // Select newly created client
      setSelectedClientId(newClient.id);
      
      // Clear client form
      setNewClientName('');
      setNewClientEmail('');
      setNewClientPhone('');
      
      setIsAddingClient(false);
      setSuccessMessage(`Klien baru "${newClient.name}" berhasil ditambahkan & terpilih!`);
    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal mendaftarkan klien baru.');
    }
  };

  // Handle Create Order with template cloning and assignment
  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (activeUser.role !== 'NOTARIS') {
      setErrorMessage('Hanya pimpinan Notaris yang diizinkan menerbitkan order.');
      return;
    }

    if (!selectedClientId || !selectedTemplateId || !selectedEmployeeId) {
      setErrorMessage('Semua field wajib diisi!');
      return;
    }

    const client = clients.find(c => c.id === selectedClientId);
    if (!client) {
      setErrorMessage('Klien tidak valid.');
      return;
    }

    const template = templates.find(t => t.id === selectedTemplateId);
    if (!template) {
      setErrorMessage('Template Jenis Order tidak valid.');
      return;
    }

    const employee = employees.find(emp => emp.id === selectedEmployeeId);
    if (!employee) {
      setErrorMessage('Karyawan penanggung jawab tidak valid.');
      return;
    }

    setIsSubmittingOrder(true);
    try {
      const hexChars = '0123456789abcdef';
      let orderSuffix = '';
      let taskSuffix = '';
      for (let i = 0; i < 12; i++) {
        orderSuffix += hexChars[Math.floor(Math.random() * 16)];
        taskSuffix += hexChars[Math.floor(Math.random() * 16)];
      }

      const orderId = `d0000000-0000-0000-0000-${orderSuffix}`;
      const generatedTitle = `${template.name} - ${client.name}`;

      // 1. Create the Order
      const newOrder: Order = {
        id: orderId,
        tenant_id: activeTenant.id,
        client_id: selectedClientId,
        client_name: client.name,
        title: generatedTitle,
        status: 'PENDING',
        created_at: new Date().toISOString()
      };
      
      // 2. Create the first Task assigned to selected employee
      const taskId = `e0000000-0000-0000-0000-${taskSuffix}`;
      const newTask = {
        id: taskId,
        tenant_id: activeTenant.id,
        order_id: orderId,
        order_title: template.name,
        title: `Persyaratan & Pemberkasan - ${template.name}`,
        description: `Pemenuhan berkas fisik dan digital berdasarkan draf template ${template.name}.`,
        assigned_to_user_name: employee.name,
        status: 'ON_PROGRESS' as const
      };

      // 3. Clone checklist items from template to checklists table under the task
      const rawChecklists = Array.isArray(template.checklists) && template.checklists.length > 0 
        ? template.checklists 
        : (Array.isArray(template.checklist_items) ? template.checklist_items : []);

      const clonedChecklists = rawChecklists.map((item: string) => ({
        id: `chk-${Math.random().toString(36).substr(2, 9)}`,
        tenant_id: activeTenant.id,
        task_id: taskId,
        item_name: item,
        is_checked: false,
        checked_by_user_id: null,
        checked_by_user_name: null,
        checked_at: null
      }));

      // Store mutations
      mockDb.orders.unshift(newOrder);
      mockDb.tasks.unshift(newTask);
      mockDb.checklists.push(...clonedChecklists);

      if (mockDb.isSupabaseConfigured()) {
        const orderPayload = {
          id: orderId,
          tenant_id: sanitizeUuid(activeTenant.id) || activeTenant.id,
          client_id: sanitizeUuid(selectedClientId),
          title: generatedTitle,
          status: 'PENDING',
          created_at: newOrder.created_at
        };

        const { error: ordErr } = await supabase.from('orders').insert([orderPayload]);
        if (ordErr) {
          console.error("Error inserting order into Supabase:", ordErr);
          throw ordErr;
        }

        const taskPayload = {
          id: taskId,
          tenant_id: sanitizeUuid(activeTenant.id) || activeTenant.id,
          order_id: orderId,
          title: newTask.title,
          description: newTask.description || null,
          assigned_to_user_id: sanitizeUuid(employee.id),
          status: 'ON_PROGRESS'
        };

        const { error: tskErr } = await supabase.from('tasks').insert([taskPayload]);
        if (tskErr) {
          console.error("Error inserting task into Supabase:", tskErr);
          throw tskErr;
        }

        if (clonedChecklists.length > 0) {
          try {
            const checklistInserts = clonedChecklists.map(c => {
              const itemPayload: any = {
                tenant_id: sanitizeUuid(activeTenant.id) || activeTenant.id,
                task_id: taskId,
                item_name: c.item_name,
                is_checked: false
              };
              if (isValidUuid(c.id)) {
                itemPayload.id = c.id;
              }
              return itemPayload;
            });

            const { error: chkErr } = await supabase.from('checklists').insert(checklistInserts);
            if (chkErr) {
              console.error("Checklist Insert Error:", chkErr);
            }
          } catch (chkCatchErr) {
            console.error("Checklist Insert Exception:", chkCatchErr);
          }
        }

        await mockDb.fetchAndSyncAll();
      }

      await mockDb.addAuditLog(
        activeTenant.id, 
        activeUser.name, 
        'CREATE_ORDER', 
        `Order baru diterbitkan: "${generatedTitle}". Tugas pertama "${newTask.title}" didelegasikan ke ${employee.name} dengan menyalin ${clonedChecklists.length} checklist standar.`
      );
      
      mockDb.notify();

      setSuccessMessage('Order berhasil dibuat & ditugaskan!');
      
      setTimeout(() => {
        setIsCreateOpen(false);
        setSuccessMessage('');
      }, 1500);
    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal membuat order.');
    } finally {
      setIsSubmittingOrder(false);
    }
  };

  // Handle status update with authorization check & Supabase update
  const handleUpdateStatus = async (orderId: string, newStatus: Order['status']) => {
    const targetOrder = orders.find(o => o.id === orderId) || mockDb.orders.find(o => o.id === orderId);
    
    // Check authorization: NOTARIS or assigned user
    const isNotaris = activeUser.role === 'NOTARIS';
    const isAssignee = targetOrder?.assigned_to_user_id === activeUser.id || 
                       targetOrder?.assigned_to === activeUser.id || 
                       (targetOrder as any)?.assigned_to_user_name?.toLowerCase().includes(activeUser.name.toLowerCase());

    if (!isNotaris && !isAssignee) {
      setErrorMessage('Anda tidak memiliki akses untuk mengubah tugas ini');
      setSuccessMessage('');
      return;
    }

    setErrorMessage('');
    setSuccessMessage('');

    try {
      if (mockDb.isSupabaseConfigured()) {
        const { error } = await supabase
          .from('orders')
          .update({ status: newStatus, updated_at: new Date().toISOString() })
          .eq('id', orderId);

        if (error) {
          console.error("Error updating order status in Supabase:", error);
          setErrorMessage(`Gagal memperbarui status order: ${error.message}`);
          return;
        }

        if (newStatus === 'DONE') {
          await supabase
            .from('tasks')
            .update({ status: 'DONE' })
            .eq('order_id', orderId);
        }
      }
      await mockDb.updateOrderStatus(orderId, newStatus);
      if (newStatus === 'DONE') {
        mockDb.tasks.forEach(t => {
          if (t.order_id === orderId) {
            t.status = 'DONE';
          }
        });
      }
      mockDb.notify();
      await mockDb.addAuditLog(
        activeTenant.id,
        activeUser.name,
        'UPDATE_ORDER_STATUS',
        `Status order ${orderId.substring(0, 8)} diubah menjadi ${newStatus}`
      );
      setSuccessMessage('Status order berhasil diperbarui!');
    } catch (err: any) {
      console.error("Error updating order status:", err);
      setErrorMessage(err.message || 'Gagal memperbarui status order');
    }
  };

  // Handle Delete Order (Notaris Only)
  const handleDeleteOrder = async (orderId: string) => {
    if (activeUser.role !== 'NOTARIS') {
      setErrorMessage('Hanya Notaris yang berhak menghapus order!');
      return;
    }

    setIsDeletingOrder(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      if (mockDb.isSupabaseConfigured()) {
        const orderTasks = mockDb.tasks.filter(t => t.order_id === orderId).map(t => t.id);
        if (orderTasks.length > 0) {
          await supabase.from('checklists').delete().in('task_id', orderTasks);
        }
        await supabase.from('tasks').delete().eq('order_id', orderId);

        const { error } = await supabase.from('orders').delete().eq('id', orderId);
        if (error) throw error;
      }

      mockDb.orders = mockDb.orders.filter(o => o.id !== orderId);
      mockDb.tasks = mockDb.tasks.filter(t => t.order_id !== orderId);
      await mockDb.addAuditLog(
        activeTenant.id,
        activeUser.name,
        'DELETE_ORDER',
        `Menghapus order ${orderId.substring(0, 8)}`
      );
      mockDb.notify();

      setSuccessMessage('Order berhasil dihapus!');
      setDeleteConfirmOrder(null);
    } catch (err: any) {
      console.error('Error Delete Order:', err);
      setErrorMessage(err.message || 'Gagal menghapus order');
    } finally {
      setIsDeletingOrder(false);
    }
  };

  return (
    <div id="order-mgmt-container" className="space-y-6">
      
      {/* Toast Banners */}
      {errorMessage && (
        <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl text-xs flex items-center justify-between shadow-sm font-sans">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{errorMessage}</span>
          </div>
          <button onClick={() => setErrorMessage('')} className="text-rose-400 hover:text-rose-200 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {successMessage && (
        <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl text-xs flex items-center justify-between shadow-sm font-sans">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>{successMessage}</span>
          </div>
          <button onClick={() => setSuccessMessage('')} className="text-emerald-400 hover:text-emerald-200 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      
      {/* Header Panel */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-500/10 text-indigo-400 p-2.5 rounded-lg border border-indigo-500/20">
              <Briefcase className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                Order & Pemberkasan Akta Notaris
              </h2>
              <p className="text-xs text-slate-400 font-sans">
                Manajemen siklus berkas hukum, akta pendirian, AJB, warisan, dan legalisasi.
              </p>
            </div>
          </div>
          
          {activeUser.role === 'NOTARIS' ? (
            <button
              onClick={() => setIsCreateOpen(true)}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-medium text-xs rounded-lg shadow transition-all cursor-pointer font-sans font-bold uppercase tracking-wider"
            >
              <Plus className="w-4 h-4" />
              Daftarkan Order Baru
            </button>
          ) : (
            <div className="flex items-center gap-2 px-3.5 py-2 bg-slate-950 text-slate-500 border border-slate-800 rounded-lg text-xs font-medium font-sans">
              <Lock className="w-3.5 h-3.5 text-slate-600" />
              Daftar Order (Notaris Only)
            </div>
          )}
        </div>
      </div>

      {/* Search Filter */}
      <div className="flex items-center bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 shadow-inner">
        <Search className="w-4 h-4 text-slate-500 shrink-0 mr-3" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Cari order akta berdasarkan judul berkas, klien, atau status..."
          className="bg-transparent text-slate-200 placeholder:text-slate-500 focus:outline-none text-xs w-full font-sans"
        />
        {searchQuery && (
          <button onClick={() => setSearchQuery('')} className="text-slate-500 hover:text-slate-300">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Orders Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {orders.length === 0 ? (
          <div className="col-span-2 p-12 text-center text-slate-500 bg-slate-900 border border-slate-800 rounded-xl">
            <Briefcase className="w-12 h-12 text-slate-700 mx-auto mb-3" />
            <p className="text-sm font-medium text-slate-400">Tidak ada order akta ditemukan</p>
          </div>
        ) : (
          orders.map((order) => (
            <div key={order.id} className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 hover:border-slate-700 transition-colors">
              <div className="flex justify-between items-start gap-4">
                <div className="space-y-1">
                  <span className="text-[10px] text-indigo-400 font-mono bg-indigo-500/10 px-1.5 py-0.5 rounded font-bold uppercase">
                    ID: {order.id.substring(0, 8)}
                  </span>
                  <h4 className="font-sans font-bold text-slate-100 text-sm mt-1.5">{order.title}</h4>
                  <div className="flex items-center gap-1.5 text-xs text-slate-400 pt-1">
                    <User className="w-3.5 h-3.5 text-slate-500" />
                    <span>Klien: <strong>{order.client_name}</strong></span>
                  </div>
                </div>

                {/* Status Badges & Action */}
                <div className="flex items-center gap-2">
                  {order.status === 'DONE' ? (
                    <span className="px-2 py-0.5 rounded text-[9px] font-bold font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      SELESAI (DONE)
                    </span>
                  ) : order.status === 'SIGNING' ? (
                    <span className="px-2 py-0.5 rounded text-[9px] font-bold font-mono bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse">
                      TANDA TANGAN
                    </span>
                  ) : order.status === 'ON_PROGRESS' ? (
                    <span className="px-2 py-0.5 rounded text-[9px] font-bold font-mono bg-blue-500/10 text-blue-400 border border-blue-500/20">
                      ON PROGRESS
                    </span>
                  ) : order.status === 'INVOICED' ? (
                    <span className="px-2 py-0.5 rounded text-[9px] font-bold font-mono bg-purple-500/10 text-purple-400 border border-purple-500/20">
                      TERTAGIH
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded text-[9px] font-bold font-mono bg-slate-500/10 text-slate-400 border border-slate-750">
                      PENDING
                    </span>
                  )}

                  {activeUser.role === 'NOTARIS' && (
                    <button
                      onClick={() => setDeleteConfirmOrder(order)}
                      className="text-slate-500 hover:text-rose-400 p-1.5 rounded-lg hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 transition-all cursor-pointer"
                      title="Hapus Order Akta (Khusus Notaris)"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Status Stepper / Workflow Advancer */}
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800/80 text-xs">
                <span className="text-[9px] text-slate-500 uppercase tracking-widest font-mono font-bold block mb-2">
                  Atur Tahap Berkas (Workflow)
                </span>
                
                <div className="flex flex-wrap items-center gap-2">
                  {(['PENDING', 'ON_PROGRESS', 'SIGNING', 'INVOICED', 'DONE'] as Order['status'][]).map((st) => (
                    <button
                      key={st}
                      onClick={() => handleUpdateStatus(order.id, st)}
                      className={`px-2 py-1 rounded text-[10px] font-mono font-bold transition-all cursor-pointer ${
                        order.status === st
                          ? 'bg-indigo-600 text-white shadow'
                          : 'bg-slate-900 text-slate-500 border border-slate-800 hover:border-slate-700 hover:text-slate-300'
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>

              {/* Footer */}
              <div className="flex justify-between items-center text-[10px] text-slate-500 font-mono border-t border-slate-800/40 pt-3">
                <span>Daftar: {new Date(order.created_at).toLocaleDateString('id-ID')}</span>
                <span className="text-indigo-400/80">Siklus Hidup RLS Postgres Aman</span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* CREATE ORDER MODAL */}
      <AnimatePresence>
        {isCreateOpen && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-900 border border-slate-800 rounded-xl p-6 w-full max-w-md shadow-2xl relative"
            >
              <button
                onClick={() => { 
                  setIsCreateOpen(false); 
                  setSuccessMessage(''); 
                  setIsAddingClient(false);
                }}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>

              <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider font-sans mb-4 flex items-center gap-2">
                {isAddingClient ? (
                  <>
                    <UserPlus className="w-4 h-4 text-indigo-400" />
                    Daftarkan Klien Baru
                  </>
                ) : (
                  <>
                    <Briefcase className="w-4 h-4 text-indigo-400" />
                    Daftarkan Berkas Order Akta Baru
                  </>
                )}
              </h3>

              {isAddingClient ? (
                <form onSubmit={handleCreateClientInOrder} className="space-y-4">
                  {errorMessage && (
                    <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg text-rose-400 text-xs flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{errorMessage}</span>
                    </div>
                  )}

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Nama Klien / Instansi</label>
                    <input
                      type="text"
                      required
                      value={newClientName}
                      onChange={(e) => setNewClientName(e.target.value)}
                      placeholder="Contoh: PT Indonesia Raya / Siti Rahmah"
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 font-sans"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Email Korespondensi</label>
                    <input
                      type="email"
                      required
                      value={newClientEmail}
                      onChange={(e) => setNewClientEmail(e.target.value)}
                      placeholder="Contoh: klien@email.com"
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 font-sans"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Nomor Telepon (WhatsApp)</label>
                    <input
                      type="text"
                      required
                      value={newClientPhone}
                      onChange={(e) => setNewClientPhone(e.target.value)}
                      placeholder="Contoh: 0812XXXXXXXX"
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 font-sans"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Staff Penanggung Jawab</label>
                    <select
                      value={newClientAssignedTo}
                      onChange={(e) => setNewClientAssignedTo(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 font-sans"
                    >
                      {mockDb.users.filter(u => u.tenant_id === activeTenant.id).map(staff => (
                        <option key={staff.id} value={staff.name}>
                          {staff.name} ({staff.role})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Actions */}
                  <div className="pt-2 flex justify-end gap-3 text-xs font-semibold">
                    <button
                      type="button"
                      onClick={() => {
                        setIsAddingClient(false);
                        setErrorMessage('');
                        setSuccessMessage('');
                      }}
                      className="px-4 py-2 hover:bg-slate-800 text-slate-400 rounded-lg transition-colors cursor-pointer"
                    >
                      Kembali
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-all cursor-pointer"
                    >
                      Simpan Klien
                    </button>
                  </div>
                </form>
              ) : (
                <form onSubmit={handleCreateOrder} className="space-y-4">
                  {errorMessage && (
                    <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg text-rose-400 text-xs flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{errorMessage}</span>
                    </div>
                  )}

                  {successMessage && (
                    <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-400 text-xs flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      <span>{successMessage}</span>
                    </div>
                  )}

                  {/* Client Dropdown */}
                  <div className="space-y-1">
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Klien Pemilik Berkas</label>
                      <button
                        type="button"
                        onClick={() => {
                          setErrorMessage('');
                          setSuccessMessage('');
                          setNewClientName('');
                          setNewClientEmail('');
                          setNewClientPhone('');
                          const staffList = mockDb.users.filter(u => u.tenant_id === activeTenant.id);
                          setNewClientAssignedTo(staffList[0]?.name || activeUser.name);
                          setIsAddingClient(true);
                        }}
                        className="text-[10px] font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 cursor-pointer bg-indigo-500/10 hover:bg-indigo-500/20 px-2 py-0.5 rounded transition-all"
                      >
                        <Plus className="w-3 h-3" />
                        Tambah Klien Baru
                      </button>
                    </div>
                    {clients.length === 0 ? (
                      <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-400 text-[11px] font-sans">
                        Belum ada data klien terdaftar. Silakan klik tombol <strong>Tambah Klien Baru</strong> di atas untuk mendaftarkan klien baru terlebih dahulu.
                      </div>
                    ) : (
                      <select
                        value={selectedClientId}
                        onChange={(e) => setSelectedClientId(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 font-sans"
                      >
                        {clients.map(cli => (
                          <option key={cli.id} value={cli.id}>
                            {cli.name} ({cli.email})
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  {/* Template Dropdown */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Pilih Jenis Order (Master Template)</label>
                    {templates.length === 0 ? (
                      <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-400 text-[11px] font-sans">
                        Belum ada master template order. Silakan buat terlebih dahulu di tab <strong>Template Order</strong>.
                      </div>
                    ) : (
                      <select
                        value={selectedTemplateId}
                        onChange={(e) => setSelectedTemplateId(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 font-sans"
                      >
                        {templates.map(tmpl => (
                          <option key={tmpl.id} value={tmpl.id}>
                            {tmpl.name}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  {/* Employee Dropdown */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Tugaskan Kepada (Karyawan)</label>
                    {employees.length === 0 ? (
                      <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg text-rose-400 text-[11px] font-sans">
                        Tidak ada staf/finance yang terdaftar untuk menerima tugas.
                      </div>
                    ) : (
                      <select
                        value={selectedEmployeeId}
                        onChange={(e) => setSelectedEmployeeId(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 font-sans"
                      >
                        {employees.map(emp => (
                          <option key={emp.id} value={emp.id}>
                            {emp.name} ({emp.role})
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  {/* Real-time Order Title Preview Card & Auto-Populated Checklists */}
                  {selectedTemplateId && selectedClientId && (() => {
                    const activeTmpl = templates.find(t => t.id === selectedTemplateId);
                    const tmplChecklists = Array.isArray(activeTmpl?.checklists) && activeTmpl.checklists.length > 0
                      ? activeTmpl.checklists
                      : (Array.isArray(activeTmpl?.checklist_items) ? activeTmpl.checklist_items : []);
                    const clientObj = clients.find(c => c.id === selectedClientId);

                    return (
                      <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-[9px] text-indigo-400 font-mono font-bold tracking-wider uppercase block">
                            Preview Judul Order Berkas:
                          </span>
                          <span className="text-[9px] text-emerald-400 font-mono bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20 font-bold">
                            Auto-Populate Checklist Active
                          </span>
                        </div>
                        <p className="text-xs text-slate-200 font-bold font-sans">
                          {activeTmpl?.name} - {clientObj?.name}
                        </p>

                        {tmplChecklists.length > 0 && (
                          <div className="pt-2 border-t border-slate-800/60 space-y-1">
                            <span className="text-[10px] text-slate-400 font-semibold flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                              Checklist Standar Draf ({tmplChecklists.length} Butir):
                            </span>
                            <div className="max-h-24 overflow-y-auto space-y-1 pr-1">
                              {tmplChecklists.map((chk: string, idx: number) => (
                                <div key={idx} className="text-[10px] text-slate-300 flex items-center gap-1.5 bg-slate-900/80 px-2 py-1 rounded border border-slate-800/40">
                                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0" />
                                  <span className="truncate">{chk}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* Actions */}
                  <div className="pt-2 flex justify-end gap-3 text-xs font-semibold">
                    <button
                      type="button"
                      onClick={() => { setIsCreateOpen(false); setSuccessMessage(''); }}
                      className="px-4 py-2 hover:bg-slate-800 text-slate-400 rounded-lg transition-colors cursor-pointer"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmittingOrder}
                      className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed font-sans text-xs font-semibold"
                    >
                      {isSubmittingOrder ? (
                        <>
                          <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24" fill="none">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                          </svg>
                          <span>Menyimpan Order...</span>
                        </>
                      ) : (
                        <span>Buat Order Baru</span>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* DELETE ORDER CONFIRMATION MODAL */}
      <AnimatePresence>
        {deleteConfirmOrder && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 font-sans">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-900 border border-slate-800 rounded-xl p-6 w-full max-w-md shadow-2xl relative"
            >
              <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider mb-2 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400" />
                Konfirmasi Hapus Order
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed mb-5">
                Apakah Anda yakin ingin menghapus Order <strong className="text-white">"{deleteConfirmOrder.title}"</strong> beserta seluruh tugas terkait? Tindakan ini tidak dapat dibatalkan.
              </p>
              <div className="flex justify-end gap-3 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setDeleteConfirmOrder(null)}
                  disabled={isDeletingOrder}
                  className="px-4 py-2 hover:bg-slate-800 text-slate-400 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteOrder(deleteConfirmOrder.id)}
                  disabled={isDeletingOrder}
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 font-bold"
                >
                  {isDeletingOrder ? (
                    <>
                      <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                      </svg>
                      <span>Menghapus...</span>
                    </>
                  ) : (
                    <span>Hapus Order</span>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
