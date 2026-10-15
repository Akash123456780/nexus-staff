import React from 'react';
import { AlertTriangle } from 'lucide-react';

interface SosFloatingButtonProps {
  onClick: () => void;
  waitingAlertsCount?: number;
}

export const SosFloatingButton: React.FC<SosFloatingButtonProps> = ({
  onClick,
  waitingAlertsCount = 0,
}) => {
  return (
    <div className="fixed bottom-20 right-4 z-40">
      <button
        onClick={onClick}
        type="button"
        aria-label="Emergency SOS"
        className="relative group flex items-center justify-center w-14 h-14 rounded-full bg-rose-600 hover:bg-rose-700 active:scale-95 text-white shadow-xl shadow-rose-600/35 border-2 border-white/20 transition-all focus:outline-none focus:ring-4 focus:ring-rose-400"
      >
        <div className="flex flex-col items-center justify-center">
          <AlertTriangle className="w-5 h-5 stroke-[2.5]" />
          <span className="text-[10px] font-black tracking-wider leading-none mt-0.5">SOS</span>
        </div>

        {waitingAlertsCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-5 min-w-[20px] px-1 items-center justify-center rounded-full bg-amber-500 text-slate-900 text-[10px] font-black border border-white shadow-xs">
            {waitingAlertsCount}
          </span>
        )}
      </button>
    </div>
  );
};
