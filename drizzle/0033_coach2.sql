-- Y2: Akıllı Koç 2.0 — kalıcı koç notları, sohbet özeti, sohbetteki öğün önerisi kartı, kendiliğinden yazan koç anahtarı
CREATE TABLE IF NOT EXISTS "coach_memories" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "text" text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "coach_memories_user_idx" ON "coach_memories" ("user_id", "created_at");
ALTER TABLE "ai_conversations" ADD COLUMN IF NOT EXISTS "summary" text;
ALTER TABLE "ai_messages" ADD COLUMN IF NOT EXISTS "meal_plan" jsonb;
ALTER TABLE "coach_prefs" ADD COLUMN IF NOT EXISTS "nudges" boolean NOT NULL DEFAULT false;
