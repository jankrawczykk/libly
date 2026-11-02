# Build plan

This is the full plan for building Libly. It is written for AI coding agents and the human maintainer. Read `AGENTS.md` first. Work through the milestones in order, one task per PR.

## 1. Goals and non-goals

### Goals

* Show Librus Synergia statistics that Librus does not show by itself, starting with attendance percentages.
* Run entirely on the user's own computer. No hosted backend, no accounts, no database.
* Be safe by design. The login and password never leave the machine except to reach Librus itself, and are never stored.
* Be fully universal. Work for any student in any school that uses Librus (primary school, liceum, technikum, branżowa school, and others) by driving every rule from a user editable school profile.
* Be a clean open-source project under the MIT license that others can read, audit, and contribute to.
* Focus on functionality first. Visual design comes later from a Figma design, so the UI layer must be easy to restyle.

### Non-goals for the first releases

* A hosted or public instance (see the security section for why).
* Mobile apps, push notifications, or background syncing.
* Reading or writing Librus messages. The app is read only and does not touch the inbox.
* Parent accounts with several children. Student accounts first.
* Replacing the official Librus app. This is a companion for statistics.

## 2. Key decisions

| Decision | Choice | Reason |
| --- | --- | --- |
| Where it runs | Local only, server on `127.0.0.1` | Passwords never reach a third party |
| Data storage | In memory only, per session | Nothing to leak from disk |
| Librus access | `librus-api` behind a `LibrusPort` interface | Swap or fix the scraper without touching the app |
| Demo mode | Built in, synthetic data | Safe development, screenshots, CI, and try-before-login |
| Stack | React, Vite, Fastify, TypeScript, zod, Vitest | Matches the maintainer's choice, small and mainstream |
| Styling | CSS Modules plus CSS variable tokens | A Figma redesign becomes a token and component change |
| Settings | Browser localStorage, non-sensitive only | School profile and preferences, never credentials or grades |
| Universality | A `SchoolProfile` drives all rules, with presets per school type | Statutes, scales, and attendance symbols differ between schools |
| Name | Libly (final) | Avoids the Librus trademark in the name |

## 3. Security design

### Threat model

| Threat | Mitigation |
| --- | --- |
| Password stored or leaked by the app | Never persisted, never logged, dropped right after authorization, redacted logger |
| Other devices on the network reaching the app | Bind to `127.0.0.1`, refuse other addresses without an explicit flag |
| Malicious website talking to the local server (CSRF, DNS rebinding) | Host allowlist, Origin check on every state changing request, `SameSite=Strict` cookie, no CORS |
| XSS stealing session or data | Strict CSP with no inline scripts, React escaping, no `dangerouslySetInnerHTML`, no third party scripts |
| Malicious or compromised dependency | Few dependencies, exact pin on `librus-api`, lockfile, Dependabot, `npm audit` in CI, review of the library source before first use |
| Librus data leaking through logs or errors | Pino redaction, generic error messages to the client, no raw Librus responses logged |
| Account lockout or abuse flags at Librus | Rate limit login attempts, single request at a time, in-memory cache, refresh cooldown |
| Scraped HTML changes or is tampered with | zod validation of adapter output, `LibrusLayoutChangedError`, fail closed |
| Real data committed to the repo | Synthetic fixtures only, gitleaks in CI, PR checklist |

### Session handling

* `POST /api/session` accepts `{ login, password }` validated with zod. It authorizes a `librus-api` client, stores that client in an in-memory `Map` keyed by a random session id, and sets a cookie.
* The session id is 32 random bytes from `crypto.randomBytes`, base64url encoded.
* Cookie attributes are `HttpOnly`, `SameSite=Strict`, `Path=/`, and no `Domain`. `Secure` is not possible on plain loopback HTTP, which is acceptable because the traffic never leaves the machine and browsers treat `localhost` as a secure context.
* Idle timeout is 15 minutes and absolute timeout is 60 minutes. `DELETE /api/session` destroys the session immediately. Restarting the server destroys all sessions.
* Login attempts are limited (for example 5 per minute with exponential backoff after failures) so a typo loop cannot lock the Librus account.
* The password variable goes out of scope right after authorization. JavaScript cannot guarantee memory zeroing, so the README states this honestly instead of overclaiming.

