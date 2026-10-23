import React from 'react';
import {
  FilePlus2,
  Table2,
  PackageSearch,
  FileMinus2,
  ArchiveRestore,
  SlidersHorizontal,
  ChevronRight,
  Shield,
  UserCheck,
} from 'lucide-react';
import { MenuId, AuthUser } from '../types';

interface SidebarProps {
  activeMenu: MenuId;
  onSelectMenu: (menu: MenuId) => void;
  stats: Record<string, number>;
  currentUser: AuthUser | null;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeMenu,
  onSelectMenu,
  stats,
  currentUser,
}) => {
  const isUserRole = currentUser?.role === 'User';

  const allMenuItems = [
    {
      id: 'input-bast' as MenuId,
      number: '1',
      title: 'Input Barang Baru / BAST',
      shortTitle: 'Input BAST Baru',
      icon: FilePlus2,
      description: 'Formulir input 2-kolom & upload foto',
      badge: null,
      color: 'text-blue-600',
      allowedRoles: ['Super Admin'],
    },
    {
      id: 'daftar-bast' as MenuId,
      number: '2',
      title: 'Daftar BAST',
      shortTitle: 'Daftar BAST',
      icon: Table2,
      description: 'Tabel horizontal transaksi BAST & foto',
      badge: stats.totalBast ?? 0,
      color: 'text-indigo-600',
      allowedRoles: ['Super Admin'],
    },
    {
      id: 'monitoring-inventaris' as MenuId,
      number: '3',
      title: 'Monitoring Inventaris',
      shortTitle: 'Monitoring Inventaris',
      icon: PackageSearch,
      description: 'Aset aktif, foto & form pemeriksaan',
      badge: stats.totalInventaris ?? 0,
      color: 'text-emerald-600',
      allowedRoles: ['Super Admin', 'User'],
    },
    {
      id: 'penarikan-aset' as MenuId,
      number: '4',
      title: 'Penarikan Aset',
      shortTitle: 'Form Penarikan',
      icon: FileMinus2,
      description: 'Pencarian autocomplete & penonaktifan',
      badge: null,
      color: 'text-amber-600',
      allowedRoles: ['Super Admin'],
    },
    {
      id: 'daftar-penarikan' as MenuId,
      number: '5',
      title: 'Daftar Penarikan Aset',
      shortTitle: 'Daftar Penarikan',
      icon: ArchiveRestore,
      description: 'Riwayat aset ditarik, audit & restore',
      badge: stats.totalPenarikan ?? 0,
      color: 'text-rose-600',
      allowedRoles: ['Super Admin', 'User'],
    },
    {
      id: 'pengaturan-parameter' as MenuId,
      number: '6',
      title: 'Pengaturan Parameter',
      shortTitle: 'Parameter & Integrasi',
      icon: SlidersHorizontal,
      description: 'Master barang, nomor, Google sync & log',
      badge: stats.totalMasterBarang ?? 0,
      color: 'text-slate-600',
      allowedRoles: ['Super Admin'],
    },
  ];

  // Strictly filter menus: User only gets Fitur 3 and Fitur 5
  const visibleMenuItems = allMenuItems.filter((item) =>
    currentUser?.role ? item.allowedRoles.includes(currentUser.role) : true
  );

  return (
    <aside className="w-64 md:w-72 bg-slate-900/95 border-r border-slate-800 flex flex-col shrink-0 min-h-[calc(100vh-53px)] select-none">
      <div className="p-3 border-b border-slate-800/80 bg-slate-950/40">
        <div className="flex items-center justify-between px-2">
          <span className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
            {isUserRole ? 'Modul User (Read-Only)' : 'Navigasi Modul Aset'}
          </span>
          <span
            className={`text-[10px] font-bold px-2 py-0.5 rounded ${
              isUserRole
                ? 'bg-emerald-950 text-emerald-300 border border-emerald-800/60'
                : 'bg-blue-950 text-blue-300 border border-blue-800/60'
            }`}
          >
            {isUserRole ? '2 Modul' : 'Akses Penuh'}
          </span>
        </div>
      </div>

      <nav className="p-2 space-y-1.5 flex-1">
        {visibleMenuItems.map((item) => {
          const isActive = activeMenu === item.id;

          return (
            <button
              key={item.id}
              onClick={() => onSelectMenu(item.id)}
              className={`w-full text-left rounded-lg p-2.5 transition-all flex items-center justify-between group cursor-pointer ${
                isActive
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-900/40 font-medium ring-1 ring-blue-400/30'
                  : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
              }`}
            >
              <div className="flex items-center space-x-3 min-w-0">
                <div
                  className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 text-xs font-bold ${
                    isActive
                      ? 'bg-white/20 text-white shadow-inner'
                      : 'bg-slate-800 text-slate-400 group-hover:bg-slate-700 group-hover:text-slate-200'
                  }`}
                >
                  {item.number}
                </div>
                <div className="truncate">
                  <div className="text-xs font-semibold leading-tight truncate">
                    {item.title}
                  </div>
                  <div
                    className={`text-[10px] leading-tight truncate mt-0.5 ${
                      isActive ? 'text-blue-100' : 'text-slate-500 group-hover:text-slate-400'
                    }`}
                  >
                    {item.description}
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-1.5 shrink-0 ml-2">
                {item.badge !== null && (
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                      isActive
                        ? 'bg-blue-800 text-blue-100'
                        : 'bg-slate-800 text-slate-400 group-hover:bg-slate-700 group-hover:text-slate-300'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
                <ChevronRight
                  className={`w-3.5 h-3.5 transition-transform ${
                    isActive ? 'text-blue-200 translate-x-0.5' : 'text-slate-600 group-hover:text-slate-400'
                  }`}
                />
              </div>
            </button>
          );
        })}
      </nav>

      {/* Role & Access Info Footer */}
      <div className="p-3 m-2 rounded-lg bg-slate-950/70 border border-slate-800 text-[11px] text-slate-400 space-y-1.5">
        <div className="flex items-center space-x-2 text-slate-200 font-semibold text-xs">
          {isUserRole ? (
            <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
          ) : (
            <Shield className="w-3.5 h-3.5 text-blue-400" />
          )}
          <span>{currentUser?.name || currentUser?.username}</span>
        </div>
        <p className="text-[10px] text-slate-500 leading-relaxed">
          {isUserRole
            ? 'Akses terbatas untuk monitoring inventaris dan daftar penarikan (read-only).'
            : 'Super Admin memiliki hak penuh termasuk transaksi, parameter, dan Restore Aset.'}
        </p>
      </div>
    </aside>
  );
};
