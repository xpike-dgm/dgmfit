CREATE TABLE "kcal_adjustments" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"day" date NOT NULL,
	"kcal" integer NOT NULL,
	"reason" text NOT NULL,
	"source_day" date,
	"bank_id" uuid,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "daily_targets" ADD COLUMN "eaten_kcal" integer;--> statement-breakpoint
ALTER TABLE "daily_targets" ADD COLUMN "burned_kcal" integer;--> statement-breakpoint
ALTER TABLE "daily_targets" ADD COLUMN "items" integer;--> statement-breakpoint
ALTER TABLE "daily_targets" ADD COLUMN "closure_kind" text;--> statement-breakpoint
ALTER TABLE "daily_targets" ADD COLUMN "diff_kcal" integer;--> statement-breakpoint
ALTER TABLE "daily_targets" ADD COLUMN "leftover_kcal" integer;--> statement-breakpoint
ALTER TABLE "kcal_adjustments" ADD CONSTRAINT "kcal_adjustments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "kcal_adjustments_user_day_idx" ON "kcal_adjustments" USING btree ("user_id","day");