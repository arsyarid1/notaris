import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Database,
  Terminal,
  ShieldCheck,
  BookOpen,
  UserCheck,
  Building2,
  Users,
  Briefcase,
  FileCheck,
  DollarSign,
  TrendingUp,
  Activity,
  Server,
  Key,
  Shield,
  Clock,
  ExternalLink,
  ChevronRight,
  ListTodo,
  AlertCircle,
  Bell,
  Settings,
  LayoutDashboard,
  UserPlus,
  Layers,
  LogOut,
  Menu,
  X
} from 'lucide-react';
import BusinessDashboard from './components/BusinessDashboard';
import LoginPage from './components/LoginPage';
import {
  MOCK_TENANTS,
  MOCK_USERS,
  MOCK_CLIENTS,
  MOCK_ORDERS,
  MOCK_TASKS,
  MOCK_INVOICES,
  MOCK_ANNOUNCEMENTS,
  User,
  Tenant
} from './data/schemaData';
import SqlViewer from './components/SqlViewer';
import ErdVisualizer from './components/ErdVisualizer';
import RlsSimulator from './components/RlsSimulator';
import SchemaDocumentation from './components/SchemaDocumentation';
import ClientManagement from './components/ClientManagement';
import InvoiceManagement from './components/InvoiceManagement';
import EmployeeManagement from './components/EmployeeManagement';
import OrderManagement from './components/OrderManagement';
import TaskManagement from './components/TaskManagement';
import TemplateManagement from './components/TemplateManagement';
import OfficeSettings from './components/OfficeSettings';
import { mockDb } from './lib/mockStore';
import { supabase } from './lib/supabase';
import { useAuth } from './context/AuthContext.tsx';