### Headers and request checks

* CSP is `default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'`.
* Also send `X-Content-Type-Options nosniff`, `Referrer-Policy no-referrer`, `Cross-Origin-Opener-Policy same-origin`, and `Cache-Control no-store` on all `/api` responses.
* Reject requests whose `Host` header is not `127.0.0.1` or `localhost` with the configured port.
* On `POST`, `PUT`, and `DELETE`, require an `Origin` header that matches the app's own origin.

### Login form rules (web)

* Use `type="password"` with proper `autocomplete` values so password managers work.
* Do not keep the password in React state longer than needed. Prefer reading it from the form at submit time and clearing the field immediately.
* Never put credentials in URLs, `localStorage`, or `sessionStorage`.
* Show a short plain explanation next to the form about what happens to the password.

### Why not a hosted version

A hosted instance would mean the maintainer's server handles other people's school passwords, and it would also conflict with the `librus-api` warning against large scale or shared scraping. Local only is the safe default. A later option worth considering is a packaged desktop wrapper (for example Tauri) that removes the browser reachable port entirely. That is out of scope until the web version is stable.

## 4. Architecture

```
Browser (React)  <--HTTP on 127.0.0.1-->  Fastify server  <--HTML scraping-->  synergia.librus.pl
                                           |
                                           +-- security middleware
                                           +-- session store (memory)
                                           +-- LibrusPort
                                           |     +-- LibrusApiAdapter (real)
                                           |     +-- DemoAdapter (synthetic)
                                           +-- packages/core (pure statistics)
```

* The server fetches raw data through `LibrusPort`, normalizes it into domain types, and computes statistics with `packages/core`.
* The API returns derived results (summaries, series) and the normalized records the UI needs. It never returns raw Librus HTML or cookies.
* `packages/core` has no dependencies on Node or the DOM, so it can later run in the browser or a desktop shell.

## 5. Domain model

