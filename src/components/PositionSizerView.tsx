import React, { useState, useEffect } from 'react';
import { Calculator, ShieldAlert, CheckCircle2 } from 'lucide-react';

export const PositionSizerView: React.FC = () => {
  const [entryPrice, setEntryPrice] = useState<string>('500');
  const [stopLossPct, setStopLossPct] = useState<string>('3.5');
  const [capital, setCapital] = useState<string>('1000000');
  const [riskPct, setRiskPct] = useState<string>('1.0');
  const [allocPct, setAllocPct] = useState<string>('20.0');

  const entry = parseFloat(entryPrice) || 0;
  const slp = parseFloat(stopLossPct) || 0;
  const cap = parseFloat(capital) || 0;
  const risk = parseFloat(riskPct) || 0;
  const alloc = parseFloat(allocPct) || 0;

  const stopLossPrice = entry > 0 ? entry * (1 - slp / 100) : 0;
  const riskPerShare = entry > 0 ? entry - stopLossPrice : 0;

  // Max capital risk allowed (INR)
  const maxRiskAmount = cap * (risk / 100);

  // Shares based on Risk
  const sharesByRisk = riskPerShare > 0 ? Math.floor(maxRiskAmount / riskPerShare) : 0;
  const totalInvestmentByRisk = sharesByRisk * entry;
  const totalRiskByRisk = sharesByRisk * riskPerShare;

  // Shares based on Capital Allocation
  const maxAllocAmount = cap * (alloc / 100);
  const sharesByAlloc = entry > 0 ? Math.floor(maxAllocAmount / entry) : 0;
  const totalInvestmentByAlloc = sharesByAlloc * entry;
  const totalRiskByAlloc = sharesByAlloc * riskPerShare;

  const inr = (n: number) => '₹' + Math.round(n).toLocaleString('en-IN');

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-4">
        <div>
          <h2 className="text-lg font-bold text-zinc-900 dark:text-white flex items-center gap-2">
            <Calculator className="w-5 h-5 text-teal-600 dark:text-teal-400" />
            Institutional Position Sizer & Risk Calculator
          </h2>
          <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
            Calculates exact share quantities to trade based on your portfolio risk tolerance and stop-loss buffer. Runs entirely locally in your browser.
          </p>
        </div>

        {/* Inputs Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 pt-2">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Account Capital (₹)
            </label>
            <input
              type="number"
              value={capital}
              onChange={(e) => setCapital(e.target.value)}
              className="mt-1.5 w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-sm font-mono font-bold"
            />
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Entry Price (₹)
            </label>
            <input
              type="number"
              value={entryPrice}
              onChange={(e) => setEntryPrice(e.target.value)}
              className="mt-1.5 w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-sm font-mono font-bold"
            />
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Stop-Loss Buffer (%)
            </label>
            <input
              type="number"
              step="0.1"
              value={stopLossPct}
              onChange={(e) => setStopLossPct(e.target.value)}
              className="mt-1.5 w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-sm font-mono font-bold"
            />
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Risk Tolerance (% of Account)
            </label>
            <input
              type="number"
              step="0.25"
              value={riskPct}
              onChange={(e) => setRiskPct(e.target.value)}
              className="mt-1.5 w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-sm font-mono font-bold"
            />
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Target Allocation (% of Capital)
            </label>
            <input
              type="number"
              step="1"
              value={allocPct}
              onChange={(e) => setAllocPct(e.target.value)}
              className="mt-1.5 w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-sm font-mono font-bold"
            />
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Stop-Loss Trigger (₹)
            </label>
            <div className="mt-1.5 w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-900 text-sm font-mono font-bold text-clay-500">
              {stopLossPrice > 0 ? `₹${stopLossPrice.toFixed(2)}` : '–'}
            </div>
          </div>
        </div>
      </div>

      {/* Sizing Recommendations Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Card 1: By Risk */}
        <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-teal-600 dark:text-teal-400">
              Sized by Account Risk ({riskPct}%)
            </span>
            <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-teal-500/10 text-teal-600 dark:text-teal-400 font-semibold">
              Max Risk: {inr(maxRiskAmount)}
            </span>
          </div>

          <div className="py-2">
            <div className="text-4xl font-extrabold font-mono text-zinc-900 dark:text-white">
              {sharesByRisk.toLocaleString('en-IN')}
            </div>
            <p className="text-xs text-zinc-500 mt-1">Shares to buy</p>
          </div>

          <div className="space-y-2 pt-3 border-t border-zinc-100 dark:border-zinc-800/80 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-zinc-500">Total Capital Deployed</span>
              <strong className="font-mono text-zinc-900 dark:text-white">
                {inr(totalInvestmentByRisk)} ({((totalInvestmentByRisk / (cap || 1)) * 100).toFixed(1)}%)
              </strong>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-zinc-500">Risk if Stop Hit</span>
              <strong className="font-mono text-clay-500">{inr(totalRiskByRisk)}</strong>
            </div>
          </div>
        </div>

        {/* Card 2: By Allocation */}
        <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-300">
              Sized by Allocation ({allocPct}%)
            </span>
            <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-zinc-100 dark:bg-zinc-800 text-zinc-500 font-semibold">
              Position: {inr(maxAllocAmount)}
            </span>
          </div>

          <div className="py-2">
            <div className="text-4xl font-extrabold font-mono text-zinc-900 dark:text-white">
              {sharesByAlloc.toLocaleString('en-IN')}
            </div>
            <p className="text-xs text-zinc-500 mt-1">Shares to buy</p>
          </div>

          <div className="space-y-2 pt-3 border-t border-zinc-100 dark:border-zinc-800/80 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-zinc-500">Total Capital Deployed</span>
              <strong className="font-mono text-zinc-900 dark:text-white">{inr(totalInvestmentByAlloc)}</strong>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-zinc-500">Risk if Stop Hit</span>
              <strong className="font-mono text-clay-500">
                {inr(totalRiskByAlloc)} ({((totalRiskByAlloc / (cap || 1)) * 100).toFixed(2)}% of account)
              </strong>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
