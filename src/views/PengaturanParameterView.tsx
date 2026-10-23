import React, { useState, useEffect } from 'react';
import {
  SlidersHorizontal,
  Building2,
  Package,
  Hash,
  Settings,
  Cloud,
  History,
  Plus,
  Edit2,
  CheckCircle2,
  XCircle,
  Copy,
  Check,
  AlertTriangle,
  RefreshCw,
  Search,
  ArrowDownToLine,
  ArrowUpFromLine,
  FileSpreadsheet,
  HardDrive,
  RotateCcw,
  Download,
  Database,
  ExternalLink,
  ShieldCheck,
  Zap,
  X,
} from 'lucide-react';
import { ParameterItem, MasterBarang, LogAktivitas, AppConfig } from '../types';
import { api } from '../services/api';

type TabId = 'bidang' | 'master-barang' | 'penomoran' | 'umum' | 'google-sync' | 'log-aktivitas';

export const PengaturanParameterView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabId>('bidang');

  // Data states
  const [parameters, setParameters] = useState<ParameterItem[]>([]);
  const [masterBarangList, setMasterBarangList] = useState<MasterBarang[]>([]);
  const [logs, setLogs] = useState<LogAktivitas[]>([]);
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [scriptCode, setScriptCode] = useState('');
  const [copiedCode, setCopiedCode] = useState(false);
  const [loading, setLoading] = useState(true);

  // Form modals / state for adding or editing
  const [editingParam, setEditingParam] = useState<ParameterItem | null>(null);
  const [showAddParamModal, setShowAddParamModal] = useState(false);
  const [newParamCategory, setNewParamCategory] = useState<'Bidang' | 'Kondisi' | 'AlasanPenarikan' | 'Penomoran' | 'Umum'>('Bidang');
  const [paramKey, setParamKey] = useState('');
  const [paramLabel, setParamLabel] = useState('');
  const [paramKode, setParamKode] = useState('');
  const [paramValue, setParamValue] = useState('');

  // Master Barang form
  const [showAddMasterModal, setShowAddMasterModal] = useState(false);
  const [editingMaster, setEditingMaster] = useState<MasterBarang | null>(null);
  const [mbNama, setMbNama] = useState('');
  const [mbCode, setMbCode] = useState('');
  const [mbJenis, setMbJenis] = useState('');
  const [mbSearch, setMbSearch] = useState('');
  const [mbWarning, setMbWarning] = useState<string | null>(null);

  // Google Config Form
  const [webAppUrl, setWebAppUrl] = useState('');
  const [driveFolderId, setDriveFolderId] = useState('');
  const [spreadsheetId, setSpreadsheetId] = useState('');
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; latency?: number } | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Two-way sync & Backup state
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatusMessage, setSyncStatusMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [diffList, setDiffList] = useState<any[] | null>(null);
  const [isLoadingDiff, setIsLoadingDiff] = useState(false);
  const [backups, setBackups] = useState<any[]>([]);
  const [isLoadingBackups, setIsLoadingBackups] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  // General error banner
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [params, masters, logList, cfgResp, scriptResp] = await Promise.all([
        api.getParameters(),
        api.getMasterBarang(),
        api.getLogs(),
        api.getConfig(),
        api.getScriptCode(),
      ]);
      setParameters(params);
      setMasterBarangList(masters);
      setLogs(logList);
      setConfig(cfgResp.config);
      setWebAppUrl(cfgResp.config.googleSheetWebAppUrl || '');
      setDriveFolderId(cfgResp.config.googleDriveFolderId || '');
      setSpreadsheetId(cfgResp.config.spreadsheetId || '');
      setScriptCode(scriptResp.code || '');
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // Toggle Parameter status
  const handleToggleParam = async (id: string) => {
    try {
      await api.toggleParameterStatus(id);
      loadAll();
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  // Save new or edited Parameter
  const handleSaveParam = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    try {
      if (editingParam) {
        await api.updateParameter(editingParam.ParamID, {
          Label: paramLabel,
          Value: paramValue || paramLabel,
          Kode: paramKode,
        });
        setEditingParam(null);
      } else {
        await api.addParameter({
          Kategori: newParamCategory,
          Key: paramKey.toUpperCase(),
          Label: paramLabel,
          Value: paramValue || paramLabel,
          Kode: paramKode ? paramKode.toUpperCase() : paramKey.toUpperCase(),
        });
        setShowAddParamModal(false);
      }
      setParamKey('');
      setParamLabel('');
      setParamKode('');
      setParamValue('');
      loadAll();
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  // Save Master Barang
  const handleSaveMasterBarang = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    try {
      if (editingMaster) {
        await api.updateMasterBarang(editingMaster.MasterBarangID, {
          NamaBarang: mbNama,
          UniqueName: mbCode,
          JenisBarang: mbJenis,
        });
        setEditingMaster(null);
      } else {
        await api.addMasterBarang({
          NamaBarang: mbNama,
          UniqueName: mbCode,
          JenisBarang: mbJenis,
        });
        setShowAddMasterModal(false);
      }
      setMbNama('');
      setMbCode('');
      setMbJenis('');
      setMbWarning(null);
      loadAll();
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  // Check unique code collision when typing new master barang
  const handleMasterNamaChange = async (val: string) => {
    setMbNama(val);
    setMbWarning(null);
    if (!val.trim()) return;
    try {
      const suggest = await api.suggestUniqueCode(val);
      if (!editingMaster) {
        setMbCode(suggest.code);
      }
      if (suggest.isColliding) {
        setMbWarning(`Kode '${suggest.code}' sudah dipakai oleh '${suggest.collidingNames.join(', ')}'`);
      }
    } catch (e) {
      // ignore
    }
  };

  // Save Google Integration Config
  const handleSaveGoogleConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveSuccess(false);
    setErrorMsg(null);
    try {
      await api.updateConfig({
        googleSheetWebAppUrl: webAppUrl.trim(),
        googleDriveFolderId: driveFolderId.trim(),
        spreadsheetId: spreadsheetId.trim(),
      });
      setSaveSuccess(true);
      loadAll();
      setTimeout(() => setSaveSuccess(false), 4000);
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  // Test Google Web App connection
  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    setErrorMsg(null);
    try {
      const res = await api.testGoogleConnection(webAppUrl.trim());
      setTestResult(res);
      loadAll();
    } catch (err: any) {
      setTestResult({ success: false, message: err.message });
    } finally {
      setIsTesting(false);
    }
  };

  const handleCopyScript = () => {
    navigator.clipboard.writeText(scriptCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 3000);
  };

  useEffect(() => {
    if (activeTab === 'google-sync') {
      loadBackups();
      if (webAppUrl) {
        loadDiff();
      }
    }
  }, [activeTab, webAppUrl]);

  const loadBackups = async () => {
    setIsLoadingBackups(true);
    try {
      const list = await api.getBackups();
      setBackups(list);
    } catch (err: any) {
      console.error('Error loading backups:', err);
    } finally {
      setIsLoadingBackups(false);
    }
  };

  const loadDiff = async () => {
    if (!webAppUrl || !webAppUrl.startsWith('https://script.google.com')) return;
    setIsLoadingDiff(true);
    try {
      const data = await api.getSyncDiff(webAppUrl.trim());
      setDiffList(data);
    } catch (err: any) {
      console.error('Error loading sync diff:', err);
    } finally {
      setIsLoadingDiff(false);
    }
  };

  const handleInitSheets = async () => {
    if (!webAppUrl) {
      setErrorMsg('Harap masukkan URL Google Apps Script Web App terlebih dahulu.');
      return;
    }
    setIsSyncing(true);
    setSyncStatusMessage(null);
    try {
      const res = await api.initGoogleSheets(webAppUrl.trim());
      setSyncStatusMessage({
        type: 'success',
        text: res.message || 'Seluruh 9 sheet database berhasil diinisialisasi pada Google Spreadsheet.',
      });
      loadAll();
      loadDiff();
    } catch (err: any) {
      setSyncStatusMessage({ type: 'error', text: err.message || 'Gagal menginisialisasi spreadsheet.' });
    } finally {
      setIsSyncing(false);
    }
  };

  const handlePushAll = async () => {
    if (!webAppUrl) {
      setErrorMsg('Harap masukkan URL Google Apps Script Web App terlebih dahulu.');
      return;
    }
    setIsSyncing(true);
    setSyncStatusMessage(null);
    try {
      const res = await api.pushToGoogle(webAppUrl.trim());
      setSyncStatusMessage({
        type: 'success',
        text: `${res.message} (BAST: ${res.rowsCount?.DATA_BAST || 0}, Inventaris: ${res.rowsCount?.DATA_INVENTARIS || 0}, Master: ${res.rowsCount?.MASTER_BARANG || 0})`,
      });
      loadAll();
      loadBackups();
      loadDiff();
    } catch (err: any) {
      setSyncStatusMessage({ type: 'error', text: err.message || 'Gagal mengirim data ke Google Spreadsheet.' });
    } finally {
      setIsSyncing(false);
    }
  };

  const handlePullAll = async () => {
    if (!webAppUrl) {
      setErrorMsg('Harap masukkan URL Google Apps Script Web App terlebih dahulu.');
      return;
    }
    if (!window.confirm('PERINGATAN: Menarik data dari Google Spreadsheet akan menyelaraskan database lokal dengan isi Google Spreadsheet. Sistem otomatis membuat backup lokal sebelum proses. Lanjutkan?')) {
      return;
    }
    setIsSyncing(true);
    setSyncStatusMessage(null);
    try {
      const res = await api.pullFromGoogle(webAppUrl.trim());
      setSyncStatusMessage({
        type: 'success',
        text: `${res.message} (Database lokal berhasil diperbarui)`,
      });
      loadAll();
      loadBackups();
      loadDiff();
    } catch (err: any) {
      setSyncStatusMessage({ type: 'error', text: err.message || 'Gagal menarik data dari Google Spreadsheet.' });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleCreateBackup = async () => {
    setIsBackingUp(true);
    try {
      const res = await api.createBackup('Manual Backup Pengguna');
      setSyncStatusMessage({ type: 'success', text: res.message });
      loadBackups();
    } catch (err: any) {
      setSyncStatusMessage({ type: 'error', text: err.message });
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleRestoreBackup = async (fileName: string) => {
    if (!window.confirm(`Apakah Anda yakin ingin memulihkan database dari backup "${fileName}"? Snapshot database saat ini akan dibuat terlebih dahulu.`)) {
      return;
    }
    setIsRestoring(true);
    try {
      const res = await api.restoreBackup(fileName);
      setSyncStatusMessage({ type: 'success', text: res.message });
      loadAll();
      loadBackups();
      loadDiff();
    } catch (err: any) {
      setSyncStatusMessage({ type: 'error', text: err.message });
    } finally {
      setIsRestoring(false);
    }
  };

  // Filtered views
  const bidangParams = parameters.filter((p) => p.Kategori === 'Bidang');
  const penomoranParams = parameters.filter((p) => p.Kategori === 'Penomoran');
  const umumParams = parameters.filter((p) => p.Kategori === 'Kondisi' || p.Kategori === 'AlasanPenarikan' || p.Kategori === 'Umum');
  const filteredMaster = masterBarangList.filter(
    (m) =>
      m.NamaBarang.toLowerCase().includes(mbSearch.toLowerCase()) ||
      m.UniqueName.toLowerCase().includes(mbSearch.toLowerCase()) ||
      m.JenisBarang.toLowerCase().includes(mbSearch.toLowerCase())
  );

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-6xl mx-auto">
      {/* Title Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-200">
        <div>
          <div className="flex items-center space-x-2">
            <div className="p-2 bg-slate-800 text-white rounded-lg">
              <SlidersHorizontal className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-800">Pengaturan Parameter Terpusat</h1>
              <p className="text-xs text-slate-500">
                Kelola master Bidang, Master Barang, aturan penomoran, integrasi Google Spreadsheet & Drive, serta Audit Trail
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={loadAll}
          className="p-2 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-medium flex items-center space-x-1"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Refresh Data</span>
        </button>
      </div>

      {errorMsg && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg flex items-center space-x-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="flex space-x-1 bg-slate-200/80 p-1 rounded-xl overflow-x-auto text-xs font-semibold select-none">
        <button
          onClick={() => setActiveTab('bidang')}
          className={`px-3.5 py-2 rounded-lg flex items-center space-x-1.5 transition-all whitespace-nowrap ${
            activeTab === 'bidang' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>Parameter Bidang ({bidangParams.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('master-barang')}
          className={`px-3.5 py-2 rounded-lg flex items-center space-x-1.5 transition-all whitespace-nowrap ${
            activeTab === 'master-barang' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Package className="w-4 h-4" />
          <span>Master Barang & Unique Name ({masterBarangList.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('penomoran')}
          className={`px-3.5 py-2 rounded-lg flex items-center space-x-1.5 transition-all whitespace-nowrap ${
            activeTab === 'penomoran' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Hash className="w-4 h-4" />
          <span>Parameter Penomoran</span>
        </button>

        <button
          onClick={() => setActiveTab('umum')}
          className={`px-3.5 py-2 rounded-lg flex items-center space-x-1.5 transition-all whitespace-nowrap ${
            activeTab === 'umum' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Settings className="w-4 h-4" />
          <span>Kondisi & Alasan Penarikan</span>
        </button>

        <button
          onClick={() => setActiveTab('google-sync')}
          className={`px-3.5 py-2 rounded-lg flex items-center space-x-1.5 transition-all whitespace-nowrap ${
            activeTab === 'google-sync' ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Cloud className="w-4 h-4" />
          <span>Integrasi Google Sheets & Drive</span>
        </button>

        <button
          onClick={() => setActiveTab('log-aktivitas')}
          className={`px-3.5 py-2 rounded-lg flex items-center space-x-1.5 transition-all whitespace-nowrap ${
            activeTab === 'log-aktivitas' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <History className="w-4 h-4" />
          <span>Log Aktivitas ({logs.length})</span>
        </button>
      </div>

      {/* ================= TAB 1: PARAMETER BIDANG ================= */}
      {activeTab === 'bidang' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-sm font-bold text-slate-800">Daftar Bidang & Kode Departemen</h2>
              <p className="text-xs text-slate-500">
                Kode bidang digunakan oleh sistem untuk pembentukan formula Nomor BAST dan Nomor Inventaris
              </p>
            </div>
            <button
              onClick={() => {
                setNewParamCategory('Bidang');
                setParamKey('');
                setParamLabel('');
                setParamKode('');
                setParamValue('');
                setShowAddParamModal(true);
              }}
              className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold flex items-center space-x-1 shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>+ Tambah Bidang Baru</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">Kode Bidang</th>
                  <th className="py-2.5 px-3">Nama Bidang</th>
                  <th className="py-2.5 px-3">Deskripsi Lengkap</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                  <th className="py-2.5 px-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {bidangParams.map((item) => (
                  <tr key={item.ParamID} className="hover:bg-slate-50">
                    <td className="py-2.5 px-3 font-mono font-bold text-blue-700">{item.Kode || item.Key}</td>
                    <td className="py-2.5 px-3 font-semibold text-slate-800">{item.Label}</td>
                    <td className="py-2.5 px-3 text-slate-600">{item.Value}</td>
                    <td className="py-2.5 px-3 text-center">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          item.Status === 'Aktif' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {item.Status}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right space-x-2">
                      <button
                        onClick={() => {
                          setEditingParam(item);
                          setParamLabel(item.Label);
                          setParamKode(item.Kode || item.Key);
                          setParamValue(item.Value);
                        }}
                        className="text-blue-600 hover:underline"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleToggleParam(item.ParamID)}
                        className={`text-xs hover:underline ${item.Status === 'Aktif' ? 'text-rose-600' : 'text-emerald-600'}`}
                        title="Nonaktifkan bidang tanpa merusak data historis"
                      >
                        {item.Status === 'Aktif' ? 'Nonaktifkan' : 'Aktifkan'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ================= TAB 2: MASTER BARANG & UNIQUE NAME ================= */}
      {activeTab === 'master-barang' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-sm font-bold text-slate-800">Master Nama Barang & Unique Name</h2>
              <p className="text-xs text-slate-500">
                Kamus kode singkat barang untuk mencegah duplikasi nama dan kode bentrok pada Nomor Inventaris
              </p>
            </div>
            <button
              onClick={() => {
                setMbNama('');
                setMbCode('');
                setMbJenis('');
                setMbWarning(null);
                setShowAddMasterModal(true);
              }}
              className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold flex items-center space-x-1 shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>+ Tambah Master Barang</span>
            </button>
          </div>

          <div className="relative max-w-sm">
            <input
              type="text"
              value={mbSearch}
              onChange={(e) => setMbSearch(e.target.value)}
              placeholder="Cari nama barang atau kode unik..."
              className="w-full text-xs pl-8 pr-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">Nama Barang</th>
                  <th className="py-2.5 px-3">Unique Name / Kode Singkat</th>
                  <th className="py-2.5 px-3">Jenis Barang</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                  <th className="py-2.5 px-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredMaster.map((m) => (
                  <tr key={m.MasterBarangID} className="hover:bg-slate-50">
                    <td className="py-2.5 px-3 font-semibold text-slate-800">{m.NamaBarang}</td>
                    <td className="py-2.5 px-3">
                      <span className="font-mono text-xs px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-bold border border-blue-200">
                        {m.UniqueName}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-600">{m.JenisBarang}</td>
                    <td className="py-2.5 px-3 text-center">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          m.Status === 'Aktif' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {m.Status}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right space-x-2">
                      <button
                        onClick={() => {
                          setEditingMaster(m);
                          setMbNama(m.NamaBarang);
                          setMbCode(m.UniqueName);
                          setMbJenis(m.JenisBarang);
                        }}
                        className="text-blue-600 hover:underline"
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ================= TAB 3: PARAMETER PENOMORAN ================= */}
      {activeTab === 'penomoran' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-4">
          <div className="pb-3 border-b border-slate-100">
            <h2 className="text-sm font-bold text-slate-800">Formula & Aturan Penomoran Dokumen</h2>
            <p className="text-xs text-slate-500">
              Pengaturan kode dokumen BAST, format nomor inventaris, dan periode transaksi
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {penomoranParams.map((p) => (
              <div key={p.ParamID} className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700">{p.Label}</span>
                  <div className="flex items-center space-x-2">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-semibold">
                      {p.Key}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingParam(p);
                        setParamLabel(p.Label);
                        setParamKode(p.Kode || p.Key);
                        setParamValue(p.Value);
                      }}
                      className="text-xs text-blue-600 hover:underline font-semibold"
                    >
                      Edit
                    </button>
                  </div>
                </div>
                <div className="font-mono text-sm font-bold text-slate-900 bg-white p-2 rounded border border-slate-200">
                  {p.Value}
                </div>
                <p className="text-[11px] text-slate-500">{p.Keterangan || 'Aturan baku aplikasi'}</p>
              </div>
            ))}
          </div>

          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-2 text-xs text-blue-900">
            <div className="font-bold flex items-center space-x-1.5">
              <span>Penjelasan Rumus Penomoran:</span>
            </div>
            <ul className="list-disc list-inside space-y-1 text-[11px] text-blue-800">
              <li>
                <strong>Nomor BAST:</strong> <code className="bg-blue-100 px-1 py-0.5 rounded font-mono">004/BSTA/PPIC/X/2026</code> (Nomor Urut 3 Digit / Kode Dokumen / Bidang / Bulan Romawi / Tahun)
              </li>
              <li>
                <strong>Nomor Inventaris:</strong> <code className="bg-blue-100 px-1 py-0.5 rounded font-mono">001.TBG.1026.PPIC</code> (Nomor Urut per UNIQUE_NAME / Unique Name Barang / Bulan & Tahun MMYY / Bidang)
              </li>
              <li>
                Pembuatan nomor inventaris memiliki urutan sequence terpisah berdasarkan masing-masing UNIQUE_NAME dengan reservasi aman agar nomor urut tidak bertabrakan saat diakses bersamaan.
              </li>
            </ul>
          </div>
        </div>
      )}

      {/* ================= TAB 4: PENGATURAN UMUM ================= */}
      {activeTab === 'umum' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-6">
          <div>
            <h2 className="text-sm font-bold text-slate-800">Daftar Kondisi Aset & Alasan Penarikan</h2>
            <p className="text-xs text-slate-500">
              Parameter standar pilihan kondisi inventaris dan kategori alasan penarikan aset
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Kondisi Aset */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                Daftar Kondisi Aset
              </h3>
              <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 overflow-hidden">
                {parameters.filter((p) => p.Kategori === 'Kondisi').map((k) => (
                  <div key={k.ParamID} className="p-3 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-semibold text-slate-800">{k.Label}</span>
                      <span className="text-[10px] text-slate-400 block">Nilai Database: {k.Key}</span>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                      Aktif
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Alasan Penarikan */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                Kategori Alasan Penarikan
              </h3>
              <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 overflow-hidden">
                {parameters.filter((p) => p.Kategori === 'AlasanPenarikan').map((a) => (
                  <div key={a.ParamID} className="p-3 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-semibold text-slate-800">{a.Label}</span>
                      <span className="text-[10px] text-slate-400 block">{a.Value}</span>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800">
                      Aktif
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= TAB 5: SINKRONISASI & DATABASE GOOGLE SPREADSHEET ================= */}
      {activeTab === 'google-sync' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-6">
          {/* Header & Status */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <div className="flex items-center space-x-2">
                <Cloud className="w-5 h-5 text-emerald-600" />
                <h2 className="text-sm font-bold text-slate-800">
                  Database Terpusat Google Spreadsheet & Sinkronisasi Dua Arah
                </h2>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Pengelolaan Google Spreadsheet sebagai database utama, Google Drive untuk foto, sinkronisasi dua arah (Push/Pull), dan snapshot backup
              </p>
            </div>

            <div className="flex items-center space-x-2">
              <span
                className={`px-3 py-1 rounded-md text-xs font-semibold flex items-center space-x-1.5 ${
                  config?.isConnectedToGoogle
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                    : 'bg-amber-100 text-amber-800 border border-amber-300'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${config?.isConnectedToGoogle ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
                <span>{config?.isConnectedToGoogle ? 'Terhubung ke Google Web App' : 'Offline / Standalone Database'}</span>
              </span>
            </div>
          </div>

          {/* Sync Status Feedback Banner */}
          {syncStatusMessage && (
            <div
              className={`p-3 rounded-lg text-xs border flex items-center justify-between ${
                syncStatusMessage.type === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : syncStatusMessage.type === 'error'
                  ? 'bg-rose-50 border-rose-200 text-rose-800'
                  : 'bg-blue-50 border-blue-200 text-blue-800'
              }`}
            >
              <div className="flex items-center space-x-2">
                {syncStatusMessage.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                )}
                <span>{syncStatusMessage.text}</span>
              </div>
              <button
                onClick={() => setSyncStatusMessage(null)}
                className="text-slate-400 hover:text-slate-700 p-0.5 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* SECTION 1: Konfigurasi Google Apps Script */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold text-slate-800 flex items-center space-x-1.5">
                  <Settings className="w-4 h-4 text-slate-600" />
                  <span>1. Pengaturan Koneksi Google Apps Script & Drive</span>
                </h3>
                <p className="text-[11px] text-slate-500">
                  Masukkan URL Web App hasil deploy Apps Script untuk mengaktifkan sinkronisasi otomatis
                </p>
              </div>
            </div>

            <form onSubmit={handleSaveGoogleConfig} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  URL Google Apps Script Web App (Deployment Exec URL) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="url"
                  value={webAppUrl}
                  onChange={(e) => setWebAppUrl(e.target.value)}
                  placeholder="https://script.google.com/macros/s/.../exec"
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-md font-mono focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  required
                />
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Dihasilkan saat Anda mempublikasikan Apps Script sebagai Web App (Akses: <em>Anyone / Siapa Saja</em>)
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Folder ID Google Drive (Penyimpanan Foto)
                  </label>
                  <input
                    type="text"
                    value={driveFolderId}
                    onChange={(e) => setDriveFolderId(e.target.value)}
                    placeholder="ID folder Google Drive (contoh: 1a2B3c4D...)"
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-md font-mono focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    Opsional. Jika kosong, script otomatis membuat folder "BAST_Foto_Aset".
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Spreadsheet ID Google
                  </label>
                  <input
                    type="text"
                    value={spreadsheetId}
                    onChange={(e) => setSpreadsheetId(e.target.value)}
                    placeholder="ID Google Sheets (tertera pada URL browser)"
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-md font-mono focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    Contoh: 1BxiMVs0XR-v_8uN0...
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-1">
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer"
                >
                  Simpan Konfigurasi
                </button>
                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={isTesting || !webAppUrl}
                  className="inline-flex items-center space-x-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-900 disabled:opacity-50 text-white rounded-lg text-xs font-semibold transition-all cursor-pointer"
                >
                  {isTesting ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Menguji Koneksi...</span>
                    </>
                  ) : (
                    <>
                      <Zap className="w-3.5 h-3.5 text-amber-400" />
                      <span>Tes Koneksi Web App</span>
                    </>
                  )}
                </button>
              </div>

              {saveSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-md">
                  Konfigurasi integrasi Google berhasil diperbarui dan disimpan.
                </div>
              )}

              {testResult && (
                <div
                  className={`p-3 rounded-md text-xs border flex items-center justify-between ${
                    testResult.success
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                      : 'bg-rose-50 border-rose-200 text-rose-800'
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    {testResult.success ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                    )}
                    <span>{testResult.message}</span>
                  </div>
                  {testResult.latency !== undefined && (
                    <span className="font-mono text-[10px] bg-white px-2 py-0.5 rounded border border-emerald-200">
                      {testResult.latency} ms
                    </span>
                  )}
                </div>
              )}
            </form>
          </div>

          {/* SECTION 2: Inisialisasi & Sinkronisasi Dua Arah */}
          <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-4">
            <div>
              <h3 className="text-xs font-bold text-slate-800 flex items-center space-x-1.5">
                <FileSpreadsheet className="w-4 h-4 text-blue-600" />
                <span>2. Sinkronisasi Dua Arah (Two-Way Sync) & Inisialisasi Sheet</span>
              </h3>
              <p className="text-[11px] text-slate-500">
                Inisialisasi 9 sheet schema database terpusat dan sinkronkan data antara server aplikasi dan Google Spreadsheet
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Init Sheets */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-2 flex flex-col justify-between">
                <div>
                  <div className="flex items-center space-x-1.5 text-xs font-bold text-slate-800">
                    <Database className="w-4 h-4 text-indigo-600" />
                    <span>Inisialisasi 9 Sheet</span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Membuat header otomatis untuk DATA_BAST, BRIDGE_RECORD, PARAMETER, MASTER_BARANG, DATA_INVENTARIS, DATA_PENARIKAN, FOTO_INVENTARIS, LOG_AKTIVITAS, dan CONFIG.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleInitSheets}
                  disabled={isSyncing || !webAppUrl}
                  className="w-full inline-flex items-center justify-center space-x-1 px-3 py-2 bg-indigo-50 hover:bg-indigo-100 disabled:opacity-50 text-indigo-800 border border-indigo-200 rounded-md text-xs font-semibold transition-colors cursor-pointer"
                >
                  <span>Inisialisasi Spreadsheet</span>
                </button>
              </div>

              {/* Push All */}
              <div className="p-3.5 bg-emerald-50/60 border border-emerald-200 rounded-lg space-y-2 flex flex-col justify-between">
                <div>
                  <div className="flex items-center space-x-1.5 text-xs font-bold text-emerald-900">
                    <ArrowUpFromLine className="w-4 h-4 text-emerald-700" />
                    <span>Push ke Google Sheets</span>
                  </div>
                  <p className="text-[11px] text-slate-600 mt-1">
                    Mengirim seluruh data transaksi lokal ke Google Spreadsheet. Otomatis membuat backup lokal sebelum proses pengiriman.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handlePushAll}
                  disabled={isSyncing || !webAppUrl}
                  className="w-full inline-flex items-center justify-center space-x-1 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-md text-xs font-bold shadow-2xs transition-colors cursor-pointer"
                >
                  <ArrowUpFromLine className="w-3.5 h-3.5" />
                  <span>{isSyncing ? 'Memproses Push...' : 'Push Data ke Sheets'}</span>
                </button>
              </div>

              {/* Pull All */}
              <div className="p-3.5 bg-blue-50/60 border border-blue-200 rounded-lg space-y-2 flex flex-col justify-between">
                <div>
                  <div className="flex items-center space-x-1.5 text-xs font-bold text-blue-900">
                    <ArrowDownToLine className="w-4 h-4 text-blue-700" />
                    <span>Pull dari Google Sheets</span>
                  </div>
                  <p className="text-[11px] text-slate-600 mt-1">
                    Menarik seluruh record dari Google Spreadsheet ke aplikasi lokal. Otomatis membuat backup lokal sebelum proses penarikan.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handlePullAll}
                  disabled={isSyncing || !webAppUrl}
                  className="w-full inline-flex items-center justify-center space-x-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-md text-xs font-bold shadow-2xs transition-colors cursor-pointer"
                >
                  <ArrowDownToLine className="w-3.5 h-3.5" />
                  <span>{isSyncing ? 'Memproses Pull...' : 'Pull Data dari Sheets'}</span>
                </button>
              </div>
            </div>

            {/* Pratinjau Perbedaan Data (Diff Preview) */}
            <div className="pt-2">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-700">Pratinjau Perbedaan Data (Local Database vs Google Spreadsheet)</span>
                <button
                  type="button"
                  onClick={loadDiff}
                  disabled={isLoadingDiff || !webAppUrl}
                  className="inline-flex items-center space-x-1 text-xs text-blue-600 hover:text-blue-800 cursor-pointer"
                >
                  <RefreshCw className={`w-3 h-3 ${isLoadingDiff ? 'animate-spin' : ''}`} />
                  <span>Cek Ulang Diff</span>
                </button>
              </div>

              {diffList && diffList.length > 0 ? (
                <div className="overflow-x-auto border border-slate-200 rounded-lg">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                      <tr>
                        <th className="py-2 px-3">Nama Sheet (Tabel)</th>
                        <th className="py-2 px-3 text-center">Record Lokal</th>
                        <th className="py-2 px-3 text-center">Record Google Sheets</th>
                        <th className="py-2 px-3 text-center">Siap Di-Push</th>
                        <th className="py-2 px-3 text-center">Siap Di-Pull</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {diffList.map((d) => (
                        <tr key={d.sheetName} className="hover:bg-slate-50">
                          <td className="py-2 px-3 font-mono font-semibold text-slate-800">{d.sheetName}</td>
                          <td className="py-2 px-3 text-center font-semibold text-slate-700">{d.localCount}</td>
                          <td className="py-2 px-3 text-center font-semibold text-emerald-700">{d.remoteCount}</td>
                          <td className="py-2 px-3 text-center text-slate-500 font-mono text-[11px]">{d.toPushCount}</td>
                          <td className="py-2 px-3 text-center text-slate-500 font-mono text-[11px]">{d.toPullCount}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-center text-slate-400 text-xs">
                  {isLoadingDiff ? 'Memeriksa perbedaan data dengan Google Spreadsheet...' : 'Tekan "Cek Ulang Diff" untuk melihat perbandingan record lokal dan Google Sheets.'}
                </div>
              )}
            </div>
          </div>

          {/* SECTION 3: Manajemen Backup & Restore Database */}
          <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-xs font-bold text-slate-800 flex items-center space-x-1.5">
                  <HardDrive className="w-4 h-4 text-emerald-600" />
                  <span>3. Snapshot Backup & Pemulihan (Restore) Database</span>
                </h3>
                <p className="text-[11px] text-slate-500">
                  Cadangkan data secara instan sebelum melakukan sinkronisasi besar atau pulihkan ke versi terdahulu
                </p>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={handleCreateBackup}
                  disabled={isBackingUp}
                  className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-md text-xs font-semibold transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{isBackingUp ? 'Membuat Snapshot...' : 'Buat Backup Sekarang'}</span>
                </button>
                <button
                  type="button"
                  onClick={loadBackups}
                  disabled={isLoadingBackups}
                  className="p-1.5 border border-slate-300 hover:bg-slate-50 rounded-md text-slate-600"
                  title="Refresh Daftar Backup"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoadingBackups ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            {backups.length > 0 ? (
              <div className="overflow-x-auto max-h-56 overflow-y-auto border border-slate-200 rounded-lg">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-slate-100 text-slate-700 font-semibold sticky top-0">
                    <tr>
                      <th className="py-2 px-3">Nama File Snapshot</th>
                      <th className="py-2 px-3">Waktu Pembuatan</th>
                      <th className="py-2 px-3 text-center">Ukuran</th>
                      <th className="py-2 px-3 text-center">Total Record</th>
                      <th className="py-2 px-3 text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {backups.map((b) => (
                      <tr key={b.fileName} className="hover:bg-slate-50">
                        <td className="py-2 px-3 font-mono text-[11px] text-slate-800">{b.fileName}</td>
                        <td className="py-2 px-3 text-slate-600 whitespace-nowrap">
                          {new Date(b.timestamp).toLocaleDateString('id-ID', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>
                        <td className="py-2 px-3 text-center text-slate-500 font-mono text-[11px]">
                          {(b.sizeBytes / 1024).toFixed(1)} KB
                        </td>
                        <td className="py-2 px-3 text-center font-semibold text-slate-700">
                          {b.totalRecords}
                        </td>
                        <td className="py-2 px-3 text-center">
                          <div className="flex items-center justify-center space-x-1.5">
                            <a
                              href={`/api/sync/backups/download/${encodeURIComponent(b.fileName)}`}
                              download={b.fileName}
                              className="p-1 hover:bg-slate-200 text-slate-700 rounded"
                              title="Unduh File Backup JSON"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </a>
                            <button
                              type="button"
                              onClick={() => handleRestoreBackup(b.fileName)}
                              disabled={isRestoring}
                              className="px-2 py-0.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded text-[10px] font-semibold transition-colors cursor-pointer"
                              title="Pulihkan database dari snapshot ini"
                            >
                              Pulihkan
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-center text-slate-400 text-xs">
                Belum ada snapshot backup tersimpan. Tekan "Buat Backup Sekarang" untuk mencadangkan data.
              </div>
            )}
          </div>

          {/* SECTION 4: Setup Guide & 1-Click Code.gs Copy Box */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold text-slate-800 flex items-center space-x-1.5">
                  <Database className="w-4 h-4 text-emerald-600" />
                  <span>4. Kode Script Google Apps Script (Code.gs) & Panduan Setup</span>
                </h3>
                <p className="text-[11px] text-slate-500">
                  Salin skrip berikut ke Google Spreadsheet Anda (Ekstensi &gt; Apps Script)
                </p>
              </div>
              <button
                onClick={handleCopyScript}
                className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-md text-xs font-semibold transition-all cursor-pointer"
              >
                {copiedCode ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Tersalin!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Salin Seluruh Script</span>
                  </>
                )}
              </button>
            </div>

            <pre className="p-3 bg-slate-900 text-emerald-300 rounded-lg text-[11px] font-mono overflow-x-auto max-h-56 leading-relaxed select-all">
              {scriptCode}
            </pre>

            <div className="text-[11px] text-slate-600 space-y-1 bg-white p-3 border border-slate-200 rounded-lg">
              <span className="font-bold text-slate-800">Petunjuk 3 Langkah Menghubungkan Google Spreadsheet:</span>
              <ol className="list-decimal list-inside space-y-0.5 text-slate-500">
                <li>Buka Google Spreadsheet baru di browser, klik menu <strong>Ekstensi &gt; Apps Script</strong>.</li>
                <li>Hapus kode bawaan, tempelkan skrip di atas, lalu klik <strong>Terapkan (Deploy) &gt; Deployment Baru &gt; Jenis: Aplikasi Web</strong>.</li>
                <li>Setel Akses: <em>Siapa saja (Anyone)</em>, klik Terapkan, dan salin URL Web App ke kolom di atas lalu klik <strong>Simpan</strong> dan <strong>Inisialisasi Spreadsheet</strong>.</li>
              </ol>
            </div>
          </div>
        </div>
      )}

      {/* ================= TAB 6: LOG AKTIVITAS (AUDIT TRAIL) ================= */}
      {activeTab === 'log-aktivitas' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-4">
          <div className="pb-3 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-800">Riwayat Log Aktivitas & Jejak Audit (Audit Trail)</h2>
              <p className="text-xs text-slate-500">
                Mencatat seluruh transaksi BAST, penarikan aset, perubahan parameter, dan pergantian foto
              </p>
            </div>
            <span className="text-xs font-semibold text-slate-500">
              Total {logs.length} Riwayat Tercatat
            </span>
          </div>

          <div className="overflow-x-auto max-h-96 overflow-y-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-slate-900 text-white font-semibold sticky top-0">
                <tr>
                  <th className="py-2.5 px-3">Waktu</th>
                  <th className="py-2.5 px-3">Pengguna</th>
                  <th className="py-2.5 px-3">Aktivitas</th>
                  <th className="py-2.5 px-3">Jenis Data</th>
                  <th className="py-2.5 px-3">Ringkasan Perubahan</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {logs.map((log) => (
                  <tr key={log.LogID} className="hover:bg-slate-50">
                    <td className="py-2 px-3 text-slate-600 whitespace-nowrap">
                      {new Date(log.Waktu).toLocaleDateString('id-ID', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="py-2 px-3 font-semibold text-slate-800 whitespace-nowrap">{log.User}</td>
                    <td className="py-2 px-3 font-medium text-blue-700 whitespace-nowrap">{log.Aktivitas}</td>
                    <td className="py-2 px-3 font-mono text-[10px] text-slate-500 whitespace-nowrap">{log.JenisData}</td>
                    <td className="py-2 px-3 text-slate-700 max-w-md truncate" title={log.RingkasanPerubahan}>
                      {log.RingkasanPerubahan}
                    </td>
                    <td className="py-2 px-3 text-center">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                        {log.Status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal Add / Edit Parameter */}
      {(showAddParamModal || editingParam) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full border border-slate-200 p-5 space-y-4">
            <h3 className="text-sm font-bold text-slate-800">
              {editingParam ? 'Ubah Parameter' : `Tambah Parameter ${newParamCategory}`}
            </h3>
            <form onSubmit={handleSaveParam} className="space-y-3">
              {!editingParam && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Kode / Key</label>
                  <input
                    type="text"
                    value={paramKey}
                    onChange={(e) => setParamKey(e.target.value.toUpperCase())}
                    placeholder="Contoh: LOGISTIK"
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-md font-mono font-bold uppercase focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    required
                  />
                </div>
              )}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Label Tampilan</label>
                <input
                  type="text"
                  value={paramLabel}
                  onChange={(e) => setParamLabel(e.target.value)}
                  placeholder="Contoh: Departemen Logistik"
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Nilai Parameter / Deskripsi</label>
                <input
                  type="text"
                  value={paramValue}
                  onChange={(e) => setParamValue(e.target.value)}
                  placeholder="Penjelasan detail..."
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddParamModal(false);
                    setEditingParam(null);
                  }}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-800"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-xs font-bold"
                >
                  Simpan Parameter
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Add / Edit Master Barang */}
      {(showAddMasterModal || editingMaster) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full border border-slate-200 p-5 space-y-4">
            <h3 className="text-sm font-bold text-slate-800">
              {editingMaster ? 'Ubah Master Barang' : 'Tambah Master Barang Baru'}
            </h3>
            <form onSubmit={handleSaveMasterBarang} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Nama Barang</label>
                <input
                  type="text"
                  value={mbNama}
                  onChange={(e) => handleMasterNamaChange(e.target.value)}
                  placeholder="Contoh: Genset Silent 100 KVA"
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Unique Name / Kode Singkat</label>
                <input
                  type="text"
                  value={mbCode}
                  onChange={(e) => {
                    setMbCode(e.target.value.toUpperCase());
                    setMbWarning(null);
                  }}
                  placeholder="Contoh: GNS"
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-md font-mono font-bold uppercase focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  required
                />
              </div>
              {mbWarning && (
                <div className="p-2 bg-amber-50 text-amber-800 border border-amber-200 rounded text-[11px]">
                  {mbWarning}
                </div>
              )}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Jenis / Kategori Barang</label>
                <input
                  type="text"
                  value={mbJenis}
                  onChange={(e) => setMbJenis(e.target.value)}
                  placeholder="Contoh: Mesin & Utilitas"
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  required
                />
              </div>
              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddMasterModal(false);
                    setEditingMaster(null);
                  }}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-800"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-xs font-bold"
                >
                  Simpan Master Barang
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
