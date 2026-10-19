import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  FileCheck, 
  Search, 
  User, 
  CheckCircle, 
  ClipboardList, 
  ArrowRightLeft, 
  Check, 
  X, 
  Briefcase,
  AlertCircle,
  Clock,
  Filter,
  Plus,
  Trash2,
  CheckSquare,
  Lock,
  Loader2,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { mockDb } from '../lib/mockStore';
import { Task, User as UserType, ChecklistItem } from '../data/schemaData';
import { useTaskChecklist } from '../hooks/useTaskChecklist';

interface TaskChecklistWidgetProps {
  taskId: string;
  orderTitle?: string;
  taskTitle?: string;
  assignedToUserId?: string;
  assignedToUserName: string;
  activeUser: UserType;
  activeTenant: { id: string; company_name: string };
}

function TaskChecklistWidget({
  taskId,
  orderTitle,
  taskTitle,
  assignedToUserId,
  assignedToUserName,
  activeUser,
  activeTenant
}: TaskChecklistWidgetProps) {
  const { loading, data: checklistItems, toggleChecklistItem, addChecklistItem, applyTemplateChecklists } = useTaskChecklist(taskId);
  const [newItemName, setNewItemName] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [isImporting, setIsImporting] = useState(false);

  // Auto-detect template matching task title or order title
  const autoMatchedTemplate = useMemo(() => {
    const query = `${orderTitle || ''} ${taskTitle || ''}`.toLowerCase();
    if (!query.trim()) return null;
    return mockDb.orderTemplates.find(tmpl => {
      const name = tmpl.name.toLowerCase();
      if (query.includes(name)) return true;
      const keyWords = name.split(/[\s/]+/).filter(w => w.length >= 3);
      return keyWords.some(kw => query.includes(kw));
    }) || null;
  }, [orderTitle, taskTitle]);

  // Default selected template to autoMatchedTemplate if available
  useEffect(() => {
    if (autoMatchedTemplate && !selectedTemplateId) {
      setSelectedTemplateId(autoMatchedTemplate.id);
    }
  }, [autoMatchedTemplate]);

  const isNotaris = activeUser.role === 'NOTARIS';
  const isAssignedPIC = 
    (assignedToUserId && assignedToUserId === activeUser.id) ||
    (assignedToUserName && assignedToUserName.toLowerCase().includes(activeUser.name.toLowerCase()));

  const canModifyChecklist = isNotaris || isAssignedPIC;

  const totalCount = checklistItems.length;
  const completedCount = checklistItems.filter(c => c.is_checked).length;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const handleToggle = async (item: ChecklistItem) => {
    if (!canModifyChecklist) return;
    try {
      await toggleChecklistItem(item.id, !item.is_checked, activeUser.id, activeUser.name);
    } catch (err) {
      console.error('Failed to toggle checklist item:', err);
    }
  };

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim() || !canModifyChecklist) return;
    setIsAdding(true);
    try {
      await addChecklistItem(newItemName.trim(), activeTenant.id);
      setNewItemName('');
    } catch (err) {
      console.error('Failed to add checklist item:', err);
    } finally {
      setIsAdding(false);
    }
  };

  const handleApplyTemplateById = async (templateId: string) => {
    if (!templateId || !canModifyChecklist) return;
    const tmpl = mockDb.orderTemplates.find(t => t.id === templateId);
    if (!tmpl) return;

    const items = tmpl.checklists || tmpl.checklist_items || [];
    if (items.length === 0) return;

    setIsImporting(true);
    try {
      await applyTemplateChecklists(items, activeTenant.id);
      setSelectedTemplateId('');
      setShowTemplateSelector(false);
    } catch (err) {
      console.error('Failed to apply template:', err);
    } finally {
      setIsImporting(false);
    }
  };

  const handleApplyTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    await handleApplyTemplateById(selectedTemplateId);
  };

  return (
    <div className="mt-3 pt-3 border-t border-slate-800/80 font-sans w-full">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-2 text-xs font-bold text-slate-300 hover:text-white transition-colors cursor-pointer"
          >
            <CheckSquare className="w-4 h-4 text-indigo-400 shrink-0" />
            <span>Checklist Syarat & Pengerjaan</span>
            <span className="text-[10px] font-mono font-semibold px-2 py-0.5 bg-slate-950 border border-slate-800 text-slate-300 rounded-full">
              {completedCount}/{totalCount} ({progressPercent}%)
            </span>
            {isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-slate-500 shrink-0" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-500 shrink-0" />}
          </button>

          {canModifyChecklist && (
            <button
              type="button"
              onClick={() => setShowTemplateSelector(!showTemplateSelector)}
              className="text-[10px] font-bold text-indigo-400 hover:text-indigo-300 bg-indigo-500/10 hover:bg-indigo-500/20 px-2 py-0.5 rounded border border-indigo-500/20 flex items-center gap-1 transition-all cursor-pointer font-sans"
              title="Salin isi checklist langsung dari template order"
            >
              <ClipboardList className="w-3 h-3 shrink-0" />
              <span>{showTemplateSelector ? 'Tutup Import' : 'Salin dari Template Order'}</span>
            </button>
          )}
        </div>

        {!canModifyChecklist && (
          <span className="text-[10px] text-amber-400/90 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded flex items-center gap-1 font-mono">
            <Lock className="w-3 h-3 text-amber-400 shrink-0" />
            <span>Hanya PIC ({assignedToUserName}) atau Notaris yang dapat mengubah</span>
          </span>
        )}
      </div>

      {/* Inline Template Importer */}
      {showTemplateSelector && canModifyChecklist && (
        <form onSubmit={handleApplyTemplate} className="p-2.5 bg-slate-950 border border-slate-800 rounded-lg space-y-2 mb-2.5 font-sans">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider">Salin Checklist dari Template Order Akta</span>
            <button type="button" onClick={() => setShowTemplateSelector(false)} className="text-slate-500 hover:text-slate-300">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="flex gap-2">
            <select
              value={selectedTemplateId}
              onChange={(e) => setSelectedTemplateId(e.target.value)}
              className="bg-slate-900 border border-slate-700 rounded-md px-2.5 py-1 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 flex-1 font-sans"
            >
              <option value="">-- Pilih Template Order Akta --</option>
              {mockDb.orderTemplates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({(t.checklist_items || t.checklists || []).length} syarat)
                </option>
              ))}
            </select>
            <button
              type="submit"
              disabled={!selectedTemplateId || isImporting}
              className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-bold text-[10px] rounded-md transition-all flex items-center gap-1 cursor-pointer shrink-0 font-sans"
            >
              {isImporting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
              <span>Terapkan</span>
            </button>
          </div>
        </form>
      )}

      {/* Progress Bar */}
      {totalCount > 0 && (
        <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden mb-2.5 border border-slate-800">
          <div 
            className="bg-gradient-to-r from-indigo-500 via-blue-500 to-emerald-500 h-full transition-all duration-300" 
            style={{ width: `${progressPercent}%` }} 
          />
        </div>
      )}

      {isExpanded && (
        <div className="space-y-1.5 pt-1">
          {loading && checklistItems.length === 0 ? (
            <p className="text-[11px] text-slate-500 italic">Memuat item checklist...</p>
          ) : checklistItems.length === 0 ? (
            <div className="p-3 bg-slate-950/60 border border-dashed border-slate-800 rounded-lg text-center space-y-2">
              <p className="text-[11px] text-slate-400">Belum ada item checklist pada tugas ini.</p>
              {canModifyChecklist && (
                <div className="flex flex-wrap items-center justify-center gap-2">
                  {autoMatchedTemplate ? (
                    <button
                      type="button"
                      disabled={isImporting}
                      onClick={() => handleApplyTemplateById(autoMatchedTemplate.id)}
                      className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white border border-indigo-400/30 rounded-lg text-xs font-bold transition-all inline-flex items-center gap-1.5 cursor-pointer shadow-lg shadow-indigo-600/20 font-sans"
                      title={`Langsung salin ${(autoMatchedTemplate.checklists || autoMatchedTemplate.checklist_items || []).length} item syarat dari template ${autoMatchedTemplate.name}`}
                    >
                      {isImporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ClipboardList className="w-3.5 h-3.5 text-indigo-200" />}
                      <span>Salin Otomatis Template "{autoMatchedTemplate.name}" ({(autoMatchedTemplate.checklists || autoMatchedTemplate.checklist_items || []).length} Syarat)</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowTemplateSelector(true)}
                      className="px-3 py-1 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 rounded-lg text-[10px] font-bold transition-all inline-flex items-center gap-1 cursor-pointer font-sans"
                    >
                      <ClipboardList className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Pilih Template Order Akta</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {checklistItems.map((item) => (
                <div 
                  key={item.id}
                  onClick={() => canModifyChecklist && handleToggle(item)}
                  className={`flex items-start gap-2.5 p-2 rounded-lg border transition-all select-none ${
                    item.is_checked 
                      ? 'bg-emerald-950/20 border-emerald-500/20 text-slate-400' 
                      : 'bg-slate-950/80 border-slate-800 text-slate-200 hover:border-slate-700'
                  } ${canModifyChecklist ? 'cursor-pointer hover:bg-slate-800/40' : 'cursor-not-allowed opacity-80'}`}
                  title={canModifyChecklist ? 'Klik untuk mengubah status checklist' : 'Hanya PIC atau Notaris yang dapat mengubah'}
                >
                  <input
                    type="checkbox"
                    checked={item.is_checked}
                    disabled={!canModifyChecklist}
                    onChange={() => {}} // handled by parent div onClick
                    className="mt-0.5 rounded border-slate-700 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-slate-900 cursor-pointer disabled:cursor-not-allowed accent-indigo-500 w-4 h-4 shrink-0"
                  />
                  <div className="flex-1 text-xs leading-relaxed min-w-0">
                    <span className={item.is_checked ? 'line-through text-slate-500' : 'text-slate-200 font-medium'}>
                      {item.item_name}
                    </span>
                    {item.is_checked && (
                      <span className="block text-[9px] text-emerald-400/80 font-mono mt-0.5 truncate">
                        ✓ Selesai {item.checked_by_user_name ? `oleh ${item.checked_by_user_name}` : ''}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Add Checklist Item Form (PIC & Notaris only) */}
          {canModifyChecklist && (
            <form onSubmit={handleAddItem} className="flex items-center gap-2 mt-2.5 pt-1">
              <input
                type="text"
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                placeholder="+ Tambah syarat/sub-tugas baru..."
                className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 flex-1 font-sans"
              />
              <button
                type="submit"
                disabled={isAdding || !newItemName.trim()}
                className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-bold text-[10px] rounded-lg transition-all flex items-center gap-1 cursor-pointer shrink-0 font-sans"
              >
                {isAdding ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                <span>Tambah</span>
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}

interface TaskManagementProps {
  activeUser: UserType;
  activeTenant: { id: string; company_name: string };
}

export default function TaskManagement({ activeUser, activeTenant }: TaskManagementProps) {
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [rawTasks, setRawTasks] = useState<Task[]>([]);
  const [storeTick, setStoreTick] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [onlyMyTasks, setOnlyMyTasks] = useState(activeUser.role !== 'NOTARIS');
  
  // Handover state
  const [handoverTaskId, setHandoverTaskId] = useState<string | null>(null);
  const [targetUserId, setTargetUserId] = useState('');

  // Delete Task state
  const [deleteConfirmTask, setDeleteConfirmTask] = useState<Task | null>(null);
  const [isDeletingTask, setIsDeletingTask] = useState(false);

  // Add Task state
  const [isCreateTaskOpen, setIsCreateTaskOpen] = useState(false);
  const [isSubmittingTask, setIsSubmittingTask] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDescription, setNewTaskDescription] = useState('');
  const [newTaskOrderId, setNewTaskOrderId] = useState('');
  const [newTaskTemplateId, setNewTaskTemplateId] = useState('');
  const [newTaskAssignedTo, setNewTaskAssignedTo] = useState('');
  const [newTaskStatus, setNewTaskStatus] = useState<Task['status']>('PENDING');

  // Fetch Tasks function from Supabase with local fallback
  const fetchTasks = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);

    try {
      if (mockDb.isSupabaseConfigured()) {
        const { data: tasksData, error: tasksError } = await supabase
          .from('tasks')
          .select('*, orders(title, client_id, clients(name)), users:assigned_to_user_id(name)')
          .eq('tenant_id', activeTenant.id)
          .order('created_at', { ascending: false });

        if (tasksError) {
          console.error('Error fetching tasks from Supabase:', tasksError);
          setErrorMsg(`Gagal memuat tugas dari database: ${tasksError.message}`);
          const fallback = mockDb.tasks.filter(t => t.tenant_id === activeTenant.id);
          setRawTasks(fallback);
        } else if (tasksData) {
          const mappedTasks: Task[] = tasksData.map((t: any) => {
            let orderTitle = t.orders?.title || '';
            if (!orderTitle) {
              const localOrder = mockDb.orders.find(o => o.id === t.order_id);
              orderTitle = localOrder ? localOrder.title : 'Order Akta';
            }

            let assignedName = t.users?.name || '';
            if (!assignedName) {
              const localUser = mockDb.users.find(u => u.id === t.assigned_to_user_id);
              assignedName = localUser ? localUser.name : 'Staf Kantor';
            }

            return {
              id: t.id,
              tenant_id: t.tenant_id,
              order_id: t.order_id,
              order_title: orderTitle,
              title: t.title,
              description: t.description || '',
              assigned_to_user_name: assignedName,
              status: t.status
            };
          });
          setRawTasks(mappedTasks);
        }
      } else {
        await mockDb.delay(100);
        const list = mockDb.tasks.filter(t => t.tenant_id === activeTenant.id);
        setRawTasks([...list]);
      }
    } catch (err: any) {
      console.error('Exception fetching tasks from Supabase:', err);
      setErrorMsg(`Gagal memuat tugas: ${err.message || 'Terjadi kesalahan sistem'}`);
      const fallback = mockDb.tasks.filter(t => t.tenant_id === activeTenant.id);
      setRawTasks(fallback);
    } finally {
      setLoading(false);
    }
  }, [activeTenant.id]);

  // Subscribe to Realtime Postgres Changes on tasks & mockDb changes
  useEffect(() => {
    fetchTasks();

    let channel: any = null;
    if (mockDb.isSupabaseConfigured()) {
      channel = supabase
        .channel('realtime-tasks-view')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'tasks' },
          (payload) => {
            console.log('Realtime tasks payload received:', payload);
            fetchTasks();
          }
        )
        .subscribe((status) => {
          console.log('TaskManagement realtime subscription status:', status);
        });
    }

    const unsubscribeMock = mockDb.subscribe(() => {
      setStoreTick(prev => prev + 1);
      fetchTasks();
    });

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
      unsubscribeMock();
    };
  }, [fetchTasks]);

  // Tenant staff list
  const staffList = useMemo(() => {
    return mockDb.users.filter(u => u.tenant_id === activeTenant.id);
  }, [activeTenant.id, storeTick]);

  useEffect(() => {
    if (staffList.length > 0 && !targetUserId) {
      setTargetUserId(staffList[0].id);
    }
  }, [staffList, targetUserId]);

  const isNotaris = activeUser.role === 'NOTARIS';

  // Tasks filtered
  const tasks = useMemo(() => {
    // MODUL LIST TUGAS: HANYA menampilkan order/tugas yang MASIH BERJALAN / BELUM SELESAI
    let list = rawTasks.filter(t => t.status !== 'DONE' && t.status !== 'COMPLETED');
    
    // Karyawan (non-Notaris) strictly see ONLY tasks assigned to them
    if (!isNotaris || onlyMyTasks) {
      list = list.filter(t => 
        t.assigned_to_user_name.toLowerCase().includes(activeUser.name.toLowerCase()) ||
        (t as any).assigned_to_user_id === activeUser.id
      );
    }

    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      list = list.filter(t => 
        t.title.toLowerCase().includes(q) || 
        t.order_title.toLowerCase().includes(q) || 
        t.assigned_to_user_name.toLowerCase().includes(q)
      );
    }
    return list;
  }, [rawTasks, isNotaris, onlyMyTasks, activeUser.name, activeUser.id, searchQuery]);

  // Handle Handover Task
  const handleHandover = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!handoverTaskId || !targetUserId) return;

    const targetUser = staffList.find(u => u.id === targetUserId);
    if (!targetUser) return;

    try {
      if (mockDb.isSupabaseConfigured()) {
        const { error: hErr } = await supabase
          .from('tasks')
          .update({ assigned_to_user_id: targetUserId })
          .eq('id', handoverTaskId);

        if (hErr) {
          console.error('Error in handover task in Supabase:', hErr);
          throw hErr;
        }
      }
      await mockDb.handoverTask(handoverTaskId, targetUserId, targetUser.name);
      await mockDb.addAuditLog(
        activeTenant.id, 
        activeUser.name, 
        'HANDOVER_TASK', 
        `Melimpahkan tugas "${rawTasks.find(t => t.id === handoverTaskId)?.title}" kepada ${targetUser.name}`
      );
      setHandoverTaskId(null);
      fetchTasks();
    } catch (err: any) {
      console.error('Gagal melimpahkan tugas:', err);
      setErrorMsg(`Gagal melimpahkan tugas: ${err.message || 'Terjadi kesalahan'}`);
    }
  };

  // Handle update task status directly with authorization check
  const handleUpdateTaskStatus = async (taskId: string, targetStatus: Task['status']) => {
    const task = rawTasks.find(t => t.id === taskId) || mockDb.tasks.find(t => t.id === taskId);
    if (!task) return;

    // Authorization Check: Notaris or assigned user / PIC
    const isPIC = task.assigned_to_user_name.toLowerCase().includes(activeUser.name.toLowerCase()) ||
                  (task as any).assigned_to_user_id === activeUser.id;
    const isNotaris = activeUser.role === 'NOTARIS';

    if (!isPIC && !isNotaris) {
      setErrorMsg('Anda tidak memiliki akses untuk mengubah tugas ini');
      return;
    }

    try {
      if (mockDb.isSupabaseConfigured()) {
        const { error: updateErr } = await supabase
          .from('tasks')
          .update({ status: targetStatus })
          .eq('id', taskId);

        if (updateErr) {
          console.error('Error updating task status in Supabase:', updateErr);
          throw updateErr;
        }
      }
      await mockDb.updateTaskStatus(activeTenant.id, taskId, targetStatus, activeUser.name);
      await mockDb.addAuditLog(
        activeTenant.id,
        activeUser.name,
        'UPDATE_TASK_STATUS',
        `Mengubah status tugas "${task.title}" menjadi ${targetStatus}`
      );
      setErrorMsg(null);
      fetchTasks();
    } catch (err: any) {
      console.error('Gagal mengubah status tugas:', err);
      setErrorMsg(`Gagal mengubah status tugas: ${err.message || 'Terjadi kesalahan'}`);
    }
  };

  // Handle Delete Task (Notaris Only)
  const handleDeleteTask = async (taskId: string) => {
    if (activeUser.role !== 'NOTARIS') {
      setErrorMsg('Hanya Notaris yang berhak menghapus tugas!');
      return;
    }

    setIsDeletingTask(true);
    setErrorMsg(null);

    try {
      if (mockDb.isSupabaseConfigured()) {
        await supabase.from('checklists').delete().eq('task_id', taskId);
        const { error } = await supabase.from('tasks').delete().eq('id', taskId);
        if (error) throw error;
      }

      mockDb.tasks = mockDb.tasks.filter(t => t.id !== taskId);
      await mockDb.addAuditLog(
        activeTenant.id,
        activeUser.name,
        'DELETE_TASK',
        `Menghapus tugas ${taskId.substring(0, 8)}`
      );
      mockDb.notify();

      setDeleteConfirmTask(null);
      fetchTasks();
    } catch (err: any) {
      console.error('Error Delete Task:', err);
      setErrorMsg(err.message || 'Gagal menghapus tugas');
    } finally {
      setIsDeletingTask(false);
    }
  };

  // Handle Add / Create New Task
  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) {
      setErrorMsg('Judul tugas wajib diisi!');
      return;
    }

    setIsSubmittingTask(true);
    setErrorMsg(null);

    try {
      const tenantId = activeTenant?.id || activeUser?.tenant_id || 'a0000000-0000-0000-0000-000000000001';

      const payload = {
        tenant_id: tenantId,
        title: newTaskTitle.trim(),
        description: newTaskDescription.trim() || null,
        status: newTaskStatus || 'PENDING',
        order_id: newTaskOrderId && newTaskOrderId.trim() !== '' ? newTaskOrderId : null,
        assigned_to_user_id: newTaskAssignedTo && newTaskAssignedTo.trim() !== '' ? newTaskAssignedTo : (activeUser.id || null)
      };

      let insertedTask: Task | null = null;

      if (mockDb.isSupabaseConfigured()) {
        const { data, error } = await supabase
          .from('tasks')
          .insert([payload])
          .select();

        if (error) {
          console.error('Error Add Task to Supabase:', error);
          throw error;
        }

        if (data && data[0]) {
          const t = data[0];
          const orderObj = mockDb.orders.find(o => o.id === t.order_id);
          const staffObj = staffList.find(s => s.id === t.assigned_to_user_id);

          insertedTask = {
            id: t.id,
            tenant_id: t.tenant_id,
            order_id: t.order_id || '',
            order_title: orderObj ? orderObj.title : 'Tugas Mandiri',
            title: t.title,
            description: t.description || '',
            assigned_to_user_name: staffObj ? staffObj.name : activeUser.name,
            status: t.status
          };
        }
      }

      if (!insertedTask) {
        const taskId = `e0000000-0000-0000-0000-${Math.random().toString(36).substring(2, 12)}`;
        const orderObj = mockDb.orders.find(o => o.id === payload.order_id);
        const staffObj = staffList.find(s => s.id === payload.assigned_to_user_id);

        insertedTask = {
          id: taskId,
          tenant_id: tenantId,
          order_id: payload.order_id || '',
          order_title: orderObj ? orderObj.title : 'Tugas Mandiri',
          title: payload.title,
          description: payload.description || '',
          assigned_to_user_name: staffObj ? staffObj.name : activeUser.name,
          status: payload.status as any
        };
      }

      mockDb.tasks.unshift(insertedTask);

      // Insert template checklist items if selected
      if (newTaskTemplateId) {
        const tmpl = mockDb.orderTemplates.find(t => t.id === newTaskTemplateId);
        if (tmpl) {
          const items = tmpl.checklists || tmpl.checklist_items || [];
          if (items.length > 0) {
            if (mockDb.isSupabaseConfigured()) {
              const chkInserts = items.map(it => ({
                tenant_id: tenantId,
                task_id: insertedTask!.id,
                item_name: it,
                is_checked: false
              }));
              const { error: chkErr } = await supabase.from('checklists').insert(chkInserts);
              if (chkErr) console.error("Error inserting template checklists into Supabase:", chkErr);
            } else {
              for (const it of items) {
                await mockDb.addChecklistItem(insertedTask!.id, tenantId, it);
              }
            }
          }
        }
      }

      await mockDb.addAuditLog(
        tenantId,
        activeUser.name,
        'CREATE_TASK',
        `Menambahkan tugas baru: "${insertedTask.title}"`
      );
      mockDb.notify();

      // Reset Form State & Close Modal
      setNewTaskTitle('');
      setNewTaskDescription('');
      setNewTaskOrderId('');
      setNewTaskTemplateId('');
      setIsCreateTaskOpen(false);

      fetchTasks();
    } catch (err: any) {
      console.error('Error Add Task:', err);
      setErrorMsg(err.message || 'Gagal menyimpan tugas ke Supabase');
    } finally {
      setIsSubmittingTask(false);
    }
  };

  return (
    <div id="task-mgmt-container" className="space-y-6">
      
      {/* Toast Error Alert Banner if any */}
      {errorMsg && (
        <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl text-xs flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg(null)} className="text-rose-400 hover:text-rose-200 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header Panel */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-500/10 text-indigo-400 p-2.5 rounded-lg border border-indigo-500/20">
            <FileCheck className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2 font-sans">
              Daftar Tugas Kerja Kantor
            </h2>
            <p className="text-xs text-slate-400 font-sans">
              Daftar pekerjaan dan berkas order yang ditugaskan kepada tim.
            </p>
          </div>
        </div>

        {/* Filter Toggle */}
        <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 p-1.5 rounded-lg text-xs font-sans">
          {isNotaris ? (
            <>
              <button
                onClick={() => setOnlyMyTasks(true)}
                className={`px-3 py-1.5 rounded font-semibold transition-all cursor-pointer ${
                  onlyMyTasks 
                    ? 'bg-indigo-600 text-white shadow' 
                    : 'text-slate-400 hover:text-slate-300'
                }`}
              >
                Tugas Saya
              </button>
              <button
                onClick={() => setOnlyMyTasks(false)}
                className={`px-3 py-1.5 rounded font-semibold transition-all cursor-pointer ${
                  !onlyMyTasks 
                    ? 'bg-indigo-600 text-white shadow' 
                    : 'text-slate-400 hover:text-slate-300'
                }`}
              >
                Semua Tugas Kantor
              </button>
            </>
          ) : (
            <span className="px-3 py-1.5 bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 rounded-md font-semibold text-xs flex items-center gap-1.5 font-sans">
              <User className="w-3.5 h-3.5 text-indigo-400" />
              <span>Tugas Khusus untuk: <strong>{activeUser.name}</strong></span>
            </span>
          )}
        </div>
      </div>

      {/* Search Input */}
      <div className="flex items-center bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 shadow-inner">
        <Search className="w-4 h-4 text-slate-500 shrink-0 mr-3" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Cari tugas berdasarkan judul, nomor berkas, nama staf..."
          className="bg-transparent text-slate-200 placeholder:text-slate-500 focus:outline-none text-xs w-full font-sans"
        />
        {searchQuery && (
          <button onClick={() => setSearchQuery('')} className="text-slate-500 hover:text-slate-300 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Tasks List / Loading / Empty State */}
      <div className="space-y-3">
        {loading ? (
          <div className="p-12 text-center text-slate-500 bg-slate-900 border border-slate-800 rounded-xl flex flex-col items-center justify-center gap-3">
            <div className="w-8 h-8 border-3 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
            <p className="text-xs text-slate-400 font-medium font-sans">Memuat data tugas dari Supabase...</p>
          </div>
        ) : tasks.length === 0 ? (
          <div className="p-12 text-center text-slate-500 bg-slate-900 border border-slate-800 rounded-xl">
            <ClipboardList className="w-12 h-12 text-slate-700 mx-auto mb-3" />
            <p className="text-sm font-medium text-slate-400 font-sans">Belum ada tugas tersimpan</p>
            <p className="text-xs text-slate-500 mt-1 font-sans">Daftar tugas akan otomatis muncul di sini setelah order/akta baru dibuat.</p>
          </div>
        ) : (
          tasks.map((task) => {
            const isTaskAssignedToMe = task.assigned_to_user_name.toLowerCase().includes(activeUser.name.toLowerCase()) || (task as any).assigned_to_user_id === activeUser.id;
            const canModifyTask = isNotaris || isTaskAssignedToMe;

            return (
              <div key={task.id} className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col gap-4 hover:border-slate-700 transition-colors">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-mono font-bold bg-slate-950 text-slate-400 border border-slate-800 px-1.5 py-0.5 rounded">
                        AKTA: {task.order_title}
                      </span>
                      <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded uppercase ${
                        task.status === 'DONE' 
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                          : task.status === 'ON_PROGRESS' 
                            ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                            : 'bg-slate-500/10 text-slate-400 border border-slate-750'
                      }`}>
                        {task.status}
                      </span>
                    </div>
                    
                    <h4 className="font-semibold text-slate-100 text-sm font-sans">{task.title}</h4>
                    <p className="text-[11px] text-slate-400 leading-normal max-w-xl">{task.description}</p>
                    
                    <div className="flex items-center gap-1.5 text-xs text-slate-500 font-sans">
                      <User className="w-3.5 h-3.5 text-slate-600" />
                      <span>Dikerjakan oleh: <strong className="text-slate-300">{task.assigned_to_user_name}</strong></span>
                      {isTaskAssignedToMe && (
                        <span className="text-[10px] font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-1.5 py-0.2 rounded ml-1">
                          (Tugas Anda)
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Interaction Controls */}
                  <div className="flex flex-col md:flex-row items-start md:items-center gap-3 self-start md:self-center font-sans">
                    <div className="bg-slate-950 p-2 rounded-lg border border-slate-800/80 text-xs">
                      <span className="text-[9px] text-slate-500 uppercase tracking-widest font-mono font-bold block mb-1">
                        Atur Status Tugas
                      </span>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {[
                          { id: 'PENDING', label: 'PENDING' },
                          { id: 'ON_PROGRESS', label: 'ON PROGRESS' },
                          { id: 'DONE', label: 'SELESAI (DONE)' }
                        ].map((st) => {
                          const isActive = task.status === st.id || (st.id === 'PENDING' && task.status === 'TODO');
                          return (
                            <button
                              key={st.id}
                              disabled={!canModifyTask}
                              onClick={() => handleUpdateTaskStatus(task.id, st.id as Task['status'])}
                              className={`px-2 py-1 rounded text-[10px] font-mono font-bold transition-all ${
                                !canModifyTask
                                  ? 'opacity-40 cursor-not-allowed bg-slate-900 text-slate-600 border border-slate-800'
                                  : isActive
                                  ? st.id === 'DONE'
                                    ? 'bg-emerald-600 text-white shadow cursor-pointer'
                                    : st.id === 'ON_PROGRESS'
                                      ? 'bg-blue-600 text-white shadow cursor-pointer'
                                      : 'bg-indigo-600 text-white shadow cursor-pointer'
                                  : 'bg-slate-900 text-slate-500 border border-slate-800 hover:border-slate-700 hover:text-slate-300 cursor-pointer'
                              }`}
                              title={!canModifyTask ? 'Hanya PIC tugas atau Notaris yang dapat mengubah status' : ''}
                            >
                              {st.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {canModifyTask && (
                        <button
                          onClick={() => setHandoverTaskId(task.id)}
                          className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-400 font-bold text-[10px] rounded-lg border border-indigo-500/25 transition-all cursor-pointer font-sans"
                          title="Handover Tugas ke Karyawan Lain secara Dinamis"
                        >
                          <ArrowRightLeft className="w-3.5 h-3.5" />
                          Handover Tugas
                        </button>
                      )}

                    {activeUser.role === 'NOTARIS' && (
                      <button
                        onClick={() => setDeleteConfirmTask(task)}
                        className="p-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 font-bold text-[10px] rounded-lg border border-rose-500/20 transition-all cursor-pointer"
                        title="Hapus Tugas (Khusus Notaris)"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Interactive Checklist Widget */}
              <TaskChecklistWidget
                taskId={task.id}
                orderTitle={task.order_title}
                taskTitle={task.title}
                assignedToUserId={(task as any).assigned_to_user_id}
                assignedToUserName={task.assigned_to_user_name}
                activeUser={activeUser}
                activeTenant={activeTenant}
              />
            </div>
          );
        })
        )}
      </div>

      {/* TASK MODALS */}
      <AnimatePresence>
        {/* Modal Create Task */}
        {isCreateTaskOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-lg shadow-2xl relative"
            >
              <button
                onClick={() => setIsCreateTaskOpen(false)}
                className="absolute top-4 right-4 text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>

              <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider font-sans mb-1 flex items-center gap-2">
                <FileCheck className="w-4 h-4 text-indigo-400" />
                Pendaftaran Tugas Kerja Baru
              </h3>
              <p className="text-[11px] text-slate-400 mb-4 font-sans">
                Buat dan tugaskan pekerjaan kantor atau pengerjaan berkas ke karyawan.
              </p>

              <form onSubmit={handleAddTask} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Judul Tugas *</label>
                  <input
                    type="text"
                    required
                    value={newTaskTitle}
                    onChange={(e) => setNewTaskTitle(e.target.value)}
                    placeholder="Contoh: Verifikasi Sertifikat & Cek PBB"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 font-sans"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Deskripsi Pekerjaan</label>
                  <textarea
                    rows={2}
                    value={newTaskDescription}
                    onChange={(e) => setNewTaskDescription(e.target.value)}
                    placeholder="Deskripsi detail instruksi pekerjaan..."
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 font-sans"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center justify-between">
                    <span>Salin Checklist dari Template Order (Opsional)</span>
                    <span className="text-[9px] text-indigo-400 font-normal">Otomatis isi checklist</span>
                  </label>
                  <select
                    value={newTaskTemplateId}
                    onChange={(e) => {
                      const val = e.target.value;
                      setNewTaskTemplateId(val);
                      if (val) {
                        const tmpl = mockDb.orderTemplates.find(t => t.id === val);
                        if (tmpl && !newTaskTitle.trim()) {
                          setNewTaskTitle(`Persyaratan & Pemberkasan - ${tmpl.name}`);
                        }
                      }
                    }}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 font-sans"
                  >
                    <option value="">-- Tanpa Template Checklist (Kosong) --</option>
                    {mockDb.orderTemplates.map((tmpl) => (
                      <option key={tmpl.id} value={tmpl.id}>
                        {tmpl.name} ({(tmpl.checklist_items || tmpl.checklists || []).length} syarat)
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Kaitkan ke Order (Opsional)</label>
                    <select
                      value={newTaskOrderId}
                      onChange={(e) => {
                        const ordId = e.target.value;
                        setNewTaskOrderId(ordId);
                        if (ordId) {
                          const selOrd = mockDb.orders.find(o => o.id === ordId);
                          if (selOrd) {
                            const matched = mockDb.orderTemplates.find(t => 
                              selOrd.title.toLowerCase().includes(t.name.toLowerCase()) ||
                              t.name.toLowerCase().split(/[\s/]+/).some(w => w.length >= 3 && selOrd.title.toLowerCase().includes(w))
                            );
                            if (matched) {
                              setNewTaskTemplateId(matched.id);
                              if (!newTaskTitle.trim()) {
                                setNewTaskTitle(`Persyaratan & Pemberkasan - ${matched.name}`);
                              }
                            }
                          }
                        }
                      }}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 font-sans"
                    >
                      <option value="">-- Tugas Mandiri / Non-Order --</option>
                      {mockDb.orders.filter(o => o.tenant_id === activeTenant.id).map(ord => (
                        <option key={ord.id} value={ord.id}>
                          {ord.title}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Penanggung Jawab</label>
                    <select
                      value={newTaskAssignedTo}
                      onChange={(e) => setNewTaskAssignedTo(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 font-sans"
                    >
                      {staffList.map(st => (
                        <option key={st.id} value={st.id}>
                          {st.name} ({st.role})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Status Awal</label>
                  <select
                    value={newTaskStatus}
                    onChange={(e) => setNewTaskStatus(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 font-sans"
                  >
                    <option value="PENDING">PENDING (Belum Dimulai)</option>
                    <option value="ON_PROGRESS">ON_PROGRESS (Dalam Proses)</option>
                    <option value="COMPLETED">COMPLETED (Selesai)</option>
                  </select>
                </div>

                <div className="pt-2 flex justify-end gap-3 text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => setIsCreateTaskOpen(false)}
                    className="px-4 py-2 hover:bg-slate-800 text-slate-400 rounded-lg transition-colors cursor-pointer font-sans"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingTask}
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed font-sans text-xs font-semibold"
                  >
                    {isSubmittingTask ? (
                      <>
                        <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                        </svg>
                        <span>Menyimpan Tugas...</span>
                      </>
                    ) : (
                      <span>Buat Tugas Baru</span>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {/* HANDOVER TASK MODAL */}
        {handoverTaskId && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-900 border border-slate-800 rounded-xl p-6 w-full max-w-sm shadow-2xl relative"
            >
              <button
                onClick={() => setHandoverTaskId(null)}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>

              <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider font-sans mb-1 flex items-center gap-2">
                <ArrowRightLeft className="w-4 h-4 text-indigo-400" />
                Handover / Pelimpahan Tugas
              </h3>
              <p className="text-[11px] text-slate-400 mb-4 font-sans">
                Pilih karyawan penanggung jawab baru untuk tugas ini.
              </p>

              <form onSubmit={handleHandover} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Karyawan Penerima Tugas</label>
                  <select
                    value={targetUserId}
                    onChange={(e) => setTargetUserId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 font-sans"
                  >
                    {staffList.map(st => (
                      <option key={st.id} value={st.id}>
                        {st.name} ({st.role})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="pt-2 flex justify-end gap-3 text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => setHandoverTaskId(null)}
                    className="px-4 py-2 hover:bg-slate-800 text-slate-400 rounded-lg transition-colors cursor-pointer font-sans"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-all cursor-pointer font-sans"
                  >
                    Limpahkan
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {/* Modal Delete Task Confirmation */}
        {deleteConfirmTask && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm font-sans">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-slate-900 border border-slate-800 rounded-xl p-6 w-full max-w-md shadow-2xl relative"
            >
              <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider mb-2 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400" />
                Konfirmasi Hapus Tugas
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed mb-5">
                Apakah Anda yakin ingin menghapus Tugas <strong className="text-white">"{deleteConfirmTask.title}"</strong>? Tindakan ini tidak dapat dibatalkan.
              </p>
              <div className="flex justify-end gap-3 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setDeleteConfirmTask(null)}
                  disabled={isDeletingTask}
                  className="px-4 py-2 hover:bg-slate-800 text-slate-400 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteTask(deleteConfirmTask.id)}
                  disabled={isDeletingTask}
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 font-bold"
                >
                  {isDeletingTask ? (
                    <>
                      <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                      </svg>
                      <span>Menghapus...</span>
                    </>
                  ) : (
                    <span>Hapus Tugas</span>
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

