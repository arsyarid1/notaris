import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ClipboardList, 
  Plus, 
  Search, 
  Edit2, 
  Trash2, 
  X, 
  AlertCircle, 
  CheckCircle2, 
  ListPlus, 
  ChevronRight,
  Sparkles,
  Layers,
  Loader2,
  RefreshCw
} from 'lucide-react';
import { mockDb, deduplicateTemplates } from '../lib/mockStore';
import { User as UserType } from '../data/schemaData';
import { supabase } from '../lib/supabase';

interface TemplateManagementProps {
  activeUser: UserType;
  activeTenant: { id: string; company_name: string };
}

export default function TemplateManagement({ activeUser, activeTenant }: TemplateManagementProps) {
  const [storeTick, setStoreTick] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modal state
  const [isOpen, setIsOpen] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  
  // Loading states
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Form fields
  const [templateName, setTemplateName] = useState('');
  const [checklistItems, setChecklistItems] = useState<string[]>(['']);
  
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Live Supabase Templates & state
  const [dbTemplates, setDbTemplates] = useState<any[]>([]);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Live Fetch Templates from Supabase
  const fetchLiveTemplates = async () => {
    setIsLoading(true);
    setFetchError(null);
    try {
      if (mockDb.isSupabaseConfigured()) {
        const { data, error } = await supabase
          .from('order_templates')
          .select('*');
        
        if (error) {
          console.error("Gagal mengambil live templates dari Supabase:", error);
          setFetchError(`Koneksi Database bermasalah (${error.message || '401 Unauthorized'})`);
          return;
        }

        if (data) {
          const mapped = data.map((t: any) => ({
            id: t.id,
            tenant_id: t.tenant_id,
            name: t.name,
            checklist_items: Array.isArray(t.checklists) ? t.checklists : (Array.isArray(t.checklist_items) ? t.checklist_items : [])
          }));
          setDbTemplates(deduplicateTemplates(mapped));
        }
      }
    } catch (err: any) {
      console.warn("Gagal mengambil live templates dari Supabase:", err);
      setFetchError(err?.message || 'Gagal tersambung ke database Supabase');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLiveTemplates();
  }, [activeTenant.id, storeTick]);

  // Subscribe to changes
  useEffect(() => {
    const unsubscribe = mockDb.subscribe(() => {
      setStoreTick(prev => prev + 1);
    });
    return () => unsubscribe();
  }, []);

  // Filtered templates: prioritize live dbTemplates from Supabase
  const templates = useMemo(() => {
    let list = dbTemplates.length > 0 
      ? dbTemplates 
      : (mockDb.isSupabaseConfigured() && fetchError ? [] : mockDb.orderTemplates);
    
    list = deduplicateTemplates(list);

    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      list = list.filter(t => t.name.toLowerCase().includes(q));
    }
    return list;
  }, [searchQuery, storeTick, dbTemplates, fetchError]);

  // Open modal for create
  const handleOpenCreate = () => {
    setEditingTemplateId(null);
    setTemplateName('');
    setChecklistItems(['']);
    setErrorMessage('');
    setSuccessMessage('');
    setIsOpen(true);
  };

  // Open modal for edit
  const handleOpenEdit = (template: { id: string; name: string; checklist_items: string[] }) => {
    setEditingTemplateId(template.id);
    setTemplateName(template.name);
    setChecklistItems(template.checklist_items.length > 0 ? [...template.checklist_items] : ['']);
    setErrorMessage('');
    setSuccessMessage('');
    setIsOpen(true);
  };

  // Add checklist item input line
  const handleAddCheckline = () => {
    setChecklistItems(prev => [...prev, '']);
  };

  // Remove checklist item input line
  const handleRemoveCheckline = (index: number) => {
    if (checklistItems.length <= 1) {
      setChecklistItems(['']);
      return;
    }
    setChecklistItems(prev => prev.filter((_, i) => i !== index));
  };

  // Change single checklist item text
  const handleChecklineChange = (index: number, val: string) => {
    setChecklistItems(prev => {
      const updated = [...prev];
      updated[index] = val;
      return updated;
    });
  };

  // Handle Save Template (Create or Update)
  const handleSaveTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (!templateName.trim()) {
      setErrorMessage('Nama Jenis Order wajib diisi!');
      return;
    }

    const filteredItems = checklistItems.map(item => item.trim()).filter(item => item !== '');
    if (filteredItems.length === 0) {
      setErrorMessage('Minimal isi satu butir checklist standar!');
      return;
    }

    setIsSaving(true);
    try {
      if (mockDb.isSupabaseConfigured()) {
        if (editingTemplateId) {
          const { error } = await supabase
            .from('order_templates')
            .update({
              name: templateName.trim(),
              checklists: filteredItems
            })
            .eq('id', editingTemplateId);

          if (error) {
            const { error: retryError } = await supabase
              .from('order_templates')
              .update({
                name: templateName.trim(),
                checklist_items: filteredItems
              })
              .eq('id', editingTemplateId);

            if (retryError) {
              throw new Error(`Gagal memperbarui ke database: ${retryError.message}`);
            }
          }
        } else {
          // INSERT query to 'order_templates' table
          const { error } = await supabase
            .from('order_templates')
            .insert({
              tenant_id: activeTenant.id,
              name: templateName.trim(),
              checklists: filteredItems
            });

          if (error) {
            console.warn("Error inserting with 'checklists', trying fallback 'checklist_items':", error);
            const { error: retryError } = await supabase
              .from('order_templates')
              .insert({
                tenant_id: activeTenant.id,
                name: templateName.trim(),
                checklist_items: filteredItems
              });

            if (retryError) {
              throw new Error(`Gagal menyimpan ke database: ${retryError.message}`);
            }
          }
        }
      }

      if (editingTemplateId) {
        await mockDb.updateOrderTemplate(
          activeTenant.id,
          editingTemplateId,
          templateName.trim(),
          filteredItems,
          activeUser.name
        );
        setSuccessMessage('Template order berhasil diperbarui!');
      } else {
        await mockDb.addOrderTemplate(
          activeTenant.id,
          templateName.trim(),
          filteredItems,
          activeUser.name
        );
        setSuccessMessage('Template order baru berhasil disimpan!');
      }

      await fetchLiveTemplates();

      setTimeout(() => {
        setIsOpen(false);
        setSuccessMessage('');
      }, 1000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal menyimpan template.');
    } finally {
      setIsSaving(false);
    }
  };

  // Handle Delete Template
  const handleDeleteTemplate = async (tmplId: string) => {
    if (!window.confirm('Apakah Anda yakin ingin menghapus template order ini?')) {
      return;
    }
    try {
      await mockDb.deleteOrderTemplate(activeTenant.id, tmplId, activeUser.name);
      await fetchLiveTemplates();
    } catch (err: any) {
      alert(err.message || 'Gagal menghapus template.');
    }
  };

  // Handle Manual Seed/Sync Default Data to Supabase
  const [isSyncingSupabase, setIsSyncingSupabase] = useState(false);
  const handleSeedToSupabase = async () => {
    setIsSyncingSupabase(true);
    try {
      const res = await mockDb.seedOrderTemplatesToSupabase();
      if (!res.success) {
        console.error("Gagal menyuntikkan data template ke Supabase:", res.error);
        alert(`Gagal menyuntik data ke database: ${res.error}`);
        return;
      }
      await fetchLiveTemplates();
      alert('Data template berhasil masuk ke Supabase!');
    } catch (err: any) {
      console.error("Gagal menyuntikkan data:", err);
      alert('Gagal menyuntik data: ' + (err.message || err));
    } finally {
      setIsSyncingSupabase(false);
    }
  };

  // Guard access to Notaris only
  if (activeUser.role !== 'NOTARIS') {
    return (
      <div className="p-8 text-center bg-slate-900 border border-slate-800 rounded-xl space-y-3">
        <AlertCircle className="w-12 h-12 text-rose-500 mx-auto" />
        <h3 className="text-lg font-bold text-slate-100">Akses Ditolak</h3>
        <p className="text-xs text-slate-400 font-sans max-w-md mx-auto">
          Halaman Manajemen Template Order ini eksklusif hanya untuk Pimpinan Notaris. Peran Anda saat ini adalah ({activeUser.role}).
        </p>
      </div>
    );
  }

  return (
    <div id="template-mgmt-container" className="space-y-6">
      
      {/* Header Panel */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-500/10 text-indigo-400 p-2.5 rounded-lg border border-indigo-500/20">
              <Layers className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2 flex-wrap">
                Manajemen Template Jenis Order
                <span className="text-[10px] bg-rose-500/10 text-rose-400 border border-rose-500/20 px-2 py-0.5 rounded font-mono font-bold">
                  NOTARIS ONLY
                </span>
                {mockDb.isSupabaseConfigured() && (
                  <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded font-mono font-bold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Supabase Live Connected
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-400 font-sans">
                Atur master jenis order akta dan daftar syarat checklist dokumen standar sebelum pemberkasan diterbitkan.
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2.5">
            {mockDb.isSupabaseConfigured() && (
              <button
                onClick={handleSeedToSupabase}
                disabled={isSyncingSupabase}
                title="Suntikkan data template standar bawaan ke database Supabase"
                className="flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 active:bg-slate-850 text-indigo-300 font-medium text-xs rounded-lg border border-slate-700 transition-all cursor-pointer disabled:opacity-50"
              >
                {isSyncingSupabase ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                ) : (
                  <RefreshCw className="w-3.5 h-3.5 text-indigo-400" />
                )}
                <span>Suntik Data ke Supabase</span>
              </button>
            )}

            <button
              onClick={handleOpenCreate}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white font-medium text-xs rounded-lg shadow transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Buat Template Baru
            </button>
          </div>
        </div>
      </div>

      {/* Search Filter */}
      <div className="flex items-center bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 shadow-inner">
        <Search className="w-4 h-4 text-slate-500 shrink-0 mr-3" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Cari jenis order akta (misal: AJB, PT)..."
          className="bg-transparent text-slate-200 placeholder:text-slate-500 focus:outline-none text-xs w-full font-sans"
        />
        {searchQuery && (
          <button onClick={() => setSearchQuery('')} className="text-slate-500 hover:text-slate-300">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Alert Error State if Fetch from Supabase Fails */}
      {fetchError && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>
              <strong>Koneksi Database:</strong> {fetchError}. Pastikan Vercel/Cloudflare environment variables VITE_SUPABASE_ANON_KEY sudah valid dan tabel memiliki izin akses publik/anonim.
            </span>
          </div>
          <button
            onClick={() => fetchLiveTemplates()}
            className="px-2.5 py-1 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 rounded font-medium text-[11px] shrink-0"
          >
            Coba Lagi
          </button>
        </div>
      )}

      {/* Templates Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {isLoading ? (
          <div className="col-span-2 p-12 text-center text-slate-500 bg-slate-900 border border-slate-800 rounded-xl flex flex-col items-center justify-center space-y-2">
            <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />
            <p className="text-xs text-slate-400">Memuat data template langsung dari Supabase...</p>
          </div>
        ) : templates.length === 0 ? (
          <div className="col-span-2 p-12 text-center text-slate-500 bg-slate-900 border border-slate-800 rounded-xl">
            <ClipboardList className="w-12 h-12 text-slate-700 mx-auto mb-3" />
            <p className="text-sm font-medium text-slate-400">Belum ada template order atau tidak cocok</p>
          </div>
        ) : (
          templates.map((tmpl) => (
            <div key={tmpl.id} className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 hover:border-slate-700 transition-colors flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <h4 className="font-sans font-bold text-slate-100 text-sm">{tmpl.name}</h4>
                    <span className="text-[9px] text-slate-500 font-mono">
                      ID: {tmpl.id}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleOpenEdit(tmpl)}
                      className="p-1.5 bg-slate-950 hover:bg-slate-850 text-slate-400 hover:text-indigo-400 rounded transition-colors cursor-pointer"
                      title="Edit Template"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteTemplate(tmpl.id)}
                      className="p-1.5 bg-slate-950 hover:bg-rose-950/40 text-slate-400 hover:text-rose-400 rounded transition-colors cursor-pointer"
                      title="Hapus Template"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="mt-4 space-y-2">
                  <span className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider block">
                    Checklist Standar Dokumen ({tmpl.checklist_items.length}):
                  </span>
                  
                  <ul className="space-y-1.5">
                    {tmpl.checklist_items.map((item, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-xs text-slate-350">
                        <span className="text-[10px] bg-slate-950 border border-slate-800 text-slate-500 font-mono w-4 h-4 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                          {idx + 1}
                        </span>
                        <span className="leading-tight font-sans">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="flex justify-between items-center text-[10px] text-slate-500 font-mono border-t border-slate-800/40 pt-3">
                <span className="flex items-center gap-1 text-indigo-400">
                  <Sparkles className="w-3 h-3" />
                  Clone Siap Pakai
                </span>
                <span>Kantor Notaris: {activeTenant.company_name.split(' ')[2] || 'Notaris'}</span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* CREATE/EDIT MODAL */}
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-900 border border-slate-800 rounded-xl p-6 w-full max-w-lg shadow-2xl relative max-h-[90vh] overflow-y-auto"
            >
              <button
                onClick={() => { setIsOpen(false); setSuccessMessage(''); }}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>

              <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider font-sans mb-1 flex items-center gap-2">
                <Layers className="w-4 h-4 text-indigo-400" />
                {editingTemplateId ? 'Edit Template Jenis Order' : 'Buat Template Jenis Order Baru'}
              </h3>
              <p className="text-[11px] text-slate-400 mb-4">
                Tentukan nama akta/order beserta checklist butir berkas standar yang wajib dipenuhi.
              </p>

              <form onSubmit={handleSaveTemplate} className="space-y-4">
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

                {/* Template Name */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Nama Jenis Order / Berkas Akta</label>
                  <input
                    type="text"
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                    placeholder="Contoh: Akta Hibah Tanah / Waris"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    required
                  />
                </div>

                {/* Checklist items dynamic builder */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Butir Checklist Standar</label>
                    <button
                      type="button"
                      onClick={handleAddCheckline}
                      className="flex items-center gap-1 text-[10px] font-bold text-indigo-400 hover:text-indigo-300 transition-colors"
                    >
                      <ListPlus className="w-3.5 h-3.5" />
                      Tambah Baris
                    </button>
                  </div>

                  <div className="space-y-2 max-h-[30vh] overflow-y-auto pr-1">
                    {checklistItems.map((item, idx) => (
                      <div key={idx} className="flex gap-2 items-center">
                        <span className="text-[10px] text-slate-500 font-mono shrink-0 w-5">
                          #{idx + 1}
                        </span>
                        <input
                          type="text"
                          value={item}
                          onChange={(e) => handleChecklineChange(idx, e.target.value)}
                          placeholder="Contoh: Fotokopi KTP / Persetujuan Suami-Istri"
                          className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveCheckline(idx)}
                          className="p-2 bg-slate-950 hover:bg-rose-950/40 text-slate-500 hover:text-rose-400 rounded-lg transition-colors cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Actions */}
                <div className="pt-2 flex justify-end gap-3 text-xs font-semibold border-t border-slate-800/60 mt-4">
                  <button
                    type="button"
                    onClick={() => { setIsOpen(false); setSuccessMessage(''); }}
                    className="px-4 py-2 hover:bg-slate-800 text-slate-400 rounded-lg transition-colors"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 disabled:bg-indigo-900 disabled:cursor-not-allowed text-white rounded-lg transition-all flex items-center gap-2 cursor-pointer font-sans"
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                        <span>Proses Menyimpan...</span>
                      </>
                    ) : (
                      editingTemplateId ? 'Simpan Perubahan' : 'Simpan Template'
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
