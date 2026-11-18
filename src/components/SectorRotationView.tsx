import React, { useState, useMemo } from 'react';
import { RotationSector } from '@/types/data';
import { Compass, TrendingUp, ArrowUpRight, ArrowDownRight, RefreshCw, ExternalLink, ShieldCheck, AlertCircle } from 'lucide-react';

interface SectorRotationViewProps {
  sectors?: RotationSector[];
}

export const SectorRotationView: React.FC<SectorRotationViewProps> = ({ sectors = [] }) => {
  const [selectedQuadrant, setSelectedQuadrant] = useState<string>('all');
  const [horizon, setHorizon] = useState<'g5' | 'g20' | 'g60'>('g20');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const quadrantStats = useMemo(() => {
    const counts = { Leading: 0, Improving: 0, Weakening: 0, Lagging: 0 };
    sectors.forEach((s) => {
      counts[s.quadrant] = (counts[s.quadrant] || 0) + 1;
    });
    return counts;
  }, [sectors]);

  const filteredSectors = useMemo(() => {
    return sectors.filter((s) => {
      const matchQuad = selectedQuadrant === 'all' || s.quadrant.toLowerCase() === selectedQuadrant.toLowerCase();
      const matchSearch = !searchQuery || s.industry.toLowerCase().includes(searchQuery.toLowerCase()) || s.leaders.some(l => l.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchQuad && matchSearch;
    }).sort((a, b) => {
      if (horizon === 'g5') return b.g5 - a.g5;
      if (horizon === 'g20') return b.g20 - a.g20;
      return b.g60 - a.g60;
    });
  }, [sectors, selectedQuadrant, horizon, searchQuery]);

  const quadrantConfig = {
    Leading: {
      color: 'border-emerald-500/40 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400',
      badge: 'bg-emerald-500 text-white',
      title: 'Leading (Institutional Inflow)',
      desc: 'High Relative Strength & Expanding Momentum. Market leadership drivers.',
    },
    Improving: {
      color: 'border-sky-500/40 bg-sky-500/5 text-sky-600 dark:text-sky-400',
      badge: 'bg-sky-500 text-white',
      title: 'Improving (Early Momentum Breakouts)',
      desc: 'RS picking up with short-term strength. The next potential leaders.',
    },
    Weakening: {
      color: 'border-amber-500/40 bg-amber-500/5 text-amber-600 dark:text-amber-400',
      badge: 'bg-amber-500 text-white',
      title: 'Weakening (Momentum Deceleration)',
      desc: 'Strong annual RS but short-term momentum is stalling. Trim or trail stops.',
    },
    Lagging: {
      color: 'border-rose-500/40 bg-rose-500/5 text-rose-600 dark:text-rose-400',
      badge: 'bg-rose-500 text-white',
      title: 'Lagging (Institutional Outflow)',
      desc: 'Sub-par RS & negative momentum. Underperforming capital.',
    },
  };

  return (
    <div className="space-y-6">
      {/* Header Info Banner */}
      <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                <Compass className="w-5 h-5 text-teal-600 dark:text-teal-400" />
                Sector Rotation & Institutional Money Flow Matrix
              </h2>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-teal-500 text-white tracking-wider">
                RRG MODEL
              </span>
            </div>
            <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed max-w-4xl">
              Institutions rotate billions across sectors in cycles (e.g. Defence &rarr; Capital Goods &rarr; Pharma &rarr; IT). This matrix classifies all 66 NSE sub-industries into four momentum phases to help you ride the fastest-moving institutional themes.
            </p>
          </div>
        </div>

        {/* 4 Quadrants Quick Glance */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
          <button
            onClick={() => setSelectedQuadrant(selectedQuadrant === 'leading' ? 'all' : 'leading')}
            className={`p-3 rounded-xl border text-left transition-all ${
              selectedQuadrant === 'leading'
                ? 'border-emerald-500 bg-emerald-500/15 shadow-sm'
                : 'border-zinc-200 dark:border-zinc-800 hover:border-emerald-500/50 bg-zinc-50/50 dark:bg-zinc-950/30'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">LEADING</span>
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
            </div>
            <div className="mt-2 text-2xl font-bold font-mono text-zinc-900 dark:text-white">
              {quadrantStats.Leading}
            </div>
            <div className="text-[11px] text-zinc-500">High RS · Up Momentum</div>
          </button>

          <button
            onClick={() => setSelectedQuadrant(selectedQuadrant === 'improving' ? 'all' : 'improving')}
            className={`p-3 rounded-xl border text-left transition-all ${
              selectedQuadrant === 'improving'
                ? 'border-sky-500 bg-sky-500/15 shadow-sm'
                : 'border-zinc-200 dark:border-zinc-800 hover:border-sky-500/50 bg-zinc-50/50 dark:bg-zinc-950/30'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-sky-600 dark:text-sky-400">IMPROVING</span>
              <span className="w-2 h-2 rounded-full bg-sky-500" />
            </div>
            <div className="mt-2 text-2xl font-bold font-mono text-zinc-900 dark:text-white">
              {quadrantStats.Improving}
            </div>
            <div className="text-[11px] text-zinc-500">Turnarounds · Rising Fast</div>
          </button>

          <button
            onClick={() => setSelectedQuadrant(selectedQuadrant === 'weakening' ? 'all' : 'weakening')}
            className={`p-3 rounded-xl border text-left transition-all ${
              selectedQuadrant === 'weakening'
                ? 'border-amber-500 bg-amber-500/15 shadow-sm'
                : 'border-zinc-200 dark:border-zinc-800 hover:border-amber-500/50 bg-zinc-50/50 dark:bg-zinc-950/30'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">WEAKENING</span>
              <span className="w-2 h-2 rounded-full bg-amber-500" />
            </div>
            <div className="mt-2 text-2xl font-bold font-mono text-zinc-900 dark:text-white">
              {quadrantStats.Weakening}
            </div>
            <div className="text-[11px] text-zinc-500">High RS · Losing Steam</div>
          </button>

          <button
            onClick={() => setSelectedQuadrant(selectedQuadrant === 'lagging' ? 'all' : 'lagging')}
            className={`p-3 rounded-xl border text-left transition-all ${
              selectedQuadrant === 'lagging'
                ? 'border-rose-500 bg-rose-500/15 shadow-sm'
                : 'border-zinc-200 dark:border-zinc-800 hover:border-rose-500/50 bg-zinc-50/50 dark:bg-zinc-950/30'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-rose-600 dark:text-rose-400">LAGGING</span>
              <span className="w-2 h-2 rounded-full bg-rose-500" />
            </div>
            <div className="mt-2 text-2xl font-bold font-mono text-zinc-900 dark:text-white">
              {quadrantStats.Lagging}
            </div>
            <div className="text-[11px] text-zinc-500">Low RS · Capital Exiting</div>
          </button>
        </div>

        {/* Filter Toolbar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search sector or leader (e.g. Pharma, TBZ)..."
              className="px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-xs w-full sm:w-64 focus:ring-2 focus:ring-teal-500 outline-none"
            />
            {selectedQuadrant !== 'all' && (
              <button
                onClick={() => setSelectedQuadrant('all')}
                className="text-xs text-teal-600 dark:text-teal-400 hover:underline whitespace-nowrap font-medium"
              >
                Clear Filter
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-500 font-medium">Rank By Momentum:</span>
            <div className="flex items-center gap-1 p-1 rounded-xl bg-zinc-100 dark:bg-zinc-800">
              <button
                onClick={() => setHorizon('g5')}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium ${
                  horizon === 'g5' ? 'bg-white dark:bg-zinc-900 shadow-xs font-bold text-teal-600 dark:text-teal-400' : 'text-zinc-500'
                }`}
              >
                5 Days
              </button>
              <button
                onClick={() => setHorizon('g20')}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium ${
                  horizon === 'g20' ? 'bg-white dark:bg-zinc-900 shadow-xs font-bold text-teal-600 dark:text-teal-400' : 'text-zinc-500'
                }`}
              >
                20 Days
              </button>
              <button
                onClick={() => setHorizon('g60')}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium ${
                  horizon === 'g60' ? 'bg-white dark:bg-zinc-900 shadow-xs font-bold text-teal-600 dark:text-teal-400' : 'text-zinc-500'
                }`}
              >
                60 Days
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Sectors Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredSectors.map((sector) => {
          const qConf = quadrantConfig[sector.quadrant] || quadrantConfig.Leading;
          const returnVal = horizon === 'g5' ? sector.g5 : horizon === 'g20' ? sector.g20 : sector.g60;

          return (
            <div
              key={sector.industry}
              className="p-5 rounded-2xl bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 shadow-sm flex flex-col justify-between space-y-4 transition-all hover:border-zinc-300 dark:hover:border-zinc-700"
            >
              <div>
                {/* Top Badge & Status */}
                <div className="flex items-center justify-between gap-2">
                  <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold tracking-wider uppercase ${qConf.badge}`}>
                    {sector.quadrant}
                  </span>
                  <div className="flex items-center gap-1.5 font-mono text-xs font-bold">
                    <span className="text-zinc-500">Avg RS:</span>
                    <span className="text-teal-600 dark:text-teal-400 font-extrabold">{sector.avg_rs}</span>
                  </div>
                </div>

                {/* Industry Name */}
                <div className="mt-3">
                  <h3 className="font-bold text-base text-zinc-900 dark:text-white tracking-tight">
                    {sector.industry}
                  </h3>
                  <p className="text-xs text-zinc-500 font-mono mt-0.5">{sector.n} tracked equities</p>
                </div>

                {/* Returns Matrix */}
                <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-zinc-100 dark:border-zinc-800/80 text-center font-mono">
                  <div className="p-2 rounded-lg bg-zinc-50 dark:bg-zinc-950/50">
                    <div className="text-[10px] text-zinc-400">5D GAIN</div>
                    <div className={`text-xs font-bold ${sector.g5 >= 0 ? 'text-teal-600 dark:text-teal-400' : 'text-clay-500'}`}>
                      {sector.g5 >= 0 ? '+' : ''}{sector.g5.toFixed(1)}%
                    </div>
                  </div>
                  <div className="p-2 rounded-lg bg-zinc-50 dark:bg-zinc-950/50">
                    <div className="text-[10px] text-zinc-400">20D GAIN</div>
                    <div className={`text-xs font-bold ${sector.g20 >= 0 ? 'text-teal-600 dark:text-teal-400' : 'text-clay-500'}`}>
                      {sector.g20 >= 0 ? '+' : ''}{sector.g20.toFixed(1)}%
                    </div>
                  </div>
                  <div className="p-2 rounded-lg bg-zinc-50 dark:bg-zinc-950/50">
                    <div className="text-[10px] text-zinc-400">60D GAIN</div>
                    <div className={`text-xs font-bold ${sector.g60 >= 0 ? 'text-teal-600 dark:text-teal-400' : 'text-clay-500'}`}>
                      {sector.g60 >= 0 ? '+' : ''}{sector.g60.toFixed(1)}%
                    </div>
                  </div>
                </div>
              </div>

              {/* Leaders Pills */}
              <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800/80">
                <div className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-2">
                  Top Sector Leaders
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {sector.leaders.map((sym) => (
                    <a
                      key={sym}
                      href={`https://in.tradingview.com/chart/?symbol=NSE:${encodeURIComponent(sym)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-mono font-medium bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 transition-colors"
                    >
                      {sym} <ExternalLink className="w-2.5 h-2.5 opacity-50" />
                    </a>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
