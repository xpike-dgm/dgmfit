import { sql } from 'drizzle-orm'
import {
  pgTable, uuid, text, timestamp, real, integer, date, jsonb, boolean, bigserial, bigint, index, uniqueIndex, primaryKey, customType,
} from 'drizzle-orm/pg-core'

const bytea = customType<{ data: Buffer; driverData: Buffer }>({ dataType: () => 'bytea' })

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  username: text('username').notNull(),
  email: text('email').notNull(),
  passwordHash: text('password_hash').notNull(),
  emailVerifiedAt: timestamp('email_verified_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex('users_username_lower_idx').on(sql`lower(${t.username})`),
  uniqueIndex('users_email_lower_idx').on(sql`lower(${t.email})`),
])

export const sessions = pgTable('sessions', {
  id: text('id').primaryKey(), // sha256(token)
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  userAgent: text('user_agent'),
}, (t) => [index('sessions_user_idx').on(t.userId)])

export const profiles = pgTable('profiles', {
  userId: uuid('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  sex: text('sex').notNull(),
  birthDate: date('birth_date').notNull(),
  heightCm: real('height_cm').notNull(),
  weightKg: real('weight_kg').notNull(),
  activity: text('activity').notNull(),
  goal: text('goal').notNull(),
  targetWeightKg: real('target_weight_kg').notNull(),
  experience: text('experience'),
  trainingDays: integer('training_days'),
  dietPref: text('diet_pref'),
  allergies: jsonb('allergies').$type<string[]>(),
  wakeTime: text('wake_time'),
  sleepTime: text('sleep_time'),
  waistCm: real('waist_cm'),
  onboardedAt: timestamp('onboarded_at', { withTimezone: true }),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

/** Profil değişikliklerinin tarihçesi; geçmiş günlerin hedefleri bozulmaz. */
export const profileHistory = pgTable('profile_history', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  effectiveFrom: date('effective_from').notNull(),
  data: jsonb('data').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index('profile_history_user_idx').on(t.userId, t.effectiveFrom)])

export const goals = pgTable('goals', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: text('type').notNull(),
  startWeightKg: real('start_weight_kg').notNull(),
  targetWeightKg: real('target_weight_kg').notNull(),
  startDate: date('start_date').notNull(),
  endDate: date('end_date').notNull(),
  tdee: integer('tdee').notNull(),
  dailyKcal: integer('daily_kcal').notNull(),
  proteinG: integer('protein_g').notNull(),
  carbG: integer('carb_g').notNull(),
  fatG: integer('fat_g').notNull(),
  waterMl: integer('water_ml').notNull(),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index('goals_user_active_idx').on(t.userId, t.active)])

export const weightLogs = pgTable('weight_logs', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  loggedAt: timestamp('logged_at', { withTimezone: true }).notNull(),
  kg: real('kg').notNull(),
  source: text('source').notNull().default('manual'),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (t) => [index('weight_logs_user_idx').on(t.userId, t.loggedAt)])

/** Modüller arası olay günlüğü (meal.logged, workout.finished, water.logged, weight.logged ...) */
export const events = pgTable('events', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: text('type').notNull(),
  payload: jsonb('payload').notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index('events_user_type_idx').on(t.userId, t.type, t.createdAt)])

/** Günlük hedef kayıtları (dengeleme ve tarihçe için; gün kapanınca kesinleşir). */
export const dailyTargets = pgTable('daily_targets', {
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  day: date('day').notNull(),
  baseKcal: integer('base_kcal').notNull(),
  adjustmentKcal: integer('adjustment_kcal').notNull().default(0),
  proteinG: integer('protein_g').notNull(),
  carbG: integer('carb_g').notNull(),
  fatG: integer('fat_g').notNull(),
  waterMl: integer('water_ml').notNull(),
  closedAt: timestamp('closed_at', { withTimezone: true }),
  // kapanış anlık görüntüsü (Faz 2b)
  eatenKcal: integer('eaten_kcal'),
  burnedKcal: integer('burned_kcal'),
  items: integer('items'),
  closureKind: text('closure_kind'), // untracked | incomplete | balanced | over | under
  diffKcal: integer('diff_kcal'), // dağıtılan fark
  leftoverKcal: integer('leftover_kcal'),
}, (t) => [primaryKey({ columns: [t.userId, t.day] })])

