import React, { useState, useEffect, useRef } from 'react';
import {
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  Camera,
  Search,
  CheckCircle2,
  RefreshCw,
  Send,
  Database,
  ArrowRight,
  IndianRupee,
  CreditCard,
  QrCode,
  Banknote,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { BillCartItem, EmergencyBill, PaymentMode, Product } from '../types';
import { CatalogService } from '../services/catalog';
import { QueueService, addQueueListener } from '../services/queue';
import { StaffApi } from '../api/staff';
import { scannerService, vibrateDevice } from '../services/scanner';
import { wakeLockService } from '../services/wakelock';

interface BillScreenProps {
  onNotification: (msg: string, isError?: boolean) => void;
}

export const BillScreen: React.FC<BillScreenProps> = ({ onNotification }) => {
  const [catalogMeta, setCatalogMeta] = useState<{ count: number; at: string }>({
    count: 0,
    at: '',
  });
  const [isUpdatingCatalog, setIsUpdatingCatalog] = useState(false);

  // Search & add items
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Product[]>([]);

  // Cart
  const [cart, setCart] = useState<BillCartItem[]>([]);
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('CASH');

  // Queue
  const [queue, setQueue] = useState<EmergencyBill[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);

  // Success modal for "Collect ₹X"
  const [collectedAmount, setCollectedAmount] = useState<number | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Keep screen awake while in Bill tab
  useEffect(() => {
    wakeLockService.acquire();
    return () => {
      wakeLockService.release();
    };
  }, []);

  // Load catalog meta and initial queue
  useEffect(() => {
    loadCatalogInfo();
    refreshQueue();

    const unsubscribeQueue = addQueueListener(() => {
      refreshQueue();
    });

    const interval = setInterval(refreshQueue, 5000);
    return () => {
      clearInterval(interval);
      unsubscribeQueue();
    };
  }, []);

  const loadCatalogInfo = async () => {
    const meta = await CatalogService.getCatalogMeta();
    setCatalogMeta(meta);
  };

  const refreshQueue = () => {
    setQueue(QueueService.getBillQueue());
  };

  const handleDownloadCatalog = async () => {
    setIsUpdatingCatalog(true);
    try {
      const data = await StaffApi.getCatalog();
      if (data && data.items) {
        await CatalogService.saveCatalog(data.items, data.at);
        await loadCatalogInfo();
        onNotification(`Downloaded ${data.items.length} products to phone`, false);
      }
    } catch (err: any) {
      onNotification(err.message || 'Could not download catalog from PC', true);
    } finally {
      setIsUpdatingCatalog(false);
    }
  };

  const handleSearchInput = async (val: string) => {
    setSearchQuery(val);
    const q = val.trim();
    if (!q) {
      setSearchResults([]);
      return;
    }
    const results = await CatalogService.searchProducts(q, 15);
    setSearchResults(results);
  };

  const addToCart = (product: Product, quantity = 1) => {
    setCart((prev) => {
      const existingIndex = prev.findIndex((item) => String(item.id) === String(product.id));
      if (existingIndex !== -1) {
        const next = [...prev];
        next[existingIndex] = {
          ...next[existingIndex],
          qty: Math.round((next[existingIndex].qty + quantity) * 1000) / 1000,
        };
        return next;
      } else {
        return [
          ...prev,
          {
            id: product.id,
            name: product.name,
            price: product.price,
            gst: product.gst || 0,
            stock: product.stock,
            unit: product.unit || 'pcs',
            qty: quantity,
          },
        ];
      }
    });

    vibrateDevice(50);
    setSearchQuery('');
    setSearchResults([]);
  };

  const updateQuantity = (id: number | string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (String(item.id) === String(id)) {
            const nextQty = Math.round((item.qty + delta) * 1000) / 1000;
            return nextQty > 0 ? { ...item, qty: nextQty } : null;
          }
          return item;
        })
        .filter(Boolean) as BillCartItem[]
    );
  };

  const setExactQuantity = (id: number | string, val: number) => {
    if (isNaN(val) || val <= 0) return;
    setCart((prev) =>
      prev.map((item) =>
        String(item.id) === String(id) ? { ...item, qty: Math.round(val * 1000) / 1000 } : item
      )
    );
  };

  const removeFromCart = (id: number | string) => {
    setCart((prev) => prev.filter((item) => String(item.id) !== String(id)));
  };

  // Live scan photo or camera
  const handlePhotoScanToAdd = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    onNotification('Scanning barcode for bill...', false);
    try {
      const code = await scannerService.decodeImageFile(file);
      const product = await CatalogService.findProductByBarcode(code);
      if (product) {
        addToCart(product, 1);
        onNotification(`Added: ${product.name}`, false);
      } else {
        onNotification(`Barcode ${code} not found in saved catalog`, true);
      }
    } catch (err: any) {
      onNotification(err.message || 'Could not scan barcode', true);
    }
  };

  // Calculate bill total: sum(price * qty * (1 + gst / 100)) rounded to whole rupee
  const calculateTotal = (): number => {
    const rawTotal = cart.reduce((sum, item) => {
      const lineGst = 1 + (item.gst || 0) / 100;
      return sum + item.price * item.qty * lineGst;
    }, 0);
    return Math.round(rawTotal);
  };

  const totalAmount = calculateTotal();

  const handleSaveBill = async () => {
    if (cart.length === 0) {
      onNotification('Please add at least one item to save the bill', true);
      return;
    }

    const clientId =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `bill_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

    const newBill: EmergencyBill = {
      clientId,
      madeAt: new Date().toISOString(),
      paymentMode,
      items: cart.map((item) => ({
        id: item.id,
        name: item.name,
        qty: item.qty,
      })),
      total: totalAmount,
    };

    await QueueService.addBillToQueue(newBill);
    refreshQueue();

    // Trigger feedback
    vibrateDevice([80, 40, 80]);
    setCollectedAmount(totalAmount);
    setCart([]);

    // Automatically attempt sync in background immediately
    QueueService.syncBills().then(() => refreshQueue()).catch(() => {});
  };

  const handlePostNow = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    try {
      const res = await QueueService.syncBills();
      refreshQueue();
      if (res.postedCount > 0) {
        onNotification(`Successfully posted ${res.postedCount} bill(s) to PC`, false);
      } else if (res.failedCount > 0) {
        onNotification(`${res.failedCount} bill(s) rejected: ${res.errors[0]}`, true);
      } else {
        onNotification('Shop PC cannot be reached right now', true);
      }
    } finally {
      setIsSyncing(false);
    }
  };

  const formatRupee = (val: number) => {
    return '₹' + val.toLocaleString('en-IN');
  };

  return (
    <div className="min-h-full pb-28 pt-2 px-4 max-w-md mx-auto space-y-4">
      {/* Title & Catalog Status */}
      <div className="py-1">
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
          Emergency Bill
        </h2>
        <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          <span>
            {catalogMeta.count > 0
              ? `${catalogMeta.count.toLocaleString()} products saved (${catalogMeta.at ? catalogMeta.at.slice(11, 16) : ''})`
              : 'No price list saved yet'}
          </span>
          <button
            type="button"
            onClick={handleDownloadCatalog}
            disabled={isUpdatingCatalog}
            className="flex items-center gap-1 font-semibold text-blue-600 dark:text-blue-400 hover:underline"
          >
            <RefreshCw className={`w-3 h-3 ${isUpdatingCatalog ? 'animate-spin' : ''}`} />
            <span>Update</span>
          </button>
        </div>
      </div>

      {/* Product Search & Add Section */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-4 border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearchInput(e.target.value)}
              placeholder="Search catalog or barcode..."
              className="w-full h-13 pl-11 pr-4 text-base rounded-2xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="min-h-[52px] min-w-[52px] flex items-center justify-center rounded-2xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 active:scale-95 transition-all"
            title="Scan Barcode to Add"
            aria-label="Scan Barcode"
          >
            <Camera className="w-6 h-6 stroke-[1.8]" />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handlePhotoScanToAdd}
          />
        </div>

        {/* Live Search dropdown results */}
        {searchResults.length > 0 && (
          <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-52 overflow-y-auto pt-2">
            {searchResults.map((product) => (
              <div
                key={product.id}
                className="py-2.5 flex items-center justify-between gap-3 text-sm"
              >
                <div className="min-w-0">
                  <div className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                    {product.name}
                  </div>
                  <div className="text-xs text-slate-500 tabular-nums">
                    ₹{product.price} {product.gst ? `+${product.gst}% GST` : ''} · Stock: {product.stock} {product.unit}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => addToCart(product, 1)}
                  className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-bold text-xs shrink-0"
                >
                  Add
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Cart: Current Bill */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-4 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
              Current Bill ({cart.length})
            </h3>
          </div>
          {cart.length > 0 && (
            <button
              type="button"
              onClick={() => setCart([])}
              className="text-xs text-slate-400 hover:text-rose-600 font-medium"
            >
              Clear Cart
            </button>
          )}
        </div>

        {cart.length === 0 ? (
          <p className="text-xs text-slate-400 py-6 text-center">
            No products added to this bill yet.
          </p>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-72 overflow-y-auto space-y-1">
            {cart.map((item) => {
              const itemTotal = Math.round(item.price * item.qty * (1 + (item.gst || 0) / 100));

              return (
                <div key={item.id} className="pt-3 pb-2 flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                      {item.name}
                    </div>
                    <div className="text-xs text-slate-500 tabular-nums">
                      ₹{item.price} each · {formatRupee(itemTotal)}
                    </div>
                  </div>

                  {/* Quantity Controls with Decimal Input */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => updateQuantity(item.id, -1)}
                      className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 active:scale-95"
                    >
                      <Minus className="w-4 h-4" />
                    </button>

                    <input
                      type="number"
                      step="any"
                      min="0.001"
                      value={item.qty}
                      onChange={(e) => setExactQuantity(item.id, parseFloat(e.target.value))}
                      className="w-14 h-9 text-center text-sm font-bold tabular-nums rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                    />

                    <button
                      type="button"
                      onClick={() => updateQuantity(item.id, 1)}
                      className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 active:scale-95"
                    >
                      <Plus className="w-4 h-4" />
                    </button>

                    <button
                      type="button"
                      onClick={() => removeFromCart(item.id)}
                      className="min-h-[36px] min-w-[36px] flex items-center justify-center text-slate-400 hover:text-rose-600 transition-colors ml-1"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Total calculation strip */}
        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-baseline justify-between">
          <span className="text-sm font-semibold text-slate-600 dark:text-slate-400">
            Total (with GST)
          </span>
          <span className="text-2xl font-black text-slate-900 dark:text-slate-100 tabular-nums">
            {formatRupee(totalAmount)}
          </span>
        </div>

        {/* Payment Mode Selector: CASH / UPI / CARD */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
            Payment Mode
          </label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: 'CASH' as PaymentMode, label: 'CASH', icon: Banknote },
              { id: 'UPI' as PaymentMode, label: 'UPI', icon: QrCode },
              { id: 'CARD' as PaymentMode, label: 'CARD', icon: CreditCard },
            ].map((mode) => {
              const isSelected = paymentMode === mode.id;
              const Icon = mode.icon;

              return (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => setPaymentMode(mode.id)}
                  className={`h-12 rounded-2xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all select-none active:scale-[0.98] ${
                    isSelected
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{mode.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Save Bill Action */}
        <button
          type="button"
          onClick={handleSaveBill}
          disabled={cart.length === 0}
          className="w-full h-14 rounded-2xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-bold text-base flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/25 active:scale-[0.98] transition-all"
        >
          <CheckCircle2 className="w-5 h-5" />
          <span>Save Bill &amp; Collect {formatRupee(totalAmount)}</span>
        </button>
      </div>

      {/* Waiting to Post Queue */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-4 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Waiting to Post ({queue.length})
            </h3>
            <p className="text-[11px] text-slate-400">
              Auto-syncs every 15s to shop PC
            </p>
          </div>

          <button
            type="button"
            onClick={handlePostNow}
            disabled={isSyncing || queue.length === 0}
            className="h-10 px-3.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 text-slate-800 dark:text-slate-200 font-semibold text-xs flex items-center gap-1.5 active:scale-95 disabled:opacity-40 transition-all shrink-0"
          >
            {isSyncing ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Posting...</span>
              </>
            ) : (
              <>
                <Send className="w-3.5 h-3.5" />
                <span>Post to PC now</span>
              </>
            )}
          </button>
        </div>

        {queue.length === 0 ? (
          <p className="text-xs text-slate-400 py-3 text-center">
            Queue is clean. All bills posted.
          </p>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-56 overflow-y-auto">
            {queue.map((bill) => (
              <div
                key={bill.clientId}
                className="py-2.5 flex items-center justify-between gap-3 text-sm"
              >
                <div>
                  <div className="font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                    {formatRupee(bill.total)}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                    <span>{bill.paymentMode}</span>
                    <span aria-hidden="true">·</span>
                    <span>{bill.items.length} item(s)</span>
                    <span aria-hidden="true">·</span>
                    <span>{bill.madeAt.slice(11, 16)}</span>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 font-semibold">
                    Queued
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Collect ₹X Prompt Modal */}
      {collectedAmount !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div
            className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-2xl text-center space-y-4"
            role="dialog"
            aria-modal="true"
          >
            <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto shadow-md">
              <CheckCircle2 className="w-10 h-10 stroke-[2.2]" />
            </div>

            <div className="space-y-1">
              <span className="text-xs uppercase font-bold text-emerald-600 dark:text-emerald-400 tracking-wider">
                Bill Saved to Phone
              </span>
              <h2 className="text-3xl font-black text-slate-900 dark:text-slate-100 tabular-nums">
                Collect {formatRupee(collectedAmount)}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 pt-1">
                This bill is saved on this phone and will post to the shop PC automatically.
              </p>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => setCollectedAmount(null)}
                className="w-full h-13 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-lg shadow-emerald-600/25 active:scale-[0.98] transition-all"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
