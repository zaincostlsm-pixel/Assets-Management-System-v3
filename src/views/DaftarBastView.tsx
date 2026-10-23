import React, { useState, useEffect, useMemo } from 'react';
import {
  Table2,
  Search,
  Filter,
  Download,
  Image as ImageIcon,
  ArrowUpDown,
  RefreshCw,
  ExternalLink,
  FileText,
} from 'lucide-react';
import { BastRecord, ParameterItem, FotoInventaris } from '../types';
import { api } from '../services/api';
import { PhotoModal } from '../components/PhotoModal';
import { BastPdfModal } from '../components/BastPdfModal';

export const DaftarBastView: React.FC = () => {
  const [records, setRecords] = useState<BastRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [filterBidang, setFilterBidang] = useState('Semua');
  const [filterYear, setFilterYear] = useState('Semua');
  const [filterStatus, setFilterStatus] = useState('Semua');
  const [filterBastNo, setFilterBastNo] = useState('');

  // Sort
  const [sortField, setSortField] = useState<keyof BastRecord>('Tanggal');
  const [sortAsc, setSortAsc] = useState(false);

  // Parameter data for dropdowns
  const [bidangList, setBidangList] = useState<ParameterItem[]>([]);

  // Photo modal state
  const [selectedAssetForPhoto, setSelectedAssetForPhoto] = useState<{
    assetId: string;
    assetNumber: string;
    assetName: string;
    photos: FotoInventaris[];
  } | null>(null);

  // Fitur 7: BAST PDF Modal State
  const [selectedBastForPdf, setSelectedBastForPdf] = useState<{
    bastNo: string;
    items: BastRecord[];
  } | null>(null);
  const [pdfDropdownOpen, setPdfDropdownOpen] = useState(false);

  useEffect(() => {
    loadData();
    loadBidangs();
  }, []);

  const loadBidangs = async () => {
    try {
      const bList = await api.getParameters('Bidang');
      const safeList = Array.isArray(bList) ? bList : [];
      setBidangList(safeList.filter((b) => b && b.Status === 'Aktif'));
    } catch (e) {
      console.error(e);
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await api.getBastList({});
      setRecords(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Error loading BAST records:', e);
      setRecords([]);
    } finally {
      setLoading(false);
    }
  };

  // Distinct Years in records
  const availableYears = useMemo(() => {
    const set = new Set<number>();
    const safeRecords = Array.isArray(records) ? records : [];
    safeRecords.forEach((r) => {
      if (r && r.Tahun) set.add(r.Tahun);
    });
    return Array.from(set).sort((a, b) => b - a);
  }, [records]);

  // Distinct BAST numbers for PDF dropdown grouping
  const distinctBastNumbers = useMemo(() => {
    const map = new Map<string, { bastNo: string; bidangPengadaan: string; bidangPengguna?: string; count: number }>();
    const safeRecords = Array.isArray(records) ? records : [];
    safeRecords.forEach((r) => {
      if (!r) return;
      const pengadaan = r.BidangPengadaan || r.Bidang || '-';
      if (!map.has(r.BASTNo)) {
        map.set(r.BASTNo, { bastNo: r.BASTNo, bidangPengadaan: pengadaan, bidangPengguna: r.BidangPengguna, count: 1 });
      } else {
        map.get(r.BASTNo)!.count++;
      }
    });
    return Array.from(map.values()).reverse();
  }, [records]);

  // Handle open PDF BAST (strictly groups all records belonging to this BASTNo)
  const handleOpenPdf = (targetBastNo: string) => {
    const cleanNo = targetBastNo.trim();
    const itemsInThisBast = records.filter((r) => r.BASTNo.trim() === cleanNo);
    if (itemsInThisBast.length === 0) {
      alert(`Data untuk nomor BAST "${cleanNo}" tidak ditemukan.`);
      return;
    }
    setSelectedBastForPdf({
      bastNo: cleanNo,
      items: itemsInThisBast,
    });
  };

  // Filtered & Sorted Records
  const filteredRecords = useMemo(() => {
    return records
      .filter((r) => {
        const bPengadaan = r.BidangPengadaan || r.Bidang || '';
        const bPengguna = r.BidangPengguna || '';
        if (filterBidang !== 'Semua' && bPengadaan.toLowerCase() !== filterBidang.toLowerCase() && bPengguna.toLowerCase() !== filterBidang.toLowerCase()) return false;
        if (filterYear !== 'Semua' && String(r.Tahun) !== filterYear) return false;
        if (filterStatus !== 'Semua' && r.Status.toLowerCase() !== filterStatus.toLowerCase()) return false;
        if (filterBastNo && !r.BASTNo.toLowerCase().includes(filterBastNo.toLowerCase())) return false;
        if (search) {
          const s = search.toLowerCase();
          const match =
            r.BASTNo.toLowerCase().includes(s) ||
            r.NamaBarang.toLowerCase().includes(s) ||
            r.UniqueName.toLowerCase().includes(s) ||
            r.AssetNumber.toLowerCase().includes(s) ||
            r.NomorSerial.toLowerCase().includes(s) ||
            bPengadaan.toLowerCase().includes(s) ||
            bPengguna.toLowerCase().includes(s) ||
            r.LokasiDistribusi.toLowerCase().includes(s) ||
            r.DetailSpesifikasi.toLowerCase().includes(s);
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
  }, [records, filterBidang, filterYear, filterStatus, filterBastNo, search, sortField, sortAsc]);

  const handleSort = (field: keyof BastRecord) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  const handleExportExcel = () => {
    const params: Record<string, string> = {};
    if (filterBidang !== 'Semua') params.bidang = filterBidang;
    if (filterYear !== 'Semua') params.year = filterYear;
    if (filterStatus !== 'Semua') params.status = filterStatus;
    if (filterBastNo) params.bastNo = filterBastNo;
    if (search) params.search = search;
    api.downloadExport('/api/export/bast', params, `Daftar_BAST_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-200">
        <div>
          <div className="flex items-center space-x-2">
            <div className="p-2 bg-indigo-100 text-indigo-700 rounded-lg">
              <Table2 className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-800">Daftar Transaksi BAST</h1>
              <p className="text-xs text-slate-500">
                Tampilan tabel horizontal seperti lembar kerja Excel (satu baris per barang/transaksi)
              </p>
            </div>
          </div>
        </div>

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
            onClick={handleExportExcel}
            className="px-3 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-semibold flex items-center space-x-1.5 shadow-xs cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Ekspor Excel (.xlsx)</span>
          </button>

          {/* Fitur 7: Unduh PDF BAST Action Button & Dropdown */}
          <div className="relative">
            <button
              onClick={() => setPdfDropdownOpen(!pdfDropdownOpen)}
              className="px-3.5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold flex items-center space-x-1.5 shadow-xs transition-colors cursor-pointer"
              title="Unduh dokumen formal Bukti Serah Terima Asset (PDF) sesuai template resmi FOR-AFT-10"
            >
              <FileText className="w-4 h-4" />
              <span>Unduh PDF BAST</span>
            </button>

            {pdfDropdownOpen && (
              <div className="absolute right-0 mt-1.5 z-30 w-80 bg-white rounded-xl shadow-2xl border border-slate-200 divide-y divide-slate-100 overflow-hidden">
                <div className="p-2.5 bg-slate-900 text-white flex items-center justify-between text-xs">
                  <span className="font-bold flex items-center space-x-1.5">
                    <FileText className="w-3.5 h-3.5 text-red-400" />
                    <span>Pilih Nomor BAST untuk PDF:</span>
                  </span>
                  <button
                    onClick={() => setPdfDropdownOpen(false)}
                    className="text-slate-400 hover:text-white text-sm"
                  >
                    &times;
                  </button>
                </div>
                <div className="max-h-64 overflow-y-auto divide-y divide-slate-100 p-1">
                  {distinctBastNumbers.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-500">
                      Belum ada transaksi BAST.
                    </div>
                  ) : (
                    distinctBastNumbers.map((b) => (
                      <button
                        key={b.bastNo}
                        type="button"
                        onClick={() => {
                          setPdfDropdownOpen(false);
                          handleOpenPdf(b.bastNo);
                        }}
                        className="w-full text-left p-2.5 hover:bg-red-50/80 rounded-md transition-colors flex items-center justify-between group"
                      >
                        <div>
                          <div className="font-mono font-bold text-blue-900 text-xs group-hover:text-red-700">
                            {b.bastNo}
                          </div>
                          <div className="text-[10px] text-slate-500 mt-0.5">
                            Pengadaan: <strong className="text-slate-700">{b.bidangPengadaan}</strong>
                            {b.bidangPengguna && <span> • Pengguna: <strong className="text-slate-700">{b.bidangPengguna}</strong></span>}
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 group-hover:bg-red-100 group-hover:text-red-800">
                            {b.count} Barang
                          </span>
                          <span className="block text-[9px] text-red-600 font-semibold mt-0.5">
                            Buka PDF &rarr;
                          </span>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
          {/* Global Search */}
          <div className="md:col-span-2 relative">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari BAST, Nama Barang, SN, No Inventaris, Lokasi..."
              className="w-full text-xs pl-8 pr-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
          </div>

          {/* Filter Bidang */}
          <div>
            <select
              value={filterBidang}
              onChange={(e) => setFilterBidang(e.target.value)}
              className="w-full text-xs px-2.5 py-2 border border-slate-300 rounded-md bg-white focus:outline-none"
            >
              <option value="Semua">Semua Bidang</option>
              {bidangList.map((b) => (
                <option key={b.ParamID} value={b.Kode || b.Key}>
                  {b.Kode || b.Key}
                </option>
              ))}
            </select>
          </div>

          {/* Filter Tahun */}
          <div>
            <select
              value={filterYear}
              onChange={(e) => setFilterYear(e.target.value)}
              className="w-full text-xs px-2.5 py-2 border border-slate-300 rounded-md bg-white focus:outline-none"
            >
              <option value="Semua">Semua Tahun</option>
              {availableYears.map((yr) => (
                <option key={yr} value={String(yr)}>
                  Tahun {yr}
                </option>
              ))}
            </select>
          </div>

          {/* Filter Status */}
          <div>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full text-xs px-2.5 py-2 border border-slate-300 rounded-md bg-white focus:outline-none"
            >
              <option value="Semua">Semua Status</option>
              <option value="Aktif">Status Aktif</option>
              <option value="Ditarik">Status Ditarik</option>
            </select>
          </div>
        </div>

        {/* Status Count Line */}
        <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100">
          <div>
            Menampilkan <strong className="text-slate-800">{filteredRecords.length}</strong> transaksi dari total{' '}
            <strong className="text-slate-800">{records.length}</strong> BAST
          </div>
          {(search || filterBidang !== 'Semua' || filterYear !== 'Semua' || filterStatus !== 'Semua') && (
            <button
              onClick={() => {
                setSearch('');
                setFilterBidang('Semua');
                setFilterYear('Semua');
                setFilterStatus('Semua');
                setFilterBastNo('');
              }}
              className="text-blue-600 hover:underline text-xs"
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
                  onClick={() => handleSort('Tanggal')}
                  className="py-2.5 px-3 font-semibold border-b border-slate-700 cursor-pointer hover:bg-slate-800"
                >
                  <div className="flex items-center space-x-1">
                    <span>Tanggal</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th className="py-2.5 px-2 font-semibold border-b border-slate-700 text-center w-14">
                  Bulan
                </th>
                <th className="py-2.5 px-2 font-semibold border-b border-slate-700 text-center w-14">
                  Tahun
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
                  onClick={() => handleSort('BASTNo')}
                  className="py-2.5 px-3 font-semibold border-b border-slate-700 cursor-pointer hover:bg-slate-800"
                >
                  <div className="flex items-center space-x-1">
                    <span>Nomor BAST</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('NamaBarang')}
                  className="py-2.5 px-3 font-semibold border-b border-slate-700 cursor-pointer hover:bg-slate-800"
                >
                  <div className="flex items-center space-x-1">
                    <span>Nama Barang</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th className="py-2.5 px-2.5 font-semibold border-b border-slate-700 text-center">
                  Unique Name
                </th>
                <th className="py-2.5 px-3 font-semibold border-b border-slate-700 min-w-[200px]">
                  Detail / Spesifikasi
                </th>
                <th className="py-2.5 px-3 font-semibold border-b border-slate-700">
                  Nomor Serial
                </th>
                <th className="py-2.5 px-3 font-semibold border-b border-slate-700">
                  Lokasi Distribusi
                </th>
                <th className="py-2.5 px-3 font-semibold border-b border-slate-700">
                  Nomor UPA
                </th>
                <th className="py-2.5 px-3 font-semibold border-b border-slate-700">
                  Tanggal Terima
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
                <th className="py-2.5 px-3 font-semibold border-b border-slate-700 text-center">
                  Foto
                </th>
                <th className="py-2.5 px-3 font-semibold border-b border-slate-700 text-center">
                  Status
                </th>
                <th className="py-2.5 px-3 font-semibold border-b border-slate-700 text-center min-w-[140px]">
                  Dokumen BAST
                </th>
              </tr>
            </thead>

            {/* Table Body with Thin borders & Zebra stripes */}
            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr>
                  <td colSpan={18} className="py-12 text-center text-slate-500">
                    <div className="inline-block w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mb-2" />
                    <p>Memuat data BAST dari server terpusat...</p>
                  </td>
                </tr>
              ) : filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={18} className="py-12 text-center text-slate-400">
                    Tidak ada transaksi BAST yang cocok dengan filter yang dipilih.
                  </td>
                </tr>
              ) : (
                filteredRecords.map((r, idx) => {
                  const photoCount = r.photos ? r.photos.filter((p) => p.StatusFoto === 'Aktif').length : 0;
                  const isEven = idx % 2 === 1;

                  return (
                    <tr
                      key={r.BASTRecordID}
                      className={`hover:bg-blue-50/60 transition-colors ${
                        isEven ? 'bg-slate-50/60' : 'bg-white'
                      }`}
                    >
                      <td className="py-2 px-3 text-center text-slate-400 font-mono text-[11px] border-r border-slate-200">
                        {idx + 1}
                      </td>
                      <td className="py-2 px-3 text-slate-700 border-r border-slate-200">
                        {r.Tanggal}
                      </td>
                      <td className="py-2 px-2 text-center text-slate-600 border-r border-slate-200">
                        {r.Bulan}
                      </td>
                      <td className="py-2 px-2 text-center font-mono text-slate-600 border-r border-slate-200">
                        {r.Tahun}
                      </td>
                      <td className="py-2 px-3 font-semibold text-slate-800 border-r border-slate-200">
                        <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-800 text-[11px] font-medium border border-blue-200">
                          {r.BidangPengadaan || r.Bidang || '-'}
                        </span>
                      </td>
                      <td className="py-2 px-3 font-semibold text-slate-800 border-r border-slate-200">
                        <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 text-[11px] font-medium border border-emerald-200">
                          {r.BidangPengguna || '-'}
                        </span>
                      </td>
                      <td className="py-2 px-3 font-mono font-bold text-blue-700 border-r border-slate-200">
                        <button
                          type="button"
                          onClick={() => handleOpenPdf(r.BASTNo)}
                          className="hover:underline hover:text-blue-900 text-left cursor-pointer flex items-center space-x-1"
                          title="Klik untuk membuka dokumen resmi PDF BAST ini"
                        >
                          <span>{r.BASTNo}</span>
                          <FileText className="w-3 h-3 text-red-500 shrink-0" />
                        </button>
                      </td>
                      <td className="py-2 px-3 font-semibold text-slate-900 border-r border-slate-200">
                        {r.NamaBarang}
                      </td>
                      <td className="py-2 px-2.5 text-center border-r border-slate-200">
                        <span className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-800 font-bold">
                          {r.UniqueName}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-slate-600 max-w-[280px] truncate border-r border-slate-200" title={r.DetailSpesifikasi}>
                        {r.DetailSpesifikasi || '-'}
                      </td>
                      <td className="py-2 px-3 font-mono text-slate-700 border-r border-slate-200">
                        {r.NomorSerial || '-'}
                      </td>
                      <td className="py-2 px-3 text-slate-600 border-r border-slate-200">
                        {r.LokasiDistribusi || '-'}
                      </td>
                      <td className="py-2 px-3 font-mono text-slate-600 border-r border-slate-200">
                        {r.NomorUPA || '-'}
                      </td>
                      <td className="py-2 px-3 text-slate-600 border-r border-slate-200">
                        {r.TanggalPenerimaan || '-'}
                      </td>
                      <td className="py-2 px-3 font-mono font-bold text-emerald-800 border-r border-slate-200">
                        {r.AssetNumber}
                      </td>
                      {/* Foto Column */}
                      <td className="py-2 px-3 text-center border-r border-slate-200">
                        {photoCount > 0 ? (
                          <button
                            onClick={() =>
                              setSelectedAssetForPhoto({
                                assetId: r.AssetID,
                                assetNumber: r.AssetNumber,
                                assetName: r.NamaBarang,
                                photos: r.photos || [],
                              })
                            }
                            className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full bg-blue-100 hover:bg-blue-200 text-blue-800 text-[11px] font-semibold transition-colors"
                          >
                            <ImageIcon className="w-3 h-3" />
                            <span>{photoCount} Foto</span>
                          </button>
                        ) : (
                          <button
                            onClick={() =>
                              setSelectedAssetForPhoto({
                                assetId: r.AssetID,
                                assetNumber: r.AssetNumber,
                                assetName: r.NamaBarang,
                                photos: [],
                              })
                            }
                            className="text-[10px] text-slate-400 hover:text-blue-600 hover:underline"
                          >
                            + Unggah
                          </button>
                        )}
                      </td>
                      {/* Status Column */}
                      <td className="py-2 px-3 text-center border-r border-slate-200">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wide uppercase ${
                            r.Status === 'Aktif'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {r.Status}
                        </span>
                      </td>

                      {/* Fitur 7: Dokumen BAST PDF Action Cell */}
                      <td className="py-2 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleOpenPdf(r.BASTNo)}
                          className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-md bg-red-600 hover:bg-red-700 text-white font-bold text-[11px] shadow-xs transition-colors cursor-pointer"
                          title={`Unduh dokumen resmi PDF untuk BAST ${r.BASTNo} (seluruh barang dalam BAST ini)`}
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span>Unduh PDF BAST</span>
                        </button>
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
      {selectedAssetForPhoto && (
        <PhotoModal
          assetId={selectedAssetForPhoto.assetId}
          assetNumber={selectedAssetForPhoto.assetNumber}
          assetName={selectedAssetForPhoto.assetName}
          initialPhotos={selectedAssetForPhoto.photos}
          onClose={() => setSelectedAssetForPhoto(null)}
          onPhotosUpdated={loadData}
        />
      )}

      {/* Fitur 7: Dokumen Resmi BAST PDF Modal */}
      {selectedBastForPdf && (
        <BastPdfModal
          bastNo={selectedBastForPdf.bastNo}
          items={selectedBastForPdf.items}
          onClose={() => setSelectedBastForPdf(null)}
        />
      )}
    </div>
  );
};
