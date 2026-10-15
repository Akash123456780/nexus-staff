import React, { useState } from 'react';
import { Server, ArrowRight, ShieldCheck, HelpCircle } from 'lucide-react';
import { StorageService } from '../services/storage';

interface ServerConfigScreenProps {
  initialUrl?: string;
  onConfigured: (url: string) => void;
  onCancel?: () => void;
  isFirstRun?: boolean;
}

export const ServerConfigScreen: React.FC<ServerConfigScreenProps> = ({
  initialUrl = '',
  onConfigured,
  onCancel,
  isFirstRun = false,
}) => {
  const [address, setAddress] = useState(initialUrl);
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = address.trim();
    if (!trimmed) {
      setError('Please enter the shop PC address (e.g. 192.168.1.10:8000)');
      return;
    }

    setError('');
    setIsSaving(true);

    try {
      const sanitized = await StorageService.setServerUrl(trimmed);
      onConfigured(sanitized);
    } catch (err: any) {
      setError(err.message || 'Failed to save address');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-between bg-slate-50 dark:bg-slate-950 p-6 pt-safe pb-safe max-w-md mx-auto">
      <div className="space-y-6 pt-8">
        <div className="w-16 h-16 rounded-3xl bg-blue-600 text-white flex items-center justify-center shadow-xl shadow-blue-600/30">
          <Server className="w-8 h-8 stroke-[2]" />
        </div>

        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
            {isFirstRun ? 'Initial Setup' : 'Connection Settings'}
          </span>
          <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight mt-1">
            Shop PC Address
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-2 leading-relaxed">
            Enter the local IP address and port of the shop computer running NEXUS POS on your Wi-Fi network.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              IP Address &amp; Port
            </label>
            <div className="relative">
              <input
                type="text"
                value={address}
                onChange={(e) => {
                  setAddress(e.target.value);
                  setError('');
                }}
                placeholder="192.168.1.10:8000"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck="false"
                inputMode="url"
                className="w-full h-14 px-4 text-base font-mono rounded-2xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-xs"
              />
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              &quot;http://&quot; will be automatically added if omitted
            </p>
          </div>

          {/* Quick preset helpers */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="text-xs text-slate-500">Examples:</span>
            {['192.168.1.10:8000', '192.168.0.100:8000', 'localhost:8000'].map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setAddress(preset)}
                className="text-xs px-2.5 py-1 rounded-lg bg-slate-200/70 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300 font-mono"
              >
                {preset}
              </button>
            ))}
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-300 text-xs font-medium">
              {error}
            </div>
          )}
        </form>

        <div className="p-4 rounded-2xl bg-blue-50/60 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/40 text-xs text-slate-600 dark:text-slate-400 space-y-1">
          <div className="flex items-center gap-1.5 font-semibold text-blue-900 dark:text-blue-300">
            <HelpCircle className="w-4 h-4 text-blue-600" />
            Where do I find this?
          </div>
          <p>
            On the shop PC, open NEXUS POS settings or run <span className="font-mono bg-white dark:bg-slate-800 px-1 py-0.5 rounded">ipconfig</span>. Ensure your phone is connected to the shop Wi-Fi network.
          </p>
        </div>
      </div>

      <div className="pt-6 space-y-2">
        <button
          type="button"
          onClick={() => handleSubmit()}
          disabled={isSaving}
          className="w-full h-14 rounded-2xl bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white font-bold text-base flex items-center justify-center gap-2 shadow-lg shadow-blue-600/25 transition-all"
        >
          <span>Connect &amp; Continue</span>
          <ArrowRight className="w-5 h-5" />
        </button>

        {!isFirstRun && onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="w-full h-12 rounded-xl text-slate-600 dark:text-slate-400 font-semibold text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
};
