-- The business app (dispensaries, general stores…) now scopes its data with
-- scopeType 'business' instead of 'dispensary' (docs/MULTI-BUSINESS.md, phase 6).
-- Shelter rows ('shelter') are not touched; scopeId (the business id) is unchanged.

UPDATE "category_item" SET "scopeType" = 'business' WHERE "scopeType" = 'dispensary';
UPDATE "item" SET "scopeType" = 'business' WHERE "scopeType" = 'dispensary';
UPDATE "chest" SET "scopeType" = 'business' WHERE "scopeType" = 'dispensary';
UPDATE "role_chest_access" SET "scopeType" = 'business' WHERE "scopeType" = 'dispensary';
UPDATE "sale" SET "scopeType" = 'business' WHERE "scopeType" = 'dispensary';
UPDATE "company" SET "scopeType" = 'business' WHERE "scopeType" = 'dispensary';
UPDATE "craft_recipe" SET "scopeType" = 'business' WHERE "scopeType" = 'dispensary';
UPDATE "individual_customer" SET "scopeType" = 'business' WHERE "scopeType" = 'dispensary';
UPDATE "company_group" SET "scopeType" = 'business' WHERE "scopeType" = 'dispensary';
UPDATE "order" SET "scopeType" = 'business' WHERE "scopeType" = 'dispensary';
UPDATE "order_mail_template_assignment" SET "scopeType" = 'business' WHERE "scopeType" = 'dispensary';
