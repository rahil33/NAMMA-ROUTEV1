// All secrets and provider keys come from the environment (see .env.example).
// Nothing here has a hard-coded credential; absent keys simply disable that provider.
import { fileURLToPath } from 'node:url'

const env = process.env

/** Path relative to this file, valid on Windows too (URL.pathname gives '/C:/...' there). */
export const fromHere = (rel: string, base: string | URL = import.meta.url): string => fileURLToPath(new URL(rel, base))

export const isProd = env.NODE_ENV === 'production'

function secret(): string {
  const s = env.SESSION_SECRET
  if (s && s.length >= 32) return s
  if (isProd) throw new Error('SESSION_SECRET (>= 32 chars) is required in production')
  // Development only: a per-process secret, so sessions reset on restart.
  return 'dev-only-' + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2) + 'x'.repeat(16)
}

export const config = {
  port: Number(env.PORT || 8787),
  publicUrl: (env.PUBLIC_URL || `http://localhost:${env.PORT || 8787}`).replace(/\/$/, ''),
  /** Where the browser app lives (Vite dev server in development). Used for OAuth redirects. */
  appUrl: (env.APP_URL || env.PUBLIC_URL || 'http://localhost:5173').replace(/\/$/, ''),
  sessionSecret: secret(),
  sessionDays: Number(env.SESSION_DAYS || 30),
  dataDir: env.DATA_DIR || fromHere('../data'),

  google: { clientId: env.GOOGLE_CLIENT_ID || '', clientSecret: env.GOOGLE_CLIENT_SECRET || '' },
  twilio: {
    accountSid: env.TWILIO_ACCOUNT_SID || '',
    authToken: env.TWILIO_AUTH_TOKEN || '',
    verifyServiceSid: env.TWILIO_VERIFY_SERVICE_SID || '',
    fromNumber: env.TWILIO_FROM_NUMBER || '',
  },
  /** Development convenience (on unless AUTH_DEV_OTP=false): print OTPs to the server console. Never active in production. */
  devOtp: !isProd && env.AUTH_DEV_OTP !== 'false',

  uberServerToken: env.UBER_SERVER_TOKEN || '',
  /** Optional OpenTripPlanner 2.x base URL, e.g. https://otp.example.org */
  otpUrl: (env.OTP_URL || '').replace(/\/$/, ''),
  osrmUrl: (env.OSRM_URL || 'https://routing.openstreetmap.de/routed-car').replace(/\/$/, ''),
  /** Built frontend, served by the API in production. */
  frontendDist: env.FRONTEND_DIST || fromHere('../../frontend/dist'),
  chennaiOneUrl: env.CHENNAI_ONE_URL || '',
}

export const googleEnabled = () => Boolean(config.google.clientId && config.google.clientSecret)
export const twilioVerifyEnabled = () =>
  Boolean(config.twilio.accountSid && config.twilio.authToken && config.twilio.verifyServiceSid)
export const smsEnabled = () =>
  Boolean(config.twilio.accountSid && config.twilio.authToken && config.twilio.fromNumber)
export const otpMode = (): 'twilio' | 'dev' | 'off' => (twilioVerifyEnabled() ? 'twilio' : config.devOtp ? 'dev' : 'off')
