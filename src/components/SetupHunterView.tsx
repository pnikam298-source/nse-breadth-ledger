import React, { useState, useMemo } from 'react';
import { SetupItem } from '@/types/data';
import { Sparkles, Flag, Target, ExternalLink, Download, Copy, Check, Filter, Layers, ShieldCheck, Zap, ArrowUpRight, TrendingUp, Compass } from 'lucide-react';

interface SetupHunterViewProps {
  setups?: SetupItem[];
}

export const SetupHunterView: React.FC<SetupHunterViewProps> = ({ setups = [] }) => {
  const [selectedType, setSelectedType] = useState<string>('Base-Floor Coil');
  const [emaFilter, setEmaFilter] = useState<'support' | 'above' | 'all'>('support');
  const [minDrop, setMinDrop] = useState<number>(12);
  const [maxDrop, setMaxDrop] = useState<number>(32);
  const [maxDistFloor, setMaxDistFloor] = useState<number>(10);
  const [maxTightness, setMaxTightness] = useState<number>(14);
  const [minRs, setMinRs] = useState<number>(65);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');

  // Counts
  const floorCoilCount = useMemo(() => setups.filter((s) => s.setup_type === 'Base-Floor Coil').length, [setups]);
  const rightSideCount = useMemo(() => setups.filter((s) => s.setup_type === 'Right-Side Pivot').length, [setups]);
  const htfCount = useMemo(() => setups.filter((s) => s.setup_type === 'High-Tight Flag').length, [setups]);

  // Filtering
  const filtered = useMemo(() => {
    return setups.filter((s) => {
      if (selectedType !== 'all' && s.setup_type !== selectedType) return false;
      if (s.rs < minRs) return false;
      if (s.tightness_15d > maxTightness) return false;

      // Drop from peak (pullback_high)
      const drop = s.pullback_high ?? s.base_depth ?? Math.abs(s.dist_52w);
      if (drop < minDrop || drop > maxDrop) return false;

      // 50 EMA filter
      const emaPct = s.pct_ema50 ?? -99;
      if (emaFilter === 'support' && emaPct < -3.5) return false;
      if (emaFilter === 'above' && emaPct < 0.0) return false;

      // If Base-Floor Coil, must be close to floor
      if (s.setup_type === 'Base-Floor Coil') {
        const distFloor = s.dist_from_floor ?? 0;
        if (distFloor > maxDistFloor) return false;
      }

      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return s.symbol.toLowerCase().includes(q) || s.industry.toLowerCase().includes(q);
      }
      return true;
    }).sort((a, b) => {
      // Prioritize stocks holding closest to or above 50 EMA, then highest RS
      const emaA = a.pct_ema50 ?? -99;
      const emaB = b.pct_ema50 ?? -99;
      if (Math.abs(emaB) !== Math.abs(emaA)) {
        return Math.abs(emaA) - Math.abs(emaB);
      }
      return b.rs - a.rs;
    });
  }, [setups, selectedType, emaFilter, minDrop, maxDrop, maxDistFloor, maxTightness, minRs, searchQuery]);

  const handleCopyTv = () => {
    const symbols = filtered.map((s) => `NSE:${s.symbol}`).join(',');
    navigator.clipboard.writeText(symbols);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadCsv = () => {
    const headers = [
      'Symbol',
      'Setup Type',
      'RS Rating',
      'Close Price',
      '50 EMA Distance %',
      'Drop from Peak %',
      'Distance from Floor %',
      'Potential Upside to Peak %',
      '15d Tightness %',
      'Base High (Peak)',
      'Base Low (Floor)',
      'Industry'
    ];
    const rows = filtered.map((s) => {
      const drop = s.pullback_high ?? s.base_depth ?? Math.abs(s.dist_52w);
      const upside = s.base_high ? (((s.base_high - s.close) / s.close) * 100).toFixed(1) : 'N/A';
      return [
        s.symbol,
        `"${s.setup_type}"`,
        s.rs,
        s.close,
        s.pct_ema50?.toFixed(1) ?? 'N/A',
        drop.toFixed(1),
        s.dist_from_floor?.toFixed(1) ?? '0.0',
        upside,
        s.tightness_15d,
        s.base_high ?? 'N/A',
        s.base_low ?? 'N/A',
        `"${s.industry}"`,
      ];
    });
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `nse_50ema_coils_${new Date().toISOString().slice(0, 10)}.csv`);
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
                Base-Floor Coil & 50 EMA Support Scanner
              </h2>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500 text-white tracking-wider">
                50 EMA TRAMPOLINE
              </span>
            </div>
            <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed max-w-4xl">
              Institutions defend the <strong>50-day EMA</strong>. When a market leader pulls back 15% to 30% and <strong>coils directly at its rising 50 EMA</strong>, the moving average acts as a springboard rather than resistance. Catch the bottom turn early with tight risk before it takes off!
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

        {/* Strategy Selector Pills */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
          {/* Option 1: Base Floor Coil (User's Exact Setup) */}
          <button
            onClick={() => {
              setSelectedType('Base-Floor Coil');
              setMinDrop(12);
              setMaxDrop(32);
              setEmaFilter('support');
            }}
            className={`p-3 rounded-xl border text-left transition-all ${
              selectedType === 'Base-Floor Coil'
                ? 'border-emerald-500 bg-emerald-500/10 shadow-sm ring-1 ring-emerald-500/30'
                : 'border-zinc-200 dark:border-zinc-800 hover:border-emerald-500/50 bg-zinc-50/50 dark:bg-zinc-950/30'
            }`}
          >
            <div className="flex items-center justify-between text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
              <span>50 EMA Floor Coil</span>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            </div>
            <div className="mt-1 text-2xl font-bold font-mono text-zinc-900 dark:text-white">
              {floorCoilCount}
            </div>
            <div className="text-[10px] text-zinc-500">At Floor Low (Ride Up)</div>
          </button>

          {/* Option 2: Right-Side Pivot */}
          <button
            onClick={() => {
              setSelectedType('Right-Side Pivot');
              setMinDrop(12);
              setMaxDrop(35);
              setEmaFilter('all');
            }}
            className={`p-3 rounded-xl border text-left transition-all ${
              selectedType === 'Right-Side Pivot'
                ? 'border-teal-500 bg-teal-500/10 shadow-sm'
                : 'border-zinc-200 dark:border-zinc-800 hover:border-teal-500/50 bg-zinc-50/50 dark:bg-zinc-950/30'
            }`}
          >
            <div className="flex items-center justify-between text-[11px] font-medium text-teal-600 dark:text-teal-400">
              <span>Right-Side Pivot</span>
            </div>
            <div className="mt-1 text-2xl font-bold font-mono text-zinc-900 dark:text-white">
              {rightSideCount}
            </div>
            <div className="text-[10px] text-zinc-500">Already Recovered &ge; 50%</div>
          </button>

          {/* Option 3: High-Tight Flag */}
          <button
            onClick={() => {
              setSelectedType('High-Tight Flag');
              setMinDrop(5);
              setMaxDrop(18);
              setEmaFilter('all');
            }}
            className={`p-3 rounded-xl border text-left transition-all ${
              selectedType === 'High-Tight Flag'
                ? 'border-amber-500 bg-amber-500/10 shadow-sm'
                : 'border-zinc-200 dark:border-zinc-800 hover:border-amber-500/50 bg-zinc-50/50 dark:bg-zinc-950/30'
            }`}
          >
            <div className="flex items-center justify-between text-[11px] font-medium text-amber-600 dark:text-amber-400">
              <span>High-Tight Flag</span>
            </div>
            <div className="mt-1 text-2xl font-bold font-mono text-zinc-900 dark:text-white">
              {htfCount}
            </div>
            <div className="text-[10px] text-zinc-500">&le; 18% Shallow Pause</div>
          </button>

          {/* Option 4: All Filtered */}
          <div className="p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/30 text-left">
            <div className="text-[11px] font-medium text-zinc-500">Current Matches</div>
            <div className="mt-1 text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
              {filtered.length}
            </div>
            <div className="text-[10px] text-zinc-500">Holding 50 EMA Line</div>
          </div>
        </div>
      </div>

      {/* Interactive Controls & Filters */}
      <div className="p-5 rounded-xl bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-4">
        {/* Top Controls Row: 50 EMA Selector */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-zinc-100 dark:border-zinc-800/80">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
              <Compass className="w-4 h-4 text-emerald-500" /> 50 EMA Requirement:
            </span>
            <div className="flex items-center p-1 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700/50">
              <button
                onClick={() => setEmaFilter('support')}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                  emaFilter === 'support'
                    ? 'bg-emerald-500 text-white shadow-xs font-bold'
                    : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
                }`}
                title="Holding 50 EMA: Close is above or within 3.5% of 50 EMA"
              >
                ★ Holding 50 EMA Support (&ge; -3.5%)
              </button>
              <button
                onClick={() => setEmaFilter('above')}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                  emaFilter === 'above'
                    ? 'bg-emerald-500 text-white shadow-xs font-bold'
                    : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
                }`}
                title="Strictly above 50 EMA"
              >
                Strictly Above 50 EMA (&gt; 0%)
              </button>
              <button
                onClick={() => setEmaFilter('all')}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                  emaFilter === 'all'
                    ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-xs font-semibold'
                    : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
                }`}
              >
                Any Position
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode('cards')}
              className={`px-2.5 py-1 text-xs rounded-md font-medium transition-colors ${
                viewMode === 'cards'
                  ? 'bg-emerald-500 text-white'
                  : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900'
              }`}
            >
              Card View
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`px-2.5 py-1 text-xs rounded-md font-medium transition-colors ${
                viewMode === 'table'
                  ? 'bg-emerald-500 text-white'
                  : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900'
              }`}
            >
              Table View
            </button>
          </div>
        </div>

        {/* Sliders Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 pt-1">
          {/* Min Drop % */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-zinc-600 dark:text-zinc-400">
              <span>Min Drop from High</span>
              <span className="font-mono font-bold text-rose-500">&ge; {minDrop}%</span>
            </div>
            <input
              type="range"
              min={5}
              max={30}
              step={1}
              value={minDrop}
              onChange={(e) => setMinDrop(Number(e.target.value))}
              className="w-full accent-rose-500 h-1.5 bg-zinc-200 dark:bg-zinc-800 rounded-lg appearance-none cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-zinc-400 font-mono">
              <span>5%</span>
              <span>15%</span>
              <span>30%</span>
            </div>
          </div>

          {/* Max Drop % */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-zinc-600 dark:text-zinc-400">
              <span>Max Drop from High</span>
              <span className="font-mono font-bold text-rose-500">&le; {maxDrop}%</span>
            </div>
            <input
              type="range"
              min={15}
              max={50}
              step={1}
              value={maxDrop}
              onChange={(e) => setMaxDrop(Number(e.target.value))}
              className="w-full accent-rose-500 h-1.5 bg-zinc-200 dark:bg-zinc-800 rounded-lg appearance-none cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-zinc-400 font-mono">
              <span>15%</span>
              <span>30%</span>
              <span>50%</span>
            </div>
          </div>

          {/* Max Distance from Floor Low */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-zinc-600 dark:text-zinc-400">
              <span>Max Dist from Floor Low</span>
              <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">&le; {maxDistFloor}%</span>
            </div>
            <input
              type="range"
              min={2}
              max={15}
              step={1}
              value={maxDistFloor}
              onChange={(e) => setMaxDistFloor(Number(e.target.value))}
              className="w-full accent-emerald-500 h-1.5 bg-zinc-200 dark:bg-zinc-800 rounded-lg appearance-none cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-zinc-400 font-mono">
              <span>2% (At Bottom)</span>
              <span>10%</span>
              <span>15%</span>
            </div>
          </div>

          {/* 15d Base Tightness */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-zinc-600 dark:text-zinc-400">
              <span>Floor Tightness (15d)</span>
              <span className="font-mono font-bold text-teal-600 dark:text-teal-400">&le; {maxTightness}%</span>
            </div>
            <input
              type="range"
              min={6}
              max={18}
              step={1}
              value={maxTightness}
              onChange={(e) => setMaxTightness(Number(e.target.value))}
              className="w-full accent-teal-500 h-1.5 bg-zinc-200 dark:bg-zinc-800 rounded-lg appearance-none cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-zinc-400 font-mono">
              <span>6% (Super Tight)</span>
              <span>12%</span>
              <span>18%</span>
            </div>
          </div>

          {/* Search box */}
          <div className="space-y-1.5">
            <label className="text-xs text-zinc-600 dark:text-zinc-400 block">Search Symbol</label>
            <input
              type="text"
              placeholder="e.g. BAJAJ-AUTO, ABB..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-xs text-zinc-800 dark:text-zinc-200 placeholder-zinc-400 focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>
      </div>

      {/* Main Results Display */}
      {filtered.length === 0 ? (
        <div className="p-12 text-center rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60">
          <Sparkles className="w-8 h-8 text-zinc-400 mx-auto mb-2 opacity-50" />
          <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">No Setups Match Current 50 EMA & Floor Criteria</h3>
          <p className="text-xs text-zinc-500 mt-1">
            Try switching 50 EMA to <strong>&ldquo;Holding 50 EMA Support (&ge; -3.5%)&rdquo;</strong> or increasing Max Dist from Floor to 10%.
          </p>
        </div>
      ) : viewMode === 'cards' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((item) => {
            const drop = item.pullback_high ?? item.base_depth ?? Math.abs(item.dist_52w);
            const distFloor = item.dist_from_floor ?? 0;
            const upside = item.base_high ? (((item.base_high - item.close) / item.close) * 100).toFixed(1) : '—';
            const isFloorCoil = item.setup_type === 'Base-Floor Coil';
            const emaPct = item.pct_ema50 ?? 0;
            const isAboveEma = emaPct >= 0;
            const isAtSupport = emaPct >= -3.5 && emaPct < 0;

            return (
              <div
                key={item.symbol}
                className="p-5 rounded-2xl bg-white dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-800 hover:border-emerald-500/50 transition-all hover:shadow-md space-y-4 flex flex-col justify-between"
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
                          className="text-zinc-400 hover:text-emerald-500 transition-colors"
                          title="Open Chart in TradingView"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>
                      <div className="text-xs text-zinc-500 truncate max-w-[190px]" title={item.industry}>
                        {item.industry}
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          isAboveEma
                            ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                            : isAtSupport
                            ? 'bg-teal-500/15 text-teal-600 dark:text-teal-400 border border-teal-500/30'
                            : 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30'
                        }`}
                      >
                        {isAboveEma ? 'Above 50 EMA' : isAtSupport ? 'At 50 EMA Support' : 'Below 50 EMA'}
                      </span>
                      <div className="text-xs font-mono font-semibold text-zinc-700 dark:text-zinc-300">
                        ₹{item.close.toLocaleString('en-IN', { maximumFractionDigits: 1 })}
                      </div>
                    </div>
                  </div>

                  {/* Metrics grid */}
                  <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800/80 text-center">
                    <div className="p-2 rounded-lg bg-zinc-50 dark:bg-zinc-950/50">
                      <div className="text-[10px] text-zinc-500">50 EMA Dist</div>
                      <div className={`font-mono font-bold text-sm ${isAboveEma ? 'text-emerald-600 dark:text-emerald-400' : isAtSupport ? 'text-teal-600 dark:text-teal-400' : 'text-rose-500'}`}>
                        {emaPct >= 0 ? `+${emaPct.toFixed(1)}%` : `${emaPct.toFixed(1)}%`}
                      </div>
                    </div>
                    <div className="p-2 rounded-lg bg-zinc-50 dark:bg-zinc-950/50">
                      <div className="text-[10px] text-zinc-500">Drop from Peak</div>
                      <div className="font-mono font-bold text-sm text-rose-500">
                        -{drop.toFixed(1)}%
                      </div>
                    </div>
                    <div className="p-2 rounded-lg bg-zinc-50 dark:bg-zinc-950/50">
                      <div className="text-[10px] text-zinc-500">15d Tightness</div>
                      <div className="font-mono font-bold text-sm text-teal-600 dark:text-teal-400">
                        {item.tightness_15d.toFixed(1)}%
                      </div>
                    </div>
                  </div>

                  {/* Potential Upside Banner */}
                  <div className="mt-3 p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between text-xs">
                    <span className="text-emerald-700 dark:text-emerald-300 font-medium flex items-center gap-1">
                      <TrendingUp className="w-3.5 h-3.5 text-emerald-500" /> Target Prior High:
                    </span>
                    <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      +{upside}% (to ₹{item.base_high ?? '—'})
                    </span>
                  </div>

                  {/* Floor Reference */}
                  <div className="mt-2 flex justify-between text-[10px] text-zinc-400 font-mono px-1">
                    <span>Floor Low: ₹{item.base_low ?? '—'}</span>
                    <span>RS Rating: {item.rs}</span>
                  </div>
                </div>

                {/* Bottom row: Prior Run Gains */}
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
                  <th className="py-3 px-4">50 EMA Status</th>
                  <th className="py-3 px-4 text-center">RS</th>
                  <th className="py-3 px-4 text-right">Price (₹)</th>
                  <th className="py-3 px-4 text-right">50 EMA Dist</th>
                  <th className="py-3 px-4 text-right">Drop from Peak</th>
                  <th className="py-3 px-4 text-right">Dist to Floor</th>
                  <th className="py-3 px-4 text-right">15d Tightness</th>
                  <th className="py-3 px-4 text-right">Target High (₹)</th>
                  <th className="py-3 px-4 text-right">Upside</th>
                  <th className="py-3 px-4">Industry</th>
                  <th className="py-3 px-4 text-center">Chart</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60 text-zinc-700 dark:text-zinc-300">
                {filtered.map((item) => {
                  const drop = item.pullback_high ?? item.base_depth ?? Math.abs(item.dist_52w);
                  const distFloor = item.dist_from_floor ?? 0;
                  const upside = item.base_high ? (((item.base_high - item.close) / item.close) * 100).toFixed(1) : '—';
                  const emaPct = item.pct_ema50 ?? 0;
                  const isAboveEma = emaPct >= 0;
                  const isAtSupport = emaPct >= -3.5 && emaPct < 0;

                  return (
                    <tr key={item.symbol} className="hover:bg-zinc-50/80 dark:hover:bg-zinc-800/30 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-zinc-900 dark:text-white">
                        {item.symbol}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            isAboveEma
                              ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                              : isAtSupport
                              ? 'bg-teal-500/15 text-teal-600 dark:text-teal-400'
                              : 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
                          }`}
                        >
                          {isAboveEma ? 'Above 50 EMA' : isAtSupport ? 'At Support' : 'Below 50 EMA'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center font-mono font-bold text-teal-600 dark:text-teal-400">
                        {item.rs}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold">
                        ₹{item.close.toLocaleString('en-IN', { maximumFractionDigits: 1 })}
                      </td>
                      <td className={`py-3 px-4 text-right font-mono font-bold ${isAboveEma ? 'text-emerald-600 dark:text-emerald-400' : isAtSupport ? 'text-teal-600 dark:text-teal-400' : 'text-rose-500'}`}>
                        {emaPct >= 0 ? `+${emaPct.toFixed(1)}%` : `${emaPct.toFixed(1)}%`}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-rose-500">
                        -{drop.toFixed(1)}%
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        +{distFloor.toFixed(1)}%
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-teal-600 dark:text-teal-400">
                        {item.tightness_15d.toFixed(1)}%
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-zinc-500">
                        ₹{item.base_high ?? '—'}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        +{upside}%
                      </td>
                      <td className="py-3 px-4 text-zinc-500 truncate max-w-[160px]">
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
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Institutional Playbook Guide */}
      <div className="p-5 rounded-2xl bg-zinc-50 dark:bg-zinc-950/40 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-600 dark:text-zinc-400 space-y-2">
        <div className="flex items-center gap-1.5 font-bold text-zinc-800 dark:text-zinc-200">
          <ShieldCheck className="w-4 h-4 text-emerald-500" />
          The 50 EMA Trampoline: Why Institutional Leaders Defend This Line
        </div>
        <p className="leading-relaxed">
          <strong>1. The Trap of Breaking 50 EMA:</strong> If a stock drops 10%–20% below its 50 EMA, overhead trapped sellers dump every bounce, making the falling 50 EMA a heavy ceiling of resistance.
        </p>
        <p className="leading-relaxed">
          <strong>2. The 50 EMA Trampoline:</strong> When a top institutional stock pulls back 15% to 25% and <strong>coils directly AT or just above the rising 50 EMA (within -3.5% to +2%)</strong> with low 15-day tightness, mutual funds and institutions defend this level. The 50 EMA acts as an institutional springboard launching the next rally back to the high.
        </p>
      </div>
    </div>
  );
};
