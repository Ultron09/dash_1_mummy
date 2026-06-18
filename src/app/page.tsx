'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Upload, FileSpreadsheet, RefreshCw, Edit, Plus, X,
  TrendingUp, TrendingDown, Users, DollarSign, Activity,
  Briefcase, AlertTriangle, Info, Shield, Zap
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer, Cell
} from 'recharts';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)); }

const INR = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

const SEVERITY: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  red:    { bg: 'bg-rose-500/10',    text: 'text-rose-400',    border: 'border-rose-500/20',    dot: 'bg-rose-500' },
  amber:  { bg: 'bg-amber-500/10',   text: 'text-amber-400',   border: 'border-amber-500/20',   dot: 'bg-amber-500' },
  teal:   { bg: 'bg-teal-500/10',    text: 'text-teal-400',    border: 'border-teal-500/20',    dot: 'bg-teal-500' },
  purple: { bg: 'bg-purple-500/10',  text: 'text-purple-400',  border: 'border-purple-500/20',  dot: 'bg-purple-500' },
  blue:   { bg: 'bg-blue-500/10',    text: 'text-blue-400',    border: 'border-blue-500/20',    dot: 'bg-blue-500' },
};

const BAR_COLORS = ['#8b5cf6','#6366f1','#3b82f6','#0ea5e9','#10b981','#f59e0b','#ef4444'];

