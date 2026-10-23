import fs from 'fs';
import path from 'path';
import { dbInstance, DatabaseSchema } from './storage';
import { realtimeHub } from './realtime';

const UPLOAD_DIR = path.resolve(process.cwd(), 'public', 'uploads');
const DATA_DIR = path.resolve(process.cwd(), 'data');
const BACKUPS_DIR = path.join(DATA_DIR, 'backups');

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}
if (!fs.existsSync(BACKUPS_DIR)) {
  fs.mkdirSync(BACKUPS_DIR, { recursive: true });
}

export interface BackupMeta {
  fileName: string;
  filePath: string;
  timestamp: string;
  sizeBytes: number;
  totalRecords: number;
}

export interface SyncDiffPreview {
  sheetName: string;
  localCount: number;
  remoteCount: number;
  toPushCount: number;
  toPullCount: number;
  conflictCount: number;
}

// ----------------- BACKUP & RESTORE HELPERS -----------------
export function createDatabaseBackup(reason = 'Manual / Pre-Sync'): BackupMeta {
  const db = dbInstance.getSnapshot();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const fileName = `db-backup-${timestamp}.json`;
  const filePath = path.join(BACKUPS_DIR, fileName);

  const totalRecords =
    db.DATA_BAST.length +
    db.DATA_INVENTARIS.length +
    db.DATA_PENARIKAN.length +
    db.FOTO_INVENTARIS.length +
    db.MASTER_BARANG.length +
    db.PARAMETER.length;

  const backupData = {
    _meta: {
      timestamp: new Date().toISOString(),
      reason,
      totalRecords,
    },
    data: db,
  };

  const raw = JSON.stringify(backupData, null, 2);
  fs.writeFileSync(filePath, raw, 'utf-8');

  dbInstance.log(
    'Backup Database',
    'BACKUP',
    fileName,
    `Membuat backup database terpusat (${totalRecords} record) - Alasan: ${reason}`
  );

  return {
    fileName,
    filePath,
    timestamp: new Date().toISOString(),
    sizeBytes: Buffer.byteLength(raw),
    totalRecords,
  };
}

export function listDatabaseBackups(): BackupMeta[] {
  if (!fs.existsSync(BACKUPS_DIR)) return [];
  const files = fs.readdirSync(BACKUPS_DIR).filter((f) => f.endsWith('.json'));

  const list: BackupMeta[] = [];
  for (const f of files) {
    try {
      const fullPath = path.join(BACKUPS_DIR, f);
      const stat = fs.statSync(fullPath);
      const raw = fs.readFileSync(fullPath, 'utf-8');
      const parsed = JSON.parse(raw);
      list.push({
        fileName: f,
        filePath: fullPath,
        timestamp: parsed._meta?.timestamp || stat.mtime.toISOString(),
        sizeBytes: stat.size,
        totalRecords: parsed._meta?.totalRecords || 0,
      });
    } catch (e) {
      // ignore corrupt files
    }
  }

  return list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

export function restoreDatabaseBackup(fileName: string): { success: boolean; message: string } {
  const fullPath = path.join(BACKUPS_DIR, fileName);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`File backup ${fileName} tidak ditemukan.`);
  }

  // Backup current state before restoring
  createDatabaseBackup(`Pre-Restore of ${fileName}`);

  const raw = fs.readFileSync(fullPath, 'utf-8');
  const parsed = JSON.parse(raw);
  const targetData: DatabaseSchema = parsed.data || parsed;

  // Restore into active database
  const db = dbInstance.getSnapshot();
  db.DATA_BAST = targetData.DATA_BAST || [];
  db.BRIDGE_RECORD = targetData.BRIDGE_RECORD || [];
  db.PARAMETER = targetData.PARAMETER || [];
  db.MASTER_BARANG = targetData.MASTER_BARANG || [];
  db.DATA_INVENTARIS = targetData.DATA_INVENTARIS || [];
  db.DATA_PENARIKAN = targetData.DATA_PENARIKAN || [];
  db.FOTO_INVENTARIS = targetData.FOTO_INVENTARIS || [];
  db.LOG_AKTIVITAS = targetData.LOG_AKTIVITAS || [];
  if (targetData.CONFIG) {
    db.CONFIG = { ...db.CONFIG, ...targetData.CONFIG };
  }

  dbInstance.save();
  dbInstance.log(
    'Restore Database',
    'BACKUP',
    fileName,
    `Memulihkan database dari file backup ${fileName}`
  );

  realtimeHub.broadcast({
    type: 'sync:completed',
    entity: 'DATABASE',
    action: 'RESTORED',
    timestamp: new Date().toISOString(),
  });

  return { success: true, message: `Database berhasil dipulihkan dari ${fileName}.` };
}

