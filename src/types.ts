export interface BastRecord {
  BASTRecordID: string;
  AssetID: string;
  Tanggal: string;
  Bulan: number;
  Tahun: number;
  BidangPengadaan: string;
  BidangPengguna: string;
  Bidang?: string;
  BASTNo: string;
  NamaBarang: string;
  UniqueName: string;
  JenisBarang: string;
  DetailSpesifikasi: string;
  NomorSerial: string;
  LokasiDistribusi: string;
  NomorUPA: string;
  TanggalPenerimaan: string;
  AssetNumber: string;
  Status: 'Aktif' | 'Ditarik';
  CreatedAt: string;
  CreatedBy: string;
  UpdatedAt: string;
  UpdatedBy: string;
  photos?: FotoInventaris[];
}

export interface BridgeRecord {
  BridgeID: string;
  NomorUrut: number;
  Bulan?: number;
  Tahun: number;
  BidangPengadaan: string;
  BidangPengguna: string;
  Bidang?: string;
  BASTNo: string;
  AssetNumber: string;
  CreatedAt: string;
}

export interface ParameterItem {
  ParamID: string;
  Kategori: 'Bidang' | 'Penomoran' | 'Kondisi' | 'AlasanPenarikan' | 'Umum';
  Key: string;
  Value: string;
  Label: string;
  Kode?: string;
  Status: 'Aktif' | 'Nonaktif';
  Keterangan?: string;
  UpdatedAt: string;
}

export interface MasterBarang {
  MasterBarangID: string;
  NamaBarang: string;
  UniqueName: string;
  JenisBarang: string;
  Status: 'Aktif' | 'Nonaktif';
  CreatedAt: string;
  UpdatedAt: string;
}

export interface DataInventaris {
  AssetID: string;
  AssetNumber: string;
  BASTRecordID: string;
  MasterBarangID: string;
  NamaBarang: string;
  JenisBarang: string;
  DetailSpesifikasi: string;
  NomorSerial: string;
  Jumlah: number;
  BidangPengadaan: string;
  BidangPengguna: string;
  Pemilik?: string;
  TanggalPerolehan: string;
  Kondisi: string;
  Lokasi: string;
  StatusAset: 'Aktif' | 'Ditarik';
  CreatedAt: string;
  UpdatedAt: string;
  photos?: FotoInventaris[];
}

export interface DataPenarikan {
  WithdrawalID: string;
  AssetID: string;
  AssetNumber: string;
  NamaBarang: string;
  JenisBarang: string;
  DetailSpesifikasi: string;
  NomorSerial: string;
  BidangPengadaan?: string;
  BidangPengguna?: string;
  Pemilik?: string;
  TanggalPerolehan: string;
  Kondisi: string;
  LokasiTerakhir: string;
  TanggalPenarikan: string;
  AlasanPenarikan: string;
  Catatan: string;
  DitarikOleh: string;
  CreatedAt: string;
  photos?: FotoInventaris[];
  StatusPenarikan?: 'Ditarik' | 'Direstore';
  RestoredAt?: string;
  RestoredBy?: string;
  RestoreReason?: string;
}

export interface AuthUser {
  username: string;
  role: 'Super Admin' | 'User';
  name: string;
}

export interface FotoInventaris {
  PhotoID: string;
  AssetID: string;
  AssetNumber: string;
  PhotoURL: string;
  DriveFileID?: string;
  NamaFile: string;
  TanggalUpload: string;
  UploadedBy: string;
  StatusFoto: 'Aktif' | 'Diganti' | 'Nonaktif';
  Keterangan?: string;
}

export interface LogAktivitas {
  LogID: string;
  Waktu: string;
  User: string;
  Aktivitas: string;
  JenisData: string;
  RecordID: string;
  RingkasanPerubahan: string;
  Status: 'Sukses' | 'Gagal' | 'Peringatan';
}

export interface AppConfig {
  googleSheetWebAppUrl: string;
  googleDriveFolderId: string;
  spreadsheetId: string;
  currentUser: string;
  currentUserRole: string;
  lastSyncTime?: string;
  isConnectedToGoogle: boolean;
}

export type MenuId =
  | 'input-bast'
  | 'daftar-bast'
  | 'monitoring-inventaris'
  | 'penarikan-aset'
  | 'daftar-penarikan'
  | 'pengaturan-parameter';
