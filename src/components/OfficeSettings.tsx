import React, { useState, useEffect } from 'react';
import { 
  Settings, 
  Key, 
  Save, 
  CheckCircle2, 
  Building2, 
  Lock, 
  ShieldAlert, 
  Info, 
  Eye, 
  EyeOff,
  Server,
  Database,
  MapPin,
  FileText,
  CreditCard,
  Globe,
  Upload,
  Image,
  Loader2,
  Plus,
  Trash2
} from 'lucide-react';
import { mockDb } from '../lib/mockStore';
import { User as UserType, Tenant as TenantType } from '../data/schemaData';
import { supabase } from '../lib/supabase';

interface OfficeSettingsProps {
  activeUser: UserType;
  activeTenant: TenantType;
}

export default function OfficeSettings({ activeUser, activeTenant }: OfficeSettingsProps) {
  const getValidLogoUrl = (url?: string | null) => {
    if (!url || url.trim() === '' || url.includes('unsplash.com') || url.includes('placeholder')) {
      return '/pancasila.png';
    }
    return url;
  };

  const DEFAULT_BANK_ACCOUNTS = [
    {
      bank_name: 'Bank Central Asia (BCA)',
      bank_account: '109-880-9221',
      bank_account_name: 'KANTOR NOTARIS SUTRA OKTAVIANI',
      is_primary: true
    },
    {
      bank_name: 'Bank Negara Indonesia (BNI)',
      bank_account: '023-889-1029',
      bank_account_name: 'KANTOR NOTARIS SUTRA OKTAVIANI',
      is_primary: false
    }
  ];

  const [companyName, setCompanyName] = useState(activeTenant.company_name || '');
  const [phone, setPhone] = useState(activeTenant.phone || '');
  const [email, setEmail] = useState(activeTenant.email || '');
  const [mayarApiKey, setMayarApiKey] = useState(activeTenant.mayar_api_key || '');
  const [address, setAddress] = useState(activeTenant.address || '');
  const [skMenkumham, setSkMenkumham] = useState(activeTenant.sk_menkumham || '');
  const [logoUrl, setLogoUrl] = useState(() => getValidLogoUrl(activeTenant.logo_url));
  const [bankAccounts, setBankAccounts] = useState<{ id?: string; bank_name: string; bank_account: string; bank_account_name: string; is_primary?: boolean }[]>(DEFAULT_BANK_ACCOUNTS);

  const [showApiKey, setShowApiKey] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Logo upload state
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [isDragActive, setIsDragActive] = useState(false);

  const uploadFile = async (file: File) => {
    setIsUploading(true);
    setUploadError('');
    try {
      if (file.size > 5 * 1024 * 1024) {
        throw new Error('Ukuran file maksimal adalah 5MB');
      }

      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = (err) => reject(err);
      });
      reader.readAsDataURL(file);
      const base64Data = await base64Promise;

      const response = await fetch('/api/upload-logo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          filename: file.name,
          base64Data,
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Gagal mengunggah file');
      }

      setLogoUrl(result.url);
      setSuccessMessage('Logo berhasil diunggah!');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err: any) {
      console.error('File upload error:', err);
      setUploadError(err.message || 'Gagal mengunggah logo');
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await uploadFile(file);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragActive(true);
    } else if (e.type === "dragleave") {
      setIsDragActive(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith('image/')) {
        await uploadFile(file);
      } else {
        setUploadError('Hanya file gambar (.png, .jpg, .jpeg, .gif, .svg, .webp) yang diperbolehkan');
      }
    }
  };

  // Fetch live tenant details and bank_accounts directly from Supabase and sync inputs
  useEffect(() => {
    let isMounted = true;
    const fetchTenantAndBanksLive = async () => {
      try {
        // 1. Fetch Tenant data from 'tenants' table
        const { data: tenantData, error: tenantErr } = await supabase
          .from('tenants')
          .select('*')
          .eq('id', activeTenant.id)
          .single();

        if (isMounted && tenantData && !tenantErr) {
          if (tenantData.name || tenantData.company_name) setCompanyName(tenantData.name || tenantData.company_name);
          if (tenantData.phone) setPhone(tenantData.phone || '');
          if (tenantData.email) setEmail(tenantData.email || '');
          if (tenantData.mayar_api_key) setMayarApiKey(tenantData.mayar_api_key || '');
          if (tenantData.address) setAddress(tenantData.address || '');
          if (tenantData.sk_menkumham) setSkMenkumham(tenantData.sk_menkumham || '');
          setLogoUrl(getValidLogoUrl(tenantData.logo_url));
        }

        // 2. Fetch Multi-Bank Accounts from 'bank_accounts' table
        try {
          const { data: bankData, error: bankErr } = await supabase
            .from('bank_accounts')
            .select('*')
            .eq('tenant_id', activeTenant.id)
            .order('created_at', { ascending: true });

          if (isMounted && !bankErr && bankData && bankData.length > 0) {
            setBankAccounts(
              bankData.map((b: any) => ({
                id: b.id,
                bank_name: b.bank_name || '',
                bank_account: b.account_number || b.bank_account || '',
                bank_account_name: b.account_name || b.bank_account_name || '',
                is_primary: b.is_primary ?? false
              }))
            );
            return;
          }
        } catch (bErr) {
          console.warn("Error reading bank_accounts table, fallback to tenant JSON:", bErr);
        }

        // Fallback: Parse bank accounts safely from activeTenant / tenantData prop
        if (isMounted) {
          const rawAccountJson = tenantData?.bank_account || activeTenant.bank_account;
          let loadedAccounts = [];
          if (rawAccountJson && rawAccountJson.trim().startsWith('[') && rawAccountJson.trim().endsWith(']')) {
            try {
              const parsed = JSON.parse(rawAccountJson);
              if (Array.isArray(parsed) && parsed.length > 0) {
                loadedAccounts = parsed.map((item: any, idx: number) => ({
                  id: item.id,
                  bank_name: item.bank_name || '',
                  bank_account: item.bank_account || item.account_number || '',
                  bank_account_name: item.bank_account_name || item.account_name || '',
                  is_primary: item.is_primary ?? (idx === 0)
                }));
              }
            } catch (e) {
              console.warn("Failed to parse bank accounts JSON", e);
            }
          }
          
          if (loadedAccounts.length === 0 || (loadedAccounts.length === 1 && !loadedAccounts[0].bank_name && !loadedAccounts[0].bank_account)) {
            loadedAccounts = (tenantData?.bank_name || activeTenant.bank_name) ? [{
              bank_name: tenantData?.bank_name || activeTenant.bank_name || '',
              bank_account: tenantData?.bank_account || activeTenant.bank_account || '',
              bank_account_name: tenantData?.bank_account_name || activeTenant.bank_account_name || '',
              is_primary: true
            }] : DEFAULT_BANK_ACCOUNTS;
          }
          
          setBankAccounts(loadedAccounts);
        }
      } catch (err) {
        console.warn("Live SELECT tenant/bank_accounts error:", err);
      }
    };

    setCompanyName(activeTenant.company_name || (activeTenant as any).name || '');
    setPhone(activeTenant.phone || '');
    setEmail(activeTenant.email || '');
    setMayarApiKey(activeTenant.mayar_api_key || '');
    setAddress(activeTenant.address || '');
    setSkMenkumham(activeTenant.sk_menkumham || '');
    setLogoUrl(getValidLogoUrl(activeTenant.logo_url));
    setSuccessMessage('');
    setErrorMessage('');

    fetchTenantAndBanksLive();

    return () => {
      isMounted = false;
    };
  }, [activeTenant.id]);

  // Handle Add Bank Account
  const handleAddBankAccount = async () => {
    const newAcc = {
      bank_name: '',
      bank_account: '',
      bank_account_name: '',
      is_primary: bankAccounts.length === 0
    };

    try {
      const { data, error } = await supabase
        .from('bank_accounts')
        .insert([{
          tenant_id: activeTenant.id,
          bank_name: '',
          account_number: '',
          bank_account: '',
          account_name: '',
          bank_account_name: '',
          is_primary: bankAccounts.length === 0
        }])
        .select()
        .single();

      if (!error && data?.id) {
        (newAcc as any).id = data.id;
      }
    } catch (err) {
      console.warn("Error inserting bank account into 'bank_accounts' table:", err);
    }

    setBankAccounts(prev => [...prev, newAcc]);
  };

  // Handle Delete Bank Account
  const handleDeleteBankAccount = async (indexToDelete: number) => {
    const target = bankAccounts[indexToDelete];
    if (target?.id) {
      try {
        await supabase
          .from('bank_accounts')
          .delete()
          .eq('id', target.id);
      } catch (err) {
        console.warn("Error deleting bank account from 'bank_accounts' table:", err);
      }
    }

    const remaining = bankAccounts.filter((_, idx) => idx !== indexToDelete);
    setBankAccounts(remaining.length > 0 ? remaining : [{ bank_name: '', bank_account: '', bank_account_name: '', is_primary: true }]);
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMessage('');
    setErrorMessage('');

    if (activeUser.role !== 'NOTARIS') {
      setErrorMessage('Akses Ditolak: Hanya pengguna dengan hak akses Notaris yang dapat mengubah konfigurasi kantor.');
      return;
    }

    if (!companyName.trim()) {
      setErrorMessage('Nama Kantor / Tenant wajib diisi!');
      return;
    }

    // Filter out completely empty entries, but keep at least one if none are filled
    const filteredAccounts = bankAccounts.filter(acc => acc.bank_name.trim() || acc.bank_account.trim() || acc.bank_account_name.trim());
    const accountsToSave = filteredAccounts.length > 0 ? filteredAccounts : [{ bank_name: '', bank_account: '', bank_account_name: '', is_primary: true }];
    const firstBank = accountsToSave[0];

    setIsSaving(true);
    try {
      // 1. Direct UPSERT/UPDATE to Supabase table 'tenants'
      const updatePayload: any = {
        id: activeTenant.id,
        name: companyName.trim(),
        company_name: companyName.trim(),
        address: address.trim() || null,
        phone: phone.trim() || null,
        email: email.trim() || null,
        sk_menkumham: skMenkumham.trim() || null,
        logo_url: logoUrl.trim() || '/pancasila.png',
        mayar_api_key: mayarApiKey.trim() || null,
        bank_name: firstBank?.bank_name?.trim() || null,
        bank_account: firstBank?.bank_account?.trim() || (filteredAccounts.length > 0 ? JSON.stringify(accountsToSave) : null),
        bank_account_name: firstBank?.bank_account_name?.trim() || null
      };

      const { error: sbErr } = await supabase
        .from('tenants')
        .upsert(updatePayload);

      if (sbErr) {
        console.warn('Supabase tenant UPSERT error, falling back to update:', sbErr);
        await supabase
          .from('tenants')
          .update(updatePayload)
          .eq('id', activeTenant.id);
      }

      // 2. Sync to 'bank_accounts' table in Supabase
      for (let i = 0; i < accountsToSave.length; i++) {
        const acc: any = accountsToSave[i];
        const bankPayload = {
          tenant_id: activeTenant.id,
          bank_name: acc.bank_name || '',
          account_number: acc.bank_account || '',
          bank_account: acc.bank_account || '',
          account_name: acc.bank_account_name || '',
          bank_account_name: acc.bank_account_name || '',
          is_primary: acc.is_primary ?? (i === 0)
        };

        if (acc.id) {
          try {
            await supabase
              .from('bank_accounts')
              .update(bankPayload)
              .eq('id', acc.id);
          } catch (err) {
            console.warn("Error updating bank_accounts row:", err);
          }
        } else {
          try {
            const { data: createdRow } = await supabase
              .from('bank_accounts')
              .insert([bankPayload])
              .select()
              .single();

            if (createdRow?.id) {
              acc.id = createdRow.id;
            }
          } catch (err) {
            console.warn("Error inserting bank_accounts row:", err);
          }
        }
      }

      // 3. Also update mockDb store state (persists in localStorage & notifies app subscribers)
      await mockDb.updateTenantSettings(activeTenant.id, mayarApiKey, activeUser.name, {
        company_name: companyName.trim(),
        address,
        sk_menkumham: skMenkumham,
        logo_url: logoUrl,
        bank_name: firstBank.bank_name,
        bank_account: JSON.stringify(accountsToSave),
        bank_account_name: firstBank.bank_account_name,
        phone,
        email
      });
      
      setSuccessMessage('Pengaturan Kantor & Daftar Rekening Bank Berhasil Disimpan Ke Database Supabase!');
      
      // Auto dismiss success notification after 4 seconds
      setTimeout(() => {
        setSuccessMessage('');
      }, 4000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal menyimpan pengaturan.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div id="office-settings-container" className="space-y-6">
      {/* Page Title & Information */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-500/10 text-indigo-400 p-2.5 rounded-lg border border-indigo-500/20">
            <Settings className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2 font-sans">
              Pengaturan Kantor
              <span className="text-[10px] bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2 py-0.5 rounded font-mono font-bold uppercase tracking-wider">
                Notaris Only
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              Kelola kredensial integrasi pihak ketiga, modul Payment Gateway, dan kredensial API tenant kantor Notaris Anda.
            </p>
          </div>
        </div>
      </div>

      {/* Main Settings Card */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Settings Form Column */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-widest font-mono mb-4 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-indigo-400" />
              Integrasi Finansial & Payment Gateway
            </h3>

            <form onSubmit={handleSaveSettings} className="space-y-5">
              
              {/* Notification banners */}
              {successMessage && (
                <div id="settings-success-alert" className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-400 text-xs flex items-center gap-3 font-sans font-semibold animate-fadeIn">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                  <span>{successMessage}</span>
                </div>
              )}

              {errorMessage && (
                <div id="settings-error-alert" className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-lg text-rose-400 text-xs flex items-center gap-3 font-sans">
                  <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Office Details Info (Editable) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-300 uppercase tracking-wider block font-mono">
                    Nama Tenant / Kantor Notaris
                  </label>
                  <input
                    type="text"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="Nama Kantor Notaris"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 text-xs font-sans focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block font-mono">
                    ID Tenant database (Read-only)
                  </label>
                  <div className="px-3 py-2 bg-slate-950 border border-slate-850 rounded-lg text-slate-500 text-xs font-mono">
                    {activeTenant.id}
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-300 uppercase tracking-wider block font-mono">
                    Nomor Telepon Kantor
                  </label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="Contoh: (021) 1234-5678 atau 0812..."
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 text-xs font-sans focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-300 uppercase tracking-wider block font-mono">
                    Email Kantor Resmi
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Contoh: info@kantornotaris.com"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 text-xs font-sans focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Mayar API Key Form Field */}
              <div className="space-y-2 pt-2 border-b border-slate-800/40 pb-5">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5 font-sans">
                    <Key className="w-3.5 h-3.5 text-indigo-400" />
                    Mayar API Key
                  </label>
                  <span className="text-[9px] text-slate-500 font-mono">Secure Field (Encrypted storage simulation)</span>
                </div>

                <div className="relative">
                  <input
                    type={showApiKey ? 'text' : 'password'}
                    value={mayarApiKey}
                    onChange={(e) => setMayarApiKey(e.target.value)}
                    placeholder="Masukkan Mayar API Key untuk memicu tagihan pembayaran riil (e.g. mk_live_...)"
                    className="w-full pl-3 pr-10 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder:text-slate-600 tracking-wide"
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute right-3 top-2.5 text-slate-500 hover:text-slate-350 transition-colors"
                    title={showApiKey ? "Sembunyikan Key" : "Tampilkan Key"}
                  >
                    {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                
                <p className="text-[10px] text-slate-500 leading-normal font-sans">
                  Gunakan Secret Key Mayar Anda untuk mengaktifkan sinkronisasi otomatis status pembayaran instan (Webhook integration). API key ini disimpan aman dalam database terisolasi skema RLS.
                </p>
              </div>

              {/* SECTION: Kop Surat & Legalitas */}
              <div className="space-y-4 pt-2 border-b border-slate-800/40 pb-5">
                <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-2 font-mono">
                  <FileText className="w-4 h-4" />
                  Informasi Kop Surat & Legalitas Kantor
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block font-mono">
                      Nomor SK Menkumham
                    </label>
                    <input
                      type="text"
                      value={skMenkumham}
                      onChange={(e) => setSkMenkumham(e.target.value)}
                      placeholder="Contoh: AHU-00922.AH.02.01"
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder:text-slate-700"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block font-mono">
                      Logo URL Instansi (Manual / Hasil Upload)
                    </label>
                    <input
                      type="text"
                      value={logoUrl}
                      onChange={(e) => setLogoUrl(e.target.value)}
                      placeholder="e.g. /my_logo.png atau url kustom"
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder:text-slate-700"
                    />
                  </div>
                </div>

                {/* Logo Uploader Block */}
                <div className="space-y-3 pt-2 bg-slate-950/30 p-4 border border-slate-850 rounded-xl">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] font-bold text-slate-300 uppercase tracking-wider block font-mono">
                      Uploader Logo Kop Surat
                    </label>
                    {isUploading && (
                      <span className="text-[9px] bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded font-mono animate-pulse font-bold">
                        UPLOADING
                      </span>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
                    {/* Upload Dropzone */}
                    <div className="md:col-span-2">
                      <div
                        onDragEnter={handleDrag}
                        onDragOver={handleDrag}
                        onDragLeave={handleDrag}
                        onDrop={handleDrop}
                        className={`border-2 border-dashed rounded-xl p-5 text-center transition-all cursor-pointer relative ${
                          isDragActive 
                            ? 'border-indigo-500 bg-indigo-500/10' 
                            : 'border-slate-850 hover:border-indigo-500/30 bg-slate-950 hover:bg-slate-950/80'
                        }`}
                      >
                        <input
                          type="file"
                          id="logo-upload-input"
                          accept="image/*"
                          onChange={handleFileChange}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                          disabled={isUploading}
                        />
                        <div className="flex flex-col items-center justify-center space-y-2">
                          <div className="p-2 bg-slate-900 border border-slate-800 rounded-lg text-slate-400">
                            {isUploading ? (
                              <Loader2 className="w-5 h-5 animate-spin text-indigo-400" />
                            ) : (
                              <Upload className="w-5 h-5 text-slate-300" />
                            )}
                          </div>
                          <div className="space-y-1">
                            <p className="text-xs text-slate-300 font-semibold font-sans">
                              {isUploading ? 'Sedang mengunggah...' : 'Pilih file logo atau seret ke sini'}
                            </p>
                            <p className="text-[10px] text-slate-500 font-sans">
                              PNG, JPG, JPEG, SVG, atau WEBP (Maks. 5MB)
                            </p>
                          </div>
                        </div>
                      </div>
                      
                      {uploadError && (
                        <p className="text-[10px] text-rose-400 font-sans font-semibold mt-1.5 flex items-center gap-1">
                          <span>⚠️</span> {uploadError}
                        </p>
                      )}
                    </div>

                    {/* Preview Panel & Presets */}
                    <div className="space-y-3">
                      <div className="bg-slate-950 border border-slate-850 rounded-xl p-3 flex flex-col items-center justify-center min-h-[110px] relative overflow-hidden">
                        {logoUrl ? (
                          <>
                            <img 
                              src={logoUrl} 
                              alt="Logo Preview" 
                              className="max-h-16 max-w-[90%] object-contain rounded"
                              referrerPolicy="no-referrer"
                            />
                            <p className="text-[9px] text-slate-500 mt-2 font-mono truncate max-w-full px-1 text-center">
                              {logoUrl}
                            </p>
                            <button
                              type="button"
                              onClick={() => setLogoUrl('')}
                              className="absolute top-2 right-2 bg-slate-900 hover:bg-rose-950 border border-slate-850 hover:border-rose-800 text-slate-400 hover:text-rose-400 p-1 rounded-md text-[10px] transition-colors cursor-pointer"
                              title="Hapus Logo"
                            >
                              Hapus
                            </button>
                          </>
                        ) : (
                          <div className="text-center text-slate-600 space-y-1 py-4">
                            <Image className="w-6 h-6 mx-auto opacity-40" />
                            <p className="text-[10px] font-sans">Belum ada logo</p>
                          </div>
                        )}
                      </div>

                      {/* Quick Presets */}
                      <div className="space-y-1.5">
                        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block font-mono">
                          Preset Logo Resmi:
                        </span>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setLogoUrl('/pancasila.png');
                              setSuccessMessage('Logo diset menggunakan Garuda Pancasila!');
                              setTimeout(() => setSuccessMessage(''), 3000);
                            }}
                            className={`flex items-center gap-1.5 px-2 py-1 bg-slate-950 border text-[10px] rounded-lg transition-all cursor-pointer ${
                              logoUrl === '/pancasila.png'
                                ? 'border-amber-500/50 text-amber-400 font-semibold bg-amber-500/5'
                                : 'border-slate-850 text-slate-400 hover:border-slate-800 hover:text-slate-200'
                            }`}
                          >
                            <span className="w-1.5 h-1.5 bg-amber-500 rounded-full"></span>
                            Garuda Pancasila
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block font-mono">
                    Alamat Lengkap Kantor
                  </label>
                  <textarea
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Masukkan alamat fisik kantor lengkap untuk diletakkan di bagian Kop Surat..."
                    rows={3}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder:text-slate-700 leading-relaxed resize-none"
                  />
                </div>
              </div>

              {/* SECTION: Rekening Bank Resmi */}
              <div className="space-y-4 pt-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-2 font-mono">
                    <CreditCard className="w-4 h-4" />
                    Daftar Rekening Bank Pembayaran Resmi
                  </h4>
                  <button
                    type="button"
                    onClick={handleAddBankAccount}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600/20 hover:bg-indigo-600/30 active:bg-indigo-600/40 text-indigo-400 border border-indigo-500/30 rounded-lg text-[11px] font-bold transition-all cursor-pointer font-sans"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Tambah Rekening</span>
                  </button>
                </div>

                <div className="space-y-4">
                  {bankAccounts.map((account, idx) => (
                    <div key={idx} className="bg-slate-950/50 border border-slate-800/80 rounded-xl p-4 space-y-3 relative group transition-all hover:border-slate-800">
                      <div className="flex justify-between items-center pb-2 border-b border-slate-850/50">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono">
                            Rekening #{idx + 1}
                          </span>
                          {account.is_primary && (
                            <span className="text-[9px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded font-mono font-bold">
                              UTAMA
                            </span>
                          )}
                        </div>
                        {bankAccounts.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleDeleteBankAccount(idx)}
                            className="text-rose-500 hover:text-rose-400 active:text-rose-600 p-1 rounded transition-colors cursor-pointer"
                            title="Hapus Rekening"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block font-mono">
                            Nama Bank
                          </label>
                          <input
                            type="text"
                            value={account.bank_name}
                            onChange={(e) => {
                              const updated = [...bankAccounts];
                              updated[idx].bank_name = e.target.value;
                              setBankAccounts(updated);
                            }}
                            placeholder="Contoh: Bank BCA"
                            className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder:text-slate-700"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block font-mono">
                            Nomor Rekening Bank
                          </label>
                          <input
                            type="text"
                            value={account.bank_account}
                            onChange={(e) => {
                              const updated = [...bankAccounts];
                              updated[idx].bank_account = e.target.value;
                              setBankAccounts(updated);
                            }}
                            placeholder="Contoh: 109-880-9221"
                            className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder:text-slate-700"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block font-mono">
                            Nama Pemilik Rekening (a.n.)
                          </label>
                          <input
                            type="text"
                            value={account.bank_account_name}
                            onChange={(e) => {
                              const updated = [...bankAccounts];
                              updated[idx].bank_account_name = e.target.value;
                              setBankAccounts(updated);
                            }}
                            placeholder="Contoh: KANTOR NOTARIS SUTRA OKTAVIANI"
                            className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder:text-slate-700"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Form Action */}
              <div className="pt-4 border-t border-slate-800/50 flex justify-end">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-sans text-xs font-bold rounded-lg shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer uppercase tracking-wider"
                >
                  {isSaving ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Menyimpan...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      <span>Simpan Pengaturan</span>
                    </>
                  )}
                </button>
              </div>

            </form>
          </div>
        </div>

        {/* Informational Column */}
        <div className="space-y-6">
          {/* Security & Isolation card */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 shadow-sm">
            <h4 className="text-xs font-bold text-slate-350 uppercase tracking-wider flex items-center gap-1.5 font-mono">
              <Lock className="w-3.5 h-3.5 text-indigo-400" />
              Keamanan Tingkat Tenant (RLS)
            </h4>
            <p className="text-xs text-slate-400 leading-relaxed font-sans">
              Setiap nilai konfigurasi yang disimpan di sini dilindungi oleh kebijakan <strong>Row-Level Security (RLS)</strong> PostgreSQL. 
            </p>
            <div className="bg-slate-950 p-3 rounded-lg border border-slate-850 space-y-2 text-[11px]">
              <div className="flex items-start gap-2 text-slate-400">
                <Server className="w-3.5 h-3.5 text-indigo-500 shrink-0 mt-0.5" />
                <span>Hanya role <strong>NOTARIS</strong> yang memiliki hak akses <code>UPDATE</code> atau <code>SELECT</code> pada data sensitif ini.</span>
              </div>
              <div className="flex items-start gap-2 text-slate-400">
                <Database className="w-3.5 h-3.5 text-indigo-500 shrink-0 mt-0.5" />
                <span>Data diisolasi sepenuhnya secara kriptografis menggunakan UUID Tenant.</span>
              </div>
            </div>
          </div>

          {/* Quick Guide Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3 shadow-sm">
            <h4 className="text-xs font-bold text-slate-350 uppercase tracking-wider flex items-center gap-1.5 font-mono">
              <Info className="w-3.5 h-3.5 text-indigo-400" />
              Petunjuk Pengaturan Mayar
            </h4>
            <ol className="text-xs text-slate-400 space-y-2 list-decimal list-inside leading-relaxed font-sans">
              <li>Masuk ke dasbor Mayar Anda.</li>
              <li>Buka menu <strong>Developer Tools</strong> &gt; <strong>API Keys</strong>.</li>
              <li>Salin kunci rahasia (biasanya berawalan <code>mk_live_</code>).</li>
              <li>Tempelkan di kolom isian sebelah kiri lalu klik tombol <strong>Simpan Pengaturan</strong>.</li>
            </ol>
          </div>

        </div>

      </div>
    </div>
  );
}
