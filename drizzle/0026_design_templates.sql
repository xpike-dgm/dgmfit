-- Özelleştirme Ö3b: şablon kütüphanesi. Şablon verisi paylaşılabilir tasarımdır (kişisel kısım ve bant fotoğrafı çıkarılmış).
CREATE TABLE IF NOT EXISTS "design_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"category" text DEFAULT 'diger' NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"data" jsonb NOT NULL,
	"remix_of" uuid REFERENCES "design_templates"("id") ON DELETE set null,
	"status" text DEFAULT 'public' NOT NULL,
	"moderation_reason" text,
	"likes" integer DEFAULT 0 NOT NULL,
	"saves" integer DEFAULT 0 NOT NULL,
	"uses" integer DEFAULT 0 NOT NULL,
	"featured_week" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "design_templates_list_idx" ON "design_templates" ("status","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "design_templates_owner_idx" ON "design_templates" ("owner_id");--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "template_reactions" (
	"user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
	"template_id" uuid NOT NULL REFERENCES "design_templates"("id") ON DELETE cascade,
	"kind" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	PRIMARY KEY ("user_id","template_id","kind")
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "template_reactions_tpl_idx" ON "template_reactions" ("template_id","kind");
