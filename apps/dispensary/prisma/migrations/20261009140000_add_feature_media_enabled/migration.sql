-- Media library module toggle (per dispensary).
ALTER TABLE "app_settings" ADD COLUMN "featureMediaEnabled" BOOLEAN NOT NULL DEFAULT true;
