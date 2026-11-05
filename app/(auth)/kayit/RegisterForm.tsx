'use client'
import { useActionState, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import Sheet from '@/components/Sheet'
import { KvkkText, TermsText, legalProse } from '@/components/legal'
import { registerAction, type FormState } from '../actions'
import { btn, FieldError } from '@/components/ui'
import { Check, Eye, EyeOff } from '@/components/icons'
import { checkPassword, emailError, emailSuggestion, usernameError } from '@/lib/validation'

const input =
  'w-full h-14 rounded-2xl bg-surface border border-line px-4 text-[16px] text-ink placeholder:text-faint outline-none focus:border-acc transition'

const DRAFT = 'dgfit:kayit:v1'

export default function RegisterForm({ invite = '' }: { invite?: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(registerAction, {})
  const [username, setUsername] = useState(state.values?.username ?? '')
  const [email, setEmail] = useState(state.values?.email ?? '')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [show, setShow] = useState(false)
  const [terms, setTerms] = useState(false)
  const [doc, setDoc] = useState<null | 'terms' | 'kvkk'>(null)
  const [code, setCode] = useState(state.values?.invite ?? invite)
  const [showCode, setShowCode] = useState(!!(state.values?.invite ?? invite))
  // Taslak: kullanıcı adı, e-posta ve onay oturum boyunca saklanır (şifreler asla saklanmaz)
  useEffect(() => {
    try {
      const d = JSON.parse(sessionStorage.getItem(DRAFT) ?? 'null') as { username?: string; email?: string; terms?: boolean } | null
      if (d && !state.values) { if (d.username) setUsername(d.username); if (d.email) setEmail(d.email); if (d.terms) setTerms(true) }
    } catch { /* yok */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => {
    try { sessionStorage.setItem(DRAFT, JSON.stringify({ username, email, terms })) } catch { /* yok */ }
  }, [username, email, terms])
  const [uCheck, setUCheck] = useState<{ available?: boolean; suggestions: string[]; loading?: boolean }>({ suggestions: [] })

  useEffect(() => {
    if (usernameError(username)) { setUCheck({ suggestions: [] }); return }
    setUCheck((s) => ({ ...s, loading: true }))
    const ctl = new AbortController()
    const t = setTimeout(async () => {
      try {
        const r = await fetch('/api/auth/username?u=' + encodeURIComponent(username), { signal: ctl.signal })
        const j = await r.json()
        setUCheck({ available: j.available, suggestions: j.suggestions ?? [] })
      } catch { /* iptal */ }
    }, 350)
    return () => { clearTimeout(t); ctl.abort() }
  }, [username])

  const pw = useMemo(() => checkPassword(password), [password])
  const suggestion = useMemo(() => emailSuggestion(email), [email])
  const uErr = username ? usernameError(username) : null
  const eErr = email && email.includes('@') && email.split('@')[1]?.includes('.') ? emailError(email) : null
  const matches = confirm.length > 0 && confirm === password
  const canSubmit = !usernameError(username) && uCheck.available !== false && !emailError(email) && pw.ok && matches && terms
  const strength = ['Çok zayıf', 'Zayıf', 'Orta', 'İyi', 'Güçlü'][pw.score]
  const strengthColor = ['var(--color-danger)', 'var(--color-danger)', 'var(--color-orange)', 'var(--color-good)', 'var(--color-good)'][pw.score]

  return (
    <form action={action} onSubmit={() => { try { sessionStorage.removeItem(DRAFT) } catch { /* yok */ } }} className="flex flex-col gap-5" noValidate>
      <div>
        <label htmlFor="username" className="block text-sm font-bold mb-2">Kullanıcı adı</label>
        <div className="relative">
          <input id="username" name="username" className={input} autoComplete="username" autoCapitalize="none" spellCheck={false}
            placeholder="ornek: cihad.fit" value={username} onChange={(e) => setUsername(e.target.value)} maxLength={20} />
          {uCheck.available && !uErr ? <span className="absolute right-4 top-1/2 -translate-y-1/2 text-acc" aria-label="Kullanılabilir"><Check size={20} /></span> : null}
        </div>
        <FieldError>{state.errors?.username ?? uErr ?? (uCheck.available === false ? 'Bu kullanıcı adı alınmış' : null)}</FieldError>
        {uCheck.available === false && uCheck.suggestions.length ? (
          <div className="flex flex-wrap gap-2 mt-2">
            {uCheck.suggestions.map((s) => (
              <button type="button" key={s} onClick={() => setUsername(s)} className="h-9 px-3 rounded-full bg-surface-2 text-sm font-semibold text-ink-2">{s}</button>
            ))}
          </div>
        ) : null}
      </div>

      <div>
        <label htmlFor="email" className="block text-sm font-bold mb-2">E-posta</label>
        <input id="email" name="email" type="email" inputMode="email" className={input} autoComplete="email" autoCapitalize="none"
          spellCheck={false} placeholder="sen@ornek.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        {suggestion ? (
          <button type="button" onClick={() => setEmail(suggestion)} className="mt-2 text-[13px] text-ink-2">
            Bunu mu demek istedin? <b className="text-acc">{suggestion}</b>
          </button>
        ) : null}
        <FieldError>{state.errors?.email ?? eErr}</FieldError>
      </div>

      <div>
        <label htmlFor="password" className="block text-sm font-bold mb-2">Şifre</label>
        <div className="relative">
          <input id="password" name="password" type={show ? 'text' : 'password'} className={input + ' pr-14'} autoComplete="new-password"
            value={password} onChange={(e) => setPassword(e.target.value)} />
          <button type="button" onClick={() => setShow(!show)} aria-label={show ? 'Şifreyi gizle' : 'Şifreyi göster'}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 w-11 h-11 flex items-center justify-center text-mute">
            {show ? <EyeOff size={20} /> : <Eye size={20} />}
          </button>
        </div>
        {password ? (
          <div className="mt-2.5 flex flex-col gap-1.5">
            <div className="grid grid-cols-4 gap-1.5" aria-hidden>
              {[1, 2, 3, 4].map((i) => <span key={i} className="h-1.5 rounded-full" style={{ background: pw.score >= i ? strengthColor : 'var(--color-surface-3)' }} />)}
            </div>
            <span className="text-[13px] text-mute">Şifre gücü: <b style={{ color: strengthColor }}>{strength}</b>{pw.issues.length ? ` · Eksik: ${pw.issues.join(', ')}` : ''}</span>
          </div>
        ) : <p className="mt-2 text-[13px] text-mute">En az 8 karakter; büyük harf, küçük harf ve rakam.</p>}
        <FieldError>{state.errors?.password}</FieldError>
      </div>

      <div>
        <label htmlFor="confirm" className="block text-sm font-bold mb-2">Şifre tekrarı</label>
        <div className="relative">
          <input id="confirm" name="confirm" type={show ? 'text' : 'password'} className={input} autoComplete="new-password"
            value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          {matches ? <span className="absolute right-4 top-1/2 -translate-y-1/2 text-acc" aria-label="Şifreler eşleşiyor"><Check size={20} /></span> : null}
        </div>
        <FieldError>{state.errors?.confirm ?? (confirm && !matches && confirm.length >= password.length ? 'Şifreler eşleşmiyor' : null)}</FieldError>
      </div>

      <label className="flex gap-3 items-start cursor-pointer">
        <input type="checkbox" name="terms" checked={terms} onChange={(e) => setTerms(e.target.checked)} className="mt-0.5 w-6 h-6 shrink-0" />
        <span className="text-sm leading-relaxed text-ink-2">
          <button type="button" onClick={(e) => { e.preventDefault(); setDoc('terms') }} className="text-acc font-bold">Kullanım koşullarını</button> ve{' '}
          <button type="button" onClick={(e) => { e.preventDefault(); setDoc('kvkk') }} className="text-acc font-bold">KVKK aydınlatma metnini</button> okudum, sağlık verilerimin işlenmesine açık rıza veriyorum.
        </span>
      </label>
      <FieldError>{state.errors?.terms}</FieldError>
      {showCode ? (
        <div>
          <label htmlFor="invite" className="block text-[14px] font-bold mb-2">Davet kodu</label>
          <input id="invite" name="invite" className={input + ' uppercase tracking-[0.12em] num'} autoCapitalize="characters" autoComplete="off" spellCheck={false}
            value={code} onChange={(e) => setCode(e.target.value)} placeholder="ÖRN. K7M2-PQ9X" />
          <p className="text-[12.5px] text-mute mt-1.5">Geçerli bir davet koduyla hesabın onay beklemeden açılır.</p>
          <FieldError>{state.errors?.invite}</FieldError>
        </div>
      ) : (
        <button type="button" onClick={() => setShowCode(true)} className="self-start text-[14px] font-bold text-acc -mt-1">Davet kodum var</button>
      )}
      <Sheet open={doc !== null} onClose={() => setDoc(null)} title={doc === 'kvkk' ? 'KVKK aydınlatma metni' : 'Kullanım koşulları'}>
        <article className={`${legalProse} pb-4 [&_h1]:hidden`}>{doc === 'kvkk' ? <KvkkText /> : <TermsText />}</article>
        <button type="button" className={btn.primary + ' w-full mb-4'} onClick={() => setDoc(null)}>Kayda dön</button>
      </Sheet>
      <FieldError>{state.errors?.form}</FieldError>

      <button type="submit" className={btn.primary + ' mt-2'} disabled={!canSubmit || pending}>
        {pending ? 'Hesap oluşturuluyor…' : 'Hesabı oluştur'}
      </button>
      <p className="text-center text-sm text-mute">Zaten hesabın var mı? <Link href="/giris" className="text-acc font-bold">Giriş yap</Link></p>
    </form>
  )
}
