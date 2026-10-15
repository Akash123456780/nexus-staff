import React, { useState, useEffect, useCallback } from 'react';
import { TabType, Attendance, SosKind } from './types';
import { StorageService } from './services/storage';
import { CatalogService } from './services/catalog';
import { QueueService, setErrorNotifier, addQueueListener } from './services/queue';
import { StaffApi } from './api/staff';
import { setUnauthorizedHandler, addConnectionListener } from './api/client';
import { initBackButtonListener, registerBackButtonHandler } from './services/backButton';

// Components & Screens
import { TopBar } from './components/TopBar';
import { BottomNav } from './components/BottomNav';
import { SosFloatingButton } from './components/SosFloatingButton';
import { SosSheet } from './components/SosSheet';
import { MenuSheet } from './components/MenuSheet';
import { NotificationBanner } from './components/NotificationBanner';
import { ServerConfigScreen } from './screens/ServerConfigScreen';
import { LoginScreen } from './screens/LoginScreen';
import { HomeScreen } from './screens/HomeScreen';
import { ScanScreen } from './screens/ScanScreen';
import { StockScreen } from './screens/StockScreen';
import { BillScreen } from './screens/BillScreen';

export default function App() {
  // App initialization state
  const [isInitializing, setIsInitializing] = useState(true);
  const [serverUrl, setServerUrl] = useState<string | null>(null);
  const [isEditingServer, setIsEditingServer] = useState(false);
  const [authToken, setAuthToken] = useState<string | null>(null);

  // User & Shop state
  const [staffName, setStaffName] = useState('');
  const [staffRole, setStaffRole] = useState('');
  const [shopName, setShopName] = useState('NEXUS POS');
  const [isOnline, setIsOnline] = useState(true);

  // Active tab & attendance
  const [activeTab, setActiveTab] = useState<TabType>('home');
  const [attendance, setAttendance] = useState<Attendance | null>(null);

  // Emergency SOS & Menu Sheets
  const [isSosOpen, setIsSosOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [initialSosKind, setInitialSosKind] = useState<SosKind | undefined>();

  // Queue counts for badges
  const [waitingBillsCount, setWaitingBillsCount] = useState(0);
  const [waitingAlertsCount, setWaitingAlertsCount] = useState(0);

  // Toast notification
  const [notification, setNotification] = useState<{ message: string; isError: boolean } | null>(
    null
  );

  const showNotification = useCallback((message: string, isError = false) => {
    setNotification({ message, isError });
    // Auto dismiss after 4 seconds
    setTimeout(() => {
      setNotification((curr) => (curr?.message === message ? null : curr));
    }, 4500);
  }, []);

  // Update badge counts from queues
  const updateQueueCounts = useCallback(() => {
    setWaitingBillsCount(QueueService.getBillQueue().length);
    setWaitingAlertsCount(QueueService.getSosQueue().length);
  }, []);

  // Fetch staff attendance
  const fetchAttendance = useCallback(async () => {
    try {
      const me = await StaffApi.getMe();
      if (me) {
        setStaffName(me.name || '');
        setAttendance(me.attendance || null);
      }
    } catch {
      // Offline or network error
    }
  }, []);

  // Download catalog in background
  const downloadCatalog = useCallback(async () => {
    try {
      const cat = await StaffApi.getCatalog();
      if (cat && cat.items) {
        await CatalogService.saveCatalog(cat.items, cat.at);
      }
    } catch {
      // Offline
    }
  }, []);

  // Initialize app on mount
  useEffect(() => {
    initBackButtonListener();

    // Register 401 session expiration handler
    setUnauthorizedHandler(() => {
      setAuthToken(null);
      showNotification('Session expired. Please sign in again.', true);
    });

    // Register online/offline status listener
    const unsubscribeConn = addConnectionListener((online) => {
      setIsOnline(online);
    });

    // Register error notifier for background queue failures
    setErrorNotifier((msg) => {
      showNotification(msg, true);
    });

    // Register queue update listener
    const unsubscribeQueue = addQueueListener(() => {
      updateQueueCounts();
    });

    // Load initial storage state
    async function loadInitialState() {
      try {
        const [savedUrl, savedToken, user] = await Promise.all([
          StorageService.getServerUrl(),
          StorageService.getToken(),
          StorageService.getUserInfo(),
        ]);

        if (savedUrl) setServerUrl(savedUrl);
        if (savedToken) setAuthToken(savedToken);
        if (user.name) setStaffName(user.name);
        if (user.role) setStaffRole(user.role);
        if (user.shop) setShopName(user.shop);

        updateQueueCounts();
      } finally {
        setIsInitializing(false);
      }
    }

    loadInitialState();

    return () => {
      unsubscribeConn();
      unsubscribeQueue();
      setErrorNotifier(null);
    };
  }, [showNotification, updateQueueCounts]);

  // When logged in, fetch attendance and start background sync + catalog timer
  useEffect(() => {
    if (!authToken || !serverUrl) return;

    fetchAttendance();
    downloadCatalog();

    // Start 15s background retry sync for emergency bills and SOS alerts
    const stopSync = QueueService.startBackgroundSync();

    // Download catalog every 10 minutes when online
    const catalogTimer = setInterval(() => {
      if (navigator.onLine) {
        downloadCatalog();
      }
    }, 600000);

    // Refresh attendance periodically
    const attendanceTimer = setInterval(fetchAttendance, 120000);

    return () => {
      stopSync();
      clearInterval(catalogTimer);
      clearInterval(attendanceTimer);
    };
  }, [authToken, serverUrl, fetchAttendance, downloadCatalog]);

  // Android hardware back button handler
  useEffect(() => {
    return registerBackButtonHandler(() => {
      if (isSosOpen) {
        setIsSosOpen(false);
        return true;
      }
      if (isMenuOpen) {
        setIsMenuOpen(false);
        return true;
      }
      if (isEditingServer) {
        setIsEditingServer(false);
        return true;
      }
      if (activeTab !== 'home') {
        setActiveTab('home');
        return true;
      }
      return false;
    });
  }, [isSosOpen, isMenuOpen, isEditingServer, activeTab]);

  const handleSignOut = async () => {
    await StorageService.clearToken();
    setAuthToken(null);
    setAttendance(null);
    showNotification('Signed out', false);
  };

  const handleServerConfigured = (url: string) => {
    setServerUrl(url);
    setIsEditingServer(false);
    showNotification(`Connected to ${url}`, false);
  };

  const handleLoginSuccess = (info: { name: string; role: string; shop: string }) => {
    StorageService.getToken().then((token) => setAuthToken(token));
    setStaffName(info.name);
    setStaffRole(info.role);
    setShopName(info.shop);
    fetchAttendance();
    updateQueueCounts();
    showNotification(`Welcome back, ${info.name}!`, false);
  };

  const handleOpenSos = (kind?: SosKind) => {
    setInitialSosKind(kind);
    setIsSosOpen(true);
  };

  if (isInitializing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 text-slate-500">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-semibold tracking-wider uppercase">Loading NEXUS Staff...</p>
        </div>
      </div>
    );
  }

  // First-run: Ask for Shop PC Address
  if (!serverUrl || isEditingServer) {
    return (
      <ServerConfigScreen
        initialUrl={serverUrl || ''}
        isFirstRun={!serverUrl}
        onConfigured={handleServerConfigured}
        onCancel={serverUrl ? () => setIsEditingServer(false) : undefined}
      />
    );
  }

  // Not Authenticated: Login Screen
  if (!authToken) {
    return (
      <>
        <LoginScreen
          serverUrl={serverUrl}
          onLoginSuccess={handleLoginSuccess}
          onEditServer={() => setIsEditingServer(true)}
        />
        <NotificationBanner
          message={notification?.message || null}
          isError={notification?.isError}
          onDismiss={() => setNotification(null)}
        />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col justify-between select-none">
      {/* Top App Bar */}
      <TopBar
        shopName={shopName}
        staffName={staffName}
        isOnline={isOnline}
        onOpenMenu={() => setIsMenuOpen(true)}
      />

      {/* Global Toast / Error Banner */}
      <NotificationBanner
        message={notification?.message || null}
        isError={notification?.isError}
        onDismiss={() => setNotification(null)}
      />

      {/* Active Screen Tab Content */}
      <main className="flex-1 overflow-y-auto">
        {activeTab === 'home' && (
          <HomeScreen
            shopName={shopName}
            staffName={staffName}
            attendance={attendance}
            onRefreshAttendance={fetchAttendance}
            onTriggerSos={handleOpenSos}
            waitingAlertsCount={waitingAlertsCount}
            onNotification={showNotification}
          />
        )}

        {activeTab === 'scan' && (
          <ScanScreen onNotification={showNotification} />
        )}

        {activeTab === 'stock' && (
          <StockScreen onNotification={showNotification} />
        )}

        {activeTab === 'bill' && (
          <BillScreen onNotification={showNotification} />
        )}
      </main>

      {/* Persistent SOS Floating Action Button */}
      <SosFloatingButton
        onClick={() => handleOpenSos()}
        waitingAlertsCount={waitingAlertsCount}
      />

      {/* Fixed Bottom Tab Navigation */}
      <BottomNav
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        waitingBillsCount={waitingBillsCount}
      />

      {/* Emergency SOS Bottom Sheet */}
      <SosSheet
        isOpen={isSosOpen}
        onClose={() => setIsSosOpen(false)}
        waitingAlertsCount={waitingAlertsCount}
        onNotification={showNotification}
      />

      {/* Settings / Staff Menu Sheet */}
      <MenuSheet
        isOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        serverUrl={serverUrl}
        staffName={staffName}
        staffRole={staffRole}
        shopName={shopName}
        onChangeServer={() => setIsEditingServer(true)}
        onSignOut={handleSignOut}
        onSyncNow={async () => {
          showNotification('Syncing queues to PC...', false);
          await Promise.all([QueueService.syncSos(), QueueService.syncBills()]);
          updateQueueCounts();
        }}
      />
    </div>
  );
}
