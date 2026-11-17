import React from 'react';
import { RootData } from '@/types/data';
import { Sun, Moon, RefreshCw, ExternalLink, Activity } from 'lucide-react';

interface HeaderProps {
  data: RootData | null;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  onRefresh: () => void;
  isRefreshing: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  data,
  theme,
  onToggleTheme,
  onRefresh,
  isRefreshing,
}) => {
  const asOfDate = data ? new Date(data.asOf) : new Date();
  const istDateStr = asOfDate.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  });
  const istTimeStr = asOfDate.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Kolkata',
  });

  const ix = data?.indexChg || {};
  const niftyChg = ix.nifty ?? data?.nifty?.chg ?? 0;
  const midcapChg = ix.midcap ?? 0;
  const smallcapChg = ix.smallcap ?? 0;
  const vixChg = ix.vix ?? 0;

  return (
    <header className="sticky top-0 z-40 w-full border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-teal-600 to-teal-400 flex items-center justify-center text-white shadow-md shadow-teal-500/20">
              <Activity className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-zinc-900 to-zinc-600 dark:from-white dark:to-zinc-400 bg-clip-text text-transparent">
                  NSE Breadth Ledger
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-pulse"></span>
                  LIVE EOD
                </span>
              </div>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-mono">
                {istDateStr} · {istTimeStr} IST · {data?.universe ?? 1014} liquid stocks
              </p>
            </div>
          </div>

          {/* Indices Ticker */}
          <div className="hidden lg:flex items-center gap-6 font-mono text-xs">
            <div className="flex items-center gap-1.5">
              <span className="text-zinc-500 dark:text-zinc-400">NIFTY 50</span>
              <span className={`font-semibold ${niftyChg >= 0 ? 'text-teal-600 dark:text-teal-400' : 'text-clay-500'}`}>
                {niftyChg >= 0 ? '+' : ''}{niftyChg.toFixed(2)}%
              </span>
            </div>
            <div className="w-px h-3.5 bg-zinc-200 dark:bg-zinc-800" />
            <div className="flex items-center gap-1.5">
              <span className="text-zinc-500 dark:text-zinc-400">MIDCAP</span>
              <span className={`font-semibold ${midcapChg >= 0 ? 'text-teal-600 dark:text-teal-400' : 'text-clay-500'}`}>
                {midcapChg >= 0 ? '+' : ''}{midcapChg.toFixed(2)}%
              </span>
            </div>
            <div className="w-px h-3.5 bg-zinc-200 dark:bg-zinc-800" />
            <div className="flex items-center gap-1.5">
              <span className="text-zinc-500 dark:text-zinc-400">SMALLCAP</span>
              <span className={`font-semibold ${smallcapChg >= 0 ? 'text-teal-600 dark:text-teal-400' : 'text-clay-500'}`}>
                {smallcapChg >= 0 ? '+' : ''}{smallcapChg.toFixed(2)}%
              </span>
            </div>
            <div className="w-px h-3.5 bg-zinc-200 dark:bg-zinc-800" />
            <div className="flex items-center gap-1.5">
              <span className="text-zinc-500 dark:text-zinc-400">INDIA VIX</span>
              <span className={`font-semibold ${vixChg <= 0 ? 'text-teal-600 dark:text-teal-400' : 'text-clay-500'}`}>
                {vixChg >= 0 ? '+' : ''}{vixChg.toFixed(2)}%
              </span>
            </div>
          </div>

          {/* Actions & Theme */}
          <div className="flex items-center gap-2">
            <button
              onClick={onRefresh}
              disabled={isRefreshing}
              className="p-2 rounded-lg text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              title="Refresh Data"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onToggleTheme}
              className="p-2 rounded-lg text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              title="Toggle Theme"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <a
              href="https://github.com/pnikam298-source/nse-breadth-ledger"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 transition-colors"
            >
              GitHub <ExternalLink className="w-3 h-3 opacity-60" />
            </a>
          </div>
        </div>
      </div>
    </header>
  );
};