// ----------------- TWO-WAY GOOGLE SPREADSHEET SYNC ENGINE -----------------

export async function uploadPhotoToStorage(
  base64Data: string,
  fileName: string,
  assetId: string,
  googleSheetWebAppUrl = '',
  googleDriveFolderId = ''
): Promise<{ photoUrl: string; driveFileId?: string; storageType: 'drive' | 'local' }> {
  if (googleSheetWebAppUrl && googleSheetWebAppUrl.startsWith('https://script.google.com')) {
    try {
      const response = await fetch(googleSheetWebAppUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'uploadDrivePhoto',
          folderId: googleDriveFolderId,
          assetId,
          fileName,
          base64: base64Data,
        }),
      });
      if (response.ok) {
        const resJson = await response.json();
        if (resJson && resJson.success && resJson.driveFileUrl) {
          return {
            photoUrl: resJson.driveFileUrl,
            driveFileId: resJson.driveFileId,
            storageType: 'drive',
          };
        }
      }
    } catch (err) {
      console.warn('Google Drive Apps Script upload fallback to local storage:', err);
    }
  }

  // Fallback to local centralized file storage
  const cleanBase64 = base64Data.replace(/^data:image\/\w+;base64,/, '');
  const buffer = Buffer.from(cleanBase64, 'base64');
  const safeName = `${Date.now()}-${assetId}-${fileName.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
  const filePath = path.join(UPLOAD_DIR, safeName);

  fs.writeFileSync(filePath, buffer);
  return {
    photoUrl: `/uploads/${safeName}`,
    storageType: 'local',
  };
}

// Format local DB table rows for Google Sheets
export function formatTableForSheet(tableName: string, data: any[]): any[][] {
  const schemas: Record<string, string[]> = {
    DATA_BAST: ['BASTRecordID', 'AssetID', 'Tanggal', 'Bulan', 'Tahun', 'BidangPengadaan', 'BidangPengguna', 'Bidang', 'BASTNo', 'NamaBarang', 'UniqueName', 'JenisBarang', 'DetailSpesifikasi', 'NomorSerial', 'LokasiDistribusi', 'NomorUPA', 'TanggalPenerimaan', 'AssetNumber', 'Status', 'CreatedAt', 'CreatedBy', 'UpdatedAt', 'UpdatedBy'],
    BRIDGE_RECORD: ['BridgeID', 'NomorUrut', 'Tahun', 'BidangPengadaan', 'BidangPengguna', 'Bidang', 'BASTNo', 'AssetNumber', 'CreatedAt'],
    PARAMETER: ['ParamID', 'Kategori', 'Key', 'Value', 'Label', 'Kode', 'Status', 'Keterangan', 'UpdatedAt'],
    MASTER_BARANG: ['MasterBarangID', 'NamaBarang', 'UniqueName', 'JenisBarang', 'Status', 'CreatedAt', 'UpdatedAt'],
    DATA_INVENTARIS: ['AssetID', 'AssetNumber', 'BASTRecordID', 'MasterBarangID', 'NamaBarang', 'JenisBarang', 'DetailSpesifikasi', 'NomorSerial', 'Jumlah', 'BidangPengadaan', 'BidangPengguna', 'Pemilik', 'TanggalPerolehan', 'Kondisi', 'Lokasi', 'StatusAset', 'CreatedAt', 'UpdatedAt'],
    DATA_PENARIKAN: ['WithdrawalID', 'AssetID', 'AssetNumber', 'NamaBarang', 'JenisBarang', 'DetailSpesifikasi', 'NomorSerial', 'BidangPengadaan', 'BidangPengguna', 'Pemilik', 'TanggalPerolehan', 'Kondisi', 'LokasiTerakhir', 'TanggalPenarikan', 'AlasanPenarikan', 'Catatan', 'DitarikOleh', 'CreatedAt'],
    FOTO_INVENTARIS: ['PhotoID', 'AssetID', 'AssetNumber', 'PhotoURL', 'DriveFileID', 'NamaFile', 'TanggalUpload', 'UploadedBy', 'StatusFoto', 'Keterangan'],
    LOG_AKTIVITAS: ['LogID', 'Waktu', 'User', 'Aktivitas', 'JenisData', 'RecordID', 'RingkasanPerubahan', 'Status'],
  };

  const headers = schemas[tableName] || [];
  const rows: any[][] = [headers];

  for (const item of data) {
    const row = headers.map((key) => {
      const val = item[key];
      return val !== undefined && val !== null ? String(val) : '';
    });
    rows.push(row);
  }

  return rows;
}

// Inisialisasi 9 Sheet pada Google Spreadsheet baru
export async function initSheetsOnGoogle(webAppUrl: string): Promise<{ success: boolean; message: string }> {
  if (!webAppUrl || !webAppUrl.startsWith('https://script.google.com')) {
    throw new Error('URL Google Apps Script Web App belum diisi atau format tidak valid.');
  }

  const response = await fetch(webAppUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'initSheets' }),
  });

  if (!response.ok) {
    throw new Error(`Google Apps Script merespons dengan HTTP ${response.status}`);
  }

  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || result.message || 'Gagal menginisialisasi spreadsheet.');
  }

  dbInstance.log(
    'Inisialisasi Spreadsheet',
    'SPREADSHEET',
    'INIT-01',
    'Inisialisasi 9 sheet pada Google Spreadsheet berhasil'
  );

  return result;
}

// Push all local data to Google Spreadsheet
export async function pushAllDataToGoogle(webAppUrl: string): Promise<{ success: boolean; message: string; rowsCount: Record<string, number> }> {
  if (!webAppUrl || !webAppUrl.startsWith('https://script.google.com')) {
    throw new Error('URL Google Apps Script Web App belum diisi atau format tidak valid.');
  }

  // Auto-backup before pushing
  createDatabaseBackup('Pre-Push ke Google Spreadsheet');

  const db = dbInstance.getSnapshot();
  const sheetsPayload = {
    DATA_BAST: formatTableForSheet('DATA_BAST', db.DATA_BAST),
    BRIDGE_RECORD: formatTableForSheet('BRIDGE_RECORD', db.BRIDGE_RECORD),
    PARAMETER: formatTableForSheet('PARAMETER', db.PARAMETER),
    MASTER_BARANG: formatTableForSheet('MASTER_BARANG', db.MASTER_BARANG),
    DATA_INVENTARIS: formatTableForSheet('DATA_INVENTARIS', db.DATA_INVENTARIS),
    DATA_PENARIKAN: formatTableForSheet('DATA_PENARIKAN', db.DATA_PENARIKAN),
    FOTO_INVENTARIS: formatTableForSheet('FOTO_INVENTARIS', db.FOTO_INVENTARIS),
    LOG_AKTIVITAS: formatTableForSheet('LOG_AKTIVITAS', db.LOG_AKTIVITAS.slice(0, 300)),
    CONFIG: [
      ['Key', 'Value', 'UpdatedAt'],
      ['googleSheetWebAppUrl', db.CONFIG.googleSheetWebAppUrl || '', new Date().toISOString()],
      ['googleDriveFolderId', db.CONFIG.googleDriveFolderId || '', new Date().toISOString()],
      ['spreadsheetId', db.CONFIG.spreadsheetId || '', new Date().toISOString()],
      ['currentUser', db.CONFIG.currentUser || '', new Date().toISOString()],
      ['currentUserRole', db.CONFIG.currentUserRole || '', new Date().toISOString()],
      ['lastSyncTime', db.CONFIG.lastSyncTime || '', new Date().toISOString()],
    ],
  };

  const response = await fetch(webAppUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'pushAllData',
      sheets: sheetsPayload,
    }),
  });

  if (!response.ok) {
    throw new Error(`Google Apps Script merespons dengan HTTP ${response.status}`);
  }

  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || result.message || 'Gagal mengirim data ke Google Spreadsheet.');
  }

  db.CONFIG.lastSyncTime = new Date().toISOString();
  db.CONFIG.isConnectedToGoogle = true;
  dbInstance.save();

  dbInstance.log(
    'Sinkronisasi Push',
    'SPREADSHEET',
    'PUSH-01',
    'Berhasil mengekspor seluruh data aplikasi ke Google Spreadsheet'
  );

  realtimeHub.broadcast({
    type: 'sync:completed',
    entity: 'GOOGLE_SPREADSHEET',
    action: 'PUSH_ALL',
    timestamp: new Date().toISOString(),
  });

  return {
    success: true,
    message: 'Seluruh data berhasil disinkronisasi ke Google Spreadsheet.',
    rowsCount: {
      DATA_BAST: db.DATA_BAST.length,
      DATA_INVENTARIS: db.DATA_INVENTARIS.length,
      DATA_PENARIKAN: db.DATA_PENARIKAN.length,
      FOTO_INVENTARIS: db.FOTO_INVENTARIS.length,
      MASTER_BARANG: db.MASTER_BARANG.length,
      PARAMETER: db.PARAMETER.length,
    },
  };
}

// Pull all data from Google Spreadsheet into backend DB
export async function pullAllDataFromGoogle(webAppUrl: string): Promise<{ success: boolean; message: string; rowsCount: Record<string, number> }> {
  if (!webAppUrl || !webAppUrl.startsWith('https://script.google.com')) {
    throw new Error('URL Google Apps Script Web App belum diisi atau format tidak valid.');
  }

  // Auto-backup before pulling to guarantee safety
  createDatabaseBackup('Pre-Pull dari Google Spreadsheet');

  const response = await fetch(webAppUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'getAllData' }),
  });

  if (!response.ok) {
    throw new Error(`Google Apps Script merespons dengan HTTP ${response.status}`);
  }

  const result = await response.json();
  if (!result.success || !result.data) {
    throw new Error(result.error || result.message || 'Gagal mengambil data dari Google Spreadsheet.');
  }

  const remote = result.data;
  const db = dbInstance.getSnapshot();

  // Merge or apply remote sheets if returned valid arrays
  if (Array.isArray(remote.DATA_BAST) && remote.DATA_BAST.length > 0) {
    db.DATA_BAST = remote.DATA_BAST.map((b: any) => ({
      ...b,
      BidangPengadaan: b.BidangPengadaan || b.Bidang || 'PPIC',
      BidangPengguna: b.BidangPengguna || b.Bidang || 'PPIC',
      Bidang: b.BidangPengadaan || b.Bidang || 'PPIC',
    }));
  }
  if (Array.isArray(remote.BRIDGE_RECORD) && remote.BRIDGE_RECORD.length > 0) {
    db.BRIDGE_RECORD = remote.BRIDGE_RECORD.map((br: any) => ({
      ...br,
      BidangPengadaan: br.BidangPengadaan || br.Bidang || 'PPIC',
      BidangPengguna: br.BidangPengguna || br.Bidang || 'PPIC',
      Bidang: br.BidangPengadaan || br.Bidang || 'PPIC',
    }));
  }
  if (Array.isArray(remote.PARAMETER) && remote.PARAMETER.length > 0) db.PARAMETER = remote.PARAMETER;
  if (Array.isArray(remote.MASTER_BARANG) && remote.MASTER_BARANG.length > 0) db.MASTER_BARANG = remote.MASTER_BARANG;
  if (Array.isArray(remote.DATA_INVENTARIS) && remote.DATA_INVENTARIS.length > 0) {
    db.DATA_INVENTARIS = remote.DATA_INVENTARIS.map((inv: any) => ({
      ...inv,
      BidangPengadaan: inv.BidangPengadaan || inv.Pemilik || 'PPIC',
      BidangPengguna: inv.BidangPengguna || inv.Pemilik || 'PPIC',
      Pemilik: inv.BidangPengguna || inv.Pemilik || 'PPIC',
    }));
  }
  if (Array.isArray(remote.DATA_PENARIKAN) && remote.DATA_PENARIKAN.length > 0) {
    db.DATA_PENARIKAN = remote.DATA_PENARIKAN.map((p: any) => ({
      ...p,
      BidangPengadaan: p.BidangPengadaan || p.Pemilik || 'PPIC',
      BidangPengguna: p.BidangPengguna || p.Pemilik || 'PPIC',
      Pemilik: p.BidangPengguna || p.Pemilik || 'PPIC',
    }));
  }
  if (Array.isArray(remote.FOTO_INVENTARIS) && remote.FOTO_INVENTARIS.length > 0) db.FOTO_INVENTARIS = remote.FOTO_INVENTARIS;
  if (Array.isArray(remote.LOG_AKTIVITAS) && remote.LOG_AKTIVITAS.length > 0) db.LOG_AKTIVITAS = remote.LOG_AKTIVITAS;

  db.CONFIG.lastSyncTime = new Date().toISOString();
  db.CONFIG.isConnectedToGoogle = true;
  dbInstance.save();

  dbInstance.log(
    'Sinkronisasi Pull',
    'SPREADSHEET',
    'PULL-01',
    'Berhasil memperbarui data lokal aplikasi dari Google Spreadsheet'
  );

  realtimeHub.broadcast({
    type: 'sync:completed',
    entity: 'GOOGLE_SPREADSHEET',
    action: 'PULL_ALL',
    timestamp: new Date().toISOString(),
  });

  return {
    success: true,
    message: 'Data berhasil ditarik dan diperbarui dari Google Spreadsheet.',
    rowsCount: {
      DATA_BAST: db.DATA_BAST.length,
      DATA_INVENTARIS: db.DATA_INVENTARIS.length,
      DATA_PENARIKAN: db.DATA_PENARIKAN.length,
      FOTO_INVENTARIS: db.FOTO_INVENTARIS.length,
      MASTER_BARANG: db.MASTER_BARANG.length,
      PARAMETER: db.PARAMETER.length,
    },
  };
}

// Preview diff between local database and remote Spreadsheet
export async function previewTwoWaySyncDiff(webAppUrl: string): Promise<SyncDiffPreview[]> {
  if (!webAppUrl || !webAppUrl.startsWith('https://script.google.com')) {
    throw new Error('URL Google Apps Script Web App belum diisi atau format tidak valid.');
  }

  const response = await fetch(webAppUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'getAllData' }),
  });

  if (!response.ok) {
    throw new Error(`Google Apps Script merespons dengan HTTP ${response.status}`);
  }

  const result = await response.json();
  if (!result.success || !result.data) {
    throw new Error(result.error || result.message || 'Gagal membaca Google Spreadsheet.');
  }

  const remote = result.data;
  const db = dbInstance.getSnapshot();

  const previewList: SyncDiffPreview[] = [
    {
      sheetName: 'DATA_BAST',
      localCount: db.DATA_BAST.length,
      remoteCount: Array.isArray(remote.DATA_BAST) ? remote.DATA_BAST.length : 0,
      toPushCount: db.DATA_BAST.length,
      toPullCount: Array.isArray(remote.DATA_BAST) ? remote.DATA_BAST.length : 0,
      conflictCount: 0,
    },
    {
      sheetName: 'DATA_INVENTARIS',
      localCount: db.DATA_INVENTARIS.length,
      remoteCount: Array.isArray(remote.DATA_INVENTARIS) ? remote.DATA_INVENTARIS.length : 0,
      toPushCount: db.DATA_INVENTARIS.length,
      toPullCount: Array.isArray(remote.DATA_INVENTARIS) ? remote.DATA_INVENTARIS.length : 0,
      conflictCount: 0,
    },
    {
      sheetName: 'DATA_PENARIKAN',
      localCount: db.DATA_PENARIKAN.length,
      remoteCount: Array.isArray(remote.DATA_PENARIKAN) ? remote.DATA_PENARIKAN.length : 0,
      toPushCount: db.DATA_PENARIKAN.length,
      toPullCount: Array.isArray(remote.DATA_PENARIKAN) ? remote.DATA_PENARIKAN.length : 0,
      conflictCount: 0,
    },
    {
      sheetName: 'MASTER_BARANG',
      localCount: db.MASTER_BARANG.length,
      remoteCount: Array.isArray(remote.MASTER_BARANG) ? remote.MASTER_BARANG.length : 0,
      toPushCount: db.MASTER_BARANG.length,
      toPullCount: Array.isArray(remote.MASTER_BARANG) ? remote.MASTER_BARANG.length : 0,
      conflictCount: 0,
    },
    {
      sheetName: 'PARAMETER',
      localCount: db.PARAMETER.length,
      remoteCount: Array.isArray(remote.PARAMETER) ? remote.PARAMETER.length : 0,
      toPushCount: db.PARAMETER.length,
      toPullCount: Array.isArray(remote.PARAMETER) ? remote.PARAMETER.length : 0,
      conflictCount: 0,
    },
    {
      sheetName: 'FOTO_INVENTARIS',
      localCount: db.FOTO_INVENTARIS.length,
      remoteCount: Array.isArray(remote.FOTO_INVENTARIS) ? remote.FOTO_INVENTARIS.length : 0,
      toPushCount: db.FOTO_INVENTARIS.length,
      toPullCount: Array.isArray(remote.FOTO_INVENTARIS) ? remote.FOTO_INVENTARIS.length : 0,
      conflictCount: 0,
    },
  ];

  return previewList;
}

// Complete Apps Script Code.gs supporting 9 sheets & two-way sync
export function generateAppsScriptCode(): string {
  return `/**
 * Google Apps Script Backend for BAST & Inventory Asset Management
 * Menghubungkan Google Spreadsheet (Database Terpusat) dan Google Drive (Penyimpanan Foto)
 * Mendukung Sinkronisasi Dua Arah (Pull & Push), Inisialisasi Otomatis 9 Sheet, dan Upload Drive
 */

