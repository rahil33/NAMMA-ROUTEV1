import express from 'express'
import helmet from 'helmet'
import { existsSync } from 'node:fs'
import { authRouter } from './auth.ts'
import { config, isProd } from './config.ts'
import { guardianRouter, trackRouter } from './guardian.ts'
import { originGuard } from './http.ts'
import { reportsRouter } from './reports.ts'
import { ridesRouter } from './rides.ts'
import { transitRouter } from './transit.ts'
import cors from 'cors' 

export function createApp() {
  const app = express()
  app.use(
  cors({
    origin: process.env.FRONTEND_URL,
    credentials: true,
  }),
)
  if (process.env.TRUST_PROXY) app.set('trust proxy', Number(process.env.TRUST_PROXY) || process.env.TRUST_PROXY)
  app.disable('x-powered-by')
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
          fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
          imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
          connectSrc: ["'self'", 'https:'],
          frameSrc: ["'self'", 'https://www.openstreetmap.org'],
          workerSrc: ["'self'", 'blob:'],
          frameAncestors: ["'none'"],
        },
      },
      // Geolocation, microphone (voice) and vibration are used by the app itself.
      crossOriginEmbedderPolicy: false,
    }),
  )
  app.use(express.json({ limit: '100kb' }))
  app.use('/api', originGuard)

  app.get('/api/health', (_req, res) => res.json({ ok: true }))
  app.use('/api/auth', authRouter())
  app.use('/api/rides', ridesRouter())
  app.use('/api/transit', transitRouter())
  app.use('/api/guardian', guardianRouter())
  app.use('/api/track', trackRouter())
  app.use('/api/road-reports', reportsRouter())
  app.use('/api', (_req, res) => res.status(404).json({ error: 'not_found', message: 'Unknown endpoint.' }))

  const dist = config.frontendDist
  if (isProd && existsSync(dist)) {
    app.use(express.static(dist, { maxAge: '1h', index: 'index.html' }))
  }
  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error(err)
    res.status(500).json({ error: 'server_error', message: 'Something went wrong. Please try again.' })
  })
  return app
}


