# Ride Readiness

Personal training dashboard for Ryan — a single-page app that pulls Strava rides and
overnight sleep/HR into Supabase, scores daily readiness, and prescribes the day's session
against a rotating shift roster.

## Athlete profile

Numbers that shape nearly every answer about training. These are the measured values —
prefer them over anything an app estimates.

- **FTP 328W**, **weight 82.2kg** → **3.99 W/kg** (11 Nov 2026). Garmin and Strava both
  carry 328; the dashboard does now too. Evidence runs through a 297W measured hour (5 Oct),
  a 308W measured hour in the 1 Nov CCCC crit, and the 8 Nov race. Three ride files on
  11 Nov each back out an FTP of 325–330 from their Intensity Factor, which is an
  independent confirmation.
  - The standing rule still holds: Zwift and Garmin periodically offer a higher FTP off a
    **short** effort, and those are model extrapolations from the 5-minute end of the power
    curve, not threshold measurements. Don't change zones on one. A sustained hour is
    different evidence and does justify a change.
  - **The trainer does not read high.** The 1 Nov outdoor 20-min (335W) beat the 27 Oct
    Zwift 20-min (326W) four days apart. If anything the Kickr reads low, so don't discount
    indoor numbers against outdoor ones.
  - Zwift weight must be correct — a wrong value invalidates a race result. It is currently
    right (82kg). One historical race, 2 Oct 2026, recorded 50kg and produced a nonsense
    17.3 W/kg; that was a one-off entry error, not a pattern.
- **Weight fluctuates 82–87, settling 82–84. `goalWeight` is 80** (set 11 Nov, from 75).
  - **The swing is glycogen and water, not tissue.** Each gram of muscle glycogen binds
    ~3g of water, so depleted-to-loaded is worth 1.5–2.5kg by itself; add post-effort fluid
    retention and a big eating day and 82 → 87 in 72 hours needs no change in fat or muscle.
    Never read a short-term swing as a body-composition change.
  - **80 is reachable by trimming the top of the swing, not cutting from the bottom.** He
    was 80.4kg in September with no sprint cost. Moving the average down means moderating
    the 86–87 excursions; it does not mean restricting from 82.
  - **75 was the old target and was incoherent** — 7kg below his natural range while he is
    deliberately doing leg work to build sprint mass. Don't reinstate it.
  - **He eats heavily on leg day by design**, for repair and muscle growth. That is correct
    and should not be discouraged; the magnitude of the swing is the only question.
  - **Do not help him cut weight into a race.** If "getting back down for race day" ever
    becomes active fluid or carb restriction rather than the leg-day load clearing on its
    own, say so plainly and stop: the weight lost is the glycogen a crit runs on, and with
    a raised haematocrit, deliberate dehydration concentrates an already-elevated red cell
    mass. This one overrides any performance argument.
