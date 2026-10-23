import React from 'react';
import { Database, ShieldCheck, UserCheck, Cloud, CloudOff, RefreshCw, LogOut, Shield } from 'lucide-react';
import { AppConfig, AuthUser } from '../types';

interface NavbarProps {
  config: AppConfig | null;
  currentUser: AuthUser | null;
  onRefresh: () => void;
  onLogout: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ config, currentUser, onRefresh, onLogout }) => {
  const todayStr = new Intl.DateTimeFormat('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date());

  const isSuperAdmin = currentUser?.role === 'Super Admin';

  return (
    <header className="bg-slate-900 text-white border-b border-slate-800 sticky top-0 z-30 shadow-sm">
      <div className="px-4 py-2.5 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center font-bold text-white shadow-inner">
            <Database className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-base font-bold tracking-tight text-white leading-tight">
                ASSETS MANAGEMENT SYSTEM
              </h1>
              <span className="hidden md:inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-blue-900/60 text-blue-200 border border-blue-700/50">
                v2.6 RBAC
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Pencatatan BAST, Monitoring Inventaris, Penarikan & Pengarsipan Google Sheets
            </p>
          </div>
        </div>

        {/* Right Status Badges & User Profile */}
        <div className="flex items-center space-x-3">
          {/* Date Badge */}
          <div className="hidden lg:flex items-center px-3 py-1 bg-slate-800/80 rounded-md text-xs text-slate-300 border border-slate-700/60">
            <span className="text-slate-400 mr-1.5">Hari ini:</span>
            <span className="font-medium text-slate-200">{todayStr}</span>
          </div>

          {/* Google Sheets Connection Indicator */}
          <div
            className={`flex items-center px-2.5 py-1 rounded-md text-xs font-medium border ${
              config?.isConnectedToGoogle
                ? 'bg-emerald-950/70 text-emerald-300 border-emerald-700/60'
                : 'bg-amber-950/70 text-amber-300 border-amber-700/60'
            }`}
            title={
              config?.isConnectedToGoogle
                ? 'Tersinkronisasi dengan Google Spreadsheet & Google Drive'
                : 'Database Terpusat Aktif (Google Apps Script Web App belum dihubungkan di Pengaturan)'
            }
          >
            {config?.isConnectedToGoogle ? (
              <>
                <Cloud className="w-3.5 h-3.5 mr-1.5 text-emerald-400" />
                <span className="hidden sm:inline">Google Sheets & Drive:</span>
                <span className="ml-1 font-semibold">Tersambung</span>
              </>
            ) : (
              <>
                <CloudOff className="w-3.5 h-3.5 mr-1.5 text-amber-400" />
                <span className="hidden sm:inline">Penyimpanan:</span>
                <span className="ml-1 font-semibold">Database Terpusat</span>
              </>
            )}
          </div>

          {/* Refresh Data button */}
          <button
            onClick={onRefresh}
            className="p-1.5 rounded-md hover:bg-slate-800 text-slate-300 hover:text-white transition-colors cursor-pointer"
            title="Muat ulang data dari server"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          {/* User Profile Info Card */}
          {currentUser && (
            <div className="flex items-center space-x-2 px-3 py-1 bg-slate-800/90 rounded-md border border-slate-700 text-xs text-left">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center font-semibold text-xs border ${
                  isSuperAdmin
                    ? 'bg-blue-500/20 text-blue-300 border-blue-400/40'
                    : 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40'
                }`}
              >
                {isSuperAdmin ? (
                  <Shield className="w-3.5 h-3.5" />
                ) : (
                  <UserCheck className="w-3.5 h-3.5" />
                )}
              </div>
              <div className="hidden sm:block">
                <div className="font-semibold text-slate-100 text-[11px] leading-tight">
                  {currentUser.username}
                </div>
                <div
                  className={`text-[10px] font-medium leading-tight ${
                    isSuperAdmin ? 'text-blue-400' : 'text-emerald-400'
                  }`}
                >
                  {currentUser.role}
                </div>
              </div>
            </div>
          )}

          {/* Logout Button */}
          <button
            onClick={onLogout}
            className="flex items-center space-x-1.5 px-2.5 py-1.5 bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 hover:text-rose-100 border border-rose-800/60 rounded-md text-xs font-semibold transition-colors cursor-pointer"
            title="Keluar dari sistem (Logout)"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Keluar</span>
          </button>
        </div>
      </div>
    </header>
  );
};
