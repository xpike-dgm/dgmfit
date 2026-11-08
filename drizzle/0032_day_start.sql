-- Y1: kişisel gün döngüsü — günün bittiği saat (gece yarısından sonraki dakika). Varsayılan 04.00: 01.30'da yenen dünün kaydı.
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "day_start_min" smallint NOT NULL DEFAULT 240;
