// Next.js sunucusu açılırken bir kez çalışır. Hatırlatma zamanlayıcısını yalnızca Node çalışma ortamında başlatır.
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs' && process.env.DGFIT_SCHEDULER !== 'off') {
    const { startScheduler } = await import('./lib/scheduler')
    startScheduler()
  }
}