```ts
export type AttendanceKind =
  | 'present'
  | 'late'
  | 'absent_unexcused'
  | 'absent_excused'
  | 'exempt'
  | 'school_trip'
  | 'other';

export interface AttendanceEntry {
  date: string;          // ISO date
  lessonNumber: number;
  subject: string;
  kind: AttendanceKind;
  rawSymbol: string;     // the symbol shown by Librus, kept for debugging and mapping
  semester: 1 | 2;
}

export interface Grade {
  subject: string;
  value: number | null;  // numeric value after normalization, null if not numeric
  rawValue: string;      // for example "4+", "np", "bz"
  weight: number;
  category: string;
  date: string;
  semester: 1 | 2;
  countsToAverage: boolean;
}

export type SchoolType =
  | 'primary'            // szkoła podstawowa
  | 'general_lyceum'     // liceum ogólnokształcące
  | 'technikum'          // technikum
  | 'vocational_stage1'  // szkoła branżowa I stopnia
  | 'vocational_stage2'  // szkoła branżowa II stopnia
  | 'post_secondary'     // szkoła policealna
  | 'other';             // custom, user defines everything

export type SubjectCategory =
  | 'general'            // przedmioty ogólne
  | 'vocational'         // przedmioty zawodowe
  | 'practical_classes'  // zajęcia praktyczne
  | 'work_placement'     // praktyki zawodowe
  | 'physical_education'
  | 'religion_ethics'
  | 'behavior'
  | 'custom';

export interface SubjectRule {
  subject: string;                       // exact name as shown in Librus
  category: SubjectCategory;
  includeInOverallAverage: boolean;
  includeInOverallAttendance: boolean;
  attendanceCriticalThreshold?: number;  // overrides the school default when set
  attendanceWarningThreshold?: number;
  weightMultiplier?: number;             // optional, for schools with special weighting
}

export interface AttendanceRules {
  criticalThreshold: number;       // percent from the school statute, default 50, shown in red
  warningThreshold: number;        // percent, default 60, shown in amber
  scope: 'per_subject' | 'overall' | 'both';   // what the statute actually measures
  period: 'semester' | 'year';     // over which period the threshold applies
  countLateAsPresent: boolean;     // default true
  countExcusedAsPresent: boolean;  // default false, statutes differ
  excludedKinds: AttendanceKind[]; // default ['exempt', 'school_trip']
  symbolMap: Record<string, AttendanceKind>;  // Librus symbol to kind, editable per school
}

export interface GradeRules {
  scale: 'one_to_six' | 'points' | 'percent' | 'custom';
  plusOffset: number;                    // default 0.5
  minusOffset: number;                   // default -0.25
  averageMethod: 'weighted' | 'arithmetic';
  includeBehaviorInAverage: boolean;     // default false
  distinctionAverage: number;            // default 4.75, for the "z wyróżnieniem" (red stripe) goal
  distinctionMinBehavior: string;        // default 'bardzo dobre'
  workPlacementHandling: 'exclude_from_average' | 'include_as_subject' | 'separate_average';
  practicalClassesHandling: 'exclude_from_average' | 'include_as_subject' | 'separate_average';
}

export interface TermStructure {
  type: 'semesters' | 'trimesters' | 'custom';
  terms: { name: string; start: string; end: string }[];  // ISO dates, editable
}

export interface SchoolProfile {
  version: number;                 // for migrations of stored settings
  schoolType: SchoolType;
  classYear?: number;              // for example 1 to 5, optional
  attendance: AttendanceRules;
  grades: GradeRules;
  terms: TermStructure;
  subjectRules: SubjectRule[];     // per subject overrides and categories
}

export interface LibrusPort {
  authorize(login: string, password: string): Promise<void>;
  getAttendance(): Promise<AttendanceEntry[]>;
  getGrades(): Promise<Grade[]>;
  getTimetable?(): Promise<TimetableLesson[]>;
  getCalendar?(): Promise<CalendarEvent[]>;
}
```

The exact symbol mapping from Librus to `AttendanceKind` is an open question until the spike in milestone 0.5 is done. Because schools can define their own symbols, the mapping must be editable in the school profile, and unknown symbols must be shown to the user for mapping instead of being guessed.

### School profile and presets

* Presets live as plain JSON files in `packages/core/presets/` (one per `SchoolType`) and contain only typical defaults. Examples are no work placement rules for a general liceum, and work placement and practical classes categories enabled for technikum and branżowa schools.
* A preset is a starting point. The user can change every field. The UI labels preset values as "typowe wartości, sprawdź statut swojej szkoły".
* Presets do not guess attendance symbol mappings or school term dates. They leave the symbol map and term list empty for the user to configure from their school's rules; an empty term list is valid until configured.
* Settings are validated by a zod schema with a `version` field and a migration function, so older stored profiles keep working.
* The profile can be exported to and imported from a JSON file. The file contains no personal data, which makes it possible to share a preset for a specific school. Community presets can be added by PR to `packages/core/presets/community/` after review.
* Subjects found in the user's Librus data are auto categorized by simple keyword rules (for example names containing "praktyk" or "zajęcia praktyczne"), always shown to the user for confirmation, and never silently final.

## 6. Statistics definitions

All of these live in `packages/core` and are fully unit tested.

### Attendance percentage

```
counted  = entries whose kind is not in excludedKinds
present  = counted entries that count as present (present, plus late if enabled, plus excused if enabled)
percent  = present / counted * 100          (if counted is 0, return null, not 0)
```

Compute it for the whole year, per semester, and per subject.

### How the school profile changes the numbers

