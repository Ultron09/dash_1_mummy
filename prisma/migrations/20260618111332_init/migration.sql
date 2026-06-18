-- CreateTable
CREATE TABLE "PayrollRecord" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "employeeName" TEXT NOT NULL,
    "functionRole" TEXT NOT NULL,
    "dateOfJoining" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "payrollMonth" TEXT NOT NULL,
    "payrollType" TEXT NOT NULL,
    "actualPayableDays" DOUBLE PRECISION NOT NULL,
    "workingDays" DOUBLE PRECISION NOT NULL,
    "lossOfPayDays" DOUBLE PRECISION NOT NULL,
    "daysPayable" DOUBLE PRECISION NOT NULL,
    "remunerationAmount" TEXT NOT NULL,
    "basic" DOUBLE PRECISION NOT NULL,
    "hra" DOUBLE PRECISION NOT NULL,
    "travelReimbursement" DOUBLE PRECISION NOT NULL,
    "specialAllowance" DOUBLE PRECISION NOT NULL,
    "gross" DOUBLE PRECISION NOT NULL,
    "pfEmployer" DOUBLE PRECISION NOT NULL,
    "pfEmployee" DOUBLE PRECISION NOT NULL,
    "professionalTax" DOUBLE PRECISION NOT NULL,
    "totalDeductions" DOUBLE PRECISION NOT NULL,
    "netPay" DOUBLE PRECISION NOT NULL,
    "monthIdentifier" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayrollRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PayrollRecord_employeeId_payrollMonth_key" ON "PayrollRecord"("employeeId", "payrollMonth");
