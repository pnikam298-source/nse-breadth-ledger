import React, { useState, useMemo } from 'react';
import { RootData } from '@/types/data';
import { FileText, Download, Calendar, Layers, ShieldCheck, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { formatSessionDate } from '@/lib/utils';

interface LogViewProps {
  data: RootData;
}

export const LogView: React.FC<LogViewProps> = ({ data }) => {
  const [activeView, setActiveView] = useState<'audit' | 'extended'>('audit');
  const [logN, setLogN] = useState<number>(60);

  // Clean and deduplicate series: drop duplicate 'live' if previous session has same data
  const cleanedSeries = useMemo(() => {
    const list = [...(data.series || [])];
    if (list.length >= 2 && list[list.length - 1].d.toLowerCase() === 'live') {
      list.pop();
    }
    return list;
  }, [data.series]);

  // Extended history rows
  const extendedRows = useMemo(() => {
    return [...cleanedSeries].slice(-logN).reverse();
  }, [cleanedSeries, logN]);

  // Recent days (Audit Ledger - 10 sessions)
  const recentDays = useMemo(() => {
    return (data.recentDays || []).map((day, idx) => {
      const dateInfo = formatSessionDate(day.date, data.asOf);
      const isLatest = idx === 0 || day.date.toLowerCase() === 'live';
      const n = day.n || data.universe || 1014;

      // Regime calculation
      const net1 = day.h1m - day.l1m;
      const net6 = day.h6m - day.l6m;
      const score =
        ((day.m50 - 50) / 50) * 0.4 +
        Math.max(-1, Math.min(1, net1 / (0.08 * n))) * 0.3 +
        Math.max(-1, Math.min(1, net6 / (0.04 * n))) * 0.3;

      let regimeLabel = 'Neutral / Selective';
      let regimeColor = 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30';
      if (score > 0.45) {
        regimeLabel = 'Broad Strength';
        regimeColor = 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30';
      } else if (score > 0.15) {
        regimeLabel = 'Moderate Advance';
        regimeColor = 'bg-teal-500/15 text-teal-600 dark:text-teal-400 border border-teal-500/30';
      } else if (score < -0.45) {
        regimeLabel = 'Broad Liquidation';
        regimeColor = 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30';
      } else if (score < -0.15) {
        regimeLabel = 'Soft / Pullback';
        regimeColor = 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30';
      }

      return {
        ...day,
        dateInfo,
        isLatest,
        regimeLabel,
        regimeColor,
        score,
      };
    });
  }, [data.recentDays, data.asOf, data.universe]);

  const handleDownloadCsv = () => {
    if (activeView === 'audit') {
      const headers = ['Session Date', 'Day', 'Advancers', 'Decliners', '52W Highs', '52W Lows', '1M Highs', '1M Lows', 'Monthly Thrust', '% Above 50 DMA', 'Market Regime'];
      const csvRows = recentDays.map((r) => [
        `"${r.dateInfo.formatted}"`,
        `"${r.dateInfo.dayOfWeek}"`,
        r.upN,
        r.dnN,
        r.hiN,
        r.loN,
        r.h1m,
        r.l1m,
        r.g25 - r.l25,
        `${r.m50.toFixed(1)}%`,
        `"${r.regimeLabel}"`,
      ]);
      const csvContent = '\ufeff' + [headers.join(','), ...csvRows.map((r) => r.join(','))].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `nse-recent-audit-ledger.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      const headers = ['Session Date', 'Day', '1M Net Highs', '3M Net Highs', '6M Net Highs', 'Monthly Thrust', '% Above 50 DMA'];
      const csvRows = extendedRows.map((r) => {
        const dInfo = formatSessionDate(r.d, data.asOf);
        return [
          `"${dInfo.formatted}"`,
          `"${dInfo.dayOfWeek}"`,
          r.h1m - r.l1m,
          r.h3m - r.l3m,
          r.h6m - r.l6m,
          r.g25 - r.l25,
          `${r.m50.toFixed(1)}%`,
        ];
      });
      const csvContent = '\ufeff' + [headers.join(','), ...csvRows.map((r) => r.join(','))].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `nse-breadth-sessions-${logN}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const formatNet = (net: number) => {
    const isPos = net >= 0;
    return (
      <span className={`font-mono font-semibold ${isPos ? 'text-teal-600 dark:text-teal-400' : 'text-clay-500'}`}>
        {isPos ? `+${net}` : net}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                <FileText className="w-5 h-5 text-teal-600 dark:text-teal-400" />
                Historical Sessions Log & Audit Ledger
              </h2>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-teal-500 text-white tracking-wider">
                DAILY EOD
              </span>
            </div>
            <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
              Official audit ledger of daily breadth numbers, advancers/decliners, 52-week highs, thrust, and regime scoring.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* View Mode Switcher */}
            <div className="flex items-center p-1 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700/50">
              <button
                onClick={() => setActiveView('audit')}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                  activeView === 'audit'
                    ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-xs font-semibold'
                    : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
                }`}
              >
                10-Day Audit Ledger
              </button>
              <button
                onClick={() => setActiveView('extended')}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                  activeView === 'extended'
                    ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-xs font-semibold'
                    : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
                }`}
              >
                Extended History
              </button>
            </div>

            {activeView === 'extended' && (
              <div className="flex items-center gap-1 p-1 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700/50">
                {[10, 60, 125, 250, 375].map((n) => (
                  <button
                    key={n}
                    onClick={() => setLogN(n)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                      logN === n
                        ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-xs font-semibold'
                        : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
                    }`}
                  >
                    {n}d
                  </button>
                ))}
              </div>
            )}

            <button
              onClick={handleDownloadCsv}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 transition-colors"
            >
              <Download className="w-3.5 h-3.5" /> CSV
            </button>
          </div>
        </div>
      </div>

      {/* Main Table: View 1 (10-Day Comprehensive Audit Ledger) */}
      {activeView === 'audit' ? (
        <div className="rounded-2xl bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-50 dark:bg-zinc-950/60 border-b border-zinc-200 dark:border-zinc-800 text-zinc-500 font-medium">
                <tr>
                  <th className="py-3.5 px-4">Session Date</th>
                  <th className="py-3.5 px-4 text-center">Market Breadth (Adv / Dec)</th>
                  <th className="py-3.5 px-4 text-center">52W Highs / Lows</th>
                  <th className="py-3.5 px-4 text-center">1M Net</th>
                  <th className="py-3.5 px-4 text-center">6M Net</th>
                  <th className="py-3.5 px-4 text-center">Thrust (&plusmn;25%)</th>
                  <th className="py-3.5 px-4 text-center">&gt; 50 DMA</th>
                  <th className="py-3.5 px-4 text-center">Market Regime</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
                {recentDays.map((row, idx) => {
                  const net52 = row.hiN - row.loN;
                  const net1 = row.h1m - row.l1m;
                  const net6 = row.h6m - row.l6m;
                  const netThrust = row.g25 - row.l25;
                  const advRatio = Math.round((row.upN / (row.upN + row.dnN || 1)) * 100);

                  return (
                    <tr
                      key={idx}
                      className={`hover:bg-zinc-50/80 dark:hover:bg-zinc-800/30 transition-colors ${
                        row.isLatest ? 'bg-teal-500/[0.03] dark:bg-teal-500/[0.05]' : ''
                      }`}
                    >
                      {/* Formatted Date */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-zinc-900 dark:text-white">
                            {row.dateInfo.formatted}
                          </span>
                          <span className="text-[11px] text-zinc-400 font-mono">
                            {row.dateInfo.dayOfWeek}
                          </span>
                          {row.isLatest && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-teal-500/20 text-teal-600 dark:text-teal-400 border border-teal-500/30">
                              LATEST
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Advancers vs Decliners */}
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-2 font-mono">
                          <span className="font-semibold text-emerald-600 dark:text-emerald-400">{row.upN}</span>
                          <span className="text-zinc-300 dark:text-zinc-700">/</span>
                          <span className="font-semibold text-rose-600 dark:text-rose-400">{row.dnN}</span>
                          <span className="text-[10px] text-zinc-400">({advRatio}%)</span>
                        </div>
                      </td>

                      {/* 52W Highs / Lows */}
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5 font-mono">
                          <span className="text-emerald-600 dark:text-emerald-400 font-bold">{row.hiN}</span>
                          <span className="text-zinc-300 dark:text-zinc-700">:</span>
                          <span className="text-rose-600 dark:text-rose-400 font-bold">{row.loN}</span>
                          <span className={`text-[10px] px-1 rounded ${net52 >= 0 ? 'text-teal-600 bg-teal-500/10' : 'text-rose-600 bg-rose-500/10'}`}>
                            {net52 >= 0 ? `+${net52}` : net52}
                          </span>
                        </div>
                      </td>

                      {/* 1M Net */}
                      <td className="py-3.5 px-4 text-center">{formatNet(net1)}</td>

                      {/* 6M Net */}
                      <td className="py-3.5 px-4 text-center">{formatNet(net6)}</td>

                      {/* Monthly Thrust */}
                      <td className="py-3.5 px-4 text-center">{formatNet(netThrust)}</td>

                      {/* > 50 DMA */}
                      <td className="py-3.5 px-4 text-center font-mono font-medium text-zinc-800 dark:text-zinc-200">
                        {row.m50.toFixed(1)}%
                      </td>

                      {/* Regime Badge */}
                      <td className="py-3.5 px-4 text-center">
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${row.regimeColor}`}>
                          {row.regimeLabel}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Main Table: View 2 (Extended Historical Series) */
        <div className="rounded-2xl bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
          <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-zinc-50 dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-800 text-zinc-500 font-medium">
                <tr>
                  <th className="py-3.5 px-4">Session Date</th>
                  <th className="py-3.5 px-4 text-center">1M Net</th>
                  <th className="py-3.5 px-4 text-center">3M Net</th>
                  <th className="py-3.5 px-4 text-center">6M Net</th>
                  <th className="py-3.5 px-4 text-center">Monthly Thrust</th>
                  <th className="py-3.5 px-4 text-center">&gt; 50 DMA</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
                {extendedRows.map((r, idx) => {
                  const dateInfo = formatSessionDate(r.d, data.asOf);
                  const isLatest = idx === 0;

                  return (
                    <tr
                      key={idx}
                      className={`hover:bg-zinc-50/80 dark:hover:bg-zinc-800/30 transition-colors ${
                        isLatest ? 'bg-teal-500/[0.03] dark:bg-teal-500/[0.05]' : ''
                      }`}
                    >
                      <td className="py-3 px-4 font-mono font-medium text-zinc-700 dark:text-zinc-300">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-zinc-900 dark:text-white">
                            {dateInfo.formatted}
                          </span>
                          <span className="text-zinc-400 text-[11px]">
                            {dateInfo.dayOfWeek}
                          </span>
                          {isLatest && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-teal-500/20 text-teal-600 dark:text-teal-400">
                              LATEST
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center">{formatNet(r.h1m - r.l1m)}</td>
                      <td className="py-3 px-4 text-center">{formatNet(r.h3m - r.l3m)}</td>
                      <td className="py-3 px-4 text-center">{formatNet(r.h6m - r.l6m)}</td>
                      <td className="py-3 px-4 text-center">{formatNet(r.g25 - r.l25)}</td>
                      <td className="py-3 px-4 text-center font-mono text-zinc-700 dark:text-zinc-300">
                        {r.m50.toFixed(1)}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
