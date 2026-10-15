import React from 'react';
import { LogOut, Server, X, Shield, RefreshCw } from 'lucide-react';

interface MenuSheetProps {
  isOpen: boolean;
  onClose: () => void;
  serverUrl: string;
  staffName: string;
  staffRole: string;
  shopName: string;
  onChangeServer: () => void;
  onSignOut: () => void;
  onSyncNow: () => void;
}

export const MenuSheet: React.FC<MenuSheetProps> = ({
  isOpen,
  onClose,
  serverUrl,
  staffName,
  staffRole,
  shopName,
  onChangeServer,
  onSignOut,
  onSyncNow,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="w-full max-w-md bg-white dark:bg-slate-900 rounded-t-3xl border-t border-slate-200 dark:border-slate-800 shadow-2xl p-5 pb-safe space-y-4"
        role="dialog"
        aria-modal="true"
      >
        <div className="w-12 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto" />

        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
              Staff Menu
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {staffName} ({staffRole || 'Staff'}) · {shopName}
            </p>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full"
            aria-label="Close menu"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="space-y-2 pt-1">
          {/* Change Server */}
          <button
            type="button"
            onClick={() => {
              onClose();
              onChangeServer();
            }}
            className="w-full min-h-[54px] px-4 rounded-2xl bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-750 flex items-center justify-between text-left transition-colors"
          >
            <div className="flex items-center gap-3">
              <Server className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <div>
                <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Shop PC Address
                </div>
                <div className="text-[11px] font-mono text-slate-500 truncate max-w-[220px]">
                  {serverUrl}
                </div>
              </div>
            </div>
            <span className="text-xs text-blue-600 dark:text-blue-400 font-semibold">Change</span>
          </button>

          {/* Sync now */}
          <button
            type="button"
            onClick={() => {
              onClose();
              onSyncNow();
            }}
            className="w-full min-h-[54px] px-4 rounded-2xl bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-750 flex items-center gap-3 text-left transition-colors"
          >
            <RefreshCw className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            <div>
              <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Sync Queues Now
              </div>
              <div className="text-[11px] text-slate-500">
                Retry pending bills and SOS alerts to shop PC
              </div>
            </div>
          </button>

          {/* Sign Out */}
          <button
            type="button"
            onClick={() => {
              onClose();
              onSignOut();
            }}
            className="w-full min-h-[54px] px-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-950/70 text-rose-700 dark:text-rose-300 flex items-center gap-3 text-left transition-colors"
          >
            <LogOut className="w-5 h-5 text-rose-600" />
            <div>
              <div className="text-sm font-bold">Sign Out</div>
              <div className="text-[11px] text-rose-600/80 dark:text-rose-400">
                End session on this phone
              </div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};
