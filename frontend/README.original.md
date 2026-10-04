# NammaRoute

Frontend-only prototype for hackathon PS03 (Unified Urban Public Transport Platform): a Chennai multimodal journey planner combining bus, Metro, suburban rail, walking and last-mile transport.

**All routes, fares, times, accessibility details and service alerts are generated demo data. Nothing is live.**

## Run

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # typecheck + production build
npm run lint
```

Optional map key: copy `.env.example` to `.env` and set `VITE_MAPTILER_KEY`. Without it the map uses free OpenStreetMap / Esri imagery tiles (Standard, Satellite, Hybrid still work).

## Architecture

- `src/types` domain models (Location, Journey, JourneySegment, AccessibilityInfo, UserPreferences, ...)
- `src/data` Chennai locations and the mock journey generator
- `src/services` interfaces + implementations. Replace these to go live:
  - `routingService` (mock) -> OpenTripPlanner / OpenRouteService
  - `savedPlacesService`, `historyService`, `preferencesService` (localStorage) -> Supabase
  - `mapConfigService` (fallback tiles) -> MapTiler
- `src/utils/routeRanking.ts` deterministic weighted ranking (no AI)
- `src/context` preferences and journey state; `src/pages` the six screens

Routing uses HashRouter so static hosting needs no redirect rules.

## Upgrade notes

- Ranking: budget ceiling (in-budget routes first), transfer-risk penalty, stable tie-breaks (`utils/routeRanking.ts`, `utils/exposure.ts`).
- English/Tamil UI via `src/i18n` (language switch in Profile); Senior mode preset; spoken guidance during live journeys.
- Voice: `services/voiceService.ts` (Web Speech API) + rule-based `utils/voiceCommand.ts`, e.g. "from Tambaram to Chennai Central, cheapest under 40".
- Live journey: "I missed my stop" raises an alert and offers a demo reroute. Last search results are cached for offline (`services/offlineCache.ts`).
- Combine options: pick several priorities (Home → Combine options); ranking blends their weights and each route card lists the measured value for every chosen option (`components/results/PriorityParams.tsx`).
- Map: Google-style route bubbles (mode, time, distance), clickable alternatives, origin/destination pins, "search along the route" places (`services/poiService.ts`, demo data), live position dot.
- Live journey: demo voice navigation (auto-advancing, spoken, voice commands "next / repeat / missed / reroute / stop"), vibration + alert tone (`services/hapticService.ts`).

- Voice: `public/voice.js` (drop-in STT/TTS, loaded as a plain script) powers `services/voiceService.ts`: live transcript + cancel on Home, and hands-free "Hey Namma <next|repeat|missed|reroute|stop>" in Live Journey. Needs HTTPS or localhost, and Chrome/Edge/Safari.

## v2: accounts, last-mile rides, comfortable routes, Guardian Mode

Run both halves: `cp .env.example .env`, then `npm run dev:all` (web on :5173, API on :8787, `/api` proxied). Production: `npm run build && npm start` (needs `SESSION_SECRET`). Tests: `npm test`.

| Feature | What is real | Needs credentials / not connected |
| --- | --- | --- |
| Login | Email+password (scrypt), revocable server-side sessions in httpOnly SameSite cookies, logout, protected routes (`/saved`, `/tickets`, `/guardian`) | Google OAuth: `GOOGLE_CLIENT_ID/SECRET`. Mobile OTP: Twilio Verify (`TWILIO_*`). `AUTH_DEV_OTP=true` prints codes to the server console, development only |
| Last-mile rides | Road distance/time (OSRM); Uber fares/ETAs via `UBER_SERVER_TOKEN`; deep links for Uber, Ola, Rapido, Namma Yatri | Ola, Rapido, Namma Yatri show "Fare in app" and are never ranked. Cheapest/Fastest/Best value use API-priced options only |
| Public transport | `OTP_URL` (OpenTripPlanner 2.x + a GTFS feed you may use) gives live Metro/bus/rail plans; official CMRL link; optional `CHENNAI_ONE_URL` | Without `OTP_URL`, the original demo journeys remain, labelled DEMO DATA. No public live API exists for Chennai Metro or MTC |
| Comfortable / Balanced | OSM surface, smoothness, steps, construction, speed-bump tags (Overpass) + in-app community reports | No live pothole/closure feed; no satellite inference. Thin coverage is flagged "limited"; with no data, ranking falls back to standard routing |
| Guardian Mode | Contact, big-button/high-contrast UI, SOS (5 s cancel window, server alert, `sms:`/`tel:` fallback, 112), live-location link page, start/end/deviation/inactivity events | Automatic SMS: Twilio Messaging (`TWILIO_FROM_NUMBER`). Deviation alerts arm only for planner-backed journeys (demo routes aren't real roads) |

The JSON-file store (`server/store.ts`) is single-process; use Postgres to scale out. Browsers can't track location reliably with the screen off, so Guardian Mode asks users to keep the app open. Verify the Ola deep-link format against Ola's current docs before launch.
