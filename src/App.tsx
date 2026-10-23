import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { Sidebar } from './components/Sidebar';
import { LoginView } from './components/LoginView';
import { InputBastView } from './views/InputBastView';
import { DaftarBastView } from './views/DaftarBastView';
import { MonitoringInventarisView } from './views/MonitoringInventarisView';
import { PenarikanAsetView } from './views/PenarikanAsetView';
import { DaftarPenarikanView } from './views/DaftarPenarikanView';
import { PengaturanParameterView } from './views/PengaturanParameterView';
import { MenuId, AppConfig, AuthUser } from './types';
import { api } from './services/api';

export default function App() {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [activeMenu, setActiveMenu] = useState<MenuId>('monitoring-inventaris');
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [stats, setStats] = useState<Record<string, number>>({});
  const [refreshKey, setRefreshKey] = useState(0);

  // Check existing session on load
  useEffect(() => {
    checkAuthSession();
  }, []);

  const checkAuthSession = async () => {
    setAuthChecking(true);
    try {
      const user = await api.getCurrentUser();
      if (user) {
        setCurrentUser(user);
        // Default menu depending on role
        if (user.role === 'User') {
          setActiveMenu('monitoring-inventaris');
        } else {
          setActiveMenu('input-bast');
        }
      }
    } catch (err) {
      console.error('Session check failed:', err);
    } finally {
      setAuthChecking(false);
    }
  };

  // Load config & stats once authenticated or upon refresh
  useEffect(() => {
    if (currentUser) {
      loadAppConfig();
    }
  }, [currentUser, refreshKey]);

  const loadAppConfig = async () => {
    try {
      const data = await api.getConfig();
      setConfig(data.config);
      setStats(data.stats);
    } catch (err) {
      console.error('Error loading config:', err);
    }
  };

  const handleLoginSuccess = (user: AuthUser) => {
    setCurrentUser(user);
    if (user.role === 'User') {
      setActiveMenu('monitoring-inventaris');
    } else {
      setActiveMenu('input-bast');
    }
    handleRefresh();
  };

  const handleLogout = async () => {
    try {
      await api.logout();
    } catch (e) {
      console.error('Logout error:', e);
    } finally {
      setCurrentUser(null);
      setConfig(null);
    }
  };

  const handleRefresh = () => {
    setRefreshKey((prev) => prev + 1);
  };

  // Strict route guard for User role
  const handleSelectMenu = (menu: MenuId) => {
    if (currentUser?.role === 'User') {
      // User is strictly restricted to Fitur 3 and Fitur 5
      if (menu !== 'monitoring-inventaris' && menu !== 'daftar-penarikan') {
        setActiveMenu('monitoring-inventaris');
        return;
      }
    }
    setActiveMenu(menu);
  };

  // Loading spinner during initial session check
  if (authChecking) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 text-white">
        <div className="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-xs text-slate-400 font-medium tracking-wide">
          Memeriksa sesi autentikasi...
        </p>
      </div>
    );
  }

  // If unauthenticated, show secure Login View
  if (!currentUser) {
    return <LoginView onLoginSuccess={handleLoginSuccess} />;
  }

  // Safety fallback if User somehow lands on unauthorized menu
  const effectiveMenu =
    currentUser.role === 'User' &&
    activeMenu !== 'monitoring-inventaris' &&
    activeMenu !== 'daftar-penarikan'
      ? 'monitoring-inventaris'
      : activeMenu;

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans text-slate-800 antialiased selection:bg-blue-600 selection:text-white">
      {/* Top Application Navbar */}
      <Navbar
        config={config}
        currentUser={currentUser}
        onRefresh={handleRefresh}
        onLogout={handleLogout}
      />

      {/* Main Body with Sidebar + Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Navigation Sidebar */}
        <Sidebar
          activeMenu={effectiveMenu}
          onSelectMenu={handleSelectMenu}
          stats={stats}
          currentUser={currentUser}
        />

        {/* Dynamic Module View Container */}
        <main className="flex-1 overflow-y-auto bg-slate-100/90 min-h-[calc(100vh-53px)] pb-12">
          {effectiveMenu === 'input-bast' && currentUser.role === 'Super Admin' && (
            <InputBastView
              onSuccessNavigate={() => {
                setActiveMenu('daftar-bast');
                handleRefresh();
              }}
            />
          )}

          {effectiveMenu === 'daftar-bast' && currentUser.role === 'Super Admin' && (
            <DaftarBastView />
          )}

          {effectiveMenu === 'monitoring-inventaris' && (
            <MonitoringInventarisView currentUser={currentUser} />
          )}

          {effectiveMenu === 'penarikan-aset' && currentUser.role === 'Super Admin' && (
            <PenarikanAsetView
              onSuccessNavigate={() => {
                setActiveMenu('daftar-penarikan');
                handleRefresh();
              }}
            />
          )}

          {effectiveMenu === 'daftar-penarikan' && (
            <DaftarPenarikanView currentUser={currentUser} />
          )}

          {effectiveMenu === 'pengaturan-parameter' && currentUser.role === 'Super Admin' && (
            <PengaturanParameterView />
          )}
        </main>
      </div>
    </div>
  );
}
