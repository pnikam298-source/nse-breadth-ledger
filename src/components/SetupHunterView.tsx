import React, { useState, useMemo } from 'react';
import { SetupItem } from '@/types/data';
import { Sparkles, Flag, Target, ExternalLink, Download, Copy, Check, Filter, ArrowUpRight, ShieldCheck, Zap } from 'lucide-react';

interface SetupHunterViewProps {
  setups?: SetupItem[];
}

export const SetupHunterView: React.FC<SetupHunterViewProps> = ({ setups = [] }) => {
  const [selectedType, setSelectedType] = useState<string>('all');
  const [minRs, setMinRs] = useState<number>(80);
  const [maxDist, setMaxDist] = useState<number>(12);
  const [maxTightness, setMaxTightness] = useState<number>(12);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');

  // Counts
  const htfCount = useMemo(() => setups.filter((s) => s.setup_type === 'High-Tight Flag').length, [setups]);
  const baseCount = useMemo(() => setups.filter((s) => s.setup_type === '52W Tight Base').length, [setups]);

  // Filtering
  const filtered = useMemo(() => {
    return setups.filter((s) => {
      if (selectedType !== 'all' && s.setup_type !== selectedType) return false;
      if (s.rs < minRs) return false;
      if (Math.abs(s.dist_52w) > maxDist) return false;
      if (s.tightness_15d > maxTightness) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return s.symbol.toLowerCase().includes(q) || s.industry.toLowerCase().includes(q);
      }
      return true;
    }).sort((a, b) => {
      // Sort by tightest base first, then highest RS
      if (a.tightness_15d !== b.tightness_15d) return a.tightness_15d - b.tightness_15d;
      return b.rs - a.rs;
    });
  }, [setups, selectedType, minRs, maxDist, maxTightness, searchQuery]);

  const handleCopyTv = () => {
    const symbols = filtered.map((s) => `NSE:${s.symbol}`).join(',');
    navigator.clipboard.writeText(symbols);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadCsv = () => {
    const headers = ['Symbol', 'Setup Type', 'RS Rating', 'Close Price', 'Dist to 52W High %', '15d Tightness %', '20d Gain %', '60d Gain %', 'Industry'];
    const rows = filtered.map((s) => [
      s.symbol,
      `"${s.setup_type}"`,
      s.rs,
      s.close,
      s.dist_52w,
      s.tightness_15d,
      s.gain_20d,
      s.gain_60d,
      `"${s.industry}"`,
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `nse_leaderboard_setups_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Header Info Banner */}
      <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-500" />
                Leaderboard Setup Hunter (High-Tight Flags & 52W Bases)
              </h2>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500 text-black tracking-wider">
                VCP SCANNER
              </span>
            </div>
            <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed max-w-4xl">
              Modeled after <strong>William O&apos;Neil</strong>, <strong>Mark Minervini</strong>, and <strong>David Ryan</strong>. Screens for institutional market leaders (RS &ge; 75) that are tightly coiling within 15% of 52-week highs (15-day range contraction &le; 12%) above their 50-day moving average.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start md:self-auto">
            <button
              onClick={handleCopyTv}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/80 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-xs font-medium text-zinc-700 dark:text-zinc-300 transition-colors"
              title="Copy symbol watchlist for TradingView"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied Watchlist!' : 'Copy for TradingView'}
            </button>
            <button
              onClick={handleDownloadCsv}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/80 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-xs font-medium text-zinc-700 dark:text-zinc-300 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              CSV
            </button>
          </div>
        </div>

        {/* Setup KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
          <button
            onClick={() => setSelectedType('all')}
            className={`p-3 rounded-xl border text-left transition-all ${
              selectedType === 'all'
                ? 'border-teal-500 bg-teal-500/10 shadow-sm'
                : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-950/30'
            }`}
          >
            <div className="text-[11px] font-medium text-zinc-500">All Setups</div>
            <div className="mt-1 text-2xl font-bold font-mono text-zinc-900 dark:text-white">
              {setups.length}
            </div>
            <div className="text-[10px] text-teal-600 dark:text-teal-400">RS &ge; 75 · Tight &le; 15%</div>
          </button>

          <button
            onClick={() => setSelectedType(selectedType === 'High-Tight Flag' ? 'all' : 'High-Tight Flag')}
            className={`p-3 rounded-xl border text-left transition-all ${
              selectedType === 'High-Tight Flag'
                ? 'border-amber-500 bg-amber-500/10 shadow-sm'
                : 'border-zinc-200 dark:border-zinc-800 hover:border-amber-500/50 bg-zinc-50/50 dark:bg-zinc-950/30'
            }`}
          >
            <div className="flex items-center justify-between text-[11px] font-medium text-amber-600 dark:text-amber-400">
              <span className="flex items-center gap-1"><Flag className="w-3 h-3" /> High-Tight Flags</span>
              <Zap className="w-3 h-3 text-amber-500" />
            </div>
            <div className="mt-1 text-2xl font-bold font-mono text-zinc-900 dark:text-white">
              {htfCount}
            </div>
            <div className="text-[10px] text-zinc-500">+25% to +50% Prior Run</div>
          </button>

          <button
            onClick={() => setSelectedType(selectedType === '52W Tight Base' ? 'all' : '52W Tight Base')}
            className={`p-3 rounded-xl border text-left transition-all ${
              selectedType === '52W Tight Base'
                ? 'border-teal-500 bg-teal-500/10 shadow-sm'
                : 'border-zinc-200 dark:border-zinc-800 hover:border-teal-500/50 bg-zinc-50/50 dark:bg-zinc-950/30'
            }`}
          >
            <div className="flex items-center justify-between text-[11px] font-medium text-teal-600 dark:text-teal-400">
              <span className="flex items-center gap-1"><Target className="w-3 h-3" /> 52W Tight Base</span>
            </div>
            <div className="mt-1 text-2xl font-bold font-mono text-zinc-900 dark:text-white">
              {baseCount}
            </div>
            <div className="text-[10px] text-zinc-500">Near Peak Consolidation</div>
          </button>

          <div className="p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/30 text-left">
            <div className="text-[11px] font-medium text-zinc-500">Filtered Matches</div>
            <div className="mt-1 text-2xl font-bold font-mono text-teal-600 dark:text-teal-400">
              {filtered.length}
            </div>
            <div className="text-[10px] text-zinc-500">Ready for Execution</div>
          </div>
        </div>
      </div>

      {/* Interactive Controls & Filters */}
      <div className="p-4 rounded-xl bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-zinc-500" />
            <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Scanner Criteria:</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode('cards')}
              className={`px-2.5 py-1 text-xs rounded-md font-medium transition-colors ${
                viewMode === 'cards'
                  ? 'bg-teal-500 text-white'
                  : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900'
              }`}
            >
              Card View
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`px-2.5 py-1 text-xs rounded-md font-medium transition-colors ${
                viewMode === 'table'
                  ? 'bg-teal-500 text-white'
                  : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900'
              }`}
            >
              Table View
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 pt-1">
          {/* Min RS */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-zinc-600 dark:text-zinc-400">
              <span>Min Relative Strength (RS)</span>
              <span className="font-mono font-bold text-teal-600 dark:text-teal-400">&ge; {minRs}</span>
            </div>
            <input
              type="range"
              min={75}
              max={95}
              step={1}
              value={minRs}
              onChange={(e) => setMinRs(Number(e.target.value))}
              className="w-full accent-teal-500 h-1.5 bg-zinc-200 dark:bg-zinc-800 rounded-lg appearance-none cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-zinc-400 font-mono">
              <span>75</span>
              <span>80</span>
              <span>85</span>
              <span>95</span>
            </div>
          </div>

          {/* Max Dist from 52W High */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-zinc-600 dark:text-zinc-400">
              <span>Max Dist to 52W High</span>
              <span className="font-mono font-bold text-teal-600 dark:text-teal-400">&le; {maxDist}%</span>
            </div>
            <input
              type="range"
              min={3}
              max={15}
              step={1}
              value={maxDist}
              onChange={(e) => setMaxDist(Number(e.target.value))}
              className="w-full accent-teal-500 h-1.5 bg-zinc-200 dark:bg-zinc-800 rounded-lg appearance-none cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-zinc-400 font-mono">
              <span>3%</span>
              <span>7%</span>
              <span>10%</span>
              <span>15%</span>
            </div>
          </div>

          {/* 15d Range Tightness */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-zinc-600 dark:text-zinc-400">
              <span>15d Base Tightness (VCP)</span>
              <span className="font-mono font-bold text-teal-600 dark:text-teal-400">&le; {maxTightness}%</span>
            </div>
            <input
              type="range"
              min={5}
              max={15}
              step={0.5}
              value={maxTightness}
              onChange={(e) => setMaxTightness(Number(e.target.value))}
              className="w-full accent-teal-500 h-1.5 bg-zinc-200 dark:bg-zinc-800 rounded-lg appearance-none cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-zinc-400 font-mono">
              <span>5% (Extremely Tight)</span>
              <span>10%</span>
              <span>15%</span>
            </div>
          </div>

          {/* Search box */}
          <div className="space-y-1.5">
            <label className="text-xs text-zinc-600 dark:text-zinc-400 block">Search Symbol or Industry</label>
            <input
              type="text"
              placeholder="e.g. SONACOMS, Pharma..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-xs text-zinc-800 dark:text-zinc-200 placeholder-zinc-400 focus:outline-none focus:border-teal-500"
            />
          </div>
        </div>
      </div>

      {/* Main Results Display */}
      {filtered.length === 0 ? (
        <div className="p-12 text-center rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60">
          <Sparkles className="w-8 h-8 text-zinc-400 mx-auto mb-2 opacity-50" />
          <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">No Setups Match Current Filters</h3>
          <p className="text-xs text-zinc-500 mt-1">
            Try relaxing your filter parameters (lower Min RS to 75 or increase Max Base Tightness to 15%).
          </p>
        </div>
      ) : viewMode === 'cards' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((item) => {
            const isHtf = item.setup_type === 'High-Tight Flag';
            return (
              <div
                key={item.symbol}
                className="p-5 rounded-2xl bg-white dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-800 hover:border-teal-500/50 transition-all hover:shadow-md space-y-4 flex flex-col justify-between"
              >
                <div>
                  {/* Top row: Symbol, Badge, TradingView Link */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-base text-zinc-900 dark:text-white">
                          {item.symbol}
                        </span>
                        <a
                          href={`https://in.tradingview.com/chart/?symbol=NSE:${item.symbol}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-zinc-400 hover:text-teal-500 transition-colors"
                          title="Open Chart in TradingView"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>
                      <div className="text-xs text-zinc-500 truncate max-w-[200px]" title={item.industry}>
                        {item.industry}
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          isHtf
                            ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                            : 'bg-teal-500/15 text-teal-600 dark:text-teal-400 border border-teal-500/30'
                        }`}
                      >
                        {item.setup_type}
                      </span>
                      <div className="text-xs font-mono font-semibold text-zinc-700 dark:text-zinc-300">
                        ₹{item.close.toLocaleString('en-IN', { maximumFractionDigits: 1 })}
                      </div>
                    </div>
                  </div>

                  {/* Metrics grid */}
                  <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800/80 text-center">
                    <div className="p-2 rounded-lg bg-zinc-50 dark:bg-zinc-950/50">
                      <div className="text-[10px] text-zinc-500">RS Rating</div>
                      <div className="font-mono font-bold text-sm text-teal-600 dark:text-teal-400">
                        {item.rs}
                      </div>
                    </div>
                    <div className="p-2 rounded-lg bg-zinc-50 dark:bg-zinc-950/50">
                      <div className="text-[10px] text-zinc-500">Dist to 52W</div>
                      <div className="font-mono font-bold text-sm text-zinc-800 dark:text-zinc-200">
                        {item.dist_52w >= 0 ? '0.0%' : `${item.dist_52w.toFixed(1)}%`}
                      </div>
                    </div>
                    <div className="p-2 rounded-lg bg-zinc-50 dark:bg-zinc-950/50">
                      <div className="text-[10px] text-zinc-500">15d Tightness</div>
                      <div className="font-mono font-bold text-sm text-emerald-600 dark:text-emerald-400">
                        {item.tightness_15d.toFixed(1)}%
                      </div>
                    </div>
                  </div>

                  {/* Tightness Visual Bar */}
                  <div className="mt-3 space-y-1">
                    <div className="flex justify-between text-[10px] text-zinc-500">
                      <span>Base Volatility Compression</span>
                      <span className="font-mono">{item.tightness_15d.toFixed(1)}% / 15%</span>
                    </div>
                    <div className="h-1.5 w-full bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full"
                        style={{ width: `${Math.min(100, (item.tightness_15d / 15) * 100)}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Bottom row: Prior Momentum Run */}
                <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between text-xs text-zinc-500">
                  <span>Prior Run (20d / 60d):</span>
                  <span className="font-mono font-semibold text-zinc-700 dark:text-zinc-300">
                    <span className={item.gain_20d >= 0 ? 'text-emerald-500' : 'text-rose-500'}>
                      {item.gain_20d >= 0 ? '+' : ''}{item.gain_20d.toFixed(1)}%
                    </span>
                    {' / '}
                    <span className={item.gain_60d >= 0 ? 'text-emerald-500' : 'text-rose-500'}>
                      {item.gain_60d >= 0 ? '+' : ''}{item.gain_60d.toFixed(1)}%
                    </span>
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Table View */
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-50 dark:bg-zinc-950/60 border-b border-zinc-200 dark:border-zinc-800 text-zinc-500 font-medium">
                <tr>
                  <th className="py-3 px-4">Symbol</th>
                  <th className="py-3 px-4">Setup Type</th>
                  <th className="py-3 px-4 text-center">RS Rating</th>
                  <th className="py-3 px-4 text-right">Close (₹)</th>
                  <th className="py-3 px-4 text-right">Dist 52W</th>
                  <th className="py-3 px-4 text-right">15d Tightness</th>
                  <th className="py-3 px-4 text-right">20d Return</th>
                  <th className="py-3 px-4 text-right">60d Return</th>
                  <th className="py-3 px-4">Industry</th>
                  <th className="py-3 px-4 text-center">Chart</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60 text-zinc-700 dark:text-zinc-300">
                {filtered.map((item) => (
                  <tr key={item.symbol} className="hover:bg-zinc-50/80 dark:hover:bg-zinc-800/30 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-zinc-900 dark:text-white">
                      {item.symbol}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          item.setup_type === 'High-Tight Flag'
                            ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                            : 'bg-teal-500/15 text-teal-600 dark:text-teal-400'
                        }`}
                      >
                        {item.setup_type}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center font-mono font-bold text-teal-600 dark:text-teal-400">
                      {item.rs}
                    </td>
                    <td className="py-3 px-4 text-right font-mono">
                      ₹{item.close.toLocaleString('en-IN', { maximumFractionDigits: 1 })}
                    </td>
                    <td className="py-3 px-4 text-right font-mono">
                      {item.dist_52w >= 0 ? '0.0%' : `${item.dist_52w.toFixed(1)}%`}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      {item.tightness_15d.toFixed(1)}%
                    </td>
                    <td className={`py-3 px-4 text-right font-mono ${item.gain_20d >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                      {item.gain_20d >= 0 ? '+' : ''}{item.gain_20d.toFixed(1)}%
                    </td>
                    <td className={`py-3 px-4 text-right font-mono ${item.gain_60d >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                      {item.gain_60d >= 0 ? '+' : ''}{item.gain_60d.toFixed(1)}%
                    </td>
                    <td className="py-3 px-4 text-zinc-500 truncate max-w-[180px]">
                      {item.industry}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <a
                        href={`https://in.tradingview.com/chart/?symbol=NSE:${item.symbol}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center text-teal-500 hover:text-teal-400"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Institutional Playbook Guide */}
      <div className="p-5 rounded-2xl bg-zinc-50 dark:bg-zinc-950/40 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-600 dark:text-zinc-400 space-y-2">
        <div className="flex items-center gap-1.5 font-bold text-zinc-800 dark:text-zinc-200">
          <ShieldCheck className="w-4 h-4 text-teal-500" />
          The Institutional Playbook: How to Trade These Setups
        </div>
        <p className="leading-relaxed">
          <strong>1. High-Tight Flag (HTF):</strong> Identified by William O&apos;Neil as the highest win-rate setup. A stock surges +25% to +50% rapidly, then pauses tightly (&le; 10-12% range) for 3-5 weeks while volume dries up. Buy when price breaks out over the flag high with expanding volume. Stop loss: bottom of the flag range.
        </p>
        <p className="leading-relaxed">
          <strong>2. 52-Week Tight Base (VCP):</strong> Championed by Mark Minervini. High Relative Strength stocks that refuse to pull back even when the broader market shakes out. Price tightens within 10-15% of all-time highs. A low-cheat breakout from this base frequently initiates multi-month stage-2 uptrends.
        </p>
      </div>
    </div>
  );
};
