-- Özelleştirme Ö3a: tasarım sürümleri (her kayıtta anlık görüntü; geri yükleme). Kişisel veri içermez (tasarım verisi).
CREATE TABLE IF NOT EXISTS "ui_design_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"design_id" uuid NOT NULL REFERENCES "ui_designs"("id") ON DELETE cascade,
	"user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
	"note" text DEFAULT '' NOT NULL,
	"data" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ui_design_versions_design_idx" ON "ui_design_versions" ("design_id","created_at");