* Thresholds come from `AttendanceRules`, with a per subject override from `SubjectRule` when present.
* `scope` decides whether the red highlight is based on each subject, on the overall percentage, or both, because statutes differ.
* `period` decides whether the percentage is judged per semester or over the whole year.
* Subjects whose `includeInOverallAttendance` or `includeInOverallAverage` is false are shown but left out of the overall numbers.
* Work placement and practical classes follow `workPlacementHandling` and `practicalClassesHandling`. With `separate_average` they get their own average that does not mix into the main one.
* Non numeric grades (for example descriptive grades in early primary school) are displayed as they are and never crash the statistics.

### Status per subject

* `critical` when `percent < criticalThreshold`
* `warning` when `percent < warningThreshold`
* `ok` otherwise
* `unknown` when there are no counted lessons

### Absence buffer (how many lessons can I still miss)

With `p` present lessons, `n` counted lessons, and threshold `t` as a fraction, missing `x` more lessons keeps `p / (n + x) >= t` as long as

```
x <= p / t - n        (floor it, minimum 0)
```

### Recovery (how many lessons must I attend to get back above the threshold)

If currently below `t`, attending `y` more lessons in a row gives `(p + y) / (n + y) >= t`, so

```
y >= (t * n - p) / (1 - t)      (ceil it)
```

If `t` is 1, recovery is impossible when any absence exists, so return `null`.

### Weighted grade average

```
average = sum(value * weight) / sum(weight)     over grades where countsToAverage and value is not null
```

* Grades like `4+` and `3-` map to configurable offsets, default `+0.5` and `-0.25`, because schools differ.
* Symbols such as `np`, `bz`, and `nb` never count.
* Compute per subject, per semester, and for the whole year. Return `null` if there are no countable grades.

### Grade needed for a target

To reach target average `T` after adding one grade of weight `w`, with current weighted sum `S` and total weight `W`:

```
needed = (T * (W + w) - S) / w
```

Report whether it is reachable on the grading scale (1 to 6).

## 7. Features by release

### v0.1.0 (MVP, attendance first)

* Local login form with clear privacy explanation
* Demo mode without login
* Overall attendance percentage
* Per subject attendance percentage, sorted worst first
* Red highlight (with icon and text) for subjects under the critical threshold, amber for the warning band
* Semester switcher (semester 1, semester 2, whole year)
* First run school setup wizard with school type selection and a preset, then full editing of all school settings (see below)
* Settings for thresholds and counting rules, saved in localStorage
* Honest error messages (wrong password, Librus unreachable, layout changed)
* Logout that wipes the session

#### School profile settings (v0.1.0 scope)

* Choose the school type (primary, liceum, technikum, branżowa I and II stopnia, policealna, other) and optionally the class year
* Attendance threshold from the statute, warning threshold, whether it applies per subject, overall, or both, and per semester or per year
* Rules for late arrivals, excused absences, and excluded entry kinds
* Editable mapping of Librus attendance symbols for schools with custom symbols
* Semester or trimester dates
* Subject categories with per subject overrides (general, vocational, practical classes, work placement, physical education, religion or ethics, behavior)
* Reset to preset, export to JSON, import from JSON

Grade specific school settings (work placement grades, scale, plus and minus values, distinction average) are delivered in v0.3.0 together with the grades feature.

### v0.2.0 (attendance power tools)

* Absence buffer per subject (how many lessons I can still miss)
* Recovery calculator for subjects below the threshold
* "What if" simulator where you add hypothetical absences or presences and see the effect
* Attendance trend over time per subject (line chart)
* Breakdown by kind (unexcused, excused, late) and by weekday and lesson number to spot patterns
* Optional list of the days with the most missed lessons

### v0.3.0 (grades)

Schools can switch off the average display in Librus, which is why several browser extensions exist for it. This app provides the same, plus more.

* Weighted average per subject, per semester, and per year
* Grade simulator for adding hypothetical grades
* Target calculator that tells which grade is needed for a goal average
* Grade trend chart per subject
* Distribution of grades and of weights by category
* Highlight of subjects at risk of a failing final grade (configurable)
* Separate handling of work placement (praktyki zawodowe) and practical classes grades, depending on the school profile
* Progress toward the distinction goal (average and minimum behavior grade from the profile, default 4.75)
* Support for point based and percent based scales through `GradeRules.scale`, using the library's point grade method where available

