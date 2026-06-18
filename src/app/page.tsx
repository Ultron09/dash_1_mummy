'use client';

import { useState, useEffect, useRef } from 'react';
import { 
  Upload, FileSpreadsheet, Activity, DollarSign, Users, Briefcase, 
  TrendingUp, TrendingDown, RefreshCw, AlertCircle, Edit, Plus, X
} from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell
} from 'recharts';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Chart Colors
const COLORS = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#6366f1'];

export default function Dashboard() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    employeeId: '',
    employeeName: '',
    functionRole: '',
    department: '',
    payrollMonth: '',
    gross: '',
    netPay: ''
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/dashboard');
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleFileUpload = async (file: File) => {
    if (!file) return;
    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });
      if (res.ok) {
        await fetchData(); // Refresh data
      } else {
        alert('Upload failed');
      }
    } catch (e) {
      console.error(e);
      alert('Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const onDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/record', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      if (res.ok) {
        setShowModal(false);
        fetchData();
      } else {
        alert('Update failed');
      }
    } catch (error) {
      console.error(error);
      alert('Update failed');
    }
  };

  const formatCurrency = (val: number) => 
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 font-sans p-6 selection:bg-indigo-500/30">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800/60">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">
              Payroll Intelligence
            </h1>
            <p className="text-slate-400 mt-1 text-sm">Real-time resource and performance tracking</p>
          </div>
          
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setShowModal(true)}
              className="px-4 py-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 hover:bg-indigo-500/20 transition-all text-indigo-400 font-medium flex items-center gap-2"
            >
              <Edit className="w-4 h-4" />
              <span className="hidden sm:inline">Manual Update</span>
            </button>
            <button 
              onClick={fetchData}
              className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 transition-all text-slate-300 hover:text-white group"
            >
              <RefreshCw className={cn("w-5 h-5", loading && "animate-spin")} />
            </button>
            <div 
              className={cn(
                "relative overflow-hidden rounded-xl border border-dashed transition-all duration-300 flex items-center justify-center p-0.5",
                dragActive ? "border-indigo-500 bg-indigo-500/10" : "border-slate-700 bg-slate-900/50 hover:bg-slate-800 hover:border-slate-600"
              )}
              onDragEnter={onDrag}
              onDragLeave={onDrag}
              onDragOver={onDrag}
              onDrop={onDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <div className="flex items-center gap-2 px-4 py-2 cursor-pointer relative z-10">
                {uploading ? (
                  <RefreshCw className="w-4 h-4 animate-spin text-indigo-400" />
                ) : (
                  <Upload className="w-4 h-4 text-indigo-400" />
                )}
                <span className="text-sm font-medium text-slate-300">
                  {uploading ? 'Processing...' : 'Upload CSV/XLSX'}
                </span>
              </div>
              <input 
                ref={fileInputRef}
                type="file" 
                accept=".csv, .xlsx" 
                className="hidden" 
                onChange={(e) => {
                  if (e.target.files?.[0]) handleFileUpload(e.target.files[0]);
                }}
              />
            </div>
          </div>
        </header>

        {loading && !data ? (
          <div className="flex flex-col items-center justify-center h-64 space-y-4">
            <RefreshCw className="w-8 h-8 animate-spin text-indigo-500" />
            <p className="text-slate-400 animate-pulse">Loading payroll data...</p>
          </div>
        ) : !data || data.monthlyTrend.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-96 rounded-3xl border border-slate-800/60 bg-slate-900/20 backdrop-blur-sm relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
            <FileSpreadsheet className="w-16 h-16 text-slate-600 mb-4 group-hover:scale-110 group-hover:text-indigo-400 transition-all duration-500" />
            <h2 className="text-xl font-semibold text-slate-200">No Data Available</h2>
            <p className="text-slate-500 mt-2 text-center max-w-sm">Upload a payroll CSV or Excel file to generate the dashboard.</p>
          </div>
        ) : (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* KPI Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <KPICard 
                title="Total Gross Pay" 
                value={formatCurrency(data.latestKPIs?.totalGross || 0)} 
                change={data.latestKPIs?.grossChange} 
                icon={DollarSign}
                color="text-emerald-400"
                bg="bg-emerald-500/10"
              />
              <KPICard 
                title="Total Net Pay" 
                value={formatCurrency(data.latestKPIs?.totalNet || 0)} 
                change={data.latestKPIs?.netChange} 
                icon={Activity}
                color="text-blue-400"
                bg="bg-blue-500/10"
              />
              <KPICard 
                title="Active Headcount" 
                value={data.latestKPIs?.headcount || 0} 
                change={data.latestKPIs?.headcountChange} 
                isNumeric 
                icon={Users}
                color="text-indigo-400"
                bg="bg-indigo-500/10"
              />
              <KPICard 
                title="Total Deductions" 
                value={formatCurrency(data.latestKPIs?.totalDeductions || 0)} 
                icon={Briefcase}
                color="text-rose-400"
                bg="bg-rose-500/10"
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Main Chart */}
              <div className="lg:col-span-2 p-6 rounded-3xl border border-slate-800/60 bg-slate-900/40 backdrop-blur-xl shadow-2xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-32 bg-indigo-500/5 rounded-full blur-3xl group-hover:bg-indigo-500/10 transition-colors duration-700 -z-10"></div>
                <h3 className="text-lg font-medium text-slate-200 mb-6 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-indigo-400" />
                  Payroll Expenditure Trend
                </h3>
                <div className="h-80 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data.monthlyTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorGross" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="colorNet" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                      <XAxis dataKey="month" stroke="#94a3b8" tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
                      <YAxis tickFormatter={(val) => `₹${(val/100000).toFixed(1)}L`} stroke="#94a3b8" tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
                      <RechartsTooltip 
                        contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', borderColor: '#334155', borderRadius: '12px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)' }}
                        itemStyle={{ color: '#e2e8f0' }}
                        formatter={(value: any) => formatCurrency(Number(value) || 0)}
                      />
                      <Area type="monotone" dataKey="totalGross" name="Gross Pay" stroke="#8b5cf6" strokeWidth={3} fillOpacity={1} fill="url(#colorGross)" />
                      <Area type="monotone" dataKey="totalNet" name="Net Pay" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorNet)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Department Distribution */}
              <div className="p-6 rounded-3xl border border-slate-800/60 bg-slate-900/40 backdrop-blur-xl shadow-2xl relative overflow-hidden group">
                <div className="absolute bottom-0 left-0 p-24 bg-cyan-500/5 rounded-full blur-3xl group-hover:bg-cyan-500/10 transition-colors duration-700 -z-10"></div>
                <h3 className="text-lg font-medium text-slate-200 mb-6 flex items-center gap-2">
                  <PieChart className="w-5 h-5 text-cyan-400" />
                  Cost by Department
                </h3>
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={data.departmentCosts}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={90}
                        paddingAngle={5}
                        dataKey="value"
                        stroke="none"
                      >
                        {data.departmentCosts.map((entry: any, index: number) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <RechartsTooltip 
                        contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', borderColor: '#334155', borderRadius: '12px' }}
                        formatter={(value: any) => formatCurrency(Number(value) || 0)}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex flex-wrap gap-2 justify-center mt-4">
                  {data.departmentCosts.slice(0, 4).map((entry: any, i: number) => (
                    <div key={i} className="flex items-center gap-1.5 text-xs text-slate-300 bg-slate-800/50 px-2 py-1 rounded-md">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }}></div>
                      <span className="truncate max-w-[80px]">{entry.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Function Scope Table */}
            <div className="p-6 rounded-3xl border border-slate-800/60 bg-slate-900/40 backdrop-blur-xl shadow-2xl">
              <h3 className="text-lg font-medium text-slate-200 mb-6 flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-indigo-400" />
                Scope of Manual Data Updation
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 text-sm">
                      <th className="pb-3 font-medium px-4">Function</th>
                      <th className="pb-3 font-medium px-4 text-right">Count of Employee</th>
                      <th className="pb-3 font-medium px-4 text-right">Total Net Pay(A-B-C+D+E+F)</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm divide-y divide-slate-800/50">
                    {data.functionStats?.map((stat: any, i: number) => (
                      <tr key={i} className="group hover:bg-slate-800/20 transition-colors">
                        <td className="py-4 px-4 font-medium text-slate-200 capitalize">{stat.name}</td>
                        <td className="py-4 px-4 text-right text-slate-300">{stat.count}</td>
                        <td className="py-4 px-4 text-right font-medium text-emerald-400">{formatCurrency(stat.totalNet)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-slate-700 bg-slate-800/30">
                      <td className="py-4 px-4 font-bold text-slate-100">Total</td>
                      <td className="py-4 px-4 text-right font-bold text-slate-100">{data.functionTotal?.count || 0}</td>
                      <td className="py-4 px-4 text-right font-bold text-emerald-400">{formatCurrency(data.functionTotal?.totalNet || 0)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
            
          </div>
        )}
      </div>

      {/* Manual Update Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl shadow-2xl w-full max-w-lg relative animate-in zoom-in-95 duration-200">
            <button 
              onClick={() => setShowModal(false)}
              className="absolute top-4 right-4 p-2 rounded-full hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-xl font-semibold text-slate-100 mb-6 flex items-center gap-2">
              <Edit className="w-5 h-5 text-indigo-400" />
              Manual Data Updation
            </h3>
            
            <form onSubmit={handleManualSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-400">Employee ID *</label>
                  <input required value={formData.employeeId} onChange={e => setFormData({...formData, employeeId: e.target.value})} type="text" className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-200 focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 outline-none transition-all" placeholder="E.g. P00024" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-400">Employee Name</label>
                  <input value={formData.employeeName} onChange={e => setFormData({...formData, employeeName: e.target.value})} type="text" className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-200 focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 outline-none transition-all" placeholder="John Doe" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-400">Function *</label>
                  <input required value={formData.functionRole} onChange={e => setFormData({...formData, functionRole: e.target.value})} type="text" className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-200 focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 outline-none transition-all" placeholder="E.g. counsellor" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-400">Department</label>
                  <input value={formData.department} onChange={e => setFormData({...formData, department: e.target.value})} type="text" className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-200 focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 outline-none transition-all" placeholder="Client Care" />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-400">Payroll Month *</label>
                <input required value={formData.payrollMonth} onChange={e => setFormData({...formData, payrollMonth: e.target.value})} type="text" className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-200 focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 outline-none transition-all" placeholder="May - 2026" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-400">Gross Pay</label>
                  <input value={formData.gross} onChange={e => setFormData({...formData, gross: e.target.value})} type="number" step="0.01" className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-200 focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 outline-none transition-all" placeholder="0.00" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-400">Total Net Pay</label>
                  <input value={formData.netPay} onChange={e => setFormData({...formData, netPay: e.target.value})} type="number" step="0.01" className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-200 focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 outline-none transition-all" placeholder="0.00" />
                </div>
              </div>

              <div className="pt-4 flex justify-end gap-3">
                <button type="button" onClick={() => setShowModal(false)} className="px-5 py-2.5 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 transition-all font-medium">Cancel</button>
                <button type="submit" className="px-5 py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white transition-all font-medium flex items-center gap-2">
                  <Plus className="w-4 h-4" /> Save Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function KPICard({ title, value, change, icon: Icon, color, bg, isNumeric = false }: any) {
  return (
    <div className="p-6 rounded-3xl border border-slate-800/60 bg-slate-900/40 backdrop-blur-xl shadow-xl flex flex-col group hover:border-slate-700/80 transition-all duration-300">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-sm font-medium text-slate-400">{title}</h4>
        <div className={cn("p-2 rounded-xl", bg, color)}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      <div className="flex items-end justify-between mt-auto">
        <span className="text-2xl lg:text-3xl font-bold text-slate-100 tracking-tight">{value}</span>
        {change !== undefined && change !== 0 && (
          <div className={cn(
            "flex items-center text-xs font-medium px-2 py-1 rounded-full",
            change > 0 ? "text-emerald-400 bg-emerald-500/10" : "text-rose-400 bg-rose-500/10"
          )}>
            {change > 0 ? <TrendingUp className="w-3 h-3 mr-1" /> : <TrendingDown className="w-3 h-3 mr-1" />}
            {isNumeric ? Math.abs(change) : `${Math.abs(change).toFixed(1)}%`}
          </div>
        )}
      </div>
    </div>
  );
}
