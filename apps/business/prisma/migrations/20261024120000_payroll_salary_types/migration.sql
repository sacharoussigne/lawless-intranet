-- Salary types per business (payroll): what a person is paid per caisse, the
-- business default, the salary type of each person and the patient rate.

-- AlterTable
ALTER TABLE "app_settings" ADD COLUMN     "payrollPatientCareUsd" DECIMAL(10,2) NOT NULL DEFAULT 0.3;

-- AlterTable
ALTER TABLE "business_person" ADD COLUMN     "salaryTypeId" TEXT;

-- CreateTable
CREATE TABLE "payroll_salary_type" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "caisseUnitUsd" DECIMAL(10,2) NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payroll_salary_type_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "payroll_salary_type_businessId_idx" ON "payroll_salary_type"("businessId");

-- CreateIndex
CREATE UNIQUE INDEX "payroll_salary_type_businessId_label_key" ON "payroll_salary_type"("businessId", "label");

-- CreateIndex
CREATE INDEX "business_person_salaryTypeId_idx" ON "business_person"("salaryTypeId");

-- AddForeignKey
ALTER TABLE "business_person" ADD CONSTRAINT "business_person_salaryTypeId_fkey" FOREIGN KEY ("salaryTypeId") REFERENCES "payroll_salary_type"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_salary_type" ADD CONSTRAINT "payroll_salary_type_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "dispensary"("id") ON DELETE CASCADE ON UPDATE CASCADE;

