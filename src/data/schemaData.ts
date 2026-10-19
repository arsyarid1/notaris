export interface DbColumn {
  name: string;
  type: string;
  constraints: string[];
  description: string;
}

export interface DbTable {
  name: string;
  description: string;
  columns: DbColumn[];
  indexes: string[];
  rlsPolicies: {
    name: string;
    action: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'ALL';
    usingExp: string;
    withCheckExp?: string;
    description: string;
  }[];
}

export const TABLES_METADATA: DbTable[] = [
  {
    name: 'tenants',
    description: 'Menyimpan entitas kantor Notaris/PPAT (Tenant Utama). Isolasi data level tertinggi berbasis tenant.',
    columns: [
      { name: 'id', type: 'UUID', constraints: ['PRIMARY KEY', 'DEFAULT gen_random_uuid()'], description: 'ID unik tenant (UUID v4)' },
      { name: 'company_name', type: 'VARCHAR(255)', constraints: ['NOT NULL'], description: 'Nama kantor Notaris/PPAT' },
      { name: 'created_at', type: 'TIMESTAMP WITH TIME ZONE', constraints: ['DEFAULT CURRENT_TIMESTAMP'], description: 'Waktu pendaftaran tenant' }
    ],
    indexes: [
      'CREATE PRIMARY KEY INDEX'
    ],
    rlsPolicies: [
      {
        name: 'Superadmin full access / Tenant access read-only',
        action: 'SELECT',
        usingExp: 'id = current_setting(\'app.current_tenant_id\')::uuid',
        description: 'Setiap tenant hanya dapat melihat profil kantor mereka sendiri.'
      }
    ]
  },
  {
    name: 'users',
    description: 'Kredensial dan hak akses staf kantor Notaris. Terikat pada satu tenant_id.',
    columns: [
      { name: 'id', type: 'UUID', constraints: ['PRIMARY KEY', 'DEFAULT gen_random_uuid()'], description: 'ID unik user' },
      { name: 'tenant_id', type: 'UUID', constraints: ['NOT NULL', 'REFERENCES tenants(id) ON DELETE CASCADE'], description: 'Mengikat user pada kantor Notaris tertentu' },
      { name: 'username', type: 'VARCHAR(100)', constraints: ['NOT NULL', 'UNIQUE'], description: 'Username login unik' },
      { name: 'password_hash', type: 'VARCHAR(255)', constraints: ['NOT NULL'], description: 'Bcrypt hash password' },
      { name: 'name', type: 'VARCHAR(255)', constraints: ['NOT NULL'], description: 'Nama lengkap personil' },
      { name: 'role', type: 'VARCHAR(50)', constraints: ['NOT NULL', 'CHECK (role IN (\'NOTARIS\', \'FINANCE\', \'STAFF\'))'], description: 'Role otoritas kerja' }
    ],
    indexes: [
      'CREATE INDEX idx_users_tenant_id ON users(tenant_id);',
      'CREATE UNIQUE INDEX idx_users_username ON users(username);'
    ],
    rlsPolicies: [
      {
        name: 'tenant_isolation_policy',
        action: 'ALL',
        usingExp: 'tenant_id = current_setting(\'app.current_tenant_id\')::uuid',
        withCheckExp: 'tenant_id = current_setting(\'app.current_tenant_id\')::uuid',
        description: 'User hanya bisa mengakses data personil di kantornya sendiri.'
      }
    ]
  },
  {
    name: 'clients',
    description: 'Data klien yang berurusan dengan kantor Notaris (misal: pendiri PT, penjual/pembeli tanah).',
    columns: [
      { name: 'id', type: 'UUID', constraints: ['PRIMARY KEY', 'DEFAULT gen_random_uuid()'], description: 'ID unik klien' },
      { name: 'tenant_id', type: 'UUID', constraints: ['NOT NULL', 'REFERENCES tenants(id) ON DELETE CASCADE'], description: 'ID tenant pemilik data klien' },
      { name: 'name', type: 'VARCHAR(255)', constraints: ['NOT NULL'], description: 'Nama klien / nama instansi' },
      { name: 'email', type: 'VARCHAR(255)', constraints: [], description: 'Surel aktif klien' },
      { name: 'phone', type: 'VARCHAR(50)', constraints: [], description: 'Nomor telepon klien' },
      { name: 'assigned_to_user_id', type: 'UUID', constraints: ['REFERENCES users(id) ON DELETE SET NULL'], description: 'Staf/Notaris penanggung jawab klien' },
      { name: 'created_at', type: 'TIMESTAMP WITH TIME ZONE', constraints: ['DEFAULT CURRENT_TIMESTAMP'], description: 'Waktu pembuatan data klien' }
    ],
    indexes: [
      'CREATE INDEX idx_clients_tenant_id ON clients(tenant_id);',
      'CREATE INDEX idx_clients_assigned_user ON clients(assigned_to_user_id);'
    ],
    rlsPolicies: [
      {
        name: 'tenant_isolation_policy',
        action: 'ALL',
        usingExp: 'tenant_id = current_setting(\'app.current_tenant_id\')::uuid',
        withCheckExp: 'tenant_id = current_setting(\'app.current_tenant_id\')::uuid',
        description: 'Isolasi klien antar kantor Notaris secara mutlak.'
      }
    ]
  },
  {
    name: 'orders',
    description: 'Berkas atau orderan jasa hukum (misal: "Pendirian PT", "Warisan", "Akta Jual Beli").',
    columns: [
      { name: 'id', type: 'UUID', constraints: ['PRIMARY KEY', 'DEFAULT gen_random_uuid()'], description: 'ID unik orderan berkas' },
      { name: 'tenant_id', type: 'UUID', constraints: ['NOT NULL', 'REFERENCES tenants(id) ON DELETE CASCADE'], description: 'ID tenant pemilik orderan berkas' },
      { name: 'client_id', type: 'UUID', constraints: ['NOT NULL', 'REFERENCES clients(id) ON DELETE CASCADE'], description: 'Klien pemohon' },
      { name: 'title', type: 'VARCHAR(255)', constraints: ['NOT NULL'], description: 'Jenis akta / nama berkas (misal: Pendirian PT Maju Bersama)' },
      { name: 'status', type: 'VARCHAR(50)', constraints: ['NOT NULL', 'CHECK (status IN (\'PENDING\', \'ON_PROGRESS\', \'SIGNING\', \'INVOICED\', \'DONE\'))'], description: 'Siklus hidup pengerjaan berkas akta' },
      { name: 'created_at', type: 'TIMESTAMP WITH TIME ZONE', constraints: ['DEFAULT CURRENT_TIMESTAMP'], description: 'Waktu order dimasukkan' }
    ],
    indexes: [
      'CREATE INDEX idx_orders_tenant_id ON orders(tenant_id);',
      'CREATE INDEX idx_orders_client_id ON orders(client_id);',
      'CREATE INDEX idx_orders_status ON orders(status);'
    ],
    rlsPolicies: [
      {
        name: 'tenant_isolation_policy',
        action: 'ALL',
        usingExp: 'tenant_id = current_setting(\'app.current_tenant_id\')::uuid',
        withCheckExp: 'tenant_id = current_setting(\'app.current_tenant_id\')::uuid',
        description: 'Isolasi orderan antar kantor Notaris secara mutlak.'
      }
    ]
  },
  {
    name: 'tasks',
    description: 'Daftar langkah taktis penyelesaian akta dalam suatu order (misal: "Verifikasi Sertifikat", "Bayar PNBP").',
    columns: [
      { name: 'id', type: 'UUID', constraints: ['PRIMARY KEY', 'DEFAULT gen_random_uuid()'], description: 'ID unik tugas pengerjaan' },
      { name: 'tenant_id', type: 'UUID', constraints: ['NOT NULL', 'REFERENCES tenants(id) ON DELETE CASCADE'], description: 'ID tenant (Denormalisasi demi performa RLS langsung tanpa join)' },
      { name: 'order_id', type: 'UUID', constraints: ['NOT NULL', 'REFERENCES orders(id) ON DELETE CASCADE'], description: 'ID order induk' },
      { name: 'title', type: 'VARCHAR(255)', constraints: ['NOT NULL'], description: 'Judul tugas pengerjaan' },
      { name: 'description', type: 'TEXT', constraints: [], description: 'Detail instruksi atau rincian langkah kerja' },
      { name: 'assigned_to_user_id', type: 'UUID', constraints: ['REFERENCES users(id) ON DELETE SET NULL'], description: 'Staf pelaksana tugas' },
      { name: 'status', type: 'VARCHAR(50)', constraints: ['NOT NULL', 'CHECK (status IN (\'TODO\', \'ON_PROGRESS\', \'DONE\'))'], description: 'Status progres tugas' },
      { name: 'created_at', type: 'TIMESTAMP WITH TIME ZONE', constraints: ['DEFAULT CURRENT_TIMESTAMP'], description: 'Waktu pembuatan tugas' }
    ],
    indexes: [
      'CREATE INDEX idx_tasks_tenant_id ON tasks(tenant_id);',
      'CREATE INDEX idx_tasks_order_id ON tasks(order_id);',
      'CREATE INDEX idx_tasks_assigned_user ON tasks(assigned_to_user_id);'
    ],
    rlsPolicies: [
      {
        name: 'tenant_isolation_policy',
        action: 'ALL',
        usingExp: 'tenant_id = current_setting(\'app.current_tenant_id\')::uuid',
        withCheckExp: 'tenant_id = current_setting(\'app.current_tenant_id\')::uuid',
        description: 'Isolasi tugas pengerjaan antar kantor secara mutlak.'
      }
    ]
  },
  {
    name: 'checklists',
    description: 'Sub-tugas atau checklist pemenuhan dokumen dari suatu tugas utama.',
    columns: [
      { name: 'id', type: 'UUID', constraints: ['PRIMARY KEY', 'DEFAULT gen_random_uuid()'], description: 'ID unik checklist' },
      { name: 'tenant_id', type: 'UUID', constraints: ['NOT NULL', 'REFERENCES tenants(id) ON DELETE CASCADE'], description: 'ID tenant (Denormalisasi demi performa RLS langsung tanpa join)' },
      { name: 'task_id', type: 'UUID', constraints: ['NOT NULL', 'REFERENCES tasks(id) ON DELETE CASCADE'], description: 'ID tugas induk' },
      { name: 'item_name', type: 'VARCHAR(255)', constraints: ['NOT NULL'], description: 'Nama item persyaratan (misal: "Fotokopi KTP Pendiri")' },
      { name: 'is_checked', type: 'BOOLEAN', constraints: ['DEFAULT FALSE'], description: 'Status terpenuhi/centang' },
      { name: 'checked_by_user_id', type: 'UUID', constraints: ['REFERENCES users(id) ON DELETE SET NULL'], description: 'Staf verifikator berkas' },
      { name: 'checked_at', type: 'TIMESTAMP WITH TIME ZONE', constraints: [], description: 'Waktu verifikasi dilakukan' }
    ],
    indexes: [
      'CREATE INDEX idx_checklists_tenant_id ON checklists(tenant_id);',
      'CREATE INDEX idx_checklists_task_id ON checklists(task_id);'
    ],
    rlsPolicies: [
      {
        name: 'tenant_isolation_policy',
        action: 'ALL',
        usingExp: 'tenant_id = current_setting(\'app.current_tenant_id\')::uuid',
        withCheckExp: 'tenant_id = current_setting(\'app.current_tenant_id\')::uuid',
        description: 'Isolasi checklist akta antar kantor.'
      }
    ]
  },
  {
    name: 'documents',
    description: 'File draft akta, bukti setor, sertifikat tanah, atau dokumen final yang disimpan.',
    columns: [
      { name: 'id', type: 'UUID', constraints: ['PRIMARY KEY', 'DEFAULT gen_random_uuid()'], description: 'ID unik dokumen' },
      { name: 'tenant_id', type: 'UUID', constraints: ['NOT NULL', 'REFERENCES tenants(id) ON DELETE CASCADE'], description: 'ID tenant (Denormalisasi demi performa RLS langsung tanpa join)' },
      { name: 'task_id', type: 'UUID', constraints: ['NOT NULL', 'REFERENCES tasks(id) ON DELETE CASCADE'], description: 'Tugas yang membutuhkan dokumen' },
      { name: 'file_url', type: 'TEXT', constraints: ['NOT NULL'], description: 'Link penyimpanan cloud (S3 / Cloud Storage)' },
      { name: 'status', type: 'VARCHAR(50)', constraints: ['NOT NULL', 'CHECK (status IN (\'DRAFT\', \'NEED_REVIEW\', \'APPROVED\'))'], description: 'Status persetujuan draf akta' },
      { name: 'created_at', type: 'TIMESTAMP WITH TIME ZONE', constraints: ['DEFAULT CURRENT_TIMESTAMP'], description: 'Tanggal unggah dokumen' }
    ],
    indexes: [
      'CREATE INDEX idx_documents_tenant_id ON documents(tenant_id);',
      'CREATE INDEX idx_documents_task_id ON documents(task_id);'
    ],
    rlsPolicies: [
      {
        name: 'tenant_isolation_policy',
        action: 'ALL',
        usingExp: 'tenant_id = current_setting(\'app.current_tenant_id\')::uuid',
        withCheckExp: 'tenant_id = current_setting(\'app.current_tenant_id\')::uuid',
        description: 'Hanya staf bersangkutan yang bisa mengakses berkas draf akta tenant.'
      }
    ]
  },
  {
    name: 'document_comments',
    description: 'Komentar revisi pada draf akta dari Notaris ke Staf PPAT atau sebaliknya.',
    columns: [
      { name: 'id', type: 'UUID', constraints: ['PRIMARY KEY', 'DEFAULT gen_random_uuid()'], description: 'ID komentar' },
      { name: 'tenant_id', type: 'UUID', constraints: ['NOT NULL', 'REFERENCES tenants(id) ON DELETE CASCADE'], description: 'ID tenant (Denormalisasi demi performa RLS)' },
      { name: 'document_id', type: 'UUID', constraints: ['NOT NULL', 'REFERENCES documents(id) ON DELETE CASCADE'], description: 'ID dokumen yang dikomentari' },
      { name: 'user_id', type: 'UUID', constraints: ['NOT NULL', 'REFERENCES users(id) ON DELETE CASCADE'], description: 'ID pemberi komentar' },
      { name: 'comment', type: 'TEXT', constraints: ['NOT NULL'], description: 'Isi komentar revisi draf' },
      { name: 'created_at', type: 'TIMESTAMP WITH TIME ZONE', constraints: ['DEFAULT CURRENT_TIMESTAMP'], description: 'Waktu kirim komentar' }
    ],
    indexes: [
      'CREATE INDEX idx_doc_comments_tenant_id ON document_comments(tenant_id);',
      'CREATE INDEX idx_doc_comments_document_id ON document_comments(document_id);'
    ],
    rlsPolicies: [
      {
        name: 'tenant_isolation_policy',
        action: 'ALL',
        usingExp: 'tenant_id = current_setting(\'app.current_tenant_id\')::uuid',
        withCheckExp: 'tenant_id = current_setting(\'app.current_tenant_id\')::uuid',
        description: 'Membatasi diskusi draf akta internal agar tidak bocor antar kantor.'
      }
    ]
  },
  {
    name: 'appointments',
    description: 'Penjadwalan temu Notaris untuk tanda tangan akta / mediasi klien.',
    columns: [
      { name: 'id', type: 'UUID', constraints: ['PRIMARY KEY', 'DEFAULT gen_random_uuid()'], description: 'ID unik janji temu' },
      { name: 'tenant_id', type: 'UUID', constraints: ['NOT NULL', 'REFERENCES tenants(id) ON DELETE CASCADE'], description: 'ID tenant (Denormalisasi demi performa RLS)' },
      { name: 'order_id', type: 'UUID', constraints: ['NOT NULL', 'REFERENCES orders(id) ON DELETE CASCADE'], description: 'ID order berkas bersangkutan' },
      { name: 'notary_id', type: 'UUID', constraints: ['NOT NULL', 'REFERENCES users(id) ON DELETE CASCADE'], description: 'ID Notaris yang bersangkutan' },
      { name: 'date_time', type: 'TIMESTAMP WITH TIME ZONE', constraints: ['NOT NULL'], description: 'Tanggal dan jam janji temu' },
      { name: 'status', type: 'VARCHAR(50)', constraints: ['NOT NULL', 'CHECK (status IN (\'PROPOSED\', \'APPROVED\', \'REJECTED\'))'], description: 'Status persetujuan jadwal tanda tangan' }
    ],
    indexes: [
      'CREATE INDEX idx_appointments_tenant_id ON appointments(tenant_id);',
      'CREATE INDEX idx_appointments_order_id ON appointments(order_id);',
      'CREATE INDEX idx_appointments_notary_id ON appointments(notary_id);'
    ],
    rlsPolicies: [
      {
        name: 'tenant_isolation_policy',
        action: 'ALL',
        usingExp: 'tenant_id = current_setting(\'app.current_tenant_id\')::uuid',
        withCheckExp: 'tenant_id = current_setting(\'app.current_tenant_id\')::uuid',
        description: 'Membatasi kalender janji temu Notaris per kantor.'
      }
    ]
  },
  {
    name: 'invoices',
    description: 'Tagihan pembayaran jasa hukum akta kepada klien (DP, Pelunasan, atau Lunas).',
    columns: [
      { name: 'id', type: 'UUID', constraints: ['PRIMARY KEY', 'DEFAULT gen_random_uuid()'], description: 'ID unik tagihan' },
      { name: 'tenant_id', type: 'UUID', constraints: ['NOT NULL', 'REFERENCES tenants(id) ON DELETE CASCADE'], description: 'ID tenant (Denormalisasi demi performa RLS)' },
      { name: 'order_id', type: 'UUID', constraints: ['NOT NULL', 'REFERENCES orders(id) ON DELETE CASCADE'], description: 'ID berkas akta bersangkutan' },
      { name: 'amount', type: 'NUMERIC(15, 2)', constraints: ['NOT NULL', 'CHECK (amount >= 0)'], description: 'Nominal tagihan dalam Rupiah' },
      { name: 'payment_link', type: 'TEXT', constraints: [], description: 'Virtual Account / PG payment link' },
      { name: 'status', type: 'VARCHAR(50)', constraints: ['NOT NULL', 'CHECK (status IN (\'UNPAID\', \'PAID\', \'EXPIRED\'))'], description: 'Status pelunasan tagihan' },
      { name: 'billing_type', type: 'VARCHAR(50)', constraints: ['NOT NULL', 'CHECK (billing_type IN (\'DP\', \'PELUNASAN\', \'LUNAS\'))'], description: 'Jenis pembayaran tagihan' },
      { name: 'created_at', type: 'TIMESTAMP WITH TIME ZONE', constraints: ['DEFAULT CURRENT_TIMESTAMP'], description: 'Waktu penerbitan tagihan' }
    ],
    indexes: [
      'CREATE INDEX idx_invoices_tenant_id ON invoices(tenant_id);',
      'CREATE INDEX idx_invoices_order_id ON invoices(order_id);'
    ],
    rlsPolicies: [
      {
        name: 'tenant_isolation_policy_select',
        action: 'SELECT',
        usingExp: 'tenant_id = current_setting(\'app.current_tenant_id\')::uuid',
        description: 'Membatasi akses melihat keuangan internal per kantor.'
      },
      {
        name: 'tenant_isolation_policy_write_finance_notary',
        action: 'ALL',
        usingExp: 'tenant_id = current_setting(\'app.current_tenant_id\')::uuid AND (current_setting(\'app.current_user_role\') IN (\'NOTARIS\', \'FINANCE\'))',
        withCheckExp: 'tenant_id = current_setting(\'app.current_tenant_id\')::uuid AND (current_setting(\'app.current_user_role\') IN (\'NOTARIS\', \'FINANCE\'))',
        description: 'Hanya FINANCE dan NOTARIS yang boleh membuat, mengubah, dan menghapus invoice tagihan.'
      }
    ]
  },
  {
    name: 'audit_logs',
    description: 'Catatan jejak aktivitas krusial untuk akuntabilitas (keamanan & audit internal).',
    columns: [
      { name: 'id', type: 'UUID', constraints: ['PRIMARY KEY', 'DEFAULT gen_random_uuid()'], description: 'ID log' },
      { name: 'tenant_id', type: 'UUID', constraints: ['NOT NULL', 'REFERENCES tenants(id) ON DELETE CASCADE'], description: 'ID kantor Notaris yang melakukan aksi' },
      { name: 'user_id', type: 'UUID', constraints: ['REFERENCES users(id) ON DELETE SET NULL'], description: 'Pelaku aktivitas' },
      { name: 'action', type: 'VARCHAR(255)', constraints: ['NOT NULL'], description: 'Jenis aksi (misal: "SIGN_DOCUMENT", "CREATE_INVOICE")' },
      { name: 'description', type: 'TEXT', constraints: [], description: 'Narasi rincian perubahan data' },
      { name: 'created_at', type: 'TIMESTAMP WITH TIME ZONE', constraints: ['DEFAULT CURRENT_TIMESTAMP'], description: 'Waktu aksi dicatat' }
    ],
    indexes: [
      'CREATE INDEX idx_audit_logs_tenant_id ON audit_logs(tenant_id);',
      'CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);'
    ],
    rlsPolicies: [
      {
        name: 'audit_log_view_only',
        action: 'SELECT',
        usingExp: 'tenant_id = current_setting(\'app.current_tenant_id\')::uuid',
        description: 'User hanya bisa membaca catatan log aktivitas kantor mereka.'
      },
      {
        name: 'audit_log_insert_system',
        action: 'INSERT',
        usingExp: 'tenant_id = current_setting(\'app.current_tenant_id\')::uuid',
        withCheckExp: 'tenant_id = current_setting(\'app.current_tenant_id\')::uuid',
        description: 'Sistem otomatis merekam aktivitas dalam tenant bersangkutan.'
      }
    ]
  },
  {
    name: 'announcements',
    description: 'Pemberitahuan atau pengumuman internal kantor Notaris kepada stafnya.',
    columns: [
      { name: 'id', type: 'UUID', constraints: ['PRIMARY KEY', 'DEFAULT gen_random_uuid()'], description: 'ID pengumuman' },
      { name: 'tenant_id', type: 'UUID', constraints: ['NOT NULL', 'REFERENCES tenants(id) ON DELETE CASCADE'], description: 'ID tenant pengumuman' },
      { name: 'created_by', type: 'UUID', constraints: ['NOT NULL', 'REFERENCES users(id) ON DELETE CASCADE'], description: 'ID pembuat pengumuman' },
      { name: 'title', type: 'VARCHAR(255)', constraints: ['NOT NULL'], description: 'Judul pengumuman' },
      { name: 'content', type: 'TEXT', constraints: ['NOT NULL'], description: 'Konten/isi pengumuman' },
      { name: 'target_role', type: 'VARCHAR(50)', constraints: ['NOT NULL', 'CHECK (target_role IN (\'ALL\', \'FINANCE\', \'STAFF\'))'], description: 'Hak akses peran (misal: hanya untuk bagian Keuangan)' },
      { name: 'created_at', type: 'TIMESTAMP WITH TIME ZONE', constraints: ['DEFAULT CURRENT_TIMESTAMP'], description: 'Tanggal pengumuman diterbitkan' }
    ],
    indexes: [
      'CREATE INDEX idx_announcements_tenant_id ON announcements(tenant_id);'
    ],
    rlsPolicies: [
      {
        name: 'announcement_read_policy',
        action: 'SELECT',
        usingExp: 'tenant_id = current_setting(\'app.current_tenant_id\')::uuid AND (target_role = \'ALL\' OR target_role = current_setting(\'app.current_user_role\') OR current_setting(\'app.current_user_role\') = \'NOTARIS\')',
        description: 'Staf hanya bisa melihat pengumuman milik kantornya yang ditargetkan untuk role mereka atau ALL. Notaris bisa melihat semuanya.'
      },
      {
        name: 'announcement_write_notaris_only',
        action: 'ALL',
        usingExp: 'tenant_id = current_setting(\'app.current_tenant_id\')::uuid AND current_setting(\'app.current_user_role\') = \'NOTARIS\'',
        withCheckExp: 'tenant_id = current_setting(\'app.current_tenant_id\')::uuid AND current_setting(\'app.current_user_role\') = \'NOTARIS\'',
        description: 'Hanya pimpinan Notaris yang berhak merilis/menghapus pengumuman kantor.'
      }
    ]
  }
];

