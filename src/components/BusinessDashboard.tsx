import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Clock,
  Calendar as CalendarIcon,
  User,
  Plus,
  Check,
  CheckSquare,
  Square,
  MessageSquare,
  UploadCloud,
  AlertCircle,
  TrendingUp,
  Megaphone,
  UserPlus,
  FileText,
  Send,
  Activity,
  ChevronRight,
  CheckCircle2,
  XCircle,
  X,
  ArrowRight,
  Users,
  Briefcase,
  DollarSign,
  Edit,
  Trash2
} from 'lucide-react';
import { mockDb } from '../lib/mockStore';
import { useNotaryCalendar } from '../hooks/useNotaryCalendar';
import { useTaskChecklist } from '../hooks/useTaskChecklist';
import { useDocumentReview } from '../hooks/useDocumentReview';
import { useOrderWorkflow } from '../hooks/useOrderWorkflow';
import { Order, Task, ChecklistItem, DocumentItem, DocumentComment, Appointment, User as UserType, Announcement } from '../data/schemaData';

interface BusinessDashboardProps {
  activeUser: UserType;
  activeTenant: { id: string; company_name: string };
  onSwitchUser?: (userId: string) => void;
}

// Indonesian relative time helper
function getRelativeTimeString(dateInput: string | Date): string {
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 5) {
    return 'baru saja';
  }

  const intervals = [
    { label: 'tahun', seconds: 31536000 },
    { label: 'bulan', seconds: 2592000 },
    { label: 'hari', seconds: 86400 },
    { label: 'jam', seconds: 3600 },
    { label: 'menit', seconds: 60 },
    { label: 'detik', seconds: 1 },
  ];

  for (const interval of intervals) {
    const count = Math.floor(diffInSeconds / interval.seconds);
    if (count >= 1) {
      return `${count} ${interval.label} yang lalu`;
    }
  }

  return 'baru saja';
}

