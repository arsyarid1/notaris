import {
  Order,
  Task,
  ChecklistItem,
  DocumentItem,
  DocumentComment,
  Appointment,
  User,
  Announcement,
  AuditLog,
  Client,
  Invoice,
  Tenant,
  MOCK_ORDERS,
  MOCK_TASKS,
  MOCK_CHECKLISTS,
  MOCK_DOCUMENTS,
  MOCK_DOCUMENT_COMMENTS,
  MOCK_APPOINTMENTS,
  MOCK_USERS,
  MOCK_ANNOUNCEMENTS,
  MOCK_AUDIT_LOGS,
  MOCK_CLIENTS,
  MOCK_INVOICES,
  MOCK_TENANTS
} from '../data/schemaData';
import { supabase } from './supabase';

export function deduplicateTemplates<T extends { id?: string; tenant_id?: string; name: string }>(templates: T[]): T[] {
  const seen = new Set<string>();
  const result: T[] = [];

  for (const item of templates) {
    if (!item || !item.name) continue;
    const key = item.name.trim().toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      result.push(item);
    }
  }
  return result;
}

const isValidUuid = (val: string | null | undefined): boolean => {
  if (!val) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);
};

// Shared reactive store for frontend demo with complete live Supabase syncing
class MockDatabaseStore {
  private listeners: Set<() => void> = new Set();

  public tenants: Tenant[] = [...MOCK_TENANTS];
  public orders: Order[] = [...MOCK_ORDERS];
  public tasks: Task[] = [...MOCK_TASKS];
  public checklists: ChecklistItem[] = [...MOCK_CHECKLISTS];
  public documents: DocumentItem[] = [...MOCK_DOCUMENTS];
  public comments: DocumentComment[] = [...MOCK_DOCUMENT_COMMENTS];
  public appointments: Appointment[] = [...MOCK_APPOINTMENTS];
  public users: User[] = [...MOCK_USERS];
  public announcements: Announcement[] = [...MOCK_ANNOUNCEMENTS];
  public auditLogs: AuditLog[] = [...MOCK_AUDIT_LOGS];
  public clients: Client[] = [...MOCK_CLIENTS];
  public invoices: Invoice[] = [...MOCK_INVOICES];
  public orderTemplates: { id: string; tenant_id: string; name: string; checklists?: string[]; checklist_items: string[] }[] = [
    // Tenant 1 (Sutra Oktaviani)
    {
      id: 'tmpl-pt-1',
      tenant_id: 'a0000000-0000-0000-0000-000000000001',
      name: 'Akta Pendirian PT',
      checklist_items: [
        'Pengecekan nama PT di portal Kemenkumham',
        'Pembayaran biaya PNBP cek nama',
        'Identitas lengkap KTP para pendiri',
        'Input data modal dasar & ditempatkan',
        'NPWP para pemegang saham'
      ]
    },
    {
      id: 'tmpl-ajb-1',
      tenant_id: 'a0000000-0000-0000-0000-000000000001',
      name: 'Akta Jual Beli (AJB)',
      checklist_items: [
        'Pemeriksaan Sertifikat Tanah asli di BPN',
        'Pengecekan Pajak Bumi dan Bangunan (PBB) lunas',
        'Validasi identitas penjual & pembeli (KTP/KK)',
        'Pembayaran BPHTB pembeli & PPh penjual',
        'Pembuatan draf Akta Jual Beli'
      ]
    },
    {
      id: 'tmpl-waris-1',
      tenant_id: 'a0000000-0000-0000-0000-000000000001',
      name: 'Keterangan Waris & Pembagian Hak',
      checklist_items: [
        'Surat Kematian Pewaris',
        'Surat Keterangan Waris dari RT/RW/Kecamatan',
        'Fotokopi KTP & KK seluruh ahli waris',
        'Penyusunan Akta Pembagian Hak Bersama (APHB)',
        'Sertifikat Tanah yang akan dibagi'
      ]
    },
    {
      id: 'tmpl-cv-1',
      tenant_id: 'a0000000-0000-0000-0000-000000000001',
      name: 'Akta Pendirian CV',
      checklist_items: [
        'Verifikasi KTP para sekutu aktif & pasif',
        'Input porsi modal CV',
        'Pengecekan nama CV di Sistem Administrasi',
        'Pengesahan Kemenkumham'
      ]
    },
    // Tenant 2 (Maria Siregar)
    {
      id: 'tmpl-cv-2',
      tenant_id: 'a0000000-0000-0000-0000-000000000002',
      name: 'Akta Pendirian CV',
      checklist_items: [
        'Verifikasi KTP para sekutu aktif & pasif',
        'Input porsi modal CV',
        'Pengecekan nama CV di Sistem Administrasi',
        'Pengesahan Kemenkumham'
      ]
    }
  ];

  constructor() {
    // Pure Supabase PostgreSQL syncing - no local mock storage override
  }

  // Subscribe to changes in the database
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  // Notify all listeners of a state change
  public notify() {
    this.listeners.forEach((listener) => listener());
  }

  // Simulation delay to mimic real network latency
  public delay(ms: number = 200): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // Helper to check if Supabase is actually configured
  public isSupabaseConfigured(): boolean {
    const url =
      (import.meta as any).env?.VITE_SUPABASE_URL ||
      (typeof process !== 'undefined' ? process.env?.NEXT_PUBLIC_SUPABASE_URL : undefined);
    return !!url;
  }

  public realtimeChannel: any = null;