export const RAW_SQL_SCRIPT = `-- ==============================================================================
-- SKEMA DATABASE POSTGRESQL SAAS MANAJEMEN OPERASIONAL NOTARIS MULTI-TENANT
-- Perancang: Senior Backend Engineer
-- Fitur Utama: Isolasi Mutlak Tenant-Level menggunakan Row Level Security (RLS)
-- Target Database: PostgreSQL 14+
-- ==============================================================================

-- 0. AKTIFKAN EKSTENSI UNTUK GENERATOR UUID (Mencegah Enumeration Attack pada ID Multi-Tenant)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==============================================================================
-- 1. PEMBUATAN ENUM / DOMAIN (Batasan Integritas Data Konsisten)
-- ==============================================================================
CREATE TYPE user_role AS ENUM ('NOTARIS', 'FINANCE', 'STAFF');
CREATE TYPE order_status AS ENUM ('PENDING', 'ON_PROGRESS', 'SIGNING', 'INVOICED', 'DONE');
CREATE TYPE task_status AS ENUM ('TODO', 'ON_PROGRESS', 'DONE');
CREATE TYPE document_status AS ENUM ('DRAFT', 'NEED_REVIEW', 'APPROVED');
CREATE TYPE appointment_status AS ENUM ('PROPOSED', 'APPROVED', 'REJECTED');
CREATE TYPE invoice_status AS ENUM ('UNPAID', 'PAID', 'EXPIRED');
CREATE TYPE billing_type AS ENUM ('DP', 'PELUNASAN', 'LUNAS');
CREATE TYPE target_role_type AS ENUM ('ALL', 'FINANCE', 'STAFF');

-- ==============================================================================
-- 2. PEMBUATAN TABEL DAN KONSTRUKSI CONSTRAINT
-- ==============================================================================

-- 1. TABEL TENANTS (Kantor Notaris Utama)
CREATE TABLE tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- 2. TABEL USERS (Karyawan & Otoritas)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    username VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    role user_role NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- 3. TABEL CLIENTS (Klien Pemohon)
CREATE TABLE clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(50),
    assigned_to_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- 4. TABEL ORDERS (Berkas Akta / Order Kerja)
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    status order_status DEFAULT 'PENDING' NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- 5. TABEL TASKS (Prosedur Kerja Berkas Akta)
-- Desain Senior: Denormalisasi kolom tenant_id ditambahkan untuk performa RLS langsung tanpa JOIN yang lambat.
CREATE TABLE tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    assigned_to_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    status task_status DEFAULT 'TODO' NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- 6. TABEL CHECKLISTS (Sub-syarat Dokumen)
CREATE TABLE checklists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    item_name VARCHAR(255) NOT NULL,
    is_checked BOOLEAN DEFAULT FALSE NOT NULL,
    checked_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    checked_at TIMESTAMP WITH TIME ZONE
);

-- 7. TABEL DOCUMENTS (Unggahan Arsip / draf Akta)
CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    file_url TEXT NOT NULL,
    status document_status DEFAULT 'DRAFT' NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- 8. TABEL DOCUMENT_COMMENTS (Log Diskusi & Catatan Revisi)
CREATE TABLE document_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    comment TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- 9. TABEL APPOINTMENTS (Janji Temu / Jadwal Tanda Tangan Akta)
CREATE TABLE appointments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    notary_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date_time TIMESTAMP WITH TIME ZONE NOT NULL,
    status appointment_status DEFAULT 'PROPOSED' NOT NULL
);

-- 10. TABEL INVOICES (Sistem Tagihan & Keuangan)
CREATE TABLE invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    amount NUMERIC(15, 2) NOT NULL CHECK (amount >= 0),
    payment_link TEXT,
    status invoice_status DEFAULT 'UNPAID' NOT NULL,
    billing_type billing_type NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- 11. TABEL AUDIT_LOGS (Kepatuhan Keamanan & Audit)
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- 12. TABEL ANNOUNCEMENTS (Papan Pengumuman Internal Tenant)
CREATE TABLE announcements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    target_role target_role_type DEFAULT 'ALL' NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- ==============================================================================
-- 3. INDEKS KINERJA (Performance Tuning Level Senior)
-- ==============================================================================
-- Indeks diatur pada foreign key dan tenant_id karena filter WHERE tenant_id selalu 
-- dipicu di setiap kueri RLS demi menjamin performa sub-milidetik.

-- Indeks Tenant ID (Multi-Tenant Routing)
CREATE INDEX idx_users_tenant ON users(tenant_id);
CREATE INDEX idx_clients_tenant ON clients(tenant_id);
CREATE INDEX idx_orders_tenant ON orders(tenant_id);
CREATE INDEX idx_tasks_tenant ON tasks(tenant_id);
CREATE INDEX idx_checklists_tenant ON checklists(tenant_id);
CREATE INDEX idx_documents_tenant ON documents(tenant_id);
CREATE INDEX idx_doc_comments_tenant ON document_comments(tenant_id);
CREATE INDEX idx_appointments_tenant ON appointments(tenant_id);
CREATE INDEX idx_invoices_tenant ON invoices(tenant_id);
CREATE INDEX idx_audit_logs_tenant ON audit_logs(tenant_id);
CREATE INDEX idx_announcements_tenant ON announcements(tenant_id);

-- Indeks Pencarian Operasional (Optimasi Join & Pencarian)
CREATE INDEX idx_orders_client ON orders(client_id);
CREATE INDEX idx_tasks_order ON tasks(order_id);
CREATE INDEX idx_documents_task ON documents(task_id);
CREATE INDEX idx_appointments_order ON appointments(order_id);
CREATE INDEX idx_invoices_order ON invoices(order_id);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at DESC);

-- ==============================================================================
-- 4. IMPLEMENTASI ROW LEVEL SECURITY (RLS) & ISOLASI TENANT
-- ==============================================================================
-- Kami menggunakan session variables PostgreSQL 'app.current_tenant_id' dan 
-- 'app.current_user_role' yang dikonfigurasi saat koneksi server database terjalin 
-- (misal: SET LOCAL app.current_tenant_id = 'xxx' di dalam transaksi).

-- Mengaktifkan RLS di Seluruh Tabel Multi-Tenant (Kecuali tabel tenants itu sendiri, 
-- namun tabel tenants tetap diberi RLS agar admin tenant hanya melihat baris tenant miliknya).
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- DEKLARASI POLICIES (KEBIJAKAN RLS)
-- ------------------------------------------------------------------------------

-- Kebijakan untuk tabel Tenants (Mencegah tenant melihat tenant kompetitor)
CREATE POLICY tenant_self_read ON tenants
    FOR SELECT
    USING (id = NULLIF(current_setting('app.current_tenant_id', true), '')::UUID);

-- Kebijakan Umum Isolasi Tenant untuk Tabel: users, clients, orders, tasks, checklists, documents, document_comments, appointments
-- Memungkinkan operasi CRUD hanya jika tenant_id cocok dengan session tenant_id.
CREATE POLICY rls_tenant_users ON users
    FOR ALL
    USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::UUID)
    WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::UUID);

CREATE POLICY rls_tenant_clients ON clients
    FOR ALL
    USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::UUID)
    WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::UUID);

CREATE POLICY rls_tenant_orders ON orders
    FOR ALL
    USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::UUID)
    WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::UUID);

CREATE POLICY rls_tenant_tasks ON tasks
    FOR ALL
    USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::UUID)
    WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::UUID);

CREATE POLICY rls_tenant_checklists ON checklists
    FOR ALL
    USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::UUID)
    WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::UUID);

CREATE POLICY rls_tenant_documents ON documents
    FOR ALL
    USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::UUID)
    WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::UUID);

CREATE POLICY rls_tenant_comments ON document_comments
    FOR ALL
    USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::UUID)
    WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::UUID);

CREATE POLICY rls_tenant_appointments ON appointments
    FOR ALL
    USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::UUID)
    WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::UUID);

-- Kebijakan Terpilih RLS untuk INVOICES (Pemberian Otoritas Peran)
-- Semua personil tenant bisa melihat invoice (SELECT), tapi hanya FINANCE dan NOTARIS yang boleh menulis (INSERT, UPDATE, DELETE).
CREATE POLICY rls_invoice_select ON invoices
    FOR SELECT
    USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::UUID);

CREATE POLICY rls_invoice_write ON invoices
    FOR ALL
    USING (
        tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::UUID
        AND NULLIF(current_setting('app.current_user_role', true), '')::user_role IN ('NOTARIS', 'FINANCE')
    )
    WITH CHECK (
        tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::UUID
        AND NULLIF(current_setting('app.current_user_role', true), '')::user_role IN ('NOTARIS', 'FINANCE')
    );

-- Kebijakan Terpilih RLS untuk AUDIT_LOGS
-- Semua log bersifat READ-ONLY untuk staf di tenant bersangkutan. INSERT diperbolehkan oleh sistem.
CREATE POLICY rls_audit_select ON audit_logs
    FOR SELECT
    USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::UUID);

CREATE POLICY rls_audit_insert ON audit_logs
    FOR INSERT
    WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::UUID);

-- Kebijakan Terpilih RLS untuk ANNOUNCEMENTS (Role-based Targeted Read)
-- Pembacaan: Sesuai target_role atau jika pembaca adalah NOTARIS (pimpinan).
CREATE POLICY rls_announcement_select ON announcements
    FOR SELECT
    USING (
        tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::UUID
        AND (
            target_role = 'ALL' 
            OR target_role::text = NULLIF(current_setting('app.current_user_role', true), '')
            OR NULLIF(current_setting('app.current_user_role', true), '') = 'NOTARIS'
        )
    );

-- Penulisan: Hanya NOTARIS yang berwenang membuat/mengedit papan pengumuman.
CREATE POLICY rls_announcement_write ON announcements
    FOR ALL
    USING (
        tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::UUID
        AND NULLIF(current_setting('app.current_user_role', true), '') = 'NOTARIS'
    )
    WITH CHECK (
        tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::UUID
        AND NULLIF(current_setting('app.current_user_role', true), '') = 'NOTARIS'
    );

-- ==============================================================================
-- 5. TRIGGER OTOMATISASI KEPATUHAN (AUDIT TRAIL GENERATOR)
-- ==============================================================================
-- Memastikan setiap ada perubahan kritis (misal: invoice lunas, berkas akta disetujui),
-- database otomatis mencatat riwayat perubahan tersebut ke tabel audit_logs.

CREATE OR REPLACE FUNCTION log_critical_invoice_changes()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'UPDATE') THEN
        IF (NEW.status <> OLD.status) THEN
            INSERT INTO audit_logs (tenant_id, user_id, action, description)
            VALUES (
                NEW.tenant_id,
                NULLIF(current_setting('app.current_user_id', true), '')::UUID,
                'UPDATE_INVOICE_STATUS',
                'Status tagihan ' || NEW.id || ' untuk order berkas ' || NEW.order_id || ' diubah dari ' || OLD.status || ' menjadi ' || NEW.status
            );
        END IF;
    ELSIF (TG_OP = 'INSERT') THEN
        INSERT INTO audit_logs (tenant_id, user_id, action, description)
        VALUES (
            NEW.tenant_id,
            NULLIF(current_setting('app.current_user_id', true), '')::UUID,
            'CREATE_INVOICE',
            'Penerbitan tagihan baru sebesar Rp ' || TO_CHAR(NEW.amount, '999,999,999') || ' dengan tipe billing ' || NEW.billing_type
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_audit_invoices
    AFTER INSERT OR UPDATE ON invoices
    FOR EACH ROW EXECUTE FUNCTION log_critical_invoice_changes();

-- ==============================================================================
-- 6. DUMMY DATA SEEDING (Untuk Uji Coba Isolasi Tenant)
-- ==============================================================================

-- Seed 1: Pendaftaran 2 Kantor Notaris (Tenant)
INSERT INTO tenants (id, company_name) VALUES
('a0000000-0000-0000-0000-000000000001', 'Kantor Notaris Sutra Oktaviani, S.H., M.Kn.'),
('a0000000-0000-0000-0000-000000000002', 'Notaris & PPAT Maria Siregar, S.H.');

-- Seed 2: Pendaftaran Users (Personil Tenant 1 & 2)
-- Password hash menggunakan simulasi placeholder '$2b$12$...hash'
INSERT INTO users (id, tenant_id, username, password_hash, name, role) VALUES
-- Tenant 1 (Notaris Sutra Oktaviani)
('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'sutra_oktaviani', '$2b$12$R1E2y3...', 'Sutra Oktaviani, S.H., M.Kn.', 'NOTARIS'),
('b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'budi_staff', '$2b$12$K3J4h5...', 'Budi Santoso', 'STAFF'),
('b0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'citra_finance', '$2b$12$P5O6i7...', 'Citra Lestari, S.E.', 'FINANCE'),
-- Tenant 2 (Notaris Maria Siregar)
('b0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000002', 'maria_siregar', '$2b$12$M1N2o3...', 'Maria Siregar, S.H.', 'NOTARIS'),
('b0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000002', 'doni_staff', '$2b$12$L4K5j6...', 'Doni Pratama', 'STAFF'),
('b0000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000002', 'elisa_finance', '$2b$12$Y7X8w9...', 'Elisa Anggraini', 'FINANCE');

-- Seed 3: Klien Pemohon per Tenant
INSERT INTO clients (id, tenant_id, name, email, phone, assigned_to_user_id) VALUES
-- Tenant 1
('c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'PT Maju Bersama', 'info@majubersama.com', '08123456789', 'b0000000-0000-0000-0000-000000000002'),
('c0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'Siti Rahmawati', 'siti.rahma@gmail.com', '08129876543', 'b0000000-0000-0000-0000-000000000001'),
('c0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'CV Sumber Rejeki', 'sumberrejeki@outlook.com', '08132435465', 'b0000000-0000-0000-0000-000000000002');

-- Seed 4: Berkas Orderan Akta per Tenant
INSERT INTO orders (id, tenant_id, client_id, title, status) VALUES
-- Tenant 1
('d0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'Pendirian PT Maju Bersama (Sektor Kontraktor)', 'ON_PROGRESS'),
('d0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002', 'Akta Jual Beli Tanah Warisan', 'PENDING'),
-- Tenant 2
('d0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000003', 'Pendirian CV Sumber Rejeki (Perdagangan Umum)', 'SIGNING');

-- Seed 5: Tugas Kerja Akta
INSERT INTO tasks (id, tenant_id, order_id, title, description, assigned_to_user_id, status) VALUES
-- Tenant 1 (Sutra Oktaviani)
('e0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'Pengecekan Nama Perusahaan di SABH', 'Memastikan nama PT Maju Bersama belum terdaftar di Kemenkumham', 'b0000000-0000-0000-0000-000000000002', 'DONE'),
('e0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'Penyusunan Draft Akta Pendirian', 'Memasukkan data modal dan jajaran pemegang saham/pengurus', 'b0000000-0000-0000-0000-000000000002', 'ON_PROGRESS'),
-- Tenant 2 (Maria Siregar)
('e0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000003', 'Pencocokan Data Anggaran Dasar CV', 'Verifikasi KTP para sekutu aktif dan pasif', 'b0000000-0000-0000-0000-000000000005', 'ON_PROGRESS');

-- Seed 6: Invoices Pembayaran Akta
INSERT INTO invoices (id, tenant_id, order_id, amount, payment_link, status, billing_type) VALUES
-- Tenant 1 (Sutra Oktaviani)
('f0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 5000000.00, 'https://pay.notaris.io/inv-0012', 'PAID', 'DP'),
('f0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 7500000.00, 'https://pay.notaris.io/inv-0013', 'UNPAID', 'PELUNASAN'),
-- Tenant 2 (Maria Siregar)
('f0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000003', 6000000.00, 'https://pay.notaris.io/inv-0014', 'UNPAID', 'LUNAS');

-- Seed 7: Papan Pengumuman Kantor
INSERT INTO announcements (id, tenant_id, created_by, title, content, target_role) VALUES
-- Tenant 1
('g0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'Rapat Koordinasi Mingguan Berkas AJB', 'Dimohon seluruh staf menghadiri rapat hari Senin pukul 09.00 WIB terkait percepatan verifikasi berkas AJB warisan.', 'ALL'),
('g0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'Protokol Pelaporan Keuangan PNBP', 'Staf keuangan wajib menyetorkan log PNBP sebelum tanggal 25 setiap bulannya.', 'FINANCE'),
-- Tenant 2
('g0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000004', 'Cuti Bersama Tahun Baru Hijriah', 'Kantor diliburkan dari tanggal 15 hingga 17 Juli.', 'ALL');

-- ==============================================================================
-- CONTOH SIMULASI PENGGUNAAN OLEH APLIKASI BACKEND (Node.js/Go/Python)
-- ==============================================================================
/*
  -- Langkah 1: Server melakukan koneksi database menggunakan connection pool.
  -- Langkah 2: Ketika request masuk dari User Budi Santoso (Tenant 1, STAFF),
  --           Server memulai transaksi SQL dan mengatur session context:
  
  BEGIN;
  SET LOCAL app.current_tenant_id = 'a0000000-0000-0000-0000-000000000001';
  SET LOCAL app.current_user_id = 'b0000000-0000-0000-0000-000000000002';
  SET LOCAL app.current_user_role = 'STAFF';

  -- Langkah 3: Eksekusi kueri bisnis biasa tanpa menambahkan filter 'WHERE tenant_id = ...' manual!
  SELECT * FROM clients; -- Hanya mengembalikan PT Maju Bersama & Siti Rahmawati! CV Sumber Rejeki (Tenant 2) disembunyikan otomatis oleh RLS.
  
  SELECT * FROM invoices; -- Mengembalikan invoice DP & Pelunasan PT Maju Bersama.
  
  -- Skenario Coba Bypass Peran (Budi berupaya menghapus invoice finansial):
  DELETE FROM invoices WHERE id = 'f0000000-0000-0000-0000-000000000001'; 
  --> ERROR: new row violates row-level security policy for "invoices" (Karena peran STAFF tidak diizinkan menulis invoice di policy rls_invoice_write)
  
  COMMIT;
*/
`;

