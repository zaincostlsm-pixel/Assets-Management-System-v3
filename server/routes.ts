import express, { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { dbInstance } from './storage';
import { exportDaftarBast, exportDaftarInventaris, exportDaftarPenarikan } from './excelExport';
import { generateBastPdf } from './pdfGenerator';
import {
  uploadPhotoToStorage,
  generateAppsScriptCode,
  pushAllDataToGoogle,
  pullAllDataFromGoogle,
  previewTwoWaySyncDiff,
  initSheetsOnGoogle,
  createDatabaseBackup,
  listDatabaseBackups,
  restoreDatabaseBackup,
} from './googleSync';
import { realtimeHub } from './realtime';
import { BastRecord, BridgeRecord, DataInventaris, DataPenarikan, FotoInventaris, MasterBarang, ParameterItem } from './types';
import {
  loginUser,
  logoutUser,
  extractSessionFromReq,
  requireAuth,
  requireSuperAdmin,
} from './auth';

export const apiRouter = express.Router();

// ----------------- AUTHENTICATION & SESSION ENDPOINTS -----------------
// 1. Login endpoint (Public, supports brute force lockout)
apiRouter.post('/auth/login', async (req: Request, res: Response) => {
  const { username, password } = req.body;
  const result = await loginUser(username, password);

  if (!result.success || !result.session) {
    return res.status(401).json({
      success: false,
      error: result.error || 'Username atau password yang Anda masukkan salah.',
    });
  }

  // Set secure HTTP-only cookie with sameSite=none for iframe compatibility on HTTPS
  const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https' || process.env.NODE_ENV === 'production';
  res.cookie('assets_session', result.session.token, {
    httpOnly: true,
    secure: isHttps,
    sameSite: isHttps ? 'none' : 'lax',
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
  });

  return res.json({
    success: true,
    token: result.session.token,
    user: {
      username: result.session.username,
      role: result.session.role,
      name: result.session.name,
    },
  });
});

// 2. Logout endpoint
apiRouter.post('/auth/logout', (req: Request, res: Response) => {
  const token =
    req.cookies?.assets_session ||
    (req.headers.authorization?.startsWith('Bearer ')
      ? req.headers.authorization.slice(7).trim()
      : '');
  if (token) {
    logoutUser(token);
  }
  const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https' || process.env.NODE_ENV === 'production';
  res.clearCookie('assets_session', {
    secure: isHttps,
    sameSite: isHttps ? 'none' : 'lax',
  });
  return res.json({ success: true, message: 'Berhasil keluar dari sistem.' });
});

// 3. Current User Session endpoint
apiRouter.get('/auth/me', (req: Request, res: Response) => {
  const session = extractSessionFromReq(req);
  if (!session) {
    return res.status(401).json({
      authenticated: false,
      error: 'Sesi belum terautentikasi atau telah berakhir.',
    });
  }
  return res.json({
    authenticated: true,
    user: {
      username: session.username,
      role: session.role,
      name: session.name,
    },
  });
});

// ----------------- RBAC & SESSION PROTECTION MIDDLEWARE -----------------
// Strictly protects every endpoint according to role-based access control
apiRouter.use((req: Request, res: Response, next) => {
  // Public auth endpoint
  if (req.path === '/auth/login') {
    return next();
  }

  const session = extractSessionFromReq(req);
  if (!session) {
    return res.status(401).json({
      error: 'Akses ditolak. Sesi login telah berakhir atau belum terautentikasi.',
      requireLogin: true,
    });
  }

  (req as any).user = session;

  // Super Admin: Unrestricted access to all operational & administration features
  if (session.role === 'Super Admin') {
    return next();
  }

  // User: Read-only access strictly restricted to Fitur 3 (Monitoring) and Fitur 5 (Penarikan)
  const path = req.path;
  const isAllowedUserRoute =
    (req.method === 'GET' &&
      (path === '/auth/me' ||
        path === '/config' ||
        path === '/parameters' ||
        path === '/inventory' ||
        path.startsWith('/photos/') ||
        path === '/withdrawals' ||
        path === '/export/inventory' ||
        path === '/export/withdrawals')) ||
    (req.method === 'POST' && path === '/auth/logout');

  if (!isAllowedUserRoute) {
    return res.status(403).json({
      error:
        'Akses ditolak (HTTP 403 Forbidden). Akun User hanya memiliki izin melihat dan mengekspor data Monitoring Inventaris (Fitur 3) dan Daftar Penarikan Aset (Fitur 5). Seluruh tindakan mutasi dan akses ke modul lain ditolak.',
    });
  }

  next();
});

// ----------------- CONFIG & GOOGLE INTEGRATION -----------------
apiRouter.get('/config', (req: Request, res: Response) => {
  const db = dbInstance.getSnapshot();
  res.json({
    config: db.CONFIG,
    stats: {
      totalBast: db.DATA_BAST.length,
      totalInventaris: db.DATA_INVENTARIS.filter((i) => i.StatusAset === 'Aktif').length,
      totalPenarikan: db.DATA_PENARIKAN.length,
      totalPhotos: db.FOTO_INVENTARIS.length,
      totalMasterBarang: db.MASTER_BARANG.length,
    },
  });
});

apiRouter.post('/config/update', (req: Request, res: Response) => {
  const { googleSheetWebAppUrl, googleDriveFolderId, spreadsheetId, currentUser, currentUserRole } = req.body;
  const db = dbInstance.getSnapshot();
  if (googleSheetWebAppUrl !== undefined) db.CONFIG.googleSheetWebAppUrl = googleSheetWebAppUrl.trim();
  if (googleDriveFolderId !== undefined) db.CONFIG.googleDriveFolderId = googleDriveFolderId.trim();
  if (spreadsheetId !== undefined) db.CONFIG.spreadsheetId = spreadsheetId.trim();
  if (currentUser !== undefined) db.CONFIG.currentUser = currentUser.trim();
  if (currentUserRole !== undefined) db.CONFIG.currentUserRole = currentUserRole.trim();
  db.CONFIG.isConnectedToGoogle = !!(db.CONFIG.googleSheetWebAppUrl && db.CONFIG.googleSheetWebAppUrl.startsWith('https://script.google.com'));

  dbInstance.save();
  dbInstance.log('Pengaturan Sistem', 'CONFIG', 'CFG-01', `Memperbarui konfigurasi sistem (User: ${db.CONFIG.currentUser})`);

  res.json({ success: true, config: db.CONFIG });
});

apiRouter.get('/config/script-code', (req: Request, res: Response) => {
  const code = generateAppsScriptCode();
  res.json({ code });
});

apiRouter.post('/config/test-google', async (req: Request, res: Response) => {
  const db = dbInstance.getSnapshot();
  const webAppUrl = req.body.url || db.CONFIG.googleSheetWebAppUrl;

  if (!webAppUrl || !webAppUrl.startsWith('https://script.google.com')) {
    return res.status(400).json({ success: false, message: 'URL Google Apps Script Web App belum diisi atau format tidak valid.' });
  }

  try {
    const resp = await fetch(webAppUrl, { method: 'GET' });
    if (resp.ok) {
      db.CONFIG.isConnectedToGoogle = true;
      db.CONFIG.lastSyncTime = new Date().toISOString();
      dbInstance.save();
      return res.json({ success: true, message: 'Koneksi ke Google Apps Script Web App berhasil diverifikasi.' });
    } else {
      return res.status(502).json({ success: false, message: `Server Google Apps Script merespons dengan status: ${resp.status}` });
    }
  } catch (err: any) {
    return res.status(500).json({ success: false, message: `Gagal menghubungi Google Apps Script: ${err.message}` });
  }
});

// ----------------- TWO-WAY GOOGLE SPREADSHEET & BACKUP API -----------------
apiRouter.post('/sync/test', async (req: Request, res: Response) => {
  const db = dbInstance.getSnapshot();
  const webAppUrl = req.body.url || db.CONFIG.googleSheetWebAppUrl;

  if (!webAppUrl || !webAppUrl.startsWith('https://script.google.com')) {
    return res.status(400).json({ success: false, message: 'URL Google Apps Script Web App belum diisi atau format tidak valid.' });
  }

  const startTime = Date.now();
  try {
    const resp = await fetch(webAppUrl, { method: 'GET' });
    const latency = Date.now() - startTime;
    if (resp.ok) {
      const data = await resp.json().catch(() => ({}));
      db.CONFIG.isConnectedToGoogle = true;
      dbInstance.save();
      return res.json({
        success: true,
        message: `Koneksi Google Apps Script berhasil diverifikasi (${latency}ms).`,
        details: data,
        latency,
      });
    } else {
      return res.status(502).json({
        success: false,
        message: `Server Google Apps Script merespons HTTP ${resp.status}`,
      });
    }
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: `Gagal menghubungi Google Apps Script: ${err.message}`,
    });
  }
});

