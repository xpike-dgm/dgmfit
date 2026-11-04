CREATE TABLE "body_measurements" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"day" date NOT NULL,
	"waist_cm" real,
	"chest_cm" real,
	"hips_cm" real,
	"arm_cm" real,
	"thigh_cm" real,
	"neck_cm" real,
	"calf_cm" real,
	"body_fat_pct" real,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "media_blobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"day" date NOT NULL,
	"pose" text,
	"mime" text NOT NULL,
	"iv" "bytea" NOT NULL,
	"tag" "bytea" NOT NULL,
	"data" "bytea" NOT NULL,
	"bytes" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "exercises" ADD COLUMN "photo_id" uuid;--> statement-breakpoint
ALTER TABLE "program_exercises" ADD COLUMN "scheme" text;--> statement-breakpoint
ALTER TABLE "program_exercises" ADD COLUMN "scheme_state" jsonb;--> statement-breakpoint
ALTER TABLE "programs" ADD COLUMN "periodization" text DEFAULT 'linear' NOT NULL;--> statement-breakpoint
ALTER TABLE "programs" ADD COLUMN "deload_every" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "programs" ADD COLUMN "start_day" date DEFAULT (now() at time zone 'Europe/Istanbul')::date NOT NULL;--> statement-breakpoint
ALTER TABLE "body_measurements" ADD CONSTRAINT "body_measurements_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_blobs" ADD CONSTRAINT "media_blobs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "body_measurements_user_day_idx" ON "body_measurements" USING btree ("user_id","day");--> statement-breakpoint
CREATE INDEX "media_blobs_user_idx" ON "media_blobs" USING btree ("user_id","kind","day");