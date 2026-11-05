/** Yönetici: sunucu ayarı DGFIT_ADMINS (virgülle kullanıcı adları; sonda "*" önek eşleşmesi, yalnızca test için). */
export function adminList(): string[] {
  return (process.env.DGFIT_ADMINS ?? '').split(',').map((s) => s.trim()).filter(Boolean)
}
export function isAdmin(username: string): boolean {
  return adminList().some((a) => (a.endsWith('*') ? process.env.DGFIT_TEST_HOOKS === '1' && username.startsWith(a.slice(0, -1)) : a === username))
}
