'use client'
import { useActionState, useState } from 'react'
import Link from 'next/link'
import { loginAction, type FormState } from '../actions'
import { btn, FieldError } from '@/components/ui'
import { Eye, EyeOff } from '@/components/icons'

const input =
  'w-full h-14 rounded-2xl bg-surface border border-line px-4 text-[16px] text-ink placeholder:text-faint outline-none focus:border-lime transition'

export default function LoginForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(loginAction, {})
  const [show, setShow] = useState(false)
  return (
    <form action={action} className="flex flex-col gap-5">
      <div>
        <label htmlFor="login" className="block text-sm font-bold mb-2">Kullanıcı adı veya e-posta</label>
        <input id="login" name="login" className={input} autoComplete="username" autoCapitalize="none" spellCheck={false}
          defaultValue={state.values?.login} required />
      </div>
      <div>
        <label htmlFor="password" className="block text-sm font-bold mb-2">Şifre</label>
        <div className="relative">
          <input id="password" name="password" type={show ? 'text' : 'password'} className={input + ' pr-14'} autoComplete="current-password" required />
          <button type="button" onClick={() => setShow(!show)} aria-label={show ? 'Şifreyi gizle' : 'Şifreyi göster'}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 w-11 h-11 flex items-center justify-center text-mute">
            {show ? <EyeOff size={20} /> : <Eye size={20} />}
          </button>
        </div>
      </div>
      <FieldError>{state.errors?.form}</FieldError>
      <button type="submit" className={btn.primary + ' mt-1'} disabled={pending}>{pending ? 'Giriş yapılıyor…' : 'Giriş yap'}</button>
      <p className="text-center text-sm text-mute">Hesabın yok mu? <Link href="/kayit" className="text-lime font-bold">Hemen oluştur</Link></p>
    </form>
  )
}
