import { BarcodeScanner, BarcodeFormat } from '@capacitor-mlkit/barcode-scanning';
import { Capacitor } from '@capacitor/core';

// Audio beep feedback using Web Audio API
class AudioBeep {
  private ctx: AudioContext | null = null;

  play() {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;

      if (!this.ctx || this.ctx.state === 'suspended') {
        this.ctx = new AudioCtx();
      }

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      // Classic high-pitched POS scanner chime
      osc.frequency.setValueAtTime(1950, this.ctx.currentTime);

      gain.gain.setValueAtTime(0.35, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.09);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + 0.09);
    } catch {
      // Audio might be muted or blocked by browser policy
    }
  }
}

export const beepPlayer = new AudioBeep();

export function vibrateDevice(pattern: number | number[] = 70) {
  try {
    if (navigator.vibrate) {
      navigator.vibrate(pattern);
    }
  } catch {
    // Vibration not supported
  }
}

export interface ScannerCallbacks {
  onScan: (code: string) => void;
  onError?: (err: Error) => void;
}

export class BarcodeScannerService {
  private isScanning = false;
  private lastCode = '';
  private lastScannedAt = 0;
  private isNative = Capacitor.isNativePlatform();
  private webStream: MediaStream | null = null;
  private webInterval: number | null = null;
  private isTorchOn = false;

  async requestPermission(): Promise<boolean> {
    if (this.isNative) {
      try {
        const { camera } = await BarcodeScanner.requestPermissions();
        return camera === 'granted' || camera === 'limited';
      } catch (e) {
        console.warn('Native permission request failed:', e);
        return false;
      }
    }

    // Web permission check
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      stream.getTracks().forEach((track) => track.stop());
      return true;
    } catch {
      return false;
    }
  }

  async checkPermission(): Promise<boolean> {
    if (this.isNative) {
      try {
        const { camera } = await BarcodeScanner.checkPermissions();
        return camera === 'granted' || camera === 'limited';
      } catch {
        return false;
      }
    }
    return true;
  }

  async startContinuousScan(
    videoElement: HTMLVideoElement | null,
    onCodeDetected: (code: string) => void
  ): Promise<boolean> {
    if (this.isScanning) {
      return true;
    }

    this.isScanning = true;
    this.lastCode = '';
    this.lastScannedAt = 0;

    const handleDetected = (rawCode: string) => {
      const code = rawCode.trim();
      if (!code) return;

      const now = Date.now();
      // Ignore the same code for 2.5 seconds
      if (code === this.lastCode && now - this.lastScannedAt < 2500) {
        return;
      }

      this.lastCode = code;
      this.lastScannedAt = now;

      beepPlayer.play();
      vibrateDevice(80);
      onCodeDetected(code);
    };

    if (this.isNative) {
      try {
        // Formats requested: EAN-13/EAN-8/UPC/Code128/Code39/QR
        const formats = [
          BarcodeFormat.Ean13,
          BarcodeFormat.Ean8,
          BarcodeFormat.UpcA,
          BarcodeFormat.UpcE,
          BarcodeFormat.Code128,
          BarcodeFormat.Code39,
          BarcodeFormat.QrCode,
        ];

        await BarcodeScanner.addListener('barcodesScanned', (result) => {
          if (result.barcodes && result.barcodes.length > 0) {
            const code = result.barcodes[0].rawValue || result.barcodes[0].displayValue;
            if (code) {
              handleDetected(code);
            }
          }
        });

        await BarcodeScanner.startScan({ formats });
        return true;
      } catch (nativeErr) {
        console.warn('Native scan start failed, falling back to web camera', nativeErr);
      }
    }

    // Web camera scanning with BarcodeDetector or Canvas fallback
    if (!videoElement) {
      this.isScanning = false;
      return false;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });

      this.webStream = stream;
      videoElement.srcObject = stream;
      await videoElement.play();

      // Check if BarcodeDetector is available
      const BarcodeDetectorAPI = (window as any).BarcodeDetector;
      if (BarcodeDetectorAPI) {
        const detector = new BarcodeDetectorAPI({
          formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'qr_code'],
        });

        this.webInterval = window.setInterval(async () => {
          if (!this.isScanning || !videoElement || videoElement.readyState < 2) return;
          try {
            const barcodes = await detector.detect(videoElement);
            if (barcodes && barcodes.length > 0) {
              handleDetected(barcodes[0].rawValue);
            }
          } catch {
            // Frame decode dropped
          }
        }, 200);
      } else {
        // Fallback for browsers without native BarcodeDetector
        console.info('BarcodeDetector not available natively; manual photo scan ready');
      }

      return true;
    } catch (webErr: any) {
      this.isScanning = false;
      throw new Error(`Camera access failed: ${webErr.message || 'Permission denied'}`);
    }
  }

  async stopScan(): Promise<void> {
    this.isScanning = false;

    if (this.webInterval) {
      window.clearInterval(this.webInterval);
      this.webInterval = null;
    }

    if (this.webStream) {
      this.webStream.getTracks().forEach((track) => track.stop());
      this.webStream = null;
    }

    if (this.isNative) {
      try {
        await BarcodeScanner.removeAllListeners();
        await BarcodeScanner.stopScan();
      } catch {
        // Ignore
      }
    }
  }

  async toggleTorch(): Promise<boolean> {
    this.isTorchOn = !this.isTorchOn;

    if (this.isNative) {
      try {
        await BarcodeScanner.toggleTorch();
        return this.isTorchOn;
      } catch {
        // Ignore
      }
    }

    if (this.webStream) {
      try {
        const videoTrack = this.webStream.getVideoTracks()[0];
        if (videoTrack) {
          const capabilities = (videoTrack.getCapabilities?.() as any) || {};
          if (capabilities.torch) {
            await (videoTrack as any).applyConstraints({
              advanced: [{ torch: this.isTorchOn }],
            });
            return this.isTorchOn;
          }
        }
      } catch {
        // Torch not available on web
      }
    }

    return this.isTorchOn;
  }

  async decodeImageFile(file: File): Promise<string> {
    const BarcodeDetectorAPI = (window as any).BarcodeDetector;
    if (BarcodeDetectorAPI) {
      try {
        const detector = new BarcodeDetectorAPI({
          formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'qr_code'],
        });
        const bitmap = await createImageBitmap(file);
        const barcodes = await detector.detect(bitmap);
        if (barcodes && barcodes.length > 0) {
          return barcodes[0].rawValue;
        }
      } catch (err: any) {
        console.warn('BarcodeDetector on image failed:', err);
      }
    }

    throw new Error('Could not detect a clear barcode in this photo. Please try closer or enter manually.');
  }

  isActive(): boolean {
    return this.isScanning;
  }
}

export const scannerService = new BarcodeScannerService();
