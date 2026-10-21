-- DropForeignKey
ALTER TABLE "order_mail_template_assignment" DROP CONSTRAINT IF EXISTS "order_mail_template_assignment_mailTemplateId_fkey";

-- DropTable
DROP TABLE IF EXISTS "mail";

-- DropTable
DROP TABLE IF EXISTS "mail_template";

-- Rename column mailTemplateId -> templateId
ALTER TABLE "order_mail_template_assignment" RENAME COLUMN "mailTemplateId" TO "templateId";

-- DropIndex (old name)
DROP INDEX IF EXISTS "order_mail_template_assignment_mailTemplateId_idx";

-- CreateIndex
CREATE INDEX IF NOT EXISTS "order_mail_template_assignment_templateId_idx" ON "order_mail_template_assignment"("templateId");
