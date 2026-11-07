-- Özelleştirme Ö3c: tasarımcı takibi (sosyal takipten ayrı).
CREATE TABLE IF NOT EXISTS "designer_follows" (
	"follower_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
	"designer_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	PRIMARY KEY ("follower_id","designer_id")
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "designer_follows_designer_idx" ON "designer_follows" ("designer_id");
