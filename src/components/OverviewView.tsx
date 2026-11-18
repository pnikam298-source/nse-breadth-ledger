import React, { useState } from 'react';
import { RootData, SeriesPoint } from '@/types/data';
import { TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight, Layers, BarChart3, Activity } from 'lucide-react';
import { formatSessionDate } from '@/lib/utils';

interface OverviewViewProps {
  data: RootData;
}

export const OverviewView: React.FC<OverviewViewProps> = ({ data }) => {
  const [range, setRange] = useState<number>(60);
  const [offset, setOffset] = useState<number>(0);
  const [chartMetric, setChartMetric] = useState<'h1' | 'h6' | 'thrust' | 'm50'>('h1');
  const [chartHorizon, setChartHorizon] = useState<number>(250);

  const t = data.today;
  const n = data.nifty;

  // The Market Read
  const m50 = t.m50;
  const net1 = t.h1m - t.l1m;
  const net6 = t.h6m - t.l6m;
  const score = ((m50 - 50) / 50) * 0.4 + Math.max(-1, Math.min(1, net1 / (0.08 * t.n))) * 0.3 + Math.max(-1, Math.min(1, net6 / (0.04 * t.n))) * 0.3;
  const verdict = score > 0.45 ? 'Broad strength' : score > 0.15 ? 'Healthy, improving' : score > -0.15 ? 'Mixed' : score > -0.45 ? 'Soft' : 'Broad weakness';
  const verdictColor = score > 0.15 ? 'text-teal-500' : score < -0.15 ? 'text-clay-500' : 'text-amber-500';

  // Butterfly Ladder calculations
  const ladderRows = [
    { label: '1M', h: t.h1m, l: t.l1m, prevH: data.recentDays[1]?.h1m ?? 0, prevL: data.recentDays[1]?.l1m ?? 0 },
    { label: '6M', h: t.h6m, l: t.l6m, prevH: data.recentDays[1]?.h6m ?? 0, prevL: data.recentDays[1]?.l6m ?? 0 },
    { label: '52W', h: t.hiN, l: t.loN, prevH: data.recentDays[1]?.hiN ?? 0, prevL: data.recentDays[1]?.loN ?? 0 },
  ];
  const maxVal = Math.max(...ladderRows.flatMap((r) => [r.h, r.l]), 1);

  // Ribbon series slicing
  const totSessions = data.series.length;
  const clampedOffset = Math.max(0, Math.min(offset, totSessions - range));
  const visibleSeries = data.series.slice(totSessions - range - clampedOffset, totSessions - clampedOffset);

  const getHeatColor = (val: number) => {
    const v = Math.max(-1, Math.min(1, val));
    if (v >= 0) {
      // Teal gradient
      const alpha = Math.max(0.15, Math.abs(v));
      return `rgba(15, 124, 117, ${alpha})`;
    } else {
      // Clay gradient
      const alpha = Math.max(0.15, Math.abs(v));
      return `rgba(181, 83, 47, ${alpha})`;
    }
  };

  // Historical SVG chart data
  const chartSeries = data.series.slice(-chartHorizon);
  const chartValues = chartSeries.map((s) => {
    if (chartMetric === 'h1') return s.h1m - s.l1m;
    if (chartMetric === 'h6') return s.h6m - s.l6m;
    if (chartMetric === 'thrust') return s.g25 - s.l25;
    return s.m50;
  });
  const minVal = Math.min(...chartValues, 0);
  const maxChartVal = Math.max(...chartValues, 10);
  const valRange = maxChartVal - minVal || 1;

  const svgPoints = chartValues
    .map((val, idx) => {
      const x = (idx / (chartValues.length - 1)) * 800;
      const y = 200 - ((val - minVal) / valRange) * 160 - 20;
      return `${x},${y}`;
    })
    .join(' ');

  const zeroY = 200 - ((0 - minVal) / valRange) * 160 - 20;

  return (
    <div className="space-y-6">
      {/* Top Read Card */}
      <div className="p-6 rounded-2xl bg-gradient-to-b from-zinc-50 to-white dark:from-zinc-900/60 dark:to-zinc-950 border border-zinc-200 dark:border-zinc-800 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-zinc-200 dark:border-zinc-800">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold tracking-wider uppercase text-zinc-500 dark:text-zinc-400">
                Daily Market Verdict
              </span>
              <span className={`text-lg font-bold ${verdictColor}`}>{verdict}</span>
            </div>
            <p className="mt-1 text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed max-w-4xl">
              <strong className="text-zinc-900 dark:text-white">{t.m50.toFixed(1)}%</strong> of liquid stocks sit above their 50-day moving average.
              {' '}<strong className="text-teal-600 dark:text-teal-400">{t.h1m} stocks</strong> hit a 1-month high against <strong className="text-clay-500">{t.l1m}</strong> lows,
              while <strong className="text-teal-600 dark:text-teal-400">{t.h6m}</strong> reached 6-month highs against <strong className="text-clay-500">{t.l6m}</strong> lows.
              {n && ` Nifty 50 is ${Math.abs(n.vs50).toFixed(1)}% ${n.vs50 >= 0 ? 'above' : 'below'} its 50 DMA and ${Math.abs(n.fromHigh).toFixed(1)}% below its 52W high.`}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="px-3.5 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700/50 text-center">
              <div className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">Above 50d</div>
              <div className={`text-lg font-bold font-mono ${t.m50 >= 50 ? 'text-teal-600 dark:text-teal-400' : 'text-clay-500'}`}>
                {t.m50.toFixed(1)}%
              </div>
            </div>
            <div className="px-3.5 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700/50 text-center">
              <div className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">Net 1M</div>
              <div className={`text-lg font-bold font-mono ${net1 >= 0 ? 'text-teal-600 dark:text-teal-400' : 'text-clay-500'}`}>
                {net1 >= 0 ? `+${net1}` : net1}
              </div>
            </div>
            <div className="px-3.5 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700/50 text-center">
              <div className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">Net 6M</div>
              <div className={`text-lg font-bold font-mono ${net6 >= 0 ? 'text-teal-600 dark:text-teal-400' : 'text-clay-500'}`}>
                {net6 >= 0 ? `+${net6}` : net6}
              </div>
            </div>
          </div>
        </div>

        {/* Butterfly Ladder */}
        <div className="pt-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">Fresh Highs vs Fresh Lows</h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Number of stocks trading beyond their highest (right) or lowest (left) price in intraday trading.
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs font-mono">
              <span className="flex items-center gap-1.5 text-clay-500">
                <span className="w-2.5 h-2.5 rounded-sm bg-clay-500" /> New Lows
              </span>
              <span className="flex items-center gap-1.5 text-teal-600 dark:text-teal-400">
                <span className="w-2.5 h-2.5 rounded-sm bg-teal-500" /> New Highs
              </span>
            </div>
          </div>

          <div className="space-y-3">
            {ladderRows.map((row) => {
              const net = row.h - row.l;
              const prevNet = row.prevH - row.prevL;
              const lowPct = (row.l / maxVal) * 100;
              const highPct = (row.h / maxVal) * 100;

              return (
                <div key={row.label} className="grid grid-cols-[50px_1fr_90px_1fr_90px] items-center gap-3 text-xs">
                  <span className="font-bold text-zinc-700 dark:text-zinc-300 font-mono">{row.label}</span>
                  {/* Left Lane: Lows */}
                  <div className="flex items-center justify-end gap-2 h-7 bg-zinc-100 dark:bg-zinc-800/40 rounded-lg px-2 overflow-hidden">
                    <span className="font-mono text-zinc-500">{row.l}</span>
                    <div
                      className="h-4 bg-clay-500 rounded-sm transition-all duration-500"
                      style={{ width: `${Math.max(lowPct * 0.8, 3)}%` }}
                    />
                  </div>
                  {/* Center: Net */}
                  <div className={`text-center font-bold font-mono text-sm py-1 rounded-md ${net >= 0 ? 'bg-teal-500/10 text-teal-600 dark:text-teal-400' : 'bg-clay-500/10 text-clay-500'}`}>
                    {net >= 0 ? `+${net}` : net}
                  </div>
                  {/* Right Lane: Highs */}
                  <div className="flex items-center justify-start gap-2 h-7 bg-zinc-100 dark:bg-zinc-800/40 rounded-lg px-2 overflow-hidden">
                    <div
                      className="h-4 bg-teal-500 rounded-sm transition-all duration-500"
                      style={{ width: `${Math.max(highPct * 0.8, 3)}%` }}
                    />
                    <span className="font-mono text-zinc-500">{row.h}</span>
                  </div>
                  {/* Yesterday Net */}
                  <div className="text-right text-zinc-400 dark:text-zinc-500 font-mono text-[11px]">
                    Prev: {prevNet >= 0 ? `+${prevNet}` : prevNet}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 60-Day Ribbon & Slider */}
      <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold text-sm text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              Daily Heatmap Ribbon
              <span className="text-xs font-normal text-zinc-500 dark:text-zinc-400 font-mono">
                ({visibleSeries.length} sessions, {formatSessionDate(visibleSeries[0]?.d, data.asOf).formatted} to {formatSessionDate(visibleSeries[visibleSeries.length - 1]?.d, data.asOf).formatted})
              </span>
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Each column is one trading session. Teal indicates broad momentum, clay indicates broad liquidation.
            </p>
          </div>
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700/50">
            {[30, 60, 125, 250].map((r) => (
              <button
                key={r}
                onClick={() => {
                  setRange(r);
                  setOffset(0);
                }}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                  range === r
                    ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-xs font-semibold'
                    : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                }`}
              >
                {r}D
              </button>
            ))}
          </div>
        </div>

        {/* Ribbon Grid */}
        <div className="space-y-2 pt-2">
          {[
            { label: 'Net 1M Highs', fn: (s: SeriesPoint) => (s.h1m - s.l1m) / (0.1 * s.n) },
            { label: 'Net 6M Highs', fn: (s: SeriesPoint) => (s.h6m - s.l6m) / (0.05 * s.n) },
            { label: 'Monthly Thrust (25%)', fn: (s: SeriesPoint) => (s.g25 - s.l25) / (0.06 * s.n) },
            { label: 'Above 50d Average', fn: (s: SeriesPoint) => (s.m50 - 50) / 50 },
          ].map((row) => (
            <div key={row.label} className="grid grid-cols-[160px_1fr] items-center gap-3">
              <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">{row.label}</span>
              <div className="flex items-center gap-[2px] h-6 rounded overflow-hidden">
                {visibleSeries.map((s, i) => {
                  const val = row.fn(s);
                  return (
                    <div
                      key={i}
                      className="flex-1 h-full transition-all hover:scale-110 relative group"
                      style={{ backgroundColor: getHeatColor(val) }}
                    >
                      <div className="hidden group-hover:block absolute bottom-full mb-1 left-1/2 -translate-x-1/2 px-2 py-1 bg-zinc-900 text-white text-[10px] rounded font-mono whitespace-nowrap z-30 pointer-events-none shadow-lg">
                        {s.d}: {(val * 100).toFixed(1)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Earlier Slider */}
        {totSessions > range && (
          <div className="flex items-center gap-4 pt-2 text-xs text-zinc-500">
            <span>Earlier</span>
            <input
              type="range"
              min={0}
              max={totSessions - range}
              value={clampedOffset}
              onChange={(e) => setOffset(parseInt(e.target.value, 10))}
              className="flex-1 accent-teal-600 h-1.5 bg-zinc-200 dark:bg-zinc-800 rounded-lg cursor-pointer"
            />
            <span>Today</span>
          </div>
        )}
      </div>

      {/* Historical Interactive SVG Chart */}
      <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">Historical Breadth Wave</h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Interactive structural breadth trend across market cycles.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 p-1 rounded-xl bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700/50">
              {[
                { key: 'h1', label: 'Net 1M' },
                { key: 'h6', label: 'Net 6M' },
                { key: 'thrust', label: 'Thrust' },
                { key: 'm50', label: '% > 50d' },
              ].map((m) => (
                <button
                  key={m.key}
                  onClick={() => setChartMetric(m.key as any)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                    chartMetric === m.key
                      ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-xs font-semibold'
                      : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1 p-1 rounded-xl bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700/50">
              {[60, 125, 250, 375].map((h) => (
                <button
                  key={h}
                  onClick={() => setChartHorizon(h)}
                  className={`px-2 py-1 rounded-lg text-xs font-medium transition-all ${
                    chartHorizon === h
                      ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-xs font-semibold'
                      : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
                  }`}
                >
                  {h}d
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* SVG Container */}
        <div className="w-full h-56 bg-zinc-50 dark:bg-zinc-950/50 rounded-xl p-4 border border-zinc-100 dark:border-zinc-800/50 relative overflow-hidden">
          <svg viewBox="0 0 800 200" className="w-full h-full overflow-visible" preserveAspectRatio="none">
            {/* Zero line */}
            <line x1="0" y1={zeroY} x2="800" y2={zeroY} stroke="currentColor" strokeDasharray="4 4" className="text-zinc-300 dark:text-zinc-700" strokeWidth="1" />
            {/* Area fill */}
            <polygon
              points={`0,${zeroY} ${svgPoints} 800,${zeroY}`}
              fill="url(#chartGradient)"
              opacity="0.25"
            />
            {/* Line path */}
            <polyline
              points={svgPoints}
              fill="none"
              stroke="#0f7c75"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <defs>
              <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#0f7c75" />
                <stop offset="100%" stopColor="#0f7c75" stopOpacity="0" />
              </linearGradient>
            </defs>
          </svg>
          <div className="absolute top-2 right-3 text-[11px] font-mono text-zinc-400">
            Latest: <span className="font-bold text-teal-600 dark:text-teal-400">{chartValues[chartValues.length - 1]?.toFixed(1)}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