- **VT1 is around 195–210W (26 Nov talk test). The old 175W / 120bpm is stale.** Measured
  11 Nov on a locked ERG block: 200W held for 58 min at 124.8bpm average with **0.38%
  Pw:HR decoupling**, and 225W for a further 34 min at 131.5bpm with ~1.5bpm of drift.
  Neither is a rider working above their first threshold.
  - **No VT1 number is established.** The test rules 175W out; it does not replace it.
    That needs gas exchange or a longer step protocol with lactate.
  - **26 Nov talk test (Zwift ERG, 5-min steps, cadence held ~88):** step-end HR roughly
    165W 112, 180W 114, 195W 118, 210W 122, 225W 126 — linear, no kink, as expected.
    Talk test: full sentences easy to 180W; at 195W he could talk ~15s but needed a big
    breath after; at 225W only ~9s. Best combined estimate **VT1 ≈ 195–210W, HR ~118–122**,
    which fits the clean 0.38% decoupling at 200W. "Probably above 225W" is not supported.
  - **VT2 is near 300–310W.** HR rose linearly at 2.71 bpm per 10W from 250–290W, then
    departed the fit by +3.3 at 310W and +6.0 at 329W. The deflection HR (160–168) agrees
    with the Garmin lactate-threshold HR of 168.
    - **The ramp protocol was +10W per KILOMETRE over the last 9.9km, not per minute.**
      An earlier note here called every step "1–2 min, too short for HR to plateau" and
      treated every step HR as an underestimate. That is only true of the lower half.
      The ramp climbed (+1.37% mean against −0.13% for the rest of the ride) and the
      gradient steepened to 2.8–3.5% from 310W up, which slowed him down and made the
      steps at the top **longer**: 130s at 310W, 111s at 320W, 128s at 330W, against
      86–103s below 300W. The three steps that define the deflection had the most
      settling time, so **the 300–310W figure is firmer than "soft"** — still short of a
      true 3-minute plateau, but not badly underestimated.
    - Distance-based steps on a climb self-correct, because the harder it gets the longer
      he spends there. For the retest, 1.5km steps on that same climb clear 3 minutes per
      step at the top end.
  - **Max HR is at least 177** (11 Nov, at 350W, and he stopped). True max is higher.
    Anything computing zones off an *estimated* max is using a wrong number.
  - **HR costs ~2.5 bpm per 10W and the relationship is close to linear across a wide
    range.** 2.53 bpm/10W measured on a 175→190W step (12 Nov) against 2.71 bpm/10W over
    250–290W (11 Nov) — two sessions 100W apart agreeing within 7%. Useful: his HR at any
    power between 175 and 290W is predictable to a couple of beats.
  - **Cadence costs about 4 bpm per 10 rpm** at fixed power — measured 12 Nov on 65 min
    of locked 175W ERG while cadence drifted 73→95 rpm, fitting HR against cadence *and*
    time together. Real, consistent, and still too small to manage: ride whatever cadence
    feels right.
    - **The raw correlation says 5.18 bpm/10rpm and is wrong.** Cadence rose with time and
      so does HR, so a plain cadence-vs-HR fit credits cadence with ordinary drift —
      about a quarter of the apparent effect. Always fit time alongside it.
    - An earlier figure of ~2 bpm from 85→92 rpm (r = +0.14) came from a ride where
      cadence spanned only 12 rpm. The 12 Nov measurement spans 22 rpm with power locked
      to a 6W range and supersedes it.
- **FatMax ~125W, VO2max ~60** (lab CPET, plus Garmin estimate). These are measured and do
  **not** scale with FTP — never recompute a band from a new FTP figure. **FatMax has not
  been retested** and can't be seen in HR and power; don't infer it has moved because VT1 did.
