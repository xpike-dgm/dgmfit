'use server'
import { redirect } from 'next/navigation'
import { sql } from 'drizzle-orm'
import { db, schema } from '@/lib/db'
import { eq } from 'drizzle-orm'
import { createSession, destroySession, hashPassword, verifyPassword, rateLimit, clientIp } from '@/lib/auth'
import { isAdmin } from '@/lib/admin-list'
import { canEnter, inviteUsable, normalizeInvite } from '@/lib/access'
import { notifyAdmins } from '@/lib/admin-data'
import { checkPassword, emailError, usernameError } from '@/lib/validation'

export interface FormState {
  errors?: Partial<Record<'username' | 'email' | 'password' | 'confirm' | 'terms' | 'invite' | 'form', string>>
  values?: { username?: string; email?: string; login?: string; invite?: string }
}

export async function registerAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const username = String(fd.get('username') ?? '').trim()
  const email = String(fd.get('email') ?? '').trim().toLowerCase()
  const password = String(fd.get('password') ?? '')
  const confirm = String(fd.get('confirm') ?? '')
  const terms = fd.get('terms') === 'on'
  const inviteIn = normalizeInvite(String(fd.get('invite') ?? ''))
  const values = { username, email, invite: inviteIn }
  const errors: FormState['errors'] = {}

  const ue = usernameError(username); if (ue) errors.username = ue
  const ee = emailError(email); if (ee) errors.email = ee
  const pc = checkPassword(password); if (!pc.ok) errors.password = 'Şifre şunları içermeli: ' + pc.issues.join(', ')
  if (password !== confirm) errors.confirm = 'Şifreler eşleşmiyor'
  if (!terms) errors.terms = 'Devam etmek için kullanım koşullarını ve KVKK metnini onaylamalısın'
  if (Object.keys(errors).length) return { errors, values }

  // Yerel e2e (yalnızca DGFIT_TEST_HOOKS=1) tek IP'den çok hesap açar; canlıda sınır saatte 10
  if (!rateLimit('reg:' + (await clientIp()), process.env.DGFIT_TEST_HOOKS === '1' ? 200 : 10, 60 * 60 * 1000)) {
    return { errors: { form: 'Çok fazla deneme yapıldı. Biraz sonra tekrar dene.' }, values }
  }

  const taken = await db.execute<{ u: boolean; e: boolean }>(sql`
    select exists(select 1 from users where lower(username) = lower(${username})) as u,
           exists(select 1 from users where lower(email) = lower(${email})) as e`)
  const t = taken[0]
  if (t?.u) errors.username = 'Bu kullanıcı adı alınmış'
  if (t?.e) errors.email = 'Bu e-posta ile zaten bir hesap var'
  if (Object.keys(errors).length) return { errors, values }

  // Davet kodu: geçerliyse hesap onaylı açılır; kod yazılmış ama geçersizse kullanıcıya söylenir
  let invite: string | null = null
  if (inviteIn) {
    const [inv] = await db.select().from(schema.invites).where(eq(schema.invites.code, inviteIn)).limit(1)
    if (!inviteUsable(inv, new Date())) return { errors: { invite: 'Bu davet kodu geçersiz ya da süresi dolmuş. Kodu silip davetsiz de kayıt olabilirsin.' }, values }
    invite = inviteIn
  }

  const passwordHash = await hashPassword(password)
  let userId: string
  const status = invite || isAdmin(username) ? 'approved' : 'pending'
  try {
    userId = await db.transaction(async (tx) => {
      if (invite) {
        // Kullanım sayısı yarışa karşı koşullu artırılır
        const ok = await tx.execute(sql`update invites set uses = uses + 1 where code = ${invite} and not disabled
          and (max_uses is null or uses < max_uses) and (expires_at is null or expires_at > now()) returning code`)
        if (!ok.length) throw new Error('davet')
      }
      const [u] = await tx.insert(schema.users).values({ username, email, passwordHash, status, statusAt: new Date(), statusBy: invite ? 'davet' : null, inviteCode: invite }).returning({ id: schema.users.id })
      return u.id
    })
  } catch (e) {
    if ((e as Error).message === 'davet') return { errors: { invite: 'Bu davet kodunun kullanım hakkı az önce doldu.' }, values }
    return { errors: { form: 'Hesap oluşturulamadı, bu kullanıcı adı veya e-posta kullanımda olabilir.' }, values }
  }
  await createSession(userId)
  if (status === 'pending') {
    await notifyAdmins({ title: 'Yeni kayıt onay bekliyor', body: `@${username} uygulamaya girmek için onayını bekliyor.`, url: '/yonetim/kullanicilar?durum=pending', tag: 'admin-pending' })
    redirect('/beklemede')
  }
  redirect('/kurulum')
}

export async function loginAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const login = String(fd.get('login') ?? '').trim()
  const password = String(fd.get('password') ?? '')
  const values = { login }
  if (login.length > 254 || password.length > 1024) return { errors: { form: 'Kullanıcı adı/e-posta veya şifre hatalı' }, values: { login: login.slice(0, 64) } }
  if (!login || !password) return { errors: { form: 'Kullanıcı adı/e-posta ve şifre gerekli' }, values }

  const ip = await clientIp()
  // kullanıcı başına sınır IP ile birlikte anahtarlanır: üçüncü kişi başkasının hesabını kilitleyemez
  if (!rateLimit('login:' + ip, 20) || !rateLimit('login-u:' + ip + ':' + login.toLowerCase().slice(0, 64), 8)) {
    return { errors: { form: 'Çok fazla hatalı deneme. 10 dakika sonra tekrar dene.' }, values }
  }

  const rows = await db.execute<{ id: string; username: string; status: string; password_hash: string }>(sql`
    select id, username, status, password_hash from users where lower(username) = lower(${login}) or lower(email) = lower(${login}) limit 1`)
  const u = rows[0]
  const ok = u ? await verifyPassword(password, u.password_hash) : false
  if (!u || !ok) return { errors: { form: 'Kullanıcı adı/e-posta veya şifre hatalı' }, values }
  await createSession(u.id)
  redirect(canEnter(u.status, isAdmin(u.username)) ? '/' : '/beklemede')
}

export async function logoutAction() {
  await destroySession()
  redirect('/giris')
}
