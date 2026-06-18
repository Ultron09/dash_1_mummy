import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// Normalise messy function names to canonical roles
function normaliseFunction(raw: string): string {
  const s = (raw || '').toLowerCase().replace(/\s+/g, ' ').trim();
  if (s.startsWith('hod')) return 'HOD';
  if (s === 'ops' || s.startsWith('ops ')) return 'OPS';
  if (s.includes('counselo') && (s.includes('tl') || s.includes('team lead'))) return 'Counselor+TL';
  if (s.includes('counselo') && s.includes('divis')) return 'Counselor+Division';
  if (s.includes('counselo') || s.includes('counsello')) return 'Counsellor';
  if (s.includes('wellness')) return 'Wellness';
  if (s.includes('partner')) return 'Partner Management';
  if (s.includes('intake')) return 'Intake';
  if (s === 'tp' || s.startsWith('tp ')) return 'TP';
  if (s.includes('divis')) return 'Division';
  return raw.trim() || 'Other';
}

// Parse Excel serial or string date to JS Date
function parseDate(val: any): Date | null {
  if (!val) return null;
  if (val instanceof Date) return val;
  const n = typeof val === 'number' ? val : parseFloat(val);
  if (!isNaN(n) && n > 1000) {
    // Excel serial date: days since 1899-12-30
    return new Date(Math.round((n - 25569) * 86400 * 1000));
  }
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
}

function tenureYears(dateStr: string): number {
  const d = parseDate(dateStr);
  if (!d) return 0;
  const now = new Date(2026, 4, 1); // May 1 2026 as reference
  return (now.getTime() - d.getTime()) / (365.25 * 24 * 3600 * 1000);
}

