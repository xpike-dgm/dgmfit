-- Özelleştirme Ö4: kart kullanımı (günlük görülme + dokunma; yalnız kullanıcının kendi kullanım haritası ve koç önerisi için).
CREATE TABLE IF NOT EXISTS "card_usage" (
	"user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
	"day" date NOT NULL,
	"card" text NOT NULL,
	"views" integer DEFAULT 0 NOT NULL,
	"taps" integer DEFAULT 0 NOT NULL,
	PRIMARY KEY ("user_id","day","card")
);
