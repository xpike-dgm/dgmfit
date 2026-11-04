import 'server-only'
import { sql } from 'drizzle-orm'
import { db } from './db'
import { workoutWaterBonus } from './training'

/** Günün antrenman + kardiyo net kalorisi (Fit gün kapanışında egzersiz kredisi). */
export async function dayBurned(userId: string, day: string): Promise<number> {
  const [r] = await db.execute<{ kcal: number }>(sql`
    select (coalesce((select sum(kcal_net) from workouts where user_id = ${userId} and day = ${day} and deleted_at is null), 0)
          + coalesce((select sum(kcal_net) from cardio_sessions where user_id = ${userId} and day = ${day} and deleted_at is null), 0))::int as kcal`)
  return Number(r?.kcal ?? 0)
}

/** Gün başına antrenman + kardiyo dakikası → su hedefi eki (saat başına +500 ml). */
export async function waterBonusByDay(userId: string, from: string, to: string): Promise<Map<string, number>> {
  const rows = await db.execute<{ day: string; min: number }>(sql`
    select day::text as day, sum(min)::float as min from (
      select day, duration_sec / 60.0 as min from workouts where user_id = ${userId} and day between ${from} and ${to} and deleted_at is null
      union all
      select day, minutes as min from cardio_sessions where user_id = ${userId} and day between ${from} and ${to} and deleted_at is null
    ) x group by day`)
  return new Map(rows.map((r) => [String(r.day), workoutWaterBonus(Number(r.min))]))
}
