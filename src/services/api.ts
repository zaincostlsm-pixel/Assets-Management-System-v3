import {
  BastRecord,
  DataInventaris,
  DataPenarikan,
  FotoInventaris,
  MasterBarang,
  ParameterItem,
  LogAktivitas,
  AppConfig,
  AuthUser,
} from '../types';

// In-memory token storage with session backup for active browser tab lifecycle
let currentAuthToken: string | null = null;
try {
  currentAuthToken = sessionStorage.getItem('assets_token');
} catch {
  // Ignore environments without sessionStorage
}

export function setSessionAuthToken(token: string | null) {
  currentAuthToken = token;
  try {
    if (token) {
      sessionStorage.setItem('assets_token', token);
    } else {
      sessionStorage.removeItem('assets_token');
    }
  } catch {
    // Ignore
  }
}

export function getSessionAuthToken(): string | null {
  if (currentAuthToken) return currentAuthToken;
  try {
    return sessionStorage.getItem('assets_token');
  } catch {
    return null;
  }
}

// Unified fetch helper that automatically attaches HttpOnly credentials and Bearer token
export async function fetchApi(url: string, options: RequestInit = {}): Promise<Response> {
  const headers = new Headers(options.headers || {});
  const token = getSessionAuthToken();
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  return fetch(url, {
    ...options,
    headers,
    credentials: 'include',
  });
}

