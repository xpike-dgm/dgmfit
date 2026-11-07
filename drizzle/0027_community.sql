-- Özelleştirme Ö3c: tasarım yarışmaları, grup teması, duyuru kartı, yönetimden varsayılan düzen.
CREATE TABLE IF NOT EXISTS "design_contests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"week" date NOT NULL UNIQUE,
	"theme" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"created_by" uuid REFERENCES "users"("id") ON DELETE set null,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "contest_entries" (
	"contest_id" uuid NOT NULL REFERENCES "design_contests"("id") ON DELETE cascade,
	"user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
	"template_id" uuid NOT NULL REFERENCES "design_templates"("id") ON DELETE cascade,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	PRIMARY KEY ("contest_id","user_id")
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "contest_votes" (
	"contest_id" uuid NOT NULL REFERENCES "design_contests"("id") ON DELETE cascade,
	"voter_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
	"template_id" uuid NOT NULL REFERENCES "design_templates"("id") ON DELETE cascade,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	PRIMARY KEY ("contest_id","voter_id")
);--> statement-breakpoint
ALTER TABLE "groups" ADD COLUMN IF NOT EXISTS "theme_template_id" uuid REFERENCES "design_templates"("id") ON DELETE set null;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "announcements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"url" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_by" uuid REFERENCES "users"("id") ON DELETE set null,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ends_at" timestamp with time zone
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "announcement_dismissals" (
	"user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
	"announcement_id" uuid NOT NULL REFERENCES "announcements"("id") ON DELETE cascade,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	PRIMARY KEY ("user_id","announcement_id")
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "app_defaults" (
	"key" text PRIMARY KEY NOT NULL,
	"data" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