// Simulated Databases for Mock Querying in React Frontend
export interface Tenant {
  id: string;
  company_name: string;
  created_at: string;
  mayar_api_key?: string;
  address?: string;
  sk_menkumham?: string;
  logo_url?: string;
  bank_name?: string;
  bank_account?: string;
  bank_account_name?: string;
  phone?: string;
  email?: string;
}

export interface User {
  id: string;
  tenant_id: string;
  username: string;
  name: string;
  role: 'NOTARIS' | 'FINANCE' | 'STAFF';
  email?: string;
  password?: string;
}

export interface Client {
  id: string;
  tenant_id: string;
  name: string;
  email: string;
  phone: string;
  assigned_to_user_name: string;
}

export interface Order {
  id: string;
  tenant_id: string;
  client_id: string;
  client_name: string;
  title: string;
  status: 'PENDING' | 'ON_PROGRESS' | 'SIGNING' | 'INVOICED' | 'DONE';
  created_at: string;
}

export interface Task {
  id: string;
  tenant_id: string;
  order_id: string;
  order_title: string;
  title: string;
  description: string;
  assigned_to_user_name: string;
  status: 'TODO' | 'ON_PROGRESS' | 'DONE';
}

export interface Invoice {
  id: string;
  tenant_id: string;
  order_id: string;
  order_title: string;
  amount: number;
  payment_link: string;
  status: 'UNPAID' | 'PAID' | 'EXPIRED';
  billing_type: 'DP' | 'PELUNASAN' | 'LUNAS';
  created_at: string;
  gateway_disabled?: boolean;
  invoice_number?: string;
  sequence_number?: number;
  due_date?: string;
}

