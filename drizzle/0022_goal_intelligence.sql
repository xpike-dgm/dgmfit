ALTER TABLE "goals" ADD COLUMN "reached_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "goals" ADD COLUMN "reached_choice" text;--> statement-breakpoint
ALTER TABLE "goals" ADD COLUMN "phase" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "body_fat_pct" real;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "body_fat_source" text;