export default function Dashboard() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [view, setView] = useState<'alltime' | 'yearly' | 'monthly'>('alltime');
  const [selectedMonth, setSelectedMonth] = useState('');
  const [selectedYear, setSelectedYear] = useState('');
  const [formData, setFormData] = useState({
    employeeId: '', employeeName: '', functionRole: '',
    department: '', payrollMonth: '', gross: '', netPay: ''
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ view });
      if (view === 'monthly' && selectedMonth) params.set('month', selectedMonth);
      if (view === 'yearly' && selectedYear) params.set('year', selectedYear);
      const res = await fetch(`/api/dashboard?${params}`);
      if (res.ok) setData(await res.json());
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [view, selectedMonth, selectedYear]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleUpload = async (file: File) => {
    if (!file) return;
    setUploading(true);
    const fd = new FormData();
    fd.append('file', file);
    try {
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      const json = await res.json();
      if (res.ok) { await fetchData(); setUploadMsg(`✓ ${json.message}`); }
      else setUploadMsg(`✗ ${json.error || 'Upload failed'}`);
    } catch { setUploadMsg('✗ Network error'); }
    finally { setUploading(false); setTimeout(() => setUploadMsg(''), 6000); }
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/record', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formData) });
      if (res.ok) { setShowModal(false); fetchData(); }
      else setUploadMsg('✗ Manual update failed');
    } catch { setUploadMsg('✗ Network error'); }
  };

  const onDrag = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); };
  const onDrop = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); if (e.dataTransfer.files?.[0]) handleUpload(e.dataTransfer.files[0]); };

  const isEmpty = !data || !data.kpis;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 font-sans selection:bg-indigo-500/30">
      <div className="max-w-7xl mx-auto p-6 space-y-8">

        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800/60">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">Payroll Intelligence</h1>
            <p className="text-slate-400 mt-1 text-sm">Client Care · Workforce & pay analytics</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button onClick={() => setShowModal(true)} className="px-4 py-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 hover:bg-indigo-500/20 text-indigo-400 font-medium flex items-center gap-2 text-sm">
              <Edit className="w-4 h-4" /><span className="hidden sm:inline">Manual Entry</span>
            </button>
            <button onClick={fetchData} className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 hover:text-white">
              <RefreshCw className={cn('w-5 h-5', loading && 'animate-spin')} />
            </button>
            <div className="relative overflow-hidden rounded-xl border border-dashed border-slate-700 bg-slate-900/50 hover:bg-slate-800 hover:border-slate-600 transition-all cursor-pointer"
              onDragEnter={onDrag} onDragLeave={onDrag} onDragOver={onDrag} onDrop={onDrop}
              onClick={() => fileInputRef.current?.click()}>
              <div className="flex items-center gap-2 px-4 py-2">
                {uploading ? <RefreshCw className="w-4 h-4 animate-spin text-indigo-400" /> : <Upload className="w-4 h-4 text-indigo-400" />}
                <span className="text-sm font-medium text-slate-300">{uploading ? 'Processing…' : 'Upload CSV/XLSX'}</span>
              </div>
              <input ref={fileInputRef} type="file" accept=".csv,.xlsx" className="hidden" onChange={e => { if (e.target.files?.[0]) handleUpload(e.target.files[0]); }} />
            </div>
          </div>
        </header>

        {uploadMsg && (
          <div className={cn('px-4 py-3 rounded-xl text-sm font-medium border', uploadMsg.startsWith('✓') ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-rose-500/10 border-rose-500/20 text-rose-400')}>
            {uploadMsg}
          </div>
        )}

        {/* Report Filter */}
        {data && (
          <div className="flex flex-wrap items-center gap-3">
            {(['alltime','yearly','monthly'] as const).map(v => (
              <button key={v} onClick={() => setView(v)}
                className={cn('px-4 py-1.5 rounded-lg text-sm font-medium border transition-all',
                  view === v ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300' : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200')}>
                {v === 'alltime' ? 'All Time' : v === 'yearly' ? 'Yearly' : 'Monthly'}
              </button>
            ))}
            {view === 'yearly' && (
              <select value={selectedYear} onChange={e => setSelectedYear(e.target.value)}
                className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-200 text-sm outline-none focus:border-indigo-500">
                <option value="">Select year</option>
                {(data.allYears || []).map((y: string) => <option key={y} value={y}>{y}</option>)}
              </select>
            )}
            {view === 'monthly' && (
              <select value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}
                className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-200 text-sm outline-none focus:border-indigo-500">
                <option value="">Select month</option>
                {(data.allMonths || []).map((m: string) => <option key={m} value={m}>{m}</option>)}
              </select>
            )}
          </div>
        )}

        {loading && !data ? (
          <div className="flex flex-col items-center justify-center h-64 gap-4">
            <RefreshCw className="w-8 h-8 animate-spin text-indigo-500" />
            <p className="text-slate-400 animate-pulse">Loading payroll data…</p>
          </div>
        ) : isEmpty ? (
          <div className="flex flex-col items-center justify-center h-96 rounded-3xl border border-slate-800/60 bg-slate-900/20 relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
            <FileSpreadsheet className="w-16 h-16 text-slate-600 mb-4 group-hover:scale-110 group-hover:text-indigo-400 transition-all duration-500" />
            <h2 className="text-xl font-semibold text-slate-200">No Data Available</h2>
            <p className="text-slate-500 mt-2 text-center max-w-sm">Upload a payroll CSV or Excel file to generate the dashboard.</p>
          </div>
        ) : (
          <div className="space-y-8 animate-in fade-in duration-500">

            {/* 6 KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {[
                { label: 'Total Gross', value: INR(data.kpis.totalGross), icon: DollarSign, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
                { label: 'Net Disbursed', value: INR(data.kpis.totalNetPay), icon: Activity, color: 'text-blue-400', bg: 'bg-blue-500/10' },
                { label: 'Avg Gross/Head', value: INR(data.kpis.avgGross), icon: TrendingUp, color: 'text-indigo-400', bg: 'bg-indigo-500/10' },
                { label: 'PF Employer', value: INR(data.kpis.totalPfEmployer), icon: Shield, color: 'text-purple-400', bg: 'bg-purple-500/10' },
                { label: 'Total TDS', value: INR(data.kpis.totalIncomeTax), icon: Briefcase, color: 'text-rose-400', bg: 'bg-rose-500/10' },
                { label: 'Avg Tenure', value: `${data.kpis.avgTenure.toFixed(1)} yrs`, icon: Users, color: 'text-teal-400', bg: 'bg-teal-500/10' },
              ].map(k => (
                <div key={k.label} className="p-4 rounded-2xl border border-slate-800/60 bg-slate-900/40 backdrop-blur-xl flex flex-col gap-2 hover:border-slate-700/80 transition-all">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-400">{k.label}</span>
                    <div className={cn('p-1.5 rounded-lg', k.bg, k.color)}><k.icon className="w-3.5 h-3.5" /></div>
                  </div>
                  <span className="text-lg font-bold text-slate-100 leading-tight">{k.value}</span>
                </div>
              ))}
            </div>

            {/* Trend Chart */}
            <div className="p-6 rounded-3xl border border-slate-800/60 bg-slate-900/40 backdrop-blur-xl shadow-2xl min-w-0">
              <h3 className="text-base font-medium text-slate-200 mb-4 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-indigo-400" />Payroll Trend
              </h3>
              <div className="h-64 w-full" style={{ minWidth: 0 }}>
                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                  <AreaChart data={data.monthlyTrend} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gGross" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} /><stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gNet" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} /><stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                    <XAxis dataKey="month" stroke="#94a3b8" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tickFormatter={v => `₹${(v/100000).toFixed(0)}L`} stroke="#94a3b8" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <RechartsTooltip contentStyle={{ backgroundColor: 'rgba(15,23,42,0.95)', borderColor: '#334155', borderRadius: '12px' }} formatter={(v: any) => INR(Number(v))} />
                    <Area type="monotone" dataKey="totalGross" name="Gross" stroke="#8b5cf6" strokeWidth={2} fillOpacity={1} fill="url(#gGross)" />
                    <Area type="monotone" dataKey="totalNet" name="Net Pay" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#gNet)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Two Bar Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="p-6 rounded-3xl border border-slate-800/60 bg-slate-900/40 backdrop-blur-xl shadow-2xl min-w-0">
                <h3 className="text-base font-medium text-slate-200 mb-4">Salary Band Distribution</h3>
                <div className="h-56 w-full" style={{ minWidth: 0 }}>
                  <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                    <BarChart data={data.salaryBands} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                      <XAxis dataKey="label" stroke="#94a3b8" tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} />
                      <YAxis stroke="#94a3b8" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                      <RechartsTooltip contentStyle={{ backgroundColor: 'rgba(15,23,42,0.95)', borderColor: '#334155', borderRadius: '12px' }} />
                      <Bar dataKey="count" name="Employees" radius={[6, 6, 0, 0]}>
                        {data.salaryBands.map((_: any, i: number) => <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="p-6 rounded-3xl border border-slate-800/60 bg-slate-900/40 backdrop-blur-xl shadow-2xl min-w-0">
                <h3 className="text-base font-medium text-slate-200 mb-4">Workforce Tenure Distribution</h3>
                <div className="h-56 w-full" style={{ minWidth: 0 }}>
                  <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                    <BarChart data={data.tenureBuckets} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                      <XAxis dataKey="label" stroke="#94a3b8" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis stroke="#94a3b8" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                      <RechartsTooltip contentStyle={{ backgroundColor: 'rgba(15,23,42,0.95)', borderColor: '#334155', borderRadius: '12px' }} />
                      <Bar dataKey="count" name="Employees" radius={[6, 6, 0, 0]}>
                        {data.tenureBuckets.map((_: any, i: number) => <Cell key={i} fill={['#a855f7','#8b5cf6','#6366f1','#3b82f6','#0ea5e9','#06b6d4'][i % 6]} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* 8 Insight Cards */}
            <div>
              <h3 className="text-base font-medium text-slate-200 mb-4 flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-400" />Key Insights
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {(data.insights || []).map((ins: any) => {
                  const s = SEVERITY[ins.severity] || SEVERITY.blue;
                  return (
                    <div key={ins.id} className={cn('p-5 rounded-2xl border', s.border, 'bg-slate-900/60 backdrop-blur-xl')}>
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <span className={cn('inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border', s.bg, s.text, s.border)}>
                          <span className={cn('w-1.5 h-1.5 rounded-full', s.dot)} />{ins.label}
                        </span>
                        <AlertTriangle className={cn('w-4 h-4 mt-0.5 shrink-0', s.text)} />
                      </div>
                      <p className="text-sm font-semibold text-slate-100 mb-1">{ins.title}</p>
                      <p className={cn('text-xs font-bold mb-2', s.text)}>{ins.stat}</p>
                      <p className="text-xs text-slate-400 leading-relaxed">{ins.body}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Function Pay Table */}
            <div className="p-6 rounded-3xl border border-slate-800/60 bg-slate-900/40 backdrop-blur-xl shadow-2xl">
              <h3 className="text-base font-medium text-slate-200 mb-4 flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-indigo-400" />Function-Level Pay Intelligence
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 text-xs uppercase tracking-wide">
                      <th className="pb-3 px-3 font-medium">Function</th>
                      <th className="pb-3 px-3 text-right font-medium">Count</th>
                      <th className="pb-3 px-3 text-right font-medium">Avg Gross</th>
                      <th className="pb-3 px-3 text-right font-medium">Min</th>
                      <th className="pb-3 px-3 text-right font-medium">Max</th>
                      <th className="pb-3 px-3 font-medium">Distribution</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50">
                    {(data.functionStats || []).map((f: any) => {
                      const maxPossible = Math.max(...(data.functionStats || []).map((x: any) => x.totalGross));
                      const barW = maxPossible > 0 ? Math.round(f.totalGross / maxPossible * 100) : 0;
                      return (
                        <tr key={f.name} className="hover:bg-slate-800/20 transition-colors">
                          <td className="py-3 px-3 font-medium text-slate-200 capitalize">{f.name}</td>
                          <td className="py-3 px-3 text-right text-slate-300">{f.count}</td>
                          <td className="py-3 px-3 text-right text-emerald-400 font-medium">{INR(f.avgGross)}</td>
                          <td className="py-3 px-3 text-right text-slate-400">{f.minGross === Infinity ? '—' : INR(f.minGross)}</td>
                          <td className="py-3 px-3 text-right text-slate-400">{f.maxGross === -Infinity ? '—' : INR(f.maxGross)}</td>
                          <td className="py-3 px-3">
                            <div className="h-2 bg-slate-800 rounded-full w-32 overflow-hidden">
                              <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${barW}%` }} />
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  {data.functionTotal && (
                    <tfoot>
                      <tr className="border-t-2 border-slate-700 bg-slate-800/30">
                        <td className="py-3 px-3 font-bold text-slate-100">Total</td>
                        <td className="py-3 px-3 text-right font-bold text-slate-100">{data.functionTotal.count}</td>
                        <td className="py-3 px-3 text-right font-bold text-emerald-400">{INR(data.functionTotal.totalGross / (data.functionTotal.count || 1))}</td>
                        <td colSpan={3} />
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>

            {/* Variable Pay Anomaly Table */}
            {(data.variableAnomalies || []).length > 0 && (
              <div className="p-6 rounded-3xl border border-amber-500/20 bg-amber-500/5 backdrop-blur-xl">
                <h3 className="text-base font-medium text-amber-300 mb-4 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />Variable Pay Anomalies — Top CTC vs Gross Gaps
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm border-collapse">
                    <thead>
                      <tr className="border-b border-amber-500/20 text-slate-400 text-xs uppercase tracking-wide">
                        <th className="pb-3 px-3 font-medium">Employee</th>
                        <th className="pb-3 px-3 font-medium">Role</th>
                        <th className="pb-3 px-3 text-right font-medium">CTC/mo</th>
                        <th className="pb-3 px-3 text-right font-medium">Gross</th>
                        <th className="pb-3 px-3 text-right font-medium">Variable Pay</th>
                        <th className="pb-3 px-3 text-center font-medium">Multiplier</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50">
                      {data.variableAnomalies.map((r: any) => (
                        <tr key={r.employeeId} className="hover:bg-amber-500/5 transition-colors">
                          <td className="py-3 px-3 text-slate-200 font-medium">{r.name}</td>
                          <td className="py-3 px-3 text-slate-400 text-xs">{r.role}</td>
                          <td className="py-3 px-3 text-right text-slate-300">{r.ctcMonthly > 0 ? INR(r.ctcMonthly) : '—'}</td>
                          <td className="py-3 px-3 text-right text-emerald-400 font-medium">{INR(r.gross)}</td>
                          <td className="py-3 px-3 text-right text-indigo-400">{INR(r.variablePay)}</td>
                          <td className="py-3 px-3 text-center">
                            <span className="inline-block px-2 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                              {r.ratio.toFixed(2)}×
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

          </div>
        )}
      </div>

      {/* Manual Entry Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl shadow-2xl w-full max-w-lg relative">
            <button onClick={() => setShowModal(false)} className="absolute top-4 right-4 p-2 rounded-full hover:bg-slate-800 text-slate-400 hover:text-slate-200">
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-xl font-semibold text-slate-100 mb-6 flex items-center gap-2">
              <Edit className="w-5 h-5 text-indigo-400" />Manual Data Entry
            </h3>
            <form onSubmit={handleManualSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {([['employeeId','Employee ID *',true,'text','E.g. P00024'],['employeeName','Employee Name',false,'text','John Doe']] as const).map(([k,l,req,t,p]) => (
                  <div key={k} className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-400">{l}</label>
                    <input required={req} value={(formData as any)[k]} onChange={e => setFormData({...formData, [k]: e.target.value})} type={t} placeholder={p}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-200 focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 outline-none" />
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-4">
                {([['functionRole','Function *',true,'text','E.g. Counsellor'],['department','Department',false,'text','Client Care']] as const).map(([k,l,req,t,p]) => (
                  <div key={k} className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-400">{l}</label>
                    <input required={req} value={(formData as any)[k]} onChange={e => setFormData({...formData, [k]: e.target.value})} type={t} placeholder={p}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-200 focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 outline-none" />
                  </div>
                ))}
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-400">Payroll Month *</label>
                <input required value={formData.payrollMonth} onChange={e => setFormData({...formData, payrollMonth: e.target.value})} type="text" placeholder="May - 2026"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-200 focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                {([['gross','Gross Pay','0.00'],['netPay','Total Net Pay','0.00']] as const).map(([k,l,p]) => (
                  <div key={k} className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-400">{l}</label>
                    <input value={(formData as any)[k]} onChange={e => setFormData({...formData, [k]: e.target.value})} type="number" step="0.01" placeholder={p}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-200 focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 outline-none" />
                  </div>
                ))}
              </div>
              <div className="pt-4 flex justify-end gap-3">
                <button type="button" onClick={() => setShowModal(false)} className="px-5 py-2.5 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 font-medium">Cancel</button>
                <button type="submit" className="px-5 py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white font-medium flex items-center gap-2">
                  <Plus className="w-4 h-4" />Save Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