- **Long rides sit below VT1 by default (27 Nov).** All aerobic prescriptions moved from
  190–215W to **180–200W**; 200–215W is kept for the last hour of build long rides and event
  pacing. Rationale: VT1 ≈ 195–210W, and riding the low end of the zone cuts fatigue and
  recovery cost for the same aerobic stimulus (his own observation from a pro coach's podcast).
- **Two long-ride bands, because they do different jobs:**
  - **Fat oxidation: 140–170W.** Deliberately below where it feels natural. Rationale is
    FatMax at 125W sitting well below where he trains — but that rationale is an assumption
    until FatMax is retested.
  - **Aerobic volume and durability: 180–200W, 200–215W for the last hour.** 11 Nov showed 200W
    is sustainable cleanly.
    Riding 160W for those hours leaves aerobic stimulus on the table.
- **Intensity distribution is fine — don't claim otherwise.** A previous note here said more
  hours at the wrong intensity was the recurring failure mode. That was drawn from outdoor
  rides only and is **wrong**: including Zwift, Strava puts him at ~81% Zone 1. Retracted.
- **The actual recurring failure mode is rest.** 14 Sep – 11 Nov: rode 50 of 59 days, nine
  full rest days, and one streak of **22 consecutive days** without a day off. Volume
  averages 8.6 h/week (range 3.6–11.9), not the 4.6 h/week figure from August — that number
  is long stale and shouldn't be quoted. When he asks about adding hours, check the recovery
  trend first; the limiter has been rest days, not volume.
- **Volume plan from 11 Nov: `weeklyHoursTarget` 7.4 → 11**, agreed alongside a commitment
  to take rest days properly. Build it **per 16-day rotation, not per week** — 11 h/week is
  ~25h per rotation, weighted into the off blocks: nights 4h, off-block-A 8h, dayshift 3h,
  off-block-B 10h, with **one full rest day in every block** (4 per rotation, up from the
  2.4 he was averaging). Ramp over three rotations: 9.5 → 10.2 → 11. Added hours go in the
  190–215W aerobic band, not into more intensity — Z4+ is already ~15% of the month.
  Judge whether it's being absorbed on **block-median HRV and resting HR**, never day to day.
- **Races A Grade crits** — outcomes turn on repeated 30s surges, not steady-state power.
  Micro-intervals (30/15s, 40/20s) target exactly that and are a current focus.
- **Strong sprinter with a genuine kick.** All-time outdoor bests: **5s 1364W** (1325W in
  2026), **15s 1213W**, **30s 952W**, **1min 666W** — about 16.6 / 14.8 / 11.6 / 8.1 W/kg at
  82.2kg. Steep, high-peaking curve.
  - **The sprint has not declined, whatever it feels like.** 2025 → 2026 outdoor bests:
    15s 1140 → **1213W** (+6.4%), 30s 931 → **952W** (+2.3%), 1min 666 → 666W (level).
    Only 5s is down, 1364 → 1325 (−2.9%), and a single five-second sample depends entirely
    on whether a true maximal standing jump happened that year. Recent numbers are strong:
    **940W/30s on 31 Oct** and **654W/1min on 6 Nov**, both second-best-ever, at current
    weight. If he says the sprint has dropped, check the year-on-year table before agreeing.
  - **Zwift sprint numbers are not comparable to these.** These are outdoor, on the Favero
    pedals, in races. A Zwift sprint is trainer-measured from a standing start with no
    lead-out and no adrenaline, and will read lower for reasons unrelated to his legs.
    Compare Zwift to Zwift only, same warm-up and gear each time.
  - **Don't profile him off the 1 Nov race** (5s 1095W, 15s 846W, 30s 829W, almost flat
    between 15s and 30s). That was a **deliberate seated sprint he was trying out**, not how
    he normally sprints — it cost roughly 370W at 15s against his standing best. A flat
    15s/30s profile is the signature of sitting down, not of his physiology.
  - He is **not** limited to break finishes. A bunch sprint off a good wheel suits him.
    Finishes are lost to positioning, not sprint power.
- **W/kg targets.** 4 W/kg is reached (3.99 at 82.2kg). At the 80kg goal, 328W is
  **4.10 W/kg** with no extra watts. 4.5 needs 370W at current weight or 349W at 77.5kg —
  weight is the larger lever and the realistic next target. 5 W/kg means 411W or 65.6kg;
  treat it as out of scope rather than a goal to plan around. The TrainerRoad figure he
  quotes (11 h/week for 9–12 months) moves the odds of reaching 5 W/kg to about 1 in 16 —
  that describes how rare 5 W/kg is, not a route to it.
- **The two goal events want opposite things, and this is unresolved.** A-grade crits are
  flat and decided by absolute watts and repeated surges, where his sprint is the weapon and
  leg mass is an asset — nobody wins a bunch kick on W/kg. The Mudgee Classic Maxi (170km,
  ~1,686m) is the opposite and rewards W/kg. Don't optimise for both at once, and don't
  quietly assume lighter is better: say which event the advice is for.

### Judging progress

