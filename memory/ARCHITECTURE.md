# Mimari

Son doğrulama: 2026-11-04, commit `dce73c0` (memory-check ile).

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
- `components/` — `ui.tsx` (btn sınıfları, Ring, Bar, TopBar, FieldError), `icons.tsx` (satır içi SVG), `Ruler.tsx` (kaydırmalı cetvel), `BottomNav.tsx`, `QuickAdd.tsx` (dialog), `ModuleSoon.tsx`, `SwRegister.tsx`.
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

## Veri modeli (Faz 0)

`users` · `sessions` · `profiles` (1:1 kullanıcı) · `profile_history` · `goals` (aktif tek hedef, `active`) · `weight_logs` · `events` · `daily_targets` (gün bazlı hedef + dengeleme; henüz yazılmıyor, Faz 2'de dolacak).

## Olay türleri (`lib/events.ts`)

`profile.onboarded`, `profile.updated`, `weight.logged`, `meal.logged`, `workout.finished`, `pr.achieved`, `water.logged`, `day.closed`. Şu an yayınlananlar: `profile.onboarded`, `weight.logged`. Henüz dinleyici (`on`) kaydı yok.
