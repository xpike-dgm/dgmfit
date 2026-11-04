import { sql } from 'drizzle-orm'
import {
  pgTable, uuid, text, timestamp, real, integer, date, jsonb, boolean, bigserial, bigint, index, uniqueIndex, primaryKey,
} from 'drizzle-orm/pg-core'

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
