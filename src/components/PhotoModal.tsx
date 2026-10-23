import React, { useState, useRef } from 'react';
import {
  X,
  Plus,
  RefreshCw,
  Image as ImageIcon,
  CheckCircle2,
  Calendar,
  User,
  ExternalLink,
  Upload,
} from 'lucide-react';
import { FotoInventaris } from '../types';
import { api, fileToBase64 } from '../services/api';

interface PhotoModalProps {
  assetId: string;
  assetNumber: string;
  assetName: string;
  initialPhotos: FotoInventaris[];
  onClose: () => void;
  onPhotosUpdated: () => void;
  initialMode?: 'view' | 'add' | 'replace';
  isReadOnly?: boolean;
}

export const PhotoModal: React.FC<PhotoModalProps> = ({
  assetId,
  assetNumber,
  assetName,
  initialPhotos,
  onClose,
  onPhotosUpdated,
  initialMode = 'view',
  isReadOnly = false,
}) => {
  const [photos, setPhotos] = useState<FotoInventaris[]>(initialPhotos);
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [mode, setMode] = useState<'view' | 'add' | 'replace'>(isReadOnly ? 'view' : initialMode);

  // Upload state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [keterangan, setKeterangan] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Active vs historical photos
  const activePhotos = photos.filter((p) => p.StatusFoto === 'Aktif');
  const historicalPhotos = photos.filter((p) => p.StatusFoto === 'Diganti' || p.StatusFoto === 'Nonaktif');
  const allOrderedPhotos = [...activePhotos, ...historicalPhotos];
  const currentPhoto = allOrderedPhotos[selectedIndex] || allOrderedPhotos[0];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMsg(null);
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];

    // Validate type
    const validTypes = ['image/jpeg', 'image/png', 'image/jpg'];
    if (!validTypes.includes(file.type.toLowerCase())) {
      setErrorMsg('Format file tidak didukung. Harap pilih foto bertipe JPG, JPEG, atau PNG.');
      return;
    }

    // Validate size (max 5MB)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      setErrorMsg('Ukuran file terlalu besar. Batas maksimal ukuran foto adalah 5 MB.');
      return;
    }

    setSelectedFile(file);
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
  };

  const handleUploadSubmit = async () => {
    if (!selectedFile) {
      setErrorMsg('Harap pilih berkas foto terlebih dahulu.');
      return;
    }

    setIsUploading(true);
    setErrorMsg(null);

    try {
      const base64 = await fileToBase64(selectedFile);
      if (mode === 'replace') {
        await api.replaceMainPhoto(assetId, base64, selectedFile.name, keterangan);
      } else {
        await api.addPhoto(assetId, base64, selectedFile.name, keterangan);
      }

      // Reload fresh photos from server
      const updated = await api.getPhotos(assetId);
      setPhotos(updated);
      setSelectedIndex(0);
      setMode('view');
      setSelectedFile(null);
      setPreviewUrl(null);
      setKeterangan('');
      onPhotosUpdated();
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal menyimpan foto ke server.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs px-2 py-0.5 rounded bg-blue-600 font-mono font-semibold">
                {assetNumber}
              </span>
              <h2 className="text-sm font-bold text-white">{assetName}</h2>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Dokumentasi Foto Fisik Aset & Riwayat Penggantian
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-slate-50">
          {mode === 'view' ? (
            <div>
              {allOrderedPhotos.length === 0 ? (
                <div className="text-center py-16 bg-white rounded-xl border border-dashed border-slate-300">
                  <ImageIcon className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-sm font-semibold text-slate-700">Belum Ada Foto untuk Aset Ini</p>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                    Aset ini belum memiliki foto dokumentasi fisik.
                  </p>
                  {!isReadOnly && (
                    <button
                      onClick={() => setMode('add')}
                      className="mt-4 inline-flex items-center space-x-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-sm"
                    >
                      <Plus className="w-4 h-4" />
                      <span>+ Tambah Foto Sekarang</span>
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Action Bar */}
                  <div className="flex items-center justify-between bg-white p-3 rounded-lg border border-slate-200">
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-semibold text-slate-700">
                        Total {allOrderedPhotos.length} Foto Tercatat
                      </span>
                      {historicalPhotos.length > 0 && (
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-medium">
                          {historicalPhotos.length} Foto Riwayat (Diganti)
                        </span>
                      )}
                    </div>
                    {!isReadOnly && (
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => {
                            setMode('add');
                            setSelectedFile(null);
                            setPreviewUrl(null);
                          }}
                          className="inline-flex items-center space-x-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium rounded-md shadow-xs transition-colors"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Tambah Foto Dokumentasi</span>
                        </button>
                        <button
                          onClick={() => {
                            setMode('replace');
                            setSelectedFile(null);
                            setPreviewUrl(null);
                          }}
                          className="inline-flex items-center space-x-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-md shadow-xs transition-colors"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          <span>Perbarui Foto Utama</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Main Large Inspection Area */}
                  {currentPhoto && (
                    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                      <div className="relative bg-slate-950 flex items-center justify-center min-h-[340px] max-h-[460px] overflow-hidden">
                        <img
                          src={currentPhoto.PhotoURL}
                          alt={currentPhoto.NamaFile}
                          className="max-h-[450px] w-auto max-w-full object-contain mx-auto"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = 'none';
                          }}
                        />
                        {/* Status Overlay Badge */}
                        <div className="absolute top-3 left-3 flex items-center space-x-2">
                          <span
                            className={`px-2.5 py-1 rounded text-xs font-bold tracking-wide shadow-md ${
                              currentPhoto.StatusFoto === 'Aktif'
                                ? 'bg-emerald-600 text-white'
                                : 'bg-amber-600 text-white'
                            }`}
                          >
                            Status: {currentPhoto.StatusFoto}
                          </span>
                        </div>
                        {/* Direct URL button */}
                        <a
                          href={currentPhoto.PhotoURL}
                          target="_blank"
                          rel="noreferrer"
                          className="absolute bottom-3 right-3 flex items-center space-x-1.5 px-3 py-1.5 bg-black/70 hover:bg-black/90 text-white text-xs rounded-md shadow-md backdrop-blur-xs"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>Buka Gambar Asli</span>
                        </a>
                      </div>

                      {/* Photo Metadata Footer */}
                      <div className="p-4 bg-white border-t border-slate-200 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                        <div>
                          <span className="text-slate-400 block text-[10px]">Nama Berkas:</span>
                          <span className="font-semibold text-slate-800 break-all">
                            {currentPhoto.NamaFile}
                          </span>
                        </div>
                        <div className="flex items-center space-x-2 text-slate-600">
                          <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
                          <div>
                            <span className="text-slate-400 block text-[10px]">Tanggal Unggah:</span>
                            <span className="font-medium text-slate-700">
                              {new Date(currentPhoto.TanggalUpload).toLocaleDateString('id-ID', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2 text-slate-600">
                          <User className="w-4 h-4 text-slate-400 shrink-0" />
                          <div>
                            <span className="text-slate-400 block text-[10px]">Pengunggah:</span>
                            <span className="font-medium text-slate-700">
                              {currentPhoto.UploadedBy || 'Admin Aset'}
                            </span>
                          </div>
                        </div>
                        {currentPhoto.Keterangan && (
                          <div className="md:col-span-3 pt-2 border-t border-slate-100 text-slate-600 text-[11px]">
                            <span className="font-semibold text-slate-700 mr-1.5">Catatan:</span>
                            {currentPhoto.Keterangan}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Thumbnail Carousel */}
                  {allOrderedPhotos.length > 1 && (
                    <div>
                      <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
                        Pilih Foto ({selectedIndex + 1} dari {allOrderedPhotos.length})
                      </div>
                      <div className="flex space-x-3 overflow-x-auto pb-2">
                        {allOrderedPhotos.map((p, idx) => (
                          <button
                            key={p.PhotoID || idx}
                            onClick={() => setSelectedIndex(idx)}
                            className={`relative rounded-lg overflow-hidden border-2 shrink-0 transition-all ${
                              selectedIndex === idx
                                ? 'border-blue-600 ring-2 ring-blue-400/40 scale-105 shadow-md'
                                : 'border-slate-200 hover:border-slate-400 opacity-75 hover:opacity-100'
                            }`}
                          >
                            <img
                              src={p.PhotoURL}
                              alt={p.NamaFile}
                              className="w-20 h-16 object-cover"
                            />
                            {p.StatusFoto === 'Diganti' && (
                              <div className="absolute inset-0 bg-amber-900/40 flex items-center justify-center">
                                <span className="text-[9px] font-bold text-amber-200 px-1 bg-black/60 rounded">
                                  Diganti
                                </span>
                              </div>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            /* Upload & Replace Mode Form */
            <div className="bg-white rounded-xl p-5 border border-slate-200 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center space-x-2">
                  <div
                    className={`w-7 h-7 rounded-md flex items-center justify-center text-white ${
                      mode === 'replace' ? 'bg-blue-600' : 'bg-emerald-600'
                    }`}
                  >
                    {mode === 'replace' ? <RefreshCw className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-800">
                      {mode === 'replace' ? 'Perbarui / Ganti Foto Utama' : 'Tambah Foto Dokumentasi Tambahan'}
                    </h3>
                    <p className="text-xs text-slate-500">
                      {mode === 'replace'
                        ? 'Foto lama akan diubah menjadi status "Diganti" dan tetap tersimpan sebagai histori audit.'
                        : 'Menambahkan foto fisik baru tanpa menghapus foto yang sudah ada.'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setMode('view');
                    setSelectedFile(null);
                    setPreviewUrl(null);
                  }}
                  className="text-xs text-slate-500 hover:text-slate-800 font-medium px-2 py-1 rounded hover:bg-slate-100"
                >
                  Kembali ke Galeri
                </button>
              </div>

              {errorMsg && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-md">
                  {errorMsg}
                </div>
              )}

              {/* Upload Drop Area */}
              <div>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept=".jpg,.jpeg,.png,image/jpeg,image/png"
                  className="hidden"
                />

                {!previewUrl ? (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-xl p-8 text-center cursor-pointer bg-slate-50 hover:bg-blue-50/30 transition-colors"
                  >
                    <Upload className="w-10 h-10 text-slate-400 mx-auto mb-2" />
                    <p className="text-xs font-semibold text-slate-700">
                      Klik untuk memilih berkas foto dari komputer / ponsel
                    </p>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Format: JPG, JPEG, PNG • Batas maksimal ukuran: 5 MB
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="relative rounded-lg overflow-hidden border border-slate-200 bg-slate-900 flex items-center justify-center max-h-72">
                      <img src={previewUrl} alt="Preview" className="max-h-72 object-contain mx-auto" />
                      <button
                        onClick={() => {
                          setSelectedFile(null);
                          setPreviewUrl(null);
                        }}
                        className="absolute top-2 right-2 p-1 bg-black/70 hover:bg-black text-white rounded-md text-xs"
                      >
                        Ganti Foto
                      </button>
                    </div>
                    <div className="text-xs text-slate-600 flex items-center justify-between">
                      <span>Nama berkas: <strong className="text-slate-800">{selectedFile?.name}</strong></span>
                      <span>Ukuran: {selectedFile ? (selectedFile.size / (1024 * 1024)).toFixed(2) : 0} MB</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Note / Description input */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Keterangan Dokumentasi (Opsional)
                </label>
                <input
                  type="text"
                  value={keterangan}
                  onChange={(e) => setKeterangan(e.target.value)}
                  placeholder="Misal: Tampak belakang plat nomor mesin / stiker kalibrasi terbaru"
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setMode('view');
                    setSelectedFile(null);
                    setPreviewUrl(null);
                  }}
                  className="px-4 py-2 text-xs text-slate-600 hover:text-slate-800 font-medium"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleUploadSubmit}
                  disabled={!selectedFile || isUploading}
                  className={`inline-flex items-center space-x-1.5 px-5 py-2 text-xs font-semibold rounded-lg text-white shadow-xs ${
                    mode === 'replace'
                      ? 'bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300'
                      : 'bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300'
                  }`}
                >
                  {isUploading ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin mr-1.5" />
                      <span>Menyimpan ke Database...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>{mode === 'replace' ? 'Simpan Foto Pengganti' : 'Simpan Foto Tambahan'}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 bg-white border-t border-slate-200 flex justify-between items-center shrink-0">
          <div className="text-[11px] text-slate-500">
            Terhubung ke Google Drive & Tabel Database FOTO_INVENTARIS
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs bg-slate-800 hover:bg-slate-900 text-white font-medium rounded-md shadow-xs transition-colors"
          >
            Tutup Galeri
          </button>
        </div>
      </div>
    </div>
  );
};
