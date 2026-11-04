'use server'
import { redirect } from 'next/navigation'
import { sql } from 'drizzle-orm'
import { db, schema } from '@/lib/db'
import { createSession, destroySession, hashPassword, verifyPassword, rateLimit, clientIp } from '@/lib/auth'
import { checkPassword, emailError, usernameError } from '@/lib/validation'

export interface FormState {
  errors?: Partial<Record<'username' | 'email' | 'password' | 'confirm' | 'terms' | 'form', string>>
  values?: { username?: string; email?: string; login?: string }
}

export async function registerAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const username = String(fd.get('username') ?? '').trim()
  const email = String(fd.get('email') ?? '').trim().toLowerCase()
  const password = String(fd.get('password') ?? '')
  const confirm = String(fd.get('confirm') ?? '')
  const terms = fd.get('terms') === 'on'
  const values = { username, email }
  const errors: FormState['errors'] = {}

  const ue = usernameError(username); if (ue) errors.username = ue
  const ee = emailError(email); if (ee) errors.email = ee
  const pc = checkPassword(password); if (!pc.ok) errors.password = 'Şifre şunları içermeli: ' + pc.issues.join(', ')
  if (password !== confirm) errors.confirm = 'Şifreler eşleşmiyor'
  if (!terms) errors.terms = 'Devam etmek için kullanım koşullarını ve KVKK metnini onaylamalısın'
  if (Object.keys(errors).length) return { errors, values }

  if (!rateLimit('reg:' + (await clientIp()), 10, 60 * 60 * 1000)) {
    return { errors: { form: 'Çok fazla deneme yapıldı. Biraz sonra tekrar dene.' }, values }
  }

  const taken = await db.execute<{ u: boolean; e: boolean }>(sql`
    select exists(select 1 from users where lower(username) = lower(${username})) as u,
           exists(select 1 from users where lower(email) = lower(${email})) as e`)
  const t = taken[0]
  if (t?.u) errors.username = 'Bu kullanıcı adı alınmış'
  if (t?.e) errors.email = 'Bu e-posta ile zaten bir hesap var'
  if (Object.keys(errors).length) return { errors, values }

  const passwordHash = await hashPassword(password)
  let userId: string
  try {
    const [u] = await db.insert(schema.users).values({ username, email, passwordHash }).returning({ id: schema.users.id })
    userId = u.id
  } catch {
    return { errors: { form: 'Hesap oluşturulamadı, bu kullanıcı adı veya e-posta kullanımda olabilir.' }, values }
  }
  await createSession(userId)
  redirect('/kurulum')
}

export async function loginAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const login = String(fd.get('login') ?? '').trim()
  const password = String(fd.get('password') ?? '')
  const values = { login }
  if (!login || !password) return { errors: { form: 'Kullanıcı adı/e-posta ve şifre gerekli' }, values }

  const ip = await clientIp()
  if (!rateLimit('login:' + ip, 20) || !rateLimit('login-u:' + login.toLowerCase(), 8)) {
    return { errors: { form: 'Çok fazla hatalı deneme. 10 dakika sonra tekrar dene.' }, values }
  }

  const rows = await db.execute<{ id: string; password_hash: string }>(sql`
    select id, password_hash from users where lower(username) = lower(${login}) or lower(email) = lower(${login}) limit 1`)
  const u = rows[0]
  const ok = u ? await verifyPassword(password, u.password_hash) : false
  if (!u || !ok) return { errors: { form: 'Kullanıcı adı/e-posta veya şifre hatalı' }, values }
  await createSession(u.id)
  redirect('/')
}

export async function logoutAction() {
  await destroySession()
  redirect('/giris')
}