export interface AuditLog {
  id: string;
  tenant_id: string;
  user_name: string;
  action: string;
  description: string;
  created_at: string;
}

export interface Announcement {
  id: string;
  tenant_id: string;
  created_by_name: string;
  title: string;
  content: string;
  target_role: 'ALL' | 'FINANCE' | 'STAFF';
  created_at: string;
}

export interface ChecklistItem {
  id: string;
  tenant_id: string;
  task_id: string;
  item_name: string;
  is_checked: boolean;
  checked_by_user_id: string | null;
  checked_by_user_name: string | null;
  checked_at: string | null;
}

export interface DocumentItem {
  id: string;
  tenant_id: string;
  task_id: string;
  file_url: string;
  status: 'DRAFT' | 'NEED_REVIEW' | 'APPROVED';
  created_at: string;
}

export interface DocumentComment {
  id: string;
  tenant_id: string;
  document_id: string;
  user_id: string;
  user_name: string;
  comment: string;
  created_at: string;
}

export interface Appointment {
  id: string;
  tenant_id: string;
  order_id: string;
  order_title: string;
  notary_id: string;
  notary_name: string;
  date_time: string;
  status: 'PROPOSED' | 'APPROVED' | 'REJECTED' | 'RESCHEDULED';
}

export const MOCK_TENANTS: Tenant[] = [
  { 
    id: 'a0000000-0000-0000-0000-000000000001', 
    company_name: 'Kantor Notaris Sutra Oktaviani, S.H., M.Kn.', 
    created_at: '2026-01-10T08:00:00Z',
    address: 'Ruko Sentra Niaga Blok C No. 24, Kuningan, Jakarta Selatan',
    sk_menkumham: 'AHU-00922.AH.02.01',
    logo_url: 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?auto=format&fit=crop&w=120&h=120&q=80',
    bank_name: 'Bank Central Asia (BCA)',
    bank_account: '109-880-9221',
    bank_account_name: 'KANTOR NOTARIS SUTRA OKTAVIANI'
  },
  { 
    id: 'a0000000-0000-0000-0000-000000000002', 
    company_name: 'Notaris & PPAT Maria Siregar, S.H.', 
    created_at: '2026-02-15T09:30:00Z',
    address: 'Jl. Jenderal Sudirman Kav. 21, Karet Tengsin, Jakarta Pusat',
    sk_menkumham: '', // Empty on purpose to trigger the admin warning requirement!
    logo_url: '',
    bank_name: 'Bank Mandiri',
    bank_account: '132-00-2491-8890',
    bank_account_name: 'MARIA SIREGAR NOTARIS'
  },
  { 
    id: 'a0000000-0000-0000-0000-000000000003', 
    company_name: 'Kantor Notaris Yusuf Wijaya, S.H., M.H.', 
    created_at: '2026-03-20T10:00:00Z',
    address: '', // Empty on purpose
    sk_menkumham: 'AHU-00145.AH.01.02',
    logo_url: '',
    bank_name: 'Bank Rakyat Indonesia (BRI)',
    bank_account: '', // Empty on purpose
    bank_account_name: ''
  }
];

