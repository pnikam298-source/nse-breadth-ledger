import React, { useState } from 'react';
import { RootData, SeriesPoint } from '@/types/data';
import { FileText, Download, Calendar } from 'lucide-react';

interface LogViewProps {
  data: RootData;
}

export const LogView: React.FC<LogViewProps> = ({ data }) => {
  const [logN, setLogN] = useState<number>(60);

  const series = data.series || [];
  const rows = [...series].slice(-logN).reverse();

  const handleDownloadCsv = () => {
    const csvRows = [['Date', '1M Net Highs', '3M Net Highs', '6M Net Highs', 'Monthly Thrust', '% Above 50d']];
    rows.forEach((r) => {
      csvRows.push([
        r.d,
        String(r.h1m - r.l1m),
        String(r.h3m - r.l3m),
        String(r.h6m - r.l6m),
        String(r.g25 - r.l25),
        String(r.m50.toFixed(1)),
      ]);
    });

    const csvContent = '\ufeff' + csvRows.map((e) => e.map((x) => `"${x.replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nse-breadth-sessions-${logN}.csv`;
    a.click();
    URL.revokeObjectURL(url);
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
            <h2 className="text-lg font-bold text-zinc-900 dark:text-white flex items-center gap-2">
              <FileText className="w-5 h-5 text-teal-600 dark:text-teal-400" />
              Historical Sessions Log
            </h2>
            <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
              Audit log of daily breadth numbers, thrust, and moving average participation.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 p-1 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700/50">
              {[10, 60, 125, 250, 375].map((n) => (
                <button
                  key={n}
                  onClick={() => setLogN(n)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                    logN === n
                      ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-xs font-semibold'
                      : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
            <button
              onClick={handleDownloadCsv}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 transition-colors"
            >
              <Download className="w-3.5 h-3.5" /> CSV
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 text-zinc-500 font-medium">
              <tr>
                <th className="py-3 px-4">Session Date</th>
                <th className="py-3 px-4">1M Net</th>
                <th className="py-3 px-4">3M Net</th>
                <th className="py-3 px-4">6M Net</th>
                <th className="py-3 px-4">Monthly Thrust</th>
                <th className="py-3 px-4">&gt; 50 DMA</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
              {rows.map((r, idx) => {
                const dateLabel = r.d === 'live' ? 'Today (Latest Close)' : r.d;
                return (
                  <tr key={idx} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-colors">
                    <td className="py-3 px-4 font-mono font-medium text-zinc-700 dark:text-zinc-300">
                      {dateLabel}
                    </td>
                    <td className="py-3 px-4">{formatNet(r.h1m - r.l1m)}</td>
                    <td className="py-3 px-4">{formatNet(r.h3m - r.l3m)}</td>
                    <td className="py-3 px-4">{formatNet(r.h6m - r.l6m)}</td>
                    <td className="py-3 px-4">{formatNet(r.g25 - r.l25)}</td>
                    <td className="py-3 px-4 font-mono text-zinc-700 dark:text-zinc-300">
                      {r.m50.toFixed(1)}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
