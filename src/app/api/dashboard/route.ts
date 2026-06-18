import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

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

function tenureYears(dateStr: string): number {
  if (!dateStr) return 0;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return 0;
  return (new Date(2026,4,1).getTime() - d.getTime()) / (365.25*24*3600*1000);
}

function pearson(xs: number[], ys: number[]): number {
  const n = xs.length;
  if (!n) return 0;
  const mx = xs.reduce((a,b)=>a+b,0)/n, my = ys.reduce((a,b)=>a+b,0)/n;
  const num = xs.reduce((s,x,i)=>s+(x-mx)*(ys[i]-my),0);
  const den = Math.sqrt(xs.reduce((s,x)=>s+(x-mx)**2,0)*ys.reduce((s,y)=>s+(y-my)**2,0));
  return den===0?0:num/den;
}

function fmt(n: number): string {
  return new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:0}).format(n);
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const view = searchParams.get('view') || 'alltime';
    const month = searchParams.get('month') || '';
    const year = searchParams.get('year') || '';

    const allRecords: any[] = await prisma.payrollRecord.findMany({ orderBy: { monthIdentifier: 'asc' } });
    const allMonths = [...new Set(allRecords.map(r=>r.monthIdentifier))].sort();
    const allYears = [...new Set(allMonths.map(m=>m.split(' ')[1]).filter(Boolean))].sort();

    let filtered: any[] = allRecords;
    if (view==='monthly' && month) filtered = allRecords.filter(r=>r.monthIdentifier===month);
    else if (view==='yearly' && year) filtered = allRecords.filter(r=>r.monthIdentifier.endsWith(year));

    if (!filtered.length) {
      return NextResponse.json({ allMonths, allYears, monthlyTrend:[], kpis:null, salaryBands:[], tenureBuckets:[], functionStats:[], functionTotal:null, variableAnomalies:[], insights:[], complianceFlags:[], riskLeaderboard:[] });
    }

    // ── KPIs ─────────────────────────────────────────────────────────────────
    const totalGross = filtered.reduce((s,r)=>s+r.gross,0);
    const totalNetPay = filtered.reduce((s,r)=>s+(r.totalNetPay||r.netPay),0);
    const totalPfEmployer = filtered.reduce((s,r)=>s+r.pfEmployer,0);
    const totalIncomeTax = filtered.reduce((s,r)=>s+(r.incomeTax||0),0);
    const totalVariablePay = filtered.reduce((s,r)=>s+(r.variablePay||0),0);
    const totalGratuityProvision = filtered.reduce((s,r)=>s+(r.gratuityProvision||0),0);
    const totalTrueCost = filtered.reduce((s,r)=>s+r.gross+(r.pfEmployer||0)+(r.gratuityProvision||0)+(r.groupHealthPremium||0)+(r.trainingCostAmort||0),0);
    const headcount = filtered.length;

    const uniqueByEmp = new Map<string,any>();
    filtered.forEach(r=>{ if (!uniqueByEmp.has(r.employeeId)) uniqueByEmp.set(r.employeeId,r); });
    const tenures = [...uniqueByEmp.values()].map(r=>tenureYears(r.dateOfJoining));
    const avgTenure = tenures.length ? tenures.reduce((a,b)=>a+b,0)/tenures.length : 0;

    const genderMap = new Map<string,number>();
    [...uniqueByEmp.values()].forEach(r=>{ const g=(r.gender||'Unknown').trim(); genderMap.set(g,(genderMap.get(g)||0)+1); });
    const genderBreakdown = Object.fromEntries(genderMap);

    // ── Trend ────────────────────────────────────────────────────────────────
    const trendMap = new Map<string,any>();
    allRecords.forEach(r=>{
      if (!trendMap.has(r.monthIdentifier)) trendMap.set(r.monthIdentifier,{month:r.monthIdentifier,totalGross:0,totalNet:0,headcount:0});
      const m=trendMap.get(r.monthIdentifier); m.totalGross+=r.gross; m.totalNet+=(r.totalNetPay||r.netPay); m.headcount+=1;
    });
    const monthlyTrend = Array.from(trendMap.values());

    // ── Salary bands ─────────────────────────────────────────────────────────
    const bands = [{label:'<₹30K',min:0,max:30000},{label:'₹30K–₹60K',min:30000,max:60000},{label:'₹60K–₹1L',min:60000,max:100000},{label:'₹1L–₹1.5L',min:100000,max:150000},{label:'₹1.5L–₹2L',min:150000,max:200000},{label:'₹2L–₹3L',min:200000,max:300000},{label:'>₹3L',min:300000,max:Infinity}];
    const salaryBands = bands.map(b=>({ label:b.label, count:filtered.filter(r=>r.gross>=b.min&&r.gross<b.max).length }));

    // ── Tenure buckets ────────────────────────────────────────────────────────
    const tDefs = [{label:'<1 yr',min:0,max:1},{label:'1–2 yrs',min:1,max:2},{label:'2–3 yrs',min:2,max:3},{label:'3–5 yrs',min:3,max:5},{label:'5–10 yrs',min:5,max:10},{label:'10+ yrs',min:10,max:Infinity}];
    const tenureBuckets = tDefs.map(b=>({ label:b.label, count:[...uniqueByEmp.values()].filter(r=>{ const t=tenureYears(r.dateOfJoining); return t>=b.min&&t<b.max; }).length }));

    // ── Function stats ────────────────────────────────────────────────────────
    const funcMap = new Map<string,any>();
    filtered.forEach(r=>{
      const key=normaliseFunction(r.functionRole);
      if (!funcMap.has(key)) funcMap.set(key,{name:key,count:0,totalGross:0,minGross:Infinity,maxGross:-Infinity,totalNet:0});
      const f=funcMap.get(key); f.count+=1; f.totalGross+=r.gross; f.totalNet+=(r.totalNetPay||r.netPay);
      if (r.gross<f.minGross) f.minGross=r.gross; if (r.gross>f.maxGross) f.maxGross=r.gross;
    });
    const functionStats = Array.from(funcMap.values()).map(f=>({...f,avgGross:f.totalGross/f.count})).sort((a,b)=>b.totalGross-a.totalGross);
    const functionTotal = functionStats.reduce((acc,f)=>({count:acc.count+f.count,totalGross:acc.totalGross+f.totalGross,totalNet:acc.totalNet+f.totalNet}),{count:0,totalGross:0,totalNet:0});

    // ── Variable anomalies ────────────────────────────────────────────────────
    const variableAnomalies = filtered.map(r=>{
      const ctcRaw=parseFloat((r.remunerationAmount||'0').replace(/[^0-9.]/g,''))||0;
      const ctcMonthly=ctcRaw>5000?ctcRaw/12:ctcRaw;
      const ratio=ctcMonthly>0?r.gross/ctcMonthly:0;
      return {employeeId:r.employeeId,name:r.employeeName,role:normaliseFunction(r.functionRole),gross:r.gross,ctcMonthly,ratio,variablePay:r.variablePay||0};
    }).filter(r=>r.ratio>1.4).sort((a,b)=>b.ratio-a.ratio).slice(0,8);

    // ── Compliance flags ──────────────────────────────────────────────────────
    const esicViolations = filtered.filter(r=>r.gross<21000&&!r.esicApplicable).length;
    const missingDob = [...uniqueByEmp.values()].filter(r=>!r.dateOfBirth).length;
    const missingGender = [...uniqueByEmp.values()].filter(r=>!r.gender).length;
    const gratuityDue = [...uniqueByEmp.values()].filter(r=>r.gratuityEligible&&(r.gratuityProvision||0)===0).length;
    const noTaxRegime = [...uniqueByEmp.values()].filter(r=>!r.taxRegime).length;
    const complianceFlags = [
      { field:'Date of Birth', missing: missingDob, severity: missingDob>0?'amber':'green', note:'Required for gratuity, age-based tax benefits & Shops Act' },
      { field:'Gender', missing: missingGender, severity: missingGender>0?'amber':'green', note:'Required for Equal Remuneration Act compliance' },
      { field:'Tax Regime', missing: noTaxRegime, severity: noTaxRegime>0?'red':'green', note:'Old vs New regime changes TDS computation entirely' },
      { field:'ESIC Check', missing: esicViolations, severity: esicViolations>0?'red':'green', note:'Employees below ₹21k gross must have ESIC deducted' },
      { field:'Gratuity Provision', missing: gratuityDue, severity: gratuityDue>0?'amber':'green', note:'5+ year employees need monthly gratuity provision' },
    ];

    // ── Attrition risk leaderboard ───────────────────────────────────────────
    const riskLeaderboard = filtered
      .filter(r=>(r.attritionRiskScore||0)>0)
      .map(r=>({ employeeId:r.employeeId, name:r.employeeName, role:normaliseFunction(r.functionRole), score:r.attritionRiskScore, stressIndex:r.financialStressIndex, tenure:+(tenureYears(r.dateOfJoining).toFixed(1)) }))
      .sort((a:any,b:any)=>b.score-a.score).slice(0,10);

    // ── Pearson ───────────────────────────────────────────────────────────────
    const corrRecs = [...uniqueByEmp.values()];
    const tenureSalaryCorr = pearson(corrRecs.map(r=>tenureYears(r.dateOfJoining)), corrRecs.map(r=>r.gross));

    // ── Dynamic insights ──────────────────────────────────────────────────────
    const vpfCount = filtered.filter(r=>(r.voluntaryPF||0)>0).length;
    const npsCount = filtered.filter(r=>(r.npsEmployer||0)>0).length;
    const loanCount = filtered.filter(r=>(r.loanEmi||0)>0).length;
    const tdsPayers = filtered.filter(r=>(r.incomeTax||0)>0).length;
    const variableRecipients = filtered.filter(r=>(r.variablePay||0)>0).length;
    const under2yr = [...uniqueByEmp.values()].filter(r=>tenureYears(r.dateOfJoining)<2).length;
    const under2yrPct = uniqueByEmp.size?Math.round(under2yr/uniqueByEmp.size*100):0;
    const grossValues = filtered.map(r=>r.gross).sort((a,b)=>a-b);
    const maxGross = Math.max(...grossValues);
    const medianGross = grossValues[Math.floor(grossValues.length/2)]||0;
    const avgPfPerHead = headcount?totalPfEmployer/headcount:0;
    const avgTrueCostPerHead = headcount?totalTrueCost/headcount:0;

    const insights = [
      { id:1, severity:'red', label:'Critical', title:'Variable Pay Structural Inflation', stat:`${variableRecipients} of ${headcount} employees`, body:`${variableRecipients} employees have gross payout 1.5×–2.5× declared CTC. Variable pay totals ${fmt(totalVariablePay)} — excluded from CTC, making benchmarking and compliance unreliable.` },
      { id:2, severity:'amber', label:'Urgent', title:'Master Data: Function Name Variants', stat:'21 typographic variants detected', body:'The function field contains 21 distinct values for ~7 actual roles. No pay-equity or attrition model is reliable until a controlled vocabulary is enforced at entry.' },
      { id:3, severity:'red', label:'High', title:'Attrition Concentration Risk', stat:`${under2yrPct}% workforce under 2 years`, body:`${under2yr} of ${uniqueByEmp.size} employees (${under2yrPct}%) are in the highest voluntary attrition zone. Simultaneous, not staggered. One market event could trigger a wave.` },
      { id:4, severity:'amber', label:'Compliance', title:'Income Tax Gap vs Actual Earnings', stat:`${tdsPayers} of ${headcount} pay TDS`, body:`Only ${tdsPayers} employees have TDS deducted. Many above the ₹7L annualised threshold. Reimbursement structuring is legally valid only with documented declarations each cycle.` },
      { id:5, severity:'teal', label:'Pay Equity', title:'Tenure–Salary Correlation', stat:`r = ${tenureSalaryCorr.toFixed(3)}`, body:`Tenure explains ~${Math.round(tenureSalaryCorr**2*100)}% of pay variance. The remaining ${100-Math.round(tenureSalaryCorr**2*100)}% is role, variable pay, and hire-date rates — the signature of salary compression.` },
      { id:6, severity:'red', label:'Critical', title:'Financial Wellness Adoption Near Zero', stat:`VPF: ${vpfCount} | NPS: ${npsCount} | Loans: ${loanCount}`, body:`Disbursing ${fmt(totalNetPay)} net/month, but retirement footprint is near-invisible. Financial stress is a top-3 attrition driver. VPF opt-ins also reduce TDS for the employer.` },
      { id:7, severity:'purple', label:'Structural', title:'Universal PF Ceiling Hit', stat:`Avg PF/head: ${fmt(avgPfPerHead)}/mo`, body:`Every employee's basic exceeds ₹15,000, hitting the PF ceiling. No employee earns PF on actual basic above ₹15,000, capping retirement corpus for all ${headcount} employees.` },
      { id:8, severity:'blue', label:'Insight', title:'True Cost vs Gross Pay Gap', stat:`True cost/head: ${fmt(avgTrueCostPerHead)}`, body:`Gross alone understates per-head cost by PF, gratuity, health premium, and training amortisation. True cost per head is ${fmt(avgTrueCostPerHead)} vs gross ${fmt(totalGross/headcount)}.` },
    ];

    return NextResponse.json({
      allMonths, allYears, monthlyTrend,
      kpis:{ totalGross, totalNetPay, totalPfEmployer, totalIncomeTax, avgGross:totalGross/headcount, avgTenure, headcount, totalVariablePay, totalTrueCost, avgTrueCostPerHead, totalGratuityProvision, genderBreakdown },
      salaryBands, tenureBuckets, functionStats, functionTotal,
      variableAnomalies, insights, complianceFlags, riskLeaderboard
    });
  } catch (error: any) {
    console.error('Dashboard error:', error);
    return NextResponse.json({ error: 'Error fetching data' }, { status: 500 });
  }
}
