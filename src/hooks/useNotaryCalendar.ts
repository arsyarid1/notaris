import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { mockDb } from '../lib/mockStore';
import { Appointment } from '../data/schemaData';

export interface UseNotaryCalendarResult {
  loading: boolean;
  error: string | null;
  data: Appointment[];
  refetch: () => void;
  proposeAppointment: (tenantId: string, orderId: string, dateTime: string) => Promise<void>;
  approveAppointment: (apptId: string) => Promise<void>;
  rejectAppointment: (apptId: string) => Promise<void>;
  rescheduleAppointment: (apptId: string, newDateTime: string) => Promise<void>;
}

export function useNotaryCalendar(notaryId: string): UseNotaryCalendarResult {
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);

  // Main data fetch function
  const fetchData = useCallback(async () => {
    if (!notaryId) return;
    setLoading(true);
    setError(null);

    try {
      if (mockDb.isSupabaseConfigured()) {
        // 1. Real Supabase Client logic
        const { data, error: fetchError } = await supabase
          .from('appointments')
          .select('*, orders(title), users:notary_id(name)')
          .eq('notary_id', notaryId)
          .order('date_time', { ascending: true });

        if (fetchError) throw fetchError;

        // Map relationships
        const mapped: Appointment[] = (data || []).map(item => ({
          id: item.id,
          tenant_id: item.tenant_id,
          order_id: item.order_id,
          order_title: item.orders?.title || 'Order Akta Induk',
          notary_id: item.notary_id,
          notary_name: item.users?.name || 'Notaris Rekanan',
          date_time: item.date_time,
          status: item.status
        }));

        setAppointments(mapped);
      } else {
        // 2. Reactive local mock data fallback
        await mockDb.delay(120);
        const list = mockDb.appointments.filter(a => a.notary_id === notaryId);
        setAppointments([...list]);
      }
    } catch (err: any) {
      console.error('Error fetching notary appointments:', err);
      setError(err.message || 'Gagal mengambil jadwal kalender Notaris');
    } finally {
      setLoading(false);
    }
  }, [notaryId]);

  // Action: Propose physical signing appointment
  const proposeAppointment = useCallback(async (tenantId: string, orderId: string, dateTime: string) => {
    if (!dateTime) return;
    setLoading(true);
    setError(null);
    try {
      if (mockDb.isSupabaseConfigured()) {
        const { error: insertError } = await supabase
          .from('appointments')
          .insert({
            tenant_id: tenantId,
            order_id: orderId,
            notary_id: notaryId,
            date_time: dateTime,
            status: 'PROPOSED'
          });

        if (insertError) throw insertError;
        await fetchData();
      } else {
        await mockDb.proposeAppointment(tenantId, orderId, notaryId, dateTime);
        await fetchData();
      }
    } catch (err: any) {
      console.error('Error proposing appointment:', err);
      setError(err.message || 'Gagal mengajukan jadwal temu Notaris');
      setLoading(false);
      throw err;
    }
  }, [notaryId, fetchData]);

  // Action: Approve proposed signing schedule
  const approveAppointment = useCallback(async (apptId: string) => {
    setLoading(true);
    setError(null);
    try {
      if (mockDb.isSupabaseConfigured()) {
        const { error: updateError } = await supabase
          .from('appointments')
          .update({ status: 'APPROVED' })
          .eq('id', apptId);

        if (updateError) throw updateError;
        await fetchData();
      } else {
        await mockDb.updateAppointmentStatus(apptId, 'APPROVED');
        await fetchData();
      }
    } catch (err: any) {
      console.error('Error approving appointment:', err);
      setError(err.message || 'Gagal menyetujui jadwal temu Notaris');
      setLoading(false);
      throw err;
    }
  }, [fetchData]);

  // Action: Reject/Reschedule proposed signing schedule
  const rejectAppointment = useCallback(async (apptId: string) => {
    setLoading(true);
    setError(null);
    try {
      if (mockDb.isSupabaseConfigured()) {
        const { error: updateError } = await supabase
          .from('appointments')
          .update({ status: 'REJECTED' })
          .eq('id', apptId);

        if (updateError) throw updateError;
        await fetchData();
      } else {
        await mockDb.updateAppointmentStatus(apptId, 'REJECTED');
        await fetchData();
      }
    } catch (err: any) {
      console.error('Error rejecting appointment:', err);
      setError(err.message || 'Gagal menolak pengajuan jadwal');
      setLoading(false);
      throw err;
    }
  }, [fetchData]);

  // Action: Reschedule proposed signing schedule (Counter-Proposal)
  const rescheduleAppointment = useCallback(async (apptId: string, newDateTime: string) => {
    setLoading(true);
    setError(null);
    try {
      if (mockDb.isSupabaseConfigured()) {
        const { error: updateError } = await supabase
          .from('appointments')
          .update({ date_time: newDateTime, status: 'RESCHEDULED' })
          .eq('id', apptId);

        if (updateError) throw updateError;
        await fetchData();
      } else {
        await mockDb.rescheduleAppointment(apptId, newDateTime, 'RESCHEDULED');
        await fetchData();
      }
    } catch (err: any) {
      console.error('Error rescheduling appointment:', err);
      setError(err.message || 'Gagal mengubah jadwal');
      setLoading(false);
      throw err;
    }
  }, [fetchData]);

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
  }, [notaryId, fetchData]);

  return {
    loading,
    error,
    data: appointments,
    refetch: fetchData,
    proposeAppointment,
    approveAppointment,
    rejectAppointment,
    rescheduleAppointment
  };
}
