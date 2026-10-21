-- RenameIndex
ALTER INDEX "dispensary_weekly_activity_dispensaryId_discordUserId_periodSta" RENAME TO "dispensary_weekly_activity_dispensaryId_discordUserId_perio_key";

-- RenameIndex
ALTER INDEX "Order_dispensaryId_createdAt_idx" RENAME TO "order_dispensaryId_createdAt_idx";

-- RenameIndex
ALTER INDEX "order_mail_template_assignment_dispensaryId_orderType_orderStat" RENAME TO "order_mail_template_assignment_dispensaryId_orderType_order_key";
