import { sql } from 'drizzle-orm'
import {
  pgTable, uuid, text, timestamp, real, integer, date, jsonb, boolean, bigserial, index, uniqueIndex, primaryKey,
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
