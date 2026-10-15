import { Product } from '../types';

const DB_NAME = 'nexus_staff_db';
const DB_VERSION = 1;
const STORE_PRODUCTS = 'products';
const STORE_META = 'metadata';

let dbInstance: IDBDatabase | null = null;
let memoryCache: { items: Product[]; at: string } | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbInstance) {
    return Promise.resolve(dbInstance);
  }

  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      return reject(new Error('IndexedDB not supported in this environment'));
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      if (!db.objectStoreNames.contains(STORE_PRODUCTS)) {
        const productStore = db.createObjectStore(STORE_PRODUCTS, { keyPath: 'id' });
        productStore.createIndex('barcode', 'barcode', { unique: false });
        productStore.createIndex('name', 'name', { unique: false });
      }

      if (!db.objectStoreNames.contains(STORE_META)) {
        db.createObjectStore(STORE_META, { keyPath: 'key' });
      }
    };

    request.onsuccess = () => {
      dbInstance = request.result;
      dbInstance.onversionchange = () => {
        dbInstance?.close();
        dbInstance = null;
      };
      resolve(dbInstance);
    };

    request.onerror = () => {
      reject(request.error || new Error('Failed to open IndexedDB'));
    };
  });
}

export const CatalogService = {
  async saveCatalog(items: Product[], at: string): Promise<void> {
    memoryCache = { items, at };
    try {
      const db = await openDB();
      const tx = db.transaction([STORE_PRODUCTS, STORE_META], 'readwrite');
      const productStore = tx.objectStore(STORE_PRODUCTS);
      const metaStore = tx.objectStore(STORE_META);

      // Clear old products
      productStore.clear();

      // Put new products
      for (const item of items) {
        productStore.put(item);
      }

      // Save metadata
      metaStore.put({
        key: 'catalog_info',
        count: items.length,
        at: at || new Date().toISOString(),
      });

      return new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      });
    } catch {
      // Memory cache is already updated as fallback
    }
  },

  async getCatalogMeta(): Promise<{ count: number; at: string }> {
    try {
      const db = await openDB();
      const tx = db.transaction(STORE_META, 'readonly');
      const store = tx.objectStore(STORE_META);
      const request = store.get('catalog_info');

      return new Promise<{ count: number; at: string }>((resolve) => {
        request.onsuccess = () => {
          if (request.result) {
            resolve({
              count: request.result.count || 0,
              at: request.result.at || '',
            });
          } else if (memoryCache) {
            resolve({
              count: memoryCache.items.length,
              at: memoryCache.at,
            });
          } else {
            resolve({ count: 0, at: '' });
          }
        };
        request.onerror = () => {
          if (memoryCache) {
            resolve({ count: memoryCache.items.length, at: memoryCache.at });
          } else {
            resolve({ count: 0, at: '' });
          }
        };
      });
    } catch {
      if (memoryCache) {
        return { count: memoryCache.items.length, at: memoryCache.at };
      }
      return { count: 0, at: '' };
    }
  },

  async searchProducts(query: string, limit = 40): Promise<Product[]> {
    const q = query.trim().toLowerCase();
    if (!q) return [];

    try {
      const db = await openDB();
      const tx = db.transaction(STORE_PRODUCTS, 'readonly');
      const store = tx.objectStore(STORE_PRODUCTS);
      const request = store.openCursor();

      return new Promise<Product[]>((resolve) => {
        const results: Product[] = [];
        request.onsuccess = (e) => {
          const cursor = (e.target as IDBRequest<IDBCursorWithValue>).result;
          if (cursor) {
            const product = cursor.value as Product;
            const barcode = (product.barcode || '').toLowerCase();
            const name = (product.name || '').toLowerCase();

            if (barcode === q || barcode.includes(q) || name.includes(q)) {
              results.push(product);
              if (results.length >= limit) {
                resolve(results);
                return;
              }
            }
            cursor.continue();
          } else {
            resolve(results);
          }
        };
        request.onerror = () => {
          resolve(this.searchInMemory(q, limit));
        };
      });
    } catch {
      return this.searchInMemory(q, limit);
    }
  },

  searchInMemory(q: string, limit = 40): Product[] {
    if (!memoryCache || !memoryCache.items.length) return [];
    const results: Product[] = [];
    for (const product of memoryCache.items) {
      const barcode = (product.barcode || '').toLowerCase();
      const name = (product.name || '').toLowerCase();
      if (barcode === q || barcode.includes(q) || name.includes(q)) {
        results.push(product);
        if (results.length >= limit) break;
      }
    }
    return results;
  },

  async findProductByBarcode(barcode: string): Promise<Product | null> {
    const code = barcode.trim().toLowerCase();
    if (!code) return null;

    try {
      const db = await openDB();
      const tx = db.transaction(STORE_PRODUCTS, 'readonly');
      const store = tx.objectStore(STORE_PRODUCTS);
      const index = store.index('barcode');
      const request = index.get(barcode.trim());

      return new Promise<Product | null>((resolve) => {
        request.onsuccess = () => {
          if (request.result) {
            resolve(request.result);
          } else {
            // Try matching in-memory or lowercase comparison
            const found = this.searchInMemory(code, 1);
            resolve(found.length ? found[0] : null);
          }
        };
        request.onerror = () => {
          const found = this.searchInMemory(code, 1);
          resolve(found.length ? found[0] : null);
        };
      });
    } catch {
      const found = this.searchInMemory(code, 1);
      return found.length ? found[0] : null;
    }
  },

  async getProductById(id: number | string): Promise<Product | null> {
    try {
      const db = await openDB();
      const tx = db.transaction(STORE_PRODUCTS, 'readonly');
      const store = tx.objectStore(STORE_PRODUCTS);
      const request = store.get(id);

      return new Promise<Product | null>((resolve) => {
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => resolve(null);
      });
    } catch {
      if (memoryCache) {
        return memoryCache.items.find((x) => String(x.id) === String(id)) || null;
      }
      return null;
    }
  },
};
