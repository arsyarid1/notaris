# 🏛️ Notaris SaaS — Multi-Tenant Notary & PPAT Management System

[![React](https://img.shields.io/badge/React-19.0-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-6.2-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-v4.1-38B2AC?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?logo=supabase&logoColor=white)](https://supabase.com/)
[![Express](https://img.shields.io/badge/Express-4.21-000000?logo=express&logoColor=white)](https://expressjs.com/)

Platform SaaS modern berbasis cloud yang dirancang khusus untuk operasional **Kantor Notaris & PPAT (Pejabat Pembuat Akta Tanah)** di Indonesia. Sistem ini mengusung arsitektur enterprise multi-tenant dengan pengamanan data tingkat baris (**PostgreSQL Row Level Security / RLS**), otomatisasi alur kerja akta, invoicing dengan payment gateway, integrasi AI, serta tools visualisasi skema database interaktif.

---

## ✨ Fitur Utama

### 📊 Operasional Kantor Notaris & PPAT
- **Business Dashboard**: Ringkasan metrik finansial, status order akta, performa kantor, pengumuman internal, dan log aktivitas real-time.
- **Order & Workflow Management**: Pelacakan siklus hidup pengurusan akta (Konsultasi, Pengumpulan Berkas, Drafting Akta, Review Para Pihak, Penandatanganan, hingga Pendaftaran/Selesai).
- **Task & Checklist Management**: Pembagian tugas staf, tenggat waktu (deadline), dan checklist kelengkapan persyaratan yuridis.
- **Client Management (KYC)**: Database klien perorangan maupun badan hukum, riwayat berkas identitas (KTP, NPWP, NIB), dan riwayat pembuatan akta.
- **Invoice & Billing System**: Pembuatan tagihan honorarium & biaya PNBP, cetak PDF resmi ber-kop surat (`html2pdf.js`), dan adapter pembayaran terintegrasi (**Midtrans**, **Mayar**, **Doku**).
- **Pegawai & Hak Akses (RBAC)**: Pengelolaan staf kantor dengan pembagian peran (Notaris/PPAT, Staf Operasional, Finansial).
- **Pengaturan Profil Kantor**: Kustomisasi identitas kantor, alamat resmi, SK Notaris/PPAT, serta upload logo kop surat.

### 🛡️ Arsitektur Database & Developer Tools (Built-in)
- **Interactive ERD Visualizer**: Visualisasi diagram relasi entitas (*Entity Relationship Diagram*) secara interaktif langsung di dalam aplikasi.
- **Row Level Security (RLS) Simulator**: Simulator langsung untuk menguji isolasi data multi-tenant antar kantor notaris yang berbeda.
- **PostgreSQL DDL & Schema Viewer**: Skrip lengkap DDL PostgreSQL, function trigger audit log, dan kebijakan RLS.
- **Dokumentasi Skema Teknis**: Kamus data detail per tabel dan relasinya.

---

## 🛠️ Tech Stack

| Lapisan | Teknologi |
|---|---|
| **Frontend** | React 19, TypeScript, Vite 6, Tailwind CSS v4, Motion (Framer Motion v12), Lucide React |
| **Backend & Server** | Node.js, Express.js (REST API untuk upload logo & asset), `tsx`, `esbuild` |
| **Database & Auth** | PostgreSQL, Supabase (`@supabase/supabase-js`), Reactive Store dengan Realtime Subscription |
| **Artificial Intelligence** | Google Gemini API (`@google/genai`) |
| **Ekspor Dokumen** | `html2pdf.js` untuk cetak invoice dan tanda terima |
| **Integrasi Pembayaran** | Abstraction Adapter untuk Midtrans, Mayar, dan Doku |

---

## 📁 Struktur Direktori

```text
├── public/                 # Asset publik (logo, ikon, gambar)
├── src/
│   ├── components/         # Komponen UI utama
│   │   ├── BusinessDashboard.tsx   # Dashboard operasional & analitik
│   │   ├── OrderManagement.tsx     # Manajemen order & siklus akta
│   │   ├── TaskManagement.tsx      # Manajemen checklist tugas
│   │   ├── TemplateManagement.tsx  # Template draf akta
│   │   ├── ClientManagement.tsx    # Database klien & KYC
│   │   ├── InvoiceManagement.tsx   # Invoice & Payment Gateway
│   │   ├── EmployeeManagement.tsx  # Pengelolaan pegawai
│   │   ├── OfficeSettings.tsx      # Pengaturan profil kantor
│   │   ├── LoginPage.tsx           # Halaman autentikasi
│   │   ├── ErdVisualizer.tsx       # Visualisasi interaktif ERD
│   │   ├── RlsSimulator.tsx        # Simulator PostgreSQL RLS
│   │   ├── SqlViewer.tsx           # Viewer skrip DDL SQL
│   │   └── SchemaDocumentation.tsx # Kamus data & dokumentasi
│   ├── data/
│   │   └── schemaData.ts           # Tipe data, skema DDL, & mock dataset
│   ├── hooks/                      # Custom hooks (workflow, review, kalender)
│   ├── lib/
│   │   ├── mockStore.ts            # Reactive in-memory state & sync Supabase
│   │   ├── supabase.ts             # Supabase client connection
│   │   └── PaymentGatewayAdapter.ts# Clean Architecture Payment Adapter
│   ├── App.tsx                     # Root Application & Navigation
│   ├── main.tsx                    # React Entrypoint
│   └── index.css                   # Global styling & Tailwind directives
├── server.ts               # Express backend & Vite middleware integration
├── package.json            # Daftar dependensi & npm scripts
├── tsconfig.json           # Konfigurasi TypeScript
└── vite.config.ts          # Konfigurasi Vite
```

---

## 🚀 Panduan Memulai (Getting Started)

### 1. Prasyarat
Pastikan komputer Anda telah terinstal:
- **Node.js** (versi 18 atau lebih baru)
- **npm**, **pnpm**, atau **bun**
- **Git**

### 2. Kloning Repositori
```bash
git clone https://github.com/arsyarid1/notaris.git
cd notaris
```

### 3. Instalasi Dependensi
```bash
npm install
```

### 4. Konfigurasi Environment Variables
Salin file `.env.example` menjadi `.env`:
```bash
cp .env.example .env
```

Sesuaikan nilai variabel lingkungan pada file `.env`:
```env
# Gemini AI API Key (opsional untuk fitur AI)
GEMINI_API_KEY="your-gemini-api-key"

# Supabase Configuration (opsional jika menggunakan live Supabase)
VITE_SUPABASE_URL="https://your-project.supabase.co"
VITE_SUPABASE_ANON_KEY="your-anon-key"

# URL Aplikasi
APP_URL="http://localhost:3000"
```

### 5. Menjalankan Server Development
```bash
npm run dev
```
Aplikasi akan aktif dan dapat diakses di: **`http://localhost:3000`**

---

## 📜 Perintah Tersedia (NPM Scripts)

| Perintah | Deskripsi |
|---|---|
| `npm run dev` | Menjalankan Express backend + Vite dev server dengan Hot Module Replacement (HMR) |
| `npm run build` | Melakukan build frontend Vite dan membundel backend Express ke `dist/` |
| `npm start` | Menjalankan server hasil build untuk lingkungan produksi (`dist/server.cjs`) |
| `npm run preview` | Melakukan preview hasil build Vite secara lokal |
| `npm run lint` | Melakukan pengecekan tipe TypeScript (`tsc --noEmit`) |

---

## 🔒 Keamanan & Multi-Tenancy (Row Level Security)

Sistem ini didesain dengan prinsip **Strict Tenant Isolation**:
1. Setiap entitas data (`clients`, `orders`, `invoices`, `tasks`) memiliki kolom `tenant_id`.
2. Kebijakan PostgreSQL **Row Level Security (RLS)** memastikan pengguna dari satu kantor notaris tidak dapat membaca maupun memanipulasi data kantor notaris lainnya.
3. Fitur **RLS Simulator** bawaan di dalam aplikasi memungkinkan auditor/developer memverifikasi penegakan aturan keamanan ini secara transparan.

---

## 📄 Lisensi

Proyek ini dikembangkan untuk kebutuhan operasional kantor Notaris & PPAT. Silakan hubungi pemilik repositori untuk informasi perizinan lebih lanjut.
