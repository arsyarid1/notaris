import { ShieldCheck, BookOpen, Key, Zap, Flame, FileCode } from 'lucide-react';

export default function SchemaDocumentation() {
  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      
      {/* Overview Intro */}
      <div className="bg-gradient-to-br from-indigo-950 to-slate-900 rounded-xl p-6 text-white border border-indigo-900/60 shadow-lg">
        <div className="flex items-center gap-3">
          <ShieldCheck className="w-6 h-6 text-indigo-400" />
          <h3 className="font-sans font-bold text-lg tracking-tight">Multi-Tenant Database Architecture Guide</h3>
        </div>
        <p className="text-indigo-200/80 text-xs mt-2.5 leading-relaxed max-w-3xl font-sans">
          Panduan teknis dan keputusan desain tingkat lanjut (Senior-level) untuk menjaga isolasi data mutlak, performa kueri sub-milidetik, serta kepatuhan audit pada sistem SaaS Operasional Notaris Multi-Tenant.
        </p>
      </div>

      {/* Senior Architectural Decisions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        
        {/* Decision 1: UUID v4 for Primary Keys */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4.5 shadow-md space-y-3">
          <div className="bg-indigo-500/10 text-indigo-400 p-2 rounded-lg w-fit border border-indigo-500/20">
            <Key className="w-4 h-4" />
          </div>
          <h4 className="font-sans font-bold text-slate-200 text-xs uppercase tracking-wider">1. UUID vs Auto-Increment</h4>
          <p className="text-slate-400 text-[11px] leading-relaxed font-sans">
            Menghindari ID urut (<code className="bg-slate-950 border border-slate-800 px-1 rounded font-mono text-[10px]">1, 2, 3...</code>) di seluruh tabel transaksi. Menggunakan UUID v4 mencegah <strong>ID Enumeration Attacks</strong>, di mana pengguna dari Tenant B menebak ID milik Tenant B melalui url API. UUID juga mempermudah sinkronisasi data offline ke online secara aman.
          </p>
        </div>

        {/* Decision 2: Denormalisasi tenant_id */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4.5 shadow-md space-y-3">
          <div className="bg-amber-500/10 text-amber-400 p-2 rounded-lg w-fit border border-amber-500/20">
            <Zap className="w-4 h-4" />
          </div>
          <h4 className="font-sans font-bold text-slate-200 text-xs uppercase tracking-wider">2. Denormalisasi tenant_id</h4>
          <p className="text-slate-400 text-[11px] leading-relaxed font-sans">
            Kolom <code className="bg-slate-950 border border-slate-800 px-1 rounded font-mono text-[10px]">tenant_id</code> diletakkan di seluruh tabel (termasuk tabel anak seperti <code className="bg-slate-950 border border-slate-800 px-1 rounded font-mono text-[10px]">tasks</code> atau <code className="bg-slate-950 border border-slate-800 px-1 rounded font-mono text-[10px]">checklists</code>). Walau tidak normal, ini krusial agar PostgreSQL RLS memfilter data langsung menggunakan indeks primer tanpa perlu melakukan JOIN ke tabel induk. Ini menghemat penggunaan CPU database secara drastis.
          </p>
        </div>

        {/* Decision 3: Security Definer Trigger */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4.5 shadow-md space-y-3">
          <div className="bg-emerald-500/10 text-emerald-400 p-2 rounded-lg w-fit border border-emerald-500/20">
            <Flame className="w-4 h-4" />
          </div>
          <h4 className="font-sans font-bold text-slate-200 text-xs uppercase tracking-wider">3. SECURITY DEFINER Triggers</h4>
          <p className="text-slate-400 text-[11px] leading-relaxed font-sans">
            Fungsi audit trigger dikonfigurasi dengan opsi <code className="bg-slate-100 px-1 rounded font-mono text-[10px] bg-slate-950 border border-slate-800">SECURITY DEFINER</code>. Hal ini menjamin pencatatan riwayat audit penting (seperti pembayaran invoice) tetap dapat dilakukan oleh sistem background secara otomatis, melewati batasan izin tulis ketat dari role user biasa demi menjaga integritas kepatuhan data.
          </p>
        </div>

      </div>

      {/* Backend Integration Code Snippet */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-lg overflow-hidden">
        <div className="px-5 py-3 bg-slate-950 border-b border-slate-800 flex items-center gap-2">
          <FileCode className="w-4 h-4 text-indigo-400" />
          <h4 className="font-sans font-bold text-slate-200 text-xs uppercase tracking-wide">Integrasi Middleware Backend (Node.js Express)</h4>
        </div>
        
        <div className="p-5 space-y-4">
          <p className="text-slate-400 font-sans text-xs leading-relaxed">
            Dalam skenario nyata, database connection pool bersifat <em>shared</em> antar semua request. Untuk meneruskan konteks <code className="bg-slate-950 px-1 rounded font-mono border border-slate-800 text-[11px]">tenant_id</code> dan <code className="bg-slate-950 px-1 rounded font-mono border border-slate-800 text-[11px]">user_role</code> ke dalam sesi PostgreSQL secara aman, backend wajib membungkus setiap request dalam satu blok transaksi SQL menggunakan <code className="bg-slate-950 px-1 rounded font-mono border border-slate-800 text-[11px]">SET LOCAL</code>.
          </p>

          <pre className="bg-slate-950 p-4.5 rounded-lg text-xs font-mono text-emerald-400 border border-slate-800/80 overflow-x-auto leading-relaxed max-h-[350px]">
{`// Example: Express Middleware untuk menginjeksi context Tenant & RLS di PostgreSQL
import { Request, Response, NextFunction } from 'express';
import { Pool } from 'pg';

const dbPool = new Pool({ ... });

export async function tenantRlsMiddleware(req: Request, res: Response, next: NextFunction) {
  // 1. Ekstrak tenant_id dan user_role dari token JWT yang terverifikasi
  const tenantId = req.user?.tenant_id;
  const userId = req.user?.id;
  const userRole = req.user?.role;

  if (!tenantId) {
    return res.status(401).json({ error: 'Tenant context is missing' });
  }

  try {
    // 2. Ambil client koneksi dari pool khusus untuk request ini
    const client = await dbPool.connect();
    
    // 3. Mulai SQL transaction block
    await client.query('BEGIN;');
    
    // 4. Set variabel sesi LOCAL (hanya berlaku dalam transaksi request ini)
    await client.query({
      text: \`
        SET LOCAL app.current_tenant_id = $1;
        SET LOCAL app.current_user_id = $2;
        SET LOCAL app.current_user_role = $3;
      \`,
      values: [tenantId, userId, userRole]
    });

    // 5. Tempelkan koneksi database aktif yang ter-RLS ini ke objek request Express
    req.dbClient = client;

    // 6. Tangani penutupan transaksi (COMMIT/ROLLBACK) setelah request Express selesai
    res.on('finish', async () => {
      try {
        await client.query('COMMIT;');
      } catch (err) {
        await client.query('ROLLBACK;');
      } finally {
        client.release(); // Kembalikan koneksi ke Pool
      }
    });

    next();
  } catch (error) {
    next(error);
  }
}`}
          </pre>
        </div>
      </div>

    </div>
  );
}
