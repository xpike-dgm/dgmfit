CREATE TABLE "ai_cache" (
	"hash" text PRIMARY KEY NOT NULL,
	"task" text NOT NULL,
	"result" jsonb NOT NULL,
	"provider" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_calls" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"user_id" uuid,
	"task" text NOT NULL,
	"provider" text,
	"ok" boolean NOT NULL,
	"cached" boolean DEFAULT false NOT NULL,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"ms" integer DEFAULT 0 NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_providers" (
	"id" text PRIMARY KEY NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"model" text NOT NULL,
	"key_iv" "bytea",
	"key_tag" "bytea",
	"key_data" "bytea",
	"key_last4" text,
	"daily_token_limit" integer DEFAULT 0 NOT NULL,
	"monthly_token_limit" integer DEFAULT 0 NOT NULL,
	"cooldown_until" timestamp with time zone,
	"last_error" text,
	"last_error_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_calls" ADD CONSTRAINT "ai_calls_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_calls_user_idx" ON "ai_calls" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "ai_calls_provider_idx" ON "ai_calls" USING btree ("provider","created_at");