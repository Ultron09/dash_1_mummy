import { NextResponse } from 'next/server';
import * as xlsx from 'xlsx';
import prisma from '@/lib/prisma';

function excelSerialToMonthLabel(serial: any, fallback: string): string {
  if (typeof serial === 'string' && serial.trim()) return serial.trim();
  if (typeof serial === 'number') {
    const date = xlsx.SSF.parse_date_code(serial);
    if (date) {
      const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      return `${months[date.m - 1]} ${date.y}`;
    }
  }
  return fallback;
}

function excelSerialToDateStr(val: any): string {
  if (!val) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'number') {
    const d = xlsx.SSF.parse_date_code(val);
    if (d) return `${d.y}-${String(d.m).padStart(2,'0')}-${String(d.d).padStart(2,'0')}`;
  }
  return String(val);
}

function pf(n: number): number { return parseFloat(n.toFixed(2)); }

function computeTier3(rec: any): { attritionRiskScore: number; financialStressIndex: number; projectedAnnualTax: number } {
  // Attrition risk: tenure (yrs), salary compression, VPF/NPS adoption, leave balance
  const doj = rec.dateOfJoining ? new Date(rec.dateOfJoining) : null;
  const tenureYrs = doj ? (new Date(2026,4,1).getTime() - doj.getTime()) / (365.25*24*3600*1000) : 0;
  let risk = 0;
  if (tenureYrs < 1) risk += 30;
  else if (tenureYrs < 2) risk += 25;
  else if (tenureYrs < 3) risk += 15;
  if ((rec.salaryCompressionRatio || 1) < 0.9) risk += 20;
  if (!rec.voluntaryPF && !rec.npsEmployer) risk += 10;
  if (!rec.lastIncrementDate) risk += 10;
  if ((rec.earnedLeaveBalance || 0) > 20) risk += 5;
  const attritionRiskScore = Math.min(100, risk);

  // Financial stress: loan EMI, zero savings, high variable dependency
  let stress = 0;
  if ((rec.loanEmi || 0) > 0) stress += 25;
  if (!rec.voluntaryPF && !rec.npsEmployer) stress += 20;
  const varDep = rec.gross > 0 ? (rec.variablePay || 0) / rec.gross : 0;
  if (varDep > 0.4) stress += 20;
  else if (varDep > 0.25) stress += 10;
  if ((rec.totalNetPay || rec.netPay || 0) < 30000) stress += 20;
  const financialStressIndex = Math.min(100, stress);

  // Projected annual tax: rough annualised gross × 30% marginal for high earners
  const annualGross = (rec.gross || 0) * 12;
  let projectedAnnualTax = 0;
  if (annualGross > 1500000) projectedAnnualTax = (annualGross - 1500000) * 0.3 + 150000;
  else if (annualGross > 1000000) projectedAnnualTax = (annualGross - 1000000) * 0.2 + 50000;
  else if (annualGross > 700000) projectedAnnualTax = (annualGross - 700000) * 0.1;

  return { attritionRiskScore, financialStressIndex, projectedAnnualTax };
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    if (!file) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = xlsx.read(buffer, { type: 'buffer' });
    const ws = workbook.Sheets[workbook.SheetNames[0]];
    const rawData = xlsx.utils.sheet_to_json<any>(ws, { defval: null });

    let count = 0;
    for (const row of rawData) {
      const employeeId = row['Employee Number']?.toString();
      const payrollMonth = row['Payroll Month']?.toString();
      if (!employeeId || !payrollMonth) continue;

      const f = (val: any): number => {
        if (typeof val === 'number') return val;
        if (!val) return 0;
        return parseFloat(val.toString().replace(/,/g, '')) || 0;
      };

      const variablePay = f(row['Variable Bonus']) + f(row['Variable Pay (Performance/Incentive)'])
        + f(row['Variable Pay (Performances/Incentives)']) + f(row['Leave Encashment']);

      const gross = f(row['Gross(A)']);
      const esicApplicable = gross > 0 && gross < 21000;
      const dojStr = excelSerialToDateStr(row['Date Of Joining']);
      const tenureYrs = dojStr ? (new Date(2026,4,1).getTime() - new Date(dojStr).getTime()) / (365.25*24*3600*1000) : 0;
      const gratuityEligible = tenureYrs >= 5;

      const rec: any = {
        employeeName: row['Employee Name']?.toString() || '',
        dateOfBirth: row['Date of Birth'] ? excelSerialToDateStr(row['Date of Birth']) : null,
        gender: row['Gender']?.toString() || null,
        workLocation: row['Work Location']?.toString() || row['City']?.toString() || null,
        reportingManagerId: row['Reporting Manager ID']?.toString() || row['Manager ID']?.toString() || null,
        functionRole: (row['function '] || row['Function'])?.toString()?.trim() || '',
        department: row['Department']?.toString() || '',
        employmentType: row['Employment Type']?.toString() || null,
        probationEndDate: row['Probation End Date'] ? excelSerialToDateStr(row['Probation End Date']) : null,
        dateOfJoining: dojStr,
        payrollType: row['Payroll Type']?.toString() || '',
        monthIdentifier: excelSerialToMonthLabel(row['Month'], payrollMonth),
        actualPayableDays: f(row['Actual Payable days']),
        workingDays: f(row['Working days']),
        lossOfPayDays: f(row['Loss of Pay Days']),
        daysPayable: f(row['Days Payable']),
        leavesThisMonth: f(row['Leaves Taken'] || row['Leaves This Month']),
        lateOrEarlyCount: Math.round(f(row['Late/Early Count'] || 0)),
        wfhDays: Math.round(f(row['WFH Days'] || 0)),
        remunerationAmount: row['Remuneration Amount']?.toString() || '',
        offerCtc: f(row['Offer CTC'] || row['CTC at Hire']),
        lastIncrementDate: row['Last Increment Date'] ? excelSerialToDateStr(row['Last Increment Date']) : null,
        lastIncrementPct: row['Last Increment %'] != null ? f(row['Last Increment %']) : null,
        basic: f(row['Basic']),
        hra: f(row['HRA']),
        travelReimbursement: f(row['Travel Reimbursement (LTA)']),
        specialAllowance: f(row['Special Allowance']),
        gross,
        variablePay,
        variableTargetPct: row['Variable Target %'] != null ? f(row['Variable Target %']) : null,
        variablePayoutPct: row['Variable Payout %'] != null ? f(row['Variable Payout %']) : null,
        pfEmployer: f(row['PF - Employer']),
        npsEmployer: f(row['NPS Employer']),
        gratuityProvision: f(row['Gratuity Provision'] || 0),
        groupHealthPremium: f(row['Group Health Premium'] || 0),
        trainingCostAmort: f(row['Training Cost Amortisation'] || 0),
        pfEmployee: f(row['PF Employee']),
        voluntaryPF: f(row['Voluntary Provident Fund']),
        professionalTax: f(row['Professional Tax']),
        incomeTax: f(row['Total Income Tax']),
        loanEmi: f(row['General Loan EMI']),
        totalContributions: f(row['Total Contributions(B)']),
        totalDeductions: f(row['Total Deductions(C)']),
        netPay: f(row['Net Pay(A-B-C)']),
        cashAdvance: f(row['Cash Advance(D)']),
        settlementAdvance: f(row['Settlement Aganist Advance(E)']),
        totalReimbursements: f(row['Total Reimbursements(F)']),
        totalNetPay: f(row['Total Net Pay(A-B-C+D+E+F)']),
        taxRegime: row['Tax Regime']?.toString() || null,
        investmentDecl: f(row['Investment Declaration'] || 0),
        esicApplicable,
        gratuityEligible,
        payslipDelivered: false,
        earnedLeaveBalance: f(row['Earned Leave Balance'] || 0),
        perfRatingCurrent: row['Performance Rating']?.toString() || null,
        perfRatingPrevious: row['Previous Performance Rating']?.toString() || null,
        promotionCount: Math.round(f(row['Promotion Count'] || 0)),
        hiringSource: row['Hiring Source']?.toString() || null,
      };

      const tier3 = computeTier3(rec);
      const ctcRaw = parseFloat((rec.remunerationAmount || '0').replace(/[^0-9.]/g, '')) || 0;
      const ctcMonthly = ctcRaw > 5000 ? ctcRaw / 12 : ctcRaw;
      rec.salaryCompressionRatio = ctcMonthly > 0 ? pf(gross / ctcMonthly) : null;
      rec.attritionRiskScore = tier3.attritionRiskScore;
      rec.financialStressIndex = tier3.financialStressIndex;
      rec.projectedAnnualTax = tier3.projectedAnnualTax;

      await prisma.payrollRecord.upsert({
        where: { employeeId_payrollMonth: { employeeId, payrollMonth } },
        update: rec,
        create: { employeeId, payrollMonth, ...rec }
      });
      count++;
    }

    return NextResponse.json({
      message: count > 0 ? `Successfully processed ${count} records.` : '0 records processed. Check column headers.'
    });
  } catch (error: any) {
    console.error('Upload error:', error);
    return NextResponse.json({ error: error?.message || 'Error processing file' }, { status: 500 });
  }
}
