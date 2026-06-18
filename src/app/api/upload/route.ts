import { NextResponse } from 'next/server';
import * as xlsx from 'xlsx';
import prisma from '@/lib/prisma';

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
    
    // Parse to JSON. Using defval: null to get null instead of undefined for empty cells.
    const rawData = xlsx.utils.sheet_to_json<any>(worksheet, { defval: null });

    let count = 0;

    for (const row of rawData) {
      // Extract data from the row
      const employeeId = row['Employee Number']?.toString();
      const payrollMonth = row['Payroll Month']?.toString();
      
      if (!employeeId || !payrollMonth) continue;

      // Clean comma-separated numbers and parse to float
      const parseFloatClean = (val: any) => {
        if (typeof val === 'number') return val;
        if (!val) return 0;
        return parseFloat(val.toString().replace(/,/g, '')) || 0;
      };

      const recordData = {
        employeeName: row['Employee Name']?.toString() || '',
        functionRole: row['function ']?.toString() || '',
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
        professionalTax: parseFloatClean(row['Professional Tax']),
        totalDeductions: parseFloatClean(row['Total Deductions(C)']),
        netPay: parseFloatClean(row['Net Pay(A-B-C)']),
        monthIdentifier: row['Month']?.toString() || payrollMonth,
      };

      await prisma.payrollRecord.upsert({
        where: {
          employeeId_payrollMonth: {
            employeeId,
            payrollMonth
          }
        },
        update: recordData,
        create: {
          employeeId,
          payrollMonth,
          ...recordData
        }
      });
      
      count++;
    }

    return NextResponse.json({ 
      message: count > 0 
        ? `Successfully processed ${count} records.`
        : `0 records processed. Check that your file has the required columns: "Employee Number", "Payroll Month", "Gross(A)", "Net Pay(A-B-C)", etc.`
    });
  } catch (error: any) {
    console.error("Upload error:", error);
    const message = error?.message || error?.toString() || 'Error processing file';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
