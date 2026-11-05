ALTER TABLE "water_settings" ALTER COLUMN "progress_style" SET DEFAULT 'ring';--> statement-breakpoint
-- 5c tasarımı: su ilerlemesi bandın halkasıyla gösterilir; varsayılan "şişe"de kalan ayarlar halkaya geçer (şişe/dalga ayarlardan yine seçilebilir).
UPDATE "water_settings" SET "progress_style" = 'ring' WHERE "progress_style" = 'bottle';
