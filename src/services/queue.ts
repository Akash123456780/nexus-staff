import { StaffApi } from '../api/staff';
import { ApiError } from '../api/client';
import { EmergencyBill, SosAlert } from '../types';

const BILL_QUEUE_KEY = 'nexus_bill_queue';
const SOS_QUEUE_KEY = 'nexus_sos_queue';

type QueueListener = () => void;
type ErrorNotificationHandler = (msg: string) => void;

const listeners = new Set<QueueListener>();
let errorNotifier: ErrorNotificationHandler | null = null;

export function addQueueListener(listener: QueueListener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function setErrorNotifier(handler: ErrorNotificationHandler | null) {
  errorNotifier = handler;
}

function notifyListeners() {
  listeners.forEach((fn) => {
    try {
      fn();
    } catch {
      // Ignore
    }
  });
}

function loadFromStorage<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveToStorage<T>(key: string, data: T[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch {
    // Quota or unavailable
  }
}

let isSyncingBills = false;
let isSyncingSos = false;

export const QueueService = {
  getBillQueue(): EmergencyBill[] {
    return loadFromStorage<EmergencyBill>(BILL_QUEUE_KEY);
  },

  getSosQueue(): SosAlert[] {
    return loadFromStorage<SosAlert>(SOS_QUEUE_KEY);
  },

  async addBillToQueue(bill: EmergencyBill): Promise<void> {
    const queue = this.getBillQueue();
    queue.push(bill);
    saveToStorage(BILL_QUEUE_KEY, queue);
    notifyListeners();
  },

  async addSosToQueue(alert: SosAlert): Promise<void> {
    const queue = this.getSosQueue();
    queue.push(alert);
    saveToStorage(SOS_QUEUE_KEY, queue);
    notifyListeners();
  },

  async syncSos(): Promise<{ sentCount: number }> {
    if (isSyncingSos) return { sentCount: 0 };
    const queue = this.getSosQueue();
    if (queue.length === 0) return { sentCount: 0 };

    isSyncingSos = true;
    let sentCount = 0;

    try {
      // Process SOS one by one in FIFO order
      const remaining: SosAlert[] = [];
      for (const alert of queue) {
        try {
          await StaffApi.sendSos({
            kind: alert.kind,
            message: alert.message,
            latitude: alert.latitude,
            longitude: alert.longitude,
            at: alert.at,
          });
          sentCount++;
        } catch (err: any) {
          if (err instanceof ApiError && err.isOffline) {
            // Cannot reach PC, preserve this and the rest of the queue
            remaining.push({
              ...alert,
              attempts: (alert.attempts || 0) + 1,
            });
            // Stop further attempts this cycle if PC is unreachable
            const restIndex = queue.indexOf(alert) + 1;
            for (let i = restIndex; i < queue.length; i++) {
              remaining.push(queue[i]);
            }
            break;
          } else {
            // Unrecoverable server validation error on single alert, still log it
            if (errorNotifier && err.message) {
              errorNotifier(`SOS Alert failed: ${err.message}`);
            }
          }
        }
      }

      saveToStorage(SOS_QUEUE_KEY, remaining);
      notifyListeners();
    } finally {
      isSyncingSos = false;
    }

    return { sentCount };
  },

  async syncBills(): Promise<{
    postedCount: number;
    failedCount: number;
    errors: string[];
  }> {
    if (isSyncingBills) {
      return { postedCount: 0, failedCount: 0, errors: [] };
    }

    const queue = this.getBillQueue();
    if (queue.length === 0) {
      return { postedCount: 0, failedCount: 0, errors: [] };
    }

    isSyncingBills = true;

    try {
      const payload = queue.map((bill) => ({
        clientId: bill.clientId,
        madeAt: bill.madeAt,
        paymentMode: bill.paymentMode,
        items: bill.items.map((it) => ({
          id: it.id,
          qty: it.qty,
        })),
      }));

      const response = await StaffApi.postEmergencyBills(payload);
      const results = response?.results || [];

      // A definite answer means POSTED or FAILED
      const answeredMap = new Map<string, { status: string; error?: string }>();
      results.forEach((r) => {
        answeredMap.set(r.clientId, { status: r.status, error: r.error });
      });

      let postedCount = 0;
      let failedCount = 0;
      const errors: string[] = [];

      // Remove bills with a definite answer
      const remaining: EmergencyBill[] = [];

      for (const bill of queue) {
        const answer = answeredMap.get(bill.clientId);
        if (answer) {
          if (answer.status === 'POSTED') {
            postedCount++;
          } else {
            failedCount++;
            const errMsg = answer.error || 'Emergency bill rejected by PC';
            errors.push(errMsg);
            if (errorNotifier) {
              errorNotifier(`Bill for ₹${bill.total} failed: ${errMsg}`);
            }
          }
        } else {
          // No definite answer for this bill yet (e.g. partial server response or timeout)
          remaining.push(bill);
        }
      }

      saveToStorage(BILL_QUEUE_KEY, remaining);
      notifyListeners();

      return { postedCount, failedCount, errors };
    } catch (err: any) {
      // On network error, do NOT drop any bills!
      if (!(err instanceof ApiError && err.isOffline)) {
        if (errorNotifier && err.message) {
          errorNotifier(`Sync error: ${err.message}`);
        }
      }
      return { postedCount: 0, failedCount: 0, errors: [err.message || 'Offline'] };
    } finally {
      isSyncingBills = false;
    }
  },

  startBackgroundSync(): () => void {
    const run = () => {
      this.syncSos().catch(() => {});
      this.syncBills().catch(() => {});
    };

    // Run every 15 seconds as specified
    const intervalId = window.setInterval(run, 15000);

    const handleOnline = () => {
      run();
    };

    window.addEventListener('online', handleOnline);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('online', handleOnline);
    };
  },
};
