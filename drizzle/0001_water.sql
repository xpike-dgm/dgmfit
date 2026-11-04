CREATE TABLE "water_containers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"kind" text DEFAULT 'glass' NOT NULL,
	"capacity_ml" integer NOT NULL,
	"last_fill" real DEFAULT 1 NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "water_goal_history" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"effective_from" date NOT NULL,
	"base_ml" integer NOT NULL,
	"weekday" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "water_logs" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"logged_at" timestamp with time zone NOT NULL,
	"ml" integer NOT NULL,
	"drink" text DEFAULT 'water' NOT NULL,
	"hydration" real DEFAULT 1 NOT NULL,
	"effective_ml" integer NOT NULL,
	"container_id" uuid,
	"source" text NOT NULL,
	"note" text,
	"history" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "water_settings" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"buttons" jsonb DEFAULT '[50,100,150,200,250,500]'::jsonb NOT NULL,
	"sip_ml" integer,
	"progress_style" text DEFAULT 'bottle' NOT NULL,
	"simple_mode" boolean DEFAULT false NOT NULL,
	"feedback" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "water_containers" ADD CONSTRAINT "water_containers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "water_goal_history" ADD CONSTRAINT "water_goal_history_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "water_logs" ADD CONSTRAINT "water_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "water_logs" ADD CONSTRAINT "water_logs_container_id_water_containers_id_fk" FOREIGN KEY ("container_id") REFERENCES "public"."water_containers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "water_settings" ADD CONSTRAINT "water_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "water_containers_user_idx" ON "water_containers" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "water_goal_history_user_idx" ON "water_goal_history" USING btree ("user_id","effective_from");--> statement-breakpoint
CREATE INDEX "water_logs_user_time_idx" ON "water_logs" USING btree ("user_id","logged_at");