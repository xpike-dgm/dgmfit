-- Özelleştirme Ö5a: kendi takip alanlarım (kafein, uyku, ruh hali…) ve kayıtları. Kişisel veridir; şablonla paylaşılmaz.
CREATE TABLE IF NOT EXISTS "trackers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
	"name" text NOT NULL,
	"unit" text DEFAULT '' NOT NULL,
	"kind" text DEFAULT 'count' NOT NULL,
	"goal" real,
	"goal_dir" text DEFAULT 'min' NOT NULL,
	"step" real DEFAULT 1 NOT NULL,
	"emoji" text DEFAULT '' NOT NULL,
	"archived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "trackers_user_idx" ON "trackers" ("user_id");--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tracker_logs" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"tracker_id" uuid NOT NULL REFERENCES "trackers"("id") ON DELETE cascade,
	"user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
	"day" date NOT NULL,
	"value" real NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tracker_logs_idx" ON "tracker_logs" ("tracker_id","day");