FTP is a noisy progress signal and is easily moved by one good twenty minutes. Prefer
**heart rate cost at a fixed power**, computed off the repeated ~41km Fernleigh rides:

- Pull the `watts`/`heart_rate` streams, keep only moving samples where the 30s window around
  each point has `stdev < 0.45 × mean` (drops surges and coasting), smooth both channels by
  30s to deal with HR lag, then regress HR against power.
- Read off what a fixed wattage costs in beats. Jul → Oct 2026: 175W went 123 → 117bpm,
  220W went 128 → 121bpm.
- **Always compare at matched power.** Raw Efficiency Factor (power ÷ HR) rises with
  intensity by itself, so a hard ride always "looks" more efficient than an easy one.
- Aerobic decoupling **can** be measured, but only off a deliberate fixed-power block — the
  Fernleigh rides aren't steady enough and several return negative drift simply because he
  rode harder late. The 11 Nov ERG block is the template: lock ERG, hold one power for 45+
  minutes, compare first half against second.
- **Hold cadence steady as well as power, or the decoupling figure is meaningless.** The
  method assumes power is the only thing changing. On 12 Nov, 65 min at a locked 175W
  returned 2.27% decoupling — worse than the 0.38% from 46 min at a *higher* 200W on
  11 Nov, which makes no sense until you notice cadence climbed 73→95 rpm through the
  12 Nov ride. At ~4 bpm per 10 rpm that accounts for roughly half the HR rise; the real
  figure was nearer 1%. The 11 Nov test was clean only because cadence happened to sit
  near 88 throughout.
  - So: a rising-cadence ride makes good aerobic work look like fading. Before calling a
    decoupling number, check whether cadence moved. If it did, fit HR against cadence and
    time together and report the time term, not the raw split.
- Resting HR can't be used for cross-period comparison: the Tasker/Galaxy Ring rows
  (Jul–Sep) and the Oura rows (from 23 Oct) are different devices measuring differently.

### Health signals

These override training reads — see Tone at the bottom of this file.

- **HRV is noisy, not monotonic. Read it by block, never day to day.** Medians across the
  roster cycle, 23 Oct – 11 Nov: nights 20, off 13, dayshift 11.5, off 8, nights 17.
  Individual nights range 7–33. A single low reading means nothing.
  - **The real signal was the 5–9 Nov run** (7, 8, 7, 10, 8 with resting HR 72–82) — five
    consecutive low nights spanning the end of a dayshift block, a race, and a 90km ride.
    Sustained runs are what to act on.
  - **Caution: an earlier read of this data claimed HRV had "roughly halved" from a stable
    26.** That was computed before the fragmented-sleep backfill and was wrong — six days
    were missing, including a 33 on 27 Oct. Always confirm the series is complete before
    calling a trend.
- **The absolute values may be lower than reality.** Overnight HRV in the single digits with
  a resting HR in the 70s doesn't match a 328W FTP, and that discordance is itself a clue.
  He moved the ring from middle to index finger on 11 Nov; that same day returned HRV 22.8
  and resting HR 64. Ring fit is a live candidate for the low readings. Allow two weeks on
  one finger before reading any trend, and don't attribute the change to recovery while the
  measurement confound is unresolved.
- **Don't coach around the second group.** Raised haematocrit, a 137/87 BP reading, and
  exogenous testosterone all independently raise resting HR and lower HRV. If the markers
  stay low after a clean two weeks of measurement, that is a GP and bloods conversation, not
  a training one. Outstanding: a 7-day morning BP log across both block types, and FBC +
  iron studies + renal with cystatin C (morning, fasted, no pre-workout, no creatine for
  2–4 weeks beforehand — creatine raises serum creatinine without any kidney change).
- **Don't compare his HRV to anyone else's.** HRV metrics differ by device and algorithm
  (RMSSD vs SDNN vs lnRMSSD, whole-night vs 5-minute windows), and absolute values are
  largely genetic and decline with age. It is a within-person trend tool only.

