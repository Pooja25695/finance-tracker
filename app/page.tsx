'use client';

import { useEffect, useState, useMemo } from 'react';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend,
  AreaChart, Area,
} from 'recharts';

interface Transaction {
  id: string;
  card_id: string;
  date: string;
  description: string;
  merchant_clean: string;
  amount: number;
  transaction_type: 'debit' | 'credit';
  category: string;
}

interface Card {
  id: string;
  bank_name: string;
  currency: 'USD' | 'INR';
  color: string;
}

const CATEGORY_META: Record<string, { icon: string; color: string }> = {
  food:          { icon: '🍔', color: '#f59e0b' },
  shopping:      { icon: '🛍️', color: '#8b5cf6' },
  travel:        { icon: '✈️', color: '#3b82f6' },
  entertainment: { icon: '🎬', color: '#ec4899' },
  utilities:     { icon: '⚡', color: '#14b8a6' },
  health:        { icon: '💊', color: '#10b981' },
  finance:       { icon: '💳', color: '#6366f1' },
  education:     { icon: '📚', color: '#f97316' },
  other:         { icon: '📦', color: '#6b7280' },
};

function fmt(amount: number, currency: string) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency', currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

function StatCard({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div className="glass p-5 fade-in flex flex-col gap-1">
      <p className="text-xs text-slate-400 uppercase tracking-widest">{label}</p>
      <p className="text-2xl font-bold truncate" style={{ color: accent || '#e2e8f0' }}>{value}</p>
      {sub && <p className="text-xs text-slate-400">{sub}</p>}
    </div>
  );
}

