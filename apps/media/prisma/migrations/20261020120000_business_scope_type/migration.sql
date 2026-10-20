-- The business app (dispensaries, general stores…) now scopes its data with
-- scopeType 'business' instead of 'dispensary' (docs/MULTI-BUSINESS.md, phase 6).
-- Shelter rows ('shelter') are not touched; scopeId (the business id) is unchanged.
-- Stored S3 keys keep their 'dispensary/<id>/' prefix: files stay readable, purgeScope
-- also clears the legacy prefix.

UPDATE "media_folder" SET "scopeType" = 'business' WHERE "scopeType" = 'dispensary';
UPDATE "media_file" SET "scopeType" = 'business' WHERE "scopeType" = 'dispensary';
UPDATE "media_link" SET "scopeType" = 'business' WHERE "scopeType" = 'dispensary';
