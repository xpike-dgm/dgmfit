import 'server-only'
// P-7 rozet/seri verisi: yemek, antrenman, rekor, check-in ve hedef kayıtlarından (hesap lib/achievements.ts).
import { sql } from 'drizzle-orm'
import { db } from './db'
import { dayString } from './time'
import { computeAchievements, foodStreak, trainingWeekStreak } from './achievements'

export async function achievementsFor(userId: string) {
  const today = dayString()
  const [food, wo, prs, ck, goal] = await Promise.all([
    db.execute<{ day: string; n: number }>(sql`select day::text as day, count(*)::int as n from meal_items where user_id = ${userId} and deleted_at is null and meal <> 'supplement' group by day`),
    db.execute<{ day: string }>(sql`select day::text as day from workouts where user_id = ${userId} and deleted_at is null union all select day::text from cardio_sessions where user_id = ${userId} and deleted_at is null`),
    db.execute<{ day: string }>(sql`select w.day::text as day from personal_records pr join workouts w on w.id = pr.workout_id where pr.user_id = ${userId} and w.deleted_at is null`),
    db.execute<{ day: string }>(sql`select to_char(created_at at time zone 'Europe/Istanbul', 'YYYY-MM-DD') as day from events where user_id = ${userId} and type = 'plan.adjusted' and payload->>'kind' = 'checkin'`),
    db.execute<{ day: string | null }>(sql`select to_char(min(reached_at) at time zone 'Europe/Istanbul', 'YYYY-MM-DD') as day from goals where user_id = ${userId}`),
  ])
  const foodDays = food.map((r) => ({ day: String(r.day), items: Number(r.n) }))
  const workoutDays = wo.map((r) => String(r.day))
  const list = computeAchievements({ foodDays, workoutDays, prDays: prs.map((r) => String(r.day)), goalReachedDay: goal[0]?.day ?? null, checkinDays: ck.map((r) => String(r.day)), today })
  return { list, foodStreak: foodStreak(foodDays, today), weekStreak: trainingWeekStreak(workoutDays, today) }
}