  // Realtime postgres_changes listener for Supabase
  public setupRealtimeSubscriptions() {
    if (!this.isSupabaseConfigured() || this.realtimeChannel) {
      return;
    }

    try {
      this.realtimeChannel = supabase
        .channel('realtime-notaris-global')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'clients' },
          () => {
            this.fetchAndSyncAll();
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'orders' },
          () => {
            this.fetchAndSyncAll();
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'tasks' },
          () => {
            this.fetchAndSyncAll();
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'invoices' },
          () => {
            this.fetchAndSyncAll();
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'checklists' },
          () => {
            this.fetchAndSyncAll();
          }
        )
        .subscribe();
    } catch (err) {
      console.error('Realtime subscription error:', err);
    }
  }

  // Fetch and Sync All Tables Live from Supabase
  public async fetchAndSyncAll(): Promise<void> {
    if (!this.isSupabaseConfigured()) {
      return;
    }

    try {
      // 1. Fetch tenants
      const { data: dbTenants, error: errTenants } = await supabase.from('tenants').select('*');
      if (errTenants) console.error('Error fetching tenants:', errTenants);
      
      // Seed tenants if database is completely empty and accessible
      if (dbTenants && dbTenants.length === 0 && !errTenants) {
        await this.seedDatabase().catch(err => console.error('Seed tenants error:', err));
      }

      // 2. Fetch users
      const { data: dbUsers, error: errUsers } = await supabase.from('users').select('*');
      if (errUsers) console.error('Error fetching users:', errUsers);

      // 3. Fetch clients
      const { data: dbClients, error: errClients } = await supabase.from('clients').select('*');
      if (errClients) console.error('Error fetching clients:', errClients);

      // 4. Fetch orders
      const { data: dbOrders, error: errOrders } = await supabase.from('orders').select('*');
      if (errOrders) console.error('Error fetching orders:', errOrders);

      // 5. Fetch tasks
      const { data: dbTasks, error: errTasks } = await supabase.from('tasks').select('*');
      if (errTasks) console.error('Error fetching tasks:', errTasks);

      // 6. Fetch checklists
      const { data: dbChecklists, error: errChecklists } = await supabase.from('checklists').select('*');
      if (errChecklists) console.error('Error fetching checklists:', errChecklists);

      // 7. Fetch announcements
      const { data: dbAnnouncements, error: errAnnouncements } = await supabase.from('announcements').select('*');
      if (errAnnouncements) console.error('Error fetching announcements:', errAnnouncements);

      // 8. Fetch invoices
      const { data: dbInvoices, error: errInvoices } = await supabase.from('invoices').select('*');
      if (errInvoices) console.error('Error fetching invoices:', errInvoices);

      // 9. Fetch audit logs
      const { data: dbAuditLogs, error: errAuditLogs } = await supabase.from('audit_logs').select('*');
      if (errAuditLogs) console.error('Error fetching audit logs:', errAuditLogs);

      // 10. Fetch order_templates
      const { data: dbTemplates, error: errTemplates } = await supabase.from('order_templates').select('*');
      if (errTemplates) {
        console.error('Error fetching order_templates:', errTemplates);
      } else if (dbTemplates && dbTemplates.length === 0) {
        await this.seedOrderTemplatesToSupabase();
      }

      // Populate local memory properties directly from PostgreSQL
      if (Array.isArray(dbTenants) && dbTenants.length > 0) {
        this.tenants = dbTenants.map((t: any) => ({
          id: t.id,
          company_name: t.company_name || t.name || 'Kantor Notaris',
          created_at: t.created_at,
          address: t.address || '',
          sk_menkumham: t.sk_menkumham || '',
          logo_url: t.logo_url || '',
          bank_name: t.bank_name || '',
          bank_account: t.bank_account || '',
          bank_account_name: t.bank_account_name || '',
          mayar_api_key: t.mayar_api_key || '',
          phone: t.phone || '',
          email: t.email || ''
        }));
      }

      if (Array.isArray(dbUsers) && dbUsers.length > 0) {
        this.users = dbUsers.map((u: any) => ({
          id: u.id,
          tenant_id: u.tenant_id,
          username: u.username,
          name: u.name,
          role: u.role,
          email: u.email || `${u.username}@kantornotaris.com`,
          password: u.password_hash || 'password123'
        }));
      }

      if (Array.isArray(dbClients)) {
        this.clients = dbClients.map((c: any) => {
          const assignedUser = this.users.find(u => u.id === c.assigned_to_user_id || u.name === c.assigned_to_user_name);
          return {
            id: c.id,
            tenant_id: c.tenant_id || 'a0000000-0000-0000-0000-000000000001',
            name: c.name,
            email: c.email || '',
            phone: c.phone || '',
            assigned_to_user_name: assignedUser ? assignedUser.name : (c.assigned_to_user_name || 'Belum Ditugaskan')
          };
        });
      }

      if (Array.isArray(dbOrders)) {
        this.orders = dbOrders.map((o: any) => {
          const client = this.clients.find(c => c.id === o.client_id);
          return {
            id: o.id,
            tenant_id: o.tenant_id,
            client_id: o.client_id,
            client_name: client ? client.name : 'Klien Umum',
            title: o.title,
            status: o.status,
            created_at: o.created_at
          };
        });
      }

      if (Array.isArray(dbTasks)) {
        this.tasks = dbTasks.map((t: any) => {
          const order = this.orders.find(o => o.id === t.order_id);
          const assignedUser = this.users.find(u => u.id === t.assigned_to_user_id);
          return {
            id: t.id,
            tenant_id: t.tenant_id,
            order_id: t.order_id,
            order_title: order ? order.title : 'Order Akta',
            title: t.title,
            description: t.description || '',
            assigned_to_user_name: assignedUser ? assignedUser.name : 'Staf Kantor',
            status: t.status
          };
        });
      }

      if (dbChecklists && dbChecklists.length > 0) {
        this.checklists = dbChecklists.map((chk: any) => {
          const user = this.users.find(u => u.id === chk.checked_by_user_id);
          return {
            id: chk.id,
            tenant_id: chk.tenant_id,
            task_id: chk.task_id,
            item_name: chk.item_name,
            is_checked: chk.is_checked,
            checked_by_user_id: chk.checked_by_user_id,
            checked_by_user_name: user ? user.name : null,
            checked_at: chk.checked_at
          };
        });
      }

      if (dbAnnouncements && dbAnnouncements.length > 0) {
        this.announcements = dbAnnouncements.map((ann: any) => {
          const user = this.users.find(u => u.id === ann.created_by);
          return {
            id: ann.id,
            tenant_id: ann.tenant_id,
            created_by_name: user ? user.name : 'Sistem Notaris',
            title: ann.title,
            content: ann.content,
            target_role: ann.target_role,
            created_at: ann.created_at
          };
        });
      }

      if (dbInvoices && dbInvoices.length > 0) {
        this.invoices = dbInvoices.map((inv: any) => {
          const order = this.orders.find(o => o.id === inv.order_id);
          return {
            id: inv.id,
            tenant_id: inv.tenant_id,
            order_id: inv.order_id,
            order_title: order ? order.title : 'Tagihan Akta',
            amount: Number(inv.amount),
            payment_link: inv.payment_link || '',
            status: inv.status,
            billing_type: inv.billing_type,
            created_at: inv.created_at,
            gateway_disabled: !inv.payment_link,
            invoice_number: inv.invoice_number || undefined,
            sequence_number: inv.sequence_number ? Number(inv.sequence_number) : undefined,
            due_date: inv.due_date || undefined
          };
        });
      }

      if (dbAuditLogs && dbAuditLogs.length > 0) {
        this.auditLogs = dbAuditLogs.map((log: any) => {
          const user = this.users.find(u => u.id === log.user_id);
          return {
            id: log.id,
            tenant_id: log.tenant_id,
            user_name: user ? user.name : 'Sistem',
            action: log.action,
            description: log.description || '',
            created_at: log.created_at
          };
        });
      }

      if (dbTemplates && dbTemplates.length > 0) {
        const mapped = dbTemplates.map((tmpl: any) => {
          const items = Array.isArray(tmpl.checklists) 
            ? tmpl.checklists 
            : (Array.isArray(tmpl.checklist_items) ? tmpl.checklist_items : []);
          return {
            id: tmpl.id,
            tenant_id: tmpl.tenant_id,
            name: tmpl.name,
            checklists: items,
            checklist_items: items
          };
        });
        this.orderTemplates = deduplicateTemplates(mapped);
      } else {
        this.orderTemplates = deduplicateTemplates(this.orderTemplates);
      }

      this.notify();
    } catch (err) {
      console.error('Error in fetchAndSyncAll:', err);
    }
  }

  // Seed default data if database is empty
  private async seedDatabase(): Promise<void> {
    try {
      try {
        await supabase.from('tenants').insert(
          MOCK_TENANTS.map(t => ({
            id: t.id,
            company_name: t.company_name,
            address: t.address || '',
            sk_menkumham: t.sk_menkumham || '',
            logo_url: t.logo_url || '',
            bank_name: t.bank_name || '',
            bank_account: t.bank_account || '',
            bank_account_name: t.bank_account_name || '',
            phone: t.phone || '',
            email: t.email || ''
          }))
        );
      } catch (e) {
        // Fall through
      }

      try {
        await supabase.from('users').insert(
          MOCK_USERS.map(u => ({
            id: u.id,
            tenant_id: u.tenant_id,
            username: u.username,
            password_hash: u.password || 'password123',
            name: u.name,
            role: u.role,
            email: u.email
          }))
        );
      } catch (e) {
        // Fall through
      }

      try {
        await supabase.from('clients').upsert(
          MOCK_CLIENTS.map(c => {
            const user = MOCK_USERS.find(u => u.name === c.assigned_to_user_name && u.tenant_id === c.tenant_id);
            return {
              id: c.id,
              tenant_id: c.tenant_id,
              name: c.name,
              email: c.email || '',
              phone: c.phone || '',
              assigned_to_user_id: user ? user.id : null
            };
          })
        );
      } catch (e) {
        // Fall through
      }

      await supabase.from('orders').insert(
        MOCK_ORDERS.map(o => ({
          id: o.id,
          tenant_id: o.tenant_id,
          client_id: o.client_id,
          title: o.title,
          status: o.status,
          created_at: o.created_at
        }))
      );

      await supabase.from('tasks').insert(
        MOCK_TASKS.map(t => {
          const user = MOCK_USERS.find(u => u.name === t.assigned_to_user_name && u.tenant_id === t.tenant_id);
          return {
            id: t.id,
            tenant_id: t.tenant_id,
            order_id: t.order_id,
            title: t.title,
            description: t.description || '',
            assigned_to_user_id: user ? user.id : null,
            status: t.status
          };
        })
      );

      await supabase.from('checklists').insert(
        MOCK_CHECKLISTS.map(chk => ({
          id: chk.id,
          tenant_id: chk.tenant_id,
          task_id: chk.task_id,
          item_name: chk.item_name,
          is_checked: chk.is_checked,
          checked_by_user_id: chk.checked_by_user_id,
          checked_at: chk.checked_at
        }))
      );

      await supabase.from('announcements').insert(
        MOCK_ANNOUNCEMENTS.map(ann => {
          const user = MOCK_USERS.find(u => u.name === ann.created_by_name && u.tenant_id === ann.tenant_id);
          return {
            id: ann.id,
            tenant_id: ann.tenant_id,
            created_by: user ? user.id : MOCK_USERS[0].id,
            title: ann.title,
            content: ann.content,
            target_role: ann.target_role,
            created_at: ann.created_at
          };
        })
      );

      await supabase.from('invoices').insert(
        MOCK_INVOICES.map(inv => ({
          id: inv.id,
          tenant_id: inv.tenant_id,
          order_id: inv.order_id,
          amount: inv.amount,
          payment_link: inv.payment_link || '',
          status: inv.status,
          billing_type: inv.billing_type,
          created_at: inv.created_at
        }))
      );

      await supabase.from('audit_logs').insert(
        MOCK_AUDIT_LOGS.map(log => {
          const user = MOCK_USERS.find(u => u.name === log.user_name && u.tenant_id === log.tenant_id);
          return {
            id: log.id,
            tenant_id: log.tenant_id,
            user_id: user ? user.id : null,
            action: log.action,
            description: log.description || '',
            created_at: log.created_at
          };
        })
      );

      await this.seedOrderTemplatesToSupabase();
    } catch (err) {
      console.error('Error during initial database seed:', err);
    }
  }

  // Public helper to seed default order_templates into Supabase
  public async seedOrderTemplatesToSupabase(): Promise<{ success: boolean; error?: string; insertedCount?: number }> {
    if (!this.isSupabaseConfigured()) {
      return { success: false, error: 'Supabase URL atau Anon Key belum terkonfigurasi di environment variables.' };
    }

    const defaultTemplates = [
      {
        tenant_id: 'a0000000-0000-0000-0000-000000000001',
        name: 'Akta Pendirian PT',
        checklists: [
          'Pengecekan nama PT di portal Kemenkumham',
          'Pembayaran biaya PNBP cek nama',
          'Identitas lengkap KTP para pendiri',
          'Input data modal dasar & ditempatkan',
          'NPWP para pemegang saham'
        ]
      },
      {
        tenant_id: 'a0000000-0000-0000-0000-000000000001',
        name: 'Akta Jual Beli (AJB)',
        checklists: [
          'Pemeriksaan Sertifikat Tanah asli di BPN',
          'Pengecekan Pajak Bumi dan Bangunan (PBB) lunas',
          'Validasi identitas penjual & pembeli (KTP/KK)',
          'Pembayaran BPHTB pembeli & PPh penjual',
          'Pembuatan draf Akta Jual Beli'
        ]
      },
      {
        tenant_id: 'a0000000-0000-0000-0000-000000000001',
        name: 'Keterangan Waris & Pembagian Hak',
        checklists: [
          'Surat Kematian Pewaris',
          'Surat Keterangan Waris dari RT/RW/Kecamatan',
          'Fotokopi KTP & KK seluruh ahli waris',
          'Penyusunan Akta Pembagian Hak Bersama (APHB)',
          'Sertifikat Tanah yang akan dibagi'
        ]
      },
      {
        tenant_id: 'a0000000-0000-0000-0000-000000000001',
        name: 'Akta Pendirian CV',
        checklists: [
          'Verifikasi KTP para sekutu aktif & pasif',
          'Input porsi modal CV',
          'Pengecekan nama CV di Sistem Administrasi',
          'Pengesahan Kemenkumham'
        ]
      },
      {
        tenant_id: 'a0000000-0000-0000-0000-000000000002',
        name: 'Akta Pendirian CV',
        checklists: [
          'Verifikasi KTP para sekutu aktif & pasif',
          'Input porsi modal CV',
          'Pengecekan nama CV di Sistem Administrasi',
          'Pengesahan Kemenkumham'
        ]
      }
    ];

    try {
      // 1. Fetch existing templates from Supabase
      const { data: existing, error: fetchErr } = await supabase.from('order_templates').select('*');
      if (fetchErr) {
        console.error('Gagal membaca order_templates saat seed:', fetchErr);
        return { success: false, error: fetchErr.message };
      }

      const existingNames = new Set((existing || []).map((t: any) => t.name.trim().toLowerCase()));

      // Filter to only insert missing default templates
      const toInsert = defaultTemplates.filter(
        t => !existingNames.has(t.name.trim().toLowerCase())
      );

      let insertCount = 0;
      if (toInsert.length > 0) {
        const { error: insertErr } = await supabase.from('order_templates').upsert(toInsert);
        if (insertErr) {
          const fallbackPayload = toInsert.map(t => ({
            tenant_id: t.tenant_id,
            name: t.name,
            checklist_items: t.checklists
          }));
          const { error: retryErr } = await supabase.from('order_templates').upsert(fallbackPayload);
          if (retryErr) {
            console.error("Gagal menyuntikkan template ke Supabase:", retryErr);
            return { success: false, error: retryErr.message };
          }
        }
        insertCount = toInsert.length;
      }

      // 2. Clean up any existing duplicate rows in Supabase table
      if (existing && existing.length > 0) {
        const seenKeys = new Map<string, string>();
        const duplicateIdsToDelete: string[] = [];

        for (const tmpl of existing) {
          const key = tmpl.name.trim().toLowerCase();
          if (seenKeys.has(key)) {
            duplicateIdsToDelete.push(tmpl.id);
          } else {
            seenKeys.set(key, tmpl.id);
          }
        }

        if (duplicateIdsToDelete.length > 0) {
          await supabase.from('order_templates').delete().in('id', duplicateIdsToDelete);
        }
      }

      return { success: true, insertedCount: insertCount };
    } catch (e: any) {
      console.error('Error seeding order_templates to Supabase:', e);
      return { success: false, error: e?.message || String(e) };
    }
  }

  // Actions for Order Workflow
  public async updateOrderStatus(orderId: string, status: Order['status']): Promise<Order> {
    await this.delay();
    const order = this.orders.find((o) => o.id === orderId);
    if (!order) throw new Error(`Order with ID ${orderId} not found`);
    order.status = status;

    if (this.isSupabaseConfigured()) {
      await supabase.from('orders').update({ status }).eq('id', orderId);
      await this.fetchAndSyncAll();
    } else {
      this.notify();
    }
    return { ...order };
  }

  public async updateTaskStatus(tenantId: string, taskId: string, status: Task['status'], updaterName: string): Promise<Task> {
    await this.delay();
    const task = this.tasks.find((t) => t.id === taskId);
    if (!task) throw new Error(`Task with ID ${taskId} not found`);
    task.status = status;

    if (this.isSupabaseConfigured()) {
      await supabase.from('tasks').update({ status }).eq('id', taskId);
      await this.fetchAndSyncAll();
    } else {
      this.notify();
    }
    return { ...task };
  }

  public async handoverTask(taskId: string, targetUserId: string, targetUserName: string): Promise<Task> {
    await this.delay();
    const task = this.tasks.find((t) => t.id === taskId);
    if (!task) throw new Error(`Task with ID ${taskId} not found`);
    task.assigned_to_user_name = targetUserName;

    if (this.isSupabaseConfigured()) {
      await supabase.from('tasks').update({ assigned_to_user_id: targetUserId }).eq('id', taskId);
      await this.fetchAndSyncAll();
    } else {
      this.notify();
    }
    return { ...task };
  }

  // Actions for Task Checklist
  public async toggleChecklist(checklistId: string, isChecked: boolean, userId: string | null, userName: string | null): Promise<ChecklistItem> {
    await this.delay();
    const item = this.checklists.find((c) => c.id === checklistId);
    if (!item) throw new Error(`Checklist item with ID ${checklistId} not found`);
    item.is_checked = isChecked;
    item.checked_by_user_id = isChecked ? userId : null;
    item.checked_by_user_name = isChecked ? userName : null;
    item.checked_at = isChecked ? new Date().toISOString() : null;

    if (this.isSupabaseConfigured()) {
      await supabase.from('checklists').update({
        is_checked: isChecked,
        checked_by_user_id: isChecked ? userId : null,
        checked_at: isChecked ? new Date().toISOString() : null
      }).eq('id', checklistId);
      await this.fetchAndSyncAll();
    } else {
      this.notify();
    }
    return { ...item };
  }

  public async addChecklistItem(taskId: string, tenantId: string, itemName: string): Promise<ChecklistItem> {
    await this.delay();
    const newItem: ChecklistItem = {
      id: `chk-${Math.random().toString(36).substr(2, 9)}`,
      tenant_id: tenantId,
      task_id: taskId,
      item_name: itemName,
      is_checked: false,
      checked_by_user_id: null,
      checked_by_user_name: null,
      checked_at: null,
    };

    if (this.isSupabaseConfigured()) {
      const payload: any = {
        tenant_id: tenantId,
        task_id: taskId,
        item_name: itemName,
        is_checked: false
      };
      if (isValidUuid(newItem.id)) {
        payload.id = newItem.id;
      }
      const { data, error } = await supabase.from('checklists').insert(payload).select().single();
      
      if (!error && data) {
        newItem.id = data.id;
      }
      await this.fetchAndSyncAll();
    } else {
      this.checklists.push(newItem);
      this.notify();
    }
    return newItem;
  }

  // Actions for Document Review
  public async uploadDocument(taskId: string, tenantId: string, fileUrl: string): Promise<DocumentItem> {
    await this.delay();
    const newDoc: DocumentItem = {
      id: `doc-${Math.random().toString(36).substr(2, 9)}`,
      tenant_id: tenantId,
      task_id: taskId,
      file_url: fileUrl,
      status: 'DRAFT',
      created_at: new Date().toISOString(),
    };

    if (this.isSupabaseConfigured()) {
      await supabase.from('documents').insert({
        id: newDoc.id,
        tenant_id: tenantId,
        task_id: taskId,
        file_url: fileUrl,
        status: 'DRAFT'
      });
      await this.fetchAndSyncAll();
    } else {
      this.documents.push(newDoc);
      this.notify();
    }
    return newDoc;
  }

  public async updateDocumentStatus(docId: string, status: DocumentItem['status']): Promise<DocumentItem> {
    await this.delay();
    const doc = this.documents.find((d) => d.id === docId);
    if (!doc) throw new Error(`Document with ID ${docId} not found`);
    doc.status = status;

    if (this.isSupabaseConfigured()) {
      await supabase.from('documents').update({ status }).eq('id', docId);
      await this.fetchAndSyncAll();
    } else {
      this.notify();
    }
    return { ...doc };
  }

  public async addComment(documentId: string, tenantId: string, userId: string, userName: string, commentText: string): Promise<DocumentComment> {
    await this.delay();
    const newComment: DocumentComment = {
      id: `com-${Math.random().toString(36).substr(2, 9)}`,
      tenant_id: tenantId,
      document_id: documentId,
      user_id: userId,
      user_name: userName,
      comment: commentText,
      created_at: new Date().toISOString(),
    };

    if (this.isSupabaseConfigured()) {
      await supabase.from('document_comments').insert({
        id: newComment.id,
        tenant_id: tenantId,
        document_id: documentId,
        user_id: userId,
        comment: commentText
      });
      await this.fetchAndSyncAll();
    } else {
      this.comments.push(newComment);
      this.notify();
    }
    return newComment;
  }

  // Actions for Notary Calendar
  public async proposeAppointment(tenantId: string, orderId: string, notaryId: string, dateTime: string): Promise<Appointment> {
    await this.delay();
    const order = this.orders.find((o) => o.id === orderId);
    const notary = this.users.find((u) => u.id === notaryId);
    const newAppt: Appointment = {
      id: `appt-${Math.random().toString(36).substr(2, 9)}`,
      tenant_id: tenantId,
      order_id: orderId,
      order_title: order?.title || 'Order Akta Baru',
      notary_id: notaryId,
      notary_name: notary?.name || 'Notaris Bersangkutan',
      date_time: dateTime,
      status: 'PROPOSED',
    };

    if (this.isSupabaseConfigured()) {
      await supabase.from('appointments').insert({
        id: newAppt.id,
        tenant_id: tenantId,
        order_id: orderId,
        notary_id: notaryId,
        date_time: dateTime,
        status: 'PROPOSED'
      });
      await this.fetchAndSyncAll();
    } else {
      this.appointments.push(newAppt);
      this.notify();
    }
    return newAppt;
  }

  public async updateAppointmentStatus(apptId: string, status: Appointment['status']): Promise<Appointment> {
    await this.delay();
    const appt = this.appointments.find((a) => a.id === apptId);
    if (!appt) throw new Error(`Appointment with ID ${apptId} not found`);
    appt.status = status;

    if (this.isSupabaseConfigured()) {
      await supabase.from('appointments').update({ status }).eq('id', apptId);
      await this.fetchAndSyncAll();
    } else {
      this.notify();
    }
    return { ...appt };
  }

  public async rescheduleAppointment(apptId: string, newDateTime: string, status: Appointment['status'] = 'RESCHEDULED'): Promise<Appointment> {
    await this.delay(150);
    const appt = this.appointments.find((a) => a.id === apptId);
    if (!appt) throw new Error(`Appointment with ID ${apptId} not found`);
    appt.date_time = newDateTime;
    appt.status = status;

    if (this.isSupabaseConfigured()) {
      await supabase.from('appointments').update({
        date_time: newDateTime,
        status: 'PROPOSED' // Reset to PROPOSED for approval of reschedule
      }).eq('id', apptId);
      await this.fetchAndSyncAll();
    } else {
      this.notify();
    }
    return { ...appt };
  }

  public async addAnnouncement(tenantId: string, createdByUserId: string, createdByName: string, title: string, content: string, targetRole: 'ALL' | 'FINANCE' | 'STAFF'): Promise<Announcement> {
    await this.delay(100);
    const newAnn: Announcement = {
      id: `ann-${Math.random().toString(36).substr(2, 9)}`,
      tenant_id: tenantId,
      created_by_name: createdByName,
      title,
      content,
      target_role: targetRole,
      created_at: new Date().toISOString()
    };

    if (this.isSupabaseConfigured()) {
      // Find valid creator UUID or use first user
      let matchedUserId = createdByUserId;
      const validUser = this.users.find(u => u.name === createdByName || u.id === createdByUserId);
      if (validUser) {
        matchedUserId = validUser.id;
      } else if (this.users.length > 0) {
        matchedUserId = this.users[0].id;
      }

      await supabase.from('announcements').insert({
        id: newAnn.id,
        tenant_id: tenantId,
        created_by: matchedUserId,
        title,
        content,
        target_role: targetRole,
        created_at: newAnn.created_at
      });
      await this.fetchAndSyncAll();
    } else {
      this.announcements.unshift(newAnn);
      this.notify();
    }

    // Log this action
    await this.addAuditLog(tenantId, createdByName, 'CREATE_ANNOUNCEMENT', `Pengumuman baru dibuat: "${title}" untuk target ${targetRole}`);
    return newAnn;
  }

  public async updateAnnouncement(tenantId: string, announcementId: string, title: string, content: string, targetRole: 'ALL' | 'FINANCE' | 'STAFF', executorName: string): Promise<Announcement> {
    await this.delay(100);
    const ann = this.announcements.find(a => a.id === announcementId);
    if (!ann) throw new Error(`Pengumuman tidak ditemukan`);
    ann.title = title;
    ann.content = content;
    ann.target_role = targetRole;

    if (this.isSupabaseConfigured()) {
      await supabase.from('announcements').update({
        title,
        content,
        target_role: targetRole
      }).eq('id', announcementId);
      await this.fetchAndSyncAll();
    } else {
      this.notify();
    }

    await this.addAuditLog(tenantId, executorName, 'UPDATE_ANNOUNCEMENT', `Pengumuman "${title}" berhasil diperbarui oleh ${executorName}`);
    return { ...ann };
  }

  public async deleteAnnouncement(tenantId: string, announcementId: string, executorName: string): Promise<void> {
    await this.delay(100);
    const index = this.announcements.findIndex(a => a.id === announcementId);
    if (index === -1) throw new Error(`Pengumuman tidak ditemukan`);
    const title = this.announcements[index].title;

    if (this.isSupabaseConfigured()) {
      await supabase.from('announcements').delete().eq('id', announcementId);
      await this.fetchAndSyncAll();
    } else {
      this.announcements.splice(index, 1);
      this.notify();
    }

    await this.addAuditLog(tenantId, executorName, 'DELETE_ANNOUNCEMENT', `Pengumuman "${title}" dihapus oleh ${executorName}`);
  }

  public async addAuditLog(tenantId: string, userName: string, action: string, description: string): Promise<AuditLog> {
    const newLog: AuditLog = {
      id: `log-${Math.random().toString(36).substr(2, 9)}`,
      tenant_id: tenantId,
      user_name: userName,
      action,
      description,
      created_at: new Date().toISOString()
    };

    if (this.isSupabaseConfigured()) {
      const user = this.users.find(u => u.name === userName);
      await supabase.from('audit_logs').insert({
        id: newLog.id,
        tenant_id: tenantId,
        user_id: user ? user.id : null,
        action,
        description,
        created_at: newLog.created_at
      });
      // Skip heavy sync on log writes for faster response times
    } else {
      this.auditLogs.unshift(newLog);
      this.notify();
    }
    return newLog;
  }

  // --- CLIENTS MUTATIONS ---
  public async addClient(tenantId: string, name: string, email: string, phone: string, assignedToUserName: string): Promise<Client> {
    await this.delay(100);
    
    const isValidUuid = (val: any) => typeof val === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val.trim());

    const cleanName = name ? name.trim() : '';
    const cleanEmail = email && email.trim() !== '' ? email.trim() : null;
    const cleanPhone = phone && phone.trim() !== '' ? phone.trim() : null;

    // 1. Validasi Duplikat Lokal (Mencegah Error 409 Conflict)
    if (cleanEmail) {
      const existingEmail = this.clients.find(c => c.email && c.email.toLowerCase() === cleanEmail.toLowerCase());
      if (existingEmail) {
        throw new Error(`Email "${cleanEmail}" sudah terdaftar untuk klien ${existingEmail.name}. Silakan gunakan email lain.`);
      }
    }
    if (cleanPhone) {
      const existingPhone = this.clients.find(c => c.phone && c.phone.trim() === cleanPhone);
      if (existingPhone) {
        throw new Error(`Nomor telepon "${cleanPhone}" sudah terdaftar untuk klien ${existingPhone.name}. Silakan gunakan nomor lain.`);
      }
    }

    const user = this.users.find(u => u.name === assignedToUserName || u.id === assignedToUserName);
    const assigned_to_user_id = user && isValidUuid(user.id) ? user.id : null;
    
    const matchedTenant = this.tenants.find(t => t.id === tenantId);
    const effectiveTenantId = matchedTenant
      ? matchedTenant.id
      : (this.tenants[0]?.id || (isValidUuid(tenantId) ? tenantId : 'a0000000-0000-0000-0000-000000000001'));

    let supabaseResultData: any = null;

    // 2. Sync ke Supabase Database
    if (this.isSupabaseConfigured()) {
      try {
        const payload: any = {
          tenant_id: effectiveTenantId,
          name: cleanName,
          email: cleanEmail,
          phone: cleanPhone,
          assigned_to_user_id
        };

        const { data, error } = await supabase.from('clients').insert([payload]).select();
        if (!error && data && data.length > 0) {
          supabaseResultData = data[0];
        } else if (error) {
          console.error('Sync insert ke Supabase error:', error.message);
        }
      } catch (authErr) {
        console.error('Verifikasi Supabase pada addClient:', authErr);
      }
    }

    // 3. Simpan / Sync ke Memory State Local
    const newClient: Client = {
      id: supabaseResultData?.id || `c-${Math.random().toString(36).substr(2, 9)}`,
      tenant_id: effectiveTenantId,
      name: cleanName,
      email: cleanEmail || '',
      phone: cleanPhone || '',
      assigned_to_user_name: assignedToUserName || 'Belum Ditugaskan'
    };

    if (!this.clients.some(c => c.id === newClient.id || (c.name === cleanName && c.email === (cleanEmail || '')))) {
      this.clients.unshift(newClient);
    }
    this.notify();
    await this.addAuditLog(effectiveTenantId, assignedToUserName || 'Sistem', 'CREATE_CLIENT', `Klien baru didaftarkan: ${cleanName}`);
    return newClient;
  }

  public async updateClient(tenantId: string, clientId: string, name: string, email: string, phone: string, assignedToUserName: string): Promise<Client> {
    await this.delay(100);
    const isValidUuid = (val: any) => typeof val === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val.trim());

    const client = this.clients.find(c => c.id === clientId);
    const cleanName = name ? name.trim() : (client ? client.name : '');
    const cleanEmail = email && email.trim() !== '' ? email.trim() : null;
    const cleanPhone = phone && phone.trim() !== '' ? phone.trim() : null;

    // 1. Validasi Duplikat Lokal (Mencegah Error 409 Conflict)
    if (cleanEmail) {
      const existingEmail = this.clients.find(c => c.id !== clientId && c.email && c.email.toLowerCase() === cleanEmail.toLowerCase());
      if (existingEmail) {
        throw new Error(`Email "${cleanEmail}" sudah terdaftar untuk klien ${existingEmail.name}. Silakan gunakan email lain.`);
      }
    }
    if (cleanPhone) {
      const existingPhone = this.clients.find(c => c.id !== clientId && c.phone && c.phone.trim() === cleanPhone);
      if (existingPhone) {
        throw new Error(`Nomor telepon "${cleanPhone}" sudah terdaftar untuk klien ${existingPhone.name}. Silakan gunakan nomor lain.`);
      }
    }

    const user = this.users.find(u => u.name === assignedToUserName || u.id === assignedToUserName);
    const assigned_to_user_id = user && isValidUuid(user.id) ? user.id : null;

    // 2. Sync ke Supabase Database
    if (this.isSupabaseConfigured() && isValidUuid(clientId)) {
      try {
        const payload: any = {
          name: cleanName,
          email: cleanEmail,
          phone: cleanPhone,
          assigned_to_user_id
        };
        const { error } = await supabase
          .from('clients')
          .update(payload)
          .eq('id', clientId)
          .eq('tenant_id', tenantId);
        if (error) {
          console.error('Sync update ke Supabase error:', error.message);
        }
      } catch (authErr) {
        console.error('Error saat updateClient ke Supabase:', authErr);
      }
    }

    // 3. Update Memory State Local
    if (client) {
      client.name = cleanName;
      client.email = cleanEmail || '';
      client.phone = cleanPhone || '';
      client.assigned_to_user_name = assignedToUserName || 'Belum Ditugaskan';
      this.notify();
    }

    await this.addAuditLog(tenantId, assignedToUserName || 'Sistem', 'UPDATE_CLIENT', `Data klien ${cleanName} berhasil diperbarui`);
    return client ? { ...client } : {
      id: clientId,
      tenant_id: tenantId,
      name: cleanName,
      email: cleanEmail || '',
      phone: cleanPhone || '',
      assigned_to_user_name: assignedToUserName || 'Belum Ditugaskan'
    };
  }

  public async deleteClient(tenantId: string, clientId: string, executorName: string): Promise<void> {
    await this.delay(100);
    const isValidUuid = (val: any) => typeof val === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val.trim());

    const index = this.clients.findIndex(c => c.id === clientId);
    const name = index !== -1 ? this.clients[index].name : 'Klien';

    // Sync Hapus di Supabase Database with tenant_id isolation
    if (this.isSupabaseConfigured() && isValidUuid(clientId)) {
      try {
        const { error } = await supabase
          .from('clients')
          .delete()
          .eq('id', clientId)
          .eq('tenant_id', tenantId);
        if (error) {
          console.error('Sync delete ke Supabase error:', error.message);
        }
      } catch (err) {
        console.error('Error deleteClient di Supabase:', err);
      }
    }

    if (index !== -1) {
      this.clients.splice(index, 1);
      this.notify();
    }

    await this.addAuditLog(tenantId, executorName, 'DELETE_CLIENT', `Klien ${name} dihapus dari sistem`);
  }

  // --- INVOICES MUTATIONS ---
  public async addInvoice(
    tenantId: string,
    orderId: string,
    orderTitle: string,
    amount: number,
    billingType: 'DP' | 'PELUNASAN' | 'LUNAS',
    paymentLink: string,
    creatorName: string,
    skipSupabaseWrite: boolean = false,
    existingInvoiceId?: string,
    createdAt?: string,
    invoiceNumber?: string,
    sequenceNumber?: number,
    dueDate?: string
  ): Promise<Invoice> {
    await this.delay(150);
    const hexChars = '0123456789abcdef';
    let suffix = '';
    for (let i = 0; i < 12; i++) {
      suffix += hexChars[Math.floor(Math.random() * 16)];
    }
    const newInvoice: Invoice = {
      id: existingInvoiceId || `f0000000-0000-0000-0000-${suffix}`,
      tenant_id: tenantId,
      order_id: orderId,
      order_title: orderTitle,
      amount,
      payment_link: paymentLink,
      status: 'UNPAID',
      billing_type: billingType,
      created_at: createdAt || new Date().toISOString(),
      invoice_number: invoiceNumber,
      sequence_number: sequenceNumber,
      due_date: dueDate
    };

    if (this.isSupabaseConfigured() && !skipSupabaseWrite) {
      await supabase.from('invoices').insert({
        id: newInvoice.id,
        tenant_id: tenantId,
        order_id: orderId,
        amount,
        payment_link: paymentLink || null,
        status: 'UNPAID',
        billing_type: billingType,
        created_at: newInvoice.created_at,
        invoice_number: invoiceNumber || null,
        sequence_number: sequenceNumber || null,
        due_date: dueDate || null
      });
      await this.fetchAndSyncAll();
    } else {
      if (!this.invoices.some(inv => inv.id === newInvoice.id)) {
        this.invoices.unshift(newInvoice);
      }
      this.notify();
    }

    await this.addAuditLog(tenantId, creatorName, 'CREATE_INVOICE', `Penerbitan tagihan ${billingType} sebesar Rp ${amount.toLocaleString('id-ID')} untuk ${orderTitle}`);
    return newInvoice;
  }

  public async updateInvoiceStatus(tenantId: string, invoiceId: string, status: 'UNPAID' | 'PAID' | 'EXPIRED', updaterName: string): Promise<Invoice> {
    await this.delay(100);
    const invoice = this.invoices.find(i => i.id === invoiceId);
    if (!invoice) throw new Error(`Invoice tidak ditemukan`);
    const oldStatus = invoice.status;
    invoice.status = status;

    if (this.isSupabaseConfigured()) {
      await supabase.from('invoices').update({ status }).eq('id', invoiceId);
      await this.fetchAndSyncAll();
    } else {
      this.notify();
    }

    await this.addAuditLog(tenantId, updaterName, 'UPDATE_INVOICE_STATUS', `Status invoice ${invoiceId.substring(0, 8)}... diubah dari ${oldStatus} menjadi ${status}`);
    return { ...invoice };
  }

  public async updateInvoice(tenantId: string, invoiceId: string, amount: number, billingType: 'DP' | 'PELUNASAN' | 'LUNAS', status: 'UNPAID' | 'PAID' | 'EXPIRED', paymentLink: string, executorName: string): Promise<Invoice> {
    await this.delay(100);
    const invoice = this.invoices.find(i => i.id === invoiceId);
    if (!invoice) throw new Error(`Invoice tidak ditemukan`);
    const oldAmount = invoice.amount;
    const oldBillingType = invoice.billing_type;
    const oldStatus = invoice.status;

    invoice.amount = amount;
    invoice.billing_type = billingType;
    invoice.status = status;
    invoice.payment_link = paymentLink;

    if (this.isSupabaseConfigured()) {
      await supabase.from('invoices').update({
        amount,
        billing_type: billingType,
        status,
        payment_link: paymentLink || null
      }).eq('id', invoiceId);
      await this.fetchAndSyncAll();
    } else {
      this.notify();
    }

    await this.addAuditLog(
      tenantId,
      executorName,
      'UPDATE_INVOICE',
      `Invoice INV-${invoiceId.substring(19).toUpperCase()} diperbarui oleh ${executorName}. Nominal: Rp ${oldAmount.toLocaleString('id-ID')} -> Rp ${amount.toLocaleString('id-ID')}, Tipe: ${oldBillingType} -> ${billingType}, Status: ${oldStatus} -> ${status}`
    );
    return { ...invoice };
  }

  public async deleteInvoice(tenantId: string, invoiceId: string, executorName: string): Promise<void> {
    await this.delay(100);
    const index = this.invoices.findIndex(i => i.id === invoiceId);
    if (index === -1) throw new Error(`Invoice tidak ditemukan`);
    
    if (this.isSupabaseConfigured()) {
      await supabase.from('invoices').delete().eq('id', invoiceId);
      await this.fetchAndSyncAll();
    } else {
      this.invoices.splice(index, 1);
      this.notify();
    }
    await this.addAuditLog(tenantId, executorName, 'DELETE_INVOICE', `Invoice ${invoiceId.substring(0, 8)}... dihapus dari sistem oleh ${executorName}`);
  }

  public async updateTenantSettings(
    tenantId: string, 
    mayarApiKey: string, 
    updaterName: string,
    additionalSettings?: {
      company_name?: string;
      address?: string;
      sk_menkumham?: string;
      logo_url?: string;
      bank_name?: string;
      bank_account?: string;
      bank_account_name?: string;
      phone?: string;
      email?: string;
    }
  ): Promise<Tenant> {
    await this.delay(200);
    const tenant = this.tenants.find(t => t.id === tenantId) || this.tenants[0];
    if (!tenant) return {} as Tenant;
    
    tenant.mayar_api_key = mayarApiKey;
    if (additionalSettings) {
      if (additionalSettings.company_name !== undefined) tenant.company_name = additionalSettings.company_name;
      if (additionalSettings.address !== undefined) tenant.address = additionalSettings.address;
      if (additionalSettings.sk_menkumham !== undefined) tenant.sk_menkumham = additionalSettings.sk_menkumham;
      if (additionalSettings.logo_url !== undefined) tenant.logo_url = additionalSettings.logo_url;
      if (additionalSettings.bank_name !== undefined) tenant.bank_name = additionalSettings.bank_name;
      if (additionalSettings.bank_account !== undefined) tenant.bank_account = additionalSettings.bank_account;
      if (additionalSettings.bank_account_name !== undefined) tenant.bank_account_name = additionalSettings.bank_account_name;
      if (additionalSettings.phone !== undefined) tenant.phone = additionalSettings.phone;
      if (additionalSettings.email !== undefined) tenant.email = additionalSettings.email;
    }

    if (this.isSupabaseConfigured()) {
      try {
        const updateData: any = {
          mayar_api_key: mayarApiKey,
        };
        if (additionalSettings) {
          if (additionalSettings.company_name !== undefined) {
            updateData.company_name = additionalSettings.company_name;
            updateData.name = additionalSettings.company_name; // support both columns safely
          }
          if (additionalSettings.address !== undefined) updateData.address = additionalSettings.address;
          if (additionalSettings.sk_menkumham !== undefined) updateData.sk_menkumham = additionalSettings.sk_menkumham;
          if (additionalSettings.logo_url !== undefined) updateData.logo_url = additionalSettings.logo_url;
          if (additionalSettings.bank_name !== undefined) updateData.bank_name = additionalSettings.bank_name;
          if (additionalSettings.bank_account !== undefined) updateData.bank_account = additionalSettings.bank_account;
          if (additionalSettings.bank_account_name !== undefined) updateData.bank_account_name = additionalSettings.bank_account_name;
          if (additionalSettings.phone !== undefined) updateData.phone = additionalSettings.phone;
          if (additionalSettings.email !== undefined) updateData.email = additionalSettings.email;
        }

        const effectiveId = tenant.id || tenantId;
        const { error: updateError } = await supabase.from('tenants').update(updateData).eq('id', effectiveId);

        if (updateError) {
          try {
            await supabase.from('tenants').update({ 
              company_name: additionalSettings?.company_name || tenant.company_name,
              name: additionalSettings?.company_name || tenant.company_name,
              address: additionalSettings?.address !== undefined ? additionalSettings.address : tenant.address
            }).eq('id', effectiveId);
          } catch {}
        }

        await this.fetchAndSyncAll();
      } catch (dbErr: any) {
        console.error('Supabase tenant update failed:', dbErr);
      } finally {
        this.notify();
      }
    } else {
      this.notify();
    }

    await this.addAuditLog(tenantId, updaterName, 'UPDATE_TENANT_SETTINGS', `Pengaturan kantor Notaris diperbarui oleh ${updaterName}`);
    return { ...tenant };
  }

  // --- USERS/EMPLOYEES MUTATIONS ---
  public async addUser(
    tenantId: string,
    username: string,
    name: string,
    role: 'FINANCE' | 'STAFF',
    email: string,
    password?: string,
    creatorName: string = 'Sistem'
  ): Promise<User> {
    await this.delay(200);

    const hexChars = '0123456789abcdef';
    let suffix = '';
    for (let i = 0; i < 12; i++) {
      suffix += hexChars[Math.floor(Math.random() * 16)];
    }
    const newUser: User = {
      id: `b0000000-0000-0000-0000-${suffix}`,
      tenant_id: tenantId,
      username: username.toLowerCase(),
      name,
      role,
      email,
      password: password || 'password123'
    };

    if (this.isSupabaseConfigured()) {
      const { data, error } = await supabase
        .from('users')
        .insert({
          id: newUser.id,
          tenant_id: tenantId,
          username: username.toLowerCase(),
          password_hash: password || 'password123',
          name,
          role,
          email
        })
        .select()
        .single();

      if (error) {
        console.error('Supabase error inserting user:', error);
        throw error;
      }
      if (data) {
        newUser.id = data.id;
      }
      await this.fetchAndSyncAll();
    } else {
      this.users.push(newUser);
      this.notify();
    }
    await this.addAuditLog(tenantId, creatorName, 'CREATE_USER', `Karyawan baru ditambahkan ke kantor Notaris: ${name} (${role})`);
    return newUser;
  }

  public async updateUser(
    tenantId: string,
    userId: string,
    name: string,
    role: 'FINANCE' | 'STAFF',
    email: string,
    password?: string,
    updaterName: string = 'Sistem'
  ): Promise<User> {
    await this.delay(200);

    const userIndex = this.users.findIndex(u => u.id === userId);
    if (userIndex === -1) throw new Error('Karyawan tidak ditemukan');

    const oldUser = this.users[userIndex];
    const updatedUser: User = {
      ...oldUser,
      name,
      role,
      email: email || oldUser.email,
      password: password || oldUser.password
    };

    if (this.isSupabaseConfigured()) {
      const { error } = await supabase
        .from('users')
        .update({
          name,
          role,
          email,
          password_hash: password || 'password123'
        })
        .eq('id', userId);

      if (error) {
        console.error('Supabase error updating user:', error);
        throw error;
      }
      await this.fetchAndSyncAll();
    } else {
      this.users[userIndex] = updatedUser;
      this.notify();
    }
    await this.addAuditLog(tenantId, updaterName, 'UPDATE_USER', `Data karyawan "${name}" diperbarui (${role})`);
    return updatedUser;
  }

  public async deleteUser(tenantId: string, userId: string, executorName: string): Promise<void> {
    await this.delay(150);

    const user = this.users.find(u => u.id === userId);
    if (!user) throw new Error('Karyawan tidak ditemukan');

    if (this.isSupabaseConfigured()) {
      const { error } = await supabase
        .from('users')
        .delete()
        .eq('id', userId);

      if (error) {
        console.error('Supabase error deleting user:', error);
        throw error;
      }
      await this.fetchAndSyncAll();
    } else {
      this.users = this.users.filter(u => u.id !== userId);
      this.notify();
    }
    await this.addAuditLog(tenantId, executorName, 'DELETE_USER', `Karyawan "${user.name}" dihapus dari kantor Notaris oleh ${executorName}`);
  }

  // --- ORDER TEMPLATES MUTATIONS ---
  public async addOrderTemplate(tenantId: string, name: string, checklistItems: string[], creatorName: string): Promise<any> {
    await this.delay(100);
    const newTmpl = {
      id: `tmpl-${Math.random().toString(36).substr(2, 9)}`,
      tenant_id: tenantId,
      name,
      checklists: checklistItems,
      checklist_items: checklistItems
    };

    if (this.isSupabaseConfigured()) {
      try {
        const { error } = await supabase.from('order_templates').insert({
          tenant_id: tenantId,
          name: name,
          checklists: checklistItems
        });

        if (error) {
          await supabase.from('order_templates').insert({
            tenant_id: tenantId,
            name: name,
            checklist_items: checklistItems
          });
        }
        await this.fetchAndSyncAll();
      } catch (err) {
        console.error("Error inserting order_template into Supabase:", err);
      }
    } else {
      this.orderTemplates.push(newTmpl);
      this.notify();
    }

    await this.addAuditLog(tenantId, creatorName, 'CREATE_ORDER_TEMPLATE', `Template order baru dibuat: "${name}" dengan ${checklistItems.length} checklist`);
    return newTmpl;
  }

  public async updateOrderTemplate(tenantId: string, tmplId: string, name: string, checklistItems: string[], updaterName: string): Promise<any> {
    await this.delay(100);
    const tmpl = this.orderTemplates.find(t => t.id === tmplId);
    if (!tmpl) throw new Error('Template tidak ditemukan');
    
    tmpl.name = name;
    tmpl.checklists = checklistItems;
    tmpl.checklist_items = checklistItems;

    if (this.isSupabaseConfigured()) {
      try {
        const { error } = await supabase.from('order_templates').update({
          name: name,
          checklists: checklistItems
        })
        .eq('id', tmplId)
        .eq('tenant_id', tenantId);

        if (error) {
          await supabase.from('order_templates').update({
            name: name,
            checklist_items: checklistItems
          })
          .eq('id', tmplId)
          .eq('tenant_id', tenantId);
        }
        await this.fetchAndSyncAll();
      } catch (err) {
        console.error("Error updating order_template in Supabase:", err);
      }
    } else {
      this.notify();
    }

    await this.addAuditLog(tenantId, updaterName, 'UPDATE_ORDER_TEMPLATE', `Template order "${name}" diperbarui`);
    return { ...tmpl };
  }

  public async deleteOrderTemplate(tenantId: string, tmplId: string, executorName: string): Promise<void> {
    await this.delay(100);
    const tmpl = this.orderTemplates.find(t => t.id === tmplId);
    const name = tmpl?.name || tmplId;

    if (this.isSupabaseConfigured()) {
      try {
        await supabase.from('order_templates')
          .delete()
          .eq('id', tmplId)
          .eq('tenant_id', tenantId);
        await this.fetchAndSyncAll();
      } catch (err) {
        console.error("Error deleting order_template from Supabase:", err);
      }
    } else {
      this.orderTemplates = this.orderTemplates.filter(t => t.id !== tmplId);
      this.notify();
    }

    await this.addAuditLog(tenantId, executorName, 'DELETE_ORDER_TEMPLATE', `Template order "${name}" dihapus`);
  }
}

// Singleton export
export const mockDb = new MockDatabaseStore();
