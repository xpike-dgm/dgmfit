'use client'
import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { saveReminderSettings } from '../actions'

type Status = 'checking' | 'unsupported' | 'ios-install' | 'denied' | 'off' | 'on'
const input = 'h-11 rounded-xl bg-surface-2 border border-line px-3 num text-ink outline-none focus:border-water'

function b64ToUint8(b64: string) {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4)
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(raw, (c) => c.charCodeAt(0))
}
const hm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
const toMin = (s: string) => { const [h, m] = s.split(':').map(Number); return h * 60 + m }

export default function PushSettings(props: { enabled: boolean; summaryEnabled: boolean; maxPerDay: number; quiet: [number, number][] }) {
  const router = useRouter()
  const [status, setStatus] = useState<Status>('checking')
  const [summary, setSummary] = useState(props.summaryEnabled)
  const [max, setMax] = useState(props.maxPerDay)
  const [quietOn, setQuietOn] = useState(props.quiet.length > 0)
  const [qs, setQs] = useState(props.quiet[0] ? hm(props.quiet[0][0]) : '12:30')
  const [qe, setQe] = useState(props.quiet[0] ? hm(props.quiet[0][1]) : '13:30')
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [pending, start] = useTransition()

  useEffect(() => {
    (async () => {
      const ios = /iphone|ipad|ipod/i.test(navigator.userAgent)
      const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true
      if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) { setStatus(ios && !standalone ? 'ios-install' : 'unsupported'); return }
      if (ios && !standalone) { setStatus('ios-install'); return }
      if (Notification.permission === 'denied') { setStatus('denied'); return }
      const reg = await navigator.serviceWorker.getRegistration()
      const sub = await reg?.pushManager.getSubscription()
      setStatus(sub && props.enabled ? 'on' : 'off')
    })().catch(() => setStatus('unsupported'))
  }, [props.enabled])

  const settings = (enabled: boolean) => ({ enabled, summaryEnabled: summary, maxPerDay: max, quiet: quietOn ? [[toMin(qs), toMin(qe)] as [number, number]] : [] })

  const enable = () => start(async () => {
    setMsg(null)
    try {
      const perm = await Notification.requestPermission()
      if (perm !== 'granted') { setStatus(perm === 'denied' ? 'denied' : 'off'); return }
      const reg = (await navigator.serviceWorker.getRegistration()) ?? (await navigator.serviceWorker.register('/sw.js'))
      await navigator.serviceWorker.ready
      const { publicKey } = await (await fetch('/api/push/key')).json()
      const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToUint8(publicKey) }))
      const r = await fetch('/api/push/subscribe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(sub.toJSON()) })
      if (!r.ok) throw new Error('kayıt başarısız')
      await saveReminderSettings(settings(true))
      setStatus('on'); setMsg({ ok: true, text: 'Hatırlatmalar açıldı.' }); router.refresh()
    } catch (e) {
      setMsg({ ok: false, text: 'Bildirim aboneliği oluşturulamadı: ' + (e instanceof Error ? e.message : 'bilinmeyen hata') })
    }
  })

  const disable = () => start(async () => {
    const reg = await navigator.serviceWorker.getRegistration()
    const sub = await reg?.pushManager.getSubscription()
    if (sub) { await fetch('/api/push/unsubscribe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ endpoint: sub.endpoint }) }); await sub.unsubscribe() }
    await saveReminderSettings(settings(false))
    setStatus('off'); setMsg({ ok: true, text: 'Hatırlatmalar kapatıldı.' }); router.refresh()
  })

  const save = () => start(async () => {
    const r = await saveReminderSettings(settings(status === 'on'))
    setMsg(r.ok ? { ok: true, text: 'Kaydedildi' } : { ok: false, text: r.error })
  })

  const test = () => start(async () => {
    const r = await fetch('/api/push/test', { method: 'POST' })
    const j = await r.json().catch(() => ({}))
    setMsg(j.ok ? { ok: true, text: 'Test bildirimi gönderildi.' } : { ok: false, text: j.error ?? 'Bildirim gönderilemedi. Aboneliği kapatıp yeniden açmayı dene.' })
  })

  return (
    <section id="bildirim" aria-labelledby="h-n" className="card p-5 flex flex-col gap-3 scroll-mt-4">
      <h2 id="h-n" className="font-extrabold">Akıllı hatırlatmalar</h2>
      <p className="text-sm text-ink-2 leading-relaxed">Sabit saatlerde değil, içme düzenine göre hatırlatır: geride kalınca biraz sıklaşır, su içince bir sonrakini erteler, yok saydığın saatlerde azalır. Günde en fazla {max} bildirim.</p>

      {status === 'checking' ? <p className="text-sm text-mute">Kontrol ediliyor…</p> : null}
      {status === 'unsupported' ? <p className="text-sm text-orange">Bu tarayıcı bildirimleri desteklemiyor. Chrome (Android) veya ana ekrana eklenmiş DgFit (iOS 16.4+) kullan.</p> : null}
      {status === 'ios-install' ? (
        <div className="rounded-2xl bg-surface-2 p-4 text-sm leading-relaxed text-ink-2 flex flex-col gap-1.5">
          <b className="text-ink">iPhone'da bildirim için DgFit'i ana ekrana ekle:</b>
          <span>1. Safari'de alttaki Paylaş düğmesine dokun.</span>
          <span>2. "Ana Ekrana Ekle"yi seç.</span>
          <span>3. Ana ekrandaki DgFit'i açıp bu sayfaya geri dön.</span>
        </div>
      ) : null}
      {status === 'denied' ? <p className="text-sm text-orange">Bildirim izni reddedilmiş. Tarayıcı veya telefon ayarlarından DgFit için bildirimlere izin ver.</p> : null}

      {status === 'off' ? <button type="button" disabled={pending} onClick={enable} className="h-12 rounded-full bg-water text-water-ink font-extrabold">Hatırlatmaları aç</button> : null}
      {status === 'on' ? (
        <div className="flex gap-2">
          <button type="button" disabled={pending} onClick={test} className="flex-1 h-12 rounded-full bg-water text-water-ink font-extrabold">Test bildirimi</button>
          <button type="button" disabled={pending} onClick={disable} className="h-12 px-5 rounded-full border border-line-2 font-bold">Kapat</button>
        </div>
      ) : null}

      <div className="flex flex-col gap-3 pt-2 border-t border-surface-2">
        <label className="flex items-center justify-between min-h-11 cursor-pointer">
          <span className="text-sm">Gün sonu özeti (uykudan 1 saat önce)</span>
          <input type="checkbox" checked={summary} onChange={(e) => setSummary(e.target.checked)} className="w-6 h-6" />
        </label>
        <div className="flex items-center justify-between gap-3">
          <label htmlFor="maxpd" className="text-sm">Günlük en fazla bildirim</label>
          <select id="maxpd" value={max} onChange={(e) => setMax(Number(e.target.value))} className={input}>
            {[4, 6, 8, 10, 12].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
        <label className="flex items-center justify-between min-h-11 cursor-pointer">
          <span className="text-sm">Sessiz saat aralığı</span>
          <input type="checkbox" checked={quietOn} onChange={(e) => setQuietOn(e.target.checked)} className="w-6 h-6" />
        </label>
        {quietOn ? (
          <div className="flex items-center gap-2">
            <label htmlFor="qs" className="sr-only">Sessiz başlangıç</label>
            <input id="qs" type="time" value={qs} onChange={(e) => setQs(e.target.value)} className={input + ' flex-1'} />
            <span className="text-mute">–</span>
            <label htmlFor="qe" className="sr-only">Sessiz bitiş</label>
            <input id="qe" type="time" value={qe} onChange={(e) => setQe(e.target.value)} className={input + ' flex-1'} />
          </div>
        ) : null}
        <p className="text-xs text-mute">Uyku saatlerinde (profilindeki uyanış–uyku aralığı dışında) hiçbir zaman bildirim gönderilmez.</p>
        <button type="button" disabled={pending} onClick={save} className="h-11 rounded-full border border-line-2 font-bold text-sm">Bildirim ayarlarını kaydet</button>
      </div>
      {msg ? <p role="status" className={`text-sm font-semibold ${msg.ok ? 'text-acc' : 'text-danger'}`}>{msg.text}</p> : null}
    </section>
  )
}
