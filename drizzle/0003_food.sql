CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint
CREATE TABLE "foods" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"source" text NOT NULL,
	"source_id" text NOT NULL,
	"user_id" uuid,
	"key" text,
	"name_tr" text,
	"name_en" text,
	"brand" text,
	"barcode" text,
	"category" text,
	"per100" jsonb NOT NULL,
	"kcal" real NOT NULL,
	"protein" real NOT NULL,
	"carb" real NOT NULL,
	"fat" real NOT NULL,
	"portions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"approx" boolean DEFAULT false NOT NULL,
	"aliases" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"recipe" jsonb,
	"search" text NOT NULL,
	"attribution" text,
	"image_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "meal_items" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"day" date NOT NULL,
	"meal" text NOT NULL,
	"logged_at" timestamp with time zone DEFAULT now() NOT NULL,
	"food_id" bigint,
	"name" text NOT NULL,
	"grams" real DEFAULT 0 NOT NULL,
	"portion_label" text,
	"portion_qty" real,
	"per100" jsonb,
	"kcal" real NOT NULL,
	"protein" real DEFAULT 0 NOT NULL,
	"carb" real DEFAULT 0 NOT NULL,
	"fat" real DEFAULT 0 NOT NULL,
	"source" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "saved_meals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"items" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "water_settings" ADD COLUMN "food_water" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "foods" ADD CONSTRAINT "foods_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_items" ADD CONSTRAINT "meal_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_items" ADD CONSTRAINT "meal_items_food_id_foods_id_fk" FOREIGN KEY ("food_id") REFERENCES "public"."foods"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_meals" ADD CONSTRAINT "saved_meals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "foods_source_idx" ON "foods" USING btree ("source","source_id");--> statement-breakpoint
CREATE INDEX "foods_barcode_idx" ON "foods" USING btree ("barcode");--> statement-breakpoint
CREATE INDEX "foods_user_idx" ON "foods" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "foods_search_trgm_idx" ON "foods" USING gin ("search" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "meal_items_user_day_idx" ON "meal_items" USING btree ("user_id","day");--> statement-breakpoint
CREATE INDEX "saved_meals_user_idx" ON "saved_meals" USING btree ("user_id");