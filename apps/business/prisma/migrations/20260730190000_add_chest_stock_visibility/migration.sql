-- Per-chest hidden categories/items for stock page display
CREATE TABLE "chest_hidden_category" (
  "id" TEXT NOT NULL,
  "chestId" TEXT NOT NULL,
  "categoryId" TEXT NOT NULL,
  CONSTRAINT "chest_hidden_category_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "chest_hidden_category_chestId_categoryId_key" ON "chest_hidden_category"("chestId", "categoryId");
CREATE INDEX "chest_hidden_category_chestId_idx" ON "chest_hidden_category"("chestId");
CREATE INDEX "chest_hidden_category_categoryId_idx" ON "chest_hidden_category"("categoryId");

ALTER TABLE "chest_hidden_category"
  ADD CONSTRAINT "chest_hidden_category_chestId_fkey"
  FOREIGN KEY ("chestId") REFERENCES "chest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "chest_hidden_category"
  ADD CONSTRAINT "chest_hidden_category_categoryId_fkey"
  FOREIGN KEY ("categoryId") REFERENCES "category_item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "chest_hidden_item" (
  "id" TEXT NOT NULL,
  "chestId" TEXT NOT NULL,
  "itemId" TEXT NOT NULL,
  CONSTRAINT "chest_hidden_item_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "chest_hidden_item_chestId_itemId_key" ON "chest_hidden_item"("chestId", "itemId");
CREATE INDEX "chest_hidden_item_chestId_idx" ON "chest_hidden_item"("chestId");
CREATE INDEX "chest_hidden_item_itemId_idx" ON "chest_hidden_item"("itemId");

ALTER TABLE "chest_hidden_item"
  ADD CONSTRAINT "chest_hidden_item_chestId_fkey"
  FOREIGN KEY ("chestId") REFERENCES "chest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "chest_hidden_item"
  ADD CONSTRAINT "chest_hidden_item_itemId_fkey"
  FOREIGN KEY ("itemId") REFERENCES "item"("id") ON DELETE CASCADE ON UPDATE CASCADE;
