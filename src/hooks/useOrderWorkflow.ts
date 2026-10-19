import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { mockDb } from '../lib/mockStore';
import { Order, Task } from '../data/schemaData';

export interface UseOrderWorkflowResult {
  loading: boolean;
  error: string | null;
  data: {
    order: Order | null;
    tasks: Task[];
  };
  refetch: () => void;
  updateOrderStatus: (status: Order['status']) => Promise<void>;
  handoverTask: (taskId: string, targetUserId: string, targetUserName: string) => Promise<void>;
}

export function useOrderWorkflow(orderId: string): UseOrderWorkflowResult {
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [order, setOrder] = useState<Order | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);

  // Main data fetch function
  const fetchData = useCallback(async () => {
    if (!orderId) return;
    setLoading(true);
    setError(null);

    try {
      if (mockDb.isSupabaseConfigured()) {
        // 1. Real Supabase Client logic
        const { data: orderData, error: orderError } = await supabase
          .from('orders')
          .select('*, clients(name)')
          .eq('id', orderId)
          .single();

        if (orderError) throw orderError;

        const { data: tasksData, error: tasksError } = await supabase
          .from('tasks')
          .select('*')
          .eq('order_id', orderId)
          .order('created_at', { ascending: true });

        if (tasksError) throw tasksError;

        // Map Supabase response to consistent client schema
        const mappedOrder: Order = {
          id: orderData.id,
          tenant_id: orderData.tenant_id,
          client_id: orderData.client_id,
          client_name: orderData.clients?.name || 'Klien Tidak Dikenal',
          title: orderData.title,
          status: orderData.status,
          created_at: orderData.created_at
        };

        setOrder(mappedOrder);
        setTasks(tasksData || []);
      } else {
        // 2. Reactive local mock data fallback
        await mockDb.delay(150); // Small artificial delay
        const foundOrder = mockDb.orders.find(o => o.id === orderId);
        const associatedTasks = mockDb.tasks.filter(t => t.order_id === orderId);

        setOrder(foundOrder ? { ...foundOrder } : null);
        setTasks([...associatedTasks]);
      }
    } catch (err: any) {
      console.error('Error fetching order workflow data:', err);
      setError(err.message || 'Gagal mengambil data workflow order');
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  // Action: Update order status
  const updateOrderStatus = useCallback(async (status: Order['status']) => {
    setLoading(true);
    setError(null);
    try {
      if (mockDb.isSupabaseConfigured()) {
        const { error: updateError } = await supabase
          .from('orders')
          .update({ status })
          .eq('id', orderId);

        if (updateError) throw updateError;
        await fetchData();
      } else {
        await mockDb.updateOrderStatus(orderId, status);
        // Reactive subscription triggers automatically, but we can call fetchData to be sure
        await fetchData();
      }
    } catch (err: any) {
      console.error('Error updating order status:', err);
      setError(err.message || 'Gagal memperbarui status order');
      setLoading(false);
      throw err;
    }
  }, [orderId, fetchData]);

  // Action: Handover task assignment to another staff member
  const handoverTask = useCallback(async (taskId: string, targetUserId: string, targetUserName: string) => {
    setLoading(true);
    setError(null);
    try {
      if (mockDb.isSupabaseConfigured()) {
        const { error: handoverError } = await supabase
          .from('tasks')
          .update({ assigned_to_user_id: targetUserId })
          .eq('id', taskId);

        if (handoverError) throw handoverError;
        await fetchData();
      } else {
        await mockDb.handoverTask(taskId, targetUserId, targetUserName);
        await fetchData();
      }
    } catch (err: any) {
      console.error('Error during task handover:', err);
      setError(err.message || 'Gagal menyerahkan tugas pengerjaan');
      setLoading(false);
      throw err;
    }
  }, [fetchData]);

  // Handle initialization and automatic reactivity
  useEffect(() => {
    fetchData();

    let channel: any = null;
    if (mockDb.isSupabaseConfigured() && orderId) {
      channel = supabase
        .channel(`realtime-order-tasks-${orderId}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'tasks', filter: `order_id=eq.${orderId}` },
          () => {
            fetchData();
          }
        )
        .subscribe();
    }

    // Subscribe to reactive local mock changes to keep all active UI synchronised
    const unsubscribe = mockDb.subscribe(() => {
      fetchData();
    });

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
      unsubscribe();
    };
  }, [orderId, fetchData]);

  return {
    loading,
    error,
    data: {
      order,
      tasks
    },
    refetch: fetchData,
    updateOrderStatus,
    handoverTask
  };
}