export default function App() {
  const { user, loading, signOut, setUser } = useAuth();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'orders' | 'tasks' | 'templates' | 'clients' | 'invoices' | 'employees' | 'settings' | 'sql' | 'erd' | 'simulator' | 'docs'>('dashboard');
  const [isLightMode, setIsLightMode] = useState(true); // Defaults to Light Mode!
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [storeTick, setStoreTick] = useState(0);
  const [simulatedUserId, setSimulatedUserId] = useState<string>('b0000000-0000-0000-0000-000000000001');

  // Subscribe to reactive database changes
  useEffect(() => {
    const unsubscribe = mockDb.subscribe(() => {
      setStoreTick(prev => prev + 1);
    });
    return () => unsubscribe();
  }, []);

  // Fetch and sync all data from Supabase on start
  useEffect(() => {
    mockDb.fetchAndSyncAll();
    mockDb.setupRealtimeSubscriptions();
  }, []);

  const DEFAULT_TENANT: Tenant = {
    id: 'a0000000-0000-0000-0000-000000000001',
    company_name: 'Kantor Notaris',
    created_at: new Date().toISOString(),
    address: 'Indonesia',
    sk_menkumham: '',
    logo_url: '',
    bank_name: '',
    bank_account: '',
    bank_account_name: '',
    mayar_api_key: '',
    phone: '',
    email: ''
  };

  const activeUser: User = user || {
    id: 'b0000000-0000-0000-0000-000000000001',
    tenant_id: 'a0000000-0000-0000-0000-000000000001',
    username: 'user',
    name: 'Pengguna',
    role: 'NOTARIS',
    email: '',
    password: ''
  };

  const activeTenant: Tenant = (user?.tenant_id ? mockDb.tenants.find(t => t.id === user.tenant_id) : null) || mockDb.tenants[0] || DEFAULT_TENANT;

  const handleLogout = async () => {
    await signOut();
  };

  // Inject or remove 'light' class on html element
  useEffect(() => {
    if (isLightMode) {
      document.documentElement.classList.add('light');
    } else {
      document.documentElement.classList.remove('light');
    }
  }, [isLightMode]);

  // Automated redirect if non-eligible role tries to access restricted pages
  useEffect(() => {
    if (activeTab === 'settings' && activeUser.role !== 'NOTARIS') {
      setActiveTab('dashboard');
      alert('Akses Ditolak: Halaman Pengaturan Kantor hanya dapat diakses oleh Notaris Utama.');
    }
    if (activeTab === 'invoices' && !['NOTARIS', 'FINANCE'].includes(activeUser.role)) {
      setActiveTab('dashboard');
      alert('Akses Ditolak: Halaman Faktur & Tagihan hanya dapat diakses oleh Notaris dan Finance.');
    }
  }, [activeTab, activeUser.role]);
  
  // Checklist dynamic state for high density side-widget
  const [checklists, setChecklists] = useState([
    { id: '1', text: 'Verifikasi KTP & KK Sekutu', done: true },
    { id: '2', text: 'Pengecekan SABH Kemenkumham', done: true },
    { id: '3', text: 'Penyusunan Anggaran Dasar v1', done: false },
    { id: '4', text: 'Penandatanganan Akta Notaris', done: false },
    { id: '5', text: 'Setoran PNBP Keuangan', done: false }
  ]);

  const toggleChecklist = (id: string) => {
    setChecklists(prev => prev.map(item => item.id === id ? { ...item, done: !item.done } : item));
  };

  // Dynamic statistics calculated per selected tenant from the reactive store
  const tenantClientsCount = mockDb.clients.filter(c => c.tenant_id === activeUser.tenant_id || c.tenant_id === activeTenant?.id || !c.tenant_id).length;
  const tenantOrdersCount = mockDb.orders.filter(o => o.tenant_id === activeUser.tenant_id).length;
  const tenantTasks = mockDb.tasks.filter(t => t.tenant_id === activeUser.tenant_id);
  const tenantPendingTasksCount = tenantTasks.filter(t => t.status !== 'DONE').length;
  
  const tenantInvoices = mockDb.invoices.filter(i => i.tenant_id === activeUser.tenant_id);
  const tenantRevenue = tenantInvoices.reduce((sum, inv) => sum + (inv.status === 'PAID' ? inv.amount : 0), 0);
  const tenantUnpaidRevenue = tenantInvoices.reduce((sum, inv) => sum + (inv.status === 'UNPAID' ? inv.amount : 0), 0);

  const tenantAnnouncements = mockDb.announcements.filter(a => {
    const isCorrectTenant = a.tenant_id === activeUser.tenant_id;
    const isRoleEligible = a.target_role === 'ALL' || a.target_role === activeUser.role || activeUser.role === 'NOTARIS';
    return isCorrectTenant && isRoleEligible;
  });

  if (loading) {
    return (
      <div id="auth-loading-screen" className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 font-sans text-slate-100">
        <div className="w-10 h-10 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin mb-4" />
        <span className="text-sm font-medium text-slate-300">Memuat data pengguna...</span>
      </div>
    );
  }

  if (!user) {
    if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
      window.history.replaceState(null, '', '/login');
    }
    return (
      <LoginPage 
        onLoginSuccess={(loggedIn) => {
          setUser(loggedIn);
          if (typeof window !== 'undefined' && window.location.pathname === '/login') {
            window.history.replaceState(null, '', '/');
          }
        }} 
      />
    );
  }

  // Render sidebar navigation content for reuse in desktop & mobile drawer
  const sidebarContent = (
    <>
      {/* Brand Block */}
      <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center justify-center w-11 h-11 shrink-0">
            <img 
              src="/logo.svg" 
              alt="Logo Aplikasi" 
              className="w-full h-full object-contain drop-shadow-md"
            />
          </div>
          <div>
            <h1 className="font-sans font-bold text-slate-100 text-sm tracking-tight leading-none">
              {activeTenant?.company_name || 'Notaris SaaS'}
            </h1>
            <span className="text-[10px] text-indigo-400 font-mono font-medium">Notaris v1.0</span>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setIsMobileMenuOpen(false)}
            className="md:hidden p-1 text-slate-400 hover:text-white rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Sidebar Navigation */}
      <div className="p-3 flex-1 space-y-4 overflow-y-auto">
        {/* Kelompok 1: Operasional */}
        <div>
          <span className="px-3 text-[9px] font-bold text-slate-500 uppercase tracking-widest block mb-1.5 font-mono">
            Operasional
          </span>
          <nav className="space-y-0.5">
            {[
              { id: 'dashboard', label: 'Dashboard Utama', icon: LayoutDashboard, desc: 'Ikhtisar & Log Audit' },
              { id: 'orders', label: 'Order Tugas', icon: Briefcase, desc: 'Pemberkasan Akta' },
              { id: 'tasks', label: 'List Tugas', icon: FileCheck, desc: 'Tugas Kerja Aktif' },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id as any);
                    setIsMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded transition-all text-left ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-sm font-semibold'
                      : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200 font-medium'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-500'}`} />
                  <span className="text-xs sm:text-sm">{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Kelompok 2: Data */}
        <div>
          <span className="px-3 text-[9px] font-bold text-slate-500 uppercase tracking-widest block mb-1.5 font-mono font-sans">
            Data
          </span>
          <nav className="space-y-0.5">
            {[
              { id: 'clients', label: 'Data Klien (Clients)', icon: Users, desc: 'Manajemen Data Klien' },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id as any);
                    setIsMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded transition-all text-left ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-sm font-semibold'
                      : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200 font-medium'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-500'}`} />
                  <span className="text-xs sm:text-sm">{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Kelompok 3: Keuangan (Hanya Notaris & Finance) */}
        {['NOTARIS', 'FINANCE'].includes(activeUser.role) && (
          <div>
            <span className="px-3 text-[9px] font-bold text-slate-500 uppercase tracking-widest block mb-1.5 font-mono">
              Keuangan
            </span>
            <nav className="space-y-0.5">
              {[
                { id: 'invoices', label: 'Faktur & Tagihan', icon: DollarSign, desc: 'Gateway Pembayaran' },
              ].map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setActiveTab(tab.id as any);
                      setIsMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded transition-all text-left ${
                      isActive
                        ? 'bg-indigo-600 text-white shadow-sm font-semibold'
                        : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200 font-medium'
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-500'}`} />
                    <span className="text-xs sm:text-sm">{tab.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>
        )}

        {/* Kelompok 4: Administrasi (Hanya Notaris) */}
        {activeUser.role === 'NOTARIS' && (
          <div>
            <span className="px-3 text-[9px] font-bold text-rose-500 uppercase tracking-widest block mb-1.5 font-mono">
              Admin (Notaris)
            </span>
            <nav className="space-y-0.5">
              {[
                { id: 'employees', label: 'Manajemen Karyawan', icon: UserPlus, desc: 'Kelola Hak Akses' },
                { id: 'templates', label: 'Template Order', icon: Layers, desc: 'Kelola Syarat Akta Standar' },
              ].map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setActiveTab(tab.id as any);
                      setIsMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded transition-all text-left ${
                      isActive
                        ? 'bg-rose-600 text-white shadow-sm font-semibold'
                        : 'text-slate-400 hover:bg-slate-800/60 hover:text-rose-400 font-medium'
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-500'}`} />
                    <span className="text-xs sm:text-sm">{tab.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>
        )}

        {/* Kelompok 6: Pengaturan Kantor (Hanya Notaris) */}
        {activeUser.role === 'NOTARIS' && (
          <div className="pt-2 border-t border-slate-800/40">
            <span className="px-3 text-[9px] font-bold text-slate-500 uppercase tracking-widest block mb-1.5 font-mono">
              Pengaturan
            </span>
            <nav className="space-y-0.5">
              <button
                onClick={() => {
                  setActiveTab('settings');
                  setIsMobileMenuOpen(false);
                }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded transition-all text-left ${
                  activeTab === 'settings'
                    ? 'bg-indigo-600 text-white shadow-sm font-semibold'
                    : 'text-slate-400 hover:bg-slate-800/60 hover:text-indigo-400'
                }`}
              >
                <Settings className={`w-4 h-4 ${activeTab === 'settings' ? 'text-white' : 'text-slate-500'}`} />
                <span className="text-xs sm:text-sm font-medium">Pengaturan Kantor</span>
              </button>
            </nav>
          </div>
        )}


      </div>

      {/* Active User Profile at Sidebar Bottom */}
      <div className="p-4 bg-slate-950 border-t border-slate-800/80">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-full bg-slate-850 border border-slate-750 flex items-center justify-center text-indigo-400 font-mono font-bold text-xs select-none uppercase shrink-0">
              {(activeUser.name || 'U').charAt(0)}
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-xs font-semibold text-slate-200 block truncate" title={activeUser.name}>
                {activeUser.name}
              </span>
              <span className="text-[9px] text-indigo-400 font-mono tracking-wide uppercase font-bold mt-0.5 block">
                {activeUser.role}
              </span>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="p-1.5 rounded-lg bg-rose-950/20 border border-rose-900/30 text-rose-400 hover:text-rose-300 hover:bg-rose-950/50 transition-all cursor-pointer shrink-0"
            title="Keluar Sesi (Logout)"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </>
  );

  return (
    <div id="main-layout" className="min-h-screen bg-slate-950 text-slate-100 flex flex-col md:flex-row font-sans selection:bg-indigo-600 selection:text-white">
      
      {/* 1. DESKTOP LEFT SIDEBAR */}
      <aside className="hidden md:flex md:w-64 bg-slate-900 border-r border-slate-800 flex-col shrink-0 h-screen sticky top-0 z-30">
        {sidebarContent}
      </aside>

      {/* 2. MOBILE NAVIGATION DRAWER */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileMenuOpen(false)}
              className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-40 md:hidden"
            />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 left-0 w-72 max-w-[85vw] bg-slate-900 border-r border-slate-800 z-50 flex flex-col md:hidden shadow-2xl"
            >
              {sidebarContent}
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* 3. MAIN AREA */}
      <main className="flex-1 flex flex-col min-w-0 bg-slate-950">
        
        {/* Top Header Bar */}
        <header className="h-14 bg-slate-900 border-b border-slate-800 px-3 sm:px-6 flex items-center justify-between sticky top-0 z-30">
          
          {/* Mobile Menu Button + Active Tenant Display */}
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="md:hidden p-1.5 text-slate-300 hover:text-white rounded-lg bg-slate-800 border border-slate-700 transition-colors shrink-0"
              title="Buka Menu Navigasi"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 min-w-0">
              <Building2 className="w-4 h-4 text-slate-400 shrink-0 hidden sm:block" />
              <div className="min-w-0">
                <span className="text-[9px] sm:text-[10px] text-slate-500 uppercase font-mono tracking-wider block truncate">
                  Tenant Active
                </span>
                <h2 className="text-xs font-bold text-slate-200 truncate max-w-[130px] xs:max-w-[180px] sm:max-w-md">
                  {activeTenant.company_name}
                </h2>
              </div>
            </div>
          </div>

          {/* Quick Metrics / Action Badge */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Theme Toggle Button */}
            <button
              onClick={() => setIsLightMode(!isLightMode)}
              className="flex items-center gap-1.5 text-xs text-slate-300 bg-slate-800 hover:bg-slate-700 px-2 py-1.5 sm:px-2.5 rounded-lg border border-slate-700 transition-all font-medium cursor-pointer"
              title="Ganti Tema Tampilan"
            >
              <span>{isLightMode ? '🌙' : '☀️'}</span>
              <span className="hidden sm:inline">{isLightMode ? 'Mode Gelap' : 'Mode Terang'}</span>
            </button>
          </div>
        </header>

        {/* Content Container */}
        <div className="p-3 sm:p-6 space-y-4 sm:space-y-6 overflow-y-auto flex-1">
          {activeTab === 'dashboard' && (
            <BusinessDashboard activeUser={activeUser} activeTenant={activeTenant} />
          )}

          {activeTab === 'orders' && (
            <OrderManagement activeUser={activeUser} activeTenant={activeTenant} />
          )}

          {activeTab === 'tasks' && (
            <TaskManagement activeUser={activeUser} activeTenant={activeTenant} />
          )}

          {activeTab === 'clients' && (
            <ClientManagement activeUser={activeUser} activeTenant={activeTenant} />
          )}

          {activeTab === 'invoices' && (
            <InvoiceManagement activeUser={activeUser} activeTenant={activeTenant} />
          )}

          {activeTab === 'employees' && (
            <EmployeeManagement activeUser={activeUser} activeTenant={activeTenant} />
          )}

          {activeTab === 'templates' && (
            <TemplateManagement activeUser={activeUser} activeTenant={activeTenant} />
          )}

          {activeTab === 'settings' && (
            <OfficeSettings activeUser={activeUser} activeTenant={activeTenant} />
          )}

          {['sql', 'erd', 'simulator', 'docs'].includes(activeTab) && (
            <>
          
          {/* Row 1: High Density Dynamic KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            
            <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block font-sans">
                  Total Klien
                </span>
                <h3 className="text-2xl font-bold text-slate-100 mt-1 font-mono">{tenantClientsCount}</h3>
                <span className="text-[9px] text-emerald-400 font-medium flex items-center gap-1 mt-1 font-sans">
                  <TrendingUp className="w-3 h-3" /> Berhak Diakses
                </span>
              </div>
              <div className="bg-slate-950 p-2.5 rounded-lg text-slate-400 border border-slate-800">
                <Users className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block font-sans">
                  Berkas Akta Notaris
                </span>
                <h3 className="text-2xl font-bold text-slate-100 mt-1 font-mono">{tenantOrdersCount}</h3>
                <span className="text-[9px] text-indigo-400 font-medium flex items-center gap-1 mt-1 font-sans">
                  <Clock className="w-3 h-3 animate-pulse" /> Terisolasi
                </span>
              </div>
              <div className="bg-slate-950 p-2.5 rounded-lg text-slate-400 border border-slate-800">
                <Briefcase className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block font-sans">
                  Pekerjaan Tertunda
                </span>
                <h3 className="text-2xl font-bold text-amber-400 mt-1 font-mono">{tenantPendingTasksCount}</h3>
                <span className="text-[9px] text-amber-500/80 font-medium flex items-center gap-1 mt-1 font-sans">
                  <AlertCircle className="w-3 h-3" /> Butuh Tindakan
                </span>
              </div>
              <div className="bg-slate-950 p-2.5 rounded-lg text-amber-500/10 border border-amber-500/20">
                <FileCheck className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block font-sans">
                  Omset Terbayar (SaaS)
                </span>
                <h3 className="text-xl font-bold text-emerald-400 mt-1.5 font-mono">
                  {tenantRevenue.toLocaleString('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 })}
                </h3>
                <span className="text-[9px] text-slate-400 font-mono block mt-1.5">
                  Unpaid: {tenantUnpaidRevenue.toLocaleString('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 })}
                </span>
              </div>
              <div className="bg-slate-950 p-2.5 rounded-lg text-emerald-500/10 border border-emerald-500/20">
                <DollarSign className="w-5 h-5" />
              </div>
            </div>

          </div>

          {/* Row 2: Layout Grid (Main Tab contents on left, Side widgets on right) */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
            
            {/* Left 8 columns: Active view content */}
            <div className="xl:col-span-8 space-y-4">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTab}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.15 }}
                >
                  {activeTab === 'sql' && <SqlViewer />}
                  {activeTab === 'erd' && <ErdVisualizer />}
                  {activeTab === 'simulator' && (
                    <RlsSimulator selectedUserId={simulatedUserId} setSelectedUserId={setSimulatedUserId} />
                  )}
                  {activeTab === 'docs' && <SchemaDocumentation />}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Right 4 columns: Side Control Widgets */}
            <div className="xl:col-span-4 space-y-6">
              
              {/* PostgreSQL Security Shield & Policy Audit Panel */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 shadow-lg">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-indigo-400" />
                    <h4 className="font-sans font-bold text-slate-200 text-xs uppercase tracking-wider">
                      Status Keamanan Postgres
                    </h4>
                  </div>
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                </div>

                <div className="space-y-3">
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400 font-sans">Multi-Tenant Isolation</span>
                      <span className="text-emerald-400 font-mono font-bold text-[10px]">ACTIVE (100%)</span>
                    </div>
                    <div className="w-full bg-slate-950 rounded-full h-1.5 border border-slate-800">
                      <div className="bg-gradient-to-r from-indigo-500 to-emerald-500 h-1.2 rounded-full" style={{ width: '100%' }} />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400 font-sans">Role-Based Policy Layer</span>
                      <span className="text-indigo-400 font-mono font-bold text-[10px]">ENFORCED</span>
                    </div>
                    <div className="w-full bg-slate-950 rounded-full h-1.5 border border-slate-800">
                      <div className="bg-indigo-500 h-1.2 rounded-full" style={{ width: '100%' }} />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400 font-sans">Audit Logging (Triggers)</span>
                      <span className="text-amber-400 font-mono font-bold text-[10px]">RECORDING</span>
                    </div>
                    <div className="w-full bg-slate-950 rounded-full h-1.5 border border-slate-800">
                      <div className="bg-amber-500 h-1.2 rounded-full" style={{ width: '100%' }} />
                    </div>
                  </div>
                </div>

                {/* Audit Context Logs */}
                <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 space-y-2">
                  <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block leading-none mb-1">
                    Variabel Sesi PG lokal (Aktif)
                  </span>
                  <div className="font-mono text-[10px] space-y-1 text-slate-400">
                    <div className="flex justify-between">
                      <span className="text-slate-600">app.current_tenant_id:</span>
                      <span className="text-indigo-400 font-semibold text-right truncate max-w-[120px]" title={activeUser.tenant_id}>
                        {activeUser.tenant_id}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">app.current_user_role:</span>
                      <span className="text-amber-400 font-semibold">{activeUser.role}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">app.current_user_id:</span>
                      <span className="text-slate-300 font-semibold text-right truncate max-w-[120px]" title={activeUser.id}>
                        {activeUser.id}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Dynamic Tenant Checklist */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 shadow-lg">
                <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
                  <ListTodo className="w-5 h-5 text-indigo-400" />
                  <h4 className="font-sans font-bold text-slate-200 text-xs uppercase tracking-wider">
                    Checklist Operasional Kantor
                  </h4>
                </div>

                <div className="space-y-2.5">
                  {checklists.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => toggleChecklist(item.id)}
                      className="w-full flex items-center justify-between p-2.5 bg-slate-950/60 hover:bg-slate-950 border border-slate-800 rounded-lg text-left transition-all group"
                    >
                      <span className={`text-xs font-sans font-medium transition-all ${
                        item.done ? 'text-slate-500 line-through' : 'text-slate-300'
                      }`}>
                        {item.text}
                      </span>
                      <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${
                        item.done
                          ? 'bg-emerald-500 border-emerald-600 text-white'
                          : 'border-slate-700 group-hover:border-indigo-500'
                      }`}>
                        {item.done && <span className="text-[10px] font-bold">✓</span>}
                      </div>
                    </button>
                  ))}
                </div>

                <div className="text-[10px] text-slate-500 font-sans leading-relaxed text-center pt-1">
                  Klik item checklist di atas untuk menandai progres operasional kantor Notaris ini.
                </div>
              </div>

            </div>

          </div>

          {/* Row 3: Internal Tenant Announcements Feed */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 shadow-lg">
            <div className="flex items-center gap-2 border-b border-slate-800 pb-3 justify-between">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-amber-500" />
                <h4 className="font-sans font-bold text-slate-200 text-xs uppercase tracking-wider">
                  Papan Pengumuman Internal Tenant ({activeTenant.company_name.split(' ')[2]})
                </h4>
              </div>
              <span className="text-[10px] bg-slate-950 px-2 py-0.5 rounded font-mono text-indigo-400">
                Penyaringan RLS Otomatis
              </span>
            </div>

            {tenantAnnouncements.length === 0 ? (
              <div className="text-center text-xs text-slate-500 py-6">
                Tidak ada pengumuman yang sesuai dengan kualifikasi hak akses Anda.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {tenantAnnouncements.map((ann) => (
                  <div key={ann.id} className="bg-slate-950 border border-slate-800 p-4 rounded-lg space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <h5 className="text-xs font-bold text-slate-200 font-sans">{ann.title}</h5>
                      <span className="bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-mono text-[9px] px-1.5 py-0.2 rounded font-bold uppercase shrink-0">
                        Target: {ann.target_role}
                      </span>
                    </div>
                    <p className="text-slate-400 text-xs leading-relaxed font-sans">{ann.content}</p>
                    <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono pt-1">
                      <span>Oleh: {ann.created_by_name}</span>
                      <span>{new Date(ann.created_at).toLocaleDateString('id-ID')}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

            </>
          )}
        </div>

        {/* Footer */}
        <footer className="bg-slate-900 border-t border-slate-800 py-4 px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-slate-500">
          <div className="flex items-center gap-1.5 font-sans">
            <span className="font-semibold text-slate-400">Notaris v1.0</span>
          </div>
          <span className="font-mono">AR Studio All Rights Reserved © 2026</span>
        </footer>

      </main>

    </div>
  );
}
