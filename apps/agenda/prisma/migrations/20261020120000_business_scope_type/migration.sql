-- The business app (dispensaries, general stores…) now scopes its data with
-- scopeType 'business' instead of 'dispensary' (docs/MULTI-BUSINESS.md, phase 6).
-- Shelter rows ('shelter') are not touched; scopeId (the business id) is unchanged.

UPDATE "agenda" SET "scopeType" = 'business' WHERE "scopeType" = 'dispensary';
