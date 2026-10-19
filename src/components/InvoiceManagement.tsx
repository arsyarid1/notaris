import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  DollarSign, 
  Plus, 
  FileText, 
  Link as LinkIcon, 
  Check, 
  AlertCircle, 
  TrendingUp, 
  Clock, 
  X, 
  Search, 
  Lock, 
  CreditCard,
  Copy,
  ExternalLink,
  ShieldAlert,
  Sparkles,
  Layers,
  Trash2,
  ListPlus,
  ArrowRightLeft,
  CheckCircle2,
  Printer,
  Download,
  Send,
  Mail,
  MessageCircle,
  Scale,
  Edit,
  Edit2,
  AlertTriangle
} from 'lucide-react';
import { mockDb } from '../lib/mockStore';
import { Invoice, Order, User as UserType } from '../data/schemaData';
import { PaymentGatewayAdapter, PaymentProvider } from '../lib/PaymentGatewayAdapter';
import { supabase } from '../lib/supabase';
import html2pdf from 'html2pdf.js';

function withTimeout<T>(promise: Promise<T>, timeoutMs: number = 2000): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => {
        console.warn('Supabase query timed out, falling back to local simulation.');
        reject(new Error('TIMEOUT'));
      }, timeoutMs)
    )
  ]);
}

interface InvoiceManagementProps {
  activeUser: UserType;
  activeTenant: { id: string; company_name: string };
}

interface InstallmentRow {
  billing_type: 'DP' | 'PELUNASAN' | 'LUNAS';
  amount: number;
  description: string;
}

function getRomanMonth(monthIndex: number): string {
  const romanMonths = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
  return romanMonths[monthIndex] || 'I';
}

