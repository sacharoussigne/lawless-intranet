-- Interface theme chosen by the user (src/lib/themes).
ALTER TABLE "user_ui_preferences" ADD COLUMN "theme" TEXT NOT NULL DEFAULT 'apothecary';
