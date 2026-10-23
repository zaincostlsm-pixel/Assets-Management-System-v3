import React, { useState, useEffect, useRef } from 'react';
import {
  FilePlus2,
  CheckCircle2,
  AlertCircle,
  Upload,
  X,
  RefreshCw,
  Search,
  Plus,
  Layers,
  Sparkles,
  FileText,
} from 'lucide-react';
import { ParameterItem, MasterBarang } from '../types';
import { api, fileToBase64 } from '../services/api';

interface PhotoFileItem {
  id: string;
  file: File;
  previewUrl: string;
  name: string;
  size: number;
}

interface InputBastViewProps {
  onSuccessNavigate?: () => void;
}

export const InputBastView: React.FC<InputBastViewProps> = ({ onSuccessNavigate }) => {
  // Form fields
  const todayStr = new Date().toISOString().slice(0, 10);
  const [tanggal, setTanggal] = useState(todayStr);
  const [bidangPengadaan, setBidangPengadaan] = useState('');
  const [bidangPengguna, setBidangPengguna] = useState('');
  const [modeBast, setModeBast] = useState<'Baru' | 'Sama'>('Baru');
  const [selectedExistingBastNo, setSelectedExistingBastNo] = useState('');
  const [existingBastOptions, setExistingBastOptions] = useState<Array<{ bastNo: string; bidangPengadaan?: string; bidangPengguna?: string; bidang: string; count: number }>>([]);

  // Right column fields
  const [namaBarang, setNamaBarang] = useState('');
  const [uniqueName, setUniqueName] = useState('');
  const [jenisBarang, setJenisBarang] = useState('');
  const [detailSpesifikasi, setDetailSpesifikasi] = useState('');
  const [nomorSerial, setNomorSerial] = useState('');
  const [lokasiDistribusi, setLokasiDistribusi] = useState('');
  const [nomorUPA, setNomorUPA] = useState('');
  const [tanggalPenerimaan, setTanggalPenerimaan] = useState(todayStr);

  // Autocomplete & Master data
  const [bidangList, setBidangList] = useState<ParameterItem[]>([]);
  const [masterList, setMasterList] = useState<MasterBarang[]>([]);
  const [filteredMaster, setFilteredMaster] = useState<MasterBarang[]>([]);
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [codeWarning, setCodeWarning] = useState<string | null>(null);

  // Previews of generated numbers
  const [previewBastNo, setPreviewBastNo] = useState('');
  const [previewAssetNo, setPreviewAssetNo] = useState('');
  const [previewSeqNo, setPreviewSeqNo] = useState<number>(1);

  // Photos
  const [photoList, setPhotoList] = useState<PhotoFileItem[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // States
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successData, setSuccessData] = useState<{ bastNo: string; assetNumber: string; namaBarang: string } | null>(null);

  // Load Parameters and Masters on mount
  useEffect(() => {
    loadParameters();
    loadExistingBastList();
  }, []);

  const loadParameters = async () => {
    try {
      const [bidangs = [], masters = []] = await Promise.all([
        api.getParameters('Bidang'),
        api.getMasterBarang('', 'Aktif'),
      ]);
      const safeBidangs = Array.isArray(bidangs) ? bidangs : [];
      const activeBidangs = safeBidangs.filter((b) => b && b.Status === 'Aktif');
      setBidangList(activeBidangs);
      if (activeBidangs.length > 0) {
        const defaultCode = activeBidangs[0].Kode || activeBidangs[0].Key;
        if (!bidangPengadaan) {
          const itOption = activeBidangs.find((b) => (b.Kode || b.Key).toUpperCase() === 'IT');
          setBidangPengadaan(itOption ? (itOption.Kode || itOption.Key) : defaultCode);
        }
        if (!bidangPengguna) {
          const ppicOption = activeBidangs.find((b) => (b.Kode || b.Key).toUpperCase() === 'PPIC');
          setBidangPengguna(ppicOption ? (ppicOption.Kode || ppicOption.Key) : defaultCode);
        }
      }
      setMasterList(Array.isArray(masters) ? masters : []);
    } catch (e) {
      console.error('Error loading parameters:', e);
    }
  };

  const loadExistingBastList = async () => {
    try {
      const data = await api.getAvailableBastNumbers();
      const safeData = Array.isArray(data) ? data : [];
      setExistingBastOptions(safeData);
      if (safeData.length > 0) {
        if (!selectedExistingBastNo) {
          setSelectedExistingBastNo(safeData[0].bastNo);
        }
        if (modeBast === 'Sama' && (safeData[0].bidangPengadaan || safeData[0].bidang)) {
          setBidangPengadaan(safeData[0].bidangPengadaan || safeData[0].bidang);
        }
      }
    } catch (e) {
      console.error('Error loading existing BAST numbers:', e);
    }
  };

  // When in 'Sama' (Existing BSTA) mode, strictly sync Bidang Pengadaan from selected existing BAST
  useEffect(() => {
    if (modeBast === 'Sama' && existingBastOptions.length > 0) {
      const currentTargetNo = selectedExistingBastNo || existingBastOptions[0].bastNo;
      if (!selectedExistingBastNo) {
        setSelectedExistingBastNo(currentTargetNo);
      }
      const match = existingBastOptions.find((o) => o.bastNo === currentTargetNo);
      if (match && (match.bidangPengadaan || match.bidang)) {
        setBidangPengadaan(match.bidangPengadaan || match.bidang);
      }
    }
  }, [modeBast, selectedExistingBastNo, existingBastOptions]);

  // Recalculate number previews whenever Date, BidangPengadaan, BidangPengguna, or UniqueName changes
  useEffect(() => {
    if (!bidangPengadaan || !bidangPengguna || !tanggal) return;

    if (modeBast === 'Sama' && selectedExistingBastNo) {
      setPreviewBastNo(selectedExistingBastNo);
    }

    const timer = setTimeout(async () => {
      try {
        const preview = await api.getNextNumbers(bidangPengadaan, bidangPengguna, tanggal, uniqueName || 'AST');
        if (modeBast === 'Baru') {
          setPreviewBastNo(preview.bastNo);
          setPreviewSeqNo(preview.seqNumber);
        }
        setPreviewAssetNo(preview.assetNumber);
      } catch (err) {
        console.error('Preview error:', err);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [tanggal, bidangPengadaan, bidangPengguna, uniqueName, modeBast, selectedExistingBastNo]);

  // Derived Month & Year
  const dateObj = new Date(tanggal);
  const currentMonthNum = isNaN(dateObj.getMonth()) ? new Date().getMonth() + 1 : dateObj.getMonth() + 1;
  const currentYearNum = isNaN(dateObj.getFullYear()) ? new Date().getFullYear() : dateObj.getFullYear();
  const monthNames = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
  ];
  const currentMonthName = monthNames[currentMonthNum - 1] || 'Oktober';

  // Autocomplete handle
  const handleNamaBarangChange = async (val: string) => {
    setNamaBarang(val);
    setCodeWarning(null);

    if (!val.trim()) {
      setFilteredMaster([]);
      setShowAutocomplete(false);
      return;
    }

    const matches = masterList.filter((m) =>
      m.NamaBarang.toLowerCase().includes(val.toLowerCase())
    );
    setFilteredMaster(matches);
    setShowAutocomplete(true);

    // If exact match found
    const exact = masterList.find((m) => m.NamaBarang.toLowerCase() === val.trim().toLowerCase());
    if (exact) {
      setUniqueName(exact.UniqueName);
      setJenisBarang(exact.JenisBarang);
    } else {
      // Suggest automatic code from name
      try {
        const suggest = await api.suggestUniqueCode(val);
        setUniqueName(suggest.code);
        if (suggest.isColliding) {
          setCodeWarning(
            `Kode '${suggest.code}' sudah digunakan oleh barang: ${suggest.collidingNames.join(', ')}. Harap sesuaikan jika ingin kode unik.`
          );
        }
      } catch (e) {
        // ignore
      }
    }
  };

  const handleSelectMaster = (item: MasterBarang) => {
    setNamaBarang(item.NamaBarang);
    setUniqueName(item.UniqueName);
    setJenisBarang(item.JenisBarang);
    setShowAutocomplete(false);
    setCodeWarning(null);
  };

  // Photo upload handlers
  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMsg(null);
    if (!e.target.files) return;
    const files = Array.from(e.target.files);

    const validExtensions = ['image/jpeg', 'image/png', 'image/jpg'];
    const maxSize = 5 * 1024 * 1024; // 5 MB

    const newItems: PhotoFileItem[] = [];
    for (const f of files) {
      if (!validExtensions.includes(f.type.toLowerCase())) {
        setErrorMsg(`Berkas "${f.name}" bukan format JPG atau PNG.`);
        continue;
      }
      if (f.size > maxSize) {
        setErrorMsg(`Berkas "${f.name}" melebihi batas 5 MB.`);
        continue;
      }
      newItems.push({
        id: `${Date.now()}-${Math.random()}`,
        file: f,
        previewUrl: URL.createObjectURL(f),
        name: f.name,
        size: f.size,
      });
    }

    setPhotoList((prev) => [...prev, ...newItems]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleRemovePhoto = (id: string) => {
    setPhotoList((prev) => prev.filter((p) => p.id !== id));
  };

  const handleResetForm = () => {
    setNamaBarang('');
    setUniqueName('');
    setJenisBarang('');
    setDetailSpesifikasi('');
    setNomorSerial('');
    setLokasiDistribusi('');
    setNomorUPA('');
    setPhotoList([]);
    setErrorMsg(null);
    setCodeWarning(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    // Validation
    if (!tanggal) {
      setErrorMsg('Tanggal transaksi wajib dipilih.');
      return;
    }
    if (!bidangPengadaan) {
      setErrorMsg('Bidang Pengadaan wajib dipilih.');
      return;
    }
    if (!bidangPengguna) {
      setErrorMsg('Bidang Pengguna wajib dipilih.');
      return;
    }
    if (!namaBarang.trim()) {
      setErrorMsg('Nama Barang wajib diisi.');
      return;
    }
    if (!uniqueName.trim()) {
      setErrorMsg('Unique Name / Kode Singkat Barang wajib diisi.');
      return;
    }

    if (modeBast === 'Sama' && !selectedExistingBastNo) {
      setErrorMsg('Pilih nomor BAST yang sudah ada untuk mode Nomor Sama.');
      return;
    }

    setIsSubmitting(true);

    try {
      // Convert photos to base64
      const photosPayload = await Promise.all(
        photoList.map(async (p) => ({
          fileName: p.name,
          base64: await fileToBase64(p.file),
        }))
      );

      const res = await api.saveBastTransaction({
        modeBast,
        selectedExistingBastNo: modeBast === 'Sama' ? selectedExistingBastNo : undefined,
        tanggal,
        bidangPengadaan,
        bidangPengguna,
        bidang: bidangPengadaan,
        namaBarang: namaBarang.trim(),
        uniqueName: uniqueName.trim().toUpperCase(),
        jenisBarang: (jenisBarang || 'Umum').trim(),
        detailSpesifikasi: detailSpesifikasi.trim(),
        nomorSerial: nomorSerial.trim(),
        lokasiDistribusi: lokasiDistribusi.trim(),
        nomorUPA: nomorUPA.trim(),
        tanggalPenerimaan,
        photos: photosPayload,
      });

      setSuccessData({
        bastNo: res.bastNo,
        assetNumber: res.assetNumber,
        namaBarang: namaBarang.trim(),
      });

      // Reload master list & available bast numbers
      loadExistingBastList();
      loadParameters();
      handleResetForm();
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal menyimpan transaksi BAST ke server.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6">
      {/* Title Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center space-x-2">
            <div className="p-2 bg-blue-100 text-blue-700 rounded-lg">
              <FilePlus2 className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-800">
                Input Barang Baru / Transaksi BAST
              </h1>
              <p className="text-xs text-slate-500">
                Formulir 2-kolom ringkas pencatatan BAST, pembuatan nomor otomatis, dan upload foto
              </p>
            </div>
          </div>
        </div>

        {/* Mode Selector Pill */}
        <div className="flex items-center space-x-2 bg-slate-100 p-1 rounded-lg border border-slate-200">
          <span className="text-xs font-semibold text-slate-600 px-2">Mode Nomor BAST:</span>
          <button
            type="button"
            onClick={() => setModeBast('Baru')}
            className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${
              modeBast === 'Baru'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Nomor Baru
          </button>
          <button
            type="button"
            onClick={() => {
              setModeBast('Sama');
              const target = selectedExistingBastNo || (existingBastOptions.length > 0 ? existingBastOptions[0].bastNo : '');
              if (target) {
                setSelectedExistingBastNo(target);
                const match = existingBastOptions.find((o) => o.bastNo === target);
                if (match && (match.bidangPengadaan || match.bidang)) {
                  setBidangPengadaan(match.bidangPengadaan || match.bidang);
                }
              }
            }}
            className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${
              modeBast === 'Sama'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Sama (BAST Eksisting)
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {errorMsg && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-lg flex items-center space-x-2.5 text-xs text-rose-700">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Main Form Form 2-Kolom */}
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* ================= KOLOM KIRI ================= */}
          <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center space-x-2 pb-2 border-b border-slate-100">
              <span className="w-6 h-6 rounded-full bg-blue-50 text-blue-700 text-xs font-bold flex items-center justify-center">
                1
              </span>
              <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                Informasi Waktu & Bidang (Kolom Kiri)
              </h2>
            </div>

            {/* Tanggal */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Tanggal Transaksi <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                value={tanggal}
                onChange={(e) => setTanggal(e.target.value)}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none"
                required
              />
              <span className="text-[10px] text-slate-400 mt-0.5 block">
                Tanggal acuan pembentukan bulan Romawi dan nomor urut BAST
              </span>
            </div>

            {/* Bulan & Tahun Otomatis */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Bulan
                </label>
                <div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-md text-xs font-medium text-slate-700 flex justify-between">
                  <span>{currentMonthName}</span>
                  <span className="text-blue-600 font-mono font-bold">Bulan {currentMonthNum}</span>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Tahun
                </label>
                <div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-md text-xs font-bold text-slate-700 font-mono">
                  {currentYearNum}
                </div>
              </div>
            </div>

            {/* Bidang Pengadaan Dropdown */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-slate-700">
                  Bidang Pengadaan <span className="text-rose-500">*</span>
                </label>
                {modeBast === 'Sama' && (
                  <span className="text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded font-semibold flex items-center gap-1">
                    🔒 Terkunci (Sesuai BSTA Eksisting)
                  </span>
                )}
              </div>
              <select
                value={bidangPengadaan}
                onChange={(e) => setBidangPengadaan(e.target.value)}
                disabled={modeBast === 'Sama'}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white font-medium disabled:bg-slate-100 disabled:text-slate-700 disabled:cursor-not-allowed"
                required
              >
                {bidangList.map((b) => (
                  <option key={b.ParamID} value={b.Kode || b.Key}>
                    {b.Kode || b.Key} — {b.Value}
                  </option>
                ))}
              </select>
              <span className="text-[10px] text-slate-500 mt-0.5 block">
                {modeBast === 'Sama'
                  ? 'Bidang Pengadaan otomatis terisi dan terkunci mengikuti nomor BSTA eksisting yang dipilih.'
                  : 'Bidang yang melakukan pengadaan aset. Sumber kode bidang penomoran dokumen BSTA.'}
              </span>
            </div>

            {/* Bidang Pengguna Dropdown */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Bidang Pengguna <span className="text-rose-500">*</span>
              </label>
              <select
                value={bidangPengguna}
                onChange={(e) => setBidangPengguna(e.target.value)}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white font-medium"
                required
              >
                {bidangList.map((b) => (
                  <option key={b.ParamID} value={b.Kode || b.Key}>
                    {b.Kode || b.Key} — {b.Value}
                  </option>
                ))}
              </select>
              <span className="text-[10px] text-slate-500 mt-0.5 block">
                Bidang yang menggunakan / menerima aset. Sumber kode bidang Nomor Inventaris / No Asset.
              </span>
            </div>

            {/* Nomor Tersedia / Nomor Urut */}
            <div className="p-3 bg-blue-50/60 border border-blue-200/70 rounded-lg space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-blue-900">Nomor Tersedia / Nomor Urut:</span>
                <span className="font-mono font-bold text-blue-700 px-2 py-0.5 bg-blue-100 rounded text-xs">
                  Urut #{String(previewSeqNo).padStart(3, '0')}
                </span>
              </div>
              <p className="text-[11px] text-blue-800 leading-relaxed">
                {modeBast === 'Baru'
                  ? `Sistem mengalokasikan nomor urut berikutnya untuk Bidang Pengadaan ${bidangPengadaan || '-'} periode ${currentMonthName} ${currentYearNum} (reset bulanan).`
                  : `Mode "Sama" menggunakan nomor urut dari BAST terpilih.`}
              </p>
            </div>
          </div>

          {/* ================= KOLOM KANAN ================= */}
          <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center space-x-2 pb-2 border-b border-slate-100">
              <span className="w-6 h-6 rounded-full bg-blue-50 text-blue-700 text-xs font-bold flex items-center justify-center">
                2
              </span>
              <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                Detail Barang & Nomor BAST (Kolom Kanan)
              </h2>
            </div>

            {/* Nomor BAST Display / Selector */}
            {modeBast === 'Baru' ? (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nomor BAST (Otomatis Sesuai Aturan)
                </label>
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    value={previewBastNo || 'Memuat nomor BAST...'}
                    readOnly
                    className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-300 rounded-md font-mono font-bold text-blue-700"
                  />
                  <span className="px-2 py-1 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded shrink-0">
                    Auto-Lock
                  </span>
                </div>
                <span className="text-[10px] text-slate-500 mt-1 block">
                  Nomor dokumen BSTA berdasar Bidang Pengadaan: <strong className="font-semibold text-blue-700">{bidangPengadaan || '-'}</strong>
                </span>
              </div>
            ) : (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Pilih Nomor BAST Eksisting <span className="text-rose-500">*</span>
                </label>
                <select
                  value={selectedExistingBastNo}
                  onChange={(e) => {
                    const chosen = e.target.value;
                    setSelectedExistingBastNo(chosen);
                    const found = existingBastOptions.find(o => o.bastNo === chosen);
                    if (found && (found.bidangPengadaan || found.bidang)) {
                      setBidangPengadaan(found.bidangPengadaan || found.bidang);
                    }
                  }}
                  className="w-full text-xs px-3 py-2 border border-blue-400 bg-blue-50/40 rounded-md font-mono font-bold text-blue-900 focus:outline-none"
                >
                  {existingBastOptions.map((opt) => (
                    <option key={opt.bastNo} value={opt.bastNo}>
                      {opt.bastNo} (Pengadaan: {opt.bidangPengadaan || opt.bidang} • {opt.count} barang)
                    </option>
                  ))}
                </select>
                <span className="text-[10px] text-slate-500 mt-1 block">
                  Hanya nomor BAST yang dipakai bersama; aset ini akan tetap menggunakan Bidang Pengguna <strong className="font-semibold text-emerald-700">{bidangPengguna || '-'}</strong>.
                </span>
              </div>
            )}

            {/* Nama Barang with Searchable Autocomplete */}
            <div className="relative">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Nama Barang <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={namaBarang}
                  onChange={(e) => handleNamaBarangChange(e.target.value)}
                  onFocus={() => {
                    if (namaBarang.trim()) setShowAutocomplete(true);
                  }}
                  placeholder="Ketik nama barang (contoh: Timbangan Digital, Laptop...)"
                  className="w-full text-xs px-3 py-2 pl-8 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  required
                />
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              </div>

              {/* Autocomplete Dropdown */}
              {showAutocomplete && filteredMaster.length > 0 && (
                <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-xl max-h-48 overflow-y-auto divide-y divide-slate-100">
                  <div className="px-3 py-1.5 bg-slate-50 text-[10px] font-semibold text-slate-500 uppercase tracking-wide">
                    Pilihan dari Master Barang:
                  </div>
                  {filteredMaster.map((m) => (
                    <button
                      key={m.MasterBarangID}
                      type="button"
                      onClick={() => handleSelectMaster(m)}
                      className="w-full px-3 py-2 text-left hover:bg-blue-50 flex items-center justify-between text-xs"
                    >
                      <span className="font-semibold text-slate-800">{m.NamaBarang}</span>
                      <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-blue-700 font-bold">
                        {m.UniqueName}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Unique Name & Jenis Barang */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Unique Name / Kode Singkat <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={uniqueName}
                  onChange={(e) => {
                    setUniqueName(e.target.value.toUpperCase());
                    setCodeWarning(null);
                  }}
                  placeholder="e.g. TBG"
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-md font-mono font-bold uppercase focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Jenis / Kategori Barang
                </label>
                <input
                  type="text"
                  value={jenisBarang}
                  onChange={(e) => setJenisBarang(e.target.value)}
                  placeholder="e.g. Alat Ukur / Elektronik"
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </div>

            {codeWarning && (
              <div className="p-2.5 bg-amber-50 border border-amber-200 text-amber-800 text-[11px] rounded-md">
                {codeWarning}
              </div>
            )}

            {/* Detail / Spesifikasi */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Detail / Spesifikasi
              </label>
              <textarea
                value={detailSpesifikasi}
                onChange={(e) => setDetailSpesifikasi(e.target.value)}
                rows={2}
                placeholder="Merek, tipe model, kapasitas, material, warna atau kelengkapan..."
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none"
              />
            </div>

            {/* Nomor Serial & Lokasi Distribusi */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nomor Serial (Opsional)
                </label>
                <input
                  type="text"
                  value={nomorSerial}
                  onChange={(e) => setNomorSerial(e.target.value)}
                  placeholder="Nomor seri pabrik (SN)"
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Lokasi Distribusi
                </label>
                <input
                  type="text"
                  value={lokasiDistribusi}
                  onChange={(e) => setLokasiDistribusi(e.target.value)}
                  placeholder="Gedung, ruangan, atau lantai"
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Nomor UPA & Tanggal Penerimaan */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nomor UPA
                </label>
                <input
                  type="text"
                  value={nomorUPA}
                  onChange={(e) => setNomorUPA(e.target.value)}
                  placeholder="Contoh: UPA-2026-1002"
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Tanggal Penerimaan
                </label>
                <input
                  type="date"
                  value={tanggalPenerimaan}
                  onChange={(e) => setTanggalPenerimaan(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Nomor Inventaris Preview */}
            <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-lg">
              <span className="text-[10px] font-semibold text-emerald-800 uppercase tracking-wide block">
                Preview Nomor Inventaris Yang Akan Dibuat:
              </span>
              <div className="text-sm font-mono font-bold text-emerald-900 mt-0.5">
                {previewAssetNo || '000.AST.MMYY.BIDANG'}
              </div>
              <span className="text-[10px] text-emerald-700">
                Format baku: [Urut].[KodeBarang].[BulanTahun].[Bidang Pengguna: {bidangPengguna || '-'}]
              </span>
            </div>
          </div>
        </div>

        {/* ================= BAGIAN FOTO BARANG ================= */}
        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div className="flex items-center space-x-2">
              <span className="w-6 h-6 rounded-full bg-blue-50 text-blue-700 text-xs font-bold flex items-center justify-center">
                3
              </span>
              <div>
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                  Dokumentasi Foto Barang (Opsional)
                </h3>
                <p className="text-[11px] text-slate-500">
                  Dapat mengunggah satu atau beberapa foto dari komputer atau ponsel (JPG, PNG maks 5MB)
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold rounded-md border border-blue-200 transition-colors"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>+ Pilih Foto</span>
            </button>
          </div>

          <input
            type="file"
            ref={fileInputRef}
            onChange={handlePhotoSelect}
            multiple
            accept=".jpg,.jpeg,.png,image/jpeg,image/png"
            className="hidden"
          />

          {photoList.length === 0 ? (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-300 hover:border-blue-400 rounded-xl p-6 text-center cursor-pointer bg-slate-50/50 hover:bg-blue-50/20 transition-all"
            >
              <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
              <p className="text-xs font-medium text-slate-700">
                Klik di sini untuk mengunggah foto fisik barang / plat nomor serial
              </p>
              <p className="text-[10px] text-slate-400 mt-1">
                Foto akan otomatis terhubung ke AssetID dan tersimpan secara terpusat di Google Drive
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {photoList.map((item, idx) => (
                  <div
                    key={item.id}
                    className="relative group rounded-lg overflow-hidden border border-slate-200 bg-slate-900 shadow-xs"
                  >
                    <img
                      src={item.previewUrl}
                      alt={item.name}
                      className="w-full h-24 object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemovePhoto(item.id)}
                      className="absolute top-1 right-1 p-1 bg-rose-600/90 hover:bg-rose-700 text-white rounded-full shadow-md transition-transform hover:scale-110"
                      title="Hapus foto dari daftar"
                    >
                      <X className="w-3 h-3" />
                    </button>
                    <div className="p-1 bg-white text-[10px] text-slate-700 truncate font-mono">
                      {idx + 1}. {item.name}
                    </div>
                  </div>
                ))}
              </div>
              <div className="text-[11px] text-slate-500 flex items-center justify-between">
                <span>{photoList.length} foto siap disimpan bersama transaksi BAST ini.</span>
                <button
                  type="button"
                  onClick={() => setPhotoList([])}
                  className="text-rose-600 hover:underline"
                >
                  Hapus Semua Foto
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ================= TOMBOL FORMULIR ================= */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-slate-200">
          <div className="text-xs text-slate-500">
            Kolom bertanda <span className="text-rose-500 font-bold">*</span> wajib diisi dengan benar.
          </div>

          <div className="flex items-center space-x-3 w-full sm:w-auto">
            <button
              type="button"
              onClick={handleResetForm}
              disabled={isSubmitting}
              className="w-full sm:w-auto px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
            >
              Reset / Bersihkan Form
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full sm:w-auto px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-xs font-bold rounded-lg shadow-sm flex items-center justify-center space-x-2 transition-all cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Menyimpan Transaksi BAST...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Simpan Transaksi BAST</span>
                </>
              )}
            </button>
          </div>
        </div>
      </form>

      {/* Success Modal */}
      {successData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden text-center p-6 space-y-4">
            <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">
                Transaksi BAST Berhasil Disimpan!
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Data barang dan inventaris telah dicatat secara terpusat di database.
              </p>
            </div>

            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 text-left space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Nomor BAST:</span>
                <span className="font-mono font-bold text-blue-700">{successData.bastNo}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Nomor Inventaris:</span>
                <span className="font-mono font-bold text-emerald-700">{successData.assetNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Nama Barang:</span>
                <span className="font-semibold text-slate-800">{successData.namaBarang}</span>
              </div>
            </div>

            <div className="pt-2 space-y-2">
              <button
                type="button"
                onClick={() => {
                  api.downloadBastPdf(successData.bastNo);
                }}
                className="w-full py-2.5 px-3 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg shadow-xs flex items-center justify-center space-x-1.5 transition-colors cursor-pointer"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Unduh Dokumen PDF BAST Resmi</span>
              </button>

              <div className="flex space-x-2">
                <button
                  type="button"
                  onClick={() => setSuccessData(null)}
                  className="w-1/2 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg"
                >
                  Input Barang Lain
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSuccessData(null);
                    if (onSuccessNavigate) onSuccessNavigate();
                  }}
                  className="w-1/2 px-3 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs"
                >
                  Lihat Daftar BAST
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