export const MOCK_USERS: User[] = [
  // Tenant 1
  { id: 'b0000000-0000-0000-0000-000000000001', tenant_id: 'a0000000-0000-0000-0000-000000000001', username: 'sutra_oktaviani', name: 'Sutra Oktaviani, S.H., M.Kn.', role: 'NOTARIS', email: 'sutra@kantornotaris.com', password: 'password123' },
  { id: 'b0000000-0000-0000-0000-000000000002', tenant_id: 'a0000000-0000-0000-0000-000000000001', username: 'budi_staff', name: 'Budi Santoso', role: 'STAFF', email: 'budi@kantornotaris.com', password: 'password123' },
  { id: 'b0000000-0000-0000-0000-000000000003', tenant_id: 'a0000000-0000-0000-0000-000000000001', username: 'citra_finance', name: 'Citra Lestari, S.E.', role: 'FINANCE', email: 'citra@kantornotaris.com', password: 'password123' },
  // Tenant 2
  { id: 'b0000000-0000-0000-0000-000000000004', tenant_id: 'a0000000-0000-0000-0000-000000000002', username: 'maria_siregar', name: 'Maria Siregar, S.H.', role: 'NOTARIS', email: 'maria@kantornotaris.com', password: 'password123' },
  { id: 'b0000000-0000-0000-0000-000000000005', tenant_id: 'a0000000-0000-0000-0000-000000000002', username: 'doni_staff', name: 'Doni Pratama', role: 'STAFF', email: 'doni@kantornotaris.com', password: 'password123' },
  { id: 'b0000000-0000-0000-0000-000000000006', tenant_id: 'a0000000-0000-0000-0000-000000000002', username: 'elisa_finance', name: 'Elisa Anggraini', role: 'FINANCE', email: 'elisa@kantornotaris.com', password: 'password123' },
  // Tenant 3 (Empty tenant to test complete isolation of zero data)
  { id: 'b0000000-0000-0000-0000-000000000007', tenant_id: 'a0000000-0000-0000-0000-000000000003', username: 'yusuf_notaris', name: 'Yusuf Wijaya, S.H., M.H.', role: 'NOTARIS', email: 'yusuf@kantornotaris.com', password: 'password123' }
];

