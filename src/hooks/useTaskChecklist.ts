import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { mockDb } from '../lib/mockStore';
import { ChecklistItem } from '../data/schemaData';

export interface UseTaskChecklistResult {
  loading: boolean;
  error: string | null;
  data: ChecklistItem[];
  refetch: () => void;
  toggleChecklistItem: (checklistId: string, isChecked: boolean, userId: string, userName: string) => Promise<void>;
  addChecklistItem: (itemName: string, tenantId: string) => Promise<void>;
  applyTemplateChecklists: (items: string[], tenantId: string) => Promise<void>;
}

export function useTaskChecklist(taskId: string): UseTaskChecklistResult {
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);

  // Main data fetch function
  const fetchData = useCallback(async () => {
    if (!taskId) return;
    setLoading(true);
    setError(null);

    try {
      if (mockDb.isSupabaseConfigured()) {
        // 1. Real Supabase Client logic
        const { data, error: fetchError } = await supabase
          .from('checklists')
          .select('*')
          .eq('task_id', taskId)
          .order('id', { ascending: true });

        if (fetchError) throw fetchError;
        setChecklist(data || []);
      } else {
        // 2. Reactive local mock data fallback
        await mockDb.delay(100);
        const items = mockDb.checklists.filter(c => c.task_id === taskId);
        setChecklist([...items]);
      }
    } catch (err: any) {
      console.error('Error fetching checklist data:', err);
      setError(err.message || 'Gagal mengambil data checklist tugas');
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  // Action: Toggle checklist checkbox status
  const toggleChecklistItem = useCallback(async (
    checklistId: string,
    isChecked: boolean,
    userId: string,
    userName: string
  ) => {
    setLoading(true);
    setError(null);
    try {
      if (mockDb.isSupabaseConfigured()) {
        const payload = isChecked ? {
          is_checked: true,
          checked_by_user_id: userId,
          checked_at: new Date().toISOString()
        } : {
          is_checked: false,
          checked_by_user_id: null,
          checked_at: null
        };

        const { error: updateError } = await supabase
          .from('checklists')
          .update(payload)
          .eq('id', checklistId);

        if (updateError) throw updateError;
        await fetchData();
      } else {
        await mockDb.toggleChecklist(checklistId, isChecked, userId, userName);
        await fetchData();
      }
    } catch (err: any) {
      console.error('Error toggling checklist item:', err);
      setError(err.message || 'Gagal memperbarui status checklist');
      setLoading(false);
      throw err;
    }
  }, [fetchData]);

  // Action: Add new custom requirement checklist item
  const addChecklistItem = useCallback(async (itemName: string, tenantId: string) => {
    if (!itemName.trim()) return;
    setLoading(true);
    setError(null);
    try {
      if (mockDb.isSupabaseConfigured()) {
        const { error: insertError } = await supabase
          .from('checklists')
          .insert({
            tenant_id: tenantId,
            task_id: taskId,
            item_name: itemName,
            is_checked: false
          });

        if (insertError) throw insertError;
        await fetchData();
      } else {
        await mockDb.addChecklistItem(taskId, tenantId, itemName);
        await fetchData();
      }
    } catch (err: any) {
      console.error('Error adding checklist item:', err);
      setError(err.message || 'Gagal menambahkan checklist baru');
      setLoading(false);
      throw err;
    }
  }, [taskId, fetchData]);

  // Action: Apply list of checklist items from an Order Template
  const applyTemplateChecklists = useCallback(async (items: string[], tenantId: string) => {
    if (!items || items.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      if (mockDb.isSupabaseConfigured()) {
        const inserts = items.map(itemName => ({
          tenant_id: tenantId,
          task_id: taskId,
          item_name: itemName,
          is_checked: false
        }));
        const { error: insertError } = await supabase
          .from('checklists')
          .insert(inserts);

        if (insertError) throw insertError;
        await fetchData();
      } else {
        for (const itemName of items) {
          await mockDb.addChecklistItem(taskId, tenantId, itemName);
        }
        await fetchData();
      }
    } catch (err: any) {
      console.error('Error applying template checklists:', err);
      setError(err.message || 'Gagal menerapkan template checklist');
      setLoading(false);
      throw err;
    }
  }, [taskId, fetchData]);

  // Handle initialization and automatic reactivity
  useEffect(() => {
    fetchData();

    // Subscribe to reactive local mock changes to keep all active UI synchronised
    const unsubscribe = mockDb.subscribe(() => {
      fetchData();
    });

    return () => {
      unsubscribe();
    };
  }, [taskId, fetchData]);

  return {
    loading,
    error,
    data: checklist,
    refetch: fetchData,
    toggleChecklistItem,
    addChecklistItem,
    applyTemplateChecklists
  };
}