## Roster

Rotating **16-day cycle**: 4 nightshifts → 4 off → 4 dayshifts → 4 off. Haul truck operator
(Liebherr T282), ~12h shifts, **6am starts on dayshift** (not 5am). Consequences that keep
coming up:

- **A ~4am session before a dayshift is feasible** and he does ride them. Don't refuse one on
  scheduling grounds. But keep it **easy only**. Threshold and VO2 work at 4am is a bad test
  and a bad stimulus: core temperature is at its circadian low, HR runs high for the power,
  and he's fasted. Low aerobic is the one session type that doesn't care about any of that.
- **The 4am rides and the low HRV are the same fact.** A 4am start means waking ~3:30, which
  means 8h of sleep requires being asleep by 7:30pm. Dayshift nights run 5.5–6h against 7–9h
  in the off blocks. If HRV and resting HR are drifting the wrong way mid-dayshift, that's
  the cause — look there before concluding anything about fitness or FTP.
- Hard sessions and races only fit in the off blocks. A late finish before an early shift is a
  **safety** question, not just a training one. The same applies in reverse on nights: a hard
  session in the afternoon before a 12h overnight shift on the truck is a safety question,
  whatever the training data says.
- The first two days of the off block that follows nights are easy-only — the body is still
  catching up on sleep debt. Encoded in `OFF_A_SESSIONS`, not as a special case in
  `sessionForDate()`.
- **The plan is one build to a goal event, not repeating rotations.** `eventDate` (setting,
  default Grafton to Inverell, Sat 13 Mar 2027 — unconfirmed until entries open) drives
  `phaseForDate()`: base 85+ days out, build 36–84, event-specific 13–35, taper 0–12. Each
  phase has its own `OFF_A_SESSIONS` / `OFF_B_SESSIONS` arrays; nightshift and dayshift
  sessions don't change by phase (safety, not periodisation, sets those). The old six
  16-day rotations from `rosterAnchor` ran out in October and sat on "Peak 6/6" forever.
  - Hours and TSS targets now come from the day's actual prescription
    (`parseDurationRangeFromText` midpoint, tier → intensity), not a fixed table, so they
    follow the build and race weekends. `CAPACITY_BY_BLOCK` is only a fallback.
  - **13 Mar 2027 falls on the last day of a dayshift block** (Google Calendar: dayshift
    10–13 Mar; an earlier note here said nightshift). He needs leave for it. Event days and the eve now override
    the session; 14–20 Mar is a recovery week.
  - **Second goal event: Go4Bathurst, Sat 17 Apr 2027 (crit, Mount Panorama pit precinct)
    and Sun 18 Apr (150km road race), setting `event2Date`.** Both days fall on post-dayshift
    off-block days 3–4, no leave needed. `goalEvents()` lists events in order; the phase counts
    down to the next one, the 7 days after any event are a `recovery` phase (no club racing,
    its own OFF_A/OFF_B arrays), and event days plus their eve (openers) override
    `sessionForDate()`. G2I → Go4Bathurst is 35 days: one recovery week, then specific, then taper.
    Registration TBC on AusCycling.
  - **Podiatrist surgery is booked for 26 Feb 2027** (follow-up 1 Mar) — the post-dayshift
    block that holds the event sim, two weeks out. The plan doesn't know about it.
  - **No race on post-nights day 1 (cyclePos 4), any phase.** He finishes the fourth
    nightshift ~6am that morning. `raceFitsBuild()` rejects it; 17 Jan 2027 is the case.
  - Raceable Sundays to the event (as of 24 Nov): 27 Dec (HEZ + CCCC), 7 Mar (HEZ + CCCC).
    Everything else is on shift, protected for the build, or post-nightshift.
  - **He races 10 Jan (27 Nov)** — setting `chosenRaces` (comma-separated dates). A chosen
    race overrides the build's protected slots but never the safety rules (post-nights day 1,
    recovery week). 10 Jan costs that block's long ride (becomes openers) and its climb sim.
    He decides on the day whether 11 Jan stays a recovery spin. 27 Dec fits the build by
    default and is back on the plan; whether he rides it is unconfirmed.
  - **Away without a bike 31 Dec 2026 – 4 Jan 2027** — setting `offBikeDates` (dates or
    `a..b` ranges). Off-bike days prescribe rest and drop any race on them. 31 Dec is the
    last rostered nightshift, so he needs leave for it.
  - **Weekly CCCC racing and the event build compete, and Ryan chose "race when it fits"**
    (20 Nov 2026). A race weekend uses the race day, the eve (openers) and the day after
    (recovery). In build and event-specific phases, `raceFitsBuild()` drops any race whose
    weekend would land on a protected slot — post-nights day 3 (long ride), post-dayshift
    days 1–2 (long ride, climb/event sim) — and the race calendar shows it as "skip, long
    ride day". Base and taper race freely. Simulated 20 Nov – 13 Mar (before the post-nightshift rule): weekly racing gave
    ~9.4 h/week with one climb sim and one event sim; race-when-it-fits gives ~10.6 h/week,
    two climb sims and two event sims. A race on post-dayshift day 4 replaces that block's
    rest day (27 Dec 2026 does).