export const MOCK_CLIENTS: Client[] = [
  // Tenant 1
  { id: 'c0000000-0000-0000-0000-000000000001', tenant_id: 'a0000000-0000-0000-0000-000000000001', name: 'PT Maju Bersama', email: 'info@majubersama.com', phone: '08123456789', assigned_to_user_name: 'Budi Santoso' },
  { id: 'c0000000-0000-0000-0000-000000000002', tenant_id: 'a0000000-0000-0000-0000-000000000001', name: 'Siti Rahmawati', email: 'siti.rahma@gmail.com', phone: '08129876543', assigned_to_user_name: 'Sutra Oktaviani, S.H., M.Kn.' },
  { id: 'c0000000-0000-0000-0000-000000000003', tenant_id: 'a0000000-0000-0000-0000-000000000001', name: 'CV Sumber Rejeki', email: 'sumberrejeki@outlook.com', phone: '08132435465', assigned_to_user_name: 'Budi Santoso' }
];

export const MOCK_ORDERS: Order[] = [
  // Tenant 1
  { id: 'd0000000-0000-0000-0000-000000000001', tenant_id: 'a0000000-0000-0000-0000-000000000001', client_id: 'c0000000-0000-0000-0000-000000000001', client_name: 'PT Maju Bersama', title: 'Pendirian PT Maju Bersama (Sektor Kontraktor)', status: 'ON_PROGRESS', created_at: '2026-07-01T10:00:00Z' },
  { id: 'd0000000-0000-0000-0000-000000000002', tenant_id: 'a0000000-0000-0000-0000-000000000001', client_id: 'c0000000-0000-0000-0000-000000000002', client_name: 'Siti Rahmawati', title: 'Akta Jual Beli Tanah Warisan', status: 'PENDING', created_at: '2026-07-05T14:30:00Z' },
  // Tenant 2
  { id: 'd0000000-0000-0000-0000-000000000003', tenant_id: 'a0000000-0000-0000-0000-000000000002', client_id: 'c0000000-0000-0000-0000-000000000003', client_name: 'CV Sumber Rejeki', title: 'Pendirian CV Sumber Rejeki (Perdagangan Umum)', status: 'SIGNING', created_at: '2026-07-03T11:15:00Z' }
];

