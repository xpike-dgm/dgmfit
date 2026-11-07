CREATE TABLE IF NOT EXISTS "ui_designs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
	"name" text DEFAULT 'Benim düzenim' NOT NULL,
	"data" jsonb NOT NULL,
	"active" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ui_designs_user_idx" ON "ui_designs" ("user_id","active");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "ui_designs_one_active" ON "ui_designs" ("user_id") WHERE "active";
