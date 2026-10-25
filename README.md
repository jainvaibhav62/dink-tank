# 🥒 Dink Tank

Pickleball tournament management app — React + TypeScript + Tailwind CSS, backed by
Firebase (Auth + Firestore), deployed to GitHub Pages.

Built for clubs of ~100–200 players: Google / email sign-in, player profiles, admin
venue & tournament management, capacity-based registration with waitlists, fair fixture
generation, and **real-time live scoring** — scores and standings update instantly on
every open device via Firestore snapshot listeners.

## Pickleball scoring

Matches are played to a configurable target (**11**, 15, or 21) and must be won by a
configurable margin (**2** by default, i.e. standard "win by 2"). Both are set per
tournament when it's created. The win-by rule is enforced in three places: the score
form, the service layer (`validatePickleballScore`), and Firestore security rules (which
read the tournament doc so a crafted direct API write can't record an illegal score).

## Setup

1. Create a Firebase project → enable **Authentication → Google** (and **Email/Password**)
   sign-in, and **Firestore Database**.
2. Copy `.env.example` to `.env` and fill in your Firebase web app config values
   (Project settings → General → Your apps).
3. `npm install`
4. `npm run dev`

## Making yourself an admin

Admin access is granted manually by design. After signing in once (so your `users/{uid}`
doc exists), either:

- open the Firebase console → Firestore → `users/{your-uid}` → set `role` to `"admin"`, or
- have an existing admin promote you from **Admin → Users → (pick user) → Make admin**.

## Deploying

- **App**: push to `main` — `.github/workflows/deploy.yml` builds and deploys to GitHub
  Pages. Add your Firebase config as repository secrets (`VITE_FIREBASE_*`, matching
  `.env.example`) under **Settings → Secrets and variables → Actions**, and enable Pages
  with source **"GitHub Actions"** under **Settings → Pages**.
- **Firestore rules/indexes**: `firebase deploy --only firestore` (requires the
  [Firebase CLI](https://firebase.google.com/docs/cli), `firebase login`, `firebase use <project-id>`).
- **Cloud Functions** (email verification + hard user deletion): `firebase deploy --only functions`.
  Set `GMAIL_USER` / `GMAIL_PASSWORD` (a Gmail app password) as function env vars, or swap
  the transport in `functions/index.js`. Functions need the Blaze (pay-as-you-go) plan.

> If your GitHub repo name isn't `dink-tank`, update the `base` path in `vite.config.ts` to match.

## How it works

- **Data model** (Firestore collections): `users` / `publicProfiles`, `locations` /
  `courts`, `tournaments`, `registrations`, `matches`, `announcements`. Aggregates
  (`playerStats`, `tournamentStats`, `headToHead`) are reserved for a future Cloud
  Function; leaderboards are currently computed live from match results.
- **Fixtures** (`src/services/fixtures.ts`): Stage A builds a fair match pool (singles
  round-robin, or doubles with no repeated partners), optionally giving every player an
  exact match count. Stage B assigns matches to rounds/courts with no double-booking and a
  hard "no more than 3 rounds in a row without a rest" rule.
- **Leaderboards** (`src/services/leaderboard.ts`): pure, Firestore-free functions.
  Tournament ranking is wins → points → point-diff → head-to-head (2-way ties) → matches →
  win %. All-time is wins → win % → point-diff across published tournaments.
- **Real-time**: `subscribeTo*` service functions wrap Firestore `onSnapshot`. Live screens
  (tournament detail, admin scoring, leaderboards, landing page) re-render as data changes.

## Tech

React 19 · TypeScript · Vite · Tailwind CSS v4 · React Router (HashRouter for Pages) ·
Firebase Auth + Firestore · Firebase Cloud Functions · oxlint.