const SCHEMAS = {
  DATA_BAST: ['BASTRecordID', 'AssetID', 'Tanggal', 'Bulan', 'Tahun', 'BidangPengadaan', 'BidangPengguna', 'Bidang', 'BASTNo', 'NamaBarang', 'UniqueName', 'JenisBarang', 'DetailSpesifikasi', 'NomorSerial', 'LokasiDistribusi', 'NomorUPA', 'TanggalPenerimaan', 'AssetNumber', 'Status', 'CreatedAt', 'CreatedBy', 'UpdatedAt', 'UpdatedBy'],
  BRIDGE_RECORD: ['BridgeID', 'NomorUrut', 'Tahun', 'BidangPengadaan', 'BidangPengguna', 'Bidang', 'BASTNo', 'AssetNumber', 'CreatedAt'],
  PARAMETER: ['ParamID', 'Kategori', 'Key', 'Value', 'Label', 'Kode', 'Status', 'Keterangan', 'UpdatedAt'],
  MASTER_BARANG: ['MasterBarangID', 'NamaBarang', 'UniqueName', 'JenisBarang', 'Status', 'CreatedAt', 'UpdatedAt'],
  DATA_INVENTARIS: ['AssetID', 'AssetNumber', 'BASTRecordID', 'MasterBarangID', 'NamaBarang', 'JenisBarang', 'DetailSpesifikasi', 'NomorSerial', 'Jumlah', 'BidangPengadaan', 'BidangPengguna', 'Pemilik', 'TanggalPerolehan', 'Kondisi', 'Lokasi', 'StatusAset', 'CreatedAt', 'UpdatedAt'],
  DATA_PENARIKAN: ['WithdrawalID', 'AssetID', 'AssetNumber', 'NamaBarang', 'JenisBarang', 'DetailSpesifikasi', 'NomorSerial', 'BidangPengadaan', 'BidangPengguna', 'Pemilik', 'TanggalPerolehan', 'Kondisi', 'LokasiTerakhir', 'TanggalPenarikan', 'AlasanPenarikan', 'Catatan', 'DitarikOleh', 'CreatedAt'],
  FOTO_INVENTARIS: ['PhotoID', 'AssetID', 'AssetNumber', 'PhotoURL', 'DriveFileID', 'NamaFile', 'TanggalUpload', 'UploadedBy', 'StatusFoto', 'Keterangan'],
  LOG_AKTIVITAS: ['LogID', 'Waktu', 'User', 'Aktivitas', 'JenisData', 'RecordID', 'RingkasanPerubahan', 'Status'],
  CONFIG: ['Key', 'Value', 'UpdatedAt']
};