export const MOCK_TASKS: Task[] = [
  // Tenant 1
  { id: 'e0000000-0000-0000-0000-000000000001', tenant_id: 'a0000000-0000-0000-0000-000000000001', order_id: 'd0000000-0000-0000-0000-000000000001', order_title: 'Pendirian PT Maju Bersama', title: 'Pengecekan Nama Perusahaan di SABH', description: 'Memastikan nama PT Maju Bersama belum terdaftar di Kemenkumham', assigned_to_user_name: 'Budi Santoso', status: 'DONE' },
  { id: 'e0000000-0000-0000-0000-000000000002', tenant_id: 'a0000000-0000-0000-0000-000000000001', order_id: 'd0000000-0000-0000-0000-000000000001', order_title: 'Pendirian PT Maju Bersama', title: 'Penyusunan Draft Akta Pendirian', description: 'Memasukkan data modal dan jajaran pemegang saham/pengurus', assigned_to_user_name: 'Budi Santoso', status: 'ON_PROGRESS' },
  // Tenant 2
  { id: 'e0000000-0000-0000-0000-000000000003', tenant_id: 'a0000000-0000-0000-0000-000000000002', order_id: 'd0000000-0000-0000-0000-000000000003', order_title: 'Pendirian CV Sumber Rejeki', title: 'Pencocokan Data Anggaran Dasar CV', description: 'Verifikasi KTP para sekutu aktif dan pasif', assigned_to_user_name: 'Doni Pratama', status: 'ON_PROGRESS' }
];

export const MOCK_INVOICES: Invoice[] = [
  // Tenant 1
  { id: 'f0000000-0000-0000-0000-000000000001', tenant_id: 'a0000000-0000-0000-0000-000000000001', order_id: 'd0000000-0000-0000-0000-000000000001', order_title: 'Pendirian PT Maju Bersama', amount: 5000000, payment_link: 'https://pay.notaris.io/inv-0012', status: 'PAID', billing_type: 'DP', created_at: '2026-07-01T10:30:00Z' },
  { id: 'f0000000-0000-0000-0000-000000000002', tenant_id: 'a0000000-0000-0000-0000-000000000001', order_id: 'd0000000-0000-0000-0000-000000000001', order_title: 'Pendirian PT Maju Bersama', amount: 7500000, payment_link: 'https://pay.notaris.io/inv-0013', status: 'UNPAID', billing_type: 'PELUNASAN', created_at: '2026-07-10T11:00:00Z' },
  // Tenant 2
  { id: 'f0000000-0000-0000-0000-000000000003', tenant_id: 'a0000000-0000-0000-0000-000000000002', order_id: 'd0000000-0000-0000-0000-000000000003', order_title: 'Pendirian CV Sumber Rejeki', amount: 6000000, payment_link: 'https://pay.notaris.io/inv-0014', status: 'UNPAID', billing_type: 'LUNAS', created_at: '2026-07-03T11:30:00Z' }
];

