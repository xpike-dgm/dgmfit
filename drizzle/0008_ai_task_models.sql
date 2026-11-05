ALTER TABLE "ai_calls" ADD COLUMN "model" text;--> statement-breakpoint
ALTER TABLE "ai_providers" ADD COLUMN "task_models" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
UPDATE "ai_providers" SET "task_models" = '{"meal-photo":"claude-opus-5-5","label":"claude-opus-5-5"}'::jsonb WHERE "id" = 'claude' AND "task_models" = '{}'::jsonb;