function doGet(e) {
  return jsonResponse({
    status: 'online',
    timestamp: new Date().toISOString(),
    message: 'Google Apps Script Web App BAST & Inventaris aktif dan siap menerima data.'
  });
}

function doPost(e) {
  try {
    const postData = JSON.parse(e.postData.contents);
    const action = postData.action;
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    // 1. Inisialisasi 9 Sheet
    if (action === 'initSheets') {
      initAllSheets(ss);
      return jsonResponse({ success: true, message: 'Seluruh 9 sheet database berhasil diinisialisasi.' });
    }

    // 2. Baca Seluruh Data (Pull dari Spreadsheet ke Aplikasi)
    if (action === 'getAllData') {
      const data = {};
      for (const sheetName in SCHEMAS) {
        let sheet = ss.getSheetByName(sheetName);
        if (!sheet) {
          data[sheetName] = [];
          continue;
        }
        const lastRow = sheet.getLastRow();
        const lastCol = sheet.getLastColumn();
        if (lastRow <= 1 || lastCol === 0) {
          data[sheetName] = [];
          continue;
        }
        const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
        const rows = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
        const items = [];
        for (let r = 0; r < rows.length; r++) {
          const rowData = rows[r];
          const obj = {};
          let hasContent = false;
          for (let c = 0; c < headers.length; c++) {
            const h = headers[c];
            if (h) {
              const val = rowData[c];
              obj[h] = val !== undefined && val !== null ? String(val) : '';
              if (obj[h].trim() !== '') hasContent = true;
            }
          }
          if (hasContent) items.push(obj);
        }
        data[sheetName] = items;
      }
      return jsonResponse({ success: true, data: data, timestamp: new Date().toISOString() });
    }

    // 3. Kirim Seluruh Data (Push dari Aplikasi ke Spreadsheet)
    if (action === 'pushAllData') {
      const sheets = postData.sheets || {};
      for (const sheetName in sheets) {
        const rows = sheets[sheetName];
        if (Array.isArray(rows)) {
          let sheet = ss.getSheetByName(sheetName);
          if (!sheet) {
            sheet = ss.insertSheet(sheetName);
          }
          sheet.clearContents();
          if (rows.length > 0) {
            sheet.getRange(1, 1, rows.length, rows[0].length).setValues(rows);
            // Format header row
            sheet.getRange(1, 1, 1, rows[0].length).setFontWeight('bold').setBackground('#E2E8F0');
          }
        }
      }
      return jsonResponse({ success: true, message: 'Seluruh data berhasil disinkronisasi ke Google Spreadsheet.' });
    }

    // 4. Upload Foto ke Google Drive
    if (action === 'uploadDrivePhoto') {
      const folderId = postData.folderId;
      let folder;
      if (folderId) {
        folder = DriveApp.getFolderById(folderId);
      } else {
        const folders = DriveApp.getFoldersByName('BAST_Foto_Aset');
        folder = folders.hasNext() ? folders.next() : DriveApp.createFolder('BAST_Foto_Aset');
      }

      const decoded = Utilities.base64Decode(postData.base64.replace(/^data:image\\/\\w+;base64,/, ''));
      const blob = Utilities.newBlob(decoded, 'image/jpeg', postData.fileName || ('foto_' + postData.assetId + '.jpg'));
      const file = folder.createFile(blob);
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

      return jsonResponse({
        success: true,
        driveFileId: file.getId(),
        driveFileUrl: file.getUrl()
      });
    }

    return jsonResponse({ success: false, message: 'Aksi tidak dikenali: ' + action });
  } catch (err) {
    return jsonResponse({ success: false, error: err.toString() });
  }
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function initAllSheets(ss) {
  for (const sheetName in SCHEMAS) {
    let s = ss.getSheetByName(sheetName);
    if (!s) {
      s = ss.insertSheet(sheetName);
    }
    if (s.getLastRow() === 0) {
      s.appendRow(SCHEMAS[sheetName]);
      s.getRange(1, 1, 1, SCHEMAS[sheetName].length).setFontWeight('bold').setBackground('#E2E8F0');
    }
  }
}
`;
}
