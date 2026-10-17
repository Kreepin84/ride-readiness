# Ride Readiness

Personal training dashboard for Ryan — a single-page app that pulls Strava rides and
overnight sleep/HR into Supabase, scores daily readiness, and prescribes the day's session
against a rotating shift roster.

## Athlete profile

Numbers that shape nearly every answer about training. These are the measured values —
prefer them over anything an app estimates.

- **FTP 295–297W.** 297W is a real measured hour (5 Oct, outdoor, Fernleigh). Treat that as
  the reference. Zwift and Garmin periodically offer a higher FTP off a short effort — those
  are model extrapolations from the 5-minute end of the power curve, not threshold
  measurements. Don't change zones on one.
- **VT1 175W / ~120bpm**, **FatMax ~125W**, **VO2max ~60** (lab CPET, plus Garmin estimate).
- **Weight ~81–83kg.** Zwift weight must be correct — a wrong value invalidates a race result.
- **Z2 target 150–175W** for long rides, not the full zone up to 221W. The top of Z2 sits on
  VT1 and that band is already overloaded; low aerobic is the underfed one.
- **The gap that matters:** FatMax (125W) sits well below where he trains. Long low-aerobic
  volume is what drags it up. More hours at the wrong intensity is the recurring failure mode.
- **Races A Grade crits** — outcomes turn on repeated 30s surges, not steady-state power.
  Micro-intervals (30/15s, 40/20s) target exactly that and are a current focus.

## Roster

Rotating **16-day cycle**: 4 nightshifts → 4 off → 4 dayshifts → 4 off. Haul truck operator
(Liebherr T282), ~12h shifts, 5am starts on dayshift. Two consequences that keep coming up:

- Hard sessions and races only fit in the off blocks. A late finish before an early shift is a
  **safety** question, not just a training one.
- The first two days of the off block that follows nights are easy-only — the body is still
  catching up on sleep debt. This is encoded in `sessionForDate()`.

`rosterAnchor` in settings is the first day of a nightshift block; everything derives from it.

## Racing

- **HEZ** (Newcastle Hunter CC) and **CCCC** (Central Coast CC) both race **fortnightly on
  Sundays**. Neither is weekly, neither is Saturday.
- Schedules are generated from an anchor date + 14-day interval (`hezAnchor`, `ccccAnchor` in
  settings), not a hardcoded list. If a club's races land on the opposite Sunday to what the
  dashboard shows, shift that anchor by 7 days.
- Entries go through EntryBoss (CCCC) and Buncheur (HEZ).

## Architecture

Deliberately minimal — no build step, no framework, no package.json.

- `index.html` — the entire app. Vanilla JS in one inline `<script>`, Supabase JS client from
  CDN. Reads directly from Supabase with the publishable key.
- `api/*.js` — Vercel serverless functions for anything that **writes**. They hold
  `SUPABASE_SERVICE_ROLE_KEY` (a Vercel env var, never sent to the browser) and exist so the
  client doesn't need an open write policy.
  - `save-setting.js` — settings upsert. Accepts a batch `{settings:[{key,value},...]}`.
  - `rate-ride.js` — ride ratings.
  - `trigger-sync.js` — manual Strava sync.
- Hosted on Vercel, deploys from `main`. A cron job pulls Strava; a Tasker pipeline on the
  phone pushes sleep/HR via Health Connect.

### Supabase tables

`dashboard_settings` (key/value), `rides`, `ride_ratings`, `daily_log` (overnight sleep + HR).

## Conventions and gotchas

- **Dates are the main source of bugs here.** Sydney observes DST, so:
  - Never subtract two `Date` objects and `Math.floor()` for a day count — a DST-boundary day
    is 23 or 25 hours and the result silently loses a day. Use `dayDiff()`.
  - Never use `toISOString().slice(0,10)` for a calendar-day key — it converts to UTC first and
    rolls local midnight back to the previous date. Use `localKey()`.
  - Both helpers are in `index.html`. A past bug from exactly this shifted every roster block
    by one day and mislabelled the first day of each block.
- **Adding a setting means two edits.** The field in `FIELD_SETS` *and* the key in
  `ALLOWED_KEYS` in `api/save-setting.js`, or the save fails with "Invalid or missing key".
  Date-shaped keys also go in `NON_NUMERIC_KEYS` and `DATE_KEYS`.
- `save-setting.js` rate-limits to 20 requests per IP per 60s. Save the form as one batch; a
  request-per-field loop trips the limit and writes settings partially.
- Settings edits are destructive-ish: they write straight to Supabase with no history.

## Working on this repo

- Pushes need the Claude GitHub App installed on the repo.
- Branch from `main`, open a PR — Vercel deploys `main` automatically, so direct pushes go
  live immediately.
- There's no test suite. Verify date logic by running the function against known real dates
  (e.g. 9 Oct 2026 = Nightshift, 17 Oct = Dayshift) rather than trusting it reads correctly.
- Syntax-check `index.html` after editing by extracting the inline script and `new Function()`
  on it; there's no bundler to catch errors.

## Tone

Direct feedback, practical over theoretical. Say when a number doesn't support a conclusion.
If a training read and a health signal conflict, the health signal wins.
