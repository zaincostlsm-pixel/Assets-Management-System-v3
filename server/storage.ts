import fs from 'fs';
import path from 'path';
import {
  BastRecord,
  BridgeRecord,
  ParameterItem,
  MasterBarang,
  DataInventaris,
  DataPenarikan,
  FotoInventaris,
  LogAktivitas,
  AppConfig,
} from './types';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

export interface DatabaseSchema {
  DATA_BAST: BastRecord[];
  BRIDGE_RECORD: BridgeRecord[];
  PARAMETER: ParameterItem[];
  MASTER_BARANG: MasterBarang[];
  DATA_INVENTARIS: DataInventaris[];
  DATA_PENARIKAN: DataPenarikan[];
  FOTO_INVENTARIS: FotoInventaris[];
  LOG_AKTIVITAS: LogAktivitas[];
  CONFIG: AppConfig;
}

const ROMAN_MONTHS = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];

export function getRomanMonth(monthNum: number): string {
  if (monthNum >= 1 && monthNum <= 12) {
    return ROMAN_MONTHS[monthNum];
  }
  return 'I';
}

function getInitialDatabase(): DatabaseSchema {
  const now = '2026-10-20T22:00:00.000Z';
  const today = '2026-10-20';

  const PARAMETER: ParameterItem[] = [
    // Bidang
    { ParamID: 'PRM-BDG-01', Kategori: 'Bidang', Key: 'PPIC', Value: 'Production Planning & Inventory Control', Label: 'PPIC', Kode: 'PPIC', Status: 'Aktif', UpdatedAt: now },
    { ParamID: 'PRM-BDG-02', Kategori: 'Bidang', Key: 'GA', Value: 'General Affairs', Label: 'General Affairs', Kode: 'GA', Status: 'Aktif', UpdatedAt: now },
    { ParamID: 'PRM-BDG-03', Kategori: 'Bidang', Key: 'IT', Value: 'Information Technology', Label: 'IT / EDP', Kode: 'IT', Status: 'Aktif', UpdatedAt: now },
    { ParamID: 'PRM-BDG-04', Kategori: 'Bidang', Key: 'PROD', Value: 'Produksi', Label: 'Departemen Produksi', Kode: 'PROD', Status: 'Aktif', UpdatedAt: now },
    { ParamID: 'PRM-BDG-05', Kategori: 'Bidang', Key: 'KEU', Value: 'Keuangan & Akuntansi', Label: 'Keuangan', Kode: 'KEU', Status: 'Aktif', UpdatedAt: now },
    { ParamID: 'PRM-BDG-06', Kategori: 'Bidang', Key: 'HRD', Value: 'Human Resource Development', Label: 'HRD & GA', Kode: 'HRD', Status: 'Aktif', UpdatedAt: now },
    { ParamID: 'PRM-BDG-07', Kategori: 'Bidang', Key: 'QAQC', Value: 'Quality Assurance & Control', Label: 'QA / QC', Kode: 'QAQC', Status: 'Aktif', UpdatedAt: now },
    { ParamID: 'PRM-BDG-08', Kategori: 'Bidang', Key: 'GDG', Value: 'Gudang & Logistik', Label: 'Gudang', Kode: 'GDG', Status: 'Aktif', UpdatedAt: now },

    // Penomoran & Dokumen Resmi BAST
    { ParamID: 'PRM-NUM-01', Kategori: 'Penomoran', Key: 'DOC_CODE_BAST', Value: 'BSTA', Label: 'Kode Dokumen BAST', Kode: 'BSTA', Status: 'Aktif', Keterangan: 'Kode dokumen baku untuk BAST Aset', UpdatedAt: now },
    { ParamID: 'PRM-NUM-02', Kategori: 'Penomoran', Key: 'BAST_FORMAT', Value: '{SEQ}/{DOC_CODE}/{BIDANG}/{ROMAN_MONTH}/{YEAR}', Label: 'Format Penomoran BAST', Status: 'Aktif', Keterangan: 'Format baku nomor BAST', UpdatedAt: now },
    { ParamID: 'PRM-NUM-03', Kategori: 'Penomoran', Key: 'INVENTORY_FORMAT', Value: '{SEQ}.{UNIQUE_NAME}.{MMYY}.{BIDANG}', Label: 'Format Nomor Inventaris', Status: 'Aktif', Keterangan: 'Format baku nomor inventaris aset', UpdatedAt: now },
    { ParamID: 'PRM-PDF-01', Kategori: 'Penomoran', Key: 'BAST_TEMPLATE_FORM_NO', Value: 'FOR-AFT-10', Label: 'No. Formulir BAST PDF', Status: 'Aktif', Keterangan: 'Nomor formulir resmi pojok kanan atas BAST PDF', UpdatedAt: now },
    { ParamID: 'PRM-PDF-02', Kategori: 'Penomoran', Key: 'BAST_TEMPLATE_REVISI', Value: '04', Label: 'Revisi Formulir BAST PDF', Status: 'Aktif', Keterangan: 'Nomor revisi resmi dokumen BAST', UpdatedAt: now },
    { ParamID: 'PRM-PDF-03', Kategori: 'Penomoran', Key: 'BAST_TEMPLATE_BERLAKU', Value: '12.07.2024', Label: 'Tanggal Berlaku Formulir BAST', Status: 'Aktif', Keterangan: 'Tanggal mulai berlaku formulir BAST', UpdatedAt: now },

    // Kondisi
    { ParamID: 'PRM-KND-01', Kategori: 'Kondisi', Key: 'Baik', Value: 'Baik', Label: 'Baik (Siap Pakai)', Status: 'Aktif', UpdatedAt: now },
    { ParamID: 'PRM-KND-02', Kategori: 'Kondisi', Key: 'Rusak Ringan', Value: 'Rusak Ringan', Label: 'Rusak Ringan (Perlu Servis)', Status: 'Aktif', UpdatedAt: now },
    { ParamID: 'PRM-KND-03', Kategori: 'Kondisi', Key: 'Rusak Berat', Value: 'Rusak Berat', Label: 'Rusak Berat (Tidak Beroperasi)', Status: 'Aktif', UpdatedAt: now },

    // Alasan Penarikan
    { ParamID: 'PRM-TAR-01', Kategori: 'AlasanPenarikan', Key: 'Rusak Total', Value: 'Rusak Total / Tidak Ekonomis Diperbaiki', Label: 'Rusak Total / Afkir', Status: 'Aktif', UpdatedAt: now },
    { ParamID: 'PRM-TAR-02', Kategori: 'AlasanPenarikan', Key: 'Habis Masa Pakai', Value: 'Habis Masa Pakai / Depresiasi Selesai', Label: 'Habis Masa Pakai', Status: 'Aktif', UpdatedAt: now },
    { ParamID: 'PRM-TAR-03', Kategori: 'AlasanPenarikan', Key: 'Penggantian Unit', Value: 'Penggantian Unit Baru / Upgrade', Label: 'Penggantian Unit Baru', Status: 'Aktif', UpdatedAt: now },
    { ParamID: 'PRM-TAR-04', Kategori: 'AlasanPenarikan', Key: 'Mutasi Relokasi', Value: 'Mutasi / Relokasi ke Cabang Lain', Label: 'Mutasi / Relokasi', Status: 'Aktif', UpdatedAt: now },
    { ParamID: 'PRM-TAR-05', Kategori: 'AlasanPenarikan', Key: 'Hilang', Value: 'Hilang / Tidak Ditemukan saat Stock Opname', Label: 'Hilang / Tidak Ditemukan', Status: 'Aktif', UpdatedAt: now },

    // Umum
    { ParamID: 'PRM-UMM-01', Kategori: 'Umum', Key: 'MAX_PHOTO_SIZE_MB', Value: '5', Label: 'Maksimum Ukuran Foto (MB)', Status: 'Aktif', Keterangan: 'Batas ukuran file foto yang diperbolehkan', UpdatedAt: now },
    { ParamID: 'PRM-UMM-02', Kategori: 'Umum', Key: 'ALLOWED_PHOTO_EXT', Value: 'jpg,jpeg,png', Label: 'Format Foto yang Diizinkan', Status: 'Aktif', UpdatedAt: now },
  ];

  const MASTER_BARANG: MasterBarang[] = [
    { MasterBarangID: 'MB-001', NamaBarang: 'Timbangan Digital', UniqueName: 'TBG', JenisBarang: 'Alat Ukur / Timbang', Status: 'Aktif', CreatedAt: now, UpdatedAt: now },
    { MasterBarangID: 'MB-002', NamaBarang: 'Laptop ThinkPad', UniqueName: 'LPTP', JenisBarang: 'Elektronik & Komputer', Status: 'Aktif', CreatedAt: now, UpdatedAt: now },
    { MasterBarangID: 'MB-003', NamaBarang: 'Komputer Workstation PC', UniqueName: 'PC', JenisBarang: 'Elektronik & Komputer', Status: 'Aktif', CreatedAt: now, UpdatedAt: now },
    { MasterBarangID: 'MB-004', NamaBarang: 'Printer LaserJet', UniqueName: 'PRN', JenisBarang: 'Elektronik & Perlengkapan Kantor', Status: 'Aktif', CreatedAt: now, UpdatedAt: now },
    { MasterBarangID: 'MB-005', NamaBarang: 'Meja Kerja Ergonomis', UniqueName: 'MJK', JenisBarang: 'Furnitur Kantor', Status: 'Aktif', CreatedAt: now, UpdatedAt: now },
    { MasterBarangID: 'MB-006', NamaBarang: 'Kursi Kerja Putar', UniqueName: 'KSJ', JenisBarang: 'Furnitur Kantor', Status: 'Aktif', CreatedAt: now, UpdatedAt: now },
    { MasterBarangID: 'MB-007', NamaBarang: 'Air Conditioner Split 2 PK', UniqueName: 'ACS', JenisBarang: 'Fasilitas & Utilitas', Status: 'Aktif', CreatedAt: now, UpdatedAt: now },
    { MasterBarangID: 'MB-008', NamaBarang: 'Barcode Scanner Wireless', UniqueName: 'BCS', JenisBarang: 'Alat Inventaris Gudang', Status: 'Aktif', CreatedAt: now, UpdatedAt: now },
    { MasterBarangID: 'MB-009', NamaBarang: 'Pallet Jack Manual 3 Ton', UniqueName: 'PLT', JenisBarang: 'Mesin & Alat Berat Gudang', Status: 'Aktif', CreatedAt: now, UpdatedAt: now },
    { MasterBarangID: 'MB-010', NamaBarang: 'Genset Silent 50 KVA', UniqueName: 'GNS', JenisBarang: 'Mesin & Generator', Status: 'Aktif', CreatedAt: now, UpdatedAt: now },
  ];

  const DATA_BAST: BastRecord[] = [
    {
      BASTRecordID: 'BST-2026-001',
      AssetID: 'AST-2026-001',
      Tanggal: '2026-10-05',
      Bulan: 10,
      Tahun: 2026,
      BidangPengadaan: 'PPIC',
      BidangPengguna: 'PPIC',
      Bidang: 'PPIC',
      BASTNo: '001/BSTA/PPIC/X/2026',
      NamaBarang: 'Timbangan Digital',
      UniqueName: 'TBG',
      JenisBarang: 'Alat Ukur / Timbang',
      DetailSpesifikasi: 'CAS Caston III 500kg Akurasi 0.1kg dengan sertifikat kalibrasi',
      NomorSerial: 'SN-CAS-98124',
      LokasiDistribusi: 'Gudang Bahan Baku R-02',
      NomorUPA: 'UPA-2026-1002',
      TanggalPenerimaan: '2026-10-05',
      AssetNumber: '001.TBG.1026.PPIC',
      Status: 'Aktif',
      CreatedAt: '2026-10-05T09:15:00.000Z',
      CreatedBy: 'Admin Aset',
      UpdatedAt: '2026-10-05T09:15:00.000Z',
      UpdatedBy: 'Admin Aset',
    },
    {
      BASTRecordID: 'BST-2026-002',
      AssetID: 'AST-2026-002',
      Tanggal: '2026-10-05',
      Bulan: 10,
      Tahun: 2026,
      BidangPengadaan: 'PPIC',
      BidangPengguna: 'PPIC',
      Bidang: 'PPIC',
      BASTNo: '001/BSTA/PPIC/X/2026', // Same BAST No, 2nd item
      NamaBarang: 'Barcode Scanner Wireless',
      UniqueName: 'BCS',
      JenisBarang: 'Alat Inventaris Gudang',
      DetailSpesifikasi: 'Honeywell Voyager 1472g Bluetooth 2D Scanner',
      NomorSerial: 'SN-HNW-44120',
      LokasiDistribusi: 'Gudang Bahan Baku R-02',
      NomorUPA: 'UPA-2026-1002',
      TanggalPenerimaan: '2026-10-05',
      AssetNumber: '002.BCS.1026.PPIC',
      Status: 'Aktif',
      CreatedAt: '2026-10-05T09:20:00.000Z',
      CreatedBy: 'Admin Aset',
      UpdatedAt: '2026-10-05T09:20:00.000Z',
      UpdatedBy: 'Admin Aset',
    },
    {
      BASTRecordID: 'BST-2026-003',
      AssetID: 'AST-2026-003',
      Tanggal: '2026-10-10',
      Bulan: 10,
      Tahun: 2026,
      BidangPengadaan: 'IT',
      BidangPengguna: 'IT',
      Bidang: 'IT',
      BASTNo: '002/BSTA/IT/X/2026',
      NamaBarang: 'Laptop ThinkPad',
      UniqueName: 'LPTP',
      JenisBarang: 'Elektronik & Komputer',
      DetailSpesifikasi: 'Lenovo ThinkPad T14 Gen 4 Core i7 16GB 512GB SSD Windows 11 Pro',
      NomorSerial: 'PF-491KMA',
      LokasiDistribusi: 'Ruang Server & Pengembang Lantai 3',
      NomorUPA: 'UPA-2026-1015',
      TanggalPenerimaan: '2026-10-10',
      AssetNumber: '003.LPTP.1026.IT',
      Status: 'Aktif',
      CreatedAt: '2026-10-10T11:00:00.000Z',
      CreatedBy: 'Staff IT',
      UpdatedAt: '2026-10-10T11:00:00.000Z',
      UpdatedBy: 'Staff IT',
    },
    {
      BASTRecordID: 'BST-2026-004',
      AssetID: 'AST-2026-004',
      Tanggal: '2026-10-12',
      Bulan: 10,
      Tahun: 2026,
      BidangPengadaan: 'GA',
      BidangPengguna: 'GA',
      Bidang: 'GA',
      BASTNo: '003/BSTA/GA/X/2026',
      NamaBarang: 'Air Conditioner Split 2 PK',
      UniqueName: 'ACS',
      JenisBarang: 'Fasilitas & Utilitas',
      DetailSpesifikasi: 'Daikin Inverter FTKQ50UVM4 2 PK Eco Mode',
      NomorSerial: 'DKN-AC-77812',
      LokasiDistribusi: 'Ruang Rapat Utama Lantai 2',
      NomorUPA: 'UPA-2026-1020',
      TanggalPenerimaan: '2026-10-12',
      AssetNumber: '004.ACS.1026.GA',
      Status: 'Aktif',
      CreatedAt: '2026-10-12T14:30:00.000Z',
      CreatedBy: 'Admin GA',
      UpdatedAt: '2026-10-12T14:30:00.000Z',
      UpdatedBy: 'Admin GA',
    },
    {
      BASTRecordID: 'BST-2026-005',
      AssetID: 'AST-2026-005',
      Tanggal: '2026-10-14',
      Bulan: 10,
      Tahun: 2026,
      BidangPengadaan: 'GDG',
      BidangPengguna: 'GDG',
      Bidang: 'GDG',
      BASTNo: '004/BSTA/GDG/X/2026',
      NamaBarang: 'Pallet Jack Manual 3 Ton',
      UniqueName: 'PLT',
      JenisBarang: 'Mesin & Alat Berat Gudang',
      DetailSpesifikasi: 'OPK Hand Pallet 3000 kg Roda Polyurethane Double Roller',
      NomorSerial: 'OPK-HP-309',
      LokasiDistribusi: 'Loading Dock Gudang Barat',
      NomorUPA: 'UPA-2026-1033',
      TanggalPenerimaan: '2026-10-14',
      AssetNumber: '005.PLT.1026.GDG',
      Status: 'Ditarik', // Already withdrawn example to test withdrawal list
      CreatedAt: '2026-10-14T08:00:00.000Z',
      CreatedBy: 'Supervisor Gudang',
      UpdatedAt: '2026-10-18T10:00:00.000Z',
      UpdatedBy: 'Admin Aset',
    },
    {
      BASTRecordID: 'BST-2026-006',
      AssetID: 'AST-2026-006',
      Tanggal: '2026-10-16',
      Bulan: 10,
      Tahun: 2026,
      BidangPengadaan: 'KEU',
      BidangPengguna: 'KEU',
      Bidang: 'KEU',
      BASTNo: '005/BSTA/KEU/X/2026',
      NamaBarang: 'Printer LaserJet',
      UniqueName: 'PRN',
      JenisBarang: 'Elektronik & Perlengkapan Kantor',
      DetailSpesifikasi: 'HP LaserJet Pro MFP 4103fdw Duplex Wireless',
      NomorSerial: 'VNB3N88129',
      LokasiDistribusi: 'Ruang Finance & Accounting',
      NomorUPA: 'UPA-2026-1040',
      TanggalPenerimaan: '2026-10-16',
      AssetNumber: '006.PRN.1026.KEU',
      Status: 'Aktif',
      CreatedAt: '2026-10-16T10:15:00.000Z',
      CreatedBy: 'Staff Keuangan',
      UpdatedAt: '2026-10-16T10:15:00.000Z',
      UpdatedBy: 'Staff Keuangan',
    },
  ];

  const BRIDGE_RECORD: BridgeRecord[] = [
    { BridgeID: 'BRG-001', NomorUrut: 1, Tahun: 2026, BidangPengadaan: 'PPIC', BidangPengguna: 'PPIC', Bidang: 'PPIC', BASTNo: '001/BSTA/PPIC/X/2026', AssetNumber: '001.TBG.1026.PPIC', CreatedAt: now },
    { BridgeID: 'BRG-002', NomorUrut: 1, Tahun: 2026, BidangPengadaan: 'PPIC', BidangPengguna: 'PPIC', Bidang: 'PPIC', BASTNo: '001/BSTA/PPIC/X/2026', AssetNumber: '002.BCS.1026.PPIC', CreatedAt: now },
    { BridgeID: 'BRG-003', NomorUrut: 2, Tahun: 2026, BidangPengadaan: 'IT', BidangPengguna: 'IT', Bidang: 'IT', BASTNo: '002/BSTA/IT/X/2026', AssetNumber: '003.LPTP.1026.IT', CreatedAt: now },
    { BridgeID: 'BRG-004', NomorUrut: 3, Tahun: 2026, BidangPengadaan: 'GA', BidangPengguna: 'GA', Bidang: 'GA', BASTNo: '003/BSTA/GA/X/2026', AssetNumber: '004.ACS.1026.GA', CreatedAt: now },
    { BridgeID: 'BRG-005', NomorUrut: 4, Tahun: 2026, BidangPengadaan: 'GDG', BidangPengguna: 'GDG', Bidang: 'GDG', BASTNo: '004/BSTA/GDG/X/2026', AssetNumber: '005.PLT.1026.GDG', CreatedAt: now },
    { BridgeID: 'BRG-006', NomorUrut: 5, Tahun: 2026, BidangPengadaan: 'KEU', BidangPengguna: 'KEU', Bidang: 'KEU', BASTNo: '005/BSTA/KEU/X/2026', AssetNumber: '006.PRN.1026.KEU', CreatedAt: now },
  ];

  const DATA_INVENTARIS: DataInventaris[] = [
    {
      AssetID: 'AST-2026-001',
      AssetNumber: '001.TBG.1026.PPIC',
      BASTRecordID: 'BST-2026-001',
      MasterBarangID: 'MB-001',
      NamaBarang: 'Timbangan Digital',
      JenisBarang: 'Alat Ukur / Timbang',
      DetailSpesifikasi: 'CAS Caston III 500kg Akurasi 0.1kg dengan sertifikat kalibrasi',
      NomorSerial: 'SN-CAS-98124',
      Jumlah: 1,
      BidangPengadaan: 'PPIC',
      BidangPengguna: 'PPIC',
      Pemilik: 'PPIC',
      TanggalPerolehan: '2026-10-05',
      Kondisi: 'Baik',
      Lokasi: 'Gudang Bahan Baku R-02',
      StatusAset: 'Aktif',
      CreatedAt: '2026-10-05T09:15:00.000Z',
      UpdatedAt: '2026-10-05T09:15:00.000Z',
    },
    {
      AssetID: 'AST-2026-002',
      AssetNumber: '002.BCS.1026.PPIC',
      BASTRecordID: 'BST-2026-002',
      MasterBarangID: 'MB-008',
      NamaBarang: 'Barcode Scanner Wireless',
      JenisBarang: 'Alat Inventaris Gudang',
      DetailSpesifikasi: 'Honeywell Voyager 1472g Bluetooth 2D Scanner',
      NomorSerial: 'SN-HNW-44120',
      Jumlah: 1,
      BidangPengadaan: 'PPIC',
      BidangPengguna: 'PPIC',
      Pemilik: 'PPIC',
      TanggalPerolehan: '2026-10-05',
      Kondisi: 'Baik',
      Lokasi: 'Gudang Bahan Baku R-02',
      StatusAset: 'Aktif',
      CreatedAt: '2026-10-05T09:20:00.000Z',
      UpdatedAt: '2026-10-05T09:20:00.000Z',
    },
    {
      AssetID: 'AST-2026-003',
      AssetNumber: '003.LPTP.1026.IT',
      BASTRecordID: 'BST-2026-003',
      MasterBarangID: 'MB-002',
      NamaBarang: 'Laptop ThinkPad',
      JenisBarang: 'Elektronik & Komputer',
      DetailSpesifikasi: 'Lenovo ThinkPad T14 Gen 4 Core i7 16GB 512GB SSD Windows 11 Pro',
      NomorSerial: 'PF-491KMA',
      Jumlah: 1,
      BidangPengadaan: 'IT',
      BidangPengguna: 'IT',
      Pemilik: 'IT',
      TanggalPerolehan: '2026-10-10',
      Kondisi: 'Baik',
      Lokasi: 'Ruang Server & Pengembang Lantai 3',
      StatusAset: 'Aktif',
      CreatedAt: '2026-10-10T11:00:00.000Z',
      UpdatedAt: '2026-10-10T11:00:00.000Z',
    },
    {
      AssetID: 'AST-2026-004',
      AssetNumber: '004.ACS.1026.GA',
      BASTRecordID: 'BST-2026-004',
      MasterBarangID: 'MB-007',
      NamaBarang: 'Air Conditioner Split 2 PK',
      JenisBarang: 'Fasilitas & Utilitas',
      DetailSpesifikasi: 'Daikin Inverter FTKQ50UVM4 2 PK Eco Mode',
      NomorSerial: 'DKN-AC-77812',
      Jumlah: 1,
      BidangPengadaan: 'GA',
      BidangPengguna: 'GA',
      Pemilik: 'GA',
      TanggalPerolehan: '2026-10-12',
      Kondisi: 'Baik',
      Lokasi: 'Ruang Rapat Utama Lantai 2',
      StatusAset: 'Aktif',
      CreatedAt: '2026-10-12T14:30:00.000Z',
      UpdatedAt: '2026-10-12T14:30:00.000Z',
    },
    {
      AssetID: 'AST-2026-005',
      AssetNumber: '005.PLT.1026.GDG',
      BASTRecordID: 'BST-2026-005',
      MasterBarangID: 'MB-009',
      NamaBarang: 'Pallet Jack Manual 3 Ton',
      JenisBarang: 'Mesin & Alat Berat Gudang',
      DetailSpesifikasi: 'OPK Hand Pallet 3000 kg Roda Polyurethane Double Roller',
      NomorSerial: 'OPK-HP-309',
      Jumlah: 1,
      BidangPengadaan: 'GDG',
      BidangPengguna: 'GDG',
      Pemilik: 'GDG',
      TanggalPerolehan: '2026-10-14',
      Kondisi: 'Rusak Berat',
      Lokasi: 'Loading Dock Gudang Barat',
      StatusAset: 'Ditarik',
      CreatedAt: '2026-10-14T08:00:00.000Z',
      UpdatedAt: '2026-10-18T10:00:00.000Z',
    },
    {
      AssetID: 'AST-2026-006',
      AssetNumber: '006.PRN.1026.KEU',
      BASTRecordID: 'BST-2026-006',
      MasterBarangID: 'MB-004',
      NamaBarang: 'Printer LaserJet',
      JenisBarang: 'Elektronik & Perlengkapan Kantor',
      DetailSpesifikasi: 'HP LaserJet Pro MFP 4103fdw Duplex Wireless',
      NomorSerial: 'VNB3N88129',
      Jumlah: 1,
      BidangPengadaan: 'KEU',
      BidangPengguna: 'KEU',
      Pemilik: 'KEU',
      TanggalPerolehan: '2026-10-16',
      Kondisi: 'Baik',
      Lokasi: 'Ruang Finance & Accounting',
      StatusAset: 'Aktif',
      CreatedAt: '2026-10-16T10:15:00.000Z',
      UpdatedAt: '2026-10-16T10:15:00.000Z',
    },
  ];

  const DATA_PENARIKAN: DataPenarikan[] = [
    {
      WithdrawalID: 'WTD-2026-001',
      AssetID: 'AST-2026-005',
      AssetNumber: '005.PLT.1026.GDG',
      NamaBarang: 'Pallet Jack Manual 3 Ton',
      JenisBarang: 'Mesin & Alat Berat Gudang',
      DetailSpesifikasi: 'OPK Hand Pallet 3000 kg Roda Polyurethane Double Roller',
      NomorSerial: 'OPK-HP-309',
      BidangPengadaan: 'GDG',
      BidangPengguna: 'GDG',
      Pemilik: 'GDG',
      TanggalPerolehan: '2026-10-14',
      Kondisi: 'Rusak Berat',
      LokasiTerakhir: 'Loading Dock Gudang Barat',
      TanggalPenarikan: '2026-10-18',
      AlasanPenarikan: 'Rusak Total / Tidak Ekonomis Diperbaiki',
      Catatan: 'Hydraulic ram bocor parah dan chassis bengkok, diganti unit forklift baru.',
      DitarikOleh: 'Admin Aset',
      CreatedAt: '2026-10-18T10:00:00.000Z',
    },
  ];

  const FOTO_INVENTARIS: FotoInventaris[] = [
    {
      PhotoID: 'PHT-001',
      AssetID: 'AST-2026-001',
      AssetNumber: '001.TBG.1026.PPIC',
      PhotoURL: 'https://images.unsplash.com/photo-1584727638096-042c45049ebe?auto=format&fit=crop&w=600&q=80',
      NamaFile: 'timbangan-cas-depan.jpg',
      TanggalUpload: '2026-10-05T09:15:00.000Z',
      UploadedBy: 'Admin Aset',
      StatusFoto: 'Aktif',
      Keterangan: 'Foto tampak depan fisik timbangan di Gudang Bahan Baku R-02',
    },
    {
      PhotoID: 'PHT-002',
      AssetID: 'AST-2026-001',
      AssetNumber: '001.TBG.1026.PPIC',
      PhotoURL: 'https://images.unsplash.com/photo-1629853315664-500b5bb02cb6?auto=format&fit=crop&w=600&q=80',
      NamaFile: 'timbangan-cas-serial.jpg',
      TanggalUpload: '2026-10-05T09:16:00.000Z',
      UploadedBy: 'Admin Aset',
      StatusFoto: 'Aktif',
      Keterangan: 'Foto plat serial number dan stiker kalibrasi',
    },
    {
      PhotoID: 'PHT-003',
      AssetID: 'AST-2026-003',
      AssetNumber: '003.LPTP.1026.IT',
      PhotoURL: 'https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?auto=format&fit=crop&w=600&q=80',
      NamaFile: 'thinkpad-t14-it.jpg',
      TanggalUpload: '2026-10-10T11:00:00.000Z',
      UploadedBy: 'Staff IT',
      StatusFoto: 'Aktif',
      Keterangan: 'Fisik unit dan kelengkapan charger asli',
    },
    {
      PhotoID: 'PHT-004',
      AssetID: 'AST-2026-005',
      AssetNumber: '005.PLT.1026.GDG',
      PhotoURL: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=600&q=80',
      NamaFile: 'pallet-jack-rusak.jpg',
      TanggalUpload: '2026-10-18T10:05:00.000Z',
      UploadedBy: 'Admin Aset',
      StatusFoto: 'Aktif',
      Keterangan: 'Kondisi fisik saat penarikan aset dari gudang',
    },
  ];

  const LOG_AKTIVITAS: LogAktivitas[] = [
    {
      LogID: 'LOG-001',
      Waktu: '2026-10-05T09:15:00.000Z',
      User: 'Admin Aset',
      Aktivitas: 'Input BAST Baru',
      JenisData: 'DATA_BAST',
      RecordID: 'BST-2026-001',
      RingkasanPerubahan: 'Pencatatan BAST 001/BSTA/PPIC/X/2026 dan Aset 001.TBG.1026.PPIC (Timbangan Digital)',
      Status: 'Sukses',
    },
    {
      LogID: 'LOG-002',
      Waktu: '2026-10-05T09:20:00.000Z',
      User: 'Admin Aset',
      Aktivitas: 'Input BAST (Nomor Sama)',
      JenisData: 'DATA_BAST',
      RecordID: 'BST-2026-002',
      RingkasanPerubahan: 'Menambahkan item Barcode Scanner ke BAST 001/BSTA/PPIC/X/2026',
      Status: 'Sukses',
    },
    {
      LogID: 'LOG-003',
      Waktu: '2026-10-18T10:00:00.000Z',
      User: 'Admin Aset',
      Aktivitas: 'Penarikan Aset',
      JenisData: 'DATA_PENARIKAN',
      RecordID: 'WTD-2026-001',
      RingkasanPerubahan: 'Penarikan aset 005.PLT.1026.GDG alasan Rusak Total / Tidak Ekonomis Diperbaiki',
      Status: 'Sukses',
    },
  ];

  const CONFIG: AppConfig = {
    googleSheetWebAppUrl: '',
    googleDriveFolderId: '',
    spreadsheetId: '',
    currentUser: 'Admin Pengelola Aset',
    currentUserRole: 'Super Admin',
    isConnectedToGoogle: false,
  };

  return {
    DATA_BAST,
    BRIDGE_RECORD,
    PARAMETER,
    MASTER_BARANG,
    DATA_INVENTARIS,
    DATA_PENARIKAN,
    FOTO_INVENTARIS,
    LOG_AKTIVITAS,
    CONFIG,
  };
}

