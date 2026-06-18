import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { employeeId, employeeName, functionRole, department, payrollMonth, netPay, gross } = body;

    if (!employeeId || !payrollMonth) {
      return NextResponse.json({ error: 'Employee ID and Payroll Month are required' }, { status: 400 });
    }

    const recordData = {
      employeeName: employeeName || '',
      functionRole: functionRole || '',
      dateOfJoining: '',
      department: department || '',
      payrollType: 'Regular',
      actualPayableDays: 30,
      workingDays: 30,
      lossOfPayDays: 0,
      daysPayable: 30,
      remunerationAmount: '',
      basic: 0,
      hra: 0,
      travelReimbursement: 0,
      specialAllowance: 0,
      gross: parseFloat(gross) || 0,
      pfEmployer: 0,
      pfEmployee: 0,
      professionalTax: 0,
      totalDeductions: 0,
      netPay: parseFloat(netPay) || 0,
      monthIdentifier: payrollMonth,
    };

    const newRecord = await prisma.payrollRecord.upsert({
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

    return NextResponse.json({ message: 'Record manually updated', record: newRecord });
  } catch (error: any) {
    console.error("Manual update error:", error);
    return NextResponse.json({ error: error.message || 'Error updating record' }, { status: 500 });
  }
}