### v0.4.0 (planning and quality of life)

* Upcoming tests and homework density per week from the calendar, so crunch weeks are visible
* "Next 7 days" overview
* Export of the computed statistics to CSV and a printable page, generated locally
* Clear all data button and a "how to verify this app is local" help page
* English translation scaffolding
* Community presets folder and a contribution guide for adding a preset for a specific school

### Later ideas (not committed)

* Packaged desktop version
* Several accounts or parent view
* Comparison of attendance against school statute rules for the specific school (user defined)

## 8. API

All routes are under `/api`, JSON only, and validated with zod. Errors use a stable shape `{ code, message }` with no sensitive details.

| Method and path | Purpose |
| --- | --- |
| `POST /api/session` | Log in with `{ login, password }`, or `{ demo: true }` for demo mode. Sets the session cookie. Returns 204. |
| `GET /api/session` | Returns whether a session exists and whether it is demo. |
| `DELETE /api/session` | Logs out and destroys the session. |
| `GET /api/attendance` | Normalized attendance entries for the session. |
| `GET /api/attendance/summary` | Per subject and overall percentages, statuses, buffers. Accepts `semester` and settings overrides as query params. |
| `GET /api/grades` | Normalized grades. |
| `GET /api/grades/summary` | Averages per subject, semester, and year. |
| `POST /api/refresh` | Re-fetches from Librus, with a cooldown of 60 seconds. |

Settings are applied on the client where possible, and `packages/core` is shared so results match.

## 9. Frontend structure

```
apps/web/src/
  app/            router, providers
  features/
    login/
    attendance/
    grades/
    settings/
  components/     small reusable pieces (Card, Badge, ProgressBar, Chart wrappers)
  styles/         tokens.css (colors, spacing, typography), global.css
  i18n/           pl.json
  api/            typed client
```

* All colors, spacing, radii, and fonts come from `tokens.css`. Components must not hardcode them. This is what makes the later Figma redesign cheap.
* Status colors have an accessible contrast ratio and are always paired with an icon and a text label.
* Pages for v0.1.0 are Login, School setup wizard (first run), Dashboard (overall plus subject list), Settings (with a dedicated School section), and About/Privacy.
* The school setup wizard asks for school type, then shows the preset values for review, then lists the subjects found in Librus so the user can confirm categories. It can be skipped, and it can be reopened at any time from Settings.
* The UI never assumes a school type. Sections such as work placement appear only when the profile enables them.
* Use TanStack Query for server state with a short stale time and no persistence to storage.

## 10. Milestones and tasks

Each task is one PR. Acceptance criteria are what the reviewer checks.

### Milestone 0, repository bootstrap

* T0.1 Create the npm workspaces monorepo with `apps/server`, `apps/web`, `packages/core`. TypeScript strict, ESLint, Prettier, Vitest. Acceptance is that `npm run check` passes on an empty skeleton.
* T0.2 Add `LICENSE` (MIT), `README.md`, `AGENTS.md`, `docs/PLAN.md`, `CONTRIBUTING.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md`, issue templates, PR template, `CODEOWNERS`, `.github/copilot-instructions.md`.
* T0.3 CI workflow with read-only token permissions and pinned action versions. Steps are install with `npm ci`, lint, typecheck, test, `npm audit`, gitleaks. Enable Dependabot and CodeQL.
* T0.4 `.gitignore`, `.npmrc`, and `.env.example` with only non-sensitive config (`PORT`). Add a check that fails the build if a `.env` with secrets is tracked.

### Milestone 0.5, Librus spike (maintainer does this locally, agents do not receive credentials)

The goal is to learn what `librus-api` really returns. Do this by hand, in a scratch folder outside the repo.

