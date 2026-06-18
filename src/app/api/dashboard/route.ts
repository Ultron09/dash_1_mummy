import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
  try {
    const allRecords = await prisma.payrollRecord.findMany({
      orderBy: {
        payrollMonth: 'asc'
      }
    });

    // Process data for charts
    const monthlyDataMap = new Map();
    const departmentCostMap = new Map();
    const functionStatsMap = new Map();

    allRecords.forEach((record: any) => {
      // Monthly trend
      if (!monthlyDataMap.has(record.monthIdentifier)) {
        monthlyDataMap.set(record.monthIdentifier, {
          month: record.monthIdentifier,
          totalGross: 0,
          totalNet: 0,
          totalDeductions: 0,
          headcount: 0
        });
      }
      const monthData = monthlyDataMap.get(record.monthIdentifier);
      monthData.totalGross += record.gross;
      monthData.totalNet += record.netPay;
      monthData.totalDeductions += record.totalDeductions;
      monthData.headcount += 1;

      // Department cost
      if (!departmentCostMap.has(record.department)) {
        departmentCostMap.set(record.department, 0);
      }
      departmentCostMap.set(record.department, departmentCostMap.get(record.department) + record.gross);

      // Function stats
      // Standardize function name for grouping (case insensitive)
      const funcName = record.functionRole?.trim() || 'Unknown';
      const funcKey = funcName.toLowerCase();
      
      if (!functionStatsMap.has(funcKey)) {
        functionStatsMap.set(funcKey, {
          name: funcName,
          count: 0,
          totalNet: 0
        });
      }
      const funcStat = functionStatsMap.get(funcKey);
      funcStat.count += 1;
      funcStat.totalNet += record.netPay;
    });

    const monthlyTrend = Array.from(monthlyDataMap.values());
    const departmentCosts = Array.from(departmentCostMap.entries()).map(([department, cost]) => ({
      name: department || 'Unknown',
      value: cost
    })).sort((a, b) => b.value - a.value);
    
    // Sort function stats and calculate total
    const functionStats = Array.from(functionStatsMap.values()).sort((a, b) => b.totalNet - a.totalNet);
    const functionTotal = functionStats.reduce((acc, curr) => ({
      count: acc.count + curr.count,
      totalNet: acc.totalNet + curr.totalNet
    }), { count: 0, totalNet: 0 });

    // Get KPIs
    const latestMonth = monthlyTrend.length > 0 ? monthlyTrend[monthlyTrend.length - 1] : null;
    const previousMonth = monthlyTrend.length > 1 ? monthlyTrend[monthlyTrend.length - 2] : null;

    return NextResponse.json({
      monthlyTrend,
      departmentCosts,
      functionStats,
      functionTotal,
      latestKPIs: latestMonth ? {
        totalGross: latestMonth.totalGross,
        totalNet: latestMonth.totalNet,
        headcount: latestMonth.headcount,
        totalDeductions: latestMonth.totalDeductions,
        grossChange: previousMonth ? ((latestMonth.totalGross - previousMonth.totalGross) / previousMonth.totalGross) * 100 : 0,
        netChange: previousMonth ? ((latestMonth.totalNet - previousMonth.totalNet) / previousMonth.totalNet) * 100 : 0,
        headcountChange: previousMonth ? latestMonth.headcount - previousMonth.headcount : 0
      } : null,
      rawRecords: allRecords
    });
  } catch (error: any) {
    console.error("Dashboard data error:", error);
    return NextResponse.json({ error: 'Error fetching dashboard data' }, { status: 500 });
  }
}
