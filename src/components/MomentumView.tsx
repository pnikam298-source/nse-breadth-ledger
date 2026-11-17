import React, { useState, useMemo } from 'react';
import { RootData, MomoGroup } from '@/types/data';
import { Zap, Search, Download, Copy, Check, ExternalLink } from 'lucide-react';

interface MomentumViewProps {
  data: RootData;
}

export const MomentumView: React.FC<MomentumViewProps> = ({ data }) => {
  const momo = data.momo;
  const [threshold, setThreshold] = useState<number>(25);
  const [lookback, setLookback] = useState<number>(60);
  const [selectedInd, setSelectedInd] = useState<string>('__all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [copiedMsg, setCopiedMsg] = useState<string>('');

  const lbIndex = momo.lb.indexOf(lookback);
  const thRankRequired = momo.th.indexOf(threshold) + 1;

  // Flattened stocks pool
  const allStocks = useMemo(() => {
    const list: { sym: string; ind: string; scoreDigit: string; pct: number | null }[] = [];
    const seen = new Set<string>();

    momo.groups.forEach((g) => {
      g.stocks.forEach((st) => {
        const [sym, codeStr, pcts] = st;
        if (!seen.has(sym)) {
          seen.add(sym);
          const digit = codeStr[lbIndex];
          const pct = pcts && pcts[lbIndex] != null ? pcts[lbIndex] : null;
          list.push({
            sym,
            ind: g.industry,
            scoreDigit: digit,
            pct,
          });
        }
      });
    });

    return list;
  }, [momo, lbIndex]);

  // Filtered stocks meeting threshold
  const matchingStocks = useMemo(() => {
    return allStocks.filter((s) => {
      const matchMin = s.scoreDigit !== '-' && parseInt(s.scoreDigit, 10) >= thRankRequired;
      const matchInd = selectedInd === '__all' || s.ind === selectedInd;
      const matchSearch = !searchQuery || s.sym.toLowerCase().includes(searchQuery.toLowerCase()) || s.ind.toLowerCase().includes(searchQuery.toLowerCase());
      return matchMin && matchInd && matchSearch;
    }).sort((a, b) => (b.pct ?? 0) - (a.pct ?? 0));
  }, [allStocks, thRankRequired, selectedInd, searchQuery]);

  // Industry rankings
  const rankedIndustries = useMemo(() => {
    return momo.groups.map((g) => {
      const valid = g.stocks.filter((st) => st[1][lbIndex] !== '-');
      const hits = valid.filter((st) => parseInt(st[1][lbIndex], 10) >= thRankRequired).length;
      return {
        ind: g.industry,
        total: valid.length,
        count: hits,
        share: valid.length > 0 ? (hits / valid.length) * 100 : 0,
      };
    }).sort((a, b) => b.share - a.share || b.count - a.count);
  }, [momo, lbIndex, thRankRequired]);

  // Export handlers
  const handleDownloadCsv = () => {
    const rows = [['Stock', 'Industry', `Gain (%) over ${lookback}d`, 'Threshold (%)', 'Lookback (days)']];
    matchingStocks.forEach((s) => {
      rows.push([s.sym, s.ind, s.pct != null ? String(s.pct) : '', String(threshold), String(lookback)]);
    });
    const csvContent = '\ufeff' + rows.map((e) => e.map((x) => `"${x.replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `momentum-${threshold}pct-${lookback}d-${selectedInd}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyTv = async () => {
    const symbols = matchingStocks.map((s) => `NSE:${s.sym}`).join(',');
    try {
      await navigator.clipboard.writeText(symbols);
      setCopiedMsg(`Copied ${matchingStocks.length} symbols for TradingView!`);
      setTimeout(() => setCopiedMsg(''), 4000);
    } catch {}
  };

  const handleDownloadTxt = () => {
    const symbols = matchingStocks.map((s) => `NSE:${s.sym}`).join(',');
    const blob = new Blob([symbols], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `momentum-${threshold}pct-${lookback}d.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const totalPool = selectedInd === '__all' ? allStocks.length : allStocks.filter((s) => s.ind === selectedInd).length;
  const sharePct = totalPool > 0 ? (matchingStocks.length / totalPool) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                <Zap className="w-5 h-5 text-teal-600 dark:text-teal-400" />
                Broad Momentum Screener
              </h2>
            </div>
            <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed max-w-4xl">
              Distinguish a broad sector advance from a handful of heavyweights doing the work. Set a minimum percentage gain and lookback period to inspect the true breadth of momentum.
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
          {/* Threshold */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Gain Threshold
            </label>
            <select
              value={threshold}
              onChange={(e) => setThreshold(parseInt(e.target.value, 10))}
              className="w-full px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs font-medium focus:ring-2 focus:ring-teal-500 outline-none"
            >
              {momo.th.map((th) => (
                <option key={th} value={th}>
                  At least {th}%
                </option>
              ))}
            </select>
          </div>

          {/* Lookback */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Lookback Period
            </label>
            <select
              value={lookback}
              onChange={(e) => setLookback(parseInt(e.target.value, 10))}
              className="w-full px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs font-medium focus:ring-2 focus:ring-teal-500 outline-none"
            >
              {momo.lb.map((lb) => (
                <option key={lb} value={lb}>
                  Over last {lb} trading days
                </option>
              ))}
            </select>
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
              <option value="__all">All Industries ({allStocks.length} stocks)</option>
              {momo.groups.map((g) => (
                <option key={g.industry} value={g.industry}>
                  {g.industry} ({g.stocks.length})
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
                placeholder="e.g. TBZ, KALYAN..."
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
          <span className="font-bold text-teal-600 dark:text-teal-400 font-mono text-base">{matchingStocks.length}</span> of{' '}
          <span className="font-bold font-mono">{totalPool}</span> stocks ({sharePct.toFixed(1)}%) gained at least{' '}
          <span className="font-bold font-mono">{threshold}%</span> over the last{' '}
          <span className="font-bold font-mono">{lookback}</span> trading days.
        </div>
        <div className="text-xs text-zinc-500">Sorted by highest gain</div>
      </div>

      {/* Stock Cards / Badges Grid */}
      <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 shadow-sm">
        {matchingStocks.length === 0 ? (
          <div className="py-12 text-center text-zinc-500">
            No stocks gained &ge; {threshold}% over the last {lookback} days in this selection.
          </div>
        ) : (
          <div className="flex flex-wrap gap-2.5">
            {matchingStocks.map((s) => {
              const pStr = s.pct != null ? `${s.pct >= 0 ? '+' : ''}${s.pct.toFixed(1)}%` : '';

              return (
                <a
                  key={s.sym}
                  href={`https://in.tradingview.com/chart/?symbol=NSE:${encodeURIComponent(s.sym)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={`${s.sym}: ${pStr} over ${lookback}d (${s.ind}) · Open TradingView`}
                  className="group inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-zinc-100 dark:bg-zinc-800/80 hover:bg-zinc-200 dark:hover:bg-zinc-700/80 border border-zinc-200/80 dark:border-zinc-700/60 text-xs font-medium text-zinc-800 dark:text-zinc-200 transition-all hover:scale-105 shadow-xs"
                >
                  <span className="font-bold tracking-tight">{s.sym}</span>
                  <span className="px-1.5 py-0.5 rounded text-[11px] font-mono font-bold bg-teal-500/20 text-teal-600 dark:text-teal-400">
                    {pStr}
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
            Industries Ranked by Share Meeting Gain Test
          </h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Sectors with the highest percentage of stocks up {threshold}%+ in {lookback} days. Click any industry to filter above.
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
