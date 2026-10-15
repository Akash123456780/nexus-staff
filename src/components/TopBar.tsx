import React from 'react';
import { Wifi, WifiOff, MoreVertical } from 'lucide-react';

interface TopBarProps {
  shopName: string;
  staffName: string;
  isOnline: boolean;
  onOpenMenu: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  shopName,
  staffName,
  isOnline,
  onOpenMenu,
}) => {
  return (
    <header className="sticky top-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 pt-safe px-4 py-2.5">
      <div className="max-w-md mx-auto flex items-center justify-between gap-3">
        {/* Left: Shop and Staff info */}
        <div className="min-w-0 flex-1">
          <h1 className="text-base font-bold tracking-tight text-slate-900 dark:text-slate-100 truncate leading-snug">
            {shopName || 'NEXUS Staff'}
          </h1>
          <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 truncate">
            <span className="font-medium truncate">{staffName || 'Staff Member'}</span>
            <span aria-hidden="true">·</span>
            <span className="inline-flex items-center gap-1 text-[11px]">
              {isOnline ? (
                <>
                  <Wifi className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-emerald-700 dark:text-emerald-400 font-medium">Online</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-3 h-3 text-rose-600 dark:text-rose-400" />
                  <span className="text-rose-600 dark:text-rose-400 font-semibold">PC not reachable</span>
                </>
              )}
            </span>
          </div>
        </div>

        {/* Right: Menu trigger */}
        <button
          onClick={onOpenMenu}
          className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          title="Settings and Options"
          aria-label="Settings and Options"
          type="button"
        >
          <MoreVertical className="w-5 h-5" />
        </button>
      </div>
    </header>
  );
};