export const MOCK_AUDIT_LOGS: AuditLog[] = [
  // Tenant 1
  { id: 'l1', tenant_id: 'a0000000-0000-0000-0000-000000000001', user_name: 'Citra Lestari, S.E.', action: 'CREATE_INVOICE', description: 'Penerbitan tagihan uang muka DP sebesar Rp 5.000.000 untuk Pendirian PT Maju Bersama', created_at: '2026-07-01T10:31:00Z' },
  { id: 'l2', tenant_id: 'a0000000-0000-0000-0000-000000000001', user_name: 'Citra Lestari, S.E.', action: 'UPDATE_INVOICE_STATUS', description: 'Status tagihan f0000000-0000-0000-0000-000000000001 diubah dari UNPAID menjadi PAID', created_at: '2026-07-02T09:15:00Z' },
  { id: 'l3', tenant_id: 'a0000000-0000-0000-0000-000000000001', user_name: 'Sutra Oktaviani, S.H., M.Kn.', action: 'APPROVE_DRAFT_AKTA', description: 'Notaris menyetujui draf akta Pendirian PT Maju Bersama v1.pdf', created_at: '2026-07-11T16:45:00Z' },
  // Tenant 2
  { id: 'l4', tenant_id: 'a0000000-0000-0000-0000-000000000002', user_name: 'Elisa Anggraini', action: 'CREATE_INVOICE', description: 'Penerbitan tagihan lunas sebesar Rp 6.000.000 untuk Pendirian CV Sumber Rejeki', created_at: '2026-07-03T11:31:00Z' }
];

export const MOCK_ANNOUNCEMENTS: Announcement[] = [
  // Tenant 1
  { id: 'g1', tenant_id: 'a0000000-0000-0000-0000-000000000001', created_by_name: 'Sutra Oktaviani, S.H., M.Kn.', title: 'Rapat Koordinasi Mingguan Berkas AJB', content: 'Dimohon seluruh staf menghadiri rapat hari Senin pukul 09.00 WIB terkait percepatan verifikasi berkas AJB warisan.', target_role: 'ALL', created_at: '2026-07-10T08:00:00Z' },
  { id: 'g2', tenant_id: 'a0000000-0000-0000-0000-000000000001', created_by_name: 'Sutra Oktaviani, S.H., M.Kn.', title: 'Protokol Pelaporan Keuangan PNBP', content: 'Staf keuangan wajib menyetorkan log PNBP sebelum tanggal 25 setiap bulannya.', target_role: 'FINANCE', created_at: '2026-07-11T09:00:00Z' },
  // Tenant 2
  { id: 'g3', tenant_id: 'a0000000-0000-0000-0000-000000000002', created_by_name: 'Maria Siregar, S.H.', title: 'Cuti Bersama Tahun Baru Hijriah', content: 'Kantor diliburkan dari tanggal 15 hingga 17 Juli.', target_role: 'ALL', created_at: '2026-07-11T10:00:00Z' }
];

export const MOCK_CHECKLISTS: ChecklistItem[] = [
  { id: 'chk-1', tenant_id: 'a0000000-0000-0000-0000-000000000001', task_id: 'e0000000-0000-0000-0000-000000000001', item_name: 'Pengecekan nama PT di portal Kemenkumham', is_checked: true, checked_by_user_id: 'b0000000-0000-0000-0000-000000000002', checked_by_user_name: 'Budi Santoso', checked_at: '2026-07-01T14:00:00Z' },
  { id: 'chk-2', tenant_id: 'a0000000-0000-0000-0000-000000000001', task_id: 'e0000000-0000-0000-0000-000000000001', item_name: 'Pembayaran biaya PNBP cek nama', is_checked: true, checked_by_user_id: 'b0000000-0000-0000-0000-000000000002', checked_by_user_name: 'Budi Santoso', checked_at: '2026-07-01T15:30:00Z' },
  { id: 'chk-3', tenant_id: 'a0000000-0000-0000-0000-000000000001', task_id: 'e0000000-0000-0000-0000-000000000002', item_name: 'Identitas lengkap KTP para pendiri', is_checked: true, checked_by_user_id: 'b0000000-0000-0000-0000-000000000002', checked_by_user_name: 'Budi Santoso', checked_at: '2026-07-02T10:00:00Z' },
  { id: 'chk-4', tenant_id: 'a0000000-0000-0000-0000-000000000001', task_id: 'e0000000-0000-0000-0000-000000000002', item_name: 'Input data modal dasar & ditempatkan', is_checked: false, checked_by_user_id: null, checked_by_user_name: null, checked_at: null },
  { id: 'chk-5', tenant_id: 'a0000000-0000-0000-0000-000000000001', task_id: 'e0000000-0000-0000-0000-000000000002', item_name: 'NPWP para pemegang saham', is_checked: false, checked_by_user_id: null, checked_by_user_name: null, checked_at: null }
];

export const MOCK_DOCUMENTS: DocumentItem[] = [
  { id: 'doc-1', tenant_id: 'a0000000-0000-0000-0000-000000000001', task_id: 'e0000000-0000-0000-0000-000000000002', file_url: 'https://storage.supabase.co/lexnotary/PT-Maju-Bersama-Draft-v1.pdf', status: 'NEED_REVIEW', created_at: '2026-07-10T15:00:00Z' }
];

export const MOCK_DOCUMENT_COMMENTS: DocumentComment[] = [
  { id: 'com-1', tenant_id: 'a0000000-0000-0000-0000-000000000001', document_id: 'doc-1', user_id: 'b0000000-0000-0000-0000-000000000001', user_name: 'Sutra Oktaviani, S.H., M.Kn.', comment: 'Tolong sesuaikan lagi porsi modal dasar PT Maju Bersama, pasalnya tertulis Rp 10 Miliar, tapi setoran modalnya baru Rp 2.5 Miliar.', created_at: '2026-07-11T09:15:00Z' },
  { id: 'com-2', tenant_id: 'a0000000-0000-0000-0000-000000000001', document_id: 'doc-1', user_id: 'b0000000-0000-0000-0000-000000000002', user_name: 'Budi Santoso', comment: 'Baik Pak Notaris, segera saya perbaiki dan unggah draft versi terbaru.', created_at: '2026-07-11T10:30:00Z' }
];

export const MOCK_APPOINTMENTS: Appointment[] = [
  { id: 'app-1', tenant_id: 'a0000000-0000-0000-0000-000000000001', order_id: 'd0000000-0000-0000-0000-000000000001', order_title: 'Pendirian PT Maju Bersama (Sektor Kontraktor)', notary_id: 'b0000000-0000-0000-0000-000000000001', notary_name: 'Sutra Oktaviani, S.H., M.Kn.', date_time: '2026-07-15T10:00:00Z', status: 'PROPOSED' },
  { id: 'app-2', tenant_id: 'a0000000-0000-0000-0000-000000000002', order_id: 'd0000000-0000-0000-0000-000000000003', order_title: 'Pendirian CV Sumber Rejeki (Perdagangan Umum)', notary_id: 'b0000000-0000-0000-0000-000000000004', notary_name: 'Maria Siregar, S.H.', date_time: '2026-07-14T11:00:00Z', status: 'APPROVED' }
];

