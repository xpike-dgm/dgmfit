// Push abonelik adresi doğrulaması (saf, testli). web-push bu adrese POST atar; rastgele adres kör SSRF olur.
// Yalnızca https, varsayılan port, kimlik bilgisiz ve bilinen push servisi ana makineleri kabul edilir.
const SUFFIXES = ['.push.services.mozilla.com', '.push.apple.com', '.notify.windows.com']
const EXACT = ['fcm.googleapis.com', 'updates.push.services.mozilla.com', 'web.push.apple.com']

export function isAllowedPushEndpoint(raw: string): boolean {
  let u: URL
  try { u = new URL(raw) } catch { return false }
  if (u.protocol !== 'https:' || u.port !== '' || u.username || u.password) return false
  const h = u.hostname.toLowerCase()
  if (h.endsWith('.')) return false
  if (EXACT.includes(h)) return true
  return SUFFIXES.some((s) => h.endsWith(s) && h.length > s.length)
}
