import React, { useState, useEffect, useRef } from 'react';
import {
  Clock,
  LogIn,
  LogOut,
  AlertTriangle,
  RotateCw,
  Flame,
  ShieldAlert,
  HeartPulse,
  HelpCircle,
  CheckCircle2,
} from 'lucide-react';
import { Attendance, SosKind } from '../types';
import { StaffApi } from '../api/staff';

interface HomeScreenProps {
  shopName: string;
  staffName: string;
  attendance: Attendance | null;
  onRefreshAttendance: () => Promise<void>;
  onTriggerSos: (kind?: SosKind) => void;
  waitingAlertsCount: number;
  onNotification: (msg: string, isError?: boolean) => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  shopName,
  staffName,
  attendance,
  onRefreshAttendance,
  onTriggerSos,
  waitingAlertsCount,
  onNotification,
}) => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isUpdatingAttendance, setIsUpdatingAttendance] = useState(false);

  // Pull to refresh gesture support
  const [pullDistance, setPullDistance] = useState(0);
  const touchStartY = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (containerRef.current && containerRef.current.scrollTop === 0) {
      touchStartY.current = e.touches[0].clientY;
    } else {
      touchStartY.current = 0;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartY.current > 0) {
      const currentY = e.touches[0].clientY;
      const distance = Math.max(0, currentY - touchStartY.current);
      if (distance > 0 && distance < 120) {
        setPullDistance(distance);
      }
    }
  };

  const handleTouchEnd = async () => {
    if (pullDistance > 60) {
      await handleManualRefresh();
    }
    setPullDistance(0);
    touchStartY.current = 0;
  };

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      await onRefreshAttendance();
      onNotification('Refreshed data from PC', false);
    } catch (err: any) {
      onNotification(err.message || 'Refresh failed', true);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleAttendanceAction = async (action: 'in' | 'out') => {
    setIsUpdatingAttendance(true);
    try {
      const updated = await StaffApi.markAttendance(action);
      onNotification(
        action === 'in' ? 'Successfully checked in' : 'Successfully checked out',
        false
      );
      await onRefreshAttendance();
    } catch (err: any) {
      // 409 if already checked in or not in
      onNotification(err.message || `Could not check ${action}`, true);
    } finally {
      setIsUpdatingAttendance(false);
    }
  };

  const formatTime = (isoString?: string) => {
    if (!isoString) return '';
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return isoString.slice(11, 16);
    }
  };

  const getAttendanceSummary = () => {
    if (!attendance) return 'Not checked in today';
    if (attendance.state === 'IN') {
      return `Checked in at ${formatTime(attendance.checkIn)}`;
    }
    if (attendance.state === 'OUT') {
      return `Checked out at ${formatTime(attendance.checkOut)}`;
    }
    return 'Not checked in today';
  };

  return (
    <div
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className="min-h-full pb-28 pt-2 px-4 max-w-md mx-auto space-y-4"
    >
      {/* Pull to refresh visual indicator */}
      {pullDistance > 0 && (
        <div
          style={{ height: `${pullDistance}px` }}
          className="flex items-center justify-center overflow-hidden transition-all text-xs font-semibold text-slate-500"
        >
          <RotateCw
            className={`w-5 h-5 text-blue-600 ${pullDistance > 60 ? 'animate-spin' : ''}`}
          />
        </div>
      )}

      {/* Greeting Banner */}
      <div className="flex items-center justify-between py-1">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
            Welcome, {staffName || 'Staff'}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {shopName || 'Retail Store POS'}
          </p>
        </div>
        <button
          onClick={handleManualRefresh}
          disabled={isRefreshing}
          className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
          aria-label="Refresh Attendance"
          type="button"
        >
          <RotateCw className={`w-5 h-5 ${isRefreshing ? 'animate-spin text-blue-600' : ''}`} />
        </button>
      </div>

      {/* Attendance Card */}
      <section className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Attendance</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {getAttendanceSummary()}
              </p>
            </div>
          </div>

          {attendance?.state === 'IN' && (
            <span className="flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2.5 py-1 rounded-full">
              <CheckCircle2 className="w-3.5 h-3.5" />
              On Duty
            </span>
          )}
        </div>

        {/* Big Touch Buttons: Check in / Check out */}
        <div className="grid grid-cols-2 gap-3 pt-1">
          <button
            type="button"
            disabled={isUpdatingAttendance || attendance?.state === 'IN'}
            onClick={() => handleAttendanceAction('in')}
            className={`min-h-[56px] px-3 py-3 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-all shadow-sm ${
              attendance?.state === 'IN'
                ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed opacity-75'
                : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20'
            }`}
          >
            <LogIn className="w-5 h-5" />
            <span>Check In</span>
          </button>

          <button
            type="button"
            disabled={isUpdatingAttendance || attendance?.state !== 'IN'}
            onClick={() => handleAttendanceAction('out')}
            className={`min-h-[56px] px-3 py-3 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-all shadow-sm ${
              attendance?.state !== 'IN'
                ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed opacity-75'
                : 'bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 text-white'
            }`}
          >
            <LogOut className="w-5 h-5" />
            <span>Check Out</span>
          </button>
        </div>
      </section>

      {/* Emergency SOS Card */}
      <section className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Emergency Alerts
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Instantly notifies the owner and shop computer
              </p>
            </div>
          </div>
        </div>

        {/* 4 Large Red Buttons */}
        <div className="grid grid-cols-2 gap-3 pt-1">
          <button
            type="button"
            onClick={() => onTriggerSos('HELP')}
            className="min-h-[64px] p-3 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-sm shadow-rose-600/20 active:scale-[0.97] transition-all"
          >
            <HelpCircle className="w-5 h-5 shrink-0" />
            <span>Need Help</span>
          </button>

          <button
            type="button"
            onClick={() => onTriggerSos('THEFT')}
            className="min-h-[64px] p-3 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-sm shadow-rose-600/20 active:scale-[0.97] transition-all"
          >
            <ShieldAlert className="w-5 h-5 shrink-0" />
            <span>Theft</span>
          </button>

          <button
            type="button"
            onClick={() => onTriggerSos('FIRE')}
            className="min-h-[64px] p-3 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-sm shadow-rose-600/20 active:scale-[0.97] transition-all"
          >
            <Flame className="w-5 h-5 shrink-0" />
            <span>Fire</span>
          </button>

          <button
            type="button"
            onClick={() => onTriggerSos('MEDICAL')}
            className="min-h-[64px] p-3 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-sm shadow-rose-600/20 active:scale-[0.97] transition-all"
          >
            <HeartPulse className="w-5 h-5 shrink-0" />
            <span>Medical</span>
          </button>
        </div>

        {/* Waiting alerts message if any */}
        {waitingAlertsCount > 0 && (
          <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 flex items-center justify-between text-xs text-amber-800 dark:text-amber-300">
            <span className="font-semibold">
              {waitingAlertsCount} alert(s) waiting to be sent
            </span>
            <span className="text-[11px] text-amber-600 dark:text-amber-400">Retrying every 15s</span>
          </div>
        )}
      </section>

      {/* Quick Tips / Instructions */}
      <div className="px-2 text-center text-xs text-slate-500 dark:text-slate-400 space-y-1">
        <p>Use the persistent red SOS button on any screen during an emergency.</p>
      </div>
    </div>
  );
};
