import { NextResponse } from 'next/server';
import * as xlsx from 'xlsx';
import prisma from '@/lib/prisma';

// Convert Excel serial date to "MMM YYYY" string
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

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = xlsx.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const rawData = xlsx.utils.sheet_to_json<any>(worksheet, { defval: null });

    let count = 0;

    for (const row of rawData) {
      const employeeId = row['Employee Number']?.toString();
      const payrollMonth = row['Payroll Month']?.toString();
      if (!employeeId || !payrollMonth) continue;

      const parseFloatClean = (val: any): number => {
        if (typeof val === 'number') return val;
        if (!val) return 0;
        return parseFloat(val.toString().replace(/,/g, '')) || 0;
      };

      const variablePay =
        parseFloatClean(row['Variable Bonus']) +
        parseFloatClean(row['Variable Pay (Performance/Incentive)']) +
        parseFloatClean(row['Variable Pay (Performances/Incentives)']) +
        parseFloatClean(row['Leave Encashment']);

      const recordData = {
        employeeName: row['Employee Name']?.toString() || '',
        functionRole: row['function ']?.toString()?.trim() || row['Function']?.toString()?.trim() || '',
        dateOfJoining: row['Date Of Joining']?.toString() || '',
        department: row['Department']?.toString() || '',
        payrollType: row['Payroll Type']?.toString() || '',
        actualPayableDays: parseFloatClean(row['Actual Payable days']),
        workingDays: parseFloatClean(row['Working days']),
        lossOfPayDays: parseFloatClean(row['Loss of Pay Days']),
        daysPayable: parseFloatClean(row['Days Payable']),
        remunerationAmount: row['Remuneration Amount']?.toString() || '',
        basic: parseFloatClean(row['Basic']),
        hra: parseFloatClean(row['HRA']),
        travelReimbursement: parseFloatClean(row['Travel Reimbursement (LTA)']),
        specialAllowance: parseFloatClean(row['Special Allowance']),
        gross: parseFloatClean(row['Gross(A)']),
        pfEmployer: parseFloatClean(row['PF - Employer']),
        pfEmployee: parseFloatClean(row['PF Employee']),
        voluntaryPF: parseFloatClean(row['Voluntary Provident Fund']),
        npsEmployer: parseFloatClean(row['NPS Employer']),
        totalContributions: parseFloatClean(row['Total Contributions(B)']),
        professionalTax: parseFloatClean(row['Professional Tax']),
        incomeTax: parseFloatClean(row['Total Income Tax']),
        loanEmi: parseFloatClean(row['General Loan EMI']),
        totalDeductions: parseFloatClean(row['Total Deductions(C)']),
        netPay: parseFloatClean(row['Net Pay(A-B-C)']),
        cashAdvance: parseFloatClean(row['Cash Advance(D)']),
        settlementAdvance: parseFloatClean(row['Settlement Aganist Advance(E)']),
        totalReimbursements: parseFloatClean(row['Total Reimbursements(F)']),
        totalNetPay: parseFloatClean(row['Total Net Pay(A-B-C+D+E+F)']),
        variablePay,
        monthIdentifier: excelSerialToMonthLabel(row['Month'], payrollMonth),
      };

      await prisma.payrollRecord.upsert({
        where: { employeeId_payrollMonth: { employeeId, payrollMonth } },
        update: recordData,
        create: { employeeId, payrollMonth, ...recordData }
      });
      count++;
    }

    return NextResponse.json({
      message: count > 0
        ? `Successfully processed ${count} records.`
        : `0 records processed. Check column headers match the expected format.`
    });
  } catch (error: any) {
    console.error('Upload error:', error);
    return NextResponse.json({ error: error?.message || 'Error processing file' }, { status: 500 });
  }
}
