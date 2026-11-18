import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatSessionDate(
  dateStr: string,
  asOfStr?: string
): { formatted: string; dayOfWeek: string; full: string; isLive: boolean } {
  if (!dateStr) return { formatted: '', dayOfWeek: '', full: '', isLive: false };

  if (dateStr.toLowerCase() === 'live') {
    const d = asOfStr ? new Date(asOfStr) : new Date();
    const formatted = d.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      timeZone: 'Asia/Kolkata',
    });
    const dayOfWeek = d.toLocaleDateString('en-GB', {
      weekday: 'short',
      timeZone: 'Asia/Kolkata',
    });
    return {
      formatted,
      dayOfWeek,
      full: `${formatted} (${dayOfWeek})`,
      isLive: true,
    };
  }

  // Handle YYYYMMDD string (e.g. 20261118)
  if (/^\d{8}$/.test(dateStr)) {
    const y = parseInt(dateStr.slice(0, 4), 10);
    const m = parseInt(dateStr.slice(4, 6), 10) - 1;
    const d = parseInt(dateStr.slice(6, 8), 10);
    const dateObj = new Date(Date.UTC(y, m, d, 12, 0, 0));
    const formatted = dateObj.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    });
    const dayOfWeek = dateObj.toLocaleDateString('en-GB', {
      weekday: 'short',
      timeZone: 'UTC',
    });
    return {
      formatted,
      dayOfWeek,
      full: `${formatted} (${dayOfWeek})`,
      isLive: false,
    };
  }

  // Handle YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
    const [y, m, d] = dateStr.slice(0, 10).split('-').map(Number);
    const dateObj = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
    const formatted = dateObj.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    });
    const dayOfWeek = dateObj.toLocaleDateString('en-GB', {
      weekday: 'short',
      timeZone: 'UTC',
    });
    return {
      formatted,
      dayOfWeek,
      full: `${formatted} (${dayOfWeek})`,
      isLive: false,
    };
  }

  return { formatted: dateStr, dayOfWeek: '', full: dateStr, isLive: false };
}

