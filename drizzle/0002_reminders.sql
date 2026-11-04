CREATE TABLE "app_config" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "push_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"endpoint" text NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"user_agent" text,
	"failures" integer DEFAULT 0 NOT NULL,
	"last_ok_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "water_reminders" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"day" date NOT NULL,
	"minute" integer NOT NULL,
	"kind" text NOT NULL,
	"amount" integer DEFAULT 0 NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"delivered" integer DEFAULT 0 NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	"opened_at" timestamp with time zone,
	"acted_at" timestamp with time zone,
	"action" text
);
--> statement-breakpoint
ALTER TABLE "water_settings" ADD COLUMN "reminders_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "water_settings" ADD COLUMN "quiet" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "water_settings" ADD COLUMN "max_per_day" integer DEFAULT 8 NOT NULL;--> statement-breakpoint
ALTER TABLE "water_settings" ADD COLUMN "summary_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "water_reminders" ADD CONSTRAINT "water_reminders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "push_subscriptions_endpoint_idx" ON "push_subscriptions" USING btree ("endpoint");--> statement-breakpoint
CREATE INDEX "push_subscriptions_user_idx" ON "push_subscriptions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "water_reminders_user_day_idx" ON "water_reminders" USING btree ("user_id","day");