- **The two off blocks are not interchangeable and have separate session arrays.**
  `OFF_A_SESSIONS` (cyclePos 4–7, post-nights) is aerobic only and carries no quality
  session at all. `OFF_B_SESSIONS` (cyclePos 12–15, post-dayshift) is the freshest point in
  the rotation and holds the single hard session plus the biggest rides. They shared one
  array until 12 Nov, which meant a VO2 session could land on day 3 straight off four
  nightshifts.
- **Exactly one planned hard session per rotation**, on day 2 of the post-dayshift off
  block. Nothing in the nightshift block, the dayshift block or the post-nights off block is
  hard. `dailyCapacityHours()` reads from `CAPACITY_BY_BLOCK`, the per-day hours the plan
  asks for: 3.7 + 7.9 + 3.0 + 9.0 = 23.6h a rotation, or 10.3 h/week against the 11 target.
- **A race weekend reshapes an off block and can cost that block's rest day.** Races are
  fixed Sundays and the roster rotates past them, so a race can land on any day of an off
  block — including the rest day, which it then replaces, and including day 2 off nights
  (15 Nov 2026 does exactly that). The override preserves a Rest day it doesn't land on;
  it cannot preserve one it does. Worth saying out loud when a race falls that way rather
  than letting the rotation quietly drop to three rest days.

`rosterAnchor` in settings is the first day of a nightshift block; everything derives from it.

## Racing

- **HEZ** (Newcastle Hunter CC) races **fortnightly on Sundays**. **CCCC** (Central Coast CC,
  Ourimbah) runs its Spring/Summer series **weekly on Sundays** — he raced it on 1, 8, 15
  and 22 Nov 2026. An earlier note here said both were fortnightly; that hid the 22 Nov race
  from the dashboard entirely.
- Schedules are generated from an anchor date + the club's interval (`hezAnchor`,
  `ccccAnchor` in settings; `HEZ_INTERVAL_DAYS` 14, `CCCC_INTERVAL_DAYS` 7), not a hardcoded
  list. If HEZ races land on the opposite Sunday to what the dashboard shows, shift that
  anchor by 7 days.
- **Race eve gets openers, from any block.** `sessionForDate()` checks whether tomorrow is a
  raceable Sunday (one `findRaceSundayInBlock()` finds) and prescribes openers — 30–75 min
  mostly easy with 3 x 1 min at 330–350W. It used to inherit the generic slot (a 2–2.5h Z2
  ride, or "easy spin or rest" on the last dayshift day), which neither opens the legs nor
  scores the openers he actually rode. Race day text carries the primer (3 x 2 min, last
  block ~20 min before the gun) — the protocol is 2 for 2 against one unprimed race.
