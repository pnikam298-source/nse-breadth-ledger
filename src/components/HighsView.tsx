import React, { useState, useMemo } from 'react';
import { RootData } from '@/types/data';
import { Target, Search, Download, Copy, Check, ExternalLink, Filter } from 'lucide-react';

interface HighsViewProps {
  data: RootData;
}

export const HighsView: React.FC<HighsViewProps> = ({ data }) => {
  const [mode, setMode] = useState<'h52' | 'h6m' | 'h1m' | 'near'>('h52');
  const [distancePct, setDistancePct] = useState<number>(5.0);
  const [selectedInd, setSelectedInd] = useState<string>('__all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [copiedMsg, setCopiedMsg] = useState<string>('');

  const nearList = data.near || [];

  const industries = useMemo(() => {
    const set = new Set(nearList.map((r) => r[3]).filter(Boolean));
    return Array.from(set).sort();
  }, [nearList]);

  // Filter stocks
  const filteredStocks = useMemo(() => {
    return nearList.filter((r) => {
      const [sym, dist, lvl, ind] = r;
      // Mode filter
      let matchMode = false;
      if (mode === 'h52') matchMode = lvl >= 3;
      else if (mode === 'h6m') matchMode = lvl >= 2;
      else if (mode === 'h1m') matchMode = lvl >= 1;
      else matchMode = dist >= -distancePct - 1e-6;

      const matchInd = selectedInd === '__all' || ind === selectedInd;
      const matchSearch = !searchQuery || sym.toLowerCase().includes(searchQuery.toLowerCase()) || ind.toLowerCase().includes(searchQuery.toLowerCase());
      return matchMode && matchInd && matchSearch;
    });
  }, [nearList, mode, distancePct, selectedInd, searchQuery]);

  // Ranked industries by matching share
  const rankedIndustries = useMemo(() => {
    const indTotals = new Map<string, number>();
    const indMatches = new Map<string, number>();

    nearList.forEach((r) => {
      const [, dist, lvl, ind] = r;
      indTotals.set(ind, (indTotals.get(ind) || 0) + 1);

      let isMatch = false;
      if (mode === 'h52') isMatch = lvl >= 3;
      else if (mode === 'h6m') isMatch = lvl >= 2;
      else if (mode === 'h1m') isMatch = lvl >= 1;
      else isMatch = dist >= -distancePct - 1e-6;

      if (isMatch) {
        indMatches.set(ind, (indMatches.get(ind) || 0) + 1);
      }
    });

    const list = Array.from(indTotals.entries()).map(([ind, total]) => {
      const count = indMatches.get(ind) || 0;
      return {
        ind,
        total,
        count,
        share: total > 0 ? (count / total) * 100 : 0,
      };
    });

    return list.filter((x) => x.total >= 3 && x.count > 0).sort((a, b) => b.share - a.share || b.count - a.count);
  }, [nearList, mode, distancePct]);

  // Export handlers
  const handleDownloadCsv = () => {
    const rows = [['Stock', 'Industry', 'Distance to 52W High (%)', 'Freshest High Today']];
    filteredStocks.forEach((r) => {
      const tag = ['None', '1M High', '6M High', '52W High'][r[2]];
      rows.push([r[0], r[3], String(r[1]), tag]);
    });
    const csvContent = '\ufeff' + rows.map((e) => e.map((x) => `"${x.replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `52w-highs-${mode}-${selectedInd}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyTv = async () => {
    const symbols = filteredStocks.map((r) => `NSE:${r[0]}`).join(',');
    try {
      await navigator.clipboard.writeText(symbols);
      setCopiedMsg(`Copied ${filteredStocks.length} symbols for TradingView!`);
      setTimeout(() => setCopiedMsg(''), 4000);
    } catch {}
  };

  const handleDownloadTxt = () => {
    const symbols = filteredStocks.map((r) => `NSE:${r[0]}`).join(',');
    const blob = new Blob([symbols], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `52w-highs-${mode}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const modeDescriptions: Record<string, string> = {
    h52: 'Stocks trading at a fresh 52-week high today',
    h6m: 'Stocks trading at a fresh 6-month high today',
    h1m: 'Stocks trading at a fresh 1-month high today',
    near: `Stocks within ${distancePct}% of their 52-week high`,
  };

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                <Target className="w-5 h-5 text-teal-600 dark:text-teal-400" />
                52-Week & Multi-Month Highs Scanner
              </h2>
            </div>
            <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed max-w-4xl">
              Track leaders breaking out or consolidating right under their 52-week highs. Measured on intraday prices across all 1,014 liquid NSE equities.
            </p>
          </div>
          {copiedMsg && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-500/10 border border-teal-500/30 text-teal-600 dark:text-teal-400 text-xs font-semibold rounded-lg">
              <Check className="w-4 h-4" /> {copiedMsg}
            </div>
          )}
        </div>

        {/* Controls Toolbar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
          {/* Mode Selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Breakout Range
            </label>
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value as any)}
              className="w-full px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs font-medium focus:ring-2 focus:ring-teal-500 outline-none"
            >
              <option value="h52">New 52-Week High Today</option>
              <option value="h6m">New 6-Month High Today</option>
              <option value="h1m">New 1-Month High Today</option>
              <option value="near">Within % of 52-Week High</option>
            </select>
          </div>

          {/* Distance % (if near) */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Within Distance ({distancePct}%)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min="0.5"
                max="25"
                step="0.5"
                disabled={mode !== 'near'}
                value={distancePct}
                onChange={(e) => setDistancePct(parseFloat(e.target.value))}
                className="flex-1 accent-teal-600 h-2 bg-zinc-200 dark:bg-zinc-800 rounded-lg cursor-pointer disabled:opacity-40"
              />
              <span className="w-12 px-2 py-1 rounded bg-zinc-100 dark:bg-zinc-800 text-xs font-mono font-bold text-center">
                {distancePct}%
              </span>
            </div>
          </div>

          {/* Industry Filter */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Industry Filter
            </label>
            <select
              value={selectedInd}
              onChange={(e) => setSelectedInd(e.target.value)}
              className="w-full px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs font-medium focus:ring-2 focus:ring-teal-500 outline-none"
            >
              <option value="__all">All Industries ({nearList.length} stocks)</option>
              {industries.map((ind) => (
                <option key={ind} value={ind}>
                  {ind}
                </option>
              ))}
            </select>
          </div>

          {/* Search */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Search Symbol
            </label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="e.g. TBZ, DIXON..."
                className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs font-medium focus:ring-2 focus:ring-teal-500 outline-none"
              />
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-zinc-200 dark:border-zinc-800">
          <button
            onClick={handleDownloadCsv}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 transition-colors"
          >
            <Download className="w-3.5 h-3.5" /> Download CSV
          </button>
          <button
            onClick={handleCopyTv}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 transition-colors"
          >
            <Copy className="w-3.5 h-3.5" /> Copy for TradingView
          </button>
          <button
            onClick={handleDownloadTxt}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 transition-colors"
          >
            <Download className="w-3.5 h-3.5" /> TradingView File (.txt)
          </button>
        </div>
      </div>

      {/* Main Results Count */}
      <div className="flex items-center justify-between px-1">
        <div className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Found <span className="font-bold text-teal-600 dark:text-teal-400 font-mono text-base">{filteredStocks.length}</span> stocks{' '}
          {modeDescriptions[mode]}
          {selectedInd !== '__all' && ` in ${selectedInd}`}.
        </div>
        <div className="text-xs text-zinc-500">Intraday extreme breakouts</div>
      </div>

      {/* Stock Cards / Badges Grid */}
      <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 shadow-sm">
        {filteredStocks.length === 0 ? (
          <div className="py-12 text-center text-zinc-500">
            No stocks meet the criteria right now.
          </div>
        ) : (
          <div className="flex flex-wrap gap-2.5">
            {filteredStocks.map(([sym, dist, lvl, ind]) => {
              const tag =
                mode === 'near'
                  ? lvl === 3
                    ? '52W high'
                    : dist > -0.05
                    ? 'at high'
                    : `${dist.toFixed(1)}%`
                  : ['None', '1M high', '6M high', '52W high'][lvl];

              return (
                <a
                  key={sym}
                  href={`https://in.tradingview.com/chart/?symbol=NSE:${encodeURIComponent(sym)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={`${sym}: ${tag} (${ind}) · Open TradingView`}
                  className="group inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-zinc-100 dark:bg-zinc-800/80 hover:bg-zinc-200 dark:hover:bg-zinc-700/80 border border-zinc-200/80 dark:border-zinc-700/60 text-xs font-medium text-zinc-800 dark:text-zinc-200 transition-all hover:scale-105 shadow-xs"
                >
                  <span className="font-bold tracking-tight">{sym}</span>
                  <span
                    className={`px-1.5 py-0.5 rounded text-[11px] font-mono font-bold ${
                      lvl === 3
                        ? 'bg-teal-500 text-white'
                        : lvl === 2
                        ? 'bg-teal-500/20 text-teal-600 dark:text-teal-400'
                        : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400'
                    }`}
                  >
                    {tag}
                  </span>
                  <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-60 transition-opacity" />
                </a>
              );
            })}
          </div>
        )}
      </div>

      {/* Industry Rankings Leaderboard */}
      <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-4">
        <div>
          <h3 className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">
            Top Industries by Fresh Highs Share
          </h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Industries ranked by the proportion of their stocks meeting the current breakout criteria. Click any industry to view its names above.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
          {rankedIndustries.map((item) => (
            <div
              key={item.ind}
              onClick={() => setSelectedInd(item.ind)}
              className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-950/40 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 border border-zinc-200/60 dark:border-zinc-800 cursor-pointer transition-all flex items-center justify-between gap-4 group"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-xs text-zinc-900 dark:text-zinc-100 truncate group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors">
                    {item.ind}
                  </span>
                  <span className="text-[11px] text-zinc-400 font-mono">({item.total})</span>
                </div>
                <div className="mt-2 h-1.5 w-full bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-teal-500 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(item.share, 100)}%` }}
                  />
                </div>
              </div>
              <div className="text-right">
                <div className="font-bold font-mono text-sm text-teal-600 dark:text-teal-400">
                  {item.share.toFixed(0)}%
                </div>
                <div className="text-[11px] text-zinc-400 font-mono">
                  {item.count} of {item.total}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