class CentralDatabase {
  private db: DatabaseSchema;
  private isWriting = false;
  private reservedAssetNumbers: Map<string, number> = new Map();

  constructor() {
    this.db = this.loadDatabase();
  }

  private loadDatabase(): DatabaseSchema {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        const loaded: DatabaseSchema = JSON.parse(raw);
        // Ensure PDF template parameters exist
        const pdfParams: ParameterItem[] = [
          { ParamID: 'PRM-PDF-01', Kategori: 'Penomoran', Key: 'BAST_TEMPLATE_FORM_NO', Value: 'FOR-AFT-10', Label: 'No. Formulir BAST PDF', Status: 'Aktif', Keterangan: 'Nomor formulir resmi pojok kanan atas BAST PDF', UpdatedAt: new Date().toISOString() },
          { ParamID: 'PRM-PDF-02', Kategori: 'Penomoran', Key: 'BAST_TEMPLATE_REVISI', Value: '04', Label: 'Revisi Formulir BAST PDF', Status: 'Aktif', Keterangan: 'Nomor revisi resmi dokumen BAST', UpdatedAt: new Date().toISOString() },
          { ParamID: 'PRM-PDF-03', Kategori: 'Penomoran', Key: 'BAST_TEMPLATE_BERLAKU', Value: '12.07.2024', Label: 'Tanggal Berlaku Formulir BAST', Status: 'Aktif', Keterangan: 'Tanggal mulai berlaku formulir BAST', UpdatedAt: new Date().toISOString() },
        ];
        for (const p of pdfParams) {
          if (!loaded.PARAMETER.some((item) => item.Key === p.Key)) {
            loaded.PARAMETER.push(p);
          }
        }

        // Migrate historical records to guarantee BidangPengadaan & BidangPengguna
        for (const b of loaded.DATA_BAST) {
          if (!b.BidangPengadaan) b.BidangPengadaan = b.Bidang || 'PPIC';
          if (!b.BidangPengguna) b.BidangPengguna = b.Bidang || 'PPIC';
        }
        for (const br of loaded.BRIDGE_RECORD) {
          if (!br.BidangPengadaan) br.BidangPengadaan = br.Bidang || 'PPIC';
          if (!br.BidangPengguna) br.BidangPengguna = br.Bidang || 'PPIC';
        }
        for (const inv of loaded.DATA_INVENTARIS) {
          if (!inv.BidangPengadaan) {
            const matchingBast = loaded.DATA_BAST.find((b) => b.AssetID === inv.AssetID || b.AssetNumber === inv.AssetNumber);
            inv.BidangPengadaan = matchingBast?.BidangPengadaan || matchingBast?.Bidang || inv.Pemilik || 'PPIC';
          }
          if (!inv.BidangPengguna) {
            inv.BidangPengguna = inv.Pemilik || 'PPIC';
          }
        }
        for (const pen of loaded.DATA_PENARIKAN) {
          if (!pen.BidangPengadaan) pen.BidangPengadaan = pen.Pemilik || 'PPIC';
          if (!pen.BidangPengguna) pen.BidangPengguna = pen.Pemilik || 'PPIC';
        }

        return loaded;
      }
    } catch (e) {
      console.error('Failed to load database from disk, using seed:', e);
    }
    const seed = getInitialDatabase();
    this.persist(seed);
    return seed;
  }

  private persist(data: DatabaseSchema) {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
    } catch (e) {
      console.error('Failed to persist database:', e);
    }
  }

  public getSnapshot(): DatabaseSchema {
    return this.db;
  }

  public save() {
    this.persist(this.db);
  }

  // Log Activity Helper
  public log(aktivitas: string, jenisData: string, recordId: string, ringkasan: string, status: 'Sukses' | 'Gagal' | 'Peringatan' = 'Sukses', user = 'Admin Aset') {
    const logItem: LogAktivitas = {
      LogID: `LOG-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      Waktu: new Date().toISOString(),
      User: this.db.CONFIG.currentUser || user,
      Aktivitas: aktivitas,
      JenisData: jenisData,
      RecordID: recordId,
      RingkasanPerubahan: ringkasan,
      Status: status,
    };
    this.db.LOG_AKTIVITAS.unshift(logItem);
    // Keep max 1000 logs
    if (this.db.LOG_AKTIVITAS.length > 1000) {
      this.db.LOG_AKTIVITAS.pop();
    }
    this.save();
  }

  // --- BAST & ASSET NUMBERING LOGIC WITH ATOMIC LOCK ---
  public generateNextBastNumber(bidangKode: string, transactionDate: string): { bastNo: string; seqNumber: number; docCode: string; romanMonth: string; year: number } {
    const d = new Date(transactionDate);
    const year = isNaN(d.getFullYear()) ? new Date().getFullYear() : d.getFullYear();
    const month = isNaN(d.getMonth()) ? new Date().getMonth() + 1 : d.getMonth() + 1;
    const romanMonth = getRomanMonth(month);

    const docParam = this.db.PARAMETER.find((p) => p.Kategori === 'Penomoran' && p.Key === 'DOC_CODE_BAST' && p.Status === 'Aktif');
    const docCode = docParam?.Value || 'BSTA';

    // Find highest seq number across BRIDGE_RECORD / DATA_BAST for this specific Month, Year, Bidang, & DocCode
    let maxSeq = 0;
    const cleanDocCode = docCode.trim().toUpperCase();
    const cleanBidang = bidangKode.trim().toUpperCase();

    // Helper to evaluate a BAST number string for matching period & BidangPengadaan
    const evaluateBastString = (bastNoStr: string) => {
      if (!bastNoStr) return;
      // Expected BAST format: [SEQ]/[DOC_CODE]/[BIDANG]/[ROMAN_MONTH]/[YEAR]
      const parts = bastNoStr.trim().split('/');
      if (parts.length >= 5) {
        const seqPart = parseInt(parts[0], 10);
        const docPart = parts[1].toUpperCase();
        const bdgPart = parts[2].toUpperCase();
        const monthPart = parts[3].toUpperCase();
        const yearPart = parseInt(parts[4], 10);

        if (
          !isNaN(seqPart) &&
          docPart === cleanDocCode &&
          bdgPart === cleanBidang &&
          monthPart === romanMonth.toUpperCase() &&
          yearPart === year
        ) {
          if (seqPart > maxSeq) {
            maxSeq = seqPart;
          }
        }
      }
    };

    // Check all BRIDGE_RECORD entries
    for (const b of this.db.BRIDGE_RECORD) {
      if (b.BASTNo) {
        evaluateBastString(b.BASTNo);
      }
      if (
        (b as any).Bulan === month &&
        b.Tahun === year &&
        ((b.BidangPengadaan && b.BidangPengadaan.toUpperCase() === cleanBidang) ||
         (b.Bidang && b.Bidang.toUpperCase() === cleanBidang))
      ) {
        if (b.NomorUrut && b.NomorUrut > maxSeq) {
          maxSeq = b.NomorUrut;
        }
      }
    }

    // Also verify from DATA_BAST in case of manual bridge missing
    for (const item of this.db.DATA_BAST) {
      if (item.BASTNo) {
        evaluateBastString(item.BASTNo);
      }
      if (
        item.Bulan === month &&
        item.Tahun === year &&
        ((item.BidangPengadaan && item.BidangPengadaan.toUpperCase() === cleanBidang) ||
         (item.Bidang && item.Bidang.toUpperCase() === cleanBidang))
      ) {
        if (item.BASTNo) {
          const firstPart = parseInt(item.BASTNo.split('/')[0], 10);
          if (!isNaN(firstPart) && firstPart > maxSeq) {
            maxSeq = firstPart;
          }
        }
      }
    }

    const nextSeq = maxSeq + 1;
    const seqPadded = String(nextSeq).padStart(3, '0');
    const bastNo = `${seqPadded}/${docCode}/${bidangKode}/${romanMonth}/${year}`;

    return { bastNo, seqNumber: nextSeq, docCode, romanMonth, year };
  }

  // --- ASSET NUMBERING LOGIC (SEPARATE SEQUENCE PER UNIQUE_NAME) ---
  public generateNextAssetNumber(
    uniqueName: string,
    bidangKode: string,
    transactionDate: string,
    reserve = false
  ): { assetNumber: string; seqNumber: number } {
    if (!uniqueName || typeof uniqueName !== 'string' || !uniqueName.trim()) {
      throw new Error('Kode Unik Barang (UNIQUE_NAME) wajib diisi dan tidak boleh kosong.');
    }

    const cleanUniqueName = uniqueName.trim().toUpperCase();
    const cleanBidang = (bidangKode || '').trim().toUpperCase();

    const d = new Date(transactionDate);
    const month = isNaN(d.getMonth()) ? new Date().getMonth() + 1 : d.getMonth() + 1;
    const year = isNaN(d.getFullYear()) ? new Date().getFullYear() : d.getFullYear();
    const mm = String(month).padStart(2, '0');
    const yy = String(year).slice(-2);
    const mmyy = `${mm}${yy}`; // e.g. 1026

    // Clean up expired in-flight reservations (> 60s)
    const now = Date.now();
    for (const [resNum, timestamp] of this.reservedAssetNumbers.entries()) {
      if (now - timestamp > 60000) {
        this.reservedAssetNumbers.delete(resNum);
      }
    }

    // Setiap UNIQUE_NAME memiliki urutan nomor sendiri.
    // Parsing nomor harus menggunakan komponen pertama sebelum titik sebagai SEQ,
    // serta komponen kedua sebagai UNIQUE_NAME.
    let maxSeq = 0;

    const parseAndCompare = (assetNumberStr: string | undefined | null) => {
      if (!assetNumberStr || typeof assetNumberStr !== 'string') return;
      const parts = assetNumberStr.trim().split('.');
      if (parts.length >= 2) {
        const seq = parseInt(parts[0], 10);
        const code = parts[1].trim().toUpperCase();
        if (!isNaN(seq) && seq > 0 && code === cleanUniqueName) {
          if (seq > maxSeq) {
            maxSeq = seq;
          }
        }
      }
    };

    // 1. DATA_INVENTARIS (seluruh aset aktif maupun yang pernah ada)
    for (const inv of this.db.DATA_INVENTARIS) {
      parseAndCompare(inv.AssetNumber);
    }

    // 2. DATA_BAST (seluruh record BAST historis & aktif)
    for (const bast of this.db.DATA_BAST) {
      parseAndCompare(bast.AssetNumber);
    }

    // 3. DATA_PENARIKAN (seluruh record aset ditarik)
    for (const pen of this.db.DATA_PENARIKAN) {
      parseAndCompare(pen.AssetNumber);
    }

    // 4. BRIDGE_RECORD (seluruh bridge relasi)
    for (const br of this.db.BRIDGE_RECORD) {
      parseAndCompare(br.AssetNumber);
    }

    // 5. In-flight reserved numbers (pencegahan duplikasi saat transaksi bersamaan)
    for (const reservedNum of this.reservedAssetNumbers.keys()) {
      parseAndCompare(reservedNum);
    }

    const nextSeq = maxSeq + 1;
    const seqPadded = String(nextSeq).padStart(3, '0');
    const assetNumber = `${seqPadded}.${cleanUniqueName}.${mmyy}.${cleanBidang}`;

    if (reserve) {
      this.reservedAssetNumbers.set(assetNumber, now);
    }

    return { assetNumber, seqNumber: nextSeq };
  }

  public commitAssetReservation(assetNumber: string) {
    if (assetNumber) {
      this.reservedAssetNumbers.delete(assetNumber);
    }
  }

  public releaseAssetReservation(assetNumber: string) {
    if (assetNumber) {
      this.reservedAssetNumbers.delete(assetNumber);
    }
  }

  // --- UNIQUE NAME GENERATION & COLLISION CHECK ---
  public generateUniqueName(namaBarang: string): { code: string; isColliding: boolean; collidingNames: string[] } {
    const clean = namaBarang.trim();
    if (!clean) return { code: 'AST', isColliding: false, collidingNames: [] };

    // Check exact match in MASTER_BARANG
    const existing = this.db.MASTER_BARANG.find((m) => m.NamaBarang.toLowerCase() === clean.toLowerCase());
    if (existing) {
      return { code: existing.UniqueName, isColliding: false, collidingNames: [] };
    }

    // Generate code: taking initials of words, or consonants
    const words = clean.split(/\s+/).filter(Boolean);
    let candidate = '';
    if (words.length >= 3) {
      candidate = (words[0][0] + words[1][0] + words[2][0]).toUpperCase();
    } else if (words.length === 2) {
      const first = words[0][0];
      const second = words[1].slice(0, 2);
      candidate = (first + second).toUpperCase();
    } else {
      // Single word: take first letter + next consonants
      const word = words[0].toUpperCase();
      const consonants = word.slice(1).replace(/[AEIOU\s\W\d]/g, '');
      if (consonants.length >= 2) {
        candidate = (word[0] + consonants.slice(0, 2)).toUpperCase();
      } else {
        candidate = word.slice(0, 3).toUpperCase();
      }
    }

    // Check collision with other master items
    const colliding = this.db.MASTER_BARANG.filter((m) => m.UniqueName.toUpperCase() === candidate.toUpperCase());
    return {
      code: candidate,
      isColliding: colliding.length > 0,
      collidingNames: colliding.map((c) => c.NamaBarang),
    };
  }
}

export const dbInstance = new CentralDatabase();
