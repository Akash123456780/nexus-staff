import React, { useState, useEffect } from 'react';
import { AlertCircle, Flame, ShieldAlert, HeartPulse, X, HelpCircle, Loader2 } from 'lucide-react';
import { SosKind } from '../types';
import { getEmergencyLocation } from '../services/location';
import { StaffApi } from '../api/staff';
import { ApiError } from '../api/client';
import { QueueService } from '../services/queue';
import { vibrateDevice } from '../services/scanner';
import { registerBackButtonHandler } from '../services/backButton';

interface SosSheetProps {
  isOpen: boolean;
  onClose: () => void;
  waitingAlertsCount: number;
  onNotification: (msg: string, isError?: boolean) => void;
}

export const SosSheet: React.FC<SosSheetProps> = ({
  isOpen,
  onClose,
  waitingAlertsCount,
  onNotification,
}) => {
  const [pendingKind, setPendingKind] = useState<SosKind | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [customMessage, setCustomMessage] = useState('');

  // Register hardware back button to close sheet if open
  useEffect(() => {
    if (!isOpen) return;
    return registerBackButtonHandler(() => {
      if (pendingKind) {
        setPendingKind(null);
        return true;
      }
      onClose();
      return true;
    });
  }, [isOpen, pendingKind, onClose]);

  if (!isOpen) return null;

  const buttons: { kind: SosKind; label: string; icon: React.ElementType }[] = [
    { kind: 'HELP', label: 'Need Help', icon: HelpCircle },
    { kind: 'THEFT', label: 'Theft', icon: ShieldAlert },
    { kind: 'FIRE', label: 'Fire', icon: Flame },
    { kind: 'MEDICAL', label: 'Medical', icon: HeartPulse },
  ];

  const handleConfirmSend = async () => {
    if (!pendingKind || isSending) return;

    setIsSending(true);
    vibrateDevice([100, 50, 100]);

    try {
      // 4-second timeout for location (optional)
      const loc = await getEmergencyLocation();
      const payload = {
        kind: pendingKind,
        message: customMessage.trim() || undefined,
        latitude: loc.latitude,
        longitude: loc.longitude,
        at: new Date().toISOString(),
      };

      try {
        await StaffApi.sendSos(payload);
        onNotification(`Alert sent to owner: ${pendingKind}`, false);
        vibrateDevice([80, 40, 80]);
      } catch (err: any) {
        if (err instanceof ApiError && err.isOffline) {
          // PC cannot be reached: save to local queue
          await QueueService.addSosToQueue({
            id: `sos_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            ...payload,
            attempts: 0,
          });
          onNotification(
            'PC offline — Alert queued and retrying every 15s. Call emergency services if urgent!',
            true
          );
        } else {
          onNotification(err.message || 'Failed to send alert', true);
        }
      }

      setPendingKind(null);
      setCustomMessage('');
      onClose();
    } finally {
      setIsSending(false);
    }
  };

  const selectedBtn = buttons.find((b) => b.kind === pendingKind);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="w-full max-w-md bg-white dark:bg-slate-900 rounded-t-3xl border-t border-slate-200 dark:border-slate-800 shadow-2xl p-5 pb-safe overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sos-title"
      >
        {/* Grab Handle */}
        <div className="w-12 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto mb-4" />

        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-rose-100 dark:bg-rose-950/60 flex items-center justify-center text-rose-600 dark:text-rose-400">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div>
              <h2 id="sos-title" className="text-lg font-bold text-slate-900 dark:text-slate-100 leading-tight">
                Emergency SOS
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Sends an instant alert to the shop PC and owner
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full"
            aria-label="Close"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Confirmation Step */}
        {pendingKind && selectedBtn ? (
          <div className="space-y-4 py-2">
            <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-2xl p-4 text-center">
              <div className="w-12 h-12 rounded-full bg-rose-600 text-white flex items-center justify-center mx-auto mb-2 shadow-md shadow-rose-600/30">
                <selectedBtn.icon className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-rose-900 dark:text-rose-200">
                Confirm: Send &quot;{selectedBtn.label}&quot; Alert?
              </h3>
              <p className="text-xs text-rose-700 dark:text-rose-300 mt-1">
                Your location will be sent if available. Alerts are dispatched immediately.
              </p>
            </div>

            <input
              type="text"
              value={customMessage}
              onChange={(e) => setCustomMessage(e.target.value)}
              placeholder="Optional message (e.g. Counter 2)"
              maxLength={120}
              className="w-full h-12 px-3 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500"
            />

            <div className="grid grid-cols-2 gap-3 pt-1">
              <button
                type="button"
                onClick={() => setPendingKind(null)}
                disabled={isSending}
                className="h-13 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-sm hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-[0.98] transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmSend}
                disabled={isSending}
                className="h-13 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-sm shadow-lg shadow-rose-600/30 flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
              >
                {isSending ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Sending...</span>
                  </>
                ) : (
                  <span>Yes, Send Alert</span>
                )}
              </button>
            </div>
          </div>
        ) : (
          /* 4 Large Red Buttons */
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              {buttons.map((btn) => {
                const Icon = btn.icon;
                return (
                  <button
                    key={btn.kind}
                    type="button"
                    onClick={() => setPendingKind(btn.kind)}
                    className="min-h-[96px] p-4 flex flex-col items-center justify-center gap-2 rounded-2xl bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white shadow-md shadow-rose-600/20 active:scale-[0.97] transition-all"
                  >
                    <Icon className="w-8 h-8 stroke-[2.2]" />
                    <span className="text-sm font-bold tracking-wide">{btn.label}</span>
                  </button>
                );
              })}
            </div>

            {waitingAlertsCount > 0 && (
              <div className="flex items-center justify-between p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 text-amber-800 dark:text-amber-300 text-xs">
                <span className="font-semibold">
                  {waitingAlertsCount} alert(s) waiting to be sent
                </span>
                <button
                  type="button"
                  onClick={() => QueueService.syncSos()}
                  className="px-2.5 py-1 rounded-lg bg-amber-600 text-white font-medium text-[11px] hover:bg-amber-700"
                >
                  Retry now
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
