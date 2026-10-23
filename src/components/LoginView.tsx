import React, { useState } from 'react';
import { Database, Lock, User, ShieldAlert, CheckCircle2, ArrowRight, Eye, EyeOff } from 'lucide-react';
import { AuthUser } from '../types';
import { api } from '../services/api';

interface LoginViewProps {
  onLoginSuccess: (user: AuthUser) => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setErrorMsg('Username dan password wajib diisi.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      const res = await api.login(username.trim(), password);
      onLoginSuccess(res.user);
    } catch (err: any) {
      setErrorMsg(err.message || 'Login gagal. Periksa username dan password Anda.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickFill = (u: string, p: string) => {
    setUsername(u);
    setPassword(p);
    setErrorMsg(null);
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center p-4 selection:bg-blue-600 selection:text-white">
      {/* Background radial glow */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900/20 via-slate-950 to-slate-950 pointer-events-none" />

      <div className="relative w-full max-w-md">
        {/* Brand header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-500/25 mb-4 ring-4 ring-blue-500/10">
            <Database className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            ASSETS MANAGEMENT SYSTEM
          </h1>
          <p className="text-xs text-slate-400 mt-1.5 font-medium">
            Sistem Manajemen Aset, BAST & Monitoring Inventaris Terpadu
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl">
          <div className="mb-6">
            <h2 className="text-base font-semibold text-white">Masuk ke Sistem</h2>
            <p className="text-xs text-slate-400 mt-1">
              Gunakan akun resmi untuk mengakses data operasional aset
            </p>
          </div>

          {errorMsg && (
            <div className="mb-5 p-3.5 bg-rose-950/80 border border-rose-800/80 rounded-xl flex items-start space-x-2.5 text-xs text-rose-200">
              <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div className="flex-1 leading-relaxed">{errorMsg}</div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Username Akun
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Masukkan username akun Anda"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  autoComplete="username"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Masukkan password akun Anda"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-10 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-slate-300 cursor-pointer"
                  title={showPassword ? 'Sembunyikan password' : 'Lihat password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-2.5 px-4 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 disabled:opacity-50 text-white font-semibold text-xs rounded-xl shadow-lg shadow-blue-600/30 flex items-center justify-center space-x-2 transition-all cursor-pointer"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Memverifikasi kredensial...</span>
                </>
              ) : (
                <>
                  <span>Masuk ke Dashboard</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Quick-fill helper for User account (Super Admin credentials remain strictly confidential) */}
          <div className="mt-6 pt-5 border-t border-slate-800/80">
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-[11px] font-semibold text-slate-400">
                Akses Pengujian (Akun User):
              </span>
              <span className="text-[10px] text-emerald-400 font-mono font-semibold">
                Role: User
              </span>
            </div>
            <button
              type="button"
              onClick={() => handleQuickFill('USER-LSM2026', 'UserLSM2026!')}
              className="w-full p-3 text-left rounded-xl bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 hover:border-emerald-500/50 transition-colors group cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-xs font-bold text-emerald-400 tracking-wide">
                    Isi Otomatis Kredensial User
                  </span>
                </div>
                <span className="text-[10px] font-semibold text-emerald-400/90 group-hover:text-emerald-300 transition-colors">
                  Klik untuk mengisi &rarr;
                </span>
              </div>
              <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-700/40 text-xs font-mono">
                <div>
                  <span className="text-slate-500 text-[10px]">Username:</span>{' '}
                  <span className="text-slate-200 font-semibold">USER-LSM2026</span>
                </div>
                <div>
                  <span className="text-slate-500 text-[10px]">Password:</span>{' '}
                  <span className="text-slate-200 font-semibold">UserLSM2026!</span>
                </div>
              </div>
              <div className="text-[10px] text-slate-400 mt-1.5 flex items-center justify-between">
                <span>Hak akses: Monitoring Inventaris &amp; Penarikan Aset</span>
                <span className="text-[9px] text-slate-500">Read-Only</span>
              </div>
            </button>
          </div>
        </div>

        {/* Footer info */}
        <div className="text-center mt-6 text-[11px] text-slate-500">
          Autentikasi terenkripsi bcrypt &bull; Sesi server HttpOnly &bull; Proteksi Brute Force 5x
        </div>
      </div>
    </div>
  );
};
