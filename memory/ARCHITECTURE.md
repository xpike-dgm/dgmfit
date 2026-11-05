# Mimari

Son doğrulama: 2026-11-04, Faz 1a sonu (memory-check ile).

## Yığın (package.json'dan)

| Katman | Paket | Sürüm |
| --- | --- | --- |
| Çatı | next (App Router, Turbopack, `output: 'standalone'`) | 16.4.x |
| UI | react, react-dom | 19.3.x |
| Stil | tailwindcss v4 + @tailwindcss/postcss (`@theme` token'ları `app/globals.css`) | 4.3.x |
| ORM | drizzle-orm (postgres-js sürücüsü) + drizzle-kit (migration üretimi) | 0.45.x / 0.31.x |
| DB sürücü | postgres (porsager) — **3.x**, 4.x değil | 3.4.x |
| Doğrulama | zod | 4.x |
| Tip | typescript **5.x** (7.x Next 16 ile kullanılmadı) | 5.9.x |
| Çalışma ortamı | Node 22 (yerel 22.23, sunucu container `node:22-bookworm-slim`) | 22 |
| Veritabanı | PostgreSQL 17 (sunucu), 16 (yerel test) | |

## Klasör haritası

- `app/(auth)/` — giriş (`/giris`), kayıt (`/kayit`), ortak sunucu aksiyonları `actions.ts` (register, login, logout). Layout: oturum varsa yönlendirir.
- `app/kurulum/` — 11 adımlı profil sihirbazı (`Wizard.tsx`, istemci) + `completeOnboarding` aksiyonu.
- `app/(app)/` — oturum ve kurulum gerektiren uygulama; `layout.tsx` `requireUser()` çağırır ve `BottomNav` gösterir.
  - `page.tsx` = Bugün ekranı (`/`), `profil/`, `su/`, `yemek/`, `fitness/`, `sosyal/` (şimdilik `ModuleSoon`).
  - `actions.ts` — `logWeight`.
- `app/api/health` — DB kontrollü sağlık ucu (deploy bunu bekler). `app/api/auth/username` — kullanıcı adı müsaitlik + öneri.
- `app/yasal/` — kullanım koşulları ve KVKK (TASLAK metin).
- `lib/calc.ts` — tüm sağlık hesapları (BMR Mifflin-St Jeor, TDEE, plan, makro, su, güvenlik). Testleri `tests/calc.test.ts`.
- `lib/auth.ts` — scrypt şifre, DB oturumu (cookie `dgfit_session`, token'ın sha256'sı saklanır, 60 gün), `getUser` (React `cache`), `requireUser`, bellek içi `rateLimit`.
- `lib/db/schema.ts` — Drizzle şeması; `lib/db/index.ts` — istemci (bağlantı ilk sorguda açılır).
- `lib/events.ts` — modüller arası olay sistemi: `publish()` olayı `events` tablosuna yazar ve `on()` ile kayıtlı dinleyicileri çağırır.
- `lib/today.ts` — Bugün ekranının verisi (`getToday`), `trendWeight` (EMA α=0.15).
- `lib/time.ts` — tüm günler **Europe/Istanbul** saatine göre (`dayString`, `addDays`, `diffDays`, `longDate`, `greeting`).
- `lib/validation.ts` — istemci+sunucu ortak kurallar (kullanıcı adı, e-posta, şifre gücü, e-posta yazım önerisi).
- `lib/water.ts` — Su hesap motoru (saf, isomorfik; istemci ve sunucu aynı fonksiyonu kullanır): içecek türleri + hidrasyon katsayısı, ideal eğri, tempo, tahmin, dağılım skoru, sık miktarlar, çift kayıt, saatlik sınır, esnek seri, en uzun ara, hedef tarihçesi. Testleri `tests/water.test.ts`.
- `lib/water-data.ts` — Su veri katmanı (server-only): `ensureWaterSetup` (ilk kullanımda ayarlar + hedef tarihçesi + 3 varsayılan kap), `dailyTotals` (SQL, Europe/Istanbul gün grubu), `getWaterScreen`, `getWaterStats`, `getWaterSummary`.
- `app/(app)/su/` — `page.tsx` (`?gun=YYYY-MM-DD` ile geçmiş gün, en fazla 365 gün), `WaterScreen.tsx` (istemci; iyimser güncelleme, geri al çubuğu, çift kayıt onayı, alt sayfalar), `actions.ts`, `istatistik/` (`?aralik=7|30|90|365`), `ayarlar/`.
- `lib/reminders.ts` — hatırlatma karar motoru (saf): `decideReminder(input)` → gönder/gönderme + gerekçe. Kurallar: uyanık pencere (uyanış+30 dk … uyku−60 dk), sessiz aralıklar, hedef tamamsa yok, günlük tavan, son bildirimden ≥45 dk, 3 ardışık yok sayılanda 2 sa sessizlik, idealin %10 önündeyse yok, aralık 60/90/150 dk (gerilik derecesine göre), unutulan saatte ×0,75, alışkanlık saatinde ×1,2, yok sayılan saatte ×1,5, öneri 150–400 ml, gün sonu özeti uyku−60 dk.
- `lib/scheduler.ts` — `instrumentation.ts` → `startScheduler()` (60 sn `setInterval`, tek süreç bayrağı). Aboneliği olan ve hatırlatması açık kullanıcılar için `runForUser`. `water.logged` olayında son 20 dk'daki hatırlatma `acted_at` alır. `DGFIT_SCHEDULER=off` ile kapatılır.
- `lib/push.ts` — `web-push`; VAPID anahtarları ilk kullanımda üretilip `app_config('vapid')`'e yazılır. 404/410 dönen abonelik silinir.
- `lib/water-speech.ts` — Türkçe cümle → `{ml, drink, atMin}`. `lib/water-insights.ts` — `waterInsights` (kural tabanlı kartlar) ve `computeBadges` (veriden türetilir, tablo yok).
- API: `/api/push/key|subscribe|unsubscribe|test`, `/api/water/notify` (SW'den, çerezle), `/api/test/reminder` (yalnızca `DGFIT_TEST_HOOKS=1`, canlıda 404).
- `public/sw.js` (v2): push → bildirim (en fazla 2 buton); `add:<ml>` ve `snooze` aksiyonları `/api/water/notify`'a POST; normal dokunuş su ekranını açar.
- Yemek: `lib/nutrition.ts` (100 g başına besin anahtarları, `computeRecipe`, `normalizeSearch`), `lib/food.ts` (öğünler, makro/porsiyon, bütçe etkisi, EAN, OFF eşleme), `lib/food-data.ts` (arama: `search like` + `word_similarity`, Türkçe adlar +2, kullanıcı besini +3, İngilizce adlar eşik 0,7; günlük; barkod yerel → OFF önbellek). `app/(app)/yemek/` günlük, `ekle/`, `besin/yeni/`, `tarif/yeni/`, `actions.ts`. `components/FoodSheet.tsx`, `BarcodeScanner.tsx` (BarcodeDetector → ZXing dinamik).
- Besin verisi hattı: `scripts/data/build_usda.py` (CSV → `data/usda-sr.json.gz`), `data/tr-foods.json` + `data/tr-dishes.json` → `scripts/data/build_foods.mjs` → `data/foods-seed.json.gz` (sürüm hash'i); `scripts/migrate.mjs` sürüm farklıysa toplu yükler (`app_config.foods_seed`). `check_tr.py` küratörlü listeyi USDA'ya karşı doğrular; `find_usda.py` aday bulur.
- Fit: `lib/fit.ts` (saf motor, testli: `closureDiff`, `distributeDiff`, `planBank`, `exceptionDays`, `scaleMacros`, `adaptiveTdee` — tartılara doğrusal eğim, `forecastDay`, `checkinProposal`, `kcalAdherence`), `lib/fit-data.ts` (server-only: `dayTargets` = kapanmış günler anlık görüntüden, açık günler `goals` tabanı + `kcal_adjustments`; `closeDay` satırı `ON CONFLICT … WHERE closed_at IS NULL` ile atomik sahiplenir, farkı max(yarın, bugün)…gün+7 açık günlere dağıtır; `reopenDay`/`refreshClosedDay` (Yemek aksiyonları kapalı günü değiştirince yeniden hesaplar); `closePendingDays` (son 7 gün, 03.00 öncesi dün açık kalır); `makeException`, banka, `checkinData`/`applyCheckin`, `getFitScreen`). Zamanlayıcı her gün 03.00 sonrası ilk tikte aktif planı olan herkes için `closePendingDays` çalıştırır; Bugün ve /fit açılışında da çağrılır. `app/(app)/fit/` (`page.tsx` sunucu SVG yol haritası, `FitClient.tsx`, `actions.ts`). Test kancası `/api/test/fit` (yalnızca `DGFIT_TEST_HOOKS=1`).
- Fitness (3a): `lib/training.ts` (saf: e1RM, `suggestNext`, plaka, ısınma, hacim, `sessionRecords`/`detectPRs`, `cardioKcal`, `strengthKcal`, `workoutWaterBonus`), `lib/programs.ts` (5 şablon, ekipman alternatifli yuvalar, `generateProgram`), `lib/exercise-labels.ts` (Türkçe etiketler; JSON ile eşitliği testli), `lib/fitness-data.ts` (server-only: arama, program CRUD, `liveSession`, `saveWorkout` idempotent + rekor + olaylar + program ilerletme + `refreshClosedDay`, özet, kardiyo, ana ekran), `lib/burn.ts` (`dayBurned`, `waterBonusByDay` — Fit kapanışı, Bugün, Su ve zamanlayıcı kullanır). Ekranlar `app/(app)/fitness/` (ana, `antrenman/` canlı mod `LiveWorkout.tsx` + `[id]` özet, `programlar/` + `[id]` düzenleyici, `hareketler/` + `[id]`, `kardiyo/`, `ayarlar/`), `live-store.ts` (taslak + kuyruk), `PendingSync.tsx`. API `/api/exercises/search`. Veri hattı `scripts/data/build_exercises.mjs` → `data/exercises-seed.json.gz`; `migrate.mjs` `seedExercises` (sürüm `app_config.exercises_seed`).
- Fitness gelişim (3b): `lib/progress.ts` (saf: plato, alternatif, kuvvet seviyesi, kas başına set, toparlanma, periyodizasyon), `lib/schemes.ts` (GZCLP durum makinesi), `lib/fitness-stats.ts` (istatistik, hareket gelişimi, ölçüler), `lib/media.ts` (şifreli medya), `lib/rest-push.ts` (dinlenme push zamanlayıcısı). Ekranlar `fitness/istatistik` (`BodyMap.tsx`), `fitness/olcumler` (`MeasureClient.tsx`, `uploadPhoto`), hareket detayında grafik/plato/seviye/alternatif/foto, program düzenleyicide `PeriodSettings` + `SchemeEdit`. API: `/api/media` (POST multipart), `/api/media/[id]`, `/api/push/rest`, test `/api/test/fitness`. SW v3: `dgfit-v3-pages` önbelleği (yalnızca `/fitness/antrenman`).
- AI (4a): `lib/ai/policy.ts` (saf: sağlayıcı seçimi, hata sınıflandırma), `lib/ai/schemas.ts` (zod çıktı şemaları, `strictSubset` JSON Schema, `parseResult`, `labelPer100`), `lib/ai/engine.ts` (server-only: şifreli anahtar, Claude + OpenAI çağrıları, `runTask` = kota → önbellek → sağlayıcılar sırayla, `providerOverview`), `lib/ai/meal.ts` (veritabanı eşleşmesi). `lib/admin.ts` (`DGFIT_ADMINS`). Uçlar `/api/ai/meal`, `/api/ai/label`; yönetici `/yonetim/ai`; Yemek ekle `AiMeal.tsx`, özel besin formunda etiket okuma. Test: sahte sağlayıcı adresleri yalnızca `DGFIT_TEST_HOOKS=1` + `DGFIT_AI_TEST_*_URL`.
- AI koç (4b): saf `lib/weekly.ts` (DayFacts, haftalık istatistik, kural önerileri, `numbersAllowed`), `lib/safety.ts` (bayraklar, riskli ifade, destek metinleri), `lib/insights.ts` (içgörü adayları), `lib/coach-calc.ts` (ne olur, gün eşleştirme, hedef kaydırma); server-only `lib/coach-data.ts` (`gatherDays`, `coachContext`, `sendCoachMessage`, `applyCoachAction`, `dailyInsight`, `weeklyReport`). Ekranlar `/koc` (`CoachChat.tsx`, `actions.ts`), `/rapor`; Bugün `components/InsightCard.tsx` (`/api/coach/insight`'tan sonradan yükler). Zamanlayıcı `sendWeeklyPushes`. AI motoru: `CallInput.system` + `history`, bağlamlı görevlerde önbellek yok, `USER_QUOTA_TASKS`. Test kancası `/api/test/coach`.
- `components/` — `ui.tsx` (btn sınıfları, Ring, Bar, TopBar, FieldError), `icons.tsx` (satır içi SVG), `Ruler.tsx` (kaydırmalı cetvel), `BottomNav.tsx`, `QuickAdd.tsx` (dialog), `Sheet.tsx` (genel alt sayfa, native dialog), `QuickWaterButton.tsx` (Bugün ekranında +250 ml), `ModuleSoon.tsx`, `SwRegister.tsx`.
- `public/` — `manifest.webmanifest`, `sw.js` (statik önbellek + çevrimdışı sayfa + push iskeleti), `offline.html`, `icons/` (`scripts/icons.cjs` ile Playwright'tan üretilir).
- `drizzle/` — SQL migration'lar (drizzle-kit üretir); `scripts/migrate.mjs` bunları container açılışında uygular (`_migrations` tablosu, advisory lock).
- `scripts/` — `bundle.sh`, `deploy.sh`, `migrate.mjs`, `icons.cjs`, `memory-check.mjs`, `verify.sh`.
- `tests/` — birim testler (`*.test.ts`, `node --test --experimental-strip-types`), `tests/e2e/` Playwright akışları.

## Kodlama kuralları

- Tüm arayüz metni Türkçe. Sayılar `fmtNum()` ile `tr-TR` biçiminde (2.175, 78,4).
- Renkler yalnızca `@theme` token'larından: `bg surface surface-2 surface-3 line line-2 ink ink-2 mute faint lime lime-ink coach coach-line water water-ink water-bg orange violet danger`. Makro renkleri: protein=lime, karbonhidrat=orange, yağ=violet; su=water.
- Rakamlar `num` utility'si (Space Grotesk, tabular), metin Manrope (`next/font/google`).
- Dokunma hedefi ≥ 44px. İkon-only butonlarda `aria-label`.
- Next 16: `cookies()`, `headers()`, `params` **async**. Middleware yok; yetki kontrolü layout/page/aksiyon içinde.
- Veri değiştiren işlemler server action; işlemden sonra ilgili olay `publish()` ile yayınlanır.
- Profil değişiklikleri `profile_history`'ye yazılır; geçmiş günlerin hedefleri değiştirilmez.
- Yumuşak silme (`deleted_at`) kayıt tablolarında kullanılır.

## Veri modeli

Faz 0: `users` · `sessions` · `profiles` (1:1 kullanıcı) · `profile_history` · `goals` (aktif tek hedef, `active`) · `weight_logs` · `events` · `daily_targets` (henüz yazılmıyor, Faz 2'de dolacak).

Faz 1a (Su): `water_logs` (ham `ml` + `effective_ml` = ml × hidrasyon; `source`; `history` jsonb: create/edit/merge/delete/undo; yumuşak silme) · `water_containers` (kapasite, son doluluk, varsayılan, arşiv) · `water_settings` (butonlar, yudum ml, görünüm, geri bildirim) · `water_goal_history` (`effective_from` ile; günün hedefi = o güne kadarki son kayıt, haftanın günü özel hedefleri `weekday[0=Pazar]`).

Faz 1b: `app_config` · `push_subscriptions` (endpoint benzersiz) · `water_reminders` (gün, dakika, tür remind/summary/test, öneri ml, teslim sayısı, açılma, etkili olma, aksiyon) · `water_settings`'e `reminders_enabled`, `quiet`, `max_per_day`, `summary_enabled`.

Faz 4a: `ai_providers` (anahtar iv/tag/data, son4, limitler, bekleme, son hata, `task_models` görev→model, 0008) · `ai_calls` (içeriksiz kayıt, kullanılan `model`, 0008) · `ai_cache`. Model seçimi `modelFor(p, task)` (lib/ai/engine.ts); maliyet `PRICES` × gerçek token.

Faz 4b: `coach_prefs` (kişilik, içgörü, rapor push) · `ai_conversations` · `ai_messages` (eylemler durumlarıyla, ne olur, güvenlik) · `ai_insights` (daily/weekly, dönem başına tek satır). Olaylar `coach.action`, `report.pushed`.

Faz 3b: `body_measurements` · `media_blobs` (bytea iv/tag/data) · `programs.periodization/deload_every/start_day` · `program_exercises.scheme/scheme_state` · `exercises.photo_id`.

Faz 3a: `exercises` (fedb + user, trigram arama) · `programs` / `program_days` / `program_exercises` · `workouts` (client_id benzersiz) · `workout_sets` (öneri + reddetme nedeni) · `exercise_records` · `personal_records` · `cardio_sessions` · `gym_settings`. Olaylar: `workout.finished` (strength/cardio), `pr.achieved`.

Faz 2b: `kcal_adjustments` (gün, kcal, neden balance/bank-save/bank-spend, kaynak gün, banka kimliği, yumuşak silme) · `daily_targets` kapanış anlık görüntüsü (taban, düzeltme, makro, yenen, kayıt sayısı, tür, fark, kalan). Olaylar: `day.closed`, `plan.adjusted` (exception/bank/checkin).

Faz 2a: `foods` (kaynak usda/dgfit/off/user/user-recipe; 100 g başına `per100` jsonb + kcal/protein/carb/fat sütunları; `search` trigram GIN) · `meal_items` (günlük kayıt, besin değeri anlık kopya `per100`; hızlı kalori `source=quick`) · `saved_meals`; `water_settings.food_water`. Olay: `meal.logged`.

Su kuralları: hedefe `effective_ml` sayılır; Bugün ekranının su hedefi `water_goal_history`'den gelir (yoksa `goals.water_ml`); hafta şeridi halkaları = (su oranı + `kcalAdherence`) / 2; seri sayacı su serisidir. Bugün/Yemek kalori hedefi `dayTargets`'tan (düzeltilmiş) gelir.

## Olay türleri (`lib/events.ts`)

`profile.onboarded`, `profile.updated`, `weight.logged`, `meal.logged`, `workout.finished`, `pr.achieved`, `water.logged`, `day.closed`, `plan.adjusted`. Şu an yayınlananlar: `profile.onboarded`, `weight.logged`, `water.logged`, `meal.logged`, `day.closed`, `plan.adjusted`. Dinleyici: `water.logged` (zamanlayıcı, hatırlatma etkinliği). Henüz dinleyici (`on`) kaydı yok.