* T0.5.1 Read the source of `librus-api` once, focusing on login, `absence`, `info.getGrades`, and `calendar`. Note what it requests and what it stores.
* T0.5.2 Check whether `absence.getAbsences()` returns only absences or also present lessons. A percentage needs the number of all counted lessons, not just absences. If the library does not return enough, decide between contributing a fix upstream, using the library's authorized session to fetch the attendance page (`przegladaj_obecnosci`) with our own parser, or deriving lesson counts from the timetable.
* T0.5.3 Write down the real attendance symbols and the grade value formats seen in your account, then create synthetic fixtures that mimic them with fake names.
* T0.5.4 Record the findings in `docs/decisions/0001-librus-data-coverage.md`. Update the domain types and the mapping table in this plan.

This milestone gates the real adapter. Everything else can proceed in parallel using the demo adapter.

### Milestone 1, core statistics

* T1.1 Implement domain types and zod schemas in `packages/core`, including `SchoolProfile`, `AttendanceRules`, `GradeRules`, `TermStructure`, and `SubjectRule`, with versioning and a migration function.
* T1.1b Create the presets for every `SchoolType` as JSON in `packages/core/presets/` and a loader. Acceptance is that every preset validates against the schema and has tests.
* T1.1c Subject auto categorization by keyword rules, with tests that include names such as "Praktyki zawodowe" and "Zajęcia praktyczne".
* T1.2 Attendance percentage (overall, semester, subject) with settings. Acceptance covers zero counted lessons returning `null`, late and excused toggles, and excluded kinds.
* T1.3 Status classification with the critical and warning thresholds, including the exact threshold value.
* T1.4 Absence buffer and recovery formulas with tests for boundaries (`t = 0`, `t = 1`, already below, already above).
* T1.5 Weighted average, `+` and `-` handling, and target grade calculator.
* T1.6 Synthetic fixture generator that produces a realistic school year of attendance and grades for the demo adapter.

### Milestone 2, server

* T2.1 Fastify app skeleton, config loading, graceful shutdown, bind to `127.0.0.1` with the refusal logic and flag.
* T2.2 Security middleware, which means helmet and CSP, Host allowlist, Origin check, `no-store` on API responses, and tests that prove each rejection.
* T2.3 Session store with idle and absolute timeouts, cookie handling, and destroy on logout. Tests with fake timers.
* T2.4 `LibrusPort`, `DemoAdapter`, and the `POST /api/session` demo path.
* T2.5 Login rate limiting with backoff and tests.
* T2.6 Logger with redaction and a test that proves a password never appears in log output, including on error paths.
* T2.7 `LibrusApiAdapter` with local type declarations, zod validation of results, and `LibrusLayoutChangedError`. Blocked until milestone 0.5 is done.
* T2.8 Attendance and grades routes using `packages/core`, in-memory per session cache, and `POST /api/refresh` with cooldown.

### Milestone 3, web MVP (v0.1.0)

* T3.1 Vite React app, router, providers, tokens, i18n scaffold, typed API client.
* T3.2 Login page with privacy explanation, demo button, and error states.
* T3.3 Dashboard with the overall attendance card and the per subject list, sorted worst first.
* T3.4 Status styling with red and amber, icon and text, and an accessibility check (keyboard, contrast, screen reader labels).
* T3.5 Semester switcher.
* T3.6 Settings page with a School section covering every field of the school profile in v0.1.0 scope, saved in localStorage with schema validation, plus reset to preset, export to JSON, and import from JSON. Acceptance is that changing the threshold, scope, or period changes the dashboard results.
* T3.6b First run school setup wizard (school type, preset review, subject category confirmation, attendance symbol mapping for unknown symbols).
* T3.7 Logout, session expiry handling, and friendly error screens.
* T3.8 Playwright e2e in demo mode covering login, dashboard, red highlight, settings change, logout.
* T3.9 Production build served by the server with the strict CSP, and a test that the built app has no inline scripts and no external requests.

### Milestone 4, release v0.1.0

