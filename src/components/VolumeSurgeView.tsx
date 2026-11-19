import React, { useState, useMemo } from 'react';
import { VolumeSurgeItem } from '@/types/data';
import { Zap, Flame, ExternalLink, Download, Copy, Check, Filter, TrendingUp, BarChart2, ShieldCheck } from 'lucide-react';

interface VolumeSurgeViewProps {
  items?: VolumeSurgeItem[];
}

export const VolumeSurgeView: React.FC<VolumeSurgeViewProps> = ({ items = [] }) => {
  // User's exact criteria as defaults:
  // Price >= 30 INR, 1D Gain > 3%, 30D Avg Volume > 200K, RVOL 1D > 3.0
  const [minPrice, setMinPrice] = useState<number>(30);
  const [min1dGain, setMin1dGain] = useState<number>(3.0);
  const [minVolK, setMinVolK] = useState<number>(200);
  const [minRvol, setMinRvol] = useState<number>(3.0);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('table');

  const filtered = useMemo(() => {
    return items.filter((s) => {
      if (s.close < minPrice) return false;
      if (s.pct_chg_1d < min1dGain) return false;
      if ((s.vol_30d / 1000) < minVolK) return false;
      if (s.rvol_1d < minRvol) return false;

      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return s.symbol.toLowerCase().includes(q) || s.industry.toLowerCase().includes(q);
      }
      return true;
    }).sort((a, b) => b.rvol_1d - a.rvol_1d);
  }, [items, minPrice, min1dGain, minVolK, minRvol, searchQuery]);

  // Summary stats
  const totalValueCr = useMemo(() => {
    return filtered.reduce((acc, curr) => acc + curr.value_cr, 0);
  }, [filtered]);

  const avgRvol = useMemo(() => {
    if (filtered.length === 0) return 0;
    return filtered.reduce((acc, curr) => acc + curr.rvol_1d, 0) / filtered.length;
  }, [filtered]);

  const topGainer = useMemo(() => {
    if (filtered.length === 0) return null;
    return [...filtered].sort((a, b) => b.pct_chg_1d - a.pct_chg_1d)[0];
  }, [filtered]);

  const handleCopyTv = () => {
    const symbols = filtered.map((s) => `NSE:${s.symbol}`).join(',');
    navigator.clipboard.writeText(symbols);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleResetDefaults = () => {
    setMinPrice(30);
    setMin1dGain(3.0);
    setMinVolK(200);
    setMinRvol(3.0);
    setSearchQuery('');
  };

  const handleDownloadCsv = () => {
    const headers = [
      'Symbol',
      'Price (INR)',
      '1D Gain %',
      'RVOL (1D Multiplier)',
      'Today Volume (Shares)',
      '30D Avg Volume (Shares)',
      'Traded Value (Cr INR)',
      'RS Rating',
      'Industry'
    ];
    const rows = filtered.map((s) => [
      s.symbol,
      s.close,
      s.pct_chg_1d,
      s.rvol_1d,
      s.volume,
      s.vol_30d,
      s.value_cr,
      s.rs,
      `"${s.industry}"`,
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `nse_volume_surge_rvol_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatVolume = (vol: number) => {
    if (vol >= 10000000) return `${(vol / 10000000).toFixed(2)} Cr`;
    if (vol >= 100000) return `${(vol / 100000).toFixed(2)} L`;
    if (vol >= 1000) return `${(vol / 1000).toFixed(0)} K`;
    return vol.toLocaleString('en-IN');
  };

  return (
    <div className="space-y-6">
      {/* Header Info Banner */}
      <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                <Flame className="w-5 h-5 text-amber-500 fill-amber-500/20" />
                Institutional Volume Surge &amp; RVOL Expansion Scanner
              </h2>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500 text-black tracking-wider">
                RVOL &gt; 3.0x
              </span>
            </div>
            <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed max-w-4xl">
              Detects heavy institutional accumulation in real-time. Identifies liquid NSE equities where today&apos;s traded volume is at least <strong>3&times; higher</strong> than normal (RVOL &gt; 3.0) accompanied by strong price expansion (&gt; +3.0%).
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

        {/* 4 Summary Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
          <div className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/30">
            <div className="text-[11px] font-medium text-zinc-500">Volume Surge Matches</div>
            <div className="mt-1 text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
              {filtered.length}
            </div>
            <div className="text-[10px] text-zinc-400">RVOL &gt; 3.0 &amp; 1D &gt; 3%</div>
          </div>

          <div className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/30">
            <div className="text-[11px] font-medium text-zinc-500">Avg Relative Volume (RVOL)</div>
            <div className="mt-1 text-2xl font-bold font-mono text-amber-500">
              {avgRvol.toFixed(1)}x
            </div>
            <div className="text-[10px] text-zinc-400">Times 30-Day Avg Volume</div>
          </div>

          <div className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/30">
            <div className="text-[11px] font-medium text-zinc-500">Top Momentum Gainer</div>
            <div className="mt-1 text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400 truncate">
              {topGainer ? `${topGainer.symbol} +${topGainer.pct_chg_1d.toFixed(1)}%` : '—'}
            </div>
            <div className="text-[10px] text-zinc-400">Single Day Expansion</div>
          </div>

          <div className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/30">
            <div className="text-[11px] font-medium text-zinc-500">Total Group Turnover</div>
            <div className="mt-1 text-2xl font-bold font-mono text-zinc-900 dark:text-white">
              ₹{totalValueCr.toLocaleString('en-IN', { maximumFractionDigits: 0 })} Cr
            </div>
            <div className="text-[10px] text-zinc-400">Institutional Traded Value</div>
          </div>
        </div>
      </div>

      {/* Interactive Controls & Sliders */}
      <div className="p-5 rounded-xl bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-zinc-100 dark:border-zinc-800/80">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-amber-500" />
            <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
              Active Scanner Criteria:
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
              Price &ge; ₹{minPrice} · 1D &ge; +{min1dGain}% · 30D Vol &ge; {minVolK}K · RVOL &ge; {minRvol}x
            </span>
            <button
              onClick={handleResetDefaults}
              className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 underline ml-2"
            >
              Reset to Defaults
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode('table')}
              className={`px-3 py-1 text-xs rounded-md font-medium transition-colors ${
                viewMode === 'table'
                  ? 'bg-amber-500 text-black font-bold'
                  : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900'
              }`}
            >
              Table View
            </button>
            <button
              onClick={() => setViewMode('cards')}
              className={`px-3 py-1 text-xs rounded-md font-medium transition-colors ${
                viewMode === 'cards'
                  ? 'bg-amber-500 text-black font-bold'
                  : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900'
              }`}
            >
              Card View
            </button>
          </div>
        </div>

        {/* Sliders Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 pt-1">
          {/* Relative Volume (RVOL) */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-zinc-600 dark:text-zinc-400">
              <span>Relative Volume (RVOL)</span>
              <span className="font-mono font-bold text-amber-500">&ge; {minRvol.toFixed(1)}x</span>
            </div>
            <input
              type="range"
              min={1.5}
              max={10.0}
              step={0.5}
              value={minRvol}
              onChange={(e) => setMinRvol(Number(e.target.value))}
              className="w-full accent-amber-500 h-1.5 bg-zinc-200 dark:bg-zinc-800 rounded-lg appearance-none cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-zinc-400 font-mono">
              <span>1.5x</span>
              <span>3.0x (Default)</span>
              <span>10.0x</span>
            </div>
          </div>

          {/* 1D Price Change % */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-zinc-600 dark:text-zinc-400">
              <span>1D Price Change %</span>
              <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">&ge; +{min1dGain.toFixed(1)}%</span>
            </div>
            <input
              type="range"
              min={1.0}
              max={10.0}
              step={0.5}
              value={min1dGain}
              onChange={(e) => setMin1dGain(Number(e.target.value))}
              className="w-full accent-emerald-500 h-1.5 bg-zinc-200 dark:bg-zinc-800 rounded-lg appearance-none cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-zinc-400 font-mono">
              <span>+1.0%</span>
              <span>+3.0% (Default)</span>
              <span>+10.0%</span>
            </div>
          </div>

          {/* 30D Average Volume (K) */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-zinc-600 dark:text-zinc-400">
              <span>30D Avg Volume</span>
              <span className="font-mono font-bold text-teal-600 dark:text-teal-400">&ge; {minVolK}K shares</span>
            </div>
            <input
              type="range"
              min={50}
              max={1000}
              step={50}
              value={minVolK}
              onChange={(e) => setMinVolK(Number(e.target.value))}
              className="w-full accent-teal-500 h-1.5 bg-zinc-200 dark:bg-zinc-800 rounded-lg appearance-none cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-zinc-400 font-mono">
              <span>50K</span>
              <span>200K (Default)</span>
              <span>1,000K</span>
            </div>
          </div>

          {/* Minimum Price (INR) */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-zinc-600 dark:text-zinc-400">
              <span>Minimum Price (INR)</span>
              <span className="font-mono font-bold text-zinc-900 dark:text-white">&ge; ₹{minPrice}</span>
            </div>
            <input
              type="range"
              min={10}
              max={100}
              step={5}
              value={minPrice}
              onChange={(e) => setMinPrice(Number(e.target.value))}
              className="w-full accent-zinc-500 h-1.5 bg-zinc-200 dark:bg-zinc-800 rounded-lg appearance-none cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-zinc-400 font-mono">
              <span>₹10</span>
              <span>₹30 (Default)</span>
              <span>₹100</span>
            </div>
          </div>

          {/* Search box */}
          <div className="space-y-1.5">
            <label className="text-xs text-zinc-600 dark:text-zinc-400 block">Search Symbol or Industry</label>
            <input
              type="text"
              placeholder="e.g. INOXINDIA, IIFL..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-xs text-zinc-800 dark:text-zinc-200 placeholder-zinc-400 focus:outline-none focus:border-amber-500"
            />
          </div>
        </div>
      </div>

      {/* Main Results Display */}
      {filtered.length === 0 ? (
        <div className="p-12 text-center rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60">
          <Zap className="w-8 h-8 text-zinc-400 mx-auto mb-2 opacity-50" />
          <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">No Equities Match Volume Surge Criteria Today</h3>
          <p className="text-xs text-zinc-500 mt-1">
            Try relaxing RVOL to &ge; 2.0x or 1D Gain to &ge; 2%.
          </p>
        </div>
      ) : viewMode === 'table' ? (
        /* Table View */
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-50 dark:bg-zinc-950/60 border-b border-zinc-200 dark:border-zinc-800 text-zinc-500 font-medium">
                <tr>
                  <th className="py-3.5 px-4">Symbol</th>
                  <th className="py-3.5 px-4 text-center">RVOL (1D)</th>
                  <th className="py-3.5 px-4 text-right">Price (₹)</th>
                  <th className="py-3.5 px-4 text-right">1D Gain %</th>
                  <th className="py-3.5 px-4 text-right">Today Volume</th>
                  <th className="py-3.5 px-4 text-right">30D Avg Volume</th>
                  <th className="py-3.5 px-4 text-right">Turnover (₹ Cr)</th>
                  <th className="py-3.5 px-4 text-center">RS</th>
                  <th className="py-3.5 px-4">Industry</th>
                  <th className="py-3.5 px-4 text-center">Chart</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60 text-zinc-700 dark:text-zinc-300">
                {filtered.map((item) => (
                  <tr key={item.symbol} className="hover:bg-zinc-50/80 dark:hover:bg-zinc-800/30 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-zinc-900 dark:text-white">
                      {item.symbol}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-mono font-extrabold text-[11px] bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                        <Flame className="w-3 h-3 text-amber-500" />
                        {item.rvol_1d.toFixed(1)}x
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-zinc-900 dark:text-white">
                      ₹{item.close.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-extrabold text-emerald-600 dark:text-emerald-400">
                      +{item.pct_chg_1d.toFixed(2)}%
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-semibold text-zinc-800 dark:text-zinc-200">
                      {formatVolume(item.volume)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-zinc-500">
                      {formatVolume(item.vol_30d)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-zinc-900 dark:text-white">
                      ₹{item.value_cr.toFixed(1)} Cr
                    </td>
                    <td className="py-3 px-4 text-center font-mono text-zinc-500 font-bold">
                      {item.rs}
                    </td>
                    <td className="py-3 px-4 text-zinc-500 truncate max-w-[170px]">
                      {item.industry}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <a
                        href={`https://in.tradingview.com/chart/?symbol=NSE:${item.symbol}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center text-teal-500 hover:text-teal-400"
                        title="Open in TradingView"
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
      ) : (
        /* Cards View */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((item) => (
            <div
              key={item.symbol}
              className="p-5 rounded-2xl bg-white dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-800 hover:border-amber-500/50 transition-all hover:shadow-md space-y-4 flex flex-col justify-between"
            >
              <div>
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
                        className="text-zinc-400 hover:text-amber-500 transition-colors"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                    <div className="text-xs text-zinc-500 truncate max-w-[180px]">
                      {item.industry}
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-mono font-bold text-[11px] bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                      <Flame className="w-3 h-3 text-amber-500" />
                      {item.rvol_1d.toFixed(1)}x RVOL
                    </span>
                    <span className="text-xs font-mono font-extrabold text-emerald-600 dark:text-emerald-400">
                      +{item.pct_chg_1d.toFixed(2)}%
                    </span>
                  </div>
                </div>

                {/* 3 Metrics */}
                <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800/80 text-center">
                  <div className="p-2 rounded-lg bg-zinc-50 dark:bg-zinc-950/50">
                    <div className="text-[10px] text-zinc-500">Close Price</div>
                    <div className="font-mono font-bold text-sm text-zinc-900 dark:text-white">
                      ₹{item.close.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  </div>
                  <div className="p-2 rounded-lg bg-zinc-50 dark:bg-zinc-950/50">
                    <div className="text-[10px] text-zinc-500">Today Volume</div>
                    <div className="font-mono font-bold text-sm text-emerald-600 dark:text-emerald-400">
                      {formatVolume(item.volume)}
                    </div>
                  </div>
                  <div className="p-2 rounded-lg bg-zinc-50 dark:bg-zinc-950/50">
                    <div className="text-[10px] text-zinc-500">Turnover</div>
                    <div className="font-mono font-bold text-sm text-zinc-900 dark:text-white">
                      ₹{item.value_cr.toFixed(0)} Cr
                    </div>
                  </div>
                </div>

                {/* Volume Multiplier Bar */}
                <div className="mt-3 p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-950/40 border border-zinc-100 dark:border-zinc-800/60 text-xs flex justify-between items-center font-mono">
                  <span className="text-zinc-500 text-[11px]">30D Avg Volume:</span>
                  <span className="font-bold text-zinc-800 dark:text-zinc-200">
                    {formatVolume(item.vol_30d)} / day
                  </span>
                </div>
              </div>

              <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between text-xs text-zinc-500 font-mono">
                <span>Prev Close: ₹{item.prev_close.toFixed(2)}</span>
                <span>RS Rating: {item.rs}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Educational Footer */}
      <div className="p-5 rounded-2xl bg-zinc-50 dark:bg-zinc-950/40 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-600 dark:text-zinc-400 space-y-2">
        <div className="flex items-center gap-1.5 font-bold text-zinc-800 dark:text-zinc-200">
          <ShieldCheck className="w-4 h-4 text-amber-500" />
          The Relative Volume (RVOL &gt; 3.0) Principle
        </div>
        <p className="leading-relaxed">
          When a stock trades <strong>more than 300% of its normal 30-day average volume</strong> and advances by more than <strong>+3%</strong>, retail traders cannot create this footprint. It indicates institutional accumulation, block deals, or breakout expansion by mutual funds and FIIs.
        </p>
      </div>
    </div>
  );
};
