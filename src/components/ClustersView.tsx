import React, { useState } from 'react';
import { RootData, ClusterItem } from '@/types/data';
import { Layers, Download, Copy, Check, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';

interface ClustersViewProps {
  data: RootData;
}

export const ClustersView: React.FC<ClustersViewProps> = ({ data }) => {
  const [openIndustries, setOpenIndustries] = useState<Set<string>>(new Set());
  const [copiedMsg, setCopiedMsg] = useState<string>('');

  const clusters = data.clusters || [];

  const toggleIndustry = (ind: string) => {
    setOpenIndustries((prev) => {
      const next = new Set(prev);
      if (next.has(ind)) next.delete(ind);
      else next.add(ind);
      return next;
    });
  };

  const toggleAll = () => {
    if (openIndustries.size === clusters.length) {
      setOpenIndustries(new Set());
    } else {
      setOpenIndustries(new Set(clusters.map((c) => c.industry)));
    }
  };

  const handleDownloadCsv = () => {
    const rows = [['Industry', 'Tracked Stocks', 'Stock', 'Freshest High']];
    const lvlNames = ['None', '1M High', '3M High', '6M High'];
    clusters.forEach((c) => {
      c.all.forEach(([sym, lvl]) => {
        rows.push([c.industry, String(c.n), sym, lvlNames[lvl]]);
      });
    });
    const csvContent = '\ufeff' + rows.map((e) => e.map((x) => `"${x.replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `clusters-fresh-highs.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyTv = async () => {
    const parts: string[] = [];
    let n = 0;
    clusters.forEach((c) => {
      const hs = (c.all || []).filter(([, l]) => l >= 2).map(([s]) => `NSE:${s}`);
      if (hs.length) {
        parts.push(`###${c.industry}`);
        parts.push(...hs);
        n += hs.length;
      }
    });

    try {
      await navigator.clipboard.writeText(parts.join(','));
      setCopiedMsg(`Copied ${n} stocks at 3-month highs grouped by industry!`);
      setTimeout(() => setCopiedMsg(''), 4000);
    } catch {}
  };

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                <Layers className="w-5 h-5 text-teal-600 dark:text-teal-400" />
                Where Fresh Highs Cluster
              </h2>
            </div>
            <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed max-w-4xl">
              Industries ranked by the share of their stocks at a 3-month high today (dark bar). The pale bar is the share at a 1-month high. Only industries with at least 3 tracked stocks are shown.
            </p>
          </div>
          {copiedMsg && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-500/10 border border-teal-500/30 text-teal-600 dark:text-teal-400 text-xs font-semibold rounded-lg">
              <Check className="w-4 h-4" /> {copiedMsg}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-zinc-200 dark:border-zinc-800">
          <button
            onClick={toggleAll}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 transition-colors"
          >
            {openIndustries.size === clusters.length ? (
              <>
                <ChevronUp className="w-3.5 h-3.5" /> Collapse All Stocks
              </>
            ) : (
              <>
                <ChevronDown className="w-3.5 h-3.5" /> Expand All Stocks
              </>
            )}
          </button>
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
            <Copy className="w-3.5 h-3.5" /> Copy 3M Highs for TradingView
          </button>
        </div>
      </div>

      {/* Clusters List */}
      <div className="space-y-3">
        {clusters.map((c) => {
          const isOpen = openIndustries.has(c.industry);
          const share3M = (c.h3 / c.n) * 100;
          const share1M = (c.h1 / c.n) * 100;

          return (
            <div
              key={c.industry}
              className="p-4 rounded-2xl bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 shadow-sm transition-all"
            >
              <div
                onClick={() => toggleIndustry(c.industry)}
                className="cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-3 group"
              >
                <div className="flex items-center gap-2">
                  <span className="text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-200 transition-colors">
                    {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </span>
                  <span className="font-semibold text-sm text-zinc-900 dark:text-zinc-100 group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors">
                    {c.industry}
                  </span>
                  <span className="text-xs text-zinc-400 font-mono">· {c.n} stocks</span>
                </div>

                {/* Progress bars & ratios */}
                <div className="flex items-center gap-4 flex-1 max-w-md">
                  <div className="relative h-2.5 flex-1 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className="absolute top-0 left-0 h-full bg-teal-500/30 rounded-full"
                      style={{ width: `${Math.min(share1M, 100)}%` }}
                    />
                    <div
                      className="absolute top-0 left-0 h-full bg-teal-500 rounded-full"
                      style={{ width: `${Math.min(share3M, 100)}%` }}
                    />
                  </div>
                  <div className="text-right text-xs font-mono whitespace-nowrap">
                    <strong className="text-teal-600 dark:text-teal-400">{share3M.toFixed(0)}%</strong> /{' '}
                    <span className="text-zinc-500">{share1M.toFixed(0)}%</span>
                    <span className="text-zinc-400 text-[11px] ml-1.5">
                      ({c.h3} of {c.n} at 3M)
                    </span>
                  </div>
                </div>
              </div>

              {/* Top 3M High Names */}
              <div className="mt-3 pt-3 border-t border-zinc-100 dark:border-zinc-800/60 flex flex-wrap items-center gap-2 text-xs">
                <span className="text-[11px] text-zinc-400 font-medium">3M Highs:</span>
                {c.names.length > 0 ? (
                  c.names.slice(0, 10).map((sym) => (
                    <a
                      key={sym}
                      href={`https://in.tradingview.com/chart/?symbol=NSE:${encodeURIComponent(sym)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-teal-500/10 text-teal-600 dark:text-teal-400 font-medium hover:underline text-xs"
                    >
                      {sym} <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                    </a>
                  ))
                ) : (
                  <span className="text-zinc-400 italic text-xs">None at 3M ({c.h1} at 1M high)</span>
                )}
              </div>

              {/* Expanded Stock Badges */}
              {isOpen && (
                <div className="mt-4 pt-4 border-t border-zinc-200 dark:border-zinc-800 space-y-3">
                  <div className="flex flex-wrap gap-2">
                    {c.all.map(([sym, lvl]) => {
                      const lvlClasses = [
                        'bg-zinc-100 dark:bg-zinc-800 text-zinc-500',
                        'bg-teal-500/10 text-teal-600 dark:text-teal-400',
                        'bg-teal-500/25 text-teal-700 dark:text-teal-300 font-semibold',
                        'bg-teal-500 text-white font-bold',
                      ][lvl];

                      const lvlLabels = ['No fresh high', '1M high', '3M high', '6M high'];

                      return (
                        <a
                          key={sym}
                          href={`https://in.tradingview.com/chart/?symbol=NSE:${encodeURIComponent(sym)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={`${sym}: ${lvlLabels[lvl]} · Open TradingView`}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono transition-transform hover:scale-105 ${lvlClasses}`}
                        >
                          {sym}
                          <span className="text-[10px] opacity-75">{lvlLabels[lvl]}</span>
                        </a>
                      );
                    })}
                  </div>
                  {/* Legend */}
                  <div className="flex items-center gap-4 text-[11px] text-zinc-500 pt-1 font-mono">
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded bg-teal-500" /> 6M high
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded bg-teal-500/40" /> 3M high
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded bg-teal-500/15" /> 1M high
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded bg-zinc-300 dark:bg-zinc-700" /> No fresh high
                    </span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
