import React, { useState, useMemo } from 'react';
import { SetupItem } from '@/types/data';
import { Sparkles, Flag, Target, ExternalLink, Download, Copy, Check, Filter, Layers, ShieldCheck, Zap, Activity } from 'lucide-react';

interface SetupHunterViewProps {
  setups?: SetupItem[];
}

export const SetupHunterView: React.FC<SetupHunterViewProps> = ({ setups = [] }) => {
  const [selectedType, setSelectedType] = useState<string>('all');
  const [minRs, setMinRs] = useState<number>(75);
  const [minBaseDrop, setMinBaseDrop] = useState<number>(10);
  const [maxBaseDrop, setMaxBaseDrop] = useState<number>(35);
  const [minRightSide, setMinRightSide] = useState<number>(50);
  const [maxTightness, setMaxTightness] = useState<number>(15);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');

  // Counts
  const vcpCount = useMemo(() => setups.filter((s) => s.setup_type === 'VCP Stage 2 Base').length, [setups]);
  const htfCount = useMemo(() => setups.filter((s) => s.setup_type === 'High-Tight Flag').length, [setups]);
  const baseCount = useMemo(() => setups.filter((s) => s.setup_type === '52W Tight Base').length, [setups]);

  // Filtering
  const filtered = useMemo(() => {
    return setups.filter((s) => {
      if (selectedType !== 'all' && s.setup_type !== selectedType) return false;
      if (s.rs < minRs) return false;
      if (s.tightness_15d > maxTightness) return false;

      // Base Drop / Correction Depth Filter
      const depth = s.base_depth ?? Math.abs(s.dist_52w);
      if (depth < minBaseDrop || depth > maxBaseDrop) return false;

      // Right Side Position Filter
      const rightSide = s.right_side_pct ?? 50;
      if (rightSide < minRightSide) return false;

      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return s.symbol.toLowerCase().includes(q) || s.industry.toLowerCase().includes(q);
      }
      return true;
    }).sort((a, b) => {
      // Sort by Right Side progress first, then RS rating
      const rsB = b.right_side_pct ?? 50;
      const rsA = a.right_side_pct ?? 50;
      if (rsB !== rsA) return rsB - rsA;
      return b.rs - a.rs;
    });
  }, [setups, selectedType, minRs, minBaseDrop, maxBaseDrop, minRightSide, maxTightness, searchQuery]);

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
      'Base Depth % (Drop from Run)',
      'Right Side Recovery %',
      '15d Tightness %',
      'Base High',
      'Base Low',
      'Dist to 52W High %',
      '20d Gain %',
      '60d Gain %',
      'Industry'
    ];
    const rows = filtered.map((s) => [
      s.symbol,
      `"${s.setup_type}"`,
      s.rs,
      s.close,
      s.base_depth ?? 'N/A',
      s.right_side_pct ?? 'N/A',
      s.tightness_15d,
      s.base_high ?? 'N/A',
      s.base_low ?? 'N/A',
      s.dist_52w,
      s.gain_20d,
      s.gain_60d,
      `"${s.industry}"`,
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `nse_vcp_setups_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Presets
  const applyPreset = (preset: 'vcp_15_30' | 'deep_25_40' | 'htf_shallow' | 'all') => {
    if (preset === 'vcp_15_30') {
      setMinBaseDrop(15);
      setMaxBaseDrop(30);
      setMinRightSide(50);
      setSelectedType('all');
    } else if (preset === 'deep_25_40') {
      setMinBaseDrop(25);
      setMaxBaseDrop(45);
      setMinRightSide(50);
      setSelectedType('all');
    } else if (preset === 'htf_shallow') {
      setMinBaseDrop(5);
      setMaxBaseDrop(18);
      setMinRightSide(60);
      setSelectedType('all');
    } else {
      setMinBaseDrop(5);
      setMaxBaseDrop(50);
      setMinRightSide(30);
      setSelectedType('all');
    }
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
                VCP & Right-Side Base Breakout Scanner
              </h2>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500 text-black tracking-wider">
                STAGE-2 PIVOT
              </span>
            </div>
            <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed max-w-4xl">
              Institutions let leading stocks pull back <strong>15% to 30%</strong> from their initial run to shake out weak retail holders. Once the base low is established, the stock climbs up the <strong>Right Side of the Base (RSB)</strong> and contracts tightly (&le; 12% range) before launching the next massive markup leg.
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
            <div className="text-[10px] text-teal-600 dark:text-teal-400">Total Setup Universe</div>
          </button>

          <button
            onClick={() => setSelectedType(selectedType === 'VCP Stage 2 Base' ? 'all' : 'VCP Stage 2 Base')}
            className={`p-3 rounded-xl border text-left transition-all ${
              selectedType === 'VCP Stage 2 Base'
                ? 'border-teal-500 bg-teal-500/10 shadow-sm'
                : 'border-zinc-200 dark:border-zinc-800 hover:border-teal-500/50 bg-zinc-50/50 dark:bg-zinc-950/30'
            }`}
          >
            <div className="flex items-center justify-between text-[11px] font-medium text-teal-600 dark:text-teal-400">
              <span className="flex items-center gap-1"><Activity className="w-3 h-3" /> VCP Deep Base</span>
              <span className="w-2 h-2 rounded-full bg-teal-500" />
            </div>
            <div className="mt-1 text-2xl font-bold font-mono text-zinc-900 dark:text-white">
              {vcpCount}
            </div>
            <div className="text-[10px] text-zinc-500">15% - 30% Base Drop &rarr; Right Side</div>
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
            <div className="text-[10px] text-zinc-500">&le; 18% Shallow Pause</div>
          </button>

          <div className="p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/30 text-left">
            <div className="text-[11px] font-medium text-zinc-500">Matches Filter</div>
            <div className="mt-1 text-2xl font-bold font-mono text-teal-600 dark:text-teal-400">
              {filtered.length}
            </div>
            <div className="text-[10px] text-zinc-500">Ready for Execution</div>
          </div>
        </div>
      </div>

      {/* Interactive Controls & Filters */}
      <div className="p-5 rounded-xl bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-4">
        {/* Top Controls Row: Presets & View Mode */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-zinc-100 dark:border-zinc-800/80">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1">
              <Filter className="w-3.5 h-3.5 text-teal-500" /> Quick Presets:
            </span>
            <button
              onClick={() => applyPreset('vcp_15_30')}
              className="px-2.5 py-1 rounded-lg text-xs font-medium border border-teal-500/40 bg-teal-500/10 text-teal-600 dark:text-teal-400 hover:bg-teal-500/20 transition-all"
            >
              Classic VCP (15% - 30% Drop)
            </button>
            <button
              onClick={() => applyPreset('deep_25_40')}
              className="px-2.5 py-1 rounded-lg text-xs font-medium border border-zinc-200 dark:border-zinc-700 hover:border-zinc-400 text-zinc-700 dark:text-zinc-300 transition-all"
            >
              Deep Shakeout (25% - 40% Drop)
            </button>
            <button
              onClick={() => applyPreset('htf_shallow')}
              className="px-2.5 py-1 rounded-lg text-xs font-medium border border-zinc-200 dark:border-zinc-700 hover:border-zinc-400 text-zinc-700 dark:text-zinc-300 transition-all"
            >
              High-Tight Flag (&le; 18% Drop)
            </button>
            <button
              onClick={() => applyPreset('all')}
              className="px-2.5 py-1 rounded-lg text-xs font-medium border border-zinc-200 dark:border-zinc-700 hover:border-zinc-400 text-zinc-500 transition-all"
            >
              Reset All
            </button>
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

        {/* Sliders Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 pt-1">
          {/* Min Base Drop % */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-zinc-600 dark:text-zinc-400">
              <span>Min Base Drop (Pullback)</span>
              <span className="font-mono font-bold text-teal-600 dark:text-teal-400">&ge; {minBaseDrop}%</span>
            </div>
            <input
              type="range"
              min={5}
              max={30}
              step={1}
              value={minBaseDrop}
              onChange={(e) => setMinBaseDrop(Number(e.target.value))}
              className="w-full accent-teal-500 h-1.5 bg-zinc-200 dark:bg-zinc-800 rounded-lg appearance-none cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-zinc-400 font-mono">
              <span>5%</span>
              <span>15%</span>
              <span>30%</span>
            </div>
          </div>

          {/* Max Base Drop % */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-zinc-600 dark:text-zinc-400">
              <span>Max Base Drop (Pullback)</span>
              <span className="font-mono font-bold text-teal-600 dark:text-teal-400">&le; {maxBaseDrop}%</span>
            </div>
            <input
              type="range"
              min={15}
              max={50}
              step={1}
              value={maxBaseDrop}
              onChange={(e) => setMaxBaseDrop(Number(e.target.value))}
              className="w-full accent-teal-500 h-1.5 bg-zinc-200 dark:bg-zinc-800 rounded-lg appearance-none cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-zinc-400 font-mono">
              <span>15%</span>
              <span>30%</span>
              <span>50%</span>
            </div>
          </div>

          {/* Min Right Side Progress % */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-zinc-600 dark:text-zinc-400">
              <span>Right-Side Recovery</span>
              <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">&ge; {minRightSide}%</span>
            </div>
            <input
              type="range"
              min={30}
              max={90}
              step={5}
              value={minRightSide}
              onChange={(e) => setMinRightSide(Number(e.target.value))}
              className="w-full accent-emerald-500 h-1.5 bg-zinc-200 dark:bg-zinc-800 rounded-lg appearance-none cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-zinc-400 font-mono">
              <span>30% (Mid)</span>
              <span>50% (Right)</span>
              <span>90% (Pivot)</span>
            </div>
          </div>

          {/* 15d Base Tightness */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-zinc-600 dark:text-zinc-400">
              <span>Pivot Tightness (15d)</span>
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
              <span>6% (Tight)</span>
              <span>12%</span>
              <span>18%</span>
            </div>
          </div>

          {/* Search box */}
          <div className="space-y-1.5">
            <label className="text-xs text-zinc-600 dark:text-zinc-400 block">Search Symbol / Industry</label>
            <input
              type="text"
              placeholder="e.g. BLISSGVS, Pharma..."
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
          <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">No Setups Match Current Drop & Right-Side Criteria</h3>
          <p className="text-xs text-zinc-500 mt-1">
            Try clicking the <strong>&ldquo;Classic VCP (15% - 30% Drop)&rdquo;</strong> preset or relaxing Right-Side Recovery to &ge; 40%.
          </p>
        </div>
      ) : viewMode === 'cards' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((item) => {
            const isHtf = item.setup_type === 'High-Tight Flag';
            const isVcp = item.setup_type === 'VCP Stage 2 Base';
            const depth = item.base_depth ?? Math.abs(item.dist_52w);
            const rightSide = item.right_side_pct ?? 50;

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
                      <div className="text-xs text-zinc-500 truncate max-w-[190px]" title={item.industry}>
                        {item.industry}
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          isVcp
                            ? 'bg-teal-500/15 text-teal-600 dark:text-teal-400 border border-teal-500/30'
                            : isHtf
                            ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                            : 'bg-zinc-500/15 text-zinc-600 dark:text-zinc-400 border border-zinc-500/30'
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
                      <div className="text-[10px] text-zinc-500">Base Drop</div>
                      <div className="font-mono font-bold text-sm text-rose-500">
                        -{depth.toFixed(1)}%
                      </div>
                    </div>
                    <div className="p-2 rounded-lg bg-zinc-50 dark:bg-zinc-950/50">
                      <div className="text-[10px] text-zinc-500">RS Rating</div>
                      <div className="font-mono font-bold text-sm text-teal-600 dark:text-teal-400">
                        {item.rs}
                      </div>
                    </div>
                    <div className="p-2 rounded-lg bg-zinc-50 dark:bg-zinc-950/50">
                      <div className="text-[10px] text-zinc-500">15d Tightness</div>
                      <div className="font-mono font-bold text-sm text-emerald-600 dark:text-emerald-400">
                        {item.tightness_15d.toFixed(1)}%
                      </div>
                    </div>
                  </div>

                  {/* Right Side Base Progress Bar */}
                  <div className="mt-4 space-y-1.5 p-3 rounded-xl bg-zinc-50/70 dark:bg-zinc-950/40 border border-zinc-100 dark:border-zinc-800/60">
                    <div className="flex justify-between items-center text-[10px]">
                      <span className="font-semibold text-zinc-600 dark:text-zinc-400">
                        Right-Side Recovery:
                      </span>
                      <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        {rightSide.toFixed(1)}% {rightSide >= 85 ? '(At Pivot)' : '(Right Side)'}
                      </span>
                    </div>

                    <div className="h-2 w-full bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden flex">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          rightSide >= 80 ? 'bg-emerald-500' : 'bg-teal-500'
                        }`}
                        style={{ width: `${Math.min(100, Math.max(5, rightSide))}%` }}
                      />
                    </div>

                    <div className="flex justify-between text-[9px] text-zinc-400 font-mono pt-0.5">
                      <span>Low: ₹{item.base_low ?? '—'}</span>
                      <span>High: ₹{item.base_high ?? '—'}</span>
                    </div>
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
                  <th className="py-3 px-4">Setup Type</th>
                  <th className="py-3 px-4 text-center">RS Rating</th>
                  <th className="py-3 px-4 text-right">Close (₹)</th>
                  <th className="py-3 px-4 text-right">Base Drop %</th>
                  <th className="py-3 px-4 text-right">Right-Side %</th>
                  <th className="py-3 px-4 text-right">15d Tightness</th>
                  <th className="py-3 px-4 text-right">Base Range (₹)</th>
                  <th className="py-3 px-4 text-right">Dist 52W</th>
                  <th className="py-3 px-4">Industry</th>
                  <th className="py-3 px-4 text-center">Chart</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60 text-zinc-700 dark:text-zinc-300">
                {filtered.map((item) => {
                  const depth = item.base_depth ?? Math.abs(item.dist_52w);
                  const rightSide = item.right_side_pct ?? 50;

                  return (
                    <tr key={item.symbol} className="hover:bg-zinc-50/80 dark:hover:bg-zinc-800/30 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-zinc-900 dark:text-white">
                        {item.symbol}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            item.setup_type === 'VCP Stage 2 Base'
                              ? 'bg-teal-500/15 text-teal-600 dark:text-teal-400'
                              : item.setup_type === 'High-Tight Flag'
                              ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                              : 'bg-zinc-500/15 text-zinc-600 dark:text-zinc-400'
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
                      <td className="py-3 px-4 text-right font-mono font-bold text-rose-500">
                        -{depth.toFixed(1)}%
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        {rightSide.toFixed(1)}%
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        {item.tightness_15d.toFixed(1)}%
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-zinc-500 text-[11px]">
                        ₹{item.base_low ?? '—'} - ₹{item.base_high ?? '—'}
                      </td>
                      <td className="py-3 px-4 text-right font-mono">
                        {item.dist_52w >= 0 ? '0.0%' : `${item.dist_52w.toFixed(1)}%`}
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
          <ShieldCheck className="w-4 h-4 text-teal-500" />
          The Institutional Playbook: Anatomy of the 15%–30% Right-Side VCP Base
        </div>
        <p className="leading-relaxed">
          <strong>1. Left Side Shakeout (15% to 30% Drop):</strong> After an initial surge of $+30\%$ to $+100\%$, institutional operators step aside to let profit-taking occur. This deep shakeout eliminates weak retail holders and leveraged margin positions.
        </p>
        <p className="leading-relaxed">
          <strong>2. The Right-Side Turn (&ge; 50% Recovery):</strong> When institutional buyers quietly accumulate at the base low, price reclaims the 50 DMA and climbs into the upper right half of the base (&ge; 50% recovery from trough to peak).
        </p>
        <p className="leading-relaxed">
          <strong>3. Terminal Pivot Contraction (&le; 10%–12% Tightness):</strong> On the right side near the pivot, price ranges narrow dramatically while trading volume dries up. This volatility contraction proves supply is exhausted, setting the stage for the explosive Stage-2 breakout.
        </p>
      </div>
    </div>
  );
};
