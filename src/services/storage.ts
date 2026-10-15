import { Preferences } from '@capacitor/preferences';

const KEYS = {
  SERVER_URL: 'nexus_server_url',
  AUTH_TOKEN: 'nexus_auth_token',
  USER_NAME: 'nexus_user_name',
  USER_ROLE: 'nexus_user_role',
  SHOP_NAME: 'nexus_shop_name',
  LAST_TAB: 'nexus_last_tab',
};

// Safe helper using Capacitor Preferences with localStorage fallback
async function getPref(key: string): Promise<string | null> {
  try {
    const res = await Preferences.get({ key });
    if (res.value !== null && res.value !== undefined) {
      return res.value;
    }
  } catch {
    // Ignore and try fallback
  }

  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

async function setPref(key: string, value: string): Promise<void> {
  try {
    await Preferences.set({ key, value });
  } catch {
    // Fallback
  }

  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage might be full or disabled
  }
}

async function removePref(key: string): Promise<void> {
  try {
    await Preferences.remove({ key });
  } catch {
    // Fallback
  }

  try {
    localStorage.removeItem(key);
  } catch {
    // Fallback
  }
}

export function sanitizeServerUrl(rawUrl: string): string {
  let url = rawUrl.trim();
  if (!url) return '';
  // Remove trailing slashes
  url = url.replace(/\/+$/, '');
  // Add http:// if missing protocol
  if (!/^https?:\/\//i.test(url)) {
    url = `http://${url}`;
  }
  return url;
}

export const StorageService = {
  async getServerUrl(): Promise<string | null> {
    const val = await getPref(KEYS.SERVER_URL);
    return val ? sanitizeServerUrl(val) : null;
  },

  async setServerUrl(url: string): Promise<string> {
    const sanitized = sanitizeServerUrl(url);
    await setPref(KEYS.SERVER_URL, sanitized);
    return sanitized;
  },

  async getToken(): Promise<string | null> {
    return await getPref(KEYS.AUTH_TOKEN);
  },

  async setToken(token: string): Promise<void> {
    await setPref(KEYS.AUTH_TOKEN, token);
  },

  async clearToken(): Promise<void> {
    await removePref(KEYS.AUTH_TOKEN);
  },

  async getUserInfo(): Promise<{ name: string; role: string; shop: string }> {
    const [name, role, shop] = await Promise.all([
      getPref(KEYS.USER_NAME),
      getPref(KEYS.USER_ROLE),
      getPref(KEYS.SHOP_NAME),
    ]);
    return {
      name: name || '',
      role: role || '',
      shop: shop || 'NEXUS POS',
    };
  },

  async setUserInfo(name: string, role: string, shop: string): Promise<void> {
    await Promise.all([
      setPref(KEYS.USER_NAME, name),
      setPref(KEYS.USER_ROLE, role),
      setPref(KEYS.SHOP_NAME, shop),
    ]);
  },

  async clearAuth(): Promise<void> {
    await Promise.all([
      removePref(KEYS.AUTH_TOKEN),
      removePref(KEYS.USER_NAME),
      removePref(KEYS.USER_ROLE),
      removePref(KEYS.SHOP_NAME),
    ]);
  },
};
