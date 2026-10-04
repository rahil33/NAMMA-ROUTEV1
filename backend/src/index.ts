import { createApp } from './app.ts'
import { config, googleEnabled, isProd, otpMode, smsEnabled } from './config.ts'
import { flushDb, loadDb } from './store.ts'

loadDb()
const app = createApp()
const server = app.listen(config.port, () => {
  console.log(`NammaRoute API on :${config.port} (${isProd ? 'production' : 'development'})`)
  console.log(`  google oauth: ${googleEnabled() ? 'on' : 'off'} | otp: ${otpMode()} | guardian sms: ${smsEnabled() ? 'on' : 'off'}`)
})
for (const sig of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sig, () => {
    flushDb()
    server.close(() => process.exit(0))
  })
}