* T4.1 Final README pass with the Librus terms warning, the privacy explanation, and the screenshots taken in demo mode.
* T4.2 Manual security checklist run (see section 11) and results recorded in the PR.
* T4.3 Tag `v0.1.0`, GitHub release notes, and a short "how to verify the app is local" guide.

### Milestone 5, attendance power tools (v0.2.0)

* T5.1 Buffer and recovery shown per subject in plain language ("możesz jeszcze opuścić 4 lekcje").
* T5.2 Attendance simulator.
* T5.3 Trend chart per subject.
* T5.4 Breakdown by kind, weekday, and lesson number.

### Milestone 6, grades (v0.3.0)

* T6.1 Grades endpoint and averages UI.
* T6.2 Grade simulator and target calculator.
* T6.3 Trend chart and distribution charts.
* T6.4 At risk subjects highlight.
* T6.5 School specific grade rules in the UI, covering scale, plus and minus offsets, work placement and practical classes handling, behavior in the average, and the distinction goal.
* T6.6 Point based and percent based scale support.

### Milestone 7, planning and polish (v0.4.0)

* T7.1 Calendar based test and homework density view.
* T7.2 Local CSV and print export.
* T7.3 English translation scaffolding and language switch.
* T7.3b Community presets folder, validation script run in CI, and contributor guide.
* T7.4 Redesign pass from Figma. Only `tokens.css` and component styles should need to change, and if more is needed, refactor first.

## 11. Testing, CI, and release checks

* Unit tests for all of `packages/core`, with target 100 percent branch coverage on statistics.
* Server integration tests with the demo adapter using Fastify's `inject`.
* Security tests for headers, Host and Origin rejection, cookie flags, rate limiting, session expiry, and log redaction.
* E2E with Playwright in demo mode only.
* CI runs on every PR and blocks merge on failure. Branch protection on `main` requires CI, one review, and no force pushes.

### Manual security checklist before each release

* [ ] Server refuses to bind to anything but `127.0.0.1` without the flag
* [ ] Cookie is `HttpOnly` and `SameSite=Strict`
* [ ] A request with a foreign `Origin` or `Host` is rejected
* [ ] Searching the whole repo and the build output finds no credentials and no real data
* [ ] Logs from a full login, failed login, and logout contain no password
* [ ] Browser network tab shows requests only to `127.0.0.1`
* [ ] `npm audit` is clean or every finding is explained
* [ ] `librus-api` is pinned to an exact version and was reviewed for this release

## 12. Documentation to maintain

* `README.md` for users and contributors, in Polish first, English later.
* `SECURITY.md` with how to report a vulnerability privately through GitHub security advisories.
* `CONTRIBUTING.md` that mirrors the contribution section of the README.
* `docs/decisions/` short ADRs for choices such as the attendance data source and the session design.
* A visible, always present warning that the library is unofficial and may violate the Librus terms.

## 13. Open questions for the maintainer

* What exactly does `librus-api` return for attendance, and is it enough to compute percentages (milestone 0.5)?
* Which attendance symbols appear in your account, and how should each map to `AttendanceKind`?
* Does your school's statute use a 50 percent rule or something else, and are excused absences counted?
* Whether the GitHub repository and npm package names `libly` are free, and whether to reserve them.
* Which school types and typical statute values should ship as presets in v0.1.0, and who verifies them.
* How Librus shows work placement (praktyki zawodowe) and practical classes in different schools, as a subject, a grade category, or something else.
* Whether login works the same for accounts that use Librus Portal sign-in instead of the classic Synergia login.

## 14. Tips for working with GitHub Copilot on this plan

* Turn each task above into a GitHub issue with the acceptance criteria copied in, then assign it to the Copilot coding agent. Keep each issue small.
* Review every PR yourself. Read security related changes line by line.
* Never paste real credentials, real grades, or real attendance into an issue, a PR, or Copilot Chat. Use the demo adapter.
* When Copilot drifts from the plan, quote the rule from `AGENTS.md` in a PR comment and ask it to fix the PR.
* Start each new chat with "Read AGENTS.md and docs/PLAN.md, then work on task T<number> only."
