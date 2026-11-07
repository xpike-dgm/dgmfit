-- Özelleştirme Ö5b: odak modu (antrenman / diyet / tatil / hastalık) ve Ramazan modu — kullanıcı başına tek satır
CREATE TABLE IF NOT EXISTS "user_modes" (
  "user_id" uuid PRIMARY KEY REFERENCES "users"("id") ON DELETE CASCADE,
  "focus" text,
  "focus_from" date,
  "focus_until" date,
  "ramadan" boolean NOT NULL DEFAULT false,
  "sahur" text NOT NULL DEFAULT '04:45',
  "iftar" text NOT NULL DEFAULT '18:30',
  "ramadan_until" date,
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