apiRouter.post('/sync/init-sheets', async (req: Request, res: Response) => {
  const db = dbInstance.getSnapshot();
  const webAppUrl = req.body.url || db.CONFIG.googleSheetWebAppUrl;

  try {
    const result = await initSheetsOnGoogle(webAppUrl);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

apiRouter.post('/sync/push', async (req: Request, res: Response) => {
  const db = dbInstance.getSnapshot();
  const webAppUrl = req.body.url || db.CONFIG.googleSheetWebAppUrl;

  try {
    const result = await pushAllDataToGoogle(webAppUrl);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

apiRouter.post('/sync/pull', async (req: Request, res: Response) => {
  const db = dbInstance.getSnapshot();
  const webAppUrl = req.body.url || db.CONFIG.googleSheetWebAppUrl;

  try {
    const result = await pullAllDataFromGoogle(webAppUrl);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

apiRouter.get('/sync/diff', async (req: Request, res: Response) => {
  const db = dbInstance.getSnapshot();
  const webAppUrl = (req.query.url as string) || db.CONFIG.googleSheetWebAppUrl;

  try {
    const diff = await previewTwoWaySyncDiff(webAppUrl);
    res.json({ success: true, data: diff });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

apiRouter.get('/sync/backups', (req: Request, res: Response) => {
  try {
    const list = listDatabaseBackups();
    res.json({ success: true, data: list });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

apiRouter.post('/sync/backups/create', (req: Request, res: Response) => {
  const reason = req.body.reason || 'Manual User Backup';
  try {
    const backup = createDatabaseBackup(reason);
    res.json({ success: true, data: backup, message: `Backup berhasil dibuat: ${backup.fileName}` });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

apiRouter.post('/sync/backups/restore', (req: Request, res: Response) => {
  const { fileName } = req.body;
  if (!fileName) {
    return res.status(400).json({ success: false, message: 'Nama file backup diperlukan.' });
  }
  try {
    const result = restoreDatabaseBackup(fileName);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

apiRouter.get('/sync/backups/download/:filename', (req: Request, res: Response) => {
  const { filename } = req.params;
  const filePath = path.resolve(process.cwd(), 'data', 'backups', filename);
  if (!fs.existsSync(filePath)) {
    return res.status(404).send('File backup tidak ditemukan.');
  }
  res.download(filePath, filename);
});

// ----------------- PARAMETERS -----------------
apiRouter.get('/parameters', (req: Request, res: Response) => {
  const db = dbInstance.getSnapshot();
  const kategori = req.query.kategori as string;
  let params = db.PARAMETER;
  if (kategori) {
    params = params.filter((p) => p.Kategori === kategori);
  }
  res.json({ data: params });
});

apiRouter.post('/parameters', (req: Request, res: Response) => {
  const { Kategori, Key, Value, Label, Kode, Keterangan } = req.body;
  if (!Kategori || !Key || !Label) {
    return res.status(400).json({ error: 'Kategori, Key, dan Label wajib diisi.' });
  }

  const db = dbInstance.getSnapshot();
  const existing = db.PARAMETER.find((p) => p.Kategori === Kategori && p.Key.toLowerCase() === Key.toLowerCase());
  if (existing) {
    return res.status(409).json({ error: `Parameter dengan key '${Key}' sudah terdaftar pada kategori ${Kategori}.` });
  }

  const newParam: ParameterItem = {
    ParamID: `PRM-${Date.now().toString().slice(-6)}`,
    Kategori,
    Key: Key.trim(),
    Value: (Value || Label).trim(),
    Label: Label.trim(),
    Kode: Kode ? Kode.trim() : undefined,
    Status: 'Aktif',
    Keterangan: Keterangan ? Keterangan.trim() : undefined,
    UpdatedAt: new Date().toISOString(),
  };

  db.PARAMETER.push(newParam);
  dbInstance.save();
  dbInstance.log('Tambah Parameter', 'PARAMETER', newParam.ParamID, `Menambah parameter ${newParam.Kategori}: ${newParam.Label} (${newParam.Key})`);

  res.status(201).json({ success: true, data: newParam });
});

apiRouter.put('/parameters/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const { Value, Label, Kode, Status, Keterangan } = req.body;
  const db = dbInstance.getSnapshot();
  const param = db.PARAMETER.find((p) => p.ParamID === id);

  if (!param) {
    return res.status(404).json({ error: 'Parameter tidak ditemukan.' });
  }

  if (Value !== undefined) param.Value = Value.trim();
  if (Label !== undefined) param.Label = Label.trim();
  if (Kode !== undefined) param.Kode = Kode ? Kode.trim() : undefined;
  if (Status !== undefined) param.Status = Status;
  if (Keterangan !== undefined) param.Keterangan = Keterangan ? Keterangan.trim() : undefined;
  param.UpdatedAt = new Date().toISOString();

  dbInstance.save();
  dbInstance.log('Ubah Parameter', 'PARAMETER', param.ParamID, `Mengubah parameter ${param.Kategori}: ${param.Label}`);

  res.json({ success: true, data: param });
});

apiRouter.patch('/parameters/:id/toggle', (req: Request, res: Response) => {
  const { id } = req.params;
  const db = dbInstance.getSnapshot();
  const param = db.PARAMETER.find((p) => p.ParamID === id);

  if (!param) {
    return res.status(404).json({ error: 'Parameter tidak ditemukan.' });
  }

  param.Status = param.Status === 'Aktif' ? 'Nonaktif' : 'Aktif';
  param.UpdatedAt = new Date().toISOString();

  dbInstance.save();
  dbInstance.log('Ubah Status Parameter', 'PARAMETER', param.ParamID, `Mengubah status parameter ${param.Label} menjadi ${param.Status}`);

  res.json({ success: true, data: param });
});

// ----------------- MASTER BARANG & UNIQUE NAME -----------------
apiRouter.get('/master-barang', (req: Request, res: Response) => {
  const db = dbInstance.getSnapshot();
  const search = (req.query.search as string || '').toLowerCase().trim();
  const status = req.query.status as string;

  let list = db.MASTER_BARANG;
  if (status) {
    list = list.filter((m) => m.Status === status);
  }
  if (search) {
    list = list.filter((m) => m.NamaBarang.toLowerCase().includes(search) || m.UniqueName.toLowerCase().includes(search) || m.JenisBarang.toLowerCase().includes(search));
  }

  res.json({ data: list });
});

apiRouter.post('/master-barang/suggest-code', (req: Request, res: Response) => {
  const { namaBarang } = req.body;
  if (!namaBarang) {
    return res.status(400).json({ error: 'Nama Barang diperlukan.' });
  }
  const result = dbInstance.generateUniqueName(namaBarang);
  res.json(result);
});

apiRouter.post('/master-barang', (req: Request, res: Response) => {
  const { NamaBarang, UniqueName, JenisBarang } = req.body;
  if (!NamaBarang || !UniqueName) {
    return res.status(400).json({ error: 'Nama Barang dan Unique Name wajib diisi.' });
  }

  const cleanNama = NamaBarang.trim();
  const cleanCode = UniqueName.trim().toUpperCase();
  const cleanJenis = (JenisBarang || 'Umum').trim();

  const db = dbInstance.getSnapshot();

  // Prevent exact or case-insensitive duplicate master barang
  const dupName = db.MASTER_BARANG.find((m) => m.NamaBarang.toLowerCase() === cleanNama.toLowerCase());
  if (dupName) {
    return res.status(409).json({ error: `Master barang dengan nama '${dupName.NamaBarang}' sudah ada.` });
  }

  // Check unique code collision
  const dupCode = db.MASTER_BARANG.find((m) => m.UniqueName.toUpperCase() === cleanCode);
  if (dupCode) {
    return res.status(409).json({
      error: `Kode '${cleanCode}' sudah digunakan oleh barang '${dupCode.NamaBarang}'. Harap gunakan kode unik lain.`,
    });
  }

  const newMaster: MasterBarang = {
    MasterBarangID: `MB-${Date.now().toString().slice(-5)}`,
    NamaBarang: cleanNama,
    UniqueName: cleanCode,
    JenisBarang: cleanJenis,
    Status: 'Aktif',
    CreatedAt: new Date().toISOString(),
    UpdatedAt: new Date().toISOString(),
  };

  db.MASTER_BARANG.push(newMaster);
  dbInstance.save();
  dbInstance.log('Tambah Master Barang', 'MASTER_BARANG', newMaster.MasterBarangID, `Menambah Master Barang: ${cleanNama} (${cleanCode})`);

  res.status(201).json({ success: true, data: newMaster });
});

apiRouter.put('/master-barang/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const { NamaBarang, UniqueName, JenisBarang, Status } = req.body;
  const db = dbInstance.getSnapshot();
  const master = db.MASTER_BARANG.find((m) => m.MasterBarangID === id);

  if (!master) {
    return res.status(404).json({ error: 'Master barang tidak ditemukan.' });
  }

  if (NamaBarang) master.NamaBarang = NamaBarang.trim();
  if (UniqueName) master.UniqueName = UniqueName.trim().toUpperCase();
  if (JenisBarang) master.JenisBarang = JenisBarang.trim();
  if (Status) master.Status = Status;
  master.UpdatedAt = new Date().toISOString();

  dbInstance.save();
  dbInstance.log('Ubah Master Barang', 'MASTER_BARANG', master.MasterBarangID, `Memperbarui Master Barang: ${master.NamaBarang}`);

  res.json({ success: true, data: master });
});

// ----------------- BAST INPUT & LISTING -----------------
apiRouter.get('/bast/available-numbers', (req: Request, res: Response) => {
  const db = dbInstance.getSnapshot();
  // Get distinct BAST numbers from DATA_BAST
  const map = new Map<string, { bastNo: string; bidangPengadaan: string; bidangPengguna: string; bidang: string; tanggal: string; count: number }>();
  for (const b of db.DATA_BAST) {
    let pengadaan = b.BidangPengadaan || b.Bidang || '';
    if (!pengadaan && b.BASTNo) {
      const parts = b.BASTNo.split('/');
      if (parts.length >= 3) pengadaan = parts[2];
    }
    const pengguna = b.BidangPengguna || b.Bidang || '';
    if (!map.has(b.BASTNo)) {
      map.set(b.BASTNo, { bastNo: b.BASTNo, bidangPengadaan: pengadaan, bidangPengguna: pengguna, bidang: pengadaan, tanggal: b.Tanggal, count: 1 });
    } else {
      const cur = map.get(b.BASTNo)!;
      cur.count++;
    }
  }
  const result = Array.from(map.values()).reverse();
  res.json({ data: result });
});

apiRouter.get('/bast/next-numbers', (req: Request, res: Response) => {
  const { bidangPengadaan, bidangPengguna, bidang, tanggal, uniqueName } = req.query as Record<string, string>;
  const pengadaan = (bidangPengadaan || bidang || '').trim();
  const pengguna = (bidangPengguna || bidangPengadaan || bidang || '').trim();
  const cleanUniqueName = (uniqueName || '').trim().toUpperCase();

  if (!pengadaan || !pengguna || !tanggal) {
    return res.status(400).json({ error: 'Bidang Pengadaan, Bidang Pengguna, dan tanggal wajib disertakan.' });
  }

  if (!cleanUniqueName) {
    return res.status(400).json({ error: 'Kode Unik Barang (UNIQUE_NAME) wajib disertakan untuk penomoran inventaris.' });
  }

  try {
    // BSTA document number uses BidangPengadaan
    const bastInfo = dbInstance.generateNextBastNumber(pengadaan, tanggal);
    // Nomor Inventaris / No Asset uses BidangPengguna and sequence per UNIQUE_NAME
    const assetInfo = dbInstance.generateNextAssetNumber(cleanUniqueName, pengguna, tanggal, false);

    res.json({
      bastNo: bastInfo.bastNo,
      seqNumber: bastInfo.seqNumber,
      assetNumber: assetInfo.assetNumber,
      assetSeqNumber: assetInfo.seqNumber,
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Gagal menghitung nomor inventaris.' });
  }
});

apiRouter.get('/bast', (req: Request, res: Response) => {
  const db = dbInstance.getSnapshot();
  const { bidang, bidangPengadaan, bidangPengguna, year, bastNo, search, status } = req.query as Record<string, string>;

  let list = db.DATA_BAST;

  if (bidangPengadaan && bidangPengadaan !== 'Semua') {
    list = list.filter((b) => (b.BidangPengadaan || b.Bidang || '').toLowerCase() === bidangPengadaan.toLowerCase());
  } else if (bidang && bidang !== 'Semua') {
    list = list.filter((b) =>
      (b.BidangPengadaan || b.Bidang || '').toLowerCase() === bidang.toLowerCase() ||
      (b.BidangPengguna || '').toLowerCase() === bidang.toLowerCase()
    );
  }
  if (bidangPengguna && bidangPengguna !== 'Semua') {
    list = list.filter((b) => (b.BidangPengguna || '').toLowerCase() === bidangPengguna.toLowerCase());
  }
  if (year && year !== 'Semua') {
    const yr = parseInt(year, 10);
    list = list.filter((b) => b.Tahun === yr);
  }
  if (bastNo) {
    list = list.filter((b) => b.BASTNo.toLowerCase().includes(bastNo.toLowerCase()));
  }
  if (status && status !== 'Semua') {
    list = list.filter((b) => b.Status.toLowerCase() === status.toLowerCase());
  }
  if (search) {
    const s = search.toLowerCase();
    list = list.filter(
      (b) =>
        b.BASTNo.toLowerCase().includes(s) ||
        b.NamaBarang.toLowerCase().includes(s) ||
        b.AssetNumber.toLowerCase().includes(s) ||
        b.NomorSerial.toLowerCase().includes(s) ||
        (b.BidangPengadaan || '').toLowerCase().includes(s) ||
        (b.BidangPengguna || '').toLowerCase().includes(s) ||
        (b.Bidang || '').toLowerCase().includes(s) ||
        b.LokasiDistribusi.toLowerCase().includes(s) ||
        b.DetailSpesifikasi.toLowerCase().includes(s)
    );
  }

  // Return with attached photo metadata
  const enriched = list.map((item) => {
    const itemPhotos = db.FOTO_INVENTARIS.filter((p) => p.AssetID === item.AssetID);
    return {
      ...item,
      photos: itemPhotos,
    };
  });

  res.json({ data: enriched, total: enriched.length });
});

apiRouter.post('/bast', async (req: Request, res: Response) => {
  const {
    modeBast, // "Baru" | "Sama"
    selectedExistingBastNo,
    tanggal, // YYYY-MM-DD
    bidangPengadaan,
    bidangPengguna,
    bidang, // legacy fallback
    namaBarang,
    uniqueName,
    jenisBarang,
    detailSpesifikasi,
    nomorSerial,
    lokasiDistribusi,
    nomorUPA,
    tanggalPenerimaan,
    photos, // Array of { fileName: string, base64: string }
  } = req.body;

  let pengadaan = (bidangPengadaan || bidang || '').trim();
  let pengguna = (bidangPengguna || bidang || '').trim();

  // Validation
  if (!uniqueName || !uniqueName.trim()) {
    return res.status(400).json({ error: 'Kode Unik Barang (UNIQUE_NAME) wajib diisi dan tidak boleh kosong.' });
  }
  if (!tanggal || (!pengadaan && modeBast !== 'Sama') || !pengguna || !namaBarang) {
    return res.status(400).json({ error: 'Tanggal, Bidang Pengadaan, Bidang Pengguna, dan Nama Barang wajib diisi.' });
  }

  const db = dbInstance.getSnapshot();
  const dateObj = new Date(tanggal);
  const bulan = isNaN(dateObj.getMonth()) ? new Date().getMonth() + 1 : dateObj.getMonth() + 1;
  const tahun = isNaN(dateObj.getFullYear()) ? new Date().getFullYear() : dateObj.getFullYear();

  // Determine BAST Number (based on BidangPengadaan)
  let finalBastNo = '';
  let bastSeqNumber = 0;

  if (modeBast === 'Sama' && selectedExistingBastNo) {
    // Validate existing BAST exists
    const matchingBast = db.DATA_BAST.find((b) => b.BASTNo === selectedExistingBastNo);
    if (!matchingBast) {
      return res.status(400).json({ error: 'Nomor BAST yang dipilih tidak ditemukan dalam database.' });
    }
    finalBastNo = selectedExistingBastNo;
    const parts = finalBastNo.split('/');
    bastSeqNumber = parseInt(parts[0], 10) || 1;
    // CRITICAL: Ensure Bidang Pengadaan is strictly consistent with the selected existing BAST document!
    pengadaan = (parts.length >= 3 && parts[2]) ? parts[2] : (matchingBast.BidangPengadaan || matchingBast.Bidang || pengadaan);
  } else {
    // Generate new BAST number atomically using BidangPengadaan (with monthly reset)
    const bastGen = dbInstance.generateNextBastNumber(pengadaan, tanggal);
    finalBastNo = bastGen.bastNo;
    bastSeqNumber = bastGen.seqNumber;
  }

  // Generate unique AssetNumber atomically using BidangPengguna with reservation
  let assetGen: { assetNumber: string; seqNumber: number };
  try {
    assetGen = dbInstance.generateNextAssetNumber(uniqueName, pengguna, tanggal, true);
  } catch (genErr: any) {
    return res.status(400).json({ error: genErr.message || 'Gagal membentuk nomor aset inventaris.' });
  }
  const finalAssetNumber = assetGen.assetNumber;

  // Primary Keys
  const bastRecordId = `BST-${tahun}-${String(db.DATA_BAST.length + 1).padStart(3, '0')}`;
  const assetId = `AST-${tahun}-${String(db.DATA_INVENTARIS.length + 1).padStart(3, '0')}`;
  const nowIso = new Date().toISOString();
  const currentUser = db.CONFIG.currentUser || 'Admin Aset';

  // Find or link MasterBarangID
  let masterItem = db.MASTER_BARANG.find((m) => m.NamaBarang.toLowerCase() === namaBarang.trim().toLowerCase());
  if (!masterItem) {
    // Auto register into MASTER_BARANG
    masterItem = {
      MasterBarangID: `MB-${Date.now().toString().slice(-5)}`,
      NamaBarang: namaBarang.trim(),
      UniqueName: uniqueName.trim().toUpperCase(),
      JenisBarang: (jenisBarang || 'Umum').trim(),
      Status: 'Aktif',
      CreatedAt: nowIso,
      UpdatedAt: nowIso,
    };
    db.MASTER_BARANG.push(masterItem);
  }

  // 1. DATA_BAST record
  const newBastRecord: BastRecord = {
    BASTRecordID: bastRecordId,
    AssetID: assetId,
    Tanggal: tanggal,
    Bulan: bulan,
    Tahun: tahun,
    BidangPengadaan: pengadaan,
    BidangPengguna: pengguna,
    Bidang: pengadaan,
    BASTNo: finalBastNo,
    NamaBarang: namaBarang.trim(),
    UniqueName: uniqueName.trim().toUpperCase(),
    JenisBarang: (jenisBarang || masterItem.JenisBarang || 'Umum').trim(),
    DetailSpesifikasi: (detailSpesifikasi || '').trim(),
    NomorSerial: (nomorSerial || '').trim(),
    LokasiDistribusi: (lokasiDistribusi || '').trim(),
    NomorUPA: (nomorUPA || '').trim(),
    TanggalPenerimaan: tanggalPenerimaan || tanggal,
    AssetNumber: finalAssetNumber,
    Status: 'Aktif',
    CreatedAt: nowIso,
    CreatedBy: currentUser,
    UpdatedAt: nowIso,
    UpdatedBy: currentUser,
  };

  // 2. BRIDGE_RECORD
  const newBridgeRecord: BridgeRecord = {
    BridgeID: `BRG-${Date.now().toString().slice(-6)}`,
    NomorUrut: bastSeqNumber,
    Bulan: bulan,
    Tahun: tahun,
    BidangPengadaan: pengadaan,
    BidangPengguna: pengguna,
    Bidang: pengadaan,
    BASTNo: finalBastNo,
    AssetNumber: finalAssetNumber,
    CreatedAt: nowIso,
  };

  // 3. DATA_INVENTARIS
  const newInventarisRecord: DataInventaris = {
    AssetID: assetId,
    AssetNumber: finalAssetNumber,
    BASTRecordID: bastRecordId,
    MasterBarangID: masterItem.MasterBarangID,
    NamaBarang: namaBarang.trim(),
    JenisBarang: newBastRecord.JenisBarang,
    DetailSpesifikasi: newBastRecord.DetailSpesifikasi,
    NomorSerial: newBastRecord.NomorSerial,
    Jumlah: 1,
    BidangPengadaan: pengadaan,
    BidangPengguna: pengguna,
    Pemilik: pengguna,
    TanggalPerolehan: tanggalPenerimaan || tanggal,
    Kondisi: 'Baik',
    Lokasi: newBastRecord.LokasiDistribusi || 'Belum Ditentukan',
    StatusAset: 'Aktif',
    CreatedAt: nowIso,
    UpdatedAt: nowIso,
  };

  // Atomically commit records immediately to lock numbering and avoid any concurrency clash
  db.DATA_BAST.unshift(newBastRecord);
  db.BRIDGE_RECORD.unshift(newBridgeRecord);
  db.DATA_INVENTARIS.unshift(newInventarisRecord);
  dbInstance.save();
  dbInstance.commitAssetReservation(finalAssetNumber);

  // Process Photos if provided
  const uploadedPhotoRecords: FotoInventaris[] = [];
  if (Array.isArray(photos) && photos.length > 0) {
    for (let i = 0; i < photos.length; i++) {
      const p = photos[i];
      if (p.base64) {
        try {
          const uploadRes = await uploadPhotoToStorage(
            p.base64,
            p.fileName || `foto_${i + 1}.jpg`,
            assetId,
            db.CONFIG.googleSheetWebAppUrl,
            db.CONFIG.googleDriveFolderId
          );

          const photoRecord: FotoInventaris = {
            PhotoID: `PHT-${Date.now()}-${i}`,
            AssetID: assetId,
            AssetNumber: finalAssetNumber,
            PhotoURL: uploadRes.photoUrl,
            DriveFileID: uploadRes.driveFileId,
            NamaFile: p.fileName || `foto_${i + 1}.jpg`,
            TanggalUpload: nowIso,
            UploadedBy: currentUser,
            StatusFoto: 'Aktif',
            Keterangan: `Foto dokumentasi saat penerimaan BAST (${newBastRecord.NamaBarang})`,
          };

          uploadedPhotoRecords.push(photoRecord);
          db.FOTO_INVENTARIS.push(photoRecord);
        } catch (photoErr) {
          console.error('Error saving photo for asset:', photoErr);
        }
      }
    }
    if (uploadedPhotoRecords.length > 0) {
      dbInstance.save();
    }
  }

  // Audit log
  dbInstance.log(
    modeBast === 'Sama' ? 'Input BAST (Nomor Sama)' : 'Input BAST Baru',
    'DATA_BAST',
    bastRecordId,
    `Pencatatan BAST ${finalBastNo} dan Aset ${finalAssetNumber} (${newBastRecord.NamaBarang}) dengan ${uploadedPhotoRecords.length} foto`
  );

  res.status(201).json({
    success: true,
    message: 'Transaksi BAST dan data inventaris berhasil disimpan.',
    bastRecord: newBastRecord,
    inventarisRecord: newInventarisRecord,
    bastNo: finalBastNo,
    assetNumber: finalAssetNumber,
    photosCount: uploadedPhotoRecords.length,
  });
});

// ----------------- MONITORING INVENTARIS -----------------
apiRouter.get('/inventory', (req: Request, res: Response) => {
  const db = dbInstance.getSnapshot();
  const { pemilik, bidangPengadaan, bidangPengguna, namaBarang, kondisi, lokasi, search } = req.query as Record<string, string>;

  // Monitoring Inventaris displays ONLY active assets
  let list = db.DATA_INVENTARIS.filter((inv) => inv.StatusAset === 'Aktif');

  if (bidangPengadaan && bidangPengadaan !== 'Semua') {
    list = list.filter((i) => (i.BidangPengadaan || '').toLowerCase() === bidangPengadaan.toLowerCase());
  }
  if (bidangPengguna && bidangPengguna !== 'Semua') {
    list = list.filter((i) => (i.BidangPengguna || i.Pemilik || '').toLowerCase() === bidangPengguna.toLowerCase());
  }
  if (pemilik && pemilik !== 'Semua' && (!bidangPengguna || bidangPengguna === 'Semua')) {
    list = list.filter((i) => (i.BidangPengguna || i.Pemilik || '').toLowerCase() === pemilik.toLowerCase());
  }
  if (namaBarang && namaBarang !== 'Semua') {
    list = list.filter((i) => i.NamaBarang.toLowerCase() === namaBarang.toLowerCase());
  }
  if (kondisi && kondisi !== 'Semua') {
    list = list.filter((i) => i.Kondisi.toLowerCase() === kondisi.toLowerCase());
  }
  if (lokasi && lokasi !== 'Semua') {
    list = list.filter((i) => i.Lokasi.toLowerCase() === lokasi.toLowerCase());
  }
  if (search) {
    const s = search.toLowerCase();
    list = list.filter(
      (i) =>
        i.AssetNumber.toLowerCase().includes(s) ||
        i.NamaBarang.toLowerCase().includes(s) ||
        i.JenisBarang.toLowerCase().includes(s) ||
        i.NomorSerial.toLowerCase().includes(s) ||
        (i.BidangPengadaan || '').toLowerCase().includes(s) ||
        (i.BidangPengguna || '').toLowerCase().includes(s) ||
        (i.Pemilik || '').toLowerCase().includes(s) ||
        i.Lokasi.toLowerCase().includes(s) ||
        i.DetailSpesifikasi.toLowerCase().includes(s)
    );
  }

  // Attach photos
  const enriched = list.map((item) => {
    const photos = db.FOTO_INVENTARIS.filter((p) => p.AssetID === item.AssetID);
    return {
      ...item,
      photos,
    };
  });

  res.json({ data: enriched, total: enriched.length });
});

apiRouter.get('/inventory/:assetId', (req: Request, res: Response) => {
  const { assetId } = req.params;
  const db = dbInstance.getSnapshot();
  const item = db.DATA_INVENTARIS.find((i) => i.AssetID === assetId);

  if (!item) {
    return res.status(404).json({ error: 'Aset tidak ditemukan.' });
  }

  const photos = db.FOTO_INVENTARIS.filter((p) => p.AssetID === assetId);
  const bast = db.DATA_BAST.find((b) => b.AssetID === assetId);

  res.json({ data: { ...item, photos, bast } });
});

// FITUR 1: EDIT ASET
apiRouter.put('/inventory/:assetId', (req: Request, res: Response) => {
  const { assetId } = req.params;
  const {
    NamaBarang,
    UniqueName,
    JenisBarang,
    DetailSpesifikasi,
    NomorSerial,
    Jumlah,
    BidangPengadaan,
    BidangPengguna,
    Pemilik,
    TanggalPerolehan,
    Kondisi,
    Lokasi,
  } = req.body;

  const db = dbInstance.getSnapshot();
  const asset = db.DATA_INVENTARIS.find((i) => i.AssetID === assetId);

  if (!asset) {
    return res.status(404).json({ error: 'Aset tidak ditemukan dalam database.' });
  }

  // Validasi field wajib
  if (!NamaBarang || !NamaBarang.trim()) {
    return res.status(400).json({ error: 'Nama Barang wajib diisi.' });
  }
  const targetPengguna = (BidangPengguna || Pemilik || asset.BidangPengguna || asset.Pemilik || '').trim();
  const targetPengadaan = (BidangPengadaan || asset.BidangPengadaan || '').trim();

  if (!targetPengguna) {
    return res.status(400).json({ error: 'Bidang Pengguna wajib diisi.' });
  }
  if (!Kondisi || !Kondisi.trim()) {
    return res.status(400).json({ error: 'Kondisi aset wajib dipilih.' });
  }
  if (!Lokasi || !Lokasi.trim()) {
    return res.status(400).json({ error: 'Lokasi wajib diisi.' });
  }

  const currentUser = db.CONFIG.currentUser || 'Admin Aset';
  const nowIso = new Date().toISOString();

  // Track changes for audit log
  const changes: string[] = [];
  if (asset.NamaBarang !== NamaBarang.trim()) {
    changes.push(`Nama Barang: "${asset.NamaBarang}" → "${NamaBarang.trim()}"`);
  }
  if (targetPengadaan && asset.BidangPengadaan !== targetPengadaan) {
    changes.push(`Bidang Pengadaan: "${asset.BidangPengadaan}" → "${targetPengadaan}"`);
  }
  if (targetPengguna && (asset.BidangPengguna !== targetPengguna || asset.Pemilik !== targetPengguna)) {
    changes.push(`Bidang Pengguna: "${asset.BidangPengguna || asset.Pemilik}" → "${targetPengguna}"`);
  }
  if (asset.Kondisi !== Kondisi.trim()) {
    changes.push(`Kondisi: "${asset.Kondisi}" → "${Kondisi.trim()}"`);
  }
  if (asset.Lokasi !== Lokasi.trim()) {
    changes.push(`Lokasi: "${asset.Lokasi}" → "${Lokasi.trim()}"`);
  }
  if (asset.DetailSpesifikasi !== (DetailSpesifikasi || '').trim()) {
    changes.push('Detail/Spesifikasi diperbarui');
  }
  if (asset.NomorSerial !== (NomorSerial || '').trim()) {
    changes.push(`Nomor Serial: "${asset.NomorSerial}" → "${(NomorSerial || '').trim()}"`);
  }
  if (Jumlah !== undefined && asset.Jumlah !== Number(Jumlah)) {
    changes.push(`Jumlah: ${asset.Jumlah} → ${Number(Jumlah)}`);
  }

  // Update DATA_INVENTARIS (maintain identity, do not duplicate)
  asset.NamaBarang = NamaBarang.trim();
  if (JenisBarang !== undefined) asset.JenisBarang = JenisBarang.trim();
  if (DetailSpesifikasi !== undefined) asset.DetailSpesifikasi = DetailSpesifikasi.trim();
  if (NomorSerial !== undefined) asset.NomorSerial = NomorSerial.trim();
  if (Jumlah !== undefined) asset.Jumlah = Math.max(1, Number(Jumlah) || 1);
  if (targetPengadaan) asset.BidangPengadaan = targetPengadaan;
  asset.BidangPengguna = targetPengguna;
  asset.Pemilik = targetPengguna;
  if (TanggalPerolehan !== undefined && TanggalPerolehan.trim()) asset.TanggalPerolehan = TanggalPerolehan.trim();
  asset.Kondisi = Kondisi.trim();
  asset.Lokasi = Lokasi.trim();
  asset.UpdatedAt = nowIso;

  // Synchronize corresponding DATA_BAST record to maintain data consistency
  const bastRecord = db.DATA_BAST.find((b) => b.AssetID === assetId || (asset.BASTRecordID && b.BASTRecordID === asset.BASTRecordID));
  if (bastRecord) {
    bastRecord.NamaBarang = asset.NamaBarang;
    bastRecord.JenisBarang = asset.JenisBarang;
    bastRecord.DetailSpesifikasi = asset.DetailSpesifikasi;
    bastRecord.NomorSerial = asset.NomorSerial;
    bastRecord.LokasiDistribusi = asset.Lokasi;
    if (targetPengadaan) bastRecord.BidangPengadaan = targetPengadaan;
    bastRecord.BidangPengguna = targetPengguna;
    bastRecord.Bidang = targetPengadaan || targetPengguna;
    if (UniqueName && UniqueName.trim()) {
      bastRecord.UniqueName = UniqueName.trim().toUpperCase();
    }
    if (TanggalPerolehan && TanggalPerolehan.trim()) {
      bastRecord.TanggalPenerimaan = TanggalPerolehan.trim();
    }
    bastRecord.UpdatedAt = nowIso;
    bastRecord.UpdatedBy = currentUser;
  }

  // Synchronize DATA_PENARIKAN record if this asset was ever withdrawn
  const withdrawalRecord = db.DATA_PENARIKAN.find((w) => w.AssetID === assetId);
  if (withdrawalRecord) {
    withdrawalRecord.NamaBarang = asset.NamaBarang;
    withdrawalRecord.JenisBarang = asset.JenisBarang;
    withdrawalRecord.DetailSpesifikasi = asset.DetailSpesifikasi;
    withdrawalRecord.NomorSerial = asset.NomorSerial;
    if (targetPengadaan) withdrawalRecord.BidangPengadaan = targetPengadaan;
    withdrawalRecord.BidangPengguna = targetPengguna;
    withdrawalRecord.Pemilik = targetPengguna;
  }

  // Photos in FOTO_INVENTARIS remain linked to AssetID seamlessly

  dbInstance.save();

  // Audit log
  const summary = changes.length > 0 ? changes.join('; ') : 'Pembaruan data aset tanpa perubahan nilai';
  dbInstance.log(
    'Edit Aset',
    'DATA_INVENTARIS',
    asset.AssetID,
    `Perubahan aset ${asset.AssetNumber} (${asset.NamaBarang}): ${summary}`,
    'Sukses',
    currentUser
  );

  // Broadcast realtime update
  realtimeHub.broadcast({
    type: 'inventory:updated',
    entity: 'DATA_INVENTARIS',
    action: 'EDIT',
    id: asset.AssetID,
    timestamp: nowIso,
  });

  res.json({
    success: true,
    message: `Data aset ${asset.AssetNumber} berhasil diperbarui.`,
    data: asset,
  });
});

// ----------------- PHOTO MANAGEMENT -----------------
apiRouter.get('/photos/:assetId', (req: Request, res: Response) => {
  const { assetId } = req.params;
  const db = dbInstance.getSnapshot();
  const photos = db.FOTO_INVENTARIS.filter((p) => p.AssetID === assetId);
  res.json({ data: photos });
});

apiRouter.post('/photos/add', async (req: Request, res: Response) => {
  const { assetId, base64, fileName, keterangan } = req.body;
  if (!assetId || !base64) {
    return res.status(400).json({ error: 'AssetID dan base64 foto wajib diisi.' });
  }

  const db = dbInstance.getSnapshot();
  const asset = db.DATA_INVENTARIS.find((i) => i.AssetID === assetId);
  if (!asset) {
    return res.status(404).json({ error: 'Aset tidak ditemukan.' });
  }

  const uploadRes = await uploadPhotoToStorage(
    base64,
    fileName || 'foto_tambahan.jpg',
    assetId,
    db.CONFIG.googleSheetWebAppUrl,
    db.CONFIG.googleDriveFolderId
  );

  const newPhoto: FotoInventaris = {
    PhotoID: `PHT-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    AssetID: assetId,
    AssetNumber: asset.AssetNumber,
    PhotoURL: uploadRes.photoUrl,
    DriveFileID: uploadRes.driveFileId,
    NamaFile: fileName || 'foto_tambahan.jpg',
    TanggalUpload: new Date().toISOString(),
    UploadedBy: db.CONFIG.currentUser || 'Admin Aset',
    StatusFoto: 'Aktif',
    Keterangan: keterangan || 'Foto dokumentasi tambahan aset',
  };

  db.FOTO_INVENTARIS.push(newPhoto);
  dbInstance.save();
  dbInstance.log('Tambah Foto', 'FOTO_INVENTARIS', newPhoto.PhotoID, `Menambah foto pada aset ${asset.AssetNumber}`);

  res.status(201).json({ success: true, data: newPhoto });
});

apiRouter.post('/photos/replace-main', async (req: Request, res: Response) => {
  const { assetId, base64, fileName, keterangan } = req.body;
  if (!assetId || !base64) {
    return res.status(400).json({ error: 'AssetID dan base64 foto wajib diisi.' });
  }

  const db = dbInstance.getSnapshot();
  const asset = db.DATA_INVENTARIS.find((i) => i.AssetID === assetId);
  if (!asset) {
    return res.status(404).json({ error: 'Aset tidak ditemukan.' });
  }

  // Upload new photo first before marking old photo
  const uploadRes = await uploadPhotoToStorage(
    base64,
    fileName || 'foto_utama_baru.jpg',
    assetId,
    db.CONFIG.googleSheetWebAppUrl,
    db.CONFIG.googleDriveFolderId
  );

  // Mark previous active photo(s) as 'Diganti' (preserving history!)
  for (const p of db.FOTO_INVENTARIS) {
    if (p.AssetID === assetId && p.StatusFoto === 'Aktif') {
      p.StatusFoto = 'Diganti';
    }
  }

  const newPhoto: FotoInventaris = {
    PhotoID: `PHT-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    AssetID: assetId,
    AssetNumber: asset.AssetNumber,
    PhotoURL: uploadRes.photoUrl,
    DriveFileID: uploadRes.driveFileId,
    NamaFile: fileName || 'foto_utama_baru.jpg',
    TanggalUpload: new Date().toISOString(),
    UploadedBy: db.CONFIG.currentUser || 'Admin Aset',
    StatusFoto: 'Aktif',
    Keterangan: keterangan || 'Foto utama aset yang diperbarui',
  };

  db.FOTO_INVENTARIS.push(newPhoto);
  dbInstance.save();
  dbInstance.log('Perbarui Foto Utama', 'FOTO_INVENTARIS', newPhoto.PhotoID, `Mengganti foto utama aset ${asset.AssetNumber} (foto lama disimpan sebagai histori)`);

  res.json({ success: true, data: newPhoto });
});

// ----------------- PENARIKAN ASET -----------------
apiRouter.get('/withdrawals/active-assets', (req: Request, res: Response) => {
  const db = dbInstance.getSnapshot();
  const pemilik = req.query.pemilik as string;
  const namaBarang = req.query.namaBarang as string;

  let activeList = db.DATA_INVENTARIS.filter((i) => i.StatusAset === 'Aktif');

  if (pemilik && pemilik !== 'Semua') {
    activeList = activeList.filter((i) => (i.BidangPengguna || i.Pemilik || '').toLowerCase() === pemilik.toLowerCase());
  }
  if (namaBarang && namaBarang !== 'Semua') {
    activeList = activeList.filter((i) => i.NamaBarang.toLowerCase() === namaBarang.toLowerCase());
  }

  res.json({ data: activeList });
});

apiRouter.get('/withdrawals', (req: Request, res: Response) => {
  const db = dbInstance.getSnapshot();
  const { pemilik, namaBarang, alasan, search } = req.query as Record<string, string>;

  let list = db.DATA_PENARIKAN;

  if (pemilik && pemilik !== 'Semua') {
    list = list.filter((w) => (w.BidangPengguna || w.Pemilik || '').toLowerCase() === pemilik.toLowerCase());
  }
  if (namaBarang && namaBarang !== 'Semua') {
    list = list.filter((w) => w.NamaBarang.toLowerCase() === namaBarang.toLowerCase());
  }
  if (alasan && alasan !== 'Semua') {
    list = list.filter((w) => w.AlasanPenarikan.toLowerCase().includes(alasan.toLowerCase()));
  }
  if (search) {
    const s = search.toLowerCase();
    list = list.filter(
      (w) =>
        w.AssetNumber.toLowerCase().includes(s) ||
        w.NamaBarang.toLowerCase().includes(s) ||
        w.NomorSerial.toLowerCase().includes(s) ||
        (w.BidangPengadaan || '').toLowerCase().includes(s) ||
        (w.BidangPengguna || w.Pemilik || '').toLowerCase().includes(s) ||
        w.LokasiTerakhir.toLowerCase().includes(s) ||
        w.AlasanPenarikan.toLowerCase().includes(s) ||
        w.DitarikOleh.toLowerCase().includes(s)
    );
  }

  // Attach photos
  const enriched = list.map((item) => {
    const photos = db.FOTO_INVENTARIS.filter((p) => p.AssetID === item.AssetID);
    return {
      ...item,
      photos,
    };
  });

  res.json({ data: enriched, total: enriched.length });
});

apiRouter.post('/withdrawals', (req: Request, res: Response) => {
  const { assetId, tanggalPenarikan, alasanPenarikan, catatan, ditarikOleh } = req.body;

  if (!assetId || !tanggalPenarikan || !alasanPenarikan) {
    return res.status(400).json({ error: 'AssetID, Tanggal Penarikan, dan Alasan Penarikan wajib diisi.' });
  }

  const db = dbInstance.getSnapshot();

  // 1. Concurrency guard: Validate asset exists and is strictly Aktif
  const asset = db.DATA_INVENTARIS.find((i) => i.AssetID === assetId);
  if (!asset) {
    return res.status(404).json({ error: 'Aset tidak ditemukan dalam database.' });
  }
  if (asset.StatusAset === 'Ditarik') {
    return res.status(409).json({ error: `Aset ${asset.AssetNumber} sudah pernah ditarik sebelumnya. Operasi dibatalkan.` });
  }

  const currentUser = ditarikOleh || db.CONFIG.currentUser || 'Admin Aset';
  const nowIso = new Date().toISOString();

  // 2. Create withdrawal transaction
  const withdrawalRecord: DataPenarikan = {
    WithdrawalID: `WTD-${Date.now().toString().slice(-6)}`,
    AssetID: asset.AssetID,
    AssetNumber: asset.AssetNumber,
    NamaBarang: asset.NamaBarang,
    JenisBarang: asset.JenisBarang,
    DetailSpesifikasi: asset.DetailSpesifikasi,
    NomorSerial: asset.NomorSerial,
    BidangPengadaan: asset.BidangPengadaan,
    BidangPengguna: asset.BidangPengguna || asset.Pemilik,
    Pemilik: asset.BidangPengguna || asset.Pemilik,
    TanggalPerolehan: asset.TanggalPerolehan,
    Kondisi: asset.Kondisi,
    LokasiTerakhir: asset.Lokasi,
    TanggalPenarikan: tanggalPenarikan,
    AlasanPenarikan: alasanPenarikan.trim(),
    Catatan: (catatan || '').trim(),
    DitarikOleh: currentUser,
    CreatedAt: nowIso,
  };

  // 3. Atomically update asset status to 'Ditarik' (preserves record, hides from active monitoring)
  asset.StatusAset = 'Ditarik';
  asset.UpdatedAt = nowIso;

  // 4. Update BAST record status to 'Ditarik' (preserves full BAST history)
  const bastRecord = db.DATA_BAST.find((b) => b.AssetID === assetId);
  if (bastRecord) {
    bastRecord.Status = 'Ditarik';
    bastRecord.UpdatedAt = nowIso;
    bastRecord.UpdatedBy = currentUser;
  }

  // 5. Append withdrawal record
  db.DATA_PENARIKAN.unshift(withdrawalRecord);
  dbInstance.save();

  // 6. Log activity
  dbInstance.log(
    'Penarikan Aset',
    'DATA_PENARIKAN',
    withdrawalRecord.WithdrawalID,
    `Penarikan aset ${asset.AssetNumber} (${asset.NamaBarang}) alasan: ${alasanPenarikan}`
  );

  res.status(201).json({
    success: true,
    message: `Aset ${asset.AssetNumber} berhasil ditarik dan dipindahkan ke Daftar Penarikan.`,
    data: withdrawalRecord,
  });
});

// ----------------- FITUR 5: RESTORE ASET (KHUSUS SUPER ADMIN) -----------------
apiRouter.post('/withdrawals/:id/restore', requireSuperAdmin, (req: Request, res: Response) => {
  const { id } = req.params;
  const { reason } = req.body;

  if (!reason || typeof reason !== 'string' || !reason.trim()) {
    return res.status(400).json({
      error: 'Alasan restore wajib diisi untuk keperluan jejak audit administratif yang sah.',
    });
  }

  const db = dbInstance.getSnapshot();

  // 1. Locate withdrawal record by WithdrawalID or AssetID
  const withdrawal = db.DATA_PENARIKAN.find(
    (w) => w.WithdrawalID === id || w.AssetID === id
  );

  if (!withdrawal) {
    return res.status(404).json({
      error: `Catatan penarikan dengan ID "${id}" tidak ditemukan dalam sistem.`,
    });
  }

  // 2. Prevent duplicate restore
  if (withdrawal.StatusPenarikan === 'Direstore') {
    return res.status(409).json({
      error: `Aset ${withdrawal.AssetNumber} sudah pernah direstore sebelumnya pada ${withdrawal.RestoredAt} oleh ${withdrawal.RestoredBy || 'Super Admin'}.`,
    });
  }

  // 3. Locate corresponding asset in DATA_INVENTARIS
  const asset = db.DATA_INVENTARIS.find((i) => i.AssetID === withdrawal.AssetID);
  if (!asset) {
    return res.status(404).json({
      error: `Data master inventaris untuk aset ${withdrawal.AssetNumber} tidak ditemukan.`,
    });
  }

  if (asset.StatusAset === 'Aktif') {
    return res.status(409).json({
      error: `Aset ${withdrawal.AssetNumber} saat ini sudah berstatus Aktif di sistem inventaris.`,
    });
  }

  const currentUser = (req as any).user?.username || 'AM-LSM2026';
  const nowIso = new Date().toISOString();
  const prevStatus = asset.StatusAset;

  // 4. Atomic update: Re-activate asset in DATA_INVENTARIS
  asset.StatusAset = 'Aktif';
  asset.UpdatedAt = nowIso;

  // 5. Update BAST record status if present
  const bastRecord = db.DATA_BAST.find((b) => b.AssetID === withdrawal.AssetID);
  if (bastRecord) {
    bastRecord.Status = 'Aktif';
    bastRecord.UpdatedAt = nowIso;
    bastRecord.UpdatedBy = currentUser;
  }

  // 6. Update withdrawal record: mark as Direstore, record timestamp, operator, and mandatory reason
  withdrawal.StatusPenarikan = 'Direstore';
  withdrawal.RestoredAt = nowIso;
  withdrawal.RestoredBy = currentUser;
  withdrawal.RestoreReason = reason.trim();

  // 7. Persist atomically to disk
  dbInstance.save();

  // 8. Record audit log in LOG_AKTIVITAS
  dbInstance.log(
    'Restore Aset',
    'DATA_PENARIKAN',
    withdrawal.WithdrawalID,
    `Restore aset ${withdrawal.AssetNumber} (${withdrawal.NamaBarang}) kembali ke status Aktif oleh Super Admin (${currentUser}). Alasan: ${reason.trim()} [Status: ${prevStatus} -> Aktif]`
  );

  // 9. Broadcast realtime update
  realtimeHub.broadcast({
    type: 'withdrawal:restored',
    entity: 'DATA_PENARIKAN',
    action: 'RESTORE_ASSET',
    id: withdrawal.WithdrawalID,
    timestamp: nowIso,
  });

  return res.json({
    success: true,
    message: `Aset ${withdrawal.AssetNumber} (${withdrawal.NamaBarang}) berhasil dikembalikan ke status Aktif dan kembali muncul di Monitoring Inventaris.`,
    data: withdrawal,
  });
});

// ----------------- AUDIT LOGS -----------------
apiRouter.get('/logs', (req: Request, res: Response) => {
  const db = dbInstance.getSnapshot();
  res.json({ data: db.LOG_AKTIVITAS.slice(0, 200) });
});

// ----------------- EXCEL EXPORT ROUTES -----------------
apiRouter.get('/export/bast', async (req: Request, res: Response) => {
  const db = dbInstance.getSnapshot();
  const { bidang, year, bastNo, search, status } = req.query as Record<string, string>;

  let list = db.DATA_BAST;
  if (bidang && bidang !== 'Semua') {
    list = list.filter((b) => (b.BidangPengadaan || b.Bidang || '').toLowerCase() === bidang.toLowerCase() || (b.BidangPengguna || '').toLowerCase() === bidang.toLowerCase());
  }
  if (year && year !== 'Semua') list = list.filter((b) => b.Tahun === parseInt(year, 10));
  if (bastNo) list = list.filter((b) => b.BASTNo.toLowerCase().includes(bastNo.toLowerCase()));
  if (status && status !== 'Semua') list = list.filter((b) => b.Status.toLowerCase() === status.toLowerCase());
  if (search) {
    const s = search.toLowerCase();
    list = list.filter((b) => b.BASTNo.toLowerCase().includes(s) || b.NamaBarang.toLowerCase().includes(s) || b.AssetNumber.toLowerCase().includes(s) || b.NomorSerial.toLowerCase().includes(s));
  }

  const originUrl = `${req.protocol}://${req.get('host')}`;
  const buffer = await exportDaftarBast(list, db.FOTO_INVENTARIS, originUrl);

  const timestamp = new Date().toISOString().slice(0, 10);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="Daftar_BAST_${timestamp}.xlsx"`);
  res.send(buffer);
});

apiRouter.get('/export/inventory', async (req: Request, res: Response) => {
  const db = dbInstance.getSnapshot();
  const { pemilik, bidangPengadaan, bidangPengguna, namaBarang, kondisi, lokasi, search, isFormPemeriksaan } = req.query as Record<string, string>;

  let list = db.DATA_INVENTARIS.filter((i) => i.StatusAset === 'Aktif');
  if (bidangPengadaan && bidangPengadaan !== 'Semua') list = list.filter((i) => (i.BidangPengadaan || i.Pemilik || '').toLowerCase() === bidangPengadaan.toLowerCase());
  if (bidangPengguna && bidangPengguna !== 'Semua') list = list.filter((i) => (i.BidangPengguna || i.Pemilik || '').toLowerCase() === bidangPengguna.toLowerCase());
  if (pemilik && pemilik !== 'Semua') list = list.filter((i) => (i.BidangPengguna || i.Pemilik || '').toLowerCase() === pemilik.toLowerCase());
  if (namaBarang && namaBarang !== 'Semua') list = list.filter((i) => i.NamaBarang.toLowerCase() === namaBarang.toLowerCase());
  if (kondisi && kondisi !== 'Semua') list = list.filter((i) => i.Kondisi.toLowerCase() === kondisi.toLowerCase());
  if (lokasi && lokasi !== 'Semua') list = list.filter((i) => i.Lokasi.toLowerCase() === lokasi.toLowerCase());
  if (search) {
    const s = search.toLowerCase();
    list = list.filter((i) => i.AssetNumber.toLowerCase().includes(s) || i.NamaBarang.toLowerCase().includes(s) || i.NomorSerial.toLowerCase().includes(s));
  }

  const originUrl = `${req.protocol}://${req.get('host')}`;
  const isForm = isFormPemeriksaan === 'true' || isFormPemeriksaan === '1';
  const buffer = await exportDaftarInventaris(list, db.FOTO_INVENTARIS, originUrl, isForm);

  const timestamp = new Date().toISOString().slice(0, 10);
  const fileName = isForm ? `Form_Pemeriksaan_Aset_${timestamp}.xlsx` : `Daftar_Inventaris_${timestamp}.xlsx`;

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
  res.send(buffer);
});

apiRouter.get('/export/withdrawals', async (req: Request, res: Response) => {
  const db = dbInstance.getSnapshot();
  const { pemilik, bidangPengadaan, bidangPengguna, namaBarang, alasan, search } = req.query as Record<string, string>;

  let list = db.DATA_PENARIKAN;
  if (bidangPengadaan && bidangPengadaan !== 'Semua') list = list.filter((w) => (w.BidangPengadaan || w.Pemilik || '').toLowerCase() === bidangPengadaan.toLowerCase());
  if (bidangPengguna && bidangPengguna !== 'Semua') list = list.filter((w) => (w.BidangPengguna || w.Pemilik || '').toLowerCase() === bidangPengguna.toLowerCase());
  if (pemilik && pemilik !== 'Semua') list = list.filter((w) => (w.BidangPengguna || w.Pemilik || '').toLowerCase() === pemilik.toLowerCase());
  if (namaBarang && namaBarang !== 'Semua') list = list.filter((w) => w.NamaBarang.toLowerCase() === namaBarang.toLowerCase());
  if (alasan && alasan !== 'Semua') list = list.filter((w) => w.AlasanPenarikan.toLowerCase().includes(alasan.toLowerCase()));
  if (search) {
    const s = search.toLowerCase();
    list = list.filter((w) => w.AssetNumber.toLowerCase().includes(s) || w.NamaBarang.toLowerCase().includes(s) || w.NomorSerial.toLowerCase().includes(s));
  }

  const originUrl = `${req.protocol}://${req.get('host')}`;
  const buffer = await exportDaftarPenarikan(list, db.FOTO_INVENTARIS, originUrl);

  const timestamp = new Date().toISOString().slice(0, 10);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="Daftar_Penarikan_Aset_${timestamp}.xlsx"`);
  res.send(buffer);
});

// ----------------- FITUR 7: BAST OFFICIAL PDF GENERATION -----------------
apiRouter.get('/bast/pdf', async (req: Request, res: Response) => {
  const bastNo = req.query.bastNo as string;
  const preview = req.query.preview === 'true';

  if (!bastNo || !bastNo.trim()) {
    return res.status(400).json({ error: 'Parameter nomor BAST (bastNo) wajib disertakan.' });
  }

  const db = dbInstance.getSnapshot();
  const cleanBastNo = bastNo.trim();

  // Strict exact matching on BASTNo to group all items belonging to this BAST
  const records = db.DATA_BAST.filter((b) => b.BASTNo.trim() === cleanBastNo);

  if (records.length === 0) {
    return res.status(404).json({
      error: `Dokumen BAST dengan nomor "${cleanBastNo}" tidak ditemukan dalam database.`,
    });
  }

  try {
    const pdfBuffer = await generateBastPdf(cleanBastNo, records, db.PARAMETER);
    const safeName = cleanBastNo.replace(/[^a-zA-Z0-9]/g, '_');
    const fileName = `BAST_${safeName}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `${preview ? 'inline' : 'attachment'}; filename="${fileName}"`
    );
    res.setHeader('Content-Length', pdfBuffer.length);

    dbInstance.log(
      'Unduh PDF BAST',
      'DATA_BAST',
      cleanBastNo,
      `Membuat & mengunduh dokumen resmi PDF BAST ${cleanBastNo} (${records.length} item barang)`
    );

    res.end(pdfBuffer);
  } catch (err: any) {
    console.error('Error generating BAST PDF:', err);
    res.status(500).json({
      error: `Gagal membuat dokumen PDF BAST: ${err.message || 'Terjadi kesalahan internal'}`,
    });
  }
});

