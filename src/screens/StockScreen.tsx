import React, { useState, useRef } from 'react';
import {
  Search,
  Camera,
  AlertTriangle,
  Loader2,
  Package,
  X,
  Database,
  Tag,
} from 'lucide-react';
import { Product } from '../types';
import { StaffApi } from '../api/staff';
import { CatalogService } from '../services/catalog';
import { scannerService } from '../services/scanner';

interface StockScreenProps {
  onNotification: (msg: string, isError?: boolean) => void;
}

export const StockScreen: React.FC<StockScreenProps> = ({ onNotification }) => {
  const [query, setQuery] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOfflineFallback, setIsOfflineFallback] = useState(false);
  const [offlineCatalogAt, setOfflineCatalogAt] = useState('');
  const [hasSearched, setHasSearched] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSearch = async (searchTerm?: string) => {
    const q = (searchTerm !== undefined ? searchTerm : query).trim();
    if (!q) {
      setProducts([]);
      setHasSearched(false);
      return;
    }

    setIsLoading(true);
    setHasSearched(true);
    setIsOfflineFallback(false);

    try {
      const results = await StaffApi.searchProducts(q);
      setProducts(results || []);
    } catch (err: any) {
      // If PC is unreachable, search saved catalog in IndexedDB
      try {
        const fallbackResults = await CatalogService.searchProducts(q);
        const meta = await CatalogService.getCatalogMeta();
        setProducts(fallbackResults);
        setIsOfflineFallback(true);
        setOfflineCatalogAt(meta.at || 'earlier session');
        onNotification('PC not reachable — searched offline catalog', false);
      } catch {
        setProducts([]);
        onNotification('Failed to query products on PC or offline storage', true);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleScanBarcodeForSearch = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    onNotification('Scanning barcode...', false);
    try {
      const code = await scannerService.decodeImageFile(file);
      setQuery(code);
      handleSearch(code);
    } catch (err: any) {
      onNotification(err.message || 'Could not read barcode', true);
    }
  };

  const formatPrice = (val: number) => {
    return '₹' + (Math.round(val * 100) / 100).toLocaleString('en-IN');
  };

  return (
    <div className="min-h-full pb-28 pt-2 px-4 max-w-md mx-auto space-y-4">
      {/* Title */}
      <div className="py-1">
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
          Stock &amp; Price Lookup
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Check live inventory, wholesale price, and GST slab on the shop PC
        </p>
      </div>

      {/* Search Input Box + Scan Button */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-4 border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSearch();
          }}
          className="flex items-center gap-2"
        >
          <div className="relative flex-1">
            <Search className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Name or barcode..."
              className="w-full h-13 pl-11 pr-10 text-base rounded-2xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {query && (
              <button
                type="button"
                onClick={() => {
                  setQuery('');
                  setProducts([]);
                  setHasSearched(false);
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="min-h-[52px] min-w-[52px] flex items-center justify-center rounded-2xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 active:scale-95 transition-all"
            title="Scan Barcode to Search"
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
            onChange={handleScanBarcodeForSearch}
          />

          <button
            type="submit"
            disabled={isLoading || !query.trim()}
            className="h-13 px-4 rounded-2xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-sm flex items-center justify-center active:scale-[0.98] transition-all shrink-0"
          >
            {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <span>Search</span>}
          </button>
        </form>
      </div>

      {/* Offline Fallback Banner */}
      {isOfflineFallback && (
        <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 flex items-start gap-2.5 text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
          <Database className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
          <div>
            <span className="font-bold">PC not reachable</span> — saved list from{' '}
            <span className="font-semibold">{offlineCatalogAt}</span>
          </div>
        </div>
      )}

      {/* Results List */}
      <div className="space-y-2.5">
        {isLoading ? (
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 border border-slate-200 dark:border-slate-800 text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-600 mb-2" />
            <p className="text-xs text-slate-500">Searching inventory...</p>
          </div>
        ) : products.length > 0 ? (
          products.map((item) => {
            const isLowStock = item.stock <= item.minStock;

            return (
              <div
                key={item.id}
                className="bg-white dark:bg-slate-900 rounded-3xl p-4 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between gap-3"
              >
                <div className="min-w-0 flex-1">
                  <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                    {item.name}
                  </h4>
                  <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-1 flex-wrap">
                    <span className="font-mono text-[11px] bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                      {item.barcode || 'NO BARCODE'}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
                      {formatPrice(item.price)}
                    </span>
                    {item.gst !== undefined && (
                      <span className="text-[11px] text-slate-500">
                        (+{item.gst}% GST)
                      </span>
                    )}
                  </div>
                </div>

                {/* Stock Status Pill */}
                <div className="shrink-0 text-right">
                  <div
                    className={`text-sm font-bold tabular-nums ${
                      isLowStock
                        ? 'text-rose-600 dark:text-rose-400 flex items-center gap-1 justify-end'
                        : 'text-slate-900 dark:text-slate-100'
                    }`}
                  >
                    {isLowStock && <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500" />}
                    <span>
                      {item.stock} {item.unit || 'pcs'}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    {isLowStock ? `Min: ${item.minStock}` : `Safe (${item.minStock} min)`}
                  </div>
                </div>
              </div>
            );
          })
        ) : hasSearched ? (
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 border border-slate-200 dark:border-slate-800 text-center space-y-2">
            <Package className="w-10 h-10 mx-auto text-slate-400 stroke-[1.5]" />
            <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300">
              No products found
            </h4>
            <p className="text-xs text-slate-400">
              Try searching with another name or scan a different barcode.
            </p>
          </div>
        ) : (
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 border border-slate-200 dark:border-slate-800 text-center space-y-2">
            <Tag className="w-10 h-10 mx-auto text-slate-400 stroke-[1.5]" />
            <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300">
              Check stock and price
            </h4>
            <p className="text-xs text-slate-400">
              Type product name, scan barcode, or press Search to check stock levels.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
