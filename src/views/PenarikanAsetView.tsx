import React, { useState, useEffect } from 'react';
import {
  FileMinus2,
  AlertTriangle,
  CheckCircle2,
  Search,
  Building2,
  Calendar,
  MapPin,
  Tag,
  ShieldAlert,
} from 'lucide-react';
import { DataInventaris, ParameterItem } from '../types';
import { api } from '../services/api';

interface PenarikanAsetViewProps {
  onSuccessNavigate?: () => void;
}

export const PenarikanAsetView: React.FC<PenarikanAsetViewProps> = ({ onSuccessNavigate }) => {
  const todayStr = new Date().toISOString().slice(0, 10);

  // Filter & Selection fields
  const [selectedPemilik, setSelectedPemilik] = useState<string>('Semua');
  const [namaBarangQuery, setNamaBarangQuery] = useState('');
  const [selectedAssetNumber, setSelectedAssetNumber] = useState('');

  // Selected Asset Details (Read-only once selected)
  const [selectedAsset, setSelectedAsset] = useState<DataInventaris | null>(null);

  // Withdrawal transaction fields
  const [tanggalPenarikan, setTanggalPenarikan] = useState(todayStr);
  const [alasanPenarikan, setAlasanPenarikan] = useState('');
  const [customAlasan, setCustomAlasan] = useState('');
  const [catatan, setCatatan] = useState('');
  const [ditarikOleh, setDitarikOleh] = useState('');

  // Master options
  const [bidangList, setBidangList] = useState<ParameterItem[]>([]);
  const [alasanList, setAlasanList] = useState<ParameterItem[]>([]);
  const [activeAssets, setActiveAssets] = useState<DataInventaris[]>([]);

  // States
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [successInfo, setSuccessInfo] = useState<{ assetNumber: string; namaBarang: string } | null>(null);

  useEffect(() => {
    loadParameters();
    loadActiveAssets();
  }, []);

  const loadParameters = async () => {
    try {
      const [bidangs, alasans, configResp] = await Promise.all([
        api.getParameters('Bidang'),
        api.getParameters('AlasanPenarikan'),
        api.getConfig(),
      ]);
      setBidangList(bidangs.filter((b) => b.Status === 'Aktif'));
      const activeAlasans = alasans.filter((a) => a.Status === 'Aktif');
      setAlasanList(activeAlasans);
      if (activeAlasans.length > 0) {
        setAlasanPenarikan(activeAlasans[0].Value || activeAlasans[0].Label);
      }
      setDitarikOleh(configResp.config?.currentUser || 'Admin Pengelola Aset');
    } catch (e) {
      console.error(e);
    }
  };

  const loadActiveAssets = async () => {
    try {
      const assets = await api.getActiveAssetsForWithdrawal();
      setActiveAssets(assets);
    } catch (e) {
      console.error(e);
    }
  };

  // Filter active assets for autocomplete based on selected Pemilik & query
  const eligibleAssets = activeAssets.filter((item) => {
    const bidangPengguna = item.BidangPengguna || item.Pemilik || '';
    if (selectedPemilik !== 'Semua' && bidangPengguna.toLowerCase() !== selectedPemilik.toLowerCase()) {
      return false;
    }
    if (namaBarangQuery.trim()) {
      const q = namaBarangQuery.toLowerCase();
      const match =
        item.NamaBarang.toLowerCase().includes(q) ||
        item.AssetNumber.toLowerCase().includes(q) ||
        item.NomorSerial.toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });

  const handleSelectAsset = (asset: DataInventaris) => {
    setSelectedAsset(asset);
    setSelectedAssetNumber(asset.AssetNumber);
    setNamaBarangQuery(asset.NamaBarang);
    setErrorMsg(null);
  };

  const handleResetForm = () => {
    setSelectedAsset(null);
    setSelectedAssetNumber('');
    setNamaBarangQuery('');
    setCatatan('');
    setCustomAlasan('');
    setErrorMsg(null);
  };

  const handleOpenConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!selectedAsset) {
      setErrorMsg('Harap pilih aset yang akan ditarik terlebih dahulu.');
      return;
    }
    if (!tanggalPenarikan) {
      setErrorMsg('Tanggal penarikan wajib diisi.');
      return;
    }
    const finalAlasan = alasanPenarikan === 'Lainnya' ? customAlasan.trim() : alasanPenarikan;
    if (!finalAlasan) {
      setErrorMsg('Alasan penarikan wajib ditentukan.');
      return;
    }

    setShowConfirmModal(true);
  };

  const handleConfirmSubmit = async () => {
    if (!selectedAsset) return;
    setIsSubmitting(true);
    setShowConfirmModal(false);
    setErrorMsg(null);

    try {
      const finalAlasan = alasanPenarikan === 'Lainnya' ? customAlasan.trim() : alasanPenarikan;

      const res = await api.submitWithdrawal({
        assetId: selectedAsset.AssetID,
        tanggalPenarikan,
        alasanPenarikan: finalAlasan,
        catatan,
        ditarikOleh,
      });

      setSuccessInfo({
        assetNumber: selectedAsset.AssetNumber,
        namaBarang: selectedAsset.NamaBarang,
      });

      handleResetForm();
      loadActiveAssets();
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal memproses penarikan aset.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6">
      {/* Title Header */}
      <div className="flex items-center space-x-2 pb-3 border-b border-slate-200">
        <div className="p-2 bg-amber-100 text-amber-800 rounded-lg">
          <FileMinus2 className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-slate-800">Penarikan Aset (Withdrawal)</h1>
          <p className="text-xs text-slate-500">
            Formulir pencatatan penarikan aset aktif, alasan audit, dan pemindahan ke daftar arsip penarikan
          </p>
        </div>
      </div>

      {errorMsg && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg flex items-center space-x-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      <form onSubmit={handleOpenConfirm} className="space-y-6">
        {/* Step 1: Search and Select Active Asset */}
        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center space-x-2 pb-2 border-b border-slate-100">
            <span className="w-6 h-6 rounded-full bg-amber-100 text-amber-800 text-xs font-bold flex items-center justify-center">
              1
            </span>
            <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
              Pencarian & Pemilihan Aset Aktif
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Filter Pemilik (Bidang) */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Filter Pemilik (Bidang)
              </label>
              <select
                value={selectedPemilik}
                onChange={(e) => {
                  setSelectedPemilik(e.target.value);
                  setSelectedAsset(null);
                }}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-md bg-white focus:outline-none"
              >
                <option value="Semua">Semua Bidang</option>
                {bidangList.map((b) => (
                  <option key={b.ParamID} value={b.Kode || b.Key}>
                    {b.Kode || b.Key} — {b.Value}
                  </option>
                ))}
              </select>
            </div>

            {/* Search by Name / SN */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Cari Nama Barang / Nomor Inventaris
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={namaBarangQuery}
                  onChange={(e) => setNamaBarangQuery(e.target.value)}
                  placeholder="Ketik untuk memfilter aset..."
                  className="w-full text-xs pl-8 pr-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              </div>
            </div>
          </div>

          {/* Asset Selection Dropdown / Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Pilih Nomor Inventaris Yang Akan Ditarik <span className="text-rose-500">*</span>
            </label>
            <div className="border border-slate-300 rounded-md divide-y divide-slate-100 max-h-48 overflow-y-auto bg-slate-50">
              {eligibleAssets.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-500">
                  Tidak ditemukan aset aktif untuk kriteria pencarian ini.
                </div>
              ) : (
                eligibleAssets.map((asset) => {
                  const isSelected = selectedAsset?.AssetID === asset.AssetID;
                  return (
                    <button
                      key={asset.AssetID}
                      type="button"
                      onClick={() => handleSelectAsset(asset)}
                      className={`w-full text-left p-2.5 transition-colors flex items-center justify-between text-xs ${
                        isSelected
                          ? 'bg-amber-100/90 text-amber-950 font-bold border-l-4 border-amber-600'
                          : 'hover:bg-slate-100 text-slate-800'
                      }`}
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center space-x-2">
                          <span className="font-mono text-emerald-800 font-bold">{asset.AssetNumber}</span>
                          <span className="font-semibold text-slate-900">— {asset.NamaBarang}</span>
                        </div>
                        <div className="text-[11px] text-slate-500 flex items-center space-x-3">
                          <span>Pengadaan: <strong>{asset.BidangPengadaan || '-'}</strong></span>
                          <span>Pengguna: <strong>{asset.BidangPengguna || asset.Pemilik}</strong></span>
                          <span>Lokasi: {asset.Lokasi}</span>
                          <span>Kondisi: {asset.Kondisi}</span>
                        </div>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold">
                        Aktif
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Read-Only Details Panel */}
          {selectedAsset && (
            <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-lg space-y-3">
              <div className="flex items-center justify-between text-xs font-bold text-amber-900 border-b border-amber-200/80 pb-2">
                <span>Data Aset Terpilih (Otomatis Terisi & Terkunci):</span>
                <span className="font-mono text-emerald-800">{selectedAsset.AssetNumber}</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                <div>
                  <span className="text-[10px] text-slate-500 block">Nama Barang:</span>
                  <span className="font-semibold text-slate-800">{selectedAsset.NamaBarang}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block">Bidang Pengadaan:</span>
                  <span className="font-semibold text-blue-800">{selectedAsset.BidangPengadaan || '-'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block">Bidang Pengguna:</span>
                  <span className="font-semibold text-emerald-800">{selectedAsset.BidangPengguna || selectedAsset.Pemilik}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block">Tanggal Perolehan:</span>
                  <span className="font-semibold text-slate-800">{selectedAsset.TanggalPerolehan}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block">Lokasi Aset Saat Ini:</span>
                  <span className="font-semibold text-slate-800">{selectedAsset.Lokasi}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block">Kondisi Fisik:</span>
                  <span className="font-semibold text-slate-800">{selectedAsset.Kondisi}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block">Nomor Serial (SN):</span>
                  <span className="font-mono font-semibold text-slate-800">{selectedAsset.NomorSerial || '-'}</span>
                </div>
                <div className="sm:col-span-2 md:col-span-3">
                  <span className="text-[10px] text-slate-500 block">Detail / Spesifikasi:</span>
                  <span className="text-slate-700">{selectedAsset.DetailSpesifikasi || '-'}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Step 2: Withdrawal Reason and Notes */}
        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center space-x-2 pb-2 border-b border-slate-100">
            <span className="w-6 h-6 rounded-full bg-amber-100 text-amber-800 text-xs font-bold flex items-center justify-center">
              2
            </span>
            <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
              Tanggal, Alasan & Petugas Penarikan
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Tanggal Penarikan */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Tanggal Penarikan <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                value={tanggalPenarikan}
                onChange={(e) => setTanggalPenarikan(e.target.value)}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-amber-500 focus:outline-none"
                required
              />
            </div>

            {/* Ditarik Oleh */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Ditarik Oleh (Petugas)
              </label>
              <input
                type="text"
                value={ditarikOleh}
                onChange={(e) => setDitarikOleh(e.target.value)}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-amber-500 focus:outline-none"
                placeholder="Nama staff atau pengawas penarikan"
              />
            </div>
          </div>

          {/* Alasan Penarikan Dropdown */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Alasan Penarikan <span className="text-rose-500">*</span>
            </label>
            <select
              value={alasanPenarikan}
              onChange={(e) => setAlasanPenarikan(e.target.value)}
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-md bg-white focus:ring-2 focus:ring-amber-500 focus:outline-none font-medium"
              required
            >
              {alasanList.map((al) => (
                <option key={al.ParamID} value={al.Value || al.Label}>
                  {al.Label}
                </option>
              ))}
              <option value="Lainnya">Lainnya (Tuliskan alasan sendiri)</option>
            </select>
          </div>

          {alasanPenarikan === 'Lainnya' && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Tuliskan Alasan Penarikan Lainnya <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={customAlasan}
                onChange={(e) => setCustomAlasan(e.target.value)}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500"
                placeholder="Masukkan alasan penarikan khusus..."
                required
              />
            </div>
          )}

          {/* Catatan Penarikan */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Catatan Tambahan Penarikan
            </label>
            <textarea
              value={catatan}
              onChange={(e) => setCatatan(e.target.value)}
              rows={2}
              placeholder="Jelaskan kondisi fisik terakhir, berita acara penarikan, atau penggantian unit..."
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
            />
          </div>
        </div>

        {/* Buttons */}
        <div className="flex items-center justify-between pt-2">
          <button
            type="button"
            onClick={handleResetForm}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg"
          >
            Bersihkan Pilihan
          </button>

          <button
            type="submit"
            disabled={!selectedAsset || isSubmitting}
            className="px-6 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:bg-slate-300 text-white text-xs font-bold rounded-lg shadow-sm flex items-center space-x-2 transition-all cursor-pointer"
          >
            <ShieldAlert className="w-4 h-4" />
            <span>Tarik Aset dari Operasional</span>
          </button>
        </div>
      </form>

      {/* Confirmation Modal */}
      {showConfirmModal && selectedAsset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden">
            <div className="p-4 bg-rose-600 text-white flex items-center space-x-2 font-bold text-sm">
              <ShieldAlert className="w-5 h-5 text-rose-200" />
              <span>Konfirmasi Penarikan Aset</span>
            </div>
            <div className="p-5 space-y-3 text-xs text-slate-700">
              <p>
                Apakah Anda yakin ingin menarik aset berikut dari daftar inventaris aktif?
              </p>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-md space-y-1 font-mono text-xs">
                <div>No. Inventaris: <strong className="text-emerald-800">{selectedAsset.AssetNumber}</strong></div>
                <div>Nama Barang: <strong className="text-slate-900">{selectedAsset.NamaBarang}</strong></div>
                <div>Pemilik: <strong>{selectedAsset.Pemilik}</strong></div>
                <div>Alasan: <strong>{alasanPenarikan === 'Lainnya' ? customAlasan : alasanPenarikan}</strong></div>
              </div>
              <p className="text-[11px] text-slate-500">
                Aset akan dipindahkan ke <strong>Daftar Penarikan Aset</strong>. Riwayat BAST dan dokumentasi foto tetap tersimpan utuh di database.
              </p>
            </div>
            <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex justify-end space-x-2">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-800 font-medium"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmSubmit}
                disabled={isSubmitting}
                className="px-4 py-1.5 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-md shadow-xs"
              >
                {isSubmitting ? 'Memproses Penarikan...' : 'Ya, Tarik Aset'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success Notification */}
      {successInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full border border-slate-200 p-6 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">
                Aset Berhasil Ditarik!
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Status aset telah diubah menjadi "Ditarik" dan dipindahkan ke Daftar Penarikan Aset.
              </p>
            </div>
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs text-left">
              <div>Nomor Inventaris: <strong className="text-emerald-800">{successInfo.assetNumber}</strong></div>
              <div>Nama Barang: <strong className="text-slate-900">{successInfo.namaBarang}</strong></div>
            </div>
            <div className="flex space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setSuccessInfo(null)}
                className="w-1/2 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg"
              >
                Tarik Aset Lain
              </button>
              <button
                type="button"
                onClick={() => {
                  setSuccessInfo(null);
                  if (onSuccessNavigate) onSuccessNavigate();
                }}
                className="w-1/2 px-3 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-xs"
              >
                Buka Daftar Penarikan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
