-- Default salary type of the « Préparateurs de caisse » report (none: the business default).
ALTER TABLE "payroll_salary_type" ADD COLUMN     "isCashPreparerDefault" BOOLEAN NOT NULL DEFAULT false;
