import React, { useState, useMemo } from 'react';
import { RsData } from '@/types/data';
import { Search, Download, Copy, Check, ExternalLink, Filter, TrendingUp } from 'lucide-react';

interface RsRatingViewProps {
  rsData?: RsData;
}

export const RsRatingView: React.FC<RsRatingViewProps> = ({ rsData }) => {
  const [minRating, setMinRating] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('bl-rs-min');
      return saved ? parseInt(saved, 10) : 90;
    } catch {
      return 90;
    }
  });
  const [selectedInd, setSelectedInd] = useState<string>('__all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [copiedMsg, setCopiedMsg] = useState<string>('');

  if (!rsData || !rsData.rows) {
    return (
      <div className="p-12 text-center text-zinc-500 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
        RS rating data is not available yet.
      </div>
    );
  }

  const handleRatingChange = (val: number) => {
    const clamped = Math.max(1, Math.min(99, val));
    setMinRating(clamped);
    try {
      localStorage.setItem('bl-rs-min', String(clamped));
    } catch {}
  };

  const industries = useMemo(() => {
    const set = new Set(rsData.rows.map((r) => r[2]).filter(Boolean));
    return Array.from(set).sort();
  }, [rsData]);

  // Filter stocks
  const filteredStocks = useMemo(() => {
    return rsData.rows.filter((r) => {
      const [sym, rating, ind] = r;
      const matchMin = rating >= minRating;
      const matchInd = selectedInd === '__all' || ind === selectedInd;
      const matchSearch = !searchQuery || sym.toLowerCase().includes(searchQuery.toLowerCase()) || ind.toLowerCase().includes(searchQuery.toLowerCase());
      return matchMin && matchInd && matchSearch;
    });
  }, [rsData, minRating, selectedInd, searchQuery]);

  // Industry rankings
  const rankedIndustries = useMemo(() => {
    const hits = new Map<string, number>();
    rsData.rows.filter((r) => r[1] >= minRating).forEach((r) => {
      hits.set(r[2], (hits.get(r[2]) || 0) + 1);
    });

    const list = Object.entries(rsData.tot || {}).map(([ind, total]) => {
      const count = hits.get(ind) || 0;
      return {
        ind,
        total,
        count,
        share: total > 0 ? (count / total) * 100 : 0,
      };
    });

    return list.filter((x) => x.total >= 3 && x.count > 0).sort((a, b) => b.share - a.share || b.count - a.count);
  }, [rsData, minRating]);

  // Export handlers
  const handleDownloadCsv = () => {
    const rows = [['Symbol', 'RS Rating', 'Industry']];
    filteredStocks.forEach((r) => rows.push([r[0], String(r[1]), r[2]]));
    const csvContent = '\ufeff' + rows.map((e) => e.map((x) => `"${x.replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rs-rating-${minRating}-${selectedInd === '__all' ? 'all' : selectedInd}.csv`;
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

  const handleCopyByIndustry = async () => {
    const groups = new Map<string, string[]>();
    filteredStocks.forEach(([sym, , ind]) => {
      if (!groups.has(ind)) groups.set(ind, []);
      groups.get(ind)!.push(`NSE:${sym}`);
    });

    const parts: string[] = [];
    groups.forEach((syms, ind) => {
      parts.push(`###${ind}`);
      parts.push(...syms);
    });

    const txt = parts.join(',');
    try {
      await navigator.clipboard.writeText(txt);
      setCopiedMsg(`Copied ${filteredStocks.length} symbols grouped by industry!`);
      setTimeout(() => setCopiedMsg(''), 4000);
    } catch {}
  };

  const handleDownloadByIndustryTxt = () => {
    const groups = new Map<string, string[]>();
    filteredStocks.forEach(([sym, , ind]) => {
      if (!groups.has(ind)) groups.set(ind, []);
      groups.get(ind)!.push(`NSE:${sym}`);
    });

    const parts: string[] = [];
    groups.forEach((syms, ind) => {
      parts.push(`###${ind}`);
      parts.push(...syms);
    });

    const txt = parts.join(',');
    const blob = new Blob([txt], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rs-by-industry-${minRating}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const totalPoolCount = selectedInd === '__all' ? rsData.n : (rsData.tot && rsData.tot[selectedInd]) || filteredStocks.length;

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-teal-600 dark:text-teal-400" />
                Relative Strength (RS) Rating
              </h2>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-teal-500 text-white tracking-wider">
                1–99
              </span>
            </div>
            <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed max-w-4xl">
              Relative strength ranked 1 to 99, where 99 represents market leaders that outperformed almost every other liquid stock over the past year (trailing 4 quarters with the latest 3 months counting double). {rsData.n.toLocaleString()} liquid stocks rated.
            </p>
          </div>
          {copiedMsg && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-500/10 border border-teal-500/30 text-teal-600 dark:text-teal-400 text-xs font-semibold rounded-lg animate-fade-in">
              <Check className="w-4 h-4" /> {copiedMsg}
            </div>
          )}
        </div>

        {/* Controls Toolbar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
          {/* Minimum Rating */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Min RS Rating ({minRating}+)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min="1"
                max="99"
                value={minRating}
                onChange={(e) => handleRatingChange(parseInt(e.target.value, 10))}
                className="flex-1 accent-teal-600 h-2 bg-zinc-200 dark:bg-zinc-800 rounded-lg cursor-pointer"
              />
              <input
                type="number"
                min="1"
                max="99"
                value={minRating}
                onChange={(e) => handleRatingChange(parseInt(e.target.value, 10))}
                className="w-14 px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs font-mono font-bold text-center"
              />
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
              <option value="__all">All Industries ({rsData.n} stocks)</option>
              {industries.map((ind) => (
                <option key={ind} value={ind}>
                  {ind} ({rsData.tot?.[ind] ?? 0})
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
                placeholder="e.g. TBZ, TRENT..."
                className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs font-medium focus:ring-2 focus:ring-teal-500 outline-none"
              />
            </div>
          </div>

          {/* Preset Buttons */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Quick Tiers
            </label>
            <div className="flex items-center gap-1.5">
              {[70, 80, 90, 95].map((tier) => (
                <button
                  key={tier}
                  onClick={() => handleRatingChange(tier)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    minRating === tier
                      ? 'bg-teal-600 text-white shadow-sm'
                      : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                  }`}
                >
                  {tier}+
                </button>
              ))}
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
            onClick={handleCopyByIndustry}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 transition-colors"
          >
            <Copy className="w-3.5 h-3.5" /> Copy By Industry
          </button>
          <button
            onClick={handleDownloadByIndustryTxt}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 transition-colors"
          >
            <Download className="w-3.5 h-3.5" /> TradingView File (.txt)
          </button>
        </div>
      </div>

      {/* Main Results Count */}
      <div className="flex items-center justify-between px-1">
        <div className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Showing <span className="font-bold text-teal-600 dark:text-teal-400 font-mono text-base">{filteredStocks.length}</span> of{' '}
          <span className="font-bold font-mono">{totalPoolCount}</span> stocks rated{' '}
          <span className="font-bold font-mono">{minRating}+</span>
          {selectedInd !== '__all' && ` in ${selectedInd}`}.
        </div>
        <div className="text-xs text-zinc-500">Click any symbol to view chart on TradingView</div>
      </div>

      {/* Stock Cards / Badges Grid */}
      <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 shadow-sm">
        {filteredStocks.length === 0 ? (
          <div className="py-12 text-center text-zinc-500">
            No stocks meet the criteria with RS rating &ge; {minRating}.
          </div>
        ) : (
          <div className="flex flex-wrap gap-2.5">
            {filteredStocks.map(([sym, rating, ind]) => (
              <a
                key={sym}
                href={`https://in.tradingview.com/chart/?symbol=NSE:${encodeURIComponent(sym)}`}
                target="_blank"
                rel="noopener noreferrer"
                title={`${sym}: RS rating ${rating} (${ind}) · Open TradingView`}
                className="group inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-zinc-100 dark:bg-zinc-800/80 hover:bg-zinc-200 dark:hover:bg-zinc-700/80 border border-zinc-200/80 dark:border-zinc-700/60 text-xs font-medium text-zinc-800 dark:text-zinc-200 transition-all hover:scale-105 shadow-xs"
              >
                <span className="font-bold tracking-tight">{sym}</span>
                <span
                  className={`px-1.5 py-0.5 rounded text-[11px] font-mono font-bold ${
                    rating >= 95
                      ? 'bg-teal-500 text-white'
                      : rating >= 80
                      ? 'bg-teal-500/20 text-teal-600 dark:text-teal-400'
                      : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400'
                  }`}
                >
                  {rating}
                </span>
                <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-60 transition-opacity" />
              </a>
            ))}
          </div>
        )}
      </div>

      {/* Industry Rankings Leaderboard */}
      <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-4">
        <div>
          <h3 className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">
            Top Industries by RS {minRating}+ Share
          </h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Industries ranked by the proportion of their stocks scoring RS {minRating} or higher. Click any industry to filter the stocks above.
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
