# NammaRoute

```
namma-route/
  frontend/   React + Vite app (planner, comfortable routes, last-mile rides, Guardian UI)
  backend/    Node + Express API (login, OTP, Google OAuth, guardian/SOS, rides, transit, road reports)
  package.json  convenience scripts that run both
```

## Quick start (account login + Guardian Mode)

```bash
npm run install:all                 # installs root, backend and frontend
cp backend/.env.example backend/.env   # Windows: copy backend\.env.example backend\.env  (optional in dev)
npm run dev                         # API on :8787, web on http://localhost:5173
```

Or run them separately: `cd backend && npm run dev` and `cd frontend && npm run dev`.

**Log in:** Profile → Sign in. Email: choose Email → Create an account. Mobile OTP: enter a number, then read the 6-digit code from the `[api]` terminal line starting `[dev-otp]` (no SMS is sent in dev).
**Guardian Mode:** Profile → Guardian Mode (or the Guardian tab) → save your guardian's name and number → switch it on. The red SOS button then shows on every screen.

## Commands
| Where | Command | What |
| --- | --- | --- |
| root | `npm run dev` / `npm test` / `npm run build` / `npm start` | both apps / all tests / typecheck + build / production API (serves `frontend/dist`) |
| backend | `npm run dev`, `npm test`, `npm run typecheck` | |
| frontend | `npm run dev`, `npm test`, `npm run build`, `npm run lint` | |

Production: `npm run build`, set `SESSION_SECRET` (32+ chars) in `backend/.env`, then `npm start`.

## Configuration (`backend/.env`, see `.env.example`)
| Feature | Works out of the box | Needs credentials |
| --- | --- | --- |
| Email login, sessions, logout, protected routes | yes | none |
| Mobile OTP | dev mode only (`AUTH_DEV_OTP=true`) | Twilio Verify (`TWILIO_*`) for real SMS |
| Google login | no | `GOOGLE_CLIENT_ID/SECRET`; redirect URI `http://localhost:5173/api/auth/google/callback` |
| Guardian: contact, SOS screen, live-location link, start/end/deviation/inactivity events | yes | Twilio Messaging (`TWILIO_FROM_NUMBER`) for automatic SMS; without it SOS opens the phone's own SMS/call apps |
| Ride comparison | deep links only (no prices) | `UBER_SERVER_TOKEN` for Uber fares/ETAs. Ola, Rapido, Namma Yatri never show prices |
| Live public transport | demo journeys, labelled DEMO DATA | `OTP_URL` (OpenTripPlanner + a GTFS feed you may use) |
| Comfortable / Balanced routes | OSM road tags + in-app reports | none; no live pothole feed, thin coverage is flagged "limited" |

`frontend/.env.example` has optional map and API-origin settings. The backend keeps a copy of the shared domain types in `backend/src/types.ts` (types only), so the two folders are fully independent.

Notes: data is stored in `backend/data/db.json` (single process; use Postgres to scale). Browsers can't track location with the screen off, so Guardian Mode asks users to keep the app open. Deviation alerts arm only for live-planner journeys. Verify the Ola deep-link format against Ola's docs before launch.

The original project README is preserved in `frontend/README.original.md`.
