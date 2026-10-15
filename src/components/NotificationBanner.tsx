import React from 'react';
import { AlertCircle, CheckCircle2, X } from 'lucide-react';

interface NotificationBannerProps {
  message: string | null;
  isError?: boolean;
  onDismiss: () => void;
}

export const NotificationBanner: React.FC<NotificationBannerProps> = ({
  message,
  isError = false,
  onDismiss,
}) => {
  if (!message) return null;

  return (
    <div className="fixed top-14 left-0 right-0 z-50 px-4 pointer-events-none animate-in fade-in slide-in-from-top-4 duration-200">
      <div
        className={`max-w-md mx-auto pointer-events-auto p-3.5 rounded-2xl shadow-xl flex items-start gap-3 border ${
          isError
            ? 'bg-rose-600 text-white border-rose-500 shadow-rose-600/30'
            : 'bg-slate-900 text-white dark:bg-slate-800 border-slate-700 shadow-slate-900/30'
        }`}
      >
        <div className="shrink-0 mt-0.5">
          {isError ? (
            <AlertCircle className="w-4 h-4 text-white stroke-[2.5]" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 stroke-[2.5]" />
          )}
        </div>

        <div className="flex-1 text-xs font-medium leading-relaxed break-words">
          {message}
        </div>

        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 -mr-1 -mt-1 p-1 text-white/80 hover:text-white"
          aria-label="Dismiss message"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