// ───────────── Su modülü (Faz 1a) ─────────────

export const waterContainers = pgTable('water_containers', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  kind: text('kind').notNull().default('glass'), // glass | bottle | thermos | cup
  capacityMl: integer('capacity_ml').notNull(),
  lastFill: real('last_fill').notNull().default(1), // son seçilen doluluk oranı
  isDefault: boolean('is_default').notNull().default(false),
  sort: integer('sort').notNull().default(0),
  archivedAt: timestamp('archived_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index('water_containers_user_idx').on(t.userId)])

export const waterLogs = pgTable('water_logs', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  loggedAt: timestamp('logged_at', { withTimezone: true }).notNull(),
  ml: integer('ml').notNull(), // ham hacim
  drink: text('drink').notNull().default('water'),
  hydration: real('hydration').notNull().default(1),
  effectiveMl: integer('effective_ml').notNull(), // hedefe sayılan
  containerId: uuid('container_id').references(() => waterContainers.id, { onDelete: 'set null' }),
  source: text('source').notNull(), // button | sip | container | fill | finish | custom | backdate | meal | voice | notification
  note: text('note'),
  history: jsonb('history').$type<{ at: string; action: string; before?: unknown }[]>().notNull().default([]),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (t) => [index('water_logs_user_time_idx').on(t.userId, t.loggedAt)])

export const waterSettings = pgTable('water_settings', {
  userId: uuid('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  buttons: jsonb('buttons').$type<number[]>().notNull().default([50, 100, 150, 200, 250, 500]),
  sipMl: integer('sip_ml'),
  progressStyle: text('progress_style').notNull().default('bottle'), // bottle | ring | wave
  simpleMode: boolean('simple_mode').notNull().default(false),
  feedback: boolean('feedback').notNull().default(true), // animasyon + titreşim
  remindersEnabled: boolean('reminders_enabled').notNull().default(false),
  quiet: jsonb('quiet').$type<[number, number][]>().notNull().default([]), // sessiz aralıklar (dakika)
  maxPerDay: integer('max_per_day').notNull().default(8),
  summaryEnabled: boolean('summary_enabled').notNull().default(true),
  foodWater: boolean('food_water').notNull().default(false), // çorba, ayran gibi yemeklerden gelen suyu say
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

/** Hedef değişiklikleri: bir günün hedefi = o güne kadarki en son kayıt. Geçmiş istatistikler bozulmaz. */
export const waterGoalHistory = pgTable('water_goal_history', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  effectiveFrom: date('effective_from').notNull(),
  baseMl: integer('base_ml').notNull(),
  weekday: jsonb('weekday').$type<(number | null)[]>(), // 0=Pazar … 6=Cumartesi
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index('water_goal_history_user_idx').on(t.userId, t.effectiveFrom)])

// ───────── Bildirimler (Faz 1b) ─────────

/** Uygulama düzeyi yapılandırma (ör. ilk açılışta üretilen VAPID anahtarları). */
export const appConfig = pgTable('app_config', {
  key: text('key').primaryKey(),
  value: jsonb('value').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const pushSubscriptions = pgTable('push_subscriptions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  endpoint: text('endpoint').notNull(),
  p256dh: text('p256dh').notNull(),
  auth: text('auth').notNull(),
  userAgent: text('user_agent'),
  failures: integer('failures').notNull().default(0),
  lastOkAt: timestamp('last_ok_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex('push_subscriptions_endpoint_idx').on(t.endpoint), index('push_subscriptions_user_idx').on(t.userId)])

export const waterReminders = pgTable('water_reminders', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  day: date('day').notNull(),
  minute: integer('minute').notNull(),
  kind: text('kind').notNull(), // remind | summary | test
  amount: integer('amount').notNull().default(0),
  title: text('title').notNull(),
  body: text('body').notNull(),
  delivered: integer('delivered').notNull().default(0), // başarılı gönderilen abonelik sayısı
  sentAt: timestamp('sent_at', { withTimezone: true }).notNull().defaultNow(),
  openedAt: timestamp('opened_at', { withTimezone: true }),
  actedAt: timestamp('acted_at', { withTimezone: true }), // 20 dk içinde su kaydı
  action: text('action'), // add | snooze | open
}, (t) => [index('water_reminders_user_day_idx').on(t.userId, t.day)])

// ───────── Yemek (Faz 2a) ─────────

/** Besinler: USDA (CC0), DgFit tarifleri (hesaplanmış), Open Food Facts (ODbL), kullanıcı besinleri/tarifleri. Değerler 100 g başına. */
export const foods = pgTable('foods', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  source: text('source').notNull(), // usda | dgfit | off | user | user-recipe
  sourceId: text('source_id').notNull(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }), // yalnızca kullanıcı besinleri
  key: text('key'),
  nameTr: text('name_tr'),
  nameEn: text('name_en'),
  brand: text('brand'),
  barcode: text('barcode'),
  category: text('category'),
  per100: jsonb('per100').$type<Record<string, number>>().notNull(),
  kcal: real('kcal').notNull(),
  protein: real('protein').notNull(),
  carb: real('carb').notNull(),
  fat: real('fat').notNull(),
  portions: jsonb('portions').$type<{ label: string; g: number }[]>().notNull().default([]),
  approx: boolean('approx').notNull().default(false),
  aliases: jsonb('aliases').$type<string[]>().notNull().default([]),
  recipe: jsonb('recipe'),
  search: text('search').notNull(),
  attribution: text('attribution'),
  imageUrl: text('image_url'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (t) => [
  uniqueIndex('foods_source_idx').on(t.source, t.sourceId),
  index('foods_barcode_idx').on(t.barcode),
  index('foods_user_idx').on(t.userId),
  index('foods_search_trgm_idx').using('gin', sql`${t.search} gin_trgm_ops`),
])

/** Öğün kaydı. Besin değerleri kayıt anında kopyalanır; besin sonradan değişse de geçmiş bozulmaz. */
export const mealItems = pgTable('meal_items', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  day: date('day').notNull(),
  meal: text('meal').notNull(), // breakfast | lunch | dinner | snack
  loggedAt: timestamp('logged_at', { withTimezone: true }).notNull().defaultNow(),
  foodId: bigint('food_id', { mode: 'number' }).references(() => foods.id, { onDelete: 'set null' }),
  name: text('name').notNull(),
  grams: real('grams').notNull().default(0),
  portionLabel: text('portion_label'),
  portionQty: real('portion_qty'),
  per100: jsonb('per100').$type<Record<string, number>>(),
  kcal: real('kcal').notNull(),
  protein: real('protein').notNull().default(0),
  carb: real('carb').notNull().default(0),
  fat: real('fat').notNull().default(0),
  source: text('source').notNull(), // search | recent | barcode | copy | saved | quick | recipe
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (t) => [index('meal_items_user_day_idx').on(t.userId, t.day)])

export const savedMeals = pgTable('saved_meals', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  items: jsonb('items').$type<{ foodId: number; grams: number; portionLabel: string | null; portionQty: number | null }[]>().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index('saved_meals_user_idx').on(t.userId)])

// ───────── Fit (Faz 2b) ─────────

/** Günlük hedef düzeltmeleri: dengeleme, kalori bankası. Bir günün hedefi = plan tabanı + bu günün düzeltmeleri. */
export const kcalAdjustments = pgTable('kcal_adjustments', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  day: date('day').notNull(),
  kcal: integer('kcal').notNull(),
  reason: text('reason').notNull(), // balance | bank-save | bank-spend
  sourceDay: date('source_day'), // dengelemenin kaynağı olan gün
  bankId: uuid('bank_id'),
  note: text('note'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (t) => [index('kcal_adjustments_user_day_idx').on(t.userId, t.day)])

// ───────── Fitness (Faz 3a) ─────────

/** Hareket kütüphanesi: free-exercise-db (source=fedb, Unlicense) + kullanıcının özel hareketleri (source=user). */
export const exercises = pgTable('exercises', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  key: text('key').notNull(), // fedb: veri setindeki id; user: u-<uuid>
  source: text('source').notNull(), // fedb | user
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
  nameTr: text('name_tr').notNull(),
  nameEn: text('name_en'),
  aliases: jsonb('aliases').$type<string[]>().notNull().default([]),
  category: text('category').notNull(),
  equipment: text('equipment').notNull(),
  level: text('level'),
  force: text('force'),
  mechanic: text('mechanic'),
  primary: jsonb('primary_muscles').$type<string[]>().notNull().default([]),
  secondary: jsonb('secondary_muscles').$type<string[]>().notNull().default([]),
  kind: text('kind').notNull(), // weight_reps | bodyweight | assisted | time | distance_time
  pattern: text('pattern').notNull(), // push | pull | legs | core | cardio | other
  images: jsonb('images').$type<string[]>().notNull().default([]),
  steps: jsonb('steps').$type<string[]>().notNull().default([]),
  mistakes: jsonb('mistakes').$type<string[]>().notNull().default([]),
  curated: boolean('curated').notNull().default(false),
  photoId: uuid('photo_id'), // özel hareket fotoğrafı (media_blobs)
  search: text('search').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (t) => [
  uniqueIndex('exercises_key_idx').on(t.key),
  index('exercises_user_idx').on(t.userId),
  index('exercises_search_trgm_idx').using('gin', sql`${t.search} gin_trgm_ops`),
])

export const programs = pgTable('programs', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  templateId: text('template_id'), // fullbody | upperlower | ppl | brosplit | gzclp | generated | null (boş)
  notes: jsonb('notes').$type<string[]>().notNull().default([]),
  active: boolean('active').notNull().default(false),
  nextDayIdx: integer('next_day_idx').notNull().default(0), // sıradaki antrenman günü (döngü)
  periodization: text('periodization').notNull().default('linear'), // linear | dup | block (Faz 3b)
  deloadEvery: integer('deload_every').notNull().default(0), // 0 = yok; N = her N. hafta deload
  startDay: date('start_day').notNull().default(sql`(now() at time zone 'Europe/Istanbul')::date`),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (t) => [index('programs_user_idx').on(t.userId)])

export const programDays = pgTable('program_days', {
  id: uuid('id').primaryKey().defaultRandom(),
  programId: uuid('program_id').notNull().references(() => programs.id, { onDelete: 'cascade' }),
  idx: integer('idx').notNull(),
  name: text('name').notNull(),
  focus: text('focus'),
}, (t) => [index('program_days_program_idx').on(t.programId)])

export const programExercises = pgTable('program_exercises', {
  id: uuid('id').primaryKey().defaultRandom(),
  dayId: uuid('day_id').notNull().references(() => programDays.id, { onDelete: 'cascade' }),
  idx: integer('idx').notNull(),
  exerciseId: bigint('exercise_id', { mode: 'number' }).notNull().references(() => exercises.id),
  role: text('role').notNull().default('yardımcı'),
  sets: integer('sets').notNull(),
  repMin: integer('rep_min').notNull(),
  repMax: integer('rep_max').notNull(),
  rir: integer('rir').notNull().default(2),
  rest: integer('rest').notNull().default(120), // saniye
  seconds: integer('seconds'), // süreli hareket hedefi
  setType: text('set_type').notNull().default('normal'),
  scheme: text('scheme'), // gzclp-t1 | gzclp-t2 | gzclp-t3 (Faz 3b); null = çift aşamalı
  schemeState: jsonb('scheme_state').$type<{ tier: 't1' | 't2' | 't3'; stage: number; kg: number; lastBaseKg: number | null }>(),
}, (t) => [index('program_exercises_day_idx').on(t.dayId)])

/** Tamamlanmış antrenman. client_id çevrimdışı kaydın iki kez gönderilmesini engeller. */
export const workouts = pgTable('workouts', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  clientId: text('client_id').notNull(),
  programDayId: uuid('program_day_id').references(() => programDays.id, { onDelete: 'set null' }),
  name: text('name').notNull(),
  day: date('day').notNull(),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
  endedAt: timestamp('ended_at', { withTimezone: true }).notNull(),
  durationSec: integer('duration_sec').notNull(),
  volumeKg: real('volume_kg').notNull().default(0),
  workSets: integer('work_sets').notNull().default(0),
  kcalGross: integer('kcal_gross').notNull().default(0),
  kcalNet: integer('kcal_net').notNull().default(0),
  bodyKg: real('body_kg'),
  notes: text('notes'),
  pain: boolean('pain').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (t) => [uniqueIndex('workouts_client_idx').on(t.userId, t.clientId), index('workouts_user_day_idx').on(t.userId, t.day)])

export const workoutSets = pgTable('workout_sets', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  workoutId: uuid('workout_id').notNull().references(() => workouts.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  exerciseId: bigint('exercise_id', { mode: 'number' }).notNull().references(() => exercises.id),
  exIdx: integer('ex_idx').notNull(),
  setIdx: integer('set_idx').notNull(),
  type: text('type').notNull().default('normal'),
  kg: real('kg').notNull().default(0),
  reps: integer('reps').notNull().default(0),
  rir: integer('rir'),
  seconds: integer('seconds'),
  distanceM: real('distance_m'),
  suggestedKg: real('suggested_kg'),
  suggestedReps: integer('suggested_reps'),
  feedback: text('feedback'), // too_heavy | too_light | no_equipment
  note: text('note'),
  completedAt: timestamp('completed_at', { withTimezone: true }).notNull(),
}, (t) => [index('workout_sets_user_ex_idx').on(t.userId, t.exerciseId, t.completedAt), index('workout_sets_workout_idx').on(t.workoutId)])

/** Hareket başına güncel rekorlar (lib/training.ts Records). */
export const exerciseRecords = pgTable('exercise_records', {
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  exerciseId: bigint('exercise_id', { mode: 'number' }).notNull().references(() => exercises.id),
  records: jsonb('records').$type<Record<string, number>>().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.userId, t.exerciseId] })])

/** Kırılan rekorların kaydı (vitrin ve Sosyal için). */
export const personalRecords = pgTable('personal_records', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  exerciseId: bigint('exercise_id', { mode: 'number' }).notNull().references(() => exercises.id),
  workoutId: uuid('workout_id').references(() => workouts.id, { onDelete: 'cascade' }),
  type: text('type').notNull(),
  value: real('value').notNull(),
  previous: real('previous'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index('personal_records_user_idx').on(t.userId, t.createdAt)])

export const cardioSessions = pgTable('cardio_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  day: date('day').notNull(),
  type: text('type').notNull(), // run | walk | bike | swim | hiit | rope | row | elliptical | stairs
  minutes: real('minutes').notNull(),
  distanceKm: real('distance_km'),
  avgHr: integer('avg_hr'),
  intensity: text('intensity').notNull().default('orta'),
  kcalGross: integer('kcal_gross').notNull(),
  kcalNet: integer('kcal_net').notNull(),
  method: text('method').notNull(), // met | acsm | nabız
  note: text('note'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (t) => [index('cardio_user_day_idx').on(t.userId, t.day)])

/** Salon ayarları: bar, plakalar, en küçük artış, mevcut ekipman, varsayılan seans süresi. */
export const gymSettings = pgTable('gym_settings', {
  userId: uuid('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  barKg: real('bar_kg').notNull().default(20),
  plates: jsonb('plates').$type<number[]>().notNull().default([25, 20, 15, 10, 5, 2.5, 1.25]),
  increment: real('increment').notNull().default(2.5),
  equipment: jsonb('equipment').$type<string[]>().notNull().default(['barbell', 'dumbbell', 'cable', 'machine', 'kettlebells', 'bands', 'e-z curl bar', 'body only', 'other']),
  sessionMinutes: integer('session_minutes').notNull().default(60),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

// ───────── Fitness gelişim (Faz 3b) ─────────

export const bodyMeasurements = pgTable('body_measurements', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  day: date('day').notNull(),
  waistCm: real('waist_cm'), chestCm: real('chest_cm'), hipsCm: real('hips_cm'), armCm: real('arm_cm'),
  thighCm: real('thigh_cm'), neckCm: real('neck_cm'), calfCm: real('calf_cm'), bodyFatPct: real('body_fat_pct'),
  note: text('note'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (t) => [index('body_measurements_user_day_idx').on(t.userId, t.day)])

/** Şifreli medya (AES-256-GCM, anahtar DGFIT_MEDIA_KEY): ilerleme fotoğrafları ve özel hareket fotoğrafları. Yalnızca sahibi görür. */
export const mediaBlobs = pgTable('media_blobs', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  kind: text('kind').notNull(), // progress | exercise
  day: date('day').notNull(),
  pose: text('pose'), // ön | yan | arka
  mime: text('mime').notNull(),
  iv: bytea('iv').notNull(),
  tag: bytea('tag').notNull(),
  data: bytea('data').notNull(),
  bytes: integer('bytes').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (t) => [index('media_blobs_user_idx').on(t.userId, t.kind, t.day)])
