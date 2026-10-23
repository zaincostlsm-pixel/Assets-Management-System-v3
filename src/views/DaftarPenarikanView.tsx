import React, { useState, useEffect, useMemo } from 'react';
import {
  ArchiveRestore,
  Search,
  Download,
  RefreshCw,
  Image as ImageIcon,
  ArrowUpDown,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  X,
  Shield,
  Info,
} from 'lucide-react';
import { DataPenarikan, ParameterItem, FotoInventaris, AuthUser } from '../types';
import { api } from '../services/api';
import { PhotoModal } from '../components/PhotoModal';

interface DaftarPenarikanViewProps {
  currentUser?: AuthUser | null;
}

export const DaftarPenarikanView: React.FC<DaftarPenarikanViewProps> = ({ currentUser }) => {
  const isSuperAdmin = currentUser?.role === 'Super Admin';
  const [withdrawals, setWithdrawals] = useState<DataPenarikan[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [filterPemilik, setFilterPemilik] = useState('Semua');
  const [filterAlasan, setFilterAlasan] = useState('Semua');
  const [filterStatus, setFilterStatus] = useState<'Semua' | 'Ditarik' | 'Direstore'>('Semua');

  // Sorting
  const [sortField, setSortField] = useState<keyof DataPenarikan>('TanggalPenarikan');
  const [sortAsc, setSortAsc] = useState(false);

  // Parameter options
  const [bidangList, setBidangList] = useState<ParameterItem[]>([]);
  const [alasanList, setAlasanList] = useState<ParameterItem[]>([]);

  // Restore Modal State (Super Admin Only)
  const [selectedForRestore, setSelectedForRestore] = useState<DataPenarikan | null>(null);
  const [restoreReason, setRestoreReason] = useState('');
  const [restoreLoading, setRestoreLoading] = useState(false);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  // Photo modal
  const [selectedPhotoAsset, setSelectedPhotoAsset] = useState<{
    assetId: string;
    assetNumber: string;
    assetName: string;
    photos: FotoInventaris[];
  } | null>(null);

  useEffect(() => {
    loadData();
    loadParameters();
  }, []);

  const loadParameters = async () => {
    try {
      const [bidangs, alasans] = await Promise.all([
        api.getParameters('Bidang'),
        api.getParameters('AlasanPenarikan'),
      ]);
      setBidangList(bidangs.filter((b) => b.Status === 'Aktif'));
      setAlasanList(alasans.filter((a) => a.Status === 'Aktif'));
    } catch (e) {
      console.error(e);
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await api.getWithdrawals({});
      setWithdrawals(data);
    } catch (e) {
      console.error('Error loading withdrawals:', e);
    } finally {
      setLoading(false);
    }
  };

  // Filtered & Sorted
  const filteredWithdrawals = useMemo(() => {
    return withdrawals
      .filter((w) => {
        const pengadaan = w.BidangPengadaan || w.Pemilik || '';
        const pengguna = w.BidangPengguna || w.Pemilik || '';
        if (
          filterPemilik !== 'Semua' &&
          pengadaan.toLowerCase() !== filterPemilik.toLowerCase() &&
          pengguna.toLowerCase() !== filterPemilik.toLowerCase()
        )
          return false;
        if (filterAlasan !== 'Semua' && !w.AlasanPenarikan.toLowerCase().includes(filterAlasan.toLowerCase()))
          return false;

        // Filter status restore
        const currentStatus = w.StatusPenarikan === 'Direstore' ? 'Direstore' : 'Ditarik';
        if (filterStatus !== 'Semua' && currentStatus !== filterStatus) {
          return false;
        }

        if (search) {
          const s = search.toLowerCase();
          const match =
            w.AssetNumber.toLowerCase().includes(s) ||
            w.NamaBarang.toLowerCase().includes(s) ||
            w.NomorSerial.toLowerCase().includes(s) ||
            pengadaan.toLowerCase().includes(s) ||
            pengguna.toLowerCase().includes(s) ||
            w.LokasiTerakhir.toLowerCase().includes(s) ||
            w.AlasanPenarikan.toLowerCase().includes(s) ||
            w.Catatan.toLowerCase().includes(s) ||
            w.DitarikOleh.toLowerCase().includes(s) ||
            (w.RestoreReason && w.RestoreReason.toLowerCase().includes(s));
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
  }, [withdrawals, filterPemilik, filterAlasan, filterStatus, search, sortField, sortAsc]);

  const handleSort = (field: keyof DataPenarikan) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  const handleExportExcel = () => {
    const params: Record<string, string> = {};
    if (filterPemilik !== 'Semua') params.pemilik = filterPemilik;
    if (filterAlasan !== 'Semua') params.alasan = filterAlasan;
    if (search) params.search = search;
    api.downloadExport(
      '/api/export/withdrawals',
      params,
      `Daftar_Penarikan_Aset_${new Date().toISOString().slice(0, 10)}.xlsx`
    );
  };

  const handleOpenRestoreModal = (item: DataPenarikan) => {
    if (!isSuperAdmin) return;
    setSelectedForRestore(item);
    setRestoreReason('');
    setRestoreError(null);
  };

  const handleConfirmRestore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedForRestore || !isSuperAdmin) return;

    if (!restoreReason.trim()) {
      setRestoreError('Alasan restore wajib diisi untuk keperluan jejak audit administratif.');
      return;
    }

    setRestoreLoading(true);
    setRestoreError(null);

    try {
      const res = await api.restoreWithdrawal(selectedForRestore.WithdrawalID, restoreReason.trim());
      setSuccessNotice(
        res.message ||
          `Aset ${selectedForRestore.AssetNumber} (${selectedForRestore.NamaBarang}) berhasil direstore ke status Aktif!`
      );
      setSelectedForRestore(null);
      setRestoreReason('');
      loadData();
    } catch (err: any) {
      setRestoreError(err.message || 'Gagal memproses restore aset.');
    } finally {
      setRestoreLoading(false);
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* Success Notification Alert */}
      {successNotice && (
        <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl flex items-center justify-between text-emerald-800 text-xs shadow-xs animate-in fade-in">
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

      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-200">
        <div>
          <div className="flex items-center space-x-2">
            <div className="p-2 bg-rose-100 text-rose-800 rounded-lg">
              <ArchiveRestore className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-lg font-bold text-slate-800">Daftar Penarikan Aset (Fitur 5)</h1>
                {isSuperAdmin ? (
                  <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-100 text-blue-800 border border-blue-200">
                    <Shield className="w-3 h-3 text-blue-600" />
                    <span>Super Admin: Akses Penuh + Fitur Restore</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                    User: Hak Akses Baca & Ekspor
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500">
                Tabel horizontal seluruh catatan penarikan aset dari operasional dengan jejak audit dan pemulihan (Restore)
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={loadData}
            className="p-2 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-medium flex items-center space-x-1 cursor-pointer"
            title="Muat Ulang Data"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Refresh</span>
          </button>
          <button
            onClick={handleExportExcel}
            className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-semibold flex items-center space-x-1.5 shadow-xs cursor-pointer"
            title="Ekspor daftar penarikan aset ke file Excel"
          >
            <Download className="w-4 h-4" />
            <span>Ekspor Excel (.xlsx)</span>
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          {/* Global Search */}
          <div className="relative">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari No Inventaris, Nama, Alasan, Catatan..."
              className="w-full text-xs pl-8 pr-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-rose-500 focus:outline-none"
            />
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
          </div>

          {/* Filter Pemilik */}
          <div>
            <select
              value={filterPemilik}
              onChange={(e) => setFilterPemilik(e.target.value)}
              className="w-full text-xs px-2.5 py-2 border border-slate-300 rounded-md bg-white focus:outline-none"
            >
              <option value="Semua">Semua Pemilik (Bidang)</option>
              {bidangList.map((b) => (
                <option key={b.ParamID} value={b.Kode || b.Key}>
                  {b.Kode || b.Key} — {b.Value}
                </option>
              ))}
            </select>
          </div>

          {/* Filter Alasan */}
          <div>
            <select
              value={filterAlasan}
              onChange={(e) => setFilterAlasan(e.target.value)}
              className="w-full text-xs px-2.5 py-2 border border-slate-300 rounded-md bg-white focus:outline-none"
            >
              <option value="Semua">Semua Alasan Penarikan</option>
              {alasanList.map((al) => (
                <option key={al.ParamID} value={al.Key}>
                  {al.Label}
                </option>
              ))}
            </select>
          </div>

          {/* Filter Status Penarikan / Restore */}
          <div>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as any)}
              className="w-full text-xs px-2.5 py-2 border border-slate-300 rounded-md bg-white focus:outline-none"
            >
              <option value="Semua">Semua Status (Ditarik & Direstore)</option>
              <option value="Ditarik">Hanya Status Ditarik (Belum Direstore)</option>
              <option value="Direstore">Hanya Telah Direstore</option>
            </select>
          </div>
        </div>

        {/* Count Line */}
        <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100">
          <div className="flex items-center space-x-3">
            <span>
              Total Baris Data:{' '}
              <strong className="text-slate-800 font-bold">{filteredWithdrawals.length}</strong> unit
            </span>
            <span className="text-slate-300">&bull;</span>
            <span className="text-rose-700 font-medium">
              Aktif Ditarik: {withdrawals.filter((w) => w.StatusPenarikan !== 'Direstore').length}
            </span>
            <span className="text-slate-300">&bull;</span>
            <span className="text-emerald-700 font-medium">
              Telah Direstore: {withdrawals.filter((w) => w.StatusPenarikan === 'Direstore').length}
            </span>
          </div>
          {(search || filterPemilik !== 'Semua' || filterAlasan !== 'Semua' || filterStatus !== 'Semua') && (
            <button
              onClick={() => {
                setSearch('');
                setFilterPemilik('Semua');
                setFilterAlasan('Semua');
                setFilterStatus('Semua');
              }}
              className="text-blue-600 hover:underline text-xs cursor-pointer"
            >
              Reset Filter
            </button>
          )}
        </div>
      </div>

      {/* Horizontal Excel-like Table */}
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
                  onClick={() => handleSort('NamaBarang')}
                  className="py-2.5 px-3 font-semibold border-b border-slate-700 cursor-pointer hover:bg-slate-800"
                >
                  <div className="flex items-center space-x-1">
                    <span>Jenis / Nama Barang</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th className="py-2.5 px-3 font-semibold border-b border-slate-700 min-w-[200px]">
                  Detail / Spesifikasi
                </th>
                <th className="py-2.5 px-3 font-semibold border-b border-slate-700">
                  Nomor Serial
                </th>
                <th
                  onClick={() => handleSort('BidangPengadaan' as any)}
                  className="py-2.5 px-3 font-semibold border-b border-slate-700 cursor-pointer hover:bg-slate-800"
                >
                  <div className="flex items-center space-x-1">
                    <span>Bidang Pengadaan</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('BidangPengguna' as any)}
                  className="py-2.5 px-3 font-semibold border-b border-slate-700 cursor-pointer hover:bg-slate-800"
                >
                  <div className="flex items-center space-x-1">
                    <span>Bidang Pengguna</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th className="py-2.5 px-3 font-semibold border-b border-slate-700">
                  Tanggal Perolehan
                </th>
                <th className="py-2.5 px-3 font-semibold border-b border-slate-700">
                  Kondisi
                </th>
                <th className="py-2.5 px-3 font-semibold border-b border-slate-700">
                  Lokasi Terakhir
                </th>
                <th
                  onClick={() => handleSort('TanggalPenarikan')}
                  className="py-2.5 px-3 font-semibold border-b border-slate-700 cursor-pointer hover:bg-slate-800"
                >
                  <div className="flex items-center space-x-1">
                    <span>Tanggal Penarikan</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('AlasanPenarikan')}
                  className="py-2.5 px-3 font-semibold border-b border-slate-700 cursor-pointer hover:bg-slate-800 min-w-[180px]"
                >
                  <div className="flex items-center space-x-1">
                    <span>Alasan Penarikan</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th className="py-2.5 px-3 font-semibold border-b border-slate-700 min-w-[200px]">
                  Catatan
                </th>
                <th className="py-2.5 px-3 font-semibold border-b border-slate-700">
                  Ditarik Oleh
                </th>
                <th className="py-2.5 px-3 font-semibold border-b border-slate-700 text-center min-w-[130px]">
                  Status Penarikan
                </th>
                <th className="py-2.5 px-3 font-semibold border-b border-slate-700 text-center">
                  Foto
                </th>
                {isSuperAdmin && (
                  <th className="py-2.5 px-3 font-semibold border-b border-slate-700 text-center min-w-[125px]">
                    Aksi Restore
                  </th>
                )}
              </tr>
            </thead>

            {/* Table Body with Thin borders & Zebra stripes */}
            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr>
                  <td colSpan={isSuperAdmin ? 17 : 16} className="py-12 text-center text-slate-500">
                    <div className="inline-block w-6 h-6 border-2 border-rose-600 border-t-transparent rounded-full animate-spin mb-2" />
                    <p>Memuat daftar penarikan aset dari database...</p>
                  </td>
                </tr>
              ) : filteredWithdrawals.length === 0 ? (
                <tr>
                  <td colSpan={isSuperAdmin ? 17 : 16} className="py-12 text-center text-slate-400">
                    Tidak ada aset yang sesuai dengan kriteria filter saat ini.
                  </td>
                </tr>
              ) : (
                filteredWithdrawals.map((w, idx) => {
                  const isEven = idx % 2 === 1;
                  const photoCount = w.photos ? w.photos.length : 0;
                  const isRestored = w.StatusPenarikan === 'Direstore';

                  return (
                    <tr
                      key={w.WithdrawalID}
                      className={`hover:bg-rose-50/40 transition-colors ${
                        isRestored ? 'bg-emerald-50/30' : isEven ? 'bg-slate-50/60' : 'bg-white'
                      }`}
                    >
                      {/* 1. No */}
                      <td className="py-2.5 px-3 text-center text-slate-400 font-mono text-[11px] border-r border-slate-200">
                        {idx + 1}
                      </td>

                      {/* 2. Nomor Inventaris */}
                      <td className="py-2.5 px-3 font-mono font-bold text-rose-800 border-r border-slate-200">
                        {w.AssetNumber}
                      </td>

                      {/* 3. Jenis / Nama Barang */}
                      <td className="py-2.5 px-3 font-semibold text-slate-800 border-r border-slate-200">
                        {w.NamaBarang}
                      </td>

                      {/* 4. Detail / Spesifikasi */}
                      <td
                        className="py-2.5 px-3 text-slate-600 max-w-[240px] truncate border-r border-slate-200"
                        title={w.DetailSpesifikasi}
                      >
                        {w.DetailSpesifikasi || '-'}
                      </td>

                      {/* 5. Nomor Serial */}
                      <td className="py-2.5 px-3 font-mono text-slate-700 border-r border-slate-200">
                        {w.NomorSerial || '-'}
                      </td>

                      {/* 6. Bidang Pengadaan */}
                      <td className="py-2.5 px-3 font-semibold text-slate-800 border-r border-slate-200">
                        <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-800 text-[11px] font-medium border border-blue-200">
                          {w.BidangPengadaan || '-'}
                        </span>
                      </td>

                      {/* 7. Bidang Pengguna */}
                      <td className="py-2.5 px-3 font-semibold text-slate-800 border-r border-slate-200">
                        <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 text-[11px] font-medium border border-emerald-200">
                          {w.BidangPengguna || w.Pemilik || '-'}
                        </span>
                      </td>

                      {/* 8. Tanggal Perolehan */}
                      <td className="py-2.5 px-3 text-slate-700 border-r border-slate-200">
                        {w.TanggalPerolehan}
                      </td>

                      {/* 9. Kondisi */}
                      <td className="py-2.5 px-3 border-r border-slate-200">
                        <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-800 text-[11px] font-medium">
                          {w.Kondisi}
                        </span>
                      </td>

                      {/* 10. Lokasi Terakhir */}
                      <td className="py-2.5 px-3 text-slate-700 border-r border-slate-200">
                        {w.LokasiTerakhir}
                      </td>

                      {/* 11. Tanggal Penarikan */}
                      <td className="py-2.5 px-3 font-semibold text-rose-900 border-r border-slate-200">
                        {w.TanggalPenarikan}
                      </td>

                      {/* 12. Alasan Penarikan */}
                      <td className="py-2.5 px-3 font-medium text-slate-800 border-r border-slate-200">
                        {w.AlasanPenarikan}
                      </td>

                      {/* 13. Catatan */}
                      <td
                        className="py-2.5 px-3 text-slate-600 max-w-[260px] truncate border-r border-slate-200"
                        title={w.Catatan}
                      >
                        {w.Catatan || '-'}
                      </td>

                      {/* 14. Ditarik Oleh */}
                      <td className="py-2.5 px-3 font-medium text-slate-700 border-r border-slate-200">
                        {w.DitarikOleh}
                      </td>

                      {/* 15. Status Penarikan / Restore Info */}
                      <td className="py-2.5 px-3 text-center border-r border-slate-200">
                        {isRestored ? (
                          <div className="inline-flex flex-col items-center">
                            <span
                              className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[11px] font-bold border border-emerald-300"
                              title={`Direstore oleh: ${w.RestoredBy || 'Super Admin'} pada ${w.RestoredAt || '-'}. Alasan: ${w.RestoreReason || '-'}`}
                            >
                              Telah Direstore
                            </span>
                            {w.RestoredAt && (
                              <span className="text-[10px] text-emerald-700 mt-0.5">
                                {w.RestoredAt.slice(0, 10)}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-800 text-[11px] font-semibold border border-rose-300">
                            Ditarik (Arsip)
                          </span>
                        )}
                      </td>

                      {/* 16. Foto */}
                      <td className="py-2.5 px-3 text-center border-r border-slate-200">
                        {photoCount > 0 ? (
                          <button
                            onClick={() =>
                              setSelectedPhotoAsset({
                                assetId: w.AssetID,
                                assetNumber: w.AssetNumber,
                                assetName: w.NamaBarang,
                                photos: w.photos || [],
                              })
                            }
                            className="inline-flex items-center space-x-1 px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-medium cursor-pointer"
                          >
                            <ImageIcon className="w-3 h-3" />
                            <span>{photoCount} Foto</span>
                          </button>
                        ) : (
                          <span className="text-[10px] text-slate-400">-</span>
                        )}
                      </td>

                      {/* 17. Aksi Restore (Super Admin Only) */}
                      {isSuperAdmin && (
                        <td className="py-2 px-3 text-center">
                          {isRestored ? (
                            <span className="text-[11px] text-slate-400 italic">
                              Selesai (Aktif)
                            </span>
                          ) : (
                            <button
                              onClick={() => handleOpenRestoreModal(w)}
                              className="inline-flex items-center space-x-1 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-[11px] font-semibold shadow-2xs transition-colors cursor-pointer"
                              title={`Restore aset ${w.AssetNumber} kembali ke inventaris aktif`}
                            >
                              <RotateCcw className="w-3 h-3" />
                              <span>Restore Aset</span>
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Restore Confirmation Modal (Super Admin Only) */}
      {selectedForRestore && isSuperAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-emerald-700 text-white flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-800/80 flex items-center justify-center text-white">
                  <RotateCcw className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm">Konfirmasi Restore Aset ke Inventaris</h3>
                  <p className="text-[11px] text-emerald-100">
                    Otoritas Khusus Super Admin &bull; Pengembalian Status Aset Aktif
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedForRestore(null)}
                className="text-emerald-200 hover:text-white text-xl font-bold p-1 cursor-pointer"
              >
                &times;
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleConfirmRestore} className="p-6 space-y-4">
              {restoreError && (
                <div className="p-3 bg-rose-50 border border-rose-300 rounded-xl flex items-start space-x-2 text-xs text-rose-800">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div className="leading-relaxed">{restoreError}</div>
                </div>
              )}

              {/* Asset Identity Card */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2 text-xs">
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Identitas Aset yang Akan Direstore
                </div>
                <div className="grid grid-cols-2 gap-2 text-slate-700">
                  <div>
                    <span className="text-slate-400 block text-[10px]">Nomor Inventaris</span>
                    <span className="font-mono font-bold text-emerald-800 text-xs">
                      {selectedForRestore.AssetNumber}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Nama Barang</span>
                    <span className="font-semibold text-slate-900">
                      {selectedForRestore.NamaBarang}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Tanggal Penarikan</span>
                    <span>{selectedForRestore.TanggalPenarikan}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Ditarik Oleh</span>
                    <span>{selectedForRestore.DitarikOleh}</span>
                  </div>
                </div>
                <div className="pt-2 border-t border-slate-200/80">
                  <span className="text-slate-400 block text-[10px]">Alasan Penarikan Sebelumnya</span>
                  <span className="text-slate-600 italic">
                    {selectedForRestore.AlasanPenarikan}
                  </span>
                </div>
              </div>

              {/* Notice info */}
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-900 flex items-start space-x-2">
                <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <div className="text-[11px] leading-relaxed">
                  Aset ini akan kembali berstatus <strong>Aktif</strong> dan muncul kembali di{' '}
                  <strong>Monitoring Inventaris (Fitur 3)</strong>. Catatan riwayat penarikan ini tetap tersimpan sebagai jejak audit. Nomor Inventaris dan ID aset tidak akan berubah.
                </div>
              </div>

              {/* Mandatory Reason Input */}
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Alasan Restore Aset <span className="text-rose-600">*</span>
                </label>
                <textarea
                  rows={3}
                  value={restoreReason}
                  onChange={(e) => setRestoreReason(e.target.value)}
                  placeholder="Contoh: Aset selesai diperbaiki / keputusan manajerial pengaktifan kembali unit..."
                  className="w-full text-xs p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  required
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Wajib mencantumkan alasan pengembalian aset sesuai keputusan administratif yang sah.
                </p>
              </div>

              {/* Action buttons */}
              <div className="pt-3 border-t border-slate-200 flex justify-end space-x-2.5">
                <button
                  type="button"
                  onClick={() => setSelectedForRestore(null)}
                  disabled={restoreLoading}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 border border-slate-300 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={restoreLoading}
                  className="px-5 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl shadow-md shadow-emerald-700/20 flex items-center space-x-2 transition-all cursor-pointer"
                >
                  {restoreLoading ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Memproses Restore...</span>
                    </>
                  ) : (
                    <>
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Konfirmasi & Restore Aset</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Photo Modal */}
      {selectedPhotoAsset && (
        <PhotoModal
          assetId={selectedPhotoAsset.assetId}
          assetNumber={selectedPhotoAsset.assetNumber}
          assetName={selectedPhotoAsset.assetName}
          initialPhotos={selectedPhotoAsset.photos}
          onClose={() => setSelectedPhotoAsset(null)}
          onPhotosUpdated={loadData}
          isReadOnly={!isSuperAdmin}
        />
      )}
    </div>
  );
};
