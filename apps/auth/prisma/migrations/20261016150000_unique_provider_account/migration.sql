-- CreateIndex: a provider identity (e.g. a Discord id) belongs to a single account.
CREATE UNIQUE INDEX "account_providerId_accountId_key" ON "account"("providerId", "accountId");