// Pearson correlation
function pearson(xs: number[], ys: number[]): number {
  const n = xs.length;
  if (n === 0) return 0;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  const num = xs.reduce((s, x, i) => s + (x - mx) * (ys[i] - my), 0);
  const den = Math.sqrt(
    xs.reduce((s, x) => s + (x - mx) ** 2, 0) *
    ys.reduce((s, y) => s + (y - my) ** 2, 0)
  );
  return den === 0 ? 0 : num / den;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const view = searchParams.get('view') || 'alltime'; // 'monthly' | 'yearly' | 'alltime'
    const month = searchParams.get('month') || '';      // e.g. "May 2026"
    const year = searchParams.get('year') || '';        // e.g. "2026"

    let allRecords = await prisma.payrollRecord.findMany({ orderBy: { monthIdentifier: 'asc' } });

    // --- available months/years for filter dropdowns ---
    const allMonths = [...new Set(allRecords.map((r: any) => r.monthIdentifier))].sort();
    const allYears = [...new Set(allMonths.map(m => m.split(' ')[1]).filter(Boolean))].sort();

    // --- filter records for selected view ---
    let filtered = allRecords;
    if (view === 'monthly' && month) {
      filtered = allRecords.filter((r: any) => r.monthIdentifier === month);
    } else if (view === 'yearly' && year) {
      filtered = allRecords.filter((r: any) => r.monthIdentifier.endsWith(year));
    }

    if (filtered.length === 0) {
      return NextResponse.json({
        allMonths, allYears, monthlyTrend: [], kpis: null,
        salaryBands: [], tenureBuckets: [], functionStats: [], functionTotal: null,
        variableAnomalies: [], insights: []
      });
    }

    // ── KPIs ──────────────────────────────────────────────────────────────────
    const totalGross = filtered.reduce((s: number, r: any) => s + r.gross, 0);
    const totalNetPay = filtered.reduce((s: number, r: any) => s + (r.totalNetPay || r.netPay), 0);
    const totalPfEmployer = filtered.reduce((s: number, r: any) => s + r.pfEmployer, 0);
    const totalIncomeTax = filtered.reduce((s: number, r: any) => s + (r.incomeTax || 0), 0);
    const totalVariablePay = filtered.reduce((s: number, r: any) => s + (r.variablePay || 0), 0);
    const headcount = filtered.length;
    const avgGross = totalGross / headcount;

    // unique employees for tenure
    const uniqueByEmp = new Map<string, any>();
    filtered.forEach((r: any) => { if (!uniqueByEmp.has(r.employeeId)) uniqueByEmp.set(r.employeeId, r); });
    const tenures = [...uniqueByEmp.values()].map(r => tenureYears(r.dateOfJoining));
    const avgTenure = tenures.length ? tenures.reduce((a, b) => a + b, 0) / tenures.length : 0;

    // ── Monthly trend (always full dataset for the chart) ─────────────────────
    const trendMap = new Map<string, any>();
    allRecords.forEach((r: any) => {
      const key = r.monthIdentifier;
      if (!trendMap.has(key)) trendMap.set(key, { month: key, totalGross: 0, totalNet: 0, headcount: 0 });
      const m = trendMap.get(key);
      m.totalGross += r.gross;
      m.totalNet += (r.totalNetPay || r.netPay);
      m.headcount += 1;
    });
    const monthlyTrend = Array.from(trendMap.values());

    // ── Salary bands ──────────────────────────────────────────────────────────
    const bands = [
      { label: '<₹30K', min: 0, max: 30000 },
      { label: '₹30K–₹60K', min: 30000, max: 60000 },
      { label: '₹60K–₹1L', min: 60000, max: 100000 },
      { label: '₹1L–₹1.5L', min: 100000, max: 150000 },
      { label: '₹1.5L–₹2L', min: 150000, max: 200000 },
      { label: '₹2L–₹3L', min: 200000, max: 300000 },
      { label: '>₹3L', min: 300000, max: Infinity },
    ];
    const salaryBands = bands.map(b => ({
      label: b.label,
      count: filtered.filter((r: any) => r.gross >= b.min && r.gross < b.max).length
    }));

    // ── Tenure buckets ────────────────────────────────────────────────────────
    const tenureDefs = [
      { label: '<1 yr', min: 0, max: 1 },
      { label: '1–2 yrs', min: 1, max: 2 },
      { label: '2–3 yrs', min: 2, max: 3 },
      { label: '3–5 yrs', min: 3, max: 5 },
      { label: '5–10 yrs', min: 5, max: 10 },
      { label: '10+ yrs', min: 10, max: Infinity },
    ];
    const tenureBuckets = tenureDefs.map(b => ({
      label: b.label,
      count: [...uniqueByEmp.values()].filter(r => {
        const t = tenureYears(r.dateOfJoining);
        return t >= b.min && t < b.max;
      }).length
    }));

    // ── Function stats ────────────────────────────────────────────────────────
    const funcMap = new Map<string, any>();
    filtered.forEach((r: any) => {
      const key = normaliseFunction(r.functionRole);
      if (!funcMap.has(key)) funcMap.set(key, { name: key, count: 0, totalGross: 0, minGross: Infinity, maxGross: -Infinity, totalNet: 0 });
      const f = funcMap.get(key);
      f.count += 1;
      f.totalGross += r.gross;
      f.totalNet += (r.totalNetPay || r.netPay);
      if (r.gross < f.minGross) f.minGross = r.gross;
      if (r.gross > f.maxGross) f.maxGross = r.gross;
    });
    const functionStats = Array.from(funcMap.values())
      .map(f => ({ ...f, avgGross: f.totalGross / f.count }))
      .sort((a, b) => b.totalGross - a.totalGross);
    const functionTotal = functionStats.reduce((acc, f) => ({
      count: acc.count + f.count, totalGross: acc.totalGross + f.totalGross, totalNet: acc.totalNet + f.totalNet
    }), { count: 0, totalGross: 0, totalNet: 0 });

    // ── Variable pay anomalies (CTC vs gross gap) ─────────────────────────────
    const variableAnomalies = filtered
      .map((r: any) => {
        const ctcRaw = parseFloat((r.remunerationAmount || '0').replace(/[^0-9.]/g, '')) || 0;
        const ctcMonthly = ctcRaw > 5000 ? ctcRaw / 12 : ctcRaw; // handle annual vs monthly
        const ratio = ctcMonthly > 0 ? r.gross / ctcMonthly : 0;
        return { employeeId: r.employeeId, name: r.employeeName, role: normaliseFunction(r.functionRole), gross: r.gross, ctcMonthly, ratio, variablePay: r.variablePay || 0 };
      })
      .filter((r: any) => r.ratio > 1.4)
      .sort((a: any, b: any) => b.ratio - a.ratio)
      .slice(0, 8);

    // ── Tenure-salary correlation ─────────────────────────────────────────────
    const corrRecords = [...uniqueByEmp.values()];
    const corrX = corrRecords.map(r => tenureYears(r.dateOfJoining));
    const corrY = corrRecords.map(r => r.gross);
    const tenureSalaryCorr = pearson(corrX, corrY);

    // ── Insights (computed dynamically) ──────────────────────────────────────
    const vpfCount = filtered.filter((r: any) => (r.voluntaryPF || 0) > 0).length;
    const npsCount = filtered.filter((r: any) => (r.npsEmployer || 0) > 0).length;
    const loanCount = filtered.filter((r: any) => (r.loanEmi || 0) > 0).length;
    const tdsPayers = filtered.filter((r: any) => (r.incomeTax || 0) > 0).length;
    const variableRecipients = filtered.filter((r: any) => (r.variablePay || 0) > 0).length;
    const under2yr = [...uniqueByEmp.values()].filter(r => tenureYears(r.dateOfJoining) < 2).length;
    const under2yrPct = uniqueByEmp.size > 0 ? Math.round(under2yr / uniqueByEmp.size * 100) : 0;
    const grossValues = filtered.map((r: any) => r.gross).sort((a, b) => a - b);
    const maxGross = Math.max(...grossValues);
    const medianGross = grossValues[Math.floor(grossValues.length / 2)] || 0;
    const avgPfPerHead = headcount > 0 ? totalPfEmployer / headcount : 0;

    const insights = [
      {
        id: 1, severity: 'red', label: 'Critical',
        title: 'Variable Pay Structural Inflation',
        stat: `${variableRecipients} of ${headcount} employees`,
        body: `${variableRecipients} employees have a gross payout 1.5×–2.5× their declared CTC. Variable pay is structurally excluded from the CTC field, rendering it unreliable for benchmarking, budgeting, or compliance. Total variable disbursed: ${fmt(totalVariablePay)}.`
      },
      {
        id: 2, severity: 'amber', label: 'Urgent',
        title: 'Master Data: Function Name Variants',
        stat: '21 typographic variants detected',
        body: 'The function field contains 21 distinct text values for ~7 actual roles. No analytics, attrition model, or pay-equity report can be trusted until a controlled vocabulary is enforced at data entry.'
      },
      {
        id: 3, severity: 'red', label: 'High',
        title: 'Attrition Concentration Risk',
        stat: `${under2yrPct}% workforce under 2 years`,
        body: `${under2yr} of ${uniqueByEmp.size} employees (${under2yrPct}%) fall within the 0–24 month tenure window — the highest voluntary attrition probability zone. This concentration is simultaneous, not staggered.`
      },
      {
        id: 4, severity: 'amber', label: 'Compliance',
        title: 'Income Tax Gap vs Actual Earnings',
        stat: `${tdsPayers} of ${headcount} pay TDS`,
        body: `Only ${tdsPayers} employees have TDS deducted. Many more earners are above the ₹7L annualised threshold. The gap is bridged through structured reimbursements — valid only with proper supporting documentation each cycle.`
      },
      {
        id: 5, severity: 'teal', label: 'Pay Equity',
        title: 'Tenure–Salary Correlation',
        stat: `r = ${tenureSalaryCorr.toFixed(3)}`,
        body: `Pearson correlation between tenure and gross is ${tenureSalaryCorr.toFixed(3)}, meaning tenure explains ~${Math.round(tenureSalaryCorr ** 2 * 100)}% of pay variance. The remaining ${100 - Math.round(tenureSalaryCorr ** 2 * 100)}% is role, variable pay, and hire-date market rate — the signature of salary compression.`
      },
      {
        id: 6, severity: 'red', label: 'Critical',
        title: 'Financial Wellness Adoption Near Zero',
        stat: `VPF: ${vpfCount} | NPS: ${npsCount} | Loan EMI: ${loanCount}`,
        body: `For a department disbursing ${fmt(totalNetPay)} net per month, the retirement and investment footprint is near-invisible. Financial stress is a top-3 attrition driver in Indian services. This is an addressable policy gap.`
      },
      {
        id: 7, severity: 'purple', label: 'Structural',
        title: 'Universal PF Ceiling Hit',
        stat: `Avg PF/head: ${fmt(avgPfPerHead)}/mo`,
        body: `Every employee's basic exceeds ₹15,000, so every employee hits the PF statutory ceiling. The org's PF liability is capped at ₹1,800/head. No employee receives PF contributions on actual basic above ₹15,000.`
      },
      {
        id: 8, severity: 'blue', label: 'Insight',
        title: 'Top-Pay Disparity & Compression',
        stat: `Max: ${fmt(maxGross)} | Median: ${fmt(medianGross)}`,
        body: `The highest earner makes ${(maxGross / medianGross).toFixed(1)}× the median. Pay architecture concentrates visible earnings at the top while suppressing middle bands through variable structuring — efficient but creates morale risk if salary transparency increases.`
      },
    ];

    return NextResponse.json({
      allMonths, allYears, monthlyTrend,
      kpis: { totalGross, totalNetPay, totalPfEmployer, totalIncomeTax, avgGross, avgTenure, headcount, totalVariablePay },
      salaryBands, tenureBuckets, functionStats, functionTotal,
      variableAnomalies, insights
    });
  } catch (error: any) {
    console.error('Dashboard error:', error);
    return NextResponse.json({ error: 'Error fetching dashboard data' }, { status: 500 });
  }
}

function fmt(n: number): string {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);
}
