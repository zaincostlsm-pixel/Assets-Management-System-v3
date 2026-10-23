import React, { useState, useEffect, useMemo } from 'react';
import {
  PackageSearch,
  Search,
  Download,
  ClipboardCheck,
  RefreshCw,
  Plus,
  Eye,
  Camera,
  ArrowUpDown,
  Edit3,
  CheckCircle2,
  AlertCircle,
  X,
  Shield,
  Info,
} from 'lucide-react';
import { DataInventaris, ParameterItem, FotoInventaris, AuthUser } from '../types';
import { api } from '../services/api';
import { PhotoModal } from '../components/PhotoModal';

interface MonitoringInventarisViewProps {
  currentUser?: AuthUser | null;
}

export const MonitoringInventarisView: React.FC<MonitoringInventarisViewProps> = ({ currentUser }) => {
  const isSuperAdmin = currentUser?.role === 'Super Admin';
  const [inventoryList, setInventoryList] = useState<DataInventaris[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [filterBidangPengadaan, setFilterBidangPengadaan] = useState('Semua');
  const [filterBidangPengguna, setFilterBidangPengguna] = useState('Semua');
  const [filterNamaBarang, setFilterNamaBarang] = useState('Semua');
  const [filterKondisi, setFilterKondisi] = useState('Semua');
  const [filterLokasi, setFilterLokasi] = useState('Semua');

  // Sorting
  const [sortField, setSortField] = useState<keyof DataInventaris>('AssetNumber');
  const [sortAsc, setSortAsc] = useState(true);

  // Parameter & Dropdown lists
  const [bidangList, setBidangList] = useState<ParameterItem[]>([]);
  const [kondisiList, setKondisiList] = useState<ParameterItem[]>([]);

  // Edit modal state
  const [editingAsset, setEditingAsset] = useState<DataInventaris | null>(null);
  const [editForm, setEditForm] = useState({
    NamaBarang: '',
    UniqueName: '',
    JenisBarang: '',
    DetailSpesifikasi: '',
    NomorSerial: '',
    Jumlah: 1,
    BidangPengadaan: '',
    BidangPengguna: '',
    Pemilik: '',
    TanggalPerolehan: '',
    Kondisi: 'Baik',
    Lokasi: '',
  });
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  // Photo modal state
  const [photoModalData, setPhotoModalData] = useState<{
    assetId: string;
    assetNumber: string;
    assetName: string;
    photos: FotoInventaris[];
    mode: 'view' | 'add' | 'replace';
  } | null>(null);

  useEffect(() => {
    loadData();
    loadParameters();
  }, []);

  const loadParameters = async () => {
    try {
      const [bidangs, kondisis] = await Promise.all([
        api.getParameters('Bidang'),
        api.getParameters('Kondisi'),
      ]);
      setBidangList(bidangs.filter((b) => b.Status === 'Aktif'));
      setKondisiList(kondisis.filter((k) => k.Status === 'Aktif'));
    } catch (e) {
      console.error(e);
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await api.getInventory({});
      setInventoryList(data);
    } catch (e) {
      console.error('Error loading inventory data:', e);
    } finally {
      setLoading(false);
    }
  };

  // Dynamic filter options derived from current database
  const availableNamaBarang = useMemo(() => {
    const set = new Set<string>();
    inventoryList.forEach((i) => {
      if (i.NamaBarang) set.add(i.NamaBarang);
    });
    return Array.from(set).sort();
  }, [inventoryList]);

  const availableLokasi = useMemo(() => {
    const set = new Set<string>();
    inventoryList.forEach((i) => {
      if (i.Lokasi) set.add(i.Lokasi);
    });
    return Array.from(set).sort();
  }, [inventoryList]);

  // Filtered & Sorted Inventory
  const filteredList = useMemo(() => {
    return inventoryList
      .filter((item) => {
        const itemPengadaan = item.BidangPengadaan || item.Pemilik || '';
        const itemPengguna = item.BidangPengguna || item.Pemilik || '';
        if (filterBidangPengadaan !== 'Semua' && itemPengadaan.toLowerCase() !== filterBidangPengadaan.toLowerCase()) return false;
        if (filterBidangPengguna !== 'Semua' && itemPengguna.toLowerCase() !== filterBidangPengguna.toLowerCase()) return false;
        if (filterNamaBarang !== 'Semua' && item.NamaBarang.toLowerCase() !== filterNamaBarang.toLowerCase()) return false;
        if (filterKondisi !== 'Semua' && item.Kondisi.toLowerCase() !== filterKondisi.toLowerCase()) return false;
        if (filterLokasi !== 'Semua' && item.Lokasi.toLowerCase() !== filterLokasi.toLowerCase()) return false;
        if (search) {
          const s = search.toLowerCase();
          const match =
            item.AssetNumber.toLowerCase().includes(s) ||
            item.NamaBarang.toLowerCase().includes(s) ||
            item.JenisBarang.toLowerCase().includes(s) ||
            item.NomorSerial.toLowerCase().includes(s) ||
            itemPengadaan.toLowerCase().includes(s) ||
            itemPengguna.toLowerCase().includes(s) ||
            item.Lokasi.toLowerCase().includes(s) ||
            item.DetailSpesifikasi.toLowerCase().includes(s);
          if (!match) return false;
        }
        return true;
      })
      .sort((a, b) => {
        let valA = (a as any)[sortField] || '';
        let valB = (b as any)[sortField] || '';
        if (typeof valA === 'string') valA = valA.toLowerCase();
        if (typeof valB === 'string') valB = valB.toLowerCase();
        if (valA < valB) return sortAsc ? -1 : 1;
        if (valA > valB) return sortAsc ? 1 : -1;
        return 0;
      });
  }, [inventoryList, filterBidangPengadaan, filterBidangPengguna, filterNamaBarang, filterKondisi, filterLokasi, search, sortField, sortAsc]);

  const handleSort = (field: keyof DataInventaris) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  const handleExportStandard = () => {
    const params: Record<string, string> = {};
    if (filterBidangPengadaan !== 'Semua') params.bidangPengadaan = filterBidangPengadaan;
    if (filterBidangPengguna !== 'Semua') params.bidangPengguna = filterBidangPengguna;
    if (filterNamaBarang !== 'Semua') params.namaBarang = filterNamaBarang;
    if (filterKondisi !== 'Semua') params.kondisi = filterKondisi;
    if (filterLokasi !== 'Semua') params.lokasi = filterLokasi;
    if (search) params.search = search;
    api.downloadExport('/api/export/inventory', params, `Daftar_Inventaris_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const handleExportFormPemeriksaan = () => {
    const params: Record<string, string> = { isFormPemeriksaan: 'true' };
    if (filterBidangPengadaan !== 'Semua') params.bidangPengadaan = filterBidangPengadaan;
    if (filterBidangPengguna !== 'Semua') params.bidangPengguna = filterBidangPengguna;
    if (filterNamaBarang !== 'Semua') params.namaBarang = filterNamaBarang;
    if (filterKondisi !== 'Semua') params.kondisi = filterKondisi;
    if (filterLokasi !== 'Semua') params.lokasi = filterLokasi;
    if (search) params.search = search;
    api.downloadExport(
      '/api/export/inventory',
      params,
      `Form_Pemeriksaan_Aset_${new Date().toISOString().slice(0, 10)}.xlsx`
    );
  };

  const handleOpenEditModal = (item: DataInventaris) => {
    setEditingAsset(item);
    setEditForm({
      NamaBarang: item.NamaBarang || '',
      UniqueName: '',
      JenisBarang: item.JenisBarang || 'Umum',
      DetailSpesifikasi: item.DetailSpesifikasi || '',
      NomorSerial: item.NomorSerial || '',
      Jumlah: item.Jumlah || 1,
      BidangPengadaan: item.BidangPengadaan || item.Pemilik || '',
      BidangPengguna: item.BidangPengguna || item.Pemilik || '',
      Pemilik: item.BidangPengguna || item.Pemilik || '',
      TanggalPerolehan: item.TanggalPerolehan || '',
      Kondisi: item.Kondisi || 'Baik',
      Lokasi: item.Lokasi || '',
    });
    setEditError(null);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAsset) return;

    if (!editForm.NamaBarang.trim()) {
      setEditError('Nama Barang wajib diisi.');
      return;
    }
    if (!editForm.BidangPengadaan.trim()) {
      setEditError('Bidang Pengadaan wajib dipilih.');
      return;
    }
    if (!editForm.BidangPengguna.trim()) {
      setEditError('Bidang Pengguna wajib dipilih.');
      return;
    }
    if (!editForm.Kondisi.trim()) {
      setEditError('Kondisi aset wajib dipilih.');
      return;
    }
    if (!editForm.Lokasi.trim()) {
      setEditError('Lokasi penempatan aset wajib diisi.');
      return;
    }

    setEditLoading(true);
    setEditError(null);
    try {
      const res = await api.updateInventory(editingAsset.AssetID, {
        NamaBarang: editForm.NamaBarang.trim(),
        UniqueName: editForm.UniqueName ? editForm.UniqueName.trim().toUpperCase() : undefined,
        JenisBarang: editForm.JenisBarang.trim(),
        DetailSpesifikasi: editForm.DetailSpesifikasi.trim(),
        NomorSerial: editForm.NomorSerial.trim(),
        Jumlah: Number(editForm.Jumlah) || 1,
        BidangPengadaan: editForm.BidangPengadaan.trim(),
        BidangPengguna: editForm.BidangPengguna.trim(),
        Pemilik: editForm.BidangPengguna.trim(),
        TanggalPerolehan: editForm.TanggalPerolehan.trim(),
        Kondisi: editForm.Kondisi.trim(),
        Lokasi: editForm.Lokasi.trim(),
      });

      setSuccessNotice(res.message || `Data aset ${editingAsset.AssetNumber} berhasil diperbarui.`);
      setTimeout(() => setSuccessNotice(null), 5000);
      setEditingAsset(null);
      await loadData();
    } catch (err: any) {
      setEditError(err.message || 'Gagal memperbarui data aset.');
    } finally {
      setEditLoading(false);
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* Success Notification Banner */}
      {successNotice && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center justify-between shadow-2xs">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-medium">{successNotice}</span>
          </div>
          <button
            onClick={() => setSuccessNotice(null)}
            className="text-emerald-600 hover:text-emerald-800 p-0.5 rounded cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Title Header & Actions */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-slate-200">
        <div>
          <div className="flex items-center space-x-2">
            <div className="p-2 bg-emerald-100 text-emerald-800 rounded-lg">
              <PackageSearch className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-lg font-bold text-slate-800">Monitoring Inventaris Aktif (Fitur 3)</h1>
                {isSuperAdmin ? (
                  <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-100 text-blue-800 border border-blue-200">
                    <Shield className="w-3 h-3 text-blue-600" />
                    <span>Super Admin: Akses Penuh</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                    User: Hak Akses Baca & Ekspor
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500">
                Tabel horizontal data aset aktif perusahaan dengan pengelolaan foto dan formulir pemeriksaan fisik
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons: Refresh, Export Inventaris, Export Form Pemeriksaan */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={loadData}
            className="p-2 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-medium flex items-center space-x-1"
            title="Muat Ulang Data"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          <button
            onClick={handleExportStandard}
            className="px-3 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-semibold flex items-center space-x-1.5 shadow-xs cursor-pointer"
            title="Unduh daftar inventaris aktif ke file Excel"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Ekspor Inventaris (.xlsx)</span>
          </button>

          <button
            onClick={handleExportFormPemeriksaan}
            className="px-3.5 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-bold flex items-center space-x-1.5 shadow-xs cursor-pointer"
            title="Ekspor khusus dengan 3 kolom fisik: Hasil Pemeriksaan, Catatan Pemeriksaan, Tanggal Pemeriksaan"
          >
            <ClipboardCheck className="w-4 h-4 text-teal-200" />
            <span>Ekspor Form Pemeriksaan Aset</span>
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 gap-3">
          {/* Global Search */}
          <div className="relative">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari No Inventaris, SN, Lokasi..."
              className="w-full text-xs pl-8 pr-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
          </div>

          {/* Filter Bidang Pengadaan */}
          <div>
            <select
              value={filterBidangPengadaan}
              onChange={(e) => setFilterBidangPengadaan(e.target.value)}
              className="w-full text-xs px-2.5 py-2 border border-slate-300 rounded-md bg-white focus:outline-none"
            >
              <option value="Semua">Pengadaan: Semua</option>
              {bidangList.map((b) => (
                <option key={b.ParamID} value={b.Kode || b.Key}>
                  {b.Kode || b.Key} — {b.Value}
                </option>
              ))}
            </select>
          </div>

          {/* Filter Bidang Pengguna */}
          <div>
            <select
              value={filterBidangPengguna}
              onChange={(e) => setFilterBidangPengguna(e.target.value)}
              className="w-full text-xs px-2.5 py-2 border border-slate-300 rounded-md bg-white focus:outline-none"
            >
              <option value="Semua">Pengguna: Semua</option>
              {bidangList.map((b) => (
                <option key={b.ParamID} value={b.Kode || b.Key}>
                  {b.Kode || b.Key} — {b.Value}
                </option>
              ))}
            </select>
          </div>

          {/* Filter Nama Barang */}
          <div>
            <select
              value={filterNamaBarang}
              onChange={(e) => setFilterNamaBarang(e.target.value)}
              className="w-full text-xs px-2.5 py-2 border border-slate-300 rounded-md bg-white focus:outline-none"
            >
              <option value="Semua">Barang: Lihat Semua</option>
              {availableNamaBarang.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>

          {/* Filter Kondisi */}
          <div>
            <select
              value={filterKondisi}
              onChange={(e) => setFilterKondisi(e.target.value)}
              className="w-full text-xs px-2.5 py-2 border border-slate-300 rounded-md bg-white focus:outline-none"
            >
              <option value="Semua">Kondisi: Lihat Semua</option>
              {kondisiList.map((k) => (
                <option key={k.ParamID} value={k.Key}>
                  {k.Label}
                </option>
              ))}
            </select>
          </div>

          {/* Filter Lokasi */}
          <div>
            <select
              value={filterLokasi}
              onChange={(e) => setFilterLokasi(e.target.value)}
              className="w-full text-xs px-2.5 py-2 border border-slate-300 rounded-md bg-white focus:outline-none"
            >
              <option value="Semua">Lokasi: Lihat Semua</option>
              {availableLokasi.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Filter Summary & Total Assets */}
        <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100">
          <div>
            Total Aset Aktif:{' '}
            <strong className="text-emerald-700 font-bold text-sm">{filteredList.length}</strong> unit
            {filteredList.length !== inventoryList.length && (
              <span className="text-slate-400 ml-1.5">
                (dari total {inventoryList.length} aset terdaftar)
              </span>
            )}
          </div>
          {(search || filterBidangPengadaan !== 'Semua' || filterBidangPengguna !== 'Semua' || filterNamaBarang !== 'Semua' || filterKondisi !== 'Semua' || filterLokasi !== 'Semua') && (
            <button
              onClick={() => {
                setSearch('');
                setFilterBidangPengadaan('Semua');
                setFilterBidangPengguna('Semua');
                setFilterNamaBarang('Semua');
                setFilterKondisi('Semua');
                setFilterLokasi('Semua');
              }}
              className="text-blue-600 hover:underline text-xs cursor-pointer"
            >
              Reset Semua Filter
            </button>
          )}
        </div>
      </div>

      {/* Horizontal Excel Table (Continuous Vertical Scroll, NO Visual Pagination) */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto max-h-[calc(100vh-290px)] overflow-y-auto">
          <table className="w-full text-left border-collapse text-xs whitespace-nowrap">
            {/* Sticky Table Header */}
            <thead className="bg-slate-900 text-white sticky top-0 z-10 shadow-xs select-none">
              <tr>
                <th className="py-2.5 px-3 font-semibold border-b border-slate-700 text-center w-12">
                  No.
                </th>
                <th
                  onClick={() => handleSort('AssetNumber')}
                  className="py-2.5 px-3 font-semibold border-b border-slate-700 cursor-pointer hover:bg-slate-800"
                >
                  <div className="flex items-center space-x-1">
                    <span>Nomor Inventaris</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('JenisBarang')}
                  className="py-2.5 px-3 font-semibold border-b border-slate-700 cursor-pointer hover:bg-slate-800"
                >
                  <div className="flex items-center space-x-1">
                    <span>Jenis Barang</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th className="py-2.5 px-3 font-semibold border-b border-slate-700 min-w-[240px]">
                  Detail / Spesifikasi
                </th>
                <th className="py-2.5 px-3 font-semibold border-b border-slate-700">
                  Nomor Serial
                </th>
                <th className="py-2.5 px-2 font-semibold border-b border-slate-700 text-center w-12">
                  Jumlah
                </th>
                <th
                  onClick={() => handleSort('BidangPengadaan')}
                  className="py-2.5 px-3 font-semibold border-b border-slate-700 cursor-pointer hover:bg-slate-800"
                >
                  <div className="flex items-center space-x-1">
                    <span>Bidang Pengadaan</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('BidangPengguna')}
                  className="py-2.5 px-3 font-semibold border-b border-slate-700 cursor-pointer hover:bg-slate-800"
                >
                  <div className="flex items-center space-x-1">
                    <span>Bidang Pengguna</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('TanggalPerolehan')}
                  className="py-2.5 px-3 font-semibold border-b border-slate-700 cursor-pointer hover:bg-slate-800"
                >
                  <div className="flex items-center space-x-1">
                    <span>Tanggal Perolehan</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('Kondisi')}
                  className="py-2.5 px-3 font-semibold border-b border-slate-700 cursor-pointer hover:bg-slate-800"
                >
                  <div className="flex items-center space-x-1">
                    <span>Kondisi</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th className="py-2.5 px-3 font-semibold border-b border-slate-700">
                  Lokasi
                </th>
                <th className="py-2.5 px-3 font-semibold border-b border-slate-700 text-center min-w-[190px]">
                  Foto
                </th>
                <th className="py-2.5 px-3 font-semibold border-b border-slate-700 text-center min-w-[85px]">
                  Aksi
                </th>
              </tr>
            </thead>

            {/* Table Body with Thin borders & Zebra stripes */}
            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr>
                  <td colSpan={13} className="py-12 text-center text-slate-500">
                    <div className="inline-block w-6 h-6 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mb-2" />
                    <p>Memuat seluruh daftar inventaris aktif...</p>
                  </td>
                </tr>
              ) : filteredList.length === 0 ? (
                <tr>
                  <td colSpan={13} className="py-12 text-center text-slate-400">
                    Tidak ada aset yang sesuai dengan kriteria filter saat ini.
                  </td>
                </tr>
              ) : (
                filteredList.map((item, idx) => {
                  const activePhotos = item.photos ? item.photos.filter((p) => p.StatusFoto === 'Aktif') : [];
                  const photoCount = activePhotos.length;
                  const isEven = idx % 2 === 1;

                  return (
                    <tr
                      key={item.AssetID}
                      className={`hover:bg-blue-50/60 transition-colors ${
                        isEven ? 'bg-slate-50/60' : 'bg-white'
                      }`}
                    >
                      {/* 1. No */}
                      <td className="py-2.5 px-3 text-center text-slate-400 font-mono text-[11px] border-r border-slate-200">
                        {idx + 1}
                      </td>

                      {/* 2. Nomor Inventaris */}
                      <td className="py-2.5 px-3 font-mono font-bold text-emerald-800 border-r border-slate-200">
                        {item.AssetNumber}
                      </td>

                      {/* 3. Jenis Barang */}
                      <td className="py-2.5 px-3 font-semibold text-slate-800 border-r border-slate-200">
                        {item.JenisBarang || item.NamaBarang}
                      </td>

                      {/* 4. Detail / Spesifikasi */}
                      <td
                        className="py-2.5 px-3 text-slate-600 max-w-[280px] truncate border-r border-slate-200"
                        title={item.DetailSpesifikasi}
                      >
                        {item.DetailSpesifikasi || '-'}
                      </td>

                      {/* 5. Nomor Serial */}
                      <td className="py-2.5 px-3 font-mono text-slate-700 border-r border-slate-200">
                        {item.NomorSerial || '-'}
                      </td>

                      {/* 6. Jumlah */}
                      <td className="py-2.5 px-2 text-center font-bold text-slate-800 border-r border-slate-200">
                        {item.Jumlah || 1}
                      </td>

                      {/* 7. Bidang Pengadaan */}
                      <td className="py-2.5 px-3 font-semibold text-slate-800 border-r border-slate-200">
                        <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-800 text-[11px] font-medium border border-blue-200">
                          {item.BidangPengadaan || '-'}
                        </span>
                      </td>

                      {/* 8. Bidang Pengguna */}
                      <td className="py-2.5 px-3 font-semibold text-slate-800 border-r border-slate-200">
                        <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 text-[11px] font-medium border border-emerald-200">
                          {item.BidangPengguna || item.Pemilik || '-'}
                        </span>
                      </td>

                      {/* 9. Tanggal Perolehan */}
                      <td className="py-2.5 px-3 text-slate-700 border-r border-slate-200">
                        {item.TanggalPerolehan}
                      </td>

                      {/* 9. Kondisi */}
                      <td className="py-2.5 px-3 border-r border-slate-200">
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                            item.Kondisi === 'Baik'
                              ? 'bg-emerald-100 text-emerald-800'
                              : item.Kondisi === 'Rusak Ringan'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {item.Kondisi}
                        </span>
                      </td>

                      {/* 10. Lokasi */}
                      <td className="py-2.5 px-3 text-slate-700 border-r border-slate-200">
                        {item.Lokasi}
                      </td>

                      {/* 11. Foto (Role-based: User can only view photos; Super Admin can add/replace) */}
                      <td className="py-2 px-3 text-center">
                        {!isSuperAdmin ? (
                          // User Role: Read-only inspection
                          photoCount > 0 ? (
                            <button
                              onClick={() =>
                                setPhotoModalData({
                                  assetId: item.AssetID,
                                  assetNumber: item.AssetNumber,
                                  assetName: item.NamaBarang,
                                  photos: item.photos || [],
                                  mode: 'view',
                                })
                              }
                              className="inline-flex items-center space-x-1 px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded text-[11px] font-medium border border-blue-200 cursor-pointer"
                            >
                              <Eye className="w-3 h-3" />
                              <span>Lihat Foto ({photoCount})</span>
                            </button>
                          ) : (
                            <span className="text-[10px] text-slate-400">-</span>
                          )
                        ) : (
                          // Super Admin Role: Full Photo Management
                          photoCount === 0 ? (
                            <button
                              onClick={() =>
                                setPhotoModalData({
                                  assetId: item.AssetID,
                                  assetNumber: item.AssetNumber,
                                  assetName: item.NamaBarang,
                                  photos: item.photos || [],
                                  mode: 'add',
                                })
                              }
                              className="inline-flex items-center space-x-1 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md text-[11px] font-semibold border border-slate-300 transition-colors cursor-pointer"
                            >
                              <Plus className="w-3 h-3 text-slate-500" />
                              <span>+ Tambah Foto</span>
                            </button>
                          ) : photoCount === 1 ? (
                            <div className="flex items-center justify-center space-x-1.5">
                              <button
                                onClick={() =>
                                  setPhotoModalData({
                                    assetId: item.AssetID,
                                    assetNumber: item.AssetNumber,
                                    assetName: item.NamaBarang,
                                    photos: item.photos || [],
                                    mode: 'view',
                                  })
                                }
                                className="inline-flex items-center space-x-1 px-2 py-0.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded text-[11px] font-medium border border-blue-200 cursor-pointer"
                              >
                                <Eye className="w-3 h-3" />
                                <span>Lihat Foto</span>
                              </button>
                              <button
                                onClick={() =>
                                  setPhotoModalData({
                                    assetId: item.AssetID,
                                    assetNumber: item.AssetNumber,
                                    assetName: item.NamaBarang,
                                    photos: item.photos || [],
                                    mode: 'replace',
                                  })
                                }
                                className="inline-flex items-center space-x-1 px-2 py-0.5 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded text-[11px] border border-slate-200 cursor-pointer"
                                title="Perbarui foto utama atau tambah foto dokumentasi"
                              >
                                <Camera className="w-3 h-3" />
                                <span>Perbarui</span>
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-center space-x-1.5">
                              <button
                                onClick={() =>
                                  setPhotoModalData({
                                    assetId: item.AssetID,
                                    assetNumber: item.AssetNumber,
                                    assetName: item.NamaBarang,
                                    photos: item.photos || [],
                                    mode: 'view',
                                  })
                                }
                                className="inline-flex items-center space-x-1 px-2 py-0.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded font-semibold text-[11px] border border-emerald-300 cursor-pointer"
                              >
                                <Eye className="w-3 h-3" />
                                <span>Lihat Foto ({photoCount})</span>
                              </button>
                              <button
                                onClick={() =>
                                  setPhotoModalData({
                                    assetId: item.AssetID,
                                    assetNumber: item.AssetNumber,
                                    assetName: item.NamaBarang,
                                    photos: item.photos || [],
                                    mode: 'add',
                                  })
                                }
                                className="p-1 hover:bg-slate-100 rounded text-slate-600 cursor-pointer"
                                title="+ Tambah Foto"
                              >
                                <Plus className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() =>
                                  setPhotoModalData({
                                    assetId: item.AssetID,
                                    assetNumber: item.AssetNumber,
                                    assetName: item.NamaBarang,
                                    photos: item.photos || [],
                                    mode: 'replace',
                                  })
                                }
                                className="p-1 hover:bg-slate-100 rounded text-slate-600 cursor-pointer"
                                title="Perbarui Foto Utama"
                              >
                                <Camera className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )
                        )}
                      </td>

                      {/* 12. Aksi (Super Admin: Edit; User: Detail Baca) */}
                      <td className="py-2 px-3 text-center">
                        {isSuperAdmin ? (
                          <button
                            onClick={() => handleOpenEditModal(item)}
                            className="inline-flex items-center space-x-1 px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-md text-[11px] font-semibold border border-amber-300 transition-colors shadow-2xs cursor-pointer"
                            title={`Edit data aset ${item.AssetNumber}`}
                          >
                            <Edit3 className="w-3 h-3 text-amber-600" />
                            <span>Edit</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => handleOpenEditModal(item)}
                            className="inline-flex items-center space-x-1 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md text-[11px] font-medium border border-slate-300 transition-colors cursor-pointer"
                            title={`Lihat detail informasi aset ${item.AssetNumber}`}
                          >
                            <Eye className="w-3 h-3 text-slate-500" />
                            <span>Detail</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Photo Modal */}
      {photoModalData && (
        <PhotoModal
          assetId={photoModalData.assetId}
          assetNumber={photoModalData.assetNumber}
          assetName={photoModalData.assetName}
          initialPhotos={photoModalData.photos}
          initialMode={photoModalData.mode}
          onClose={() => setPhotoModalData(null)}
          onPhotosUpdated={loadData}
          isReadOnly={!isSuperAdmin}
        />
      )}

      {/* Modal Edit / Detail Aset (Fitur 1) */}
      {editingAsset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full border border-slate-200 overflow-hidden my-6">
            <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between">
              <div>
                <div className="flex items-center space-x-2">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                      isSuperAdmin ? 'bg-amber-400 text-slate-950' : 'bg-blue-500 text-white'
                    }`}
                  >
                    {isSuperAdmin ? 'Edit Aset' : 'Detail Aset (Read-Only)'}
                  </span>
                  <h3 className="text-sm font-bold">{editingAsset.AssetNumber}</h3>
                </div>
                <p className="text-[11px] text-slate-300 mt-0.5">
                  ID Aset: <span className="font-mono text-emerald-400">{editingAsset.AssetID}</span> &bull; Status:{' '}
                  <span className="text-emerald-400">{editingAsset.StatusAset}</span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingAsset(null)}
                className="p-1 hover:bg-slate-800 rounded-md text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {isSuperAdmin ? (
              <div className="p-4 bg-amber-50 border-b border-amber-200 text-amber-900 text-xs flex items-start space-x-2">
                <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <span>
                  <strong>Perhatian:</strong> Perubahan data aset ini akan secara otomatis disinkronkan ke record transaksi BAST terkait dan log aktivitas audit trail. ID Aset bersifat permanen.
                </span>
              </div>
            ) : (
              <div className="p-4 bg-blue-50 border-b border-blue-200 text-blue-900 text-xs flex items-start space-x-2">
                <Info className="w-4 h-4 text-blue-700 shrink-0 mt-0.5" />
                <span>
                  <strong>Mode Baca (User):</strong> Halaman ini menampilkan rincian data aset secara lengkap. Pengguna dengan akun User tidak memiliki hak akses mengubah data inventaris.
                </span>
              </div>
            )}

            {editError && (
              <div className="m-4 p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-lg flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{editError}</span>
              </div>
            )}

            <form onSubmit={handleSaveEdit} className="p-5 space-y-4">
              <fieldset disabled={!isSuperAdmin} className="disabled:opacity-80">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Nama Barang */}
                  <div className="md:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Nama Barang <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={editForm.NamaBarang}
                      onChange={(e) => setEditForm({ ...editForm, NamaBarang: e.target.value })}
                      className="w-full text-xs px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-emerald-500 focus:outline-none disabled:bg-slate-100 disabled:cursor-not-allowed"
                      placeholder="Contoh: Laptop ThinkPad T14"
                      required
                    />
                  </div>

                  {/* Jenis Barang */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Jenis / Kategori Barang
                    </label>
                    <input
                      type="text"
                      value={editForm.JenisBarang}
                      onChange={(e) => setEditForm({ ...editForm, JenisBarang: e.target.value })}
                      className="w-full text-xs px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-emerald-500 focus:outline-none disabled:bg-slate-100 disabled:cursor-not-allowed"
                      placeholder="Contoh: Elektronik & Komputer"
                    />
                  </div>

                  {/* Nomor Serial */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Nomor Serial (SN)
                    </label>
                    <input
                      type="text"
                      value={editForm.NomorSerial}
                      onChange={(e) => setEditForm({ ...editForm, NomorSerial: e.target.value })}
                      className="w-full text-xs px-3 py-2 border border-slate-300 rounded-md font-mono focus:ring-2 focus:ring-emerald-500 focus:outline-none disabled:bg-slate-100 disabled:cursor-not-allowed"
                      placeholder="Contoh: SN-88294719"
                    />
                  </div>

                  {/* Bidang Pengadaan */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Bidang Pengadaan <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={editForm.BidangPengadaan}
                      onChange={(e) => setEditForm({ ...editForm, BidangPengadaan: e.target.value })}
                      className="w-full text-xs px-3 py-2 border border-slate-300 rounded-md bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none disabled:bg-slate-100 disabled:cursor-not-allowed"
                      required
                    >
                      <option value="">-- Pilih Bidang Pengadaan --</option>
                      {bidangList.map((b) => (
                        <option key={b.ParamID} value={b.Kode || b.Key}>
                          {b.Kode || b.Key} — {b.Value}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Bidang Pengguna */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Bidang Pengguna <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={editForm.BidangPengguna}
                      onChange={(e) => setEditForm({ ...editForm, BidangPengguna: e.target.value, Pemilik: e.target.value })}
                      className="w-full text-xs px-3 py-2 border border-slate-300 rounded-md bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none disabled:bg-slate-100 disabled:cursor-not-allowed"
                      required
                    >
                      <option value="">-- Pilih Bidang Pengguna --</option>
                      {bidangList.map((b) => (
                        <option key={b.ParamID} value={b.Kode || b.Key}>
                          {b.Kode || b.Key} — {b.Value}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Tanggal Perolehan */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Tanggal Perolehan <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={editForm.TanggalPerolehan}
                      onChange={(e) => setEditForm({ ...editForm, TanggalPerolehan: e.target.value })}
                      className="w-full text-xs px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-emerald-500 focus:outline-none disabled:bg-slate-100 disabled:cursor-not-allowed"
                      required
                    />
                  </div>

                  {/* Kondisi */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Kondisi Aset <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={editForm.Kondisi}
                      onChange={(e) => setEditForm({ ...editForm, Kondisi: e.target.value })}
                      className="w-full text-xs px-3 py-2 border border-slate-300 rounded-md bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none disabled:bg-slate-100 disabled:cursor-not-allowed"
                      required
                    >
                      {kondisiList.length > 0 ? (
                        kondisiList.map((k) => (
                          <option key={k.ParamID} value={k.Key}>
                            {k.Label}
                          </option>
                        ))
                      ) : (
                        <>
                          <option value="Baik">Baik (Siap Pakai)</option>
                          <option value="Rusak Ringan">Rusak Ringan (Perlu Servis)</option>
                          <option value="Rusak Berat">Rusak Berat (Tidak Beroperasi)</option>
                        </>
                      )}
                    </select>
                  </div>

                  {/* Jumlah */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Jumlah Unit
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={editForm.Jumlah}
                      onChange={(e) => setEditForm({ ...editForm, Jumlah: parseInt(e.target.value, 10) || 1 })}
                      className="w-full text-xs px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-emerald-500 focus:outline-none disabled:bg-slate-100 disabled:cursor-not-allowed"
                    />
                  </div>

                  {/* Lokasi */}
                  <div className="md:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Lokasi Penempatan <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={editForm.Lokasi}
                      onChange={(e) => setEditForm({ ...editForm, Lokasi: e.target.value })}
                      className="w-full text-xs px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-emerald-500 focus:outline-none disabled:bg-slate-100 disabled:cursor-not-allowed"
                      placeholder="Contoh: Ruang Server IT Lt. 2 / Gedung A"
                      required
                    />
                  </div>

                  {/* Detail / Spesifikasi */}
                  <div className="md:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Detail / Spesifikasi Lengkap
                    </label>
                    <textarea
                      rows={3}
                      value={editForm.DetailSpesifikasi}
                      onChange={(e) => setEditForm({ ...editForm, DetailSpesifikasi: e.target.value })}
                      className="w-full text-xs px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-emerald-500 focus:outline-none resize-none disabled:bg-slate-100 disabled:cursor-not-allowed"
                      placeholder="Detail prosesor, RAM, kapasitas, merk, warna, dll."
                    />
                  </div>
                </div>
              </fieldset>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setEditingAsset(null)}
                  disabled={editLoading}
                  className="px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-100 rounded-lg text-xs font-medium transition-colors cursor-pointer"
                >
                  {isSuperAdmin ? 'Batal' : 'Tutup'}
                </button>
                {isSuperAdmin && (
                  <button
                    type="submit"
                    disabled={editLoading}
                    className="inline-flex items-center space-x-1.5 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer"
                  >
                    {editLoading ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Menyimpan...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Simpan Perubahan Aset</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