export default function Dashboard() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('all');
  const [filterCard, setFilterCard] = useState('all');
  const [sortBy, setSortBy] = useState<'date' | 'amount'>('date');

  useEffect(() => {
    async function load() {
      try {
        const base = process.env.NODE_ENV === 'production' ? '/finance-tracker' : '';
        const [txRes, cardRes] = await Promise.all([
          fetch(`${base}/data/transactions.json`),
          fetch(`${base}/data/cards.json`),
        ]);
        if (txRes.ok) setTransactions(await txRes.json());
        if (cardRes.ok) setCards(await cardRes.json());
      } catch {}
      setLoading(false);
    }
    load();
  }, []);

  const filtered = useMemo(() => {
    return transactions
      .filter(t => t.transaction_type === 'debit')
      .filter(t => filterCat === 'all' || t.category === filterCat)
      .filter(t => filterCard === 'all' || t.card_id === filterCard)
      .filter(t =>
        search === '' ||
        t.merchant_clean?.toLowerCase().includes(search.toLowerCase()) ||
        t.description.toLowerCase().includes(search.toLowerCase())
      )
      .sort((a, b) =>
        sortBy === 'date'
          ? new Date(b.date).getTime() - new Date(a.date).getTime()
          : b.amount - a.amount
      );
  }, [transactions, filterCat, filterCard, search, sortBy]);

  const totalUSD = filtered.filter(t => cards.find(c => c.id === t.card_id)?.currency === 'USD').reduce((s, t) => s + t.amount, 0);
  const totalINR = filtered.filter(t => cards.find(c => c.id === t.card_id)?.currency === 'INR').reduce((s, t) => s + t.amount, 0);

  const topMerchant = useMemo(() => {
    const m: Record<string, number> = {};
    filtered.forEach(t => { m[t.merchant_clean || t.description] = (m[t.merchant_clean || t.description] || 0) + t.amount; });
    return Object.entries(m).sort((a, b) => b[1] - a[1])[0];
  }, [filtered]);

  const catData = useMemo(() => {
    const m: Record<string, number> = {};
    filtered.forEach(t => { m[t.category] = (m[t.category] || 0) + t.amount; });
    return Object.entries(m).map(([name, value]) => ({ name, value: Math.round(value) })).sort((a, b) => b.value - a.value);
  }, [filtered]);

  const monthlyData = useMemo(() => {
    const m: Record<string, Record<string, number>> = {};
    filtered.forEach(t => {
      const mo = new Date(t.date).toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      if (!m[mo]) m[mo] = {};
      const card = cards.find(c => c.id === t.card_id);
      const key = card?.bank_name || 'Other';
      m[mo][key] = (m[mo][key] || 0) + t.amount;
    });
    return Object.entries(m).slice(-6).map(([month, vals]) => ({ month, ...vals }));
  }, [filtered, cards]);

  const trendData = useMemo(() => {
    const m: Record<string, number> = {};
    filtered.forEach(t => { m[t.date] = (m[t.date] || 0) + t.amount; });
    return Object.entries(m).sort().slice(-30).map(([date, amount]) => ({
      date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      amount: Math.round(amount),
    }));
  }, [filtered]);

  const categories = [...new Set(transactions.map(t => t.category))];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="glass p-8 text-center">
          <p className="text-3xl mb-3">💰</p>
          <p className="text-slate-300">Loading your finances...</p>
        </div>
      </div>
    );
  }

  if (transactions.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="glass p-10 text-center max-w-md">
          <p className="text-5xl mb-4">📭</p>
          <h2 className="text-xl font-bold mb-2 text-white">No data yet</h2>
          <p className="text-slate-400 text-sm mb-3">Run the sync command to fetch your statements:</p>
          <code className="block glass-dark p-3 text-sm text-emerald-400">/sync-finances</code>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 md:p-6 lg:p-8 max-w-7xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between mb-8 fade-in">
        <div>
          <h1 className="text-3xl font-bold text-white">💰 Finance Tracker</h1>
          <p className="text-slate-400 text-sm mt-1">{filtered.length} transactions</p>
        </div>
        <div className="flex gap-2 flex-wrap justify-end">
          {cards.map(c => (
            <span key={c.id} className="glass-dark px-3 py-1 text-xs font-semibold" style={{ color: c.color }}>
              {c.bank_name} · {c.currency}
            </span>
          ))}
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {totalUSD > 0 && <StatCard label="Total Spend (USD)" value={fmt(totalUSD, 'USD')} accent="#f97316" />}
        {totalINR > 0 && <StatCard label="Total Spend (INR)" value={fmt(totalINR, 'INR')} accent="#8b5cf6" />}
        <StatCard label="Transactions" value={filtered.length.toString()} sub="debits only" accent="#3b82f6" />
        {topMerchant && <StatCard label="Top Merchant" value={topMerchant[0]} sub={`${Math.round(topMerchant[1]).toLocaleString()} total`} accent="#14b8a6" />}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="glass p-5 fade-in">
          <h3 className="text-xs text-slate-400 uppercase tracking-widest mb-4">By Category</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={catData} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={3} dataKey="value">
                {catData.map((entry) => (
                  <Cell key={entry.name} fill={CATEGORY_META[entry.name]?.color || '#6b7280'} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ background: 'rgba(15,12,41,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#e2e8f0', fontSize: 12 }} formatter={(v) => [Number(v).toLocaleString(), '']} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
            {catData.slice(0, 6).map(d => (
              <span key={d.name} className="text-xs flex items-center gap-1">
                <span>{CATEGORY_META[d.name]?.icon}</span>
                <span className="text-slate-400">{d.name}</span>
              </span>
            ))}
          </div>
        </div>

        <div className="glass p-5 fade-in md:col-span-2">
          <h3 className="text-xs text-slate-400 uppercase tracking-widest mb-4">Monthly Spend</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={monthlyData} barSize={18}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="month" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: 'rgba(15,12,41,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#e2e8f0', fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />
              {cards.map(c => <Bar key={c.id} dataKey={c.bank_name} fill={c.color} radius={[4, 4, 0, 0]} />)}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {trendData.length > 1 && (
        <div className="glass p-5 mb-6 fade-in">
          <h3 className="text-xs text-slate-400 uppercase tracking-widest mb-4">Daily Spend (Last 30 Days)</h3>
          <ResponsiveContainer width="100%" height={140}>
            <AreaChart data={trendData}>
              <defs>
                <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: 'rgba(15,12,41,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#e2e8f0', fontSize: 12 }} />
              <Area type="monotone" dataKey="amount" stroke="#8b5cf6" fill="url(#trendGrad)" strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Filters */}
      <div className="glass p-4 mb-4 flex flex-wrap gap-3 items-center fade-in">
        <input
          className="glass-dark px-3 py-2 text-sm text-slate-200 placeholder-slate-500 outline-none flex-1 min-w-[160px]"
          placeholder="🔍 Search merchant..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select className="glass-dark px-3 py-2 text-sm text-slate-300 outline-none bg-transparent cursor-pointer" value={filterCat} onChange={e => setFilterCat(e.target.value)}>
          <option value="all" className="bg-slate-900">All categories</option>
          {categories.map(c => <option key={c} value={c} className="bg-slate-900">{CATEGORY_META[c]?.icon} {c}</option>)}
        </select>
        <select className="glass-dark px-3 py-2 text-sm text-slate-300 outline-none bg-transparent cursor-pointer" value={filterCard} onChange={e => setFilterCard(e.target.value)}>
          <option value="all" className="bg-slate-900">All cards</option>
          {cards.map(c => <option key={c.id} value={c.id} className="bg-slate-900">{c.bank_name}</option>)}
        </select>
        <select className="glass-dark px-3 py-2 text-sm text-slate-300 outline-none bg-transparent cursor-pointer" value={sortBy} onChange={e => setSortBy(e.target.value as 'date' | 'amount')}>
          <option value="date" className="bg-slate-900">Sort: Date</option>
          <option value="amount" className="bg-slate-900">Sort: Amount</option>
        </select>
      </div>

      {/* Transaction Table */}
      <div className="glass overflow-hidden fade-in mb-8">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-slate-400 text-xs uppercase tracking-wider">
                <th className="text-left p-4">Date</th>
                <th className="text-left p-4">Merchant</th>
                <th className="text-left p-4">Category</th>
                <th className="text-left p-4">Card</th>
                <th className="text-right p-4">Amount</th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 100).map(t => {
                const card = cards.find(c => c.id === t.card_id);
                const meta = CATEGORY_META[t.category] || CATEGORY_META.other;
                return (
                  <tr key={t.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                    <td className="p-4 text-slate-400 whitespace-nowrap">
                      {new Date(t.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })}
                    </td>
                    <td className="p-4 text-slate-200 max-w-[200px] truncate" title={t.description}>
                      {t.merchant_clean || t.description}
                    </td>
                    <td className="p-4">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
                        style={{ background: `${meta.color}22`, color: meta.color, border: `1px solid ${meta.color}44` }}>
                        {meta.icon} {t.category}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className="text-xs font-medium" style={{ color: card?.color || '#94a3b8' }}>
                        {card?.bank_name}
                      </span>
                    </td>
                    <td className="p-4 text-right font-mono font-semibold text-slate-200">
                      {fmt(t.amount, card?.currency || 'USD')}
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={5} className="p-8 text-center text-slate-500">No transactions match your filters</td></tr>
              )}
            </tbody>
          </table>
        </div>
        {filtered.length > 100 && (
          <p className="p-3 text-center text-xs text-slate-500 border-t border-white/5">
            Showing 100 of {filtered.length} transactions
          </p>
        )}
      </div>
    </div>
  );
}