export const api = {
  // Authentication & Session
  async login(
    username: string,
    password: string
  ): Promise<{ success: boolean; user: AuthUser; token?: string }> {
    const res = await fetchApi('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const json = await res.json();
    if (!res.ok) {
      throw new Error(json.error || 'Login gagal');
    }

    if (json.token) {
      setSessionAuthToken(json.token);
    }

    return json;
  },

  async logout(): Promise<void> {
    try {
      await fetchApi('/api/auth/logout', { method: 'POST' });
    } finally {
      setSessionAuthToken(null);
    }
  },

  async getCurrentUser(): Promise<AuthUser | null> {
    try {
      const res = await fetchApi('/api/auth/me');
      if (!res.ok) {
        setSessionAuthToken(null);
        return null;
      }
      const json = await res.json();
      return json.authenticated ? json.user : null;
    } catch {
      return null;
    }
  },

  // Config
  async getConfig(): Promise<{ config: AppConfig; stats: Record<string, number> }> {
    const res = await fetchApi('/api/config');
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Gagal memuat konfigurasi sistem');
    }
    const json = await res.json();
    return {
      config: json.config,
      stats: json.stats || {},
    };
  },

  async updateConfig(payload: Partial<AppConfig>): Promise<{ success: boolean; config: AppConfig }> {
    const res = await fetchApi('/api/config/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!res.ok) {
      throw new Error(json.error || 'Gagal menyimpan konfigurasi');
    }
    return json;
  },

  async getScriptCode(): Promise<{ code: string }> {
    const res = await fetchApi('/api/config/script-code');
    const json = await res.json();
    return json;
  },

  async testGoogleConnection(url?: string): Promise<{ success: boolean; message: string }> {
    const res = await fetchApi('/api/config/test-google', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Gagal menguji koneksi');
    return data;
  },

  // Parameters
  async getParameters(kategori?: string): Promise<ParameterItem[]> {
    const url = kategori
      ? `/api/parameters?kategori=${encodeURIComponent(kategori)}`
      : '/api/parameters';
    const res = await fetchApi(url);
    if (!res.ok) {
      return [];
    }
    const json = await res.json();
    return json.data || [];
  },

  async addParameter(param: Partial<ParameterItem>): Promise<ParameterItem> {
    const res = await fetchApi('/api/parameters', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(param),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Gagal menambah parameter');
    return json.data;
  },

  async updateParameter(id: string, param: Partial<ParameterItem>): Promise<ParameterItem> {
    const res = await fetchApi(`/api/parameters/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(param),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Gagal memperbarui parameter');
    return json.data;
  },

  async toggleParameterStatus(id: string): Promise<ParameterItem> {
    const res = await fetchApi(`/api/parameters/${id}/toggle`, { method: 'PATCH' });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Gagal mengubah status parameter');
    return json.data;
  },

  // Master Barang
  async getMasterBarang(search?: string, status?: string): Promise<MasterBarang[]> {
    const params = new URLSearchParams();
    if (search) params.append('search', search);
    if (status) params.append('status', status);
    const res = await fetchApi(`/api/master-barang?${params.toString()}`);
    if (!res.ok) {
      return [];
    }
    const json = await res.json();
    return json.data || [];
  },

  async suggestUniqueCode(
    namaBarang: string
  ): Promise<{ code: string; isColliding: boolean; collidingNames: string[] }> {
    const res = await fetchApi('/api/master-barang/suggest-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ namaBarang }),
    });
    return res.json();
  },

  async addMasterBarang(item: Partial<MasterBarang>): Promise<MasterBarang> {
    const res = await fetchApi('/api/master-barang', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(item),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Gagal menambah master barang');
    return json.data;
  },

  async updateMasterBarang(id: string, item: Partial<MasterBarang>): Promise<MasterBarang> {
    const res = await fetchApi(`/api/master-barang/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(item),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Gagal memperbarui master barang');
    return json.data;
  },

  // BAST
  async getAvailableBastNumbers(): Promise<
    Array<{
      bastNo: string;
      bidangPengadaan?: string;
      bidangPengguna?: string;
      bidang: string;
      tanggal: string;
      count: number;
    }>
  > {
    const res = await fetchApi('/api/bast/available-numbers');
    if (!res.ok) {
      return [];
    }
    const json = await res.json();
    return json.data || [];
  },

  async getNextNumbers(
    bidangPengadaan: string,
    bidangPengguna: string,
    tanggal: string,
    uniqueName: string
  ): Promise<{ bastNo: string; seqNumber: number; assetNumber: string; assetSeqNumber: number }> {
    const params = new URLSearchParams({
      bidangPengadaan,
      bidangPengguna,
      bidang: bidangPengadaan,
      tanggal,
      uniqueName,
    });
    const res = await fetchApi(`/api/bast/next-numbers?${params.toString()}`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Gagal memuat preview penomoran');
    }
    return res.json();
  },

  async getBastList(filters: {
    bidang?: string;
    bidangPengadaan?: string;
    bidangPengguna?: string;
    year?: string;
    bastNo?: string;
    search?: string;
    status?: string;
  }): Promise<BastRecord[]> {
    const params = new URLSearchParams();
    if (filters.bidang) params.append('bidang', filters.bidang);
    if (filters.bidangPengadaan) params.append('bidangPengadaan', filters.bidangPengadaan);
    if (filters.bidangPengguna) params.append('bidangPengguna', filters.bidangPengguna);
    if (filters.year) params.append('year', filters.year);
    if (filters.bastNo) params.append('bastNo', filters.bastNo);
    if (filters.search) params.append('search', filters.search);
    if (filters.status) params.append('status', filters.status);
    const res = await fetchApi(`/api/bast?${params.toString()}`);
    if (!res.ok) {
      return [];
    }
    const json = await res.json();
    return json.data || [];
  },

  async saveBastTransaction(payload: any): Promise<any> {
    const res = await fetchApi('/api/bast', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Gagal menyimpan transaksi BAST');
    return json;
  },

  // Inventory
  async getInventory(filters: {
    pemilik?: string;
    bidangPengadaan?: string;
    bidangPengguna?: string;
    namaBarang?: string;
    kondisi?: string;
    lokasi?: string;
    search?: string;
  }): Promise<DataInventaris[]> {
    const params = new URLSearchParams();
    if (filters.pemilik) params.append('pemilik', filters.pemilik);
    if (filters.bidangPengadaan) params.append('bidangPengadaan', filters.bidangPengadaan);
    if (filters.bidangPengguna) params.append('bidangPengguna', filters.bidangPengguna);
    if (filters.namaBarang) params.append('namaBarang', filters.namaBarang);
    if (filters.kondisi) params.append('kondisi', filters.kondisi);
    if (filters.lokasi) params.append('lokasi', filters.lokasi);
    if (filters.search) params.append('search', filters.search);
    const res = await fetchApi(`/api/inventory?${params.toString()}`);
    if (!res.ok) {
      return [];
    }
    const json = await res.json();
    return json.data || [];
  },

  async updateInventory(
    assetId: string,
    payload: Partial<DataInventaris> & { UniqueName?: string }
  ): Promise<{ success: boolean; message: string; data: DataInventaris }> {
    const res = await fetchApi(`/api/inventory/${assetId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Gagal memperbarui data aset');
    return json;
  },

  // Two-way Google Spreadsheet & Backup sync
  async initGoogleSheets(url?: string): Promise<{ success: boolean; message: string }> {
    const res = await fetchApi('/api/sync/init-sheets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || 'Gagal menginisialisasi spreadsheet');
    return json;
  },

  async pushToGoogle(url?: string): Promise<{ success: boolean; message: string; rowsCount: Record<string, number> }> {
    const res = await fetchApi('/api/sync/push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || 'Gagal mengirim data ke Google Spreadsheet');
    return json;
  },

  async pullFromGoogle(url?: string): Promise<{ success: boolean; message: string; rowsCount: Record<string, number> }> {
    const res = await fetchApi('/api/sync/pull', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || 'Gagal menarik data dari Google Spreadsheet');
    return json;
  },

  async getSyncDiff(url?: string): Promise<
    Array<{
      sheetName: string;
      localCount: number;
      remoteCount: number;
      toPushCount: number;
      toPullCount: number;
      conflictCount: number;
    }>
  > {
    const params = new URLSearchParams();
    if (url) params.append('url', url);
    const res = await fetchApi(`/api/sync/diff?${params.toString()}`);
    if (!res.ok) throw new Error('Gagal membaca preview perbedaan');
    const json = await res.json();
    return json.data || [];
  },

  async getBackups(): Promise<
    Array<{
      fileName: string;
      filePath: string;
      timestamp: string;
      sizeBytes: number;
      totalRecords: number;
    }>
  > {
    const res = await fetchApi('/api/sync/backups');
    if (!res.ok) throw new Error('Gagal memuat daftar backup');
    const json = await res.json();
    return json.data || [];
  },

  async createBackup(reason?: string): Promise<{ success: boolean; message: string }> {
    const res = await fetchApi('/api/sync/backups/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || 'Gagal membuat backup');
    return json;
  },

  async restoreBackup(fileName: string): Promise<{ success: boolean; message: string }> {
    const res = await fetchApi('/api/sync/backups/restore', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileName }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || 'Gagal memulihkan backup');
    return json;
  },

  // Photos
  async getPhotos(assetId: string): Promise<FotoInventaris[]> {
    const res = await fetchApi(`/api/photos/${assetId}`);
    if (!res.ok) {
      return [];
    }
    const json = await res.json();
    return json.data || [];
  },

  async addPhoto(
    assetId: string,
    base64: string,
    fileName: string,
    keterangan?: string
  ): Promise<FotoInventaris> {
    const res = await fetchApi('/api/photos/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assetId, base64, fileName, keterangan }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Gagal mengunggah foto');
    return json.data;
  },

  async replaceMainPhoto(
    assetId: string,
    base64: string,
    fileName: string,
    keterangan?: string
  ): Promise<FotoInventaris> {
    const res = await fetchApi('/api/photos/replace-main', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assetId, base64, fileName, keterangan }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Gagal memperbarui foto utama');
    return json.data;
  },

  // Withdrawals
  async getActiveAssetsForWithdrawal(
    pemilik?: string,
    namaBarang?: string
  ): Promise<DataInventaris[]> {
    const params = new URLSearchParams();
    if (pemilik) params.append('pemilik', pemilik);
    if (namaBarang) params.append('namaBarang', namaBarang);
    const res = await fetchApi(`/api/withdrawals/active-assets?${params.toString()}`);
    if (!res.ok) {
      return [];
    }
    const json = await res.json();
    return json.data || [];
  },

  async getWithdrawals(filters: {
    pemilik?: string;
    namaBarang?: string;
    alasan?: string;
    search?: string;
  }): Promise<DataPenarikan[]> {
    const params = new URLSearchParams();
    if (filters.pemilik) params.append('pemilik', filters.pemilik);
    if (filters.namaBarang) params.append('namaBarang', filters.namaBarang);
    if (filters.alasan) params.append('alasan', filters.alasan);
    if (filters.search) params.append('search', filters.search);
    const res = await fetchApi(`/api/withdrawals?${params.toString()}`);
    if (!res.ok) {
      return [];
    }
    const json = await res.json();
    return json.data || [];
  },

  async submitWithdrawal(payload: {
    assetId: string;
    tanggalPenarikan: string;
    alasanPenarikan: string;
    catatan?: string;
    ditarikOleh?: string;
  }): Promise<{ success: boolean; message: string; data: DataPenarikan }> {
    const res = await fetchApi('/api/withdrawals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Gagal memproses penarikan aset');
    return json;
  },

  async restoreWithdrawal(
    id: string,
    reason: string
  ): Promise<{ success: boolean; message: string; data: DataPenarikan }> {
    const res = await fetchApi(`/api/withdrawals/${id}/restore`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Gagal memproses restore aset');
    return json;
  },

  // Logs
  async getLogs(): Promise<LogAktivitas[]> {
    const res = await fetchApi('/api/logs');
    if (!res.ok) {
      return [];
    }
    const json = await res.json();
    return json.data || [];
  },

  // Export helpers with token-aware Blob download
  downloadExport(endpoint: string, params: Record<string, string>, defaultFileName: string) {
    const query = new URLSearchParams(params).toString();
    const url = `${endpoint}?${query}`;
    const token = getSessionAuthToken();

    // In iframe or cross-origin contexts, fetch with Authorization header to ensure file is downloaded
    fetchApi(url)
      .then((res) => {
        if (!res.ok) throw new Error('Gagal mengunduh file ekspor');
        return res.blob();
      })
      .then((blob) => {
        const blobUrl = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = defaultFileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(blobUrl);
      })
      .catch((e) => {
        console.error('Download export fallback error:', e);
        // Fallback standard direct download
        const link = document.createElement('a');
        link.href = url;
        link.download = defaultFileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      });
  },

  // Fitur 7: Unduh & Preview BAST PDF
  getBastPdfUrl(bastNo: string, preview = false): string {
    const params = new URLSearchParams({ bastNo, preview: String(preview) });
    return `/api/bast/pdf?${params.toString()}`;
  },

  downloadBastPdf(bastNo: string) {
    const safeName = bastNo.replace(/[^a-zA-Z0-9]/g, '_');
    const defaultFileName = `BAST_${safeName}.pdf`;
    this.downloadExport('/api/bast/pdf', { bastNo, preview: 'false' }, defaultFileName);
  },
};

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
  });
}
