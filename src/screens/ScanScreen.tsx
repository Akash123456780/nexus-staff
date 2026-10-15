import React, { useState, useEffect, useRef } from 'react';
import {
  Camera,
  Flashlight,
  Send,
  CheckCircle2,
  XCircle,
  Image,
  RefreshCw,
  Eye,
  EyeOff,
} from 'lucide-react';
import { SentScan } from '../types';
import { scannerService } from '../services/scanner';
import { StaffApi } from '../api/staff';
import { wakeLockService } from '../services/wakelock';
import { PermissionModal } from '../components/PermissionModal';

interface ScanScreenProps {
  onNotification: (msg: string, isError?: boolean) => void;
}

export const ScanScreen: React.FC<ScanScreenProps> = ({ onNotification }) => {
  const [isScanning, setIsScanning] = useState(false);
  const [torchActive, setTorchActive] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [isSendingManual, setIsSendingManual] = useState(false);
  const [sentScans, setSentScans] = useState<SentScan[]>([]);
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Keep screen awake while in Scan tab
  useEffect(() => {
    wakeLockService.acquire();
    return () => {
      wakeLockService.release();
      scannerService.stopScan();
    };
  }, []);

  const handleCodeDetected = async (code: string) => {
    const trimmed = code.trim();
    if (!trimmed) return;

    try {
      await StaffApi.sendScan(trimmed);
      addSentRecord(trimmed, 'POSTED');
      onNotification(`Scanned & sent: ${trimmed}`, false);
    } catch (err: any) {
      const msg = err.message || 'PC billing screen not reachable';
      addSentRecord(trimmed, 'FAILED', msg);
      onNotification(`Failed to send ${trimmed}: ${msg}`, true);
    }
  };

  const addSentRecord = (code: string, status: 'POSTED' | 'FAILED', error?: string) => {
    const newRecord: SentScan = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      code,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      status,
      error,
    };

    setSentScans((prev) => [newRecord, ...prev].slice(0, 10));
  };

  const handleStartScan = async () => {
    setCameraError(null);
    const hasPerm = await scannerService.checkPermission();
    if (!hasPerm) {
      setShowPermissionModal(true);
      return;
    }
    await launchCamera();
  };

  const launchCamera = async () => {
    try {
      const ok = await scannerService.startContinuousScan(
        videoRef.current,
        handleCodeDetected
      );
      if (ok) {
        setIsScanning(true);
      }
    } catch (err: any) {
      setCameraError(err.message || 'Could not start camera');
      setIsScanning(false);
    }
  };

  const handleStopScan = async () => {
    await scannerService.stopScan();
    setIsScanning(false);
    setTorchActive(false);
  };

  const handleToggleTorch = async () => {
    const state = await scannerService.toggleTorch();
    setTorchActive(state);
  };

  const handleSendManual = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const code = manualCode.trim();
    if (!code) return;

    setIsSendingManual(true);
    try {
      await StaffApi.sendScan(code);
      addSentRecord(code, 'POSTED');
      onNotification(`Sent code: ${code}`, false);
      setManualCode('');
    } catch (err: any) {
      const msg = err.message || 'Failed to send barcode';
      addSentRecord(code, 'FAILED', msg);
      onNotification(msg, true);
    } finally {
      setIsSendingManual(false);
    }
  };

  const handlePhotoSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    onNotification('Decoding photo barcode...', false);
    try {
      const code = await scannerService.decodeImageFile(file);
      await handleCodeDetected(code);
    } catch (err: any) {
      onNotification(err.message || 'Could not read barcode from photo', true);
    }
  };

  return (
    <div className="min-h-full pb-28 pt-2 px-4 max-w-md mx-auto space-y-4">
      {/* Title */}
      <div className="py-1">
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
          Scan to PC Bill
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Point at item barcodes to send them directly to the open POS bill on the shop PC
        </p>
      </div>

      {/* Camera Viewfinder Card */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-4 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
        <div className="relative aspect-4/3 w-full bg-slate-950 rounded-2xl overflow-hidden flex items-center justify-center">
          <video
            ref={videoRef}
            playsInline
            muted
            className={`w-full h-full object-cover ${isScanning ? 'block' : 'hidden'}`}
          />

          {!isScanning && (
            <div className="text-center p-6 space-y-2 text-slate-400">
              <Camera className="w-12 h-12 mx-auto stroke-[1.5] text-slate-500" />
              <p className="text-xs text-slate-400 max-w-[200px] mx-auto">
                Camera is off. Tap &quot;Start Camera&quot; for continuous scanning.
              </p>
            </div>
          )}

          {/* Scanner Viewfinder Box when active */}
          {isScanning && (
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div className="relative w-64 h-36 border-2 border-white/60 rounded-xl shadow-[0_0_0_9999px_rgba(0,0,0,0.4)]">
                {/* Corner markers */}
                <span className="absolute -top-1 -left-1 w-4 h-4 border-t-3 border-l-3 border-blue-400 rounded-tl" />
                <span className="absolute -top-1 -right-1 w-4 h-4 border-t-3 border-r-3 border-blue-400 rounded-tr" />
                <span className="absolute -bottom-1 -left-1 w-4 h-4 border-b-3 border-l-3 border-blue-400 rounded-bl" />
                <span className="absolute -bottom-1 -right-1 w-4 h-4 border-b-3 border-r-3 border-blue-400 rounded-br" />
                {/* Red Laser Sweep line */}
                <div className="w-full h-0.5 bg-rose-500/80 animate-pulse shadow-md shadow-rose-500" />
              </div>
            </div>
          )}

          {/* Torch toggle floating inside camera viewport */}
          {isScanning && (
            <button
              type="button"
              onClick={handleToggleTorch}
              className={`absolute top-3 right-3 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full backdrop-blur-md transition-colors ${
                torchActive
                  ? 'bg-amber-400 text-slate-950 shadow-lg'
                  : 'bg-black/50 text-white hover:bg-black/70'
              }`}
              title="Toggle Flashlight"
              aria-label="Toggle Flashlight"
            >
              <Flashlight className="w-5 h-5" />
            </button>
          )}
        </div>

        {cameraError && (
          <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 text-xs">
            {cameraError}
          </div>
        )}

        {/* Scan Actions */}
        <div className="grid grid-cols-2 gap-2.5 pt-1">
          {isScanning ? (
            <button
              type="button"
              onClick={handleStopScan}
              className="h-13 rounded-2xl bg-slate-800 hover:bg-slate-900 text-white font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
            >
              <EyeOff className="w-5 h-5" />
              <span>Stop Camera</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleStartScan}
              className="h-13 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-all shadow-md shadow-blue-600/25"
            >
              <Camera className="w-5 h-5" />
              <span>Start Camera</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="h-13 rounded-2xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 text-slate-800 dark:text-slate-200 font-semibold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
          >
            <Image className="w-5 h-5 text-slate-500" />
            <span>Scan Photo</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handlePhotoSelected}
          />
        </div>
      </div>

      {/* Manual Barcode Input Card */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-4 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
        <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
          Manual Barcode Input
        </h3>

        <form onSubmit={handleSendManual} className="flex gap-2">
          <input
            type="text"
            inputMode="numeric"
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value)}
            placeholder="Type barcode number..."
            className="flex-1 h-13 px-4 text-base font-mono rounded-2xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            disabled={isSendingManual || !manualCode.trim()}
            className="h-13 px-5 rounded-2xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-sm flex items-center justify-center gap-1.5 active:scale-[0.98] transition-all shrink-0"
          >
            <Send className="w-4 h-4" />
            <span>Send</span>
          </button>
        </form>
      </div>

      {/* Sent List (Last 10) */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-4 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
            Recently Sent ({sentScans.length})
          </h3>
          <span className="text-[11px] text-slate-400">Last 10 scans</span>
        </div>

        {sentScans.length === 0 ? (
          <p className="text-xs text-slate-400 py-3 text-center">
            No barcodes sent yet this session.
          </p>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-56 overflow-y-auto">
            {sentScans.map((scan) => (
              <div
                key={scan.id}
                className="py-2.5 flex items-center justify-between gap-3 text-sm"
              >
                <div className="min-w-0">
                  <div className="font-mono font-medium text-slate-900 dark:text-slate-100 truncate">
                    {scan.code}
                  </div>
                  <div className="text-[11px] text-slate-400 flex items-center gap-1">
                    <span>{scan.timestamp}</span>
                    {scan.error && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="text-rose-600 dark:text-rose-400 truncate max-w-[180px]">
                          {scan.error}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                <div className="shrink-0">
                  {scan.status === 'POSTED' ? (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Sent</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-rose-600 dark:text-rose-400">
                      <XCircle className="w-4 h-4" />
                      <span>Failed</span>
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <PermissionModal
        type="camera"
        isOpen={showPermissionModal}
        onAllow={async () => {
          setShowPermissionModal(false);
          const ok = await scannerService.requestPermission();
          if (ok) {
            launchCamera();
          } else {
            onNotification('Camera permission was denied', true);
          }
        }}
        onDismiss={() => setShowPermissionModal(false)}
      />
    </div>
  );
};
