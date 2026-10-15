class WakeLockService {
  private sentinel: any = null;
  private requested = false;

  async acquire(): Promise<void> {
    this.requested = true;
    if (this.sentinel !== null) {
      return;
    }

    try {
      if ('wakeLock' in navigator && (navigator as any).wakeLock) {
        this.sentinel = await (navigator as any).wakeLock.request('screen');
        this.sentinel.addEventListener('release', () => {
          this.sentinel = null;
          // Re-acquire if still requested and document became visible again
          if (this.requested && document.visibilityState === 'visible') {
            this.acquire();
          }
        });
      }
    } catch {
      // Wake lock not allowed or battery saver active
    }
  }

  async release(): Promise<void> {
    this.requested = false;
    if (this.sentinel) {
      try {
        await this.sentinel.release();
      } catch {
        // Ignore
      }
      this.sentinel = null;
    }
  }
}

export const wakeLockService = new WakeLockService();