export default function BusinessDashboard({ activeUser, activeTenant, onSwitchUser }: BusinessDashboardProps) {
  // --- REAL-TIME CLOCK STATE ---
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const timeString = useMemo(() => {
    return currentTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }, [currentTime]);

  const dateString = useMemo(() => {
    return currentTime.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  }, [currentTime]);

  // Dynamic Indonesian Greeting based on Hour
  const greeting = useMemo(() => {
    const hours = currentTime.getHours();
    if (hours >= 4 && hours < 11) return 'Selamat Pagi';
    if (hours >= 11 && hours < 15) return 'Selamat Siang';
    if (hours >= 15 && hours < 19) return 'Selamat Sore';
    return 'Selamat Malam';
  }, [currentTime]);

  // --- REACTIVE STORE STATE ---
  const [storeTick, setStoreTick] = useState(0);
  useEffect(() => {
    const unsubscribe = mockDb.subscribe(() => {
      setStoreTick((prev) => prev + 1);
    });
    return () => unsubscribe();
  }, []);

  // Filtered store values for the active tenant
  const tenantUsers = useMemo(() => {
    return mockDb.users.filter((u) => u.tenant_id === activeTenant.id);
  }, [activeTenant.id, storeTick]);

  const tenantOrders = useMemo(() => {
    return mockDb.orders.filter((o) => o.tenant_id === activeTenant.id);
  }, [activeTenant.id, storeTick]);

  const tenantTasks = useMemo(() => {
    return mockDb.tasks.filter((t) => t.tenant_id === activeTenant.id);
  }, [activeTenant.id, storeTick]);

  const tenantAnnouncements = useMemo(() => {
    return mockDb.announcements.filter((a) => {
      const isCorrectTenant = a.tenant_id === activeTenant.id;
      const isRoleEligible =
        a.target_role === 'ALL' || a.target_role === activeUser.role || activeUser.role === 'NOTARIS';
      return isCorrectTenant && isRoleEligible;
    });
  }, [activeTenant.id, activeUser.role, storeTick]);

  const tenantAuditLogs = useMemo(() => {
    return mockDb.auditLogs.filter((l) => l.tenant_id === activeTenant.id);
  }, [activeTenant.id, storeTick]);

  // Get Primary Notary for the active tenant (used to hook calendar appointments)
  const primaryNotary = useMemo(() => {
    return tenantUsers.find((u) => u.role === 'NOTARIS') || tenantUsers[0];
  }, [tenantUsers]);

  // --- CALENDAR APPOINTMENTS HOOK ---
  const notaryIdForCalendar = activeUser.role === 'NOTARIS' ? activeUser.id : primaryNotary?.id;
  const {
    data: appointments,
    loading: loadingCalendar,
    proposeAppointment,
    approveAppointment,
    rejectAppointment,
    rescheduleAppointment
  } = useNotaryCalendar(notaryIdForCalendar || '');

  // --- RESCHEDULING STATES ---
  const [reschedulingAppt, setReschedulingAppt] = useState<Appointment | null>(null);
  const [reschedDate, setReschedDate] = useState<string>('2026-07-15');
  const [reschedTime, setReschedTime] = useState<string>('10:00');

  // --- TASKS SELECTION STATE (For interactive Detail Modal) ---
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);

  const handleOpenTaskDetails = (task: Task) => {
    setSelectedTask(task);
    setIsTaskModalOpen(true);
  };

  const handleCloseTaskDetails = () => {
    setSelectedTask(null);
    setIsTaskModalOpen(false);
  };

  // --- ANNOUNCEMENT CREATION MODAL STATE ---
  const [isAnnouncementModalOpen, setIsAnnouncementModalOpen] = useState(false);
  const [newAnnTitle, setNewAnnTitle] = useState('');
  const [newAnnContent, setNewAnnContent] = useState('');
  const [newAnnTarget, setNewAnnTarget] = useState<'ALL' | 'FINANCE' | 'STAFF'>('ALL');
  const [postingAnnouncement, setPostingAnnouncement] = useState(false);

  const handleCreateAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAnnTitle.trim() || !newAnnContent.trim()) return;

    setPostingAnnouncement(true);
    try {
      await mockDb.addAnnouncement(
        activeTenant.id,
        activeUser.id,
        activeUser.name,
        newAnnTitle,
        newAnnContent,
        newAnnTarget
      );
      setNewAnnTitle('');
      setNewAnnContent('');
      setNewAnnTarget('ALL');
      setIsAnnouncementModalOpen(false);
    } catch (err) {
      console.error(err);
    } finally {
      setPostingAnnouncement(false);
    }
  };

  // --- ANNOUNCEMENT EDIT & DELETE CRUD STATE & HANDLERS ---
  const [editingAnnouncement, setEditingAnnouncement] = useState<Announcement | null>(null);
  const [editAnnTitle, setEditAnnTitle] = useState('');
  const [editAnnContent, setEditAnnContent] = useState('');
  const [editAnnTarget, setEditAnnTarget] = useState<'ALL' | 'FINANCE' | 'STAFF'>('ALL');
  const [updatingAnnouncement, setUpdatingAnnouncement] = useState(false);

  const handleUpdateAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAnnouncement || !editAnnTitle.trim() || !editAnnContent.trim()) return;

    setUpdatingAnnouncement(true);
    try {
      await mockDb.updateAnnouncement(
        activeTenant.id,
        editingAnnouncement.id,
        editAnnTitle,
        editAnnContent,
        editAnnTarget,
        activeUser.name
      );
      setEditingAnnouncement(null);
    } catch (err) {
      console.error(err);
    } finally {
      setUpdatingAnnouncement(false);
    }
  };

  const handleDeleteAnnouncement = async (annId: string) => {
    try {
      await mockDb.deleteAnnouncement(activeTenant.id, annId, activeUser.name);
    } catch (err) {
      console.error(err);
    }
  };

  // --- CALENDAR DATE SELECTION ---
  const [selectedDate, setSelectedDate] = useState<number>(15); // Default to July 15, 2026
  const [isSchedulingOpen, setIsSchedulingOpen] = useState(false);
  const [schedOrderId, setSchedOrderId] = useState('');
  const [schedHour, setSchedHour] = useState('10:00');
  const [scheduling, setScheduling] = useState(false);

  // Hardcode July 2026 (starting on Wednesday, 3 days offset, 31 days)
  const julyDays = Array.from({ length: 31 }, (_, i) => i + 1);
  const calendarOffset = 3; // Wednesday offset

  const appointmentsOnSelectedDate = useMemo(() => {
    return appointments.filter((appt) => {
      const d = new Date(appt.date_time);
      return d.getFullYear() === 2026 && d.getMonth() === 6 && d.getDate() === selectedDate;
    });
  }, [appointments, selectedDate]);

  const handleScheduleAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!schedOrderId) return;
    setScheduling(true);
    try {
      // Date structure: 2026-07-XXT[schedHour]:00Z
      const formattedDateStr = `${selectedDate < 10 ? '0' : ''}${selectedDate}`;
      const isoDateTime = `2026-07-${formattedDateStr}T${schedHour}:00Z`;

      await proposeAppointment(activeTenant.id, schedOrderId, isoDateTime);
      await mockDb.addAuditLog(
        activeTenant.id,
        activeUser.name,
        'PROPOSE_APPOINTMENT',
        `Mengajukan jadwal tanda tangan akta baru untuk tanggal 2026-07-${formattedDateStr} pukul ${schedHour}`
      );
      setIsSchedulingOpen(false);
      setSchedOrderId('');
    } catch (err) {
      console.error(err);
    } finally {
      setScheduling(false);
    }
  };

  return (
    <div className="space-y-6" id="business-dashboard-container">
      
      {/* 1. DYNAMIC HEADER COMPONENT */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 shadow-md relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-600/5 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
        
        <div className="flex items-center gap-4 relative z-10">
          <div className="w-12 h-12 rounded-xl bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
            <User className="w-6 h-6" />
          </div>
          <div>
            {activeUser.role === 'NOTARIS' ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-500 border border-rose-500/20 font-mono tracking-wide uppercase shadow-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                Notaris Utama
              </span>
            ) : activeUser.role === 'FINANCE' ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 font-mono tracking-wide uppercase shadow-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Finance Manager
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-500 border border-blue-500/20 font-mono tracking-wide uppercase shadow-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                Staff Operasional
              </span>
            )}
            <h1 className="text-xl font-bold text-slate-100 mt-0.5 tracking-tight">
              {greeting}, {activeUser.name}
            </h1>
            <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-pulse" />
              Sistem Terisolasi • {activeTenant.company_name}
            </p>
          </div>
        </div>

        {/* Real-time Clock widget */}
        <div className="flex items-center gap-4 bg-slate-950/60 border border-slate-800 p-3.5 rounded-xl font-mono text-right relative z-10 self-start lg:self-auto">
          <Clock className="w-5 h-5 text-indigo-400 shrink-0" />
          <div>
            <span className="text-lg font-bold text-slate-100 block tracking-wider leading-none">
              {timeString}
            </span>
            <span className="text-[10px] text-slate-400 mt-1 block tracking-tight font-sans">
              {dateString}
            </span>
          </div>
        </div>
      </div>

      {/* 2. ANNOUNCEMENT BAR */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950/20 to-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
          <div className="flex items-center gap-2">
            <Megaphone className="w-4 h-4 text-indigo-400" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-200">
              Pengumuman Kantor Internal
            </h2>
          </div>
          
          {activeUser.role === 'NOTARIS' && (
            <button
              onClick={() => setIsAnnouncementModalOpen(true)}
              className="flex items-center gap-1.5 px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-[11px] font-semibold transition-all shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" /> Buat Pengumuman
            </button>
          )}
        </div>

        {tenantAnnouncements.length === 0 ? (
          <p className="text-xs text-slate-500 py-3 text-center italic">Tidak ada pengumuman terbaru saat ini.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {tenantAnnouncements.map((ann) => (
              <div key={ann.id} className="bg-slate-950/60 hover:bg-slate-950 border border-slate-800/80 p-4 rounded-lg space-y-2 transition-all flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="text-xs font-bold text-slate-200 truncate pr-2">{ann.title}</span>
                    <span className="text-[8px] bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-mono px-1.5 py-0.5 rounded uppercase font-extrabold shrink-0">
                      {ann.target_role}
                    </span>
                  </div>
                  <p className="text-slate-400 text-xs leading-relaxed line-clamp-3">{ann.content}</p>
                </div>
                <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono pt-2 border-t border-slate-900 mt-2">
                  <span>Dari: {ann.created_by_name.split(',')[0]}</span>
                  <div className="flex items-center gap-1.5">
                    <span>{new Date(ann.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}</span>
                    {activeUser.role === 'NOTARIS' && (
                      <div className="flex items-center gap-1.5 ml-1.5 border-l border-slate-800 pl-1.5 shrink-0">
                        <button
                          onClick={() => {
                            setEditingAnnouncement(ann);
                            setEditAnnTitle(ann.title);
                            setEditAnnContent(ann.content);
                            setEditAnnTarget(ann.target_role);
                          }}
                          className="p-1 text-slate-400 hover:text-indigo-400 hover:bg-slate-900 rounded transition-all cursor-pointer"
                          title="Ubah Pengumuman"
                        >
                          <Edit className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => handleDeleteAnnouncement(ann.id)}
                          className="p-1 text-slate-400 hover:text-rose-400 hover:bg-slate-900 rounded transition-all cursor-pointer"
                          title="Hapus Pengumuman"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 3. CORE GRID: CALENDAR ON LEFT, TASKS IN MIDDLE, LOGS ON RIGHT */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* A. CALENDAR WIDGET & SIGNINGS (4 cols) */}
        <div className="lg:col-span-4 bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col space-y-4 shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
            <div className="flex items-center gap-2">
              <CalendarIcon className="w-4 h-4 text-indigo-400" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                Kalender Tanda Tangan
              </h2>
            </div>
            <span className="text-[10px] text-indigo-400 font-mono font-semibold">Juli 2026</span>
          </div>

          {/* Month Grid Header */}
          <div className="grid grid-cols-7 gap-1 text-center font-mono text-[9px] text-slate-500 font-bold border-b border-slate-800/50 pb-1.5">
            <span>Min</span><span>Sen</span><span>Sel</span><span>Rab</span><span>Kam</span><span>Jum</span><span>Sab</span>
          </div>

          {/* Month Days */}
          <div className="grid grid-cols-7 gap-1">
            {/* Empty days offset */}
            {Array.from({ length: calendarOffset }).map((_, i) => (
              <div key={`offset-${i}`} className="h-8" />
            ))}

            {julyDays.map((day) => {
              const hasAppt = appointments.some((appt) => {
                const d = new Date(appt.date_time);
                return d.getDate() === day && d.getMonth() === 6 && d.getFullYear() === 2026;
              });

              const isSelected = selectedDate === day;

              return (
                <button
                  key={`day-${day}`}
                  onClick={() => setSelectedDate(day)}
                  className={`h-8 rounded-lg text-xs font-mono font-medium relative flex flex-col items-center justify-center transition-all ${
                    isSelected
                      ? 'bg-indigo-600 text-white shadow-md font-bold'
                      : 'bg-slate-950/40 text-slate-300 hover:bg-slate-800 hover:text-slate-100'
                  }`}
                >
                  {day}
                  {hasAppt && (
                    <span className={`absolute bottom-1 w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white' : 'bg-amber-400'}`} />
                  )}
                </button>
              );
            })}
          </div>

          {/* Selected Date Appointments list */}
          <div className="border-t border-slate-800 pt-3 flex-1 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-xs font-semibold text-slate-300 mb-2">
                <span>Jadwal: {selectedDate} Juli 2026</span>
                <span className="text-[10px] font-mono text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                  {appointmentsOnSelectedDate.length} Janji Temu
                </span>
              </div>

              {appointmentsOnSelectedDate.length === 0 ? (
                <div className="text-center py-4 bg-slate-950/40 rounded-lg border border-slate-800/50">
                  <p className="text-[11px] text-slate-500 font-sans">Tidak ada jadwal tanda tangan hari ini.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {appointmentsOnSelectedDate.map((appt) => (
                    <div key={appt.id} className="bg-slate-950 border border-slate-800 p-2.5 rounded-lg text-xs space-y-1.5">
                      <div className="flex items-start justify-between">
                        <span className="font-bold text-slate-200 leading-tight block truncate max-w-[140px]">
                          {appt.order_title}
                        </span>
                        <span className={`text-[9px] font-bold font-mono px-1.5 py-0.2 rounded border ${
                          appt.status === 'APPROVED'
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            : appt.status === 'REJECTED'
                            ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                            : appt.status === 'RESCHEDULED'
                            ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
                            : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                        }`}>
                          {appt.status}
                        </span>
                      </div>
                      
                      <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                        <span>Pukul: {new Date(appt.date_time).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</span>
                        <span>Oleh: {appt.notary_name.split(',')[0]}</span>
                      </div>

                      {/* Notaris approval actions */}
                      {activeUser.role === 'NOTARIS' && appt.status === 'PROPOSED' && (
                        <div className="flex items-center gap-1.5 pt-1.5 border-t border-slate-900">
                          <button
                            onClick={async () => {
                              await approveAppointment(appt.id);
                              await mockDb.addAuditLog(
                                activeTenant.id,
                                activeUser.name,
                                'APPROVE_APPOINTMENT',
                                `Menyetujui jadwal tanda tangan akta untuk "${appt.order_title}" tanggal 2026-07-${selectedDate}`
                              );
                            }}
                            className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-0.5 rounded text-[10px] transition-all"
                          >
                            Setujui
                          </button>
                          <button
                            onClick={() => {
                              const dateObj = new Date(appt.date_time);
                              const yr = dateObj.getFullYear() || 2026;
                              const mo = String(dateObj.getMonth() + 1).padStart(2, '0') || '07';
                              const dy = String(dateObj.getDate()).padStart(2, '0') || String(selectedDate).padStart(2, '0');
                              const hours = String(dateObj.getHours()).padStart(2, '0');
                              const minutes = String(dateObj.getMinutes()).padStart(2, '0');
                              setReschedDate(`${yr}-${mo}-${dy}`);
                              setReschedTime(`${hours}:${minutes}`);
                              setReschedulingAppt(appt);
                            }}
                            className="flex-1 bg-rose-600 hover:bg-rose-500 text-white font-semibold py-0.5 rounded text-[10px] transition-all"
                          >
                            Tolak
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Propose Appointment Trigger */}
            <div className="pt-3">
              {isSchedulingOpen ? (
                <form onSubmit={handleScheduleAppointment} className="bg-slate-950 border border-slate-800 p-3 rounded-lg space-y-2.5">
                  <div className="flex justify-between items-center pb-1 border-b border-slate-900">
                    <span className="text-[10px] font-bold text-indigo-400 font-mono uppercase">Ajukan Jadwal Baru</span>
                    <button type="button" onClick={() => setIsSchedulingOpen(false)}>
                      <X className="w-3.5 h-3.5 text-slate-500 hover:text-slate-300" />
                    </button>
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 uppercase block mb-1">Pilih Berkas Akta</label>
                    <select
                      value={schedOrderId}
                      onChange={(e) => setSchedOrderId(e.target.value)}
                      required
                      className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-slate-300"
                    >
                      <option value="">-- Pilih Berkas --</option>
                      {tenantOrders.map((order) => (
                        <option key={order.id} value={order.id}>
                          {order.title}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 uppercase block mb-1">Waktu</label>
                    <input
                      type="time"
                      value={schedHour}
                      onChange={(e) => setSchedHour(e.target.value)}
                      required
                      className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-slate-300 font-mono"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={scheduling}
                    className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-1 rounded text-xs transition-all flex items-center justify-center gap-1"
                  >
                    {scheduling ? 'Mengajukan...' : 'Simpan Pengajuan'}
                  </button>
                </form>
              ) : (
                <button
                  onClick={() => setIsSchedulingOpen(true)}
                  className="w-full mt-3 flex items-center justify-center gap-1.5 border border-dashed border-indigo-500/30 hover:border-indigo-500 text-indigo-400 py-2 rounded-lg text-xs font-semibold hover:bg-indigo-500/5 transition-all"
                >
                  <Plus className="w-4 h-4" /> Ajukan Jadwal {selectedDate} Juli
                </button>
              )}
            </div>
          </div>
        </div>

        {/* B. TASK SUMMARY (5 cols) */}
        <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col space-y-4 shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-indigo-400" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                Papan Tugas Aktif
              </h2>
            </div>
            
            <span className="text-[10px] font-mono font-bold bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded">
              {activeUser.role === 'NOTARIS' ? 'Global' : 'Personal'} View
            </span>
          </div>

          <p className="text-[11px] text-slate-400 leading-normal">
            {activeUser.role === 'NOTARIS'
              ? 'Daftar semua tugas pengerjaan berkas akta yang terdaftar pada tenant ini.'
              : 'Daftar tugas berkas akta yang didelegasikan khusus kepada Anda.'}
          </p>

          <div className="space-y-3 flex-1 overflow-y-auto max-h-[440px]">
            {tenantTasks
              .filter((task) => {
                if (activeUser.role === 'NOTARIS') return true;
                // If karyawan/staff, strictly show only tasks assigned to them
                return (
                  task.assigned_to_user_name.toLowerCase().includes(activeUser.name.toLowerCase()) ||
                  (task as any).assigned_to_user_id === activeUser.id
                );
              })
              .map((task) => {
                return (
                  <div
                    key={task.id}
                    onClick={() => handleOpenTaskDetails(task)}
                    className="bg-slate-950 border border-slate-800 hover:border-indigo-500 p-3.5 rounded-lg cursor-pointer transition-all space-y-2 group"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-xs font-bold text-slate-200 group-hover:text-indigo-400 transition-colors">
                        {task.title}
                      </span>
                      <span className={`text-[9px] font-bold font-mono px-1.5 py-0.2 rounded shrink-0 border ${
                        task.status === 'DONE'
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                          : task.status === 'ON_PROGRESS'
                          ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
                          : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                      }`}>
                        {task.status}
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-400 line-clamp-2">{task.description}</p>

                    <div className="flex items-center justify-between text-[10px] text-slate-500 border-t border-slate-900 pt-2 font-mono">
                      <div className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                        <span>PIC: {task.assigned_to_user_name || 'Belum Ditunjuk'}</span>
                      </div>
                      <span className="flex items-center gap-0.5 text-indigo-400 font-sans group-hover:translate-x-1 transition-transform">
                        Kelola <ChevronRight className="w-3.5 h-3.5" />
                      </span>
                    </div>
                  </div>
                );
              })}
            
            {tenantTasks.filter((task) => activeUser.role === 'NOTARIS' || task.assigned_to_user_name === activeUser.name).length === 0 && (
              <div className="text-center py-10 text-xs text-slate-500">
                Tidak ada tugas aktif pengerjaan akta untuk peran Anda saat ini.
              </div>
            )}
          </div>
        </div>

        {/* C. LIVE UPDATE FEED (Khusus Role NOTARIS) (3 cols) */}
        <div className="lg:col-span-3 bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col space-y-4 shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-500 animate-pulse" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                Live Update Feed
              </h2>
            </div>
            <span className="text-[9px] bg-emerald-500/10 text-emerald-400 font-mono px-1.5 rounded-full font-bold">
              Notaris Only
            </span>
          </div>

          {activeUser.role !== 'NOTARIS' ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-4 bg-slate-950/40 rounded-xl border border-slate-800/60">
              <XCircle className="w-8 h-8 text-slate-600 mb-2" />
              <p className="text-[11px] text-slate-500">
                Hak Akses Terbatas. Live Activity Feed log aktivitas audit hanya tersedia untuk peran Notaris Utama guna kepatuhan keamanan data.
              </p>
            </div>
          ) : (
            <div className="flex-1 flex flex-col space-y-3.5 overflow-y-auto max-h-[460px]">
              {tenantAuditLogs.map((log) => (
                <div key={log.id} className="text-xs space-y-1 relative pl-4 border-l border-indigo-500/20">
                  <div className="absolute top-1 left-0 -ml-1 w-2 h-2 rounded-full bg-indigo-500" />
                  <div className="flex items-start justify-between text-[10px] text-slate-500 font-mono">
                    <span className="font-bold text-slate-400">{log.user_name}</span>
                    <span>{getRelativeTimeString(log.created_at)}</span>
                  </div>
                  <p className="text-slate-300 font-sans text-[11px] leading-relaxed">{log.description}</p>
                  <span className="text-[9px] text-indigo-400/80 font-mono bg-indigo-500/5 px-1 rounded uppercase">
                    {log.action}
                  </span>
                </div>
              ))}
              
              {tenantAuditLogs.length === 0 && (
                <p className="text-xs text-slate-500 py-10 text-center italic">Belum ada log aktivitas hari ini.</p>
              )}
            </div>
          )}
        </div>

      </div>

      {/* --- TASK DETAILS SLIDE-OVER / MODAL --- */}
      <AnimatePresence>
        {isTaskModalOpen && selectedTask && (
          <TaskDetailContainer
            task={selectedTask}
            activeUser={activeUser}
            activeTenant={activeTenant}
            tenantUsers={tenantUsers}
            onClose={handleCloseTaskDetails}
          />
        )}
      </AnimatePresence>

      {/* --- CREATE ANNOUNCEMENT MODAL --- */}
      <AnimatePresence>
        {isAnnouncementModalOpen && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-xl p-5 space-y-4 shadow-2xl"
            >
              <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <Megaphone className="w-5 h-5 text-indigo-400" />
                  <h3 className="font-bold text-slate-100 text-sm">Buat Pengumuman Internal</h3>
                </div>
                <button onClick={() => setIsAnnouncementModalOpen(false)}>
                  <X className="w-5 h-5 text-slate-400 hover:text-slate-200" />
                </button>
              </div>

              <form onSubmit={handleCreateAnnouncement} className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-slate-400 uppercase tracking-wide block mb-1.5">
                    Judul Pengumuman
                  </label>
                  <input
                    type="text"
                    required
                    value={newAnnTitle}
                    onChange={(e) => setNewAnnTitle(e.target.value)}
                    placeholder="Contoh: Percepatan Berkas AJB"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-400 uppercase tracking-wide block mb-1.5">
                    Isi Pengumuman
                  </label>
                  <textarea
                    required
                    rows={4}
                    value={newAnnContent}
                    onChange={(e) => setNewAnnContent(e.target.value)}
                    placeholder="Tulis pengumuman di sini..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-400 uppercase tracking-wide block mb-1.5">
                    Target Otoritas
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['ALL', 'FINANCE', 'STAFF'] as const).map((role) => (
                      <button
                        type="button"
                        key={role}
                        onClick={() => setNewAnnTarget(role)}
                        className={`py-1.5 rounded-lg text-xs font-bold border transition-all ${
                          newAnnTarget === role
                            ? 'bg-indigo-600 text-white border-indigo-500 shadow-md'
                            : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        {role}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pt-2 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setIsAnnouncementModalOpen(false)}
                    className="flex-1 bg-slate-950 hover:bg-slate-900 text-slate-400 border border-slate-800 rounded-lg py-2 text-xs font-bold transition-all"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={postingAnnouncement}
                    className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg py-2 text-xs font-bold transition-all flex items-center justify-center gap-1"
                  >
                    {postingAnnouncement ? 'Menyimpan...' : 'Kirim'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- EDIT ANNOUNCEMENT MODAL --- */}
      <AnimatePresence>
        {editingAnnouncement && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-xl p-5 space-y-4 shadow-2xl relative"
            >
              <button
                onClick={() => setEditingAnnouncement(null)}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-2">
                <Megaphone className="w-5 h-5 text-indigo-400" />
                <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider font-sans">
                  Edit Pengumuman Kantor
                </h3>
              </div>
              <p className="text-[11px] text-slate-400">
                Perbarui pengumuman untuk seluruh staff dan karyawan kantor secara dinamis.
              </p>

              <form onSubmit={handleUpdateAnnouncement} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-400 uppercase tracking-wide block mb-1.5">
                    Judul Pengumuman
                  </label>
                  <input
                    type="text"
                    required
                    value={editAnnTitle}
                    onChange={(e) => setEditAnnTitle(e.target.value)}
                    placeholder="Contoh: Rapat Koordinasi Bulanan..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-400 uppercase tracking-wide block mb-1.5">
                    Isi Pengumuman
                  </label>
                  <textarea
                    required
                    rows={4}
                    value={editAnnContent}
                    onChange={(e) => setEditAnnContent(e.target.value)}
                    placeholder="Tulis pengumuman di sini..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-400 uppercase tracking-wide block mb-1.5">
                    Target Otoritas
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['ALL', 'FINANCE', 'STAFF'] as const).map((role) => (
                      <button
                        type="button"
                        key={role}
                        onClick={() => setEditAnnTarget(role)}
                        className={`py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                          editAnnTarget === role
                            ? 'bg-indigo-600 text-white border-indigo-500 shadow-md'
                            : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        {role}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pt-2 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setEditingAnnouncement(null)}
                    className="flex-1 bg-slate-950 hover:bg-slate-900 text-slate-400 border border-slate-800 rounded-lg py-2 text-xs font-bold transition-all cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={updatingAnnouncement}
                    className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg py-2 text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer"
                  >
                    {updatingAnnouncement ? 'Menyimpan...' : 'Perbarui'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- RESCHEDULE / COUNTER-PROPOSAL DIALOG --- */}
      <AnimatePresence>
        {reschedulingAppt && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-xl p-5 space-y-4 shadow-2xl"
            >
              <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <CalendarIcon className="w-5 h-5 text-indigo-400" />
                  <h3 className="font-bold text-slate-100 text-sm font-sans">Ajukan Jadwal Alternatif</h3>
                </div>
                <button onClick={() => setReschedulingAppt(null)}>
                  <X className="w-5 h-5 text-slate-400 hover:text-slate-200" />
                </button>
              </div>

              <div className="space-y-3">
                <p className="text-xs text-slate-300 leading-normal">
                  Anda sedang meninjau usulan jadwal penandatanganan berkas <strong>{reschedulingAppt.order_title}</strong>. Silakan tentukan tanggal & waktu alternatif baru, atau batalkan total.
                </p>
                <div className="p-3 bg-slate-950/40 rounded-lg border border-slate-800/60 text-xs text-slate-400 space-y-1">
                  <div><strong>Jadwal Sebelumnya:</strong></div>
                  <div>
                    {new Date(reschedulingAppt.date_time).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} pukul {new Date(reschedulingAppt.date_time).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>

              <form onSubmit={async (e) => {
                e.preventDefault();
                try {
                  const combinedDateTime = `${reschedDate}T${reschedTime}:00`;
                  await rescheduleAppointment(reschedulingAppt.id, combinedDateTime);
                  
                  // Add audit log
                  const formattedDate = new Date(combinedDateTime).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
                  const formattedTime = new Date(combinedDateTime).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
                  await mockDb.addAuditLog(
                    activeTenant.id,
                    activeUser.name,
                    'RESCHEDULE_APPOINTMENT',
                    `Notaris mengajukan jadwal alternatif baru untuk "${reschedulingAppt.order_title}" pada tanggal ${formattedDate} pukul ${formattedTime}`
                  );
                  
                  setReschedulingAppt(null);
                } catch (err) {
                  console.error('Error rescheduling appointment:', err);
                }
              }} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block mb-1.5 font-mono">
                      Tanggal Alternatif
                    </label>
                    <input
                      type="date"
                      required
                      value={reschedDate}
                      onChange={(e) => setReschedDate(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block mb-1.5 font-mono">
                      Jam Alternatif
                    </label>
                    <input
                      type="time"
                      required
                      value={reschedTime}
                      onChange={(e) => setReschedTime(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                    />
                  </div>
                </div>

                <div className="flex gap-2.5 pt-3 border-t border-slate-800/60">
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await rejectAppointment(reschedulingAppt.id);
                        await mockDb.addAuditLog(
                          activeTenant.id,
                          activeUser.name,
                          'REJECT_APPOINTMENT',
                          `Menolak secara permanen jadwal tanda tangan akta untuk "${reschedulingAppt.order_title}"`
                        );
                        setReschedulingAppt(null);
                      } catch (err) {
                        console.error('Error rejecting appointment:', err);
                      }
                    }}
                    className="flex-1 bg-rose-600 hover:bg-rose-500 text-white font-bold py-2 rounded-lg text-xs transition-all uppercase tracking-wide cursor-pointer text-center"
                  >
                    Tolak Permanen
                  </button>
                  <button
                    type="submit"
                    className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2 rounded-lg text-xs transition-all uppercase tracking-wide cursor-pointer text-center"
                  >
                    Kirim Jadwal Baru
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

// --- COMPLEX TASK DETAIL CONTAINER (Binds Checklist & DocumentReview Hooks) ---
interface TaskDetailContainerProps {
  task: Task;
  activeUser: UserType;
  activeTenant: { id: string; company_name: string };
  tenantUsers: UserType[];
  onClose: () => void;
}

function TaskDetailContainer({ task, activeUser, activeTenant, tenantUsers, onClose }: TaskDetailContainerProps) {
  // Hooks integrated from Task ID
  const { data: checklist, loading: loadingChecklist, toggleChecklistItem, addChecklistItem } = useTaskChecklist(task.id);
  const { data: docData, loading: loadingDocs, uploadDocument, updateDocumentStatus, addComment } = useDocumentReview(task.id);
  const { handoverTask } = useOrderWorkflow(task.order_id);

  // States
  const [newCheckItemName, setNewCheckItemName] = useState('');
  const [newCommentText, setNewCommentText] = useState<{ [docId: string]: string }>({});
  const [simulatedDocFile, setSimulatedDocFile] = useState<string>('');
  const [isHandoverOpen, setIsHandoverOpen] = useState(false);
  const [selectedStaffToHandover, setSelectedStaffToHandover] = useState('');

  const handleAddChecklist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCheckItemName.trim()) return;
    try {
      await addChecklistItem(newCheckItemName.trim(), activeTenant.id);
      await mockDb.addAuditLog(
        activeTenant.id,
        activeUser.name,
        'ADD_CHECKLIST',
        `Menambahkan sub-syarat checklist baru: "${newCheckItemName}" pada tugas "${task.title}"`
      );
      setNewCheckItemName('');
    } catch (err) {
      console.error(err);
    }
  };

  const handleSimulatedDocUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!simulatedDocFile.trim()) return;
    try {
      await uploadDocument(simulatedDocFile, activeTenant.id);
      await mockDb.addAuditLog(
        activeTenant.id,
        activeUser.name,
        'UPLOAD_DOCUMENT',
        `Mengunggah draf dokumen akta baru: "${simulatedDocFile.split('/').pop()}"`
      );
      setSimulatedDocFile('');
    } catch (err) {
      console.error(err);
    }
  };

  const handleHandover = async () => {
    if (!selectedStaffToHandover) return;
    const staff = tenantUsers.find((u) => u.id === selectedStaffToHandover);
    if (!staff) return;

    try {
      await handoverTask(task.id, staff.id, staff.name);
      await mockDb.addAuditLog(
        activeTenant.id,
        activeUser.name,
        'HANDOVER_TASK',
        `Menyerahkan pengerjaan tugas "${task.title}" kepada ${staff.name}`
      );
      setIsHandoverOpen(false);
      onClose(); // Close modal after handover
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-end z-50">
      <motion.div
        initial={{ x: '100%', opacity: 0.9 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: '100%', opacity: 0.9 }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="bg-slate-900 border-l border-slate-800 w-full max-w-2xl h-screen flex flex-col justify-between shadow-2xl overflow-y-auto"
      >
        {/* Header Block */}
        <div className="p-5 border-b border-slate-800 bg-slate-950 flex items-start justify-between sticky top-0 z-10">
          <div>
            <span className="text-[10px] font-mono font-bold bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded uppercase">
              Detail Alur Pekerjaan Berkas
            </span>
            <h3 className="text-base font-bold text-slate-100 mt-2 tracking-tight leading-tight">
              {task.title}
            </h3>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              {task.description}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Modules */}
        <div className="p-6 space-y-6 flex-1 overflow-y-auto">
          
          {/* Module 0: Task Status Controller */}
          <div className="bg-slate-950 border border-slate-800/80 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-indigo-400" />
                <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">Status Utama Pekerjaan</span>
              </div>
              <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded uppercase border ${
                task.status === 'DONE'
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                  : task.status === 'ON_PROGRESS'
                  ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
                  : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
              }`}>
                {task.status}
              </span>
            </div>

            {(() => {
              const isPIC = task.assigned_to_user_name === activeUser.name;
              const isNotaris = activeUser.role === 'NOTARIS';
              const canUpdateStatus = isPIC || isNotaris;

              return canUpdateStatus ? (
                <div className="space-y-2 pt-2 border-t border-slate-900">
                  <p className="text-[11px] text-slate-400">Pilih status untuk memperbarui progres berkas ini secara real-time:</p>
                  <div className="grid grid-cols-3 gap-2">
                    {(['TODO', 'ON_PROGRESS', 'DONE'] as const).map((st) => (
                      <button
                        type="button"
                        key={st}
                        onClick={async () => {
                          try {
                            await mockDb.updateTaskStatus(activeTenant.id, task.id, st, activeUser.name);
                            await mockDb.addAuditLog(
                              activeTenant.id,
                              activeUser.name,
                              'UPDATE_TASK_STATUS',
                              `Mengubah status tugas "${task.title}" menjadi ${st}`
                            );
                          } catch (err: any) {
                            alert(err.message || 'Gagal memperbarui status');
                          }
                        }}
                        className={`py-1.5 rounded-lg text-[10px] font-bold border transition-all cursor-pointer ${
                          task.status === st
                            ? 'bg-indigo-600 text-white border-indigo-500 shadow-md'
                            : 'bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-750'
                        }`}
                      >
                        {st === 'TODO' ? 'Belum Mulai' : st === 'ON_PROGRESS' ? 'Diproses' : 'Selesai'}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="pt-2 border-t border-slate-900 text-[11px] text-slate-500 flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-500/70 shrink-0" />
                  <span>Hanya PIC (<strong>{task.assigned_to_user_name || 'Belum Ditunjuk'}</strong>) atau Notaris yang dapat mengubah status tugas ini.</span>
                </div>
              );
            })()}
          </div>
          
          {/* Module 1: Task Assignment Handover */}
          <div className="bg-slate-950 border border-slate-800/80 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-indigo-400" />
                <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">Delegasi Tugas Pengerjaan</span>
              </div>
              <span className="text-xs text-slate-400 font-medium">PIC: {task.assigned_to_user_name || 'Belum Ditunjuk'}</span>
            </div>

            {isHandoverOpen ? (
              <div className="space-y-2.5 pt-2 border-t border-slate-900">
                <div className="flex gap-2">
                  <select
                    value={selectedStaffToHandover}
                    onChange={(e) => setSelectedStaffToHandover(e.target.value)}
                    className="flex-1 bg-slate-900 border border-slate-800 rounded px-3 py-1.5 text-xs text-slate-300"
                  >
                    <option value="">-- Pilih Anggota Staf --</option>
                    {tenantUsers.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.role})
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={handleHandover}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-all"
                  >
                    Serahkan
                  </button>
                  <button
                    onClick={() => setIsHandoverOpen(false)}
                    className="bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 text-xs px-2 rounded-lg"
                  >
                    Batal
                  </button>
                </div>
              </div>
            ) : (
              <div className="pt-2 border-t border-slate-900 flex justify-between items-center text-xs">
                <span className="text-slate-500">Apakah tugas ini perlu didelegasikan ke staf lain?</span>
                <button
                  onClick={() => setIsHandoverOpen(true)}
                  className="text-indigo-400 font-bold hover:underline"
                >
                  Ubah PIC Berkas
                </button>
              </div>
            )}
          </div>

          {/* Module 2: Checklist Sub-syarat Requirements (Hook integrated) */}
          <div className="space-y-3 bg-slate-950/40 border border-slate-800 p-5 rounded-xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="text-xs font-bold text-slate-200 uppercase tracking-wider block">
                Sub-Syarat Checklist Berkas ({checklist.length})
              </span>
              <span className="text-[10px] text-slate-500 font-mono">Real-time Check</span>
            </div>

            {loadingChecklist ? (
              <p className="text-xs text-slate-500 italic py-2">Memuat checklist...</p>
            ) : (
              <div className="space-y-2">
                {checklist.map((item) => (
                  <div
                    key={item.id}
                    onClick={async () => {
                      const nextCheckState = !item.is_checked;
                      await toggleChecklistItem(item.id, nextCheckState, activeUser.id, activeUser.name);
                      await mockDb.addAuditLog(
                        activeTenant.id,
                        activeUser.name,
                        'TOGGLE_CHECKLIST',
                        `${nextCheckState ? 'Menandai selesai' : 'Membatalkan tanda selesai'} syarat "${item.item_name}"`
                      );
                    }}
                    className="flex items-center justify-between p-2.5 bg-slate-950 hover:bg-slate-900/60 border border-slate-800/80 rounded-lg cursor-pointer transition-all group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="text-slate-400">
                        {item.is_checked ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        ) : (
                          <div className="w-4 h-4 rounded border border-slate-700 group-hover:border-indigo-500 transition-colors" />
                        )}
                      </div>
                      <span className={`text-xs font-medium ${item.is_checked ? 'text-slate-500 line-through' : 'text-slate-300'}`}>
                        {item.item_name}
                      </span>
                    </div>

                    {item.is_checked && item.checked_by_user_name && (
                      <span className="text-[9px] text-slate-500 font-mono bg-slate-900 px-1.5 py-0.5 rounded">
                        Oleh: {item.checked_by_user_name.split(',')[0]}
                      </span>
                    )}
                  </div>
                ))}

                {checklist.length === 0 && (
                  <p className="text-xs text-slate-500 py-2 italic text-center">Belum ada daftar sub-syarat akta ini.</p>
                )}
              </div>
            )}

            {/* Add Checklist Form */}
            <form onSubmit={handleAddChecklist} className="pt-2 border-t border-slate-800/60 flex gap-2">
              <input
                type="text"
                required
                value={newCheckItemName}
                onChange={(e) => setNewCheckItemName(e.target.value)}
                placeholder="Tambah sub-syarat dokumen..."
                className="flex-1 bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none"
              />
              <button
                type="submit"
                className="bg-indigo-600 hover:bg-indigo-500 text-white rounded px-3 py-1.5 text-xs font-bold transition-all"
              >
                Tambah
              </button>
            </form>
          </div>

          {/* Module 3: Document Upload & Review Process */}
          <div className="space-y-4 bg-slate-950/40 border border-slate-800 p-5 rounded-xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="text-xs font-bold text-slate-200 uppercase tracking-wider block">
                Draf Salinan Akta & Tinjauan Notaris
              </span>
              <span className="text-[10px] text-slate-500 font-mono">Notaris SaaS Storage System</span>
            </div>

            {loadingDocs ? (
              <p className="text-xs text-slate-500 italic py-2">Memuat berkas draf...</p>
            ) : (
              <div className="space-y-4">
                {docData.documents.map((doc) => {
                  const commentsOnThisDoc = docData.comments.filter((c) => c.document_id === doc.id);

                  return (
                    <div key={doc.id} className="bg-slate-950 border border-slate-800 p-4 rounded-xl space-y-3">
                      <div className="flex items-start justify-between gap-2 pb-2 border-b border-slate-900">
                        <div className="flex items-center gap-2">
                          <FileText className="w-5 h-5 text-indigo-400 shrink-0" />
                          <div>
                            <a
                              href={doc.file_url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs font-bold text-slate-300 hover:text-indigo-400 hover:underline block truncate max-w-[200px]"
                            >
                              {doc.file_url.split('/').pop()}
                            </a>
                            <span className="text-[9px] text-slate-500 font-mono">
                              Diupload: {new Date(doc.created_at).toLocaleDateString('id-ID')}
                            </span>
                          </div>
                        </div>

                        <span className={`text-[9px] font-bold font-mono px-1.5 py-0.5 rounded border uppercase ${
                          doc.status === 'APPROVED'
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            : doc.status === 'NEED_REVIEW'
                            ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                            : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
                        }`}>
                          {doc.status}
                        </span>
                      </div>

                      {/* Notaris approval buttons */}
                      {activeUser.role === 'NOTARIS' && doc.status === 'NEED_REVIEW' && (
                        <div className="bg-indigo-600/5 border border-indigo-500/15 p-2.5 rounded-lg flex items-center justify-between text-xs">
                          <span className="text-slate-300">Tinjau Dokumen ini:</span>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={async () => {
                                await updateDocumentStatus(doc.id, 'APPROVED');
                                await mockDb.addAuditLog(
                                  activeTenant.id,
                                  activeUser.name,
                                  'APPROVE_DOCUMENT',
                                  `Menyetujui draf dokumen: ${doc.file_url.split('/').pop()}`
                                );
                              }}
                              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-1 px-3 rounded text-[10px] transition-all"
                            >
                              Setujui
                            </button>
                            <button
                              onClick={async () => {
                                await updateDocumentStatus(doc.id, 'DRAFT');
                                await mockDb.addAuditLog(
                                  activeTenant.id,
                                  activeUser.name,
                                  'REQUEST_REVISION',
                                  `Meminta revisi pengerjaan draf dokumen: ${doc.file_url.split('/').pop()}`
                                );
                              }}
                              className="bg-rose-600 hover:bg-rose-500 text-white font-bold py-1 px-3 rounded text-[10px] transition-all"
                            >
                              Tolak / Minta Revisi
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Document Comments feed */}
                      <div className="space-y-2">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block">
                          Diskusikan Komentar Revisi ({commentsOnThisDoc.length})
                        </span>

                        <div className="space-y-2 bg-slate-900/60 p-2.5 rounded-lg max-h-[140px] overflow-y-auto">
                          {commentsOnThisDoc.map((com) => (
                            <div key={com.id} className="text-[11px] space-y-0.5 border-b border-slate-950 pb-1.5 last:border-b-0 last:pb-0">
                              <div className="flex items-center justify-between text-[10px] text-slate-400">
                                <span className="font-bold text-indigo-400">{com.user_name}</span>
                                <span className="font-mono text-slate-500">{new Date(com.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</span>
                              </div>
                              <p className="text-slate-300 font-sans">{com.comment}</p>
                            </div>
                          ))}

                          {commentsOnThisDoc.length === 0 && (
                            <p className="text-[10px] text-slate-500 italic py-1 text-center">Belum ada diskusi revisi untuk draf ini.</p>
                          )}
                        </div>

                        {/* Add Comment form */}
                        <div className="flex gap-1.5 pt-1">
                          <input
                            type="text"
                            required
                            placeholder="Tulis pesan revisi..."
                            value={newCommentText[doc.id] || ''}
                            onChange={(e) => {
                              const txt = e.target.value;
                              setNewCommentText((prev) => ({ ...prev, [doc.id]: txt }));
                            }}
                            className="flex-1 bg-slate-900 border border-slate-800 rounded px-2 py-1 text-[11px] text-slate-200 focus:outline-none"
                          />
                          <button
                            onClick={async () => {
                              const text = newCommentText[doc.id];
                              if (!text || !text.trim()) return;
                              await addComment(doc.id, text.trim(), activeTenant.id, activeUser.id, activeUser.name);
                              await mockDb.addAuditLog(
                                activeTenant.id,
                                activeUser.name,
                                'ADD_COMMENT',
                                `Mengirimkan komentar revisi pada draf: "${text.substring(0, 30)}..."`
                              );
                              setNewCommentText((prev) => ({ ...prev, [doc.id]: '' }));
                            }}
                            className="bg-indigo-600 hover:bg-indigo-500 text-white rounded p-1.5 transition-all flex items-center justify-center shrink-0"
                          >
                            <Send className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {docData.documents.length === 0 && (
                  <p className="text-xs text-slate-500 py-3 italic text-center">Belum ada draf dokumen akta yang diunggah.</p>
                )}
              </div>
            )}

            {/* Upload form simulation */}
            <form onSubmit={handleSimulatedDocUpload} className="pt-3 border-t border-slate-800/60 space-y-2">
              <label className="text-[10px] text-slate-500 uppercase font-mono block">Unggah Berkas Baru</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  required
                  value={simulatedDocFile}
                  onChange={(e) => setSimulatedDocFile(e.target.value)}
                  placeholder="Contoh: https://storage.supabase.co/PT-Maju-Bersama-AD-v2.pdf"
                  className="flex-1 bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none"
                />
                <button
                  type="submit"
                  className="bg-indigo-600 hover:bg-indigo-500 text-white rounded px-3 py-1.5 text-xs font-bold transition-all flex items-center gap-1 shrink-0"
                >
                  <UploadCloud className="w-4 h-4" /> Unggah
                </button>
              </div>
            </form>
          </div>

        </div>

        {/* Footer Block */}
        <div className="p-4 border-t border-slate-800 bg-slate-950 flex items-center justify-between text-[11px] text-slate-500 font-mono">
          <span>Tenant ID: {task.tenant_id.substring(0, 8)}...</span>
          <span>Notaris SaaS Engine v2.4</span>
        </div>
      </motion.div>
    </div>
  );
}