function enrichInvoices(rawInvoices: any[]): any[] {
  // Sort oldest to newest to assign stable sequence numbers chronologically
  const sorted = [...rawInvoices].sort((a, b) => 
    new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  return sorted.map((inv, index) => {
    const sequenceNumber = inv.sequence_number || (index + 1);
    const paddedSeq = String(sequenceNumber).padStart(3, '0');
    const invoiceDate = new Date(inv.created_at || new Date());
    const romanMonth = getRomanMonth(invoiceDate.getMonth());
    const year = invoiceDate.getFullYear();
    const calculatedInvoiceNumber = `${paddedSeq}/INV/${romanMonth}/${year}`;

    // Calculate due date (7 days after created_at)
    const dueDateObj = new Date(invoiceDate);
    dueDateObj.setDate(dueDateObj.getDate() + 7);
    const calculatedDueDateStr = dueDateObj.toISOString().split('T')[0];

    return {
      ...inv,
      sequence_number: sequenceNumber,
      invoice_number: inv.invoice_number || calculatedInvoiceNumber,
      due_date: inv.due_date ? (typeof inv.due_date === 'string' ? inv.due_date.split('T')[0] : inv.due_date) : calculatedDueDateStr,
      order_title: inv.order_title || inv.orders?.title || 'Tagihan Akta'
    };
  });
}

function terbilang(n: number): string {
  const words = ["", "Satu", "Dua", "Tiga", "Empat", "Lima", "Enam", "Tujuh", "Delapan", "Sembilan", "Sepuluh", "Sebelas"];
  if (n < 12) return words[n];
  if (n < 20) return terbilang(n - 10) + " Belas";
  if (n < 100) return terbilang(Math.floor(n / 10)) + " Puluh " + terbilang(n % 10);
  if (n < 200) return "Seratus " + terbilang(n - 100);
  if (n < 1000) return terbilang(Math.floor(n / 100)) + " Ratus " + terbilang(n % 100);
  if (n < 2000) return "Seribu " + terbilang(n - 1000);
  if (n < 1000000) return terbilang(Math.floor(n / 1000)) + " Ribu " + terbilang(n % 1000);
  if (n < 1000000000) return terbilang(Math.floor(n / 1000000)) + " Juta " + terbilang(n % 1000000);
  if (n < 1000000000000) return terbilang(Math.floor(n / 1000000000)) + " Milyar " + terbilang(n % 1000000000);
  return "";
}

function formatTerbilang(amount: number): string {
  const result = terbilang(amount).replace(/\s+/g, ' ').trim();
  return result ? `${result} Rupiah` : '';
}

export default function InvoiceManagement({ activeUser, activeTenant }: InvoiceManagementProps) {
  const [storeTick, setStoreTick] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Real-time Supabase integration states
  const [invoices, setInvoices] = useState<any[]>([]);
  const [isLoadingInvoices, setIsLoadingInvoices] = useState(false);
  const [liveTenant, setLiveTenant] = useState<any>(null);
  const [liveBankAccounts, setLiveBankAccounts] = useState<any[]>([]);
  
  // Modal states
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  
  // Form states for dynamic terms & PG integration
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const [selectedProvider, setSelectedProvider] = useState<PaymentProvider>('MIDTRANS');
  const [gatewayDisabled, setGatewayDisabled] = useState(false);
  const [contractValue, setContractValue] = useState<number>(10000000); // 10 Million default contract target helper
  const [installments, setInstallments] = useState<InstallmentRow[]>([
    { billing_type: 'LUNAS', amount: 10000000, description: 'Pembayaran Penuh 100%' }
  ]);
  
  // Simulation states
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [generatedInvoicesResult, setGeneratedInvoicesResult] = useState<{ billing_type: string; link: string; amount: number }[]>([]);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [settleSuccessId, setSettleSuccessId] = useState<string | null>(null);

  // Dynamic tenant data query from mock store (or Supabase syncing)
  const fullTenant = useMemo(() => {
    const local = mockDb.tenants.find(t => t.id === activeTenant.id) || activeTenant;
    const merged = { ...local };
    if (liveTenant) {
      Object.keys(liveTenant).forEach(key => {
        if (liveTenant[key] !== undefined && liveTenant[key] !== null) {
          (merged as any)[key] = liveTenant[key];
        }
      });
    }
    const logo = (merged as any).logo_url;
    if (!logo || logo.includes('unsplash.com') || logo.includes('placeholder')) {
      (merged as any).logo_url = '/pancasila.png';
    }
    return merged;
  }, [activeTenant.id, liveTenant, storeTick]);

  // Parse multiple bank accounts for invoice print and text sharing
  const bankAccounts = useMemo(() => {
    if (liveBankAccounts && liveBankAccounts.length > 0) {
      return liveBankAccounts;
    }

    if (fullTenant && fullTenant.bank_account && fullTenant.bank_account.trim().startsWith('[') && fullTenant.bank_account.trim().endsWith(']')) {
      try {
        const parsed = JSON.parse(fullTenant.bank_account);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((item: any) => ({
            bank_name: item.bank_name || '',
            bank_account: item.bank_account || item.account_number || '',
            bank_account_name: item.bank_account_name || item.account_name || '',
            is_primary: item.is_primary ?? false
          }));
        }
      } catch (e) {
        console.warn("Failed to parse bank accounts JSON in InvoiceManagement", e);
      }
    }
    
    // Fallback to single account if specified
    if (fullTenant?.bank_name || fullTenant?.bank_account) {
      return [{
        bank_name: fullTenant.bank_name || '',
        bank_account: fullTenant.bank_account || '',
        bank_account_name: fullTenant.bank_account_name || '',
        is_primary: true
      }];
    }
    
    // Default official bank accounts (BCA & BNI)
    return [
      {
        bank_name: 'Bank Central Asia (BCA)',
        bank_account: '109-880-9221',
        bank_account_name: fullTenant?.company_name ? fullTenant.company_name.toUpperCase() : 'KANTOR NOTARIS SUTRA OKTAVIANI',
        is_primary: true
      },
      {
        bank_name: 'Bank Negara Indonesia (BNI)',
        bank_account: '023-889-1029',
        bank_account_name: fullTenant?.company_name ? fullTenant.company_name.toUpperCase() : 'KANTOR NOTARIS SUTRA OKTAVIANI',
        is_primary: false
      }
    ];
  }, [fullTenant, liveBankAccounts]);

  // Invoice Preview and Sharing States
  const [selectedPreviewInvoice, setSelectedPreviewInvoice] = useState<Invoice | null>(null);
  const [isShareDropdownOpen, setIsShareDropdownOpen] = useState(false);

  // Edit Invoice States
  const [editingInvoiceId, setEditingInvoiceId] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState<number>(0);
  const [editBillingType, setEditBillingType] = useState<'DP' | 'PELUNASAN' | 'LUNAS'>('LUNAS');
  const [editStatus, setEditStatus] = useState<'UNPAID' | 'PAID' | 'EXPIRED'>('UNPAID');
  const [editPaymentLink, setEditPaymentLink] = useState('');
  const [isUpdatingInvoice, setIsUpdatingInvoice] = useState(false);

  const handleUpdateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingInvoiceId) return;

    setIsUpdatingInvoice(true);
    try {
      let updateError: any = null;
      let isTimeout = false;
      try {
        const response = await withTimeout<any>(
          supabase
            .from('invoices')
            .update({
              amount: editAmount,
              billing_type: editBillingType,
              status: editStatus,
              payment_link: editPaymentLink || null
            })
            .eq('id', editingInvoiceId) as any,
          2000
        );
        updateError = response.error;
      } catch (err) {
        console.warn('Supabase update timed out, using local fallback:', err);
        isTimeout = true;
      }

      if (updateError || isTimeout) {
        const isRLS = updateError && (updateError.message.includes('row-level security policy') || updateError.code === '42501');
        if (isRLS || isTimeout) {
          const isAuthorized = activeUser.role === 'NOTARIS' || activeUser.role === 'FINANCE';
          if (isAuthorized) {
            console.warn(`Bypassing stateless Supabase RLS/timeout restriction on update for authorized role: ${activeUser.role}`);
            const idx = mockDb.invoices.findIndex(i => i.id === editingInvoiceId);
            if (idx !== -1) {
              mockDb.invoices[idx] = {
                ...mockDb.invoices[idx],
                amount: editAmount,
                billing_type: editBillingType,
                status: editStatus,
                payment_link: editPaymentLink || null
              };
              mockDb.notify();
            }
          } else {
            throw new Error(
              `Kesalahan RLS Postgres (Hak Akses Ditolak): Peran sesi database Anda tidak memiliki izin untuk memperbarui data invoice di tabel 'invoices'.\n\n` +
              `Skema RLS membatasi modifikasi finansial hanya untuk peran NOTARIS atau FINANCE.`
            );
          }
        } else {
          throw updateError;
        }
      } else {
        // Successful remote write, sync locally too
        const idx = mockDb.invoices.findIndex(i => i.id === editingInvoiceId);
        if (idx !== -1) {
          mockDb.invoices[idx] = {
            ...mockDb.invoices[idx],
            amount: editAmount,
            billing_type: editBillingType,
            status: editStatus,
            payment_link: editPaymentLink || null
          };
          mockDb.notify();
        }
      }

      setEditingInvoiceId(null);
      
      // Fetch latest invoices
      await fetchInvoices();
      
      // Update local preview state if open
      if (selectedPreviewInvoice && selectedPreviewInvoice.id === editingInvoiceId) {
        setSelectedPreviewInvoice(prev => prev ? {
          ...prev,
          amount: editAmount,
          billing_type: editBillingType,
          status: editStatus,
          payment_link: editPaymentLink || null
        } : null);
      }
      
      setSuccessMessage('Invoice berhasil diperbarui!');
    } catch (err: any) {
      console.error('Error updating invoice:', err);
      alert(err.message || 'Gagal memperbarui invoice');
    } finally {
      setIsUpdatingInvoice(false);
    }
  };

  // Resolve client & order details for the invoice preview
  const resolvedPreviewDetails = useMemo(() => {
    if (!selectedPreviewInvoice) return null;
    
    const order = mockDb.orders.find(o => o.id === selectedPreviewInvoice.order_id);
    const client = order ? mockDb.clients.find(c => c.id === order.client_id) : null;
    
    // Format YYYYMMDD prefix for professional invoice ID
    const dateObj = new Date(selectedPreviewInvoice.created_at || Date.now());
    const yyyymmdd = dateObj.getFullYear() + 
                     String(dateObj.getMonth() + 1).padStart(2, '0') + 
                     String(dateObj.getDate()).padStart(2, '0');
                     
    const tenantPrefix = activeTenant.id.substring(0, 8).toUpperCase();
    const invoiceSeq = selectedPreviewInvoice.id.substring(selectedPreviewInvoice.id.length - 4).toUpperCase();
    const invoiceNo = selectedPreviewInvoice.invoice_number || `INV/${yyyymmdd}/${tenantPrefix}/${invoiceSeq}`;
    
    const clientName = selectedPreviewInvoice.orders?.clients?.name || client?.name || selectedPreviewInvoice.order_title || 'Klien Notaris';
    const clientEmail = client?.email || 'klien@notaris.io';
    const clientPhone = client?.phone || '+62 812-3456-7890';

    const notaryUser = mockDb.users.find(u => u.role === 'NOTARIS' && u.tenant_id === activeTenant.id);
    const notaryName = fullTenant?.notary_name || (fullTenant?.company_name ? fullTenant.company_name.replace("Kantor Notaris ", "").replace("Notaris & PPAT ", "") : (notaryUser ? notaryUser.name : "SUTRA OKTAVIANI, S.H., M.Kn."));
    
    const formattedAmount = "Rp" + Number(selectedPreviewInvoice.amount).toLocaleString('id-ID', { minimumFractionDigits: 0 }) + ",-";
    const spelledAmount = formatTerbilang(Number(selectedPreviewInvoice.amount));
    
    return {
      order,
      client,
      invoiceNo,
      clientName,
      clientEmail,
      clientPhone,
      notaryName,
      formattedAmount,
      spelledAmount
    };
  }, [selectedPreviewInvoice, activeTenant.id, fullTenant]);

  const handleShareWhatsApp = () => {
    if (!selectedPreviewInvoice || !resolvedPreviewDetails) return;
    
    const { clientName, clientPhone, invoiceNo } = resolvedPreviewDetails;
    const orderTitle = selectedPreviewInvoice.order_title;
    const amountStr = selectedPreviewInvoice.amount.toLocaleString('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 });
    const billingTypeStr = selectedPreviewInvoice.billing_type === 'DP' ? 'Uang Muka (DP)' : selectedPreviewInvoice.billing_type === 'PELUNASAN' ? 'Pelunasan' : 'Lunas';
    const cleanPhone = clientPhone.replace(/\D/g, '');
    const accountName = fullTenant.bank_account_name || fullTenant.company_name.replace("Kantor Notaris ", "").toUpperCase();
    
    const bankDetailsText = bankAccounts.length > 0
      ? bankAccounts.map(acc => `- ${acc.bank_name}: ${acc.bank_account} (a.n. ${acc.bank_account_name || accountName})`).join('\n')
      : `- Bank BCA: 109-880-9221 (a.n. ${accountName})\n- Bank Mandiri: 132-00-2491-8890 (a.n. ${accountName})`;
    
    const paymentInstructions = selectedPreviewInvoice.gateway_disabled
      ? `Anda dapat melakukan pembayaran melalui transfer manual ke rekening bank resmi kami:
${bankDetailsText}`
      : `Anda dapat melakukan pembayaran instan secara aman melalui tautan berikut:
Tautan Pembayaran: ${selectedPreviewInvoice.payment_link}

Atau melalui transfer manual ke rekening bank resmi kami:
${bankDetailsText}`;
    
    const text = `Halo Bapak/Ibu *${clientName}*,

Berikut kami kirimkan tagihan *${billingTypeStr}* dari Kantor Notaris & PPAT *${fullTenant.company_name}* untuk pengurusan berkas *${orderTitle}* sebesar *${amountStr}*.

Nomor Tagihan: *${invoiceNo}*

${paymentInstructions}

Setelah melakukan pembayaran, mohon mengirimkan bukti transfer kepada kami.

Terima kasih atas kerja samanya.
Hormat kami,
*Office of ${fullTenant.company_name}*`;

    const url = `https://api.whatsapp.com/send?phone=${cleanPhone.startsWith('0') ? '62' + cleanPhone.substring(1) : cleanPhone}&text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  const handleShareEmail = () => {
    if (!selectedPreviewInvoice || !resolvedPreviewDetails) return;
    
    const { clientName, clientEmail, invoiceNo } = resolvedPreviewDetails;
    const orderTitle = selectedPreviewInvoice.order_title;
    const amountStr = selectedPreviewInvoice.amount.toLocaleString('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 });
    const billingTypeStr = selectedPreviewInvoice.billing_type === 'DP' ? 'Uang Muka (DP)' : selectedPreviewInvoice.billing_type === 'PELUNASAN' ? 'Pelunasan' : 'Lunas';
    const accountName = fullTenant.bank_account_name || fullTenant.company_name.replace("Kantor Notaris ", "").toUpperCase();
    
    const bankDetailsText = bankAccounts.length > 0
      ? bankAccounts.map(acc => `- ${acc.bank_name}: ${acc.bank_account} (a.n. ${acc.bank_account_name || accountName})`).join('\n')
      : `- Bank BCA: 109-880-9221 (a.n. ${accountName})\n- Bank Mandiri: 132-00-2491-8890 (a.n. ${accountName})`;
    
    const paymentInstructions = selectedPreviewInvoice.gateway_disabled
      ? `Silakan mengirimkan pembayaran ke rekening bank resmi kami di bawah ini:

${bankDetailsText}`
      : `Untuk kemudahan transaksi, Anda dapat melakukan pembayaran aman secara instan melalui tautan di bawah ini (mendukung Kartu Kredit, Virtual Account, Qris, & E-Wallet):

Tautan Pembayaran: ${selectedPreviewInvoice.payment_link}

Atau jika Anda memilih transfer bank manual, silakan mengirimkan pembayaran ke rekening resmi kami:
${bankDetailsText}`;
    
    const subject = `Tagihan Pembayaran ${billingTypeStr} - ${orderTitle} (${invoiceNo})`;
    const body = `Yth. Bapak/Ibu ${clientName},

Semoga Bapak/Ibu dalam keadaan sehat walafiat.

Dengan surat ini, kami sampaikan tagihan pembayaran ${billingTypeStr} terkait pengurusan dokumen hukum/akta '${orderTitle}' pada kantor kami dengan rincian sebagai berikut:

- Nomor Tagihan: ${invoiceNo}
- Jenis Tagihan: ${billingTypeStr}
- Layanan Berkas: ${orderTitle}
- Jumlah Tagihan: ${amountStr}

${paymentInstructions}

Mohon konfirmasi dengan mengirimkan bukti pembayaran jika Anda menggunakan metode transfer manual.

Terima kasih atas perhatian dan kerja sama yang baik.

Hormat kami,
Kantor Notaris & PPAT
${fullTenant.company_name}`;

    const url = `mailto:${clientEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(url, '_blank');
  };

  const handleTriggerPrint = () => {
    try {
      window.print();
    } catch (e) {
      console.warn("Pencetakan langsung tidak didukung dalam iframe ini, mengunduh PDF sebagai gantinya:", e);
      handleDownloadPDF();
    }
  };

  const handleDownloadPDF = async () => {
    const element = document.getElementById('invoice-download-area') || document.getElementById('print-invoice-area');
    if (!element) {
      setErrorMessage("Area invoice tidak ditemukan.");
      return;
    }

    setIsDownloadingPdf(true);
    setErrorMessage('');

    // 1. Buat container sementara di luar layar (off-screen div) berukuran persis A4
    const container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.left = '-9999px';
    container.style.top = '-9999px';
    container.style.width = '200mm';
    container.style.backgroundColor = '#ffffff';
    container.style.overflow = 'hidden';

    // 2. Clone elemen invoice
    const clone = element.cloneNode(true) as HTMLElement;
    clone.style.width = '200mm';
    clone.style.maxHeight = '287mm'; // Fits inside A4 (297mm height - 2x5mm margins)
    clone.style.padding = '10mm 12mm'; // Padding internal A4 yang rapi
    clone.style.backgroundColor = '#ffffff';
    clone.style.color = '#000000';
    clone.style.boxShadow = 'none'; // Hilangkan outer shadow
    clone.style.border = 'none'; // Hilangkan bingkai/outline hitam di sekeliling kertas
    clone.style.outline = 'none';
    clone.style.margin = '0'; // Hilangkan margin luar
    clone.style.boxSizing = 'border-box';
    clone.style.overflow = 'hidden';
    
    // Page-break avoidance strategy for PDF export
    clone.style.pageBreakInside = 'avoid';
    clone.style.breakInside = 'avoid';

    // Apply explicit page-break-inside: avoid on invoice items table and key content blocks
    const tableAndSections = clone.querySelectorAll('table, tr, tbody, thead, div');
    tableAndSections.forEach((el) => {
      const htmlEl = el as HTMLElement;
      htmlEl.style.pageBreakInside = 'avoid';
      htmlEl.style.breakInside = 'avoid';
    });

    // 3. Salin computed styles & bersihkan warna oklab/oklch menjadi Hex/RGB murni
    const origElements = [element, ...Array.from(element.querySelectorAll('*'))] as HTMLElement[];
    const cloneElements = [clone, ...Array.from(clone.querySelectorAll('*'))] as HTMLElement[];

    for (let i = 0; i < origElements.length && i < cloneElements.length; i++) {
      const origEl = origElements[i];
      const cloneEl = cloneElements[i];

      try {
        const computed = window.getComputedStyle(origEl);

        // Salin nilai computed style jika aman (bukan oklab)
        if (computed.color && !computed.color.includes('oklab') && !computed.color.includes('oklch')) {
          cloneEl.style.color = computed.color;
        } else {
          cloneEl.style.color = '#000000';
        }

        if (computed.backgroundColor && !computed.backgroundColor.includes('oklab') && !computed.backgroundColor.includes('oklch') && computed.backgroundColor !== 'transparent' && computed.backgroundColor !== 'rgba(0, 0, 0, 0)') {
          cloneEl.style.backgroundColor = computed.backgroundColor;
        } else if (computed.backgroundColor && (computed.backgroundColor.includes('oklab') || computed.backgroundColor.includes('oklch'))) {
          cloneEl.style.backgroundColor = '#ffffff';
        }

        if (computed.borderColor && !computed.borderColor.includes('oklab') && !computed.borderColor.includes('oklch')) {
          cloneEl.style.borderColor = computed.borderColor;
        } else if (computed.borderColor && (computed.borderColor.includes('oklab') || computed.borderColor.includes('oklch'))) {
          cloneEl.style.borderColor = '#d1d5db';
        }
      } catch (e) {
        cloneEl.style.color = '#000000';
      }

      // Hapus atau ganti string oklab/oklch dari atribut style jika ada
      const styleAttr = cloneEl.getAttribute('style');
      if (styleAttr && (styleAttr.includes('oklab') || styleAttr.includes('oklch') || styleAttr.includes('lab('))) {
        cloneEl.setAttribute(
          'style',
          styleAttr
            .replace(/oklab\([^)]+\)/gi, '#000000')
            .replace(/oklch\([^)]+\)/gi, '#000000')
            .replace(/lab\([^)]+\)/gi, '#000000')
        );
      }
    }

    container.appendChild(clone);
    document.body.appendChild(container);

    try {
      const invoiceNo = resolvedPreviewDetails?.invoiceNo || selectedPreviewInvoice?.invoice_number || 'Draft';
      const clientName = resolvedPreviewDetails?.clientName || 'Client';

      const cleanInvoiceNo = invoiceNo.replace(/[/\\?%*:|"<>]/g, '_').trim();
      const cleanClientName = clientName.replace(/[/\\?%*:|"<>]/g, '_').trim();
      const filename = `Invoice-${cleanInvoiceNo}-${cleanClientName}.pdf`;

      const opt = {
        margin:       5, // Margin 5mm untuk mencegah terpotong
        filename:     filename,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  {
          scale: 2,
          useCORS: true,
          logging: false,
          scrollX: 0,
          scrollY: 0,
          onclone: (clonedDoc: Document) => {
            // Bersihkan tag <style> di dokumen kloning agar html2canvas tidak melakukan parsing pada aturan oklab/oklch Tailwind
            const styleElements = Array.from(clonedDoc.querySelectorAll('style'));
            styleElements.forEach((styleEl) => {
              if (styleEl.textContent && (styleEl.textContent.includes('oklab') || styleEl.textContent.includes('oklch') || styleEl.textContent.includes('lab('))) {
                styleEl.textContent = styleEl.textContent
                  .replace(/oklab\([^)]+\)/gi, '#000000')
                  .replace(/oklch\([^)]+\)/gi, '#000000')
                  .replace(/lab\([^)]+\)/gi, '#000000');
              }
            });

            // Matikan stylesheet eksternal pada dokumen kloning agar html2canvas tidak membaca aturan oklab dari CSS global
            const linkElements = Array.from(clonedDoc.querySelectorAll('link[rel="stylesheet"]'));
            linkElements.forEach((linkEl) => {
              linkEl.setAttribute('media', 'only x');
            });
          }
        },
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak:    { mode: ['avoid-all', 'css', 'legacy'] }
      };

      let worker: any = null;
      const h2p: any = html2pdf;
      if (typeof h2p === 'function') {
        worker = h2p();
      } else {
        const module: any = await import('html2pdf.js');
        const html2pdfFunc: any = module.default || module;
        worker = html2pdfFunc();
      }

      if (worker) {
        await worker.set(opt).from(clone).save();
        setSuccessMessage(`Invoice berhasil diunduh sebagai ${filename}`);
        setTimeout(() => setSuccessMessage(''), 4000);
      }
    } catch (err: any) {
      console.error("Gagal mengunduh PDF invoice:", err);
      setErrorMessage("Gagal mengunduh PDF invoice. Silakan coba lagi.");
    } finally {
      if (document.body.contains(container)) {
        document.body.removeChild(container);
      }
      setIsDownloadingPdf(false);
    }
  };

  // Fetch active tenant's invoices and tenant details from Supabase
  const fetchInvoices = async () => {
    setIsLoadingInvoices(true);
    try {
      let data: any[] | null = null;
      let error: any = null;

      try {
        const response = await withTimeout<any>(
          supabase
            .from('invoices')
            .select('*, orders(title, clients(name))')
            .eq('tenant_id', activeTenant.id) as any,
          2000
        );
        data = response.data;
        error = response.error;
      } catch (timeoutErr) {
        console.warn('Supabase fetch invoices timed out, using local fallback:', timeoutErr);
        error = { message: 'TIMEOUT' };
      }

      // Get local invoices for this tenant from mockDb
      const localInvoices = mockDb.invoices.filter(i => i.tenant_id === activeTenant.id);

      if (error) {
        console.warn('Error fetching invoices from Supabase, using local fallback:', error);
        const enriched = enrichInvoices(localInvoices);
        enriched.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        setInvoices(enriched);
      } else {
        // Merge Supabase and mockDb so any local simulations are preserved
        const merged = [...(data || [])];
        localInvoices.forEach(localInv => {
          if (!merged.some(m => m.id === localInv.id)) {
            const order = orderList.find(o => o.id === localInv.order_id);
            merged.push({
              ...localInv,
              orders: order ? {
                title: order.title,
                clients: { name: order.client_name }
              } : null
            });
          }
        });

        const enriched = enrichInvoices(merged);
        enriched.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        setInvoices(enriched);
      }
    } catch (err: any) {
      console.warn('Catch error fetching invoices, using local fallback:', err);
      const localInvoices = mockDb.invoices.filter(i => i.tenant_id === activeTenant.id);
      const enriched = enrichInvoices(localInvoices);
      enriched.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setInvoices(enriched);
    } finally {
      setIsLoadingInvoices(false);
    }
  };

  const fetchTenantDetails = async () => {
    try {
      let tenantData: any = null;
      const targetId = activeTenant?.id || activeUser?.tenant_id;
      if (targetId) {
        const { data } = await supabase
          .from('tenants')
          .select('*')
          .eq('id', targetId)
          .maybeSingle();
        if (data) tenantData = data;
      }

      if (!tenantData) {
        const { data } = await supabase
          .from('tenants')
          .select('*')
          .limit(1)
          .maybeSingle();
        if (data) tenantData = data;
      }

      if (tenantData) {
        setLiveTenant(tenantData);
      }

      // Query bank_accounts table
      const bankTenantId = tenantData?.id || activeTenant?.id || activeUser?.tenant_id;
      const { data: bankData } = await supabase
        .from('bank_accounts')
        .select('*')
        .eq('tenant_id', bankTenantId)
        .order('created_at', { ascending: true });

      if (bankData && bankData.length > 0) {
        setLiveBankAccounts(
          bankData.map((b: any) => ({
            bank_name: b.bank_name || '',
            bank_account: b.account_number || b.bank_account || '',
            bank_account_name: b.account_name || b.bank_account_name || '',
            is_primary: b.is_primary ?? false
          }))
        );
      }
    } catch (err: any) {
      console.log('Catch error fetching live tenant:', err?.message || err);
    }
  };

  // Run on mount and when activeTenant changes
  useEffect(() => {
    fetchInvoices();
    fetchTenantDetails();
  }, [activeTenant.id]);

  // Re-fetch live tenant details 100% real-time whenever an invoice preview is selected
  useEffect(() => {
    const fetchTenantForPreview = async () => {
      if (selectedPreviewInvoice) {
        try {
          let tenant: any = null;
          const tenantIdToTry = selectedPreviewInvoice.tenant_id || activeUser.tenant_id || activeTenant.id;
          if (tenantIdToTry) {
            const { data } = await supabase
              .from('tenants')
              .select('*')
              .eq('id', tenantIdToTry)
              .maybeSingle();
            if (data) tenant = data;
          }

          if (!tenant) {
            const { data } = await supabase
              .from('tenants')
              .select('*')
              .limit(1)
              .maybeSingle();
            if (data) tenant = data;
          }

          if (tenant) {
            setLiveTenant(tenant);
          }

          const { data: bankData } = await supabase
            .from('bank_accounts')
            .select('*')
            .eq('tenant_id', activeUser.tenant_id || activeTenant.id)
            .order('created_at', { ascending: true });

          if (bankData && bankData.length > 0) {
            setLiveBankAccounts(
              bankData.map((b: any) => ({
                bank_name: b.bank_name || '',
                bank_account: b.account_number || b.bank_account || '',
                bank_account_name: b.account_name || b.bank_account_name || '',
                is_primary: b.is_primary ?? false
              }))
            );
          }
        } catch (err: any) {
          console.log('Catch error fetching live tenant for invoice preview (will use mock default):', err?.message || err);
        }
      }
    };
    fetchTenantForPreview();
  }, [selectedPreviewInvoice, activeUser.tenant_id, activeTenant.id]);

  // Subscribe to reactive store for backward compatibility
  useEffect(() => {
    const unsubscribe = mockDb.subscribe(() => {
      setStoreTick(prev => prev + 1);
      fetchInvoices();
      fetchTenantDetails();
    });
    return () => unsubscribe();
  }, []);

  // Fetch active tenant's orders (for dropdown selection)
  const orderList = useMemo(() => {
    return mockDb.orders.filter(o => o.tenant_id === activeTenant.id);
  }, [activeTenant.id, storeTick]);

  // Set default selected order when list loads
  useEffect(() => {
    if (orderList.length > 0 && !selectedOrderId) {
      setSelectedOrderId(orderList[0].id);
    }
  }, [orderList, selectedOrderId]);

  // KPI Calculations
  const invoiceKPIs = useMemo(() => {
    const total = invoices.length;
    const paid = invoices.filter(i => i.status === 'PAID').reduce((sum, i) => sum + Number(i.amount), 0);
    const unpaid = invoices.filter(i => i.status === 'UNPAID').reduce((sum, i) => sum + Number(i.amount), 0);
    const unpaidCount = invoices.filter(i => i.status === 'UNPAID').length;
    
    return { total, paid, unpaid, unpaidCount };
  }, [invoices]);

  // Filter invoices for search query
  const filteredInvoices = useMemo(() => {
    let list = invoices;
    
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      list = list.filter(i => {
        const orderTitle = i.orders?.title || i.order_title || '';
        const clientName = i.orders?.clients?.name || '';
        const invoiceNo = i.invoice_number || `INV-${i.id.substring(19).toUpperCase()}`;
        return orderTitle.toLowerCase().includes(q) || 
               clientName.toLowerCase().includes(q) ||
               i.billing_type.toLowerCase().includes(q) || 
               i.status.toLowerCase().includes(q) ||
               invoiceNo.toLowerCase().includes(q) ||
               i.id.includes(q);
      });
    }
    return list;
  }, [invoices, searchQuery]);

  // Quick preset calculation splits
  const applyPresetSplit = (preset: 'LUNAS_100' | 'DP_30_70' | 'DP_50_50') => {
    if (preset === 'LUNAS_100') {
      setInstallments([
        { billing_type: 'LUNAS', amount: contractValue, description: 'Pembayaran Penuh (Lunas 100%)' }
      ]);
    } else if (preset === 'DP_30_70') {
      const dpAmount = Math.round(contractValue * 0.3);
      const settlementAmount = contractValue - dpAmount;
      setInstallments([
        { billing_type: 'DP', amount: dpAmount, description: 'Termin 1 - Uang Muka (DP 30%)' },
        { billing_type: 'PELUNASAN', amount: settlementAmount, description: 'Termin 2 - Pelunasan Akhir (70%)' }
      ]);
    } else if (preset === 'DP_50_50') {
      const halfAmount = Math.round(contractValue * 0.5);
      const restAmount = contractValue - halfAmount;
      setInstallments([
        { billing_type: 'DP', amount: halfAmount, description: 'Termin 1 - Uang Muka (DP 50%)' },
        { billing_type: 'PELUNASAN', amount: restAmount, description: 'Termin 2 - Pelunasan Akhir (50%)' }
      ]);
    }
  };

  // Add Dynamic Term Row
  const handleAddInstallmentRow = () => {
    setInstallments(prev => [
      ...prev,
      { billing_type: 'PELUNASAN', amount: 0, description: `Termin ${prev.length + 1}` }
    ]);
  };

  // Remove Dynamic Term Row
  const handleRemoveInstallmentRow = (index: number) => {
    if (installments.length <= 1) return;
    setInstallments(prev => prev.filter((_, i) => i !== index));
  };

  // Update Dynamic Row values
  const handleUpdateInstallmentRow = (index: number, field: keyof InstallmentRow, value: any) => {
    setInstallments(prev => {
      const copy = [...prev];
      copy[index] = {
        ...copy[index],
        [field]: value
      };
      return copy;
    });
  };

  // Generate Payment Links via PG Abstraction Adapter & save Invoices
  const handleGenerateAndSaveTerms = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');
    setGeneratedInvoicesResult([]);

    const isFinanceOrNotary = activeUser.role === 'NOTARIS' || activeUser.role === 'FINANCE';
    if (!isFinanceOrNotary) {
      setErrorMessage('Access Denied: Hanya Finance Manager atau Notaris Utama yang diizinkan mengedit finansial.');
      return;
    }

    if (!selectedOrderId) {
      setErrorMessage('Pilih berkas order akta terlebih dahulu.');
      return;
    }

    // Validate installment rows
    for (let idx = 0; idx < installments.length; idx++) {
      const row = installments[idx];
      if (row.amount <= 0) {
        setErrorMessage(`Nominal Termin #${idx + 1} tidak boleh nol atau negatif.`);
        return;
      }
      if (!row.description.trim()) {
        setErrorMessage(`Keterangan Termin #${idx + 1} wajib diisi.`);
        return;
      }
    }

    setIsGenerating(true);

    try {
      const order = orderList.find(o => o.id === selectedOrderId);
      if (!order) throw new Error('Order tidak ditemukan');

      // Attempt to find the client to extract dynamic details for PG metadata payload
      const client = mockDb.clients.find(c => c.id === order.client_id) || {
        name: order.client_name || 'Klien Notaris',
        email: 'billing@notaris.io',
        phone: '+628123456789'
      };

      // Determine next sequence number based on the maximum sequence_number in the fetched invoices
      let maxSeq = 0;
      if (invoices && invoices.length > 0) {
        maxSeq = Math.max(...invoices.map(inv => Number(inv.sequence_number) || 0));
      }
      const startSeq = maxSeq + 1;

      // Generate invoice for each dynamic installment in parallel
      const resultsList = await Promise.all(
        installments.map(async (row, idx) => {
          const currentSeq = startSeq + idx;
          
          // Create an unique temporary invoice ID
          const hexChars = '0123456789abcdef';
          let suffix = '';
          for (let i = 0; i < 12; i++) {
            suffix += hexChars[Math.floor(Math.random() * 16)];
          }
          const tempInvoiceId = `f0000000-0000-0000-0000-${suffix}`;

          let paymentLink = '';
          if (!gatewayDisabled) {
            // Call our PaymentGatewayAdapter
            const pgResponse = await PaymentGatewayAdapter.generatePaymentLink(
              tempInvoiceId,
              row.amount,
              {
                name: client.name,
                email: client.email || 'billing@notaris.io',
                phone: client.phone || '+628123456789'
              },
              selectedProvider
            );

            if (!pgResponse.success) {
              throw new Error('Gagal berkomunikasi dengan Payment Gateway vendor.');
            }
            paymentLink = pgResponse.paymentLink;
          }

          // Logic for invoice number auto-generation (for display in results)
          const paddedSeq = String(currentSeq).padStart(3, '0');
          const now = new Date();
          const romanMonth = getRomanMonth(now.getMonth());
          const year = now.getFullYear();
          const invoiceNumber = `${paddedSeq}/INV/${romanMonth}/${year}`;

          // Calculate due_date: 7 days from now as default split date
          const dueDateObj = new Date();
          dueDateObj.setDate(dueDateObj.getDate() + 7);
          const dueDateStr = dueDateObj.toISOString().split('T')[0];

          // Insert directly to Supabase invoices table with all custom columns, wrapped in a 2.0s timeout
          let insertError: any = null;
          let isFallbackUsed = false;
          try {
            const response = await withTimeout<any>(
              supabase
                .from('invoices')
                .insert({
                  id: tempInvoiceId,
                  tenant_id: activeTenant.id,
                  order_id: selectedOrderId,
                  amount: row.amount,
                  payment_link: paymentLink || null,
                  status: 'UNPAID',
                  billing_type: row.billing_type,
                  due_date: dueDateStr,
                  invoice_number: invoiceNumber,
                  sequence_number: currentSeq,
                  created_at: new Date().toISOString()
                }) as any,
              2000
            );
            insertError = response.error;
          } catch (timeoutErr: any) {
            console.warn('Supabase insert timed out, falling back to local simulation:', timeoutErr);
            isFallbackUsed = true;
          }

          if (insertError || isFallbackUsed) {
            const isAuthorized = activeUser.role === 'NOTARIS' || activeUser.role === 'FINANCE';
            if (isAuthorized) {
              console.warn(
                `Bypassing database insert issue/timeout, falling back to secure local simulation. Error details: ${insertError?.message || 'TIMEOUT'}`
              );
              // Fallback to local insertion in mockDb
              await mockDb.addInvoice(
                activeTenant.id,
                selectedOrderId,
                `${order.title} (${row.description})`,
                row.amount,
                row.billing_type,
                paymentLink || null,
                activeUser.name,
                true, // skipSupabaseWrite
                tempInvoiceId,
                new Date().toISOString(),
                invoiceNumber,
                currentSeq,
                dueDateStr
              );
            } else {
              throw new Error(
                `Database Error: Gagal menyimpan data invoice ke Supabase. ` + (insertError?.message || 'Timeout')
              );
            }
          } else {
            // For audit log and mock compatibility, sync to mockDb too
            try {
              await mockDb.addInvoice(
                activeTenant.id,
                selectedOrderId,
                `${order.title} (${row.description})`,
                row.amount,
                row.billing_type,
                paymentLink,
                activeUser.name,
                true, // skipSupabaseWrite
                tempInvoiceId,
                new Date().toISOString(),
                invoiceNumber,
                currentSeq,
                dueDateStr
              );
            } catch (err) {
              console.warn('Silent warning syncing back to mock store:', err);
            }
          }

          return {
            billing_type: row.billing_type,
            link: paymentLink,
            amount: row.amount,
            invoice_number: invoiceNumber
          };
        })
      );

      // Re-fetch invoices from Supabase to ensure live UI update
      await fetchInvoices();

      setGeneratedInvoicesResult(resultsList);
      setSuccessMessage(
        gatewayDisabled
          ? `Berhasil menerbitkan ${installments.length} termin pembayaran tanpa Payment Gateway (Transfer Manual)!`
          : `Berhasil menerbitkan ${installments.length} termin pembayaran via ${selectedProvider} Gateway!`
      );
      
      // Reset installment creator
      setInstallments([
        { billing_type: 'LUNAS', amount: contractValue, description: 'Pembayaran Penuh 100%' }
      ]);

    } catch (err: any) {
      setErrorMessage(err.message || 'Terjadi kesalahan saat memproses Payment Gateway.');
    } finally {
      setIsGenerating(false);
    }
  };

  // Simulate Instant Settle/Payment
  const handleSimulatePayment = async (invId: string) => {
    try {
      setSettleSuccessId(invId);
      let updateError: any = null;
      let isTimeout = false;
      try {
        const response = await withTimeout<any>(
          supabase
            .from('invoices')
            .update({ status: 'PAID' })
            .eq('id', invId) as any,
          2000
        );
        updateError = response.error;
      } catch (err) {
        console.warn('Supabase update for simulate payment timed out, using local fallback:', err);
        isTimeout = true;
      }

      if (updateError || isTimeout) {
        // Fallback to local
        const idx = mockDb.invoices.findIndex(i => i.id === invId);
        if (idx !== -1) {
          mockDb.invoices[idx] = { ...mockDb.invoices[idx], status: 'PAID' };
          mockDb.notify();
        }
      } else {
        const idx = mockDb.invoices.findIndex(i => i.id === invId);
        if (idx !== -1) {
          mockDb.invoices[idx] = { ...mockDb.invoices[idx], status: 'PAID' };
          mockDb.notify();
        }
      }

      await fetchInvoices();

      if (selectedPreviewInvoice && selectedPreviewInvoice.id === invId) {
        setSelectedPreviewInvoice(prev => prev ? { ...prev, status: 'PAID' } : null);
      }
      
      setTimeout(() => {
        setSettleSuccessId(null);
      }, 3000);
    } catch (err: any) {
      console.error('Error simulating payment:', err);
      alert(err.message || 'Gagal mengubah status pembayaran');
    }
  };

  const handleCopyLink = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDeleteInvoice = async (invoiceId: string) => {
    if (!window.confirm('Apakah Anda yakin ingin menghapus invoice ini secara permanen dari database?')) return;
    try {
      let deleteError: any = null;
      let isTimeout = false;

      try {
        const response = await withTimeout<any>(
          supabase
            .from('invoices')
            .delete()
            .eq('id', invoiceId) as any,
          2000
        );
        deleteError = response.error;
      } catch (err) {
        console.warn('Supabase delete timed out, falling back to local deletion:', err);
        isTimeout = true;
      }

      if (deleteError || isTimeout) {
        const isRLS = deleteError && (deleteError.message.includes('row-level security policy') || deleteError.code === '42501');
        if (isRLS || isTimeout) {
          const isAuthorized = activeUser.role === 'NOTARIS' || activeUser.role === 'FINANCE';
          if (isAuthorized) {
            console.warn(
              `Bypassing stateless Supabase RLS/timeout restriction on DELETE for authorized simulated role: ${activeUser.role}`
            );
            mockDb.invoices = mockDb.invoices.filter(i => i.id !== invoiceId);
            mockDb.notify();
          } else {
            throw new Error(
              `Kesalahan RLS Postgres (Hak Akses Ditolak): Peran sesi database Anda tidak memiliki izin untuk menghapus data invoice dari tabel 'invoices'.\n\n` +
              `Skema RLS membatasi modifikasi finansial hanya untuk peran NOTARIS atau FINANCE.`
            );
          }
        } else {
          throw deleteError;
        }
      } else {
        mockDb.invoices = mockDb.invoices.filter(i => i.id !== invoiceId);
        mockDb.notify();
      }

      await fetchInvoices();

      if (selectedPreviewInvoice && selectedPreviewInvoice.id === invoiceId) {
        setSelectedPreviewInvoice(null);
      }
      
      setSuccessMessage('Invoice berhasil dihapus!');
    } catch (err: any) {
      console.error('Error deleting invoice:', err);
      alert(err.message || 'Gagal menghapus invoice');
    }
  };

  const sumTerminTotal = installments.reduce((sum, item) => sum + item.amount, 0);

  const isLogoEmpty = !fullTenant?.logo_url;
  const isNotaryNameEmpty = !fullTenant?.company_name;
  const isSkMenkumhamEmpty = !fullTenant?.sk_menkumham;
  const isAddressEmpty = !fullTenant?.address;
  const isPhoneEmpty = !fullTenant?.phone;
  const isEmailEmpty = !fullTenant?.email;
  const isBankEmpty = !fullTenant?.bank_name || !fullTenant?.bank_account || !fullTenant?.bank_account_name;

  const hasIncompleteSettings = isNotaryNameEmpty || isSkMenkumhamEmpty || isAddressEmpty || isPhoneEmpty || isEmailEmpty || isBankEmpty;

  return (
    <div id="invoice-mgmt-container" className="space-y-6">
      
      {/* Header Info Block */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-emerald-500/10 text-emerald-400 p-2.5 rounded-lg border border-emerald-500/20">
              <DollarSign className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                Faktur, Tagihan & Pembayaran
                <span className="text-[10px] bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2 py-0.5 rounded font-mono font-bold uppercase tracking-wider">
                  Enterprise Finance
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Pecah termin dinamis dengan otomatisasi token checkout via Midtrans, Mayar, dan Doku.
              </p>
            </div>
          </div>
          
          {activeUser.role !== 'STAFF' && (
            <button
              onClick={() => setIsCreateOpen(true)}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow transition-all cursor-pointer font-sans"
            >
              <Plus className="w-4 h-4" />
              Buat Invoice Baru (Termin Dinamis)
            </button>
          )}
        </div>

        {/* Dynamic Security Badge */}
        <div className="mt-4 p-3 bg-slate-950 rounded-lg border border-slate-800 text-[11px] text-slate-400 flex items-start gap-2 leading-relaxed">
          <div className="flex items-start gap-2 w-full">
            <span className="flex h-2 w-2 rounded-full bg-emerald-500 shrink-0 mt-1.5 animate-pulse" />
            <div className="flex justify-between items-center w-full">
              <span>
                Anda masuk sebagai <strong>{activeUser.name}</strong> ({activeUser.role === 'STAFF' ? 'Staf Pelaksana • Akses Lihat-Saja' : `Hak Akses Penuh Keuangan (${activeUser.role})`}). 
              </span>
              <span className="text-[9px] text-slate-500 font-mono">
                Isolated Tenant ID: {activeTenant.id.substring(0, 8)}...
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Row 1: KPI Statistics Dashboard */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block font-mono">
              Omzet Terbayar (PAID)
            </span>
            <h3 className="text-xl font-bold text-emerald-400 mt-1 font-mono">
              {invoiceKPIs.paid.toLocaleString('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 })}
            </h3>
            <span className="text-[9px] text-slate-500 block mt-1 font-sans">Settle via Payment Gateway API</span>
          </div>
          <div className="bg-emerald-500/10 text-emerald-400 p-2.5 rounded-lg border border-emerald-500/20">
            <Check className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block font-mono">
              Piutang Tertunda (UNPAID)
            </span>
            <h3 className="text-xl font-bold text-amber-500 mt-1 font-mono">
              {invoiceKPIs.unpaid.toLocaleString('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 })}
            </h3>
            <span className="text-[9px] text-slate-500 block mt-1 font-sans">Belum Dibayar atau Pending Link</span>
          </div>
          <div className="bg-amber-500/10 text-amber-400 p-2.5 rounded-lg border border-amber-500/20">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block font-mono">
              Rasio Tagihan Belum Lunas
            </span>
            <h3 className="text-xl font-bold text-slate-200 mt-1 font-mono">
              {invoiceKPIs.unpaidCount} <span className="text-xs text-slate-500 font-normal">tagihan</span>
            </h3>
            <span className="text-[9px] text-slate-500 block mt-1 font-sans">Dari total {invoiceKPIs.total} invoice</span>
          </div>
          <div className="bg-slate-950 p-2.5 rounded-lg text-slate-400 border border-slate-800">
            <FileText className="w-5 h-5" />
          </div>
        </div>

      </div>

      {/* Filter and Search Bar */}
      <div className="flex items-center bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 shadow-inner">
        <Search className="w-4 h-4 text-slate-500 shrink-0 mr-3" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Cari invoice berdasarkan nama akta, tipe tagihan (DP/Pelunasan/Lunas), atau status..."
          className="bg-transparent text-slate-200 placeholder:text-slate-500 focus:outline-none text-xs w-full font-sans"
        />
        {searchQuery && (
          <button onClick={() => setSearchQuery('')} className="text-slate-500 hover:text-slate-300">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Invoices List Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow">
        {filteredInvoices.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <CreditCard className="w-12 h-12 text-slate-700 mx-auto mb-3" />
            <p className="text-sm font-medium text-slate-400">Tidak ada tagihan atau invoice ditemukan</p>
            <p className="text-xs text-slate-600 mt-1">Belum ada tagihan terdaftar untuk tenant Anda.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/40 text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">
                  <th className="py-3 px-6">ID Invoice & Tipe</th>
                  <th className="py-3 px-6">Order Berkas Akta</th>
                  <th className="py-3 px-6">Nominal & Tanggal</th>
                  <th className="py-3 px-6">Status Tagihan</th>
                  <th className="py-3 px-6 text-center">Tautan PG / Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-xs">
                {filteredInvoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-3.5 px-6 space-y-1.5">
                      <span className="font-mono font-bold text-slate-300 block leading-none">
                        {inv.invoice_number || `INV-${inv.id.substring(19).toUpperCase()}`}
                      </span>
                      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-extrabold font-mono border ${
                        inv.billing_type === 'DP' 
                          ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' 
                          : inv.billing_type === 'PELUNASAN' 
                            ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' 
                            : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                      }`}>
                        BILLING: {inv.billing_type}
                      </span>
                    </td>
                    <td className="py-3.5 px-6 font-semibold text-slate-200">
                      {inv.orders?.title || inv.order_title}
                    </td>
                    <td className="py-3.5 px-6 space-y-1">
                      <span className="block font-bold font-mono text-slate-200 text-xs">
                        {inv.amount.toLocaleString('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 })}
                      </span>
                      <span className="text-[10px] text-slate-500 block">
                        Dibuat: {new Date(inv.created_at).toLocaleDateString('id-ID')}
                      </span>
                    </td>
                    <td className="py-3.5 px-6">
                      {inv.status === 'PAID' ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono tracking-wide uppercase">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          LUNAS (SETTLED)
                        </span>
                      ) : inv.status === 'EXPIRED' ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-500/10 text-slate-500 border border-slate-700 font-mono tracking-wide uppercase">
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                          KEDALUWARSA
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 font-mono tracking-wide uppercase">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                          BELUM DIBAYAR
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-6">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => setSelectedPreviewInvoice(inv)}
                          className="flex items-center gap-1 px-2.5 py-1 bg-indigo-600/90 hover:bg-indigo-500 text-white rounded font-sans text-[10px] font-bold transition-all cursor-pointer shadow-sm"
                          title="Pratinjau & Cetak Invoice Resmi"
                        >
                          <FileText className="w-3 h-3" />
                          <span>Lihat Invoice</span>
                        </button>

                        {(activeUser.role === 'NOTARIS' || activeUser.role === 'FINANCE') && (
                          <button
                            onClick={() => {
                              setEditingInvoiceId(inv.id);
                              setEditAmount(inv.amount);
                              setEditBillingType(inv.billing_type);
                              setEditStatus(inv.status);
                              setEditPaymentLink(inv.payment_link || '');
                            }}
                            className="flex items-center gap-1 px-2.5 py-1 bg-amber-500/10 hover:bg-amber-600 hover:text-white text-amber-400 border border-amber-500/20 rounded font-sans text-[10px] font-bold transition-all cursor-pointer shadow-sm"
                            title="Edit rincian tagihan invoice"
                          >
                            <Edit className="w-3 h-3" />
                            <span>Edit Invoice</span>
                          </button>
                        )}

                        {inv.status === 'UNPAID' && activeUser.role !== 'STAFF' && (
                          <button
                            onClick={() => handleSimulatePayment(inv.id)}
                            className="px-2 py-1 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500 hover:text-white rounded text-[10px] font-bold transition-all cursor-pointer font-sans"
                            title="Konfirmasi pelunasan tagihan klien"
                          >
                            {settleSuccessId === inv.id ? 'Memproses...' : 'Konfirmasi Bayar'}
                          </button>
                        )}

                        {activeUser.role === 'NOTARIS' && (
                          <button
                            onClick={() => handleDeleteInvoice(inv.id)}
                            className="p-1 text-slate-400 hover:bg-rose-500/15 hover:text-rose-400 rounded transition-all cursor-pointer"
                            title="Hapus Invoice"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {inv.gateway_disabled ? (
                          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider bg-slate-950/60 px-2 py-1 rounded border border-slate-850/60 shrink-0 select-none">
                            MANUAL TRANSFER
                          </span>
                        ) : (
                          <>
                            <button
                              onClick={() => handleCopyLink(inv.payment_link, inv.id)}
                              className="flex items-center gap-1 px-2.5 py-1 bg-slate-950 border border-slate-800 text-slate-400 hover:text-slate-200 rounded font-mono text-[10px] transition-all cursor-pointer"
                            >
                              {copiedId === inv.id ? (
                                <>
                                  <Check className="w-3 h-3 text-emerald-500" />
                                  <span className="text-emerald-500">Copied</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3 h-3" />
                                  <span>Copy Link</span>
                                </>
                              )}
                            </button>
                            
                            <a
                              href={inv.payment_link}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded transition-colors"
                              title="Buka Halaman Checkout Vendor"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* CREATE DYNAMIC TERMIN INVOICE MODAL */}
      <AnimatePresence>
        {isCreateOpen && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-900 border border-slate-800 rounded-xl p-6 w-full max-w-2xl shadow-2xl relative max-h-[92vh] overflow-y-auto"
            >
              <button
                onClick={() => { 
                  setIsCreateOpen(false); 
                  setSuccessMessage(''); 
                  setGeneratedInvoicesResult([]); 
                  setErrorMessage('');
                }}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>

              <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider font-sans mb-1 flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-emerald-400" />
                Menerbitkan Termin Finansial (Dynamic Installments)
              </h3>
              <p className="text-xs text-slate-400 mb-4">
                Pecah pembayaran menjadi beberapa kali tagihan terpisah yang terintegrasi dengan adapter gateway multi-vendor.
              </p>

              <form onSubmit={handleGenerateAndSaveTerms} className="space-y-5">
                
                {errorMessage && (
                  <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg text-rose-400 text-xs flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 shrink-0" />
                    <span>{errorMessage}</span>
                  </div>
                )}

                 {successMessage && (
                  <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-400 text-xs space-y-3">
                    <div className="flex items-center gap-2 font-bold text-sm">
                      <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-400" />
                      <span>{successMessage}</span>
                    </div>
                    
                    <div className="space-y-2 pt-2 border-t border-emerald-500/20">
                      <span className="font-bold uppercase tracking-wider text-[10px] block text-slate-300">
                        {gatewayDisabled ? 'Daftar Invoice Terbit (Transfer Manual):' : 'Generated Links (TTL: 180 Hari):'}
                      </span>
                      {generatedInvoicesResult.map((res, index) => (
                        <div key={index} className="p-2 bg-slate-950 rounded border border-slate-800/80 text-[10px] font-mono break-all text-slate-300 space-y-1">
                          <div className="flex justify-between items-center text-[9px] text-emerald-500 font-bold">
                            <span>TERMIN #{index + 1} - {res.billing_type}</span>
                            <span>{res.amount.toLocaleString('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 })}</span>
                          </div>
                          {!gatewayDisabled && res.link && (
                            <div className="flex items-center justify-between gap-2 bg-slate-900/50 p-1 rounded mt-1">
                              <span className="truncate text-slate-400 max-w-[340px]">{res.link}</span>
                              <button 
                                type="button" 
                                onClick={() => handleCopyLink(res.link, `modal-${index}`)}
                                className="px-2 py-0.5 bg-slate-800 text-slate-300 hover:text-white rounded text-[9px]"
                              >
                                {copiedId === `modal-${index}` ? 'Copied' : 'Copy'}
                              </button>
                            </div>
                          )}
                          {gatewayDisabled && (
                            <div className="text-[9px] text-slate-500 italic mt-1">
                              Penyelesaian via rekening transfer manual di rincian invoice.
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Grid row: Order selection & Provider selection */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  
                  {/* Select Order */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Pilih Berkas Order Akta</label>
                    <select
                      value={selectedOrderId}
                      onChange={(e) => setSelectedOrderId(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 font-sans"
                    >
                      {orderList.map(order => (
                        <option key={order.id} value={order.id}>
                          {order.title}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Payment Gateway Provider Selector */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                      Metode Pembayaran & Gateway
                      {!gatewayDisabled && (
                        <span className="text-[9px] bg-emerald-500/10 text-emerald-400 px-1.5 py-0.2 rounded font-mono">
                          Active Adapter
                        </span>
                      )}
                    </label>
                    {gatewayDisabled ? (
                      <div className="w-full px-3 py-2 bg-slate-950 border border-slate-850 rounded-lg text-slate-500 text-xs italic font-medium flex items-center gap-2">
                        <span className="h-1.5 w-1.5 rounded-full bg-slate-600 animate-pulse"></span>
                        Tanpa Payment Gateway (Hanya Transfer Manual)
                      </div>
                    ) : (
                      <select
                        value={selectedProvider}
                        onChange={(e) => setSelectedProvider(e.target.value as PaymentProvider)}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 font-sans font-semibold"
                      >
                        <option value="MIDTRANS">Midtrans Gateway (Simulated Response)</option>
                        <option value="MAYAR">Mayar Link (Simulated Response)</option>
                        <option value="DOKU">Doku Jokul API (Simulated Response)</option>
                      </select>
                    )}
                    
                    <div className="flex items-center gap-1.5 pt-1.5">
                      <input
                        type="checkbox"
                        id="toggle-gateway-disabled"
                        checked={gatewayDisabled}
                        onChange={(e) => setGatewayDisabled(e.target.checked)}
                        className="rounded bg-slate-950 border-slate-800 text-indigo-500 focus:ring-0 focus:ring-offset-0 w-3.5 h-3.5 cursor-pointer"
                      />
                      <label htmlFor="toggle-gateway-disabled" className="text-[10px] font-bold text-slate-400 uppercase tracking-wide cursor-pointer select-none">
                        Nonaktifkan Payment Gateway (Tanpa Checkout Link)
                      </label>
                    </div>
                  </div>

                </div>

                {/* Preset Split Helper Block */}
                <div className="bg-slate-950 border border-slate-800/80 rounded-xl p-4 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="space-y-0.5">
                      <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider block">
                        Kalkulator Preset Split Termin (Helper)
                      </span>
                      <p className="text-[10px] text-slate-500">
                        Input total nilai kontrak akta lalu pilih preset untuk membagi nominal tagihan instan.
                      </p>
                    </div>
                    
                    <div className="relative max-w-[180px]">
                      <span className="absolute left-3 top-1.5 text-[11px] text-slate-500 font-bold font-mono">Rp</span>
                      <input
                        type="number"
                        value={contractValue || ''}
                        onChange={(e) => setContractValue(Number(e.target.value))}
                        className="w-full pl-8 pr-2 py-1 bg-slate-900 border border-slate-850 rounded-lg text-slate-200 text-xs font-mono focus:outline-none"
                        placeholder="10000000"
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => applyPresetSplit('LUNAS_100')}
                      className="px-3 py-1 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded text-[10px] font-medium hover:bg-indigo-500/20 transition-all cursor-pointer font-sans"
                    >
                      Preset: Lunas 100%
                    </button>
                    <button
                      type="button"
                      onClick={() => applyPresetSplit('DP_30_70')}
                      className="px-3 py-1 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded text-[10px] font-medium hover:bg-indigo-500/20 transition-all cursor-pointer"
                    >
                      Preset: DP 30% + Pelunasan 70%
                    </button>
                    <button
                      type="button"
                      onClick={() => applyPresetSplit('DP_50_50')}
                      className="px-3 py-1 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded text-[10px] font-medium hover:bg-indigo-500/20 transition-all cursor-pointer"
                    >
                      Preset: DP 50% + Pelunasan 50%
                    </button>
                  </div>
                </div>

                {/* Installments Table Builder */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                      Konfigurasi Rincian Termin ({installments.length})
                    </label>
                    
                    <button
                      type="button"
                      onClick={handleAddInstallmentRow}
                      className="flex items-center gap-1 text-[10px] font-bold text-emerald-400 hover:text-emerald-300 transition-colors cursor-pointer font-sans"
                    >
                      <ListPlus className="w-3.5 h-3.5" />
                      Tambah Baris Tagihan
                    </button>
                  </div>

                  <div className="space-y-3">
                    {installments.map((row, index) => (
                      <div key={index} className="flex flex-col sm:flex-row gap-3 items-end sm:items-center bg-slate-950 p-3 rounded-lg border border-slate-850">
                        <span className="text-[10px] text-slate-500 font-mono font-bold self-start mt-1 sm:mt-0 sm:self-center">
                          #{index + 1}
                        </span>

                        {/* Billing Type select */}
                        <div className="w-full sm:w-1/4 space-y-0.5">
                          <span className="text-[9px] text-slate-500 uppercase font-mono">Tipe Tagihan</span>
                          <select
                            value={row.billing_type}
                            onChange={(e) => handleUpdateInstallmentRow(index, 'billing_type', e.target.value as any)}
                            className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded text-slate-350 text-xs focus:outline-none"
                          >
                            <option value="DP">Uang Muka (DP)</option>
                            <option value="PELUNASAN">Pelunasan</option>
                            <option value="LUNAS">Lunas 100%</option>
                          </select>
                        </div>

                        {/* Amount */}
                        <div className="w-full sm:w-1/3 space-y-0.5">
                          <span className="text-[9px] text-slate-500 uppercase font-mono">Nominal (IDR)</span>
                          <div className="relative">
                            <span className="absolute left-2.5 top-1.5 text-xs text-slate-500 font-bold font-mono">Rp</span>
                            <input
                              type="number"
                              value={row.amount || ''}
                              onChange={(e) => handleUpdateInstallmentRow(index, 'amount', Number(e.target.value))}
                              placeholder="0"
                              className="w-full pl-8 pr-2 py-1 bg-slate-900 border border-slate-800 rounded text-slate-200 text-xs font-mono focus:outline-none"
                            />
                          </div>
                        </div>

                        {/* Description */}
                        <div className="w-full sm:w-1/3 space-y-0.5">
                          <span className="text-[9px] text-slate-500 uppercase font-mono">Keterangan / Notes</span>
                          <input
                            type="text"
                            value={row.description}
                            onChange={(e) => handleUpdateInstallmentRow(index, 'description', e.target.value)}
                            placeholder="Contoh: DP Pembayaran Pertama"
                            className="w-full px-2.5 py-1 bg-slate-900 border border-slate-800 rounded text-slate-200 text-xs focus:outline-none"
                          />
                        </div>

                        {/* Delete Row button */}
                        <button
                          type="button"
                          onClick={() => handleRemoveInstallmentRow(index)}
                          disabled={installments.length <= 1}
                          className="p-1.5 bg-slate-900 hover:bg-rose-950/30 text-slate-500 hover:text-rose-400 rounded transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                          title="Hapus baris termin ini"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Dynamic Summary Block */}
                  <div className="flex justify-between items-center text-[10px] font-mono px-2 py-1 text-slate-500 border-t border-slate-850 mt-3">
                    <span>Total tagihan dikonfigurasi:</span>
                    <span className="text-slate-300 font-bold">
                      {sumTerminTotal.toLocaleString('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 })}
                    </span>
                  </div>
                </div>

                {/* Expiry Simulation Note */}
                <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800 text-[10px] text-slate-500 leading-normal flex items-start gap-1.5">
                  <ArrowRightLeft className="w-3.5 h-3.5 text-indigo-400 shrink-0 mt-0.5" />
                  <span>
                    Arsitektur integrasi menggunakan adaptor abstrak <code>PaymentGatewayAdapter</code>. Jika Anda beralih ke vendor nyata di masa depan, sistem tidak memerlukan perubahan UI sama sekali!
                  </span>
                </div>

                {/* Actions */}
                <div className="pt-2 flex justify-end gap-3 text-xs font-semibold border-t border-slate-800/50">
                  <button
                    type="button"
                    onClick={() => { 
                      setIsCreateOpen(false); 
                      setSuccessMessage(''); 
                      setGeneratedInvoicesResult([]); 
                      setErrorMessage('');
                    }}
                    className="px-4 py-2 hover:bg-slate-800 text-slate-400 rounded-lg transition-colors"
                  >
                    Tutup
                  </button>
                  <button
                    type="submit"
                    disabled={isGenerating}
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {isGenerating ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>Membangun Integrasi API...</span>
                      </>
                    ) : (
                      <>
                        <LinkIcon className="w-3.5 h-3.5" />
                        <span>Simpan & Generate Link PG ({selectedProvider})</span>
                      </>
                    )}
                  </button>
                </div>

              </form>
            </motion.div>
          </div>
        )}

        {/* PROFESSIONAL INVOICE PREVIEW MODAL */}
        {selectedPreviewInvoice && resolvedPreviewDetails && (
          <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto no-print">
            {/* Dynamic CSS Print Overlay Style Injection */}
            <style dangerouslySetInnerHTML={{ __html: `
              @media print {
                @page {
                  size: A4 portrait;
                  margin: 15mm;
                }
                body {
                  background: #ffffff !important;
                  color: #111111 !important;
                  -webkit-print-color-adjust: exact !important;
                  print-color-adjust: exact !important;
                }
                /* Hide everything */
                body * {
                  visibility: hidden !important;
                }
                /* Show ONLY the print area and its children */
                #invoice-download-area, #invoice-download-area *, #print-invoice-area, #print-invoice-area * {
                  visibility: visible !important;
                }
                #invoice-download-area, #print-invoice-area {
                  position: absolute !important;
                  left: 0 !important;
                  top: 0 !important;
                  width: 100% !important;
                  max-width: 100% !important;
                  height: auto !important;
                  background: #ffffff !important;
                  color: #111111 !important;
                  padding: 0 !important;
                  margin: 0 !important;
                  box-shadow: none !important;
                  border: none !important;
                  border-radius: 0 !important;
                }
                .no-print {
                  display: none !important;
                }
              }
            `}} />

            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col no-print max-h-[92vh]"
            >
              {/* Modal Top Control Bar */}
              <div className="bg-slate-950 border-b border-slate-850 px-6 py-4 flex items-center justify-between no-print shrink-0">
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-indigo-400" />
                  <div>
                    <h3 className="text-sm font-bold text-slate-100 font-sans">
                      Invoice Review & Dispatch Center
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      Unduh PDF resmi atau komunikasikan rincian tagihan ini langsung ke klien Anda.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {/* Download PDF Button */}
                  <button
                    onClick={handleDownloadPDF}
                    disabled={isDownloadingPdf}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all cursor-pointer font-sans disabled:opacity-50 shadow-sm"
                    title="Simpan & Download Invoice sebagai File PDF (A4)"
                  >
                    {isDownloadingPdf ? (
                      <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <Download className="w-3.5 h-3.5" />
                    )}
                    <span>{isDownloadingPdf ? 'Memproses PDF...' : 'Download PDF'}</span>
                  </button>

                  {/* Print Button */}
                  <button
                    onClick={handleTriggerPrint}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition-all cursor-pointer font-sans"
                    title="Cetak A4 / Dialog Cetak Browser"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Cetak</span>
                  </button>

                  {/* Share Dropdown Wrapper */}
                  <div className="relative">
                    <button
                      onClick={() => setIsShareDropdownOpen(!isShareDropdownOpen)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-bold transition-all cursor-pointer font-sans"
                    >
                      <Send className="w-3.5 h-3.5" />
                      Kirim ke Klien
                    </button>

                    {isShareDropdownOpen && (
                      <div className="absolute right-0 mt-2 w-56 bg-slate-950 border border-slate-800 rounded-lg shadow-xl py-2 z-50">
                        <button
                          onClick={() => {
                            handleShareWhatsApp();
                            setIsShareDropdownOpen(false);
                          }}
                          className="w-full text-left px-4 py-2 hover:bg-indigo-950/40 text-slate-300 hover:text-white text-xs flex items-center gap-2 transition-colors cursor-pointer"
                        >
                          <MessageCircle className="w-4 h-4 text-emerald-400" />
                          <span>Kirim via WhatsApp Link</span>
                        </button>
                        <button
                          onClick={() => {
                            handleShareEmail();
                            setIsShareDropdownOpen(false);
                          }}
                          className="w-full text-left px-4 py-2 hover:bg-indigo-950/40 text-slate-300 hover:text-white text-xs flex items-center gap-2 transition-colors cursor-pointer"
                        >
                          <Mail className="w-4 h-4 text-blue-400" />
                          <span>Kirim via Email Draft</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Close Button */}
                  <button
                    onClick={() => {
                      setSelectedPreviewInvoice(null);
                      setIsShareDropdownOpen(false);
                    }}
                    className="p-1.5 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Scrollable Paper Container (simulated desktop look) */}
              <div className="p-6 bg-slate-950 overflow-y-auto flex-1 flex flex-col items-center gap-6">
                
                {hasIncompleteSettings && (
                  <div className="no-print w-full md:w-[794px] bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 flex items-start gap-3">
                    <div className="p-2 bg-amber-500/10 rounded-lg text-amber-500 shrink-0">
                      <AlertTriangle className="w-5 h-5" />
                    </div>
                    <div className="space-y-1 font-sans text-left">
                      <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                        Pengaturan Kantor Belum Lengkap
                      </h4>
                      <p className="text-[11px] text-slate-300 leading-relaxed">
                        Beberapa informasi penting kantor Anda belum diisi atau masih menggunakan data default di halaman <strong>Pengaturan Kantor</strong>. 
                        Mohon lengkapi data tersebut agar Invoice tercetak dengan informasi resmi yang valid:
                      </p>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1 text-[10px] font-mono text-amber-500">
                        {isNotaryNameEmpty && <span>• Nama Notaris Utama</span>}
                        {isSkMenkumhamEmpty && <span>• SK Menkumham</span>}
                        {isAddressEmpty && <span>• Alamat Kantor</span>}
                        {isPhoneEmpty && <span>• Telepon Kantor</span>}
                        {isEmailEmpty && <span>• Email Kantor</span>}
                        {isBankEmpty && <span>• Rekening Bank Utama</span>}
                      </div>
                    </div>
                  </div>
                )}

                {/* INVOICE SHEET (Elegant minimalist A4 white document styling) */}
                <div 
                  id="invoice-download-area"
                  className="bg-white text-black w-full md:w-[794px] min-h-[1050px] p-8 md:p-12 shadow-2xl border border-slate-200 font-serif relative flex flex-col justify-between overflow-hidden"
                >
                  <div className="flex-1 flex flex-col justify-between">
                    <div>
                      {/* Kop Surat / Letterhead (Exactly matching screenshot layout, but using custom logo) */}
                      <div className="text-center text-black border-b-[3px] border-black pb-4 mb-5 flex flex-col items-center">
                        {fullTenant?.logo_url ? (
                          <img 
                            src={fullTenant.logo_url} 
                            alt="Logo Notaris" 
                            className="w-16 h-16 object-contain mb-2 rounded"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <img 
                            src="/pancasila.png" 
                            alt="Logo Notaris Default" 
                            className="w-16 h-16 object-contain mb-2 rounded"
                            referrerPolicy="no-referrer"
                          />
                        )}
                        <h1 className="text-sm font-bold tracking-[0.2em] leading-tight uppercase font-serif">NOTARIS</h1>
                        <h2 className="text-base font-extrabold tracking-wider uppercase mt-1 font-serif">
                          {resolvedPreviewDetails?.notaryName || fullTenant?.company_name || (
                            <span className="text-rose-500 italic block text-xs">Nama Notaris Utama Belum Diatur</span>
                          )}
                        </h2>
                        <p className="text-[10px] leading-normal mt-1 text-black/95">SK. Menteri Hukum dan Hak Asasi Manusia Republik Indonesia</p>
                        <p className="text-[10px] leading-normal text-black/95">
                          Nomor : {fullTenant?.sk_menkumham || (
                            <span className="text-rose-500 italic text-[10px]">SK Menkumham belum diisi</span>
                          )}
                        </p>
                        <p className="text-[10px] leading-relaxed mt-0.5 text-black/90">
                          {fullTenant?.address || (
                            <span className="text-rose-500 italic text-[10px] block">Alamat belum diatur</span>
                          )}
                        </p>
                        <p className="text-[10px] leading-relaxed text-black/90">
                          Telp {fullTenant?.phone || (
                            <span className="text-rose-500 italic text-[10px]">Telepon belum diatur</span>
                          )} / email : {fullTenant?.email || (
                            <span className="text-rose-500 italic text-[10px]">Email belum diatur</span>
                          )}
                        </p>
                      </div>

                      {/* Date Block */}
                      <div className="text-right text-xs text-black mb-4 font-medium">
                        Jakarta, {new Date(selectedPreviewInvoice.created_at).toLocaleDateString('id-ID', {
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric'
                        })}
                      </div>

                      {/* Invoice Meta Grid */}
                      <div className="text-left text-xs text-black space-y-1 mb-5 leading-relaxed">
                        <p className="font-bold underline text-sm tracking-wide uppercase">INVOICE</p>
                        <p className="font-mono">Nomor : {resolvedPreviewDetails.invoiceNo}</p>
                        <p className="pt-1.5 font-medium">Kepada Yth.</p>
                        <p className="font-bold uppercase text-sm tracking-normal">{resolvedPreviewDetails.clientName}</p>
                        <p className="font-medium">Di Tempat</p>
                      </div>

                      {/* Modern Rounded Border Table */}
                      <div className="my-5 border border-black rounded-lg overflow-hidden">
                        <table className="w-full text-left border-collapse text-xs font-serif">
                          <thead>
                            <tr className="bg-slate-50/50">
                              <th className="border-r border-b border-black py-2 px-2 text-center w-12 font-extrabold uppercase">No.</th>
                              <th className="border-r border-b border-black py-2 px-4 text-center font-extrabold uppercase">LEGALITAS</th>
                              <th className="border-b border-black py-2 px-4 text-center w-52 font-extrabold uppercase">BIAYA</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr className="align-top">
                              <td className="border-r border-b border-black py-3 px-2 text-center font-medium">1.</td>
                              <td className="border-r border-b border-black py-3 px-4">
                                <div className="space-y-1.5 leading-relaxed text-left">
                                  <p className="font-bold">Biaya Jasa Notaris:</p>
                                  <div className="pl-4 flex items-start gap-1.5">
                                    <span className="shrink-0">-</span>
                                    <span className="font-medium">{selectedPreviewInvoice.order_title}</span>
                                  </div>
                                  {resolvedPreviewDetails.order?.description && (
                                    <div className="pl-4 flex items-start gap-1.5 text-black/80 text-[10px] leading-normal">
                                      <span className="shrink-0">•</span>
                                      <span>{resolvedPreviewDetails.order.description}</span>
                                    </div>
                                  )}
                                  <div className="pl-4 text-[10px] text-black/70 font-mono">
                                    Status Termin: {selectedPreviewInvoice.billing_type === 'DP' ? 'Uang Muka (DP)' : selectedPreviewInvoice.billing_type === 'PELUNASAN' ? 'Pelunasan Akhir' : 'Lunas Penuh (100%)'}
                                  </div>
                                </div>
                              </td>
                              <td className="border-b border-black py-3 px-4 text-left font-bold text-xs whitespace-nowrap">
                                {resolvedPreviewDetails.formattedAmount}
                              </td>
                            </tr>
                            
                            {/* Total row with rounded design */}
                            <tr className="font-bold">
                              <td colSpan={2} className="border-r border-black py-2.5 px-4 text-center font-extrabold uppercase tracking-wider text-xs">
                                TOTAL HARGA
                              </td>
                              <td className="py-2.5 px-4 text-left font-extrabold text-xs leading-relaxed">
                                {resolvedPreviewDetails.formattedAmount}
                                <span className="font-normal block text-[10px] text-black/85 mt-0.5">
                                  ({resolvedPreviewDetails.spelledAmount})
                                </span>
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>

                      {/* Notes Section matching screenshot exactly */}
                      <div className="text-left text-[11px] text-black leading-relaxed space-y-2.5 mt-5">
                        <p className="italic font-bold">Catatan Harga tersebut diluar dari harga PPN</p>
                        
                        <div className="space-y-0.5">
                          <p>Semua pembayaran ditujukan ke rekening Bank berikut:</p>
                          <div className="pl-4 space-y-0.5">
                            {bankAccounts.length > 0 ? (
                              bankAccounts.map((acc, index) => (
                                <p key={index}>
                                  {String.fromCharCode(97 + index)}. Rekening <span className="font-bold">{acc.bank_name || '(Belum Diatur)'}</span> pada nomor <span className="font-bold">{acc.bank_account || '(Belum Diatur)'}</span> atas nama {acc.bank_account_name || fullTenant.notary_name || fullTenant.name || resolvedPreviewDetails.notaryName};
                                </p>
                              ))
                            ) : (
                              <>
                                <p className="text-rose-500 italic">a. Rekening Bank Utama belum diatur di menu Pengaturan Kantor.</p>
                                <p>b. Rekening BCA pada nomor <span className="font-bold font-mono">6080002678</span> atas nama SUTRA OKTAVIANI.</p>
                              </>
                            )}
                          </div>
                        </div>

                        <p className="pt-0.5">Demikian kami sampaikan, atas perhatian dan kerjasamanya kami ucapkan terima kasih.</p>
                      </div>
                    </div>

                    {/* Signatures block without simulated overlays for real signatures */}
                    <div className="flex justify-end mt-8 text-xs text-black">
                      <div className="text-right w-64 space-y-1">
                        <p className="pr-12 font-medium">Hormat Kami,</p>
                        
                        {/* Space for manual signing or physical stamp */}
                        <div className="h-20"></div>

                        <div className="pr-10">
                          <p className="font-extrabold underline text-xs uppercase leading-tight">{resolvedPreviewDetails.notaryName}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- EDIT INVOICE DETAILS MODAL --- */}
      <AnimatePresence>
        {editingInvoiceId && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-900 border border-slate-800 rounded-xl p-6 w-full max-w-md shadow-2xl relative space-y-4"
            >
              <button
                onClick={() => setEditingInvoiceId(null)}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-amber-500" />
                <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider font-sans">
                  Edit Detail Tagihan Invoice
                </h3>
              </div>
              <p className="text-[11px] text-slate-400">
                Ubah nominal, status pelunasan, termin, atau tautan pembayaran eksternal untuk tagihan ini.
              </p>

              <form onSubmit={handleUpdateInvoice} className="space-y-4 pt-2">
                {/* Nominal Input */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    Nominal Tagihan (IDR)
                  </label>
                  <input
                    type="number"
                    required
                    value={editAmount}
                    onChange={(e) => setEditAmount(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500 font-mono"
                  />
                </div>

                {/* Billing Type (Termin) */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    Tipe / Termin Tagihan
                  </label>
                  <select
                    value={editBillingType}
                    onChange={(e) => setEditBillingType(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500"
                  >
                    <option value="DP">Uang Muka (DP)</option>
                    <option value="PELUNASAN">Pelunasan</option>
                    <option value="LUNAS">Penuh (Lunas Langsung)</option>
                  </select>
                </div>

                {/* Status */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    Status Pembayaran
                  </label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500"
                  >
                    <option value="UNPAID">Belum Dibayar</option>
                    <option value="PAID">Lunas (Paid)</option>
                    <option value="EXPIRED">Kedaluwarsa</option>
                  </select>
                </div>

                {/* Payment Link */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    Tautan Pembayaran (Payment Link)
                  </label>
                  <input
                    type="text"
                    value={editPaymentLink}
                    onChange={(e) => setEditPaymentLink(e.target.value)}
                    placeholder="https://checkout.midtrans.com/..."
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500 font-mono"
                  />
                </div>

                {/* Actions */}
                <div className="pt-2 flex justify-end gap-3 text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => setEditingInvoiceId(null)}
                    className="px-4 py-2 hover:bg-slate-800 text-slate-400 rounded-lg transition-colors cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={isUpdatingInvoice}
                    className="px-5 py-2 bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center"
                  >
                    {isUpdatingInvoice ? 'Menyimpan...' : 'Simpan Perubahan'}
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