- **Prescription wording drives scoring.** `tierForPrescription()` is a substring match:
  any text containing "race" scores in the hard tier and "threshold" in the threshold tier,
  even in a phrase like "no threshold work". Write non-race prescriptions with "racing" and
  avoid naming intensities they're telling him to skip.
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
  - `trigger-sync.js` — proxies the Strava sync, which lives in a separate Vercel project.
  - `sync-oura.js` — pulls sleep, HRV and readiness from the Oura v2 API. `?days=N` backfills.
  - `oura-auth.js` — one-time OAuth handshake; seeds `oura_tokens`.
- Hosted on Vercel, deploys from `main`. `vercel.json` schedules the Oura sync daily; Strava
  is pulled by the separate sync project.

### Env vars (Vercel)

`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `OURA_CLIENT_ID`, `OURA_CLIENT_SECRET`,
optional `OURA_REDIRECT_URI` and `SYNC_SECRET`.

### Oura API gotchas

- **Personal access tokens were deprecated in December 2025.** OAuth is the only route.
  Refresh tokens are **single-use and rotate on every refresh**, so the new pair must be
  written back to `oura_tokens` immediately or the integration locks itself out.
- **`end_date` on the detailed `/sleep` endpoint is exclusive**, unlike `daily_sleep` and
  `daily_readiness`. Querying up to today returns nothing for last night — which is the
  record carrying HRV and resting HR. The sync pads the end date by a day and filters after.
- **Several sleep periods are returned per night** (`long_sleep`, `sleep`, `late_nap`,
  `rest`). Only the main one has meaningful HRV. Prefer `long_sleep`, then longest duration.
- **On nightshift there is often no main sleep period at all.** Day-sleep splits into two
  or three blocks of 2–3h, none of which clears the 3h floor that keeps naps from being
  stored as nights. Five of the first six Oura days stored nothing for this reason. The
  sync now falls back to combining a day's fragments (each ≥45 min, combined total ≥3h)
  into one synthetic period: durations and stages sum, HRV and average HR are weighted by
  fragment length, resting HR is the lowest seen across the day. `combined_from_fragments`
  in the sync response says which days were rebuilt this way — check it first when a
  night's numbers read oddly.
- **The upsert must not send nulls.** It merges on `log_date`, so a key present with a null
  value overwrites what's stored, and a re-sync over a day Oura no longer returns sleep for
  used to wipe a row that had synced correctly days earlier. Only non-null fields go in the
  payload. PostgREST requires uniform keys per request, so rows are grouped by key
  signature and sent one request per shape — never one request per day, which trips the
  rate limit.
- Responses paginate via `next_token`; a long backfill needs to follow it.

### Supabase tables

`dashboard_settings` (key/value), `rides`, `ride_ratings`, `daily_log` (nightly recovery),
`ride_plans`, `strava_tokens`, `oura_tokens`.

`daily_log` carries a `source` column: `tasker` for the old Health Connect rows, `oura` for
anything the sync writes. Oura rows add `hrv_ms`, `resting_hr` (overnight low, preferred over
`avg_heart_rate`), `sleep_score`, `readiness_score`, `temp_deviation_c` and sleep stages.

### Readiness score

Weighted from sleep 35%, HRV 10%, resting HR 20%, training load 35% (HRV cut from 20% on
24 Nov — it swings 7–33 nightly with the roster and was moving the dial too much). Components with no data
drop out and their weight is redistributed, so a missing ring loses precision rather than
quietly scoring a neutral 60. HRV is scored against a rolling 14-night median baseline, not
an absolute value — **three consecutive nights** below 75% of baseline cap readiness at 45
(`hrvLowRun()`; a single low night only costs points through the HRV score), and under 5h sleep caps it
at 50. With no recovery data at all the score is capped at 70, because load alone would
otherwise read 100.

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
