import React, { useState, useEffect } from 'react';
import { RootData } from '@/types/data';
import { Header } from '@/components/Header';
import { OverviewView } from '@/components/OverviewView';
import { RsRatingView } from '@/components/RsRatingView';
import { VolumeSurgeView } from '@/components/VolumeSurgeView';
import { SectorRotationView } from '@/components/SectorRotationView';
import { HighsView } from '@/components/HighsView';
import { MomentumView } from '@/components/MomentumView';
import { ClustersView } from '@/components/ClustersView';
import { LogView } from '@/components/LogView';
import { PositionSizerView } from '@/components/PositionSizerView';
import { ExpandableTabs } from '@/components/ui/expandable-tabs';
import {
  LayoutDashboard,
  TrendingUp,
  Flame,
  Compass,
  Target,
  Zap,
  Layers,
  FileText,
  Calculator,
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

export default function App() {
  const [data, setData] = useState<RootData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [syncing, setSyncing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<number>(0);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  // Load theme preference
  useEffect(() => {
    try {
      const savedTheme = localStorage.getItem('bl-theme');
      if (savedTheme === 'light' || savedTheme === 'dark') {
        setTheme(savedTheme);
        document.documentElement.classList.toggle('dark', savedTheme === 'dark');
      } else {
        document.documentElement.classList.add('dark');
      }
    } catch {}
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    document.documentElement.classList.toggle('dark', nextTheme === 'dark');
    try {
      localStorage.setItem('bl-theme', nextTheme);
    } catch {}
  };

  const fetchData = async (force: boolean = false) => {
    setLoading(true);
    setError(null);
    try {
      // 1. Proactively ping smart local server to trigger update if today's Bhavcopy is pending
      try {
        const updateEndpoint = force ? '/api/check-update?force=true' : '/api/check-update';
        const updateCheck = await fetch(updateEndpoint, { cache: 'no-store' });
        if (updateCheck.ok) {
          const uJson = await updateCheck.json();
          if (uJson.is_updating || uJson.triggered) {
            setSyncing(true);
            let attempts = 0;
            while (attempts < 60) {
              await new Promise((r) => setTimeout(r, 2000));
              attempts++;
              const poll = await fetch('/api/check-update', { cache: 'no-store' });
              if (poll.ok) {
                const pj = await poll.json();
                if (!pj.is_updating) {
                  break;
                }
              }
            }
            setSyncing(false);
          }
        }
      } catch {
        // Fallback for static hosting without local python daemon
      }

      // 2. Fetch latest data payload
      const res = await fetch('./data/data.json?t=' + Date.now(), { cache: 'no-store' });
      if (!res.ok) {
        // Fallback to root data.json
        const fallbackRes = await fetch('./data.json?t=' + Date.now(), { cache: 'no-store' });
        if (!fallbackRes.ok) throw new Error(`HTTP ${fallbackRes.status}`);
        const json = await fallbackRes.json();
        setData(json);
      } else {
        const json = await res.json();
        setData(json);
      }
    } catch (err: any) {
      console.error('Failed to load data:', err);
      setError(err?.message || 'Failed to load market data.');
    } finally {
      setLoading(false);
      setSyncing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Navigation tabs for ExpandableTabs
  const navTabs = [
    { title: 'Overview', icon: LayoutDashboard },
    { title: 'RS Rating', icon: TrendingUp },
    { title: 'Volume Surge', icon: Flame },
    { title: 'Sector Rotation', icon: Compass },
    { title: '52W Highs', icon: Target },
    { title: 'Momentum', icon: Zap },
    { title: 'Clusters', icon: Layers },
    { type: 'separator' as const },
    { title: 'Session Log', icon: FileText },
    { title: 'Position Sizer', icon: Calculator },
  ];

  // Mapping index with separator skipped:
  // 0 -> Overview
  // 1 -> RS Rating
  // 2 -> 52W Highs
  // 3 -> Momentum
  // 4 -> Clusters
  // 5 is separator
  // 6 -> Session Log
  // 7 -> Position Sizer
  const handleTabChange = (index: number | null) => {
    if (index !== null) {
      setActiveTab(index);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 transition-colors">
      <Header
        data={data}
        theme={theme}
        onToggleTheme={toggleTheme}
        onRefresh={() => fetchData(true)}
        isRefreshing={loading || syncing}
      />

      {syncing && (
        <div className="bg-teal-500/10 border-b border-teal-500/30 text-teal-700 dark:text-teal-300 py-2.5 px-4 text-center text-xs font-mono flex items-center justify-center gap-2">
          <span className="w-2 h-2 rounded-full bg-teal-500 animate-ping" />
          <span>Synchronizing today's official NSE Bhavcopy into Breadth Ledger...</span>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Navigation Tabs Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pb-2">
          <ExpandableTabs
            tabs={navTabs}
            selectedIndex={activeTab}
            onChange={handleTabChange}
            activeColor="text-teal-600 dark:text-teal-400 bg-teal-500/10 dark:bg-teal-500/20"
            className="border-zinc-200 dark:border-zinc-800 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md"
          />

          <div className="hidden sm:flex items-center gap-2 text-xs font-mono text-zinc-400">
            <span>UNIVERSE:</span>
            <span className="font-bold text-teal-600 dark:text-teal-400">
              {data?.universe ?? 1014} EQUITIES
            </span>
          </div>
        </div>

        {/* Content Views */}
        {loading && !data ? (
          <div className="py-24 text-center space-y-3">
            <div className="w-8 h-8 mx-auto border-3 border-teal-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm font-medium text-zinc-500">Loading authentic NSE bhavcopy data...</p>
          </div>
        ) : error && !data ? (
          <div className="py-16 text-center space-y-4 rounded-2xl bg-clay-500/10 border border-clay-500/30 p-8">
            <p className="text-sm font-bold text-clay-500">Error loading data: {error}</p>
            <button
              onClick={fetchData}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-clay-500 text-white"
            >
              Retry
            </button>
          </div>
        ) : data ? (
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              {activeTab === 0 && <OverviewView data={data} />}
              {activeTab === 1 && <RsRatingView rsData={data.rs} />}
              {activeTab === 2 && <VolumeSurgeView items={data.volume_surge} />}
              {activeTab === 3 && <SectorRotationView sectors={data.rotation} />}
              {activeTab === 4 && <HighsView data={data} />}
              {activeTab === 5 && <MomentumView data={data} />}
              {activeTab === 6 && <ClustersView data={data} />}
              {activeTab === 8 && <LogView data={data} />}
              {activeTab === 9 && <PositionSizerView />}
            </motion.div>
          </AnimatePresence>
        ) : null}
      </main>

      {/* Footer */}
      <footer className="mt-16 border-t border-zinc-200 dark:border-zinc-800/80 py-8 text-center text-xs text-zinc-400 font-mono">
        <p>NSE Breadth Ledger · Pure Bhavcopy EOD Pipeline · 100% Unadjusted & Split-Adjusted Equities</p>
      </footer>
    </div>
  );
}
