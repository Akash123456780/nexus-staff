import React, { useState } from 'react';
import { LogIn, Eye, EyeOff, Server, AlertCircle, Loader2 } from 'lucide-react';
import { StaffApi } from '../api/staff';
import { StorageService } from '../services/storage';
import { CatalogService } from '../services/catalog';

interface LoginScreenProps {
  serverUrl: string;
  onLoginSuccess: (userInfo: { name: string; role: string; shop: string }) => void;
  onEditServer: () => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({
  serverUrl,
  onLoginSuccess,
  onEditServer,
}) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!username.trim() || !password) {
      setErrorMessage('Please enter both username and password.');
      return;
    }

    setErrorMessage('');
    setIsLoading(true);

    try {
      const data = await StaffApi.login(username.trim(), password);

      // Store token and user info in Preferences
      await StorageService.setToken(data.token);
      await StorageService.setUserInfo(data.name, data.role, data.shop);

      // Download catalog right after login as per specification
      StaffApi.getCatalog()
        .then((cat) => {
          if (cat && cat.items) {
            CatalogService.saveCatalog(cat.items, cat.at);
          }
        })
        .catch(() => {
          // Can be fetched again later
        });

      onLoginSuccess({
        name: data.name,
        role: data.role,
        shop: data.shop,
      });
    } catch (err: any) {
      setErrorMessage(err.message || 'Login failed. Please check credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-between bg-slate-50 dark:bg-slate-950 p-6 pt-safe pb-safe max-w-md mx-auto">
      <div className="space-y-6 pt-6">
        {/* App Title & Server Pill */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black tracking-widest uppercase text-blue-600 dark:text-blue-400">
              NEXUS POS
            </span>
            <button
              type="button"
              onClick={onEditServer}
              className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300 transition-colors"
            >
              <Server className="w-3 h-3 text-slate-500" />
              <span className="max-w-[140px] truncate font-mono text-[11px]">{serverUrl}</span>
            </button>
          </div>

          <h1 className="text-3xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
            Staff Sign In
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Sign in with your POS staff account to manage attendance, live scan, and handle emergency bills.
          </p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleLogin} className="space-y-4 pt-2">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                setErrorMessage('');
              }}
              placeholder="e.g. staff1"
              autoCapitalize="none"
              autoComplete="username"
              spellCheck="false"
              className="w-full h-14 px-4 text-base rounded-2xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-xs"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setErrorMessage('');
                }}
                placeholder="Enter your password"
                autoComplete="current-password"
                className="w-full h-14 pl-4 pr-12 text-base rounded-2xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-xs"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {errorMessage && (
            <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900/60 flex items-start gap-2.5 text-rose-700 dark:text-rose-300 text-xs font-medium leading-relaxed">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}
        </form>
      </div>

      <div className="pt-6">
        <button
          type="button"
          onClick={() => handleLogin()}
          disabled={isLoading}
          className="w-full h-14 rounded-2xl bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white font-bold text-base flex items-center justify-center gap-2 shadow-lg shadow-blue-600/25 transition-all disabled:opacity-60"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Signing in...</span>
            </>
          ) : (
            <>
              <LogIn className="w-5 h-5" />
              <span>Sign In</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
