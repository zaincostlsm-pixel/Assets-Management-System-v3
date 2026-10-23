import React, { useState } from 'react';
import {
  X,
  Download,
  Printer,
  ExternalLink,
  FileText,
  Package,
  Calendar,
  Building2,
  CheckCircle2,
  Loader2,
} from 'lucide-react';
import { BastRecord } from '../types';
import { api } from '../services/api';

interface BastPdfModalProps {
  bastNo: string;
  items: BastRecord[];
  onClose: () => void;
}

export const BastPdfModal: React.FC<BastPdfModalProps> = ({ bastNo, items, onClose }) => {
  const [isDownloading, setIsDownloading] = useState(false);
  const pdfUrl = api.getBastPdfUrl(bastNo, true);

  const handleDownload = () => {
    setIsDownloading(true);
    try {
      api.downloadBastPdf(bastNo);
      setTimeout(() => setIsDownloading(false), 1200);
    } catch (err) {
      console.error(err);
      setIsDownloading(false);
    }
  };

  const handleOpenNewTab = () => {
    window.open(pdfUrl, '_blank');
  };

  const firstItem = items[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-3 md:p-6">
      <div className="bg-white rounded-xl shadow-2xl max-w-5xl w-full max-h-[95vh] flex flex-col overflow-hidden border border-slate-200">
        {/* Header Modal */}
        <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-red-600 flex items-center justify-center shadow-xs">
              <FileText className="w-4 h-4 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-sm font-bold text-white tracking-wide">
                  DOKUMEN RESMI BUKTI SERAH TERIMA ASSET (BAST)
                </h2>
                <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-red-900/60 text-red-200 border border-red-700/50">
                  PDF Resmi
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Nomor: <strong className="text-blue-300 font-mono">{bastNo}</strong> • Sesuai format formulir resmi FOR-AFT-10 Rev. 04
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleDownload}
              disabled={isDownloading}
              className="px-3.5 py-1.5 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white text-xs font-bold rounded-lg shadow-xs flex items-center space-x-1.5 transition-all cursor-pointer"
            >
              {isDownloading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Mengunduh PDF...</span>
                </>
              ) : (
                <>
                  <Download className="w-3.5 h-3.5" />
                  <span>Unduh PDF BAST</span>
                </>
              )}
            </button>

            <button
              onClick={handleOpenNewTab}
              className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-medium rounded-lg flex items-center space-x-1 transition-colors"
              title="Buka PDF di tab baru / cetak langsung"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Buka Tab</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors ml-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Info Strip */}
        <div className="px-5 py-2.5 bg-slate-100 border-b border-slate-200 flex flex-wrap items-center justify-between text-xs text-slate-600 gap-2 shrink-0">
          <div className="flex items-center space-x-4">
            <span className="flex items-center space-x-1">
              <Building2 className="w-3.5 h-3.5 text-blue-500" />
              <span>Pengadaan: <strong className="text-blue-800 font-semibold">{firstItem?.BidangPengadaan || firstItem?.Bidang || '-'}</strong></span>
            </span>
            <span className="flex items-center space-x-1">
              <Building2 className="w-3.5 h-3.5 text-emerald-500" />
              <span>Pengguna: <strong className="text-emerald-800 font-semibold">{firstItem?.BidangPengguna || '-'}</strong></span>
            </span>
            <span className="flex items-center space-x-1">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span>Penerimaan: <strong className="text-slate-800">{firstItem?.TanggalPenerimaan || firstItem?.Tanggal}</strong></span>
            </span>
            <span className="flex items-center space-x-1">
              <Package className="w-3.5 h-3.5 text-slate-400" />
              <span>Jumlah: <strong className="text-emerald-700 font-bold">{items.length} Barang</strong></span>
            </span>
          </div>

          <div className="text-[11px] text-slate-500 font-mono">
            Template: <strong>FOR-AFT-10</strong> • Rev: <strong>04</strong> • Tgl: <strong>12.07.2024</strong>
          </div>
        </div>

        {/* Main PDF Viewer Container */}
        <div className="flex-1 bg-slate-200 overflow-hidden relative min-h-[460px] flex items-center justify-center p-2">
          <iframe
            src={pdfUrl}
            title={`BAST ${bastNo}`}
            className="w-full h-full rounded-lg border border-slate-300 shadow-md bg-white min-h-[500px]"
          />
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 bg-white border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-2 shrink-0 text-xs">
          <div className="text-slate-500 text-[11px]">
            * Dokumen PDF dibuat dalam orientasi <strong>Landscape A4</strong> dengan tabel resmi, subkolom kondisi (Baik, Layak pakai, Rusak), area tanda tangan Kabag/Kadept dan penerimaan AM.
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={onClose}
              className="px-4 py-1.5 border border-slate-300 text-slate-700 hover:bg-slate-50 font-medium rounded-lg text-xs"
            >
              Tutup
            </button>
            <button
              onClick={handleDownload}
              className="px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg text-xs shadow-xs flex items-center space-x-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Unduh File (.pdf)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
