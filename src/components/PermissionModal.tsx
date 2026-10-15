import React from 'react';
import { Camera, MapPin, X } from 'lucide-react';

interface PermissionModalProps {
  type: 'camera' | 'location';
  isOpen: boolean;
  onAllow: () => void;
  onDismiss: () => void;
}

export const PermissionModal: React.FC<PermissionModalProps> = ({
  type,
  isOpen,
  onAllow,
  onDismiss,
}) => {
  if (!isOpen) return null;

  const isCamera = type === 'camera';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-2xl text-center space-y-4"
        role="dialog"
        aria-modal="true"
      >
        <div className="w-16 h-16 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto">
          {isCamera ? <Camera className="w-8 h-8 stroke-[1.8]" /> : <MapPin className="w-8 h-8 stroke-[1.8]" />}
        </div>

        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
            {isCamera ? 'Allow Camera Access' : 'Allow Location Access'}
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-2 leading-relaxed">
            {isCamera
              ? 'NEXUS Staff needs your camera to continuously scan barcodes on items directly to the shop billing computer and stock lookups.'
              : 'NEXUS Staff uses your location only when you send an emergency SOS alert, so the shop owner and emergency services know where to help.'}
          </p>
        </div>

        <div className="space-y-2 pt-2">
          <button
            type="button"
            onClick={onAllow}
            className="w-full h-12 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm active:scale-[0.98] transition-all shadow-md shadow-blue-600/20"
          >
            Continue
          </button>
          <button
            type="button"
            onClick={onDismiss}
            className="w-full h-11 rounded-xl text-slate-600 dark:text-slate-400 font-medium text-sm hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            Not now
          </button>
        </div>
      </div>
    </div>
  );
};
