# AGENTS.md

Instructions for AI coding agents working in this repository. This covers the GitHub Copilot coding agent, Copilot Chat in agent mode, and any other agent. Humans should also read `README.md` and `docs/PLAN.md`.

Also create `.github/copilot-instructions.md` with a single short paragraph that tells Copilot to read and follow this file.

## What this project is

Libly is a local-first, open-source (MIT) web app that shows statistics from Librus Synergia that Librus does not show by itself. The first feature is attendance percentages, overall and per subject, with subjects below a threshold highlighted in red.

The app reads data through the unofficial library `librus-api` (https://github.com/Mati365/librus-api), which scrapes the Librus HTML pages. Librus has no official API. Using this library may violate the Librus Synergia terms of service, and the README must always say so clearly.

The complete build plan is in `docs/PLAN.md`. Read it before starting any task and respect the milestone order.

## Security rules (non-negotiable)

Security is the top priority of this project. If a task conflicts with any rule below, stop and explain the conflict in the PR description instead of working around it.

1. Credentials are never persisted. Never write a Librus login or password to disk, a database, localStorage, sessionStorage, cookies, logs, error messages, URLs, query strings, analytics, test fixtures, or snapshots.
2. The server listens on `127.0.0.1` only. It must refuse to start on any other address unless the user passes the explicit `--i-understand-the-risks` flag, and the flag must print a loud warning.
3. Credentials travel only in the body of `POST /api/session`, are used once to authorize the library client, and are dropped immediately. The session keeps only the authorized library client in memory.
4. The only outbound network traffic allowed is to `synergia.librus.pl` (and `portal.librus.pl` if the library needs it). No CDN, no Google Fonts, no analytics, no telemetry, no error reporting services.
5. Never commit real student data. Fixtures must be synthetic. Real data may only be anonymized by the maintainer personally.
6. Never ask for, accept, or use real credentials in issues, PRs, comments, or chat. Develop and test with the demo adapter.
7. All external input is validated with `zod`. This includes request bodies, query params, and the output of `librus-api`, which is untrusted scraped HTML.
8. Set strict security headers (CSP, `X-Content-Type-Options`, `Referrer-Policy`, `frame-ancestors 'none'`) and enforce Host and Origin checks to block DNS rebinding and cross-site requests.
9. Keep dependencies minimal. Every new dependency needs a one line justification in the PR. Pin `librus-api` to an exact version. Do not add packages that are unmaintained, have install scripts without a good reason, or duplicate what the platform already offers.
10. The Librus integration is read only. Never call `inbox.sendMessage`, `inbox.removeMessage`, or any other method that changes data on Librus.
11. Fail closed. If something cannot be validated, return a clear typed error. Never fall back to a less safe behavior to make a test pass.

Any change touching `apps/server/src/security`, `apps/server/src/session`, or the login flow in the web app must carry the `security` label and gets reviewed by the maintainer through CODEOWNERS.

## School profile rule

Libly must work for every student in every school that uses Librus. Never hardcode assumptions about a school type, a statute, a grading scale, a semester structure, or attendance symbols. Every such value comes from the `SchoolProfile` described in `docs/PLAN.md`. Defaults and presets are allowed, but they must be editable by the user and clearly labeled as typical values that the user should verify against their school statute. Do not present presets as legal advice.

## Tech stack

| Area | Choice |
| --- | --- |
| Language | TypeScript with `strict` enabled, ESM everywhere |
| Runtime | Node.js LTS (22 or newer) |
| Monorepo | npm workspaces |
| Server | Fastify with helmet, rate-limit, cookie, and static plugins |
| Web | React and Vite, React Router, TanStack Query |
| Styling | CSS Modules with design tokens in CSS variables (so a Figma redesign later is cheap) |
| Validation | zod |
| Tests | Vitest for unit and integration, Playwright for e2e in demo mode |
| Lint and format | ESLint (typescript-eslint, strict config) and Prettier |
| Logging | pino with redaction of `password`, `cookie`, `authorization` |

## Repository layout

```
apps/
  server/         Fastify app, session handling, Librus adapter wiring
  web/            React app (Vite)
packages/
  core/           Pure domain types and statistics. No I/O, no Node or DOM APIs.
docs/
  PLAN.md         Full build plan
  decisions/      Short ADR files for important decisions
.github/
  workflows/      CI
  ISSUE_TEMPLATE/
  PULL_REQUEST_TEMPLATE.md
  CODEOWNERS
```

## Commands

```bash
npm ci                  # install exactly what the lockfile says
npm run dev             # server and web in watch mode
npm run build           # production build
npm start               # serve the production build on 127.0.0.1
npm run lint
npm run typecheck
npm test                # unit and integration
npm run test:e2e        # Playwright, demo mode only
npm run check           # lint, typecheck, test, audit. Run before every commit.
```

## Coding conventions

* No `any`. Use `unknown` and narrow with zod.
* Named exports only, no default exports (except where a tool requires them).
* Code, comments, commit messages, and PR text are in English. User facing UI text is Polish and lives in `apps/web/src/i18n/pl.json`. Never hardcode UI strings in components.
* Dates are ISO strings (`YYYY-MM-DD`) at the boundaries. Avoid timezone bugs by never constructing dates from local time without need.
* Percentages are computed as raw ratios and rounded only at display time.
* Everything in `packages/core` is a pure function. No `fetch`, no `fs`, no `Date.now()` (pass the date in).
* React components are function components with hooks. Keep components small and presentational where possible.
* Meaning must never rely on color alone. A red subject also gets an icon and a text label such as "Poniżej progu".
* File names use kebab-case. Types use PascalCase. Constants use SCREAMING_SNAKE_CASE only for real constants.
* Prefer clear code over comments. Comment the why, not the what.

## Testing rules

* Every function in `packages/core` has unit tests, with edge cases (zero lessons, all present, all absent, exact threshold).
* Bug fixes start with a failing test.
* Librus adapter tests use synthetic HTML or JSON fixtures in `apps/server/test/fixtures`. Fixtures must not contain real names, logins, or school data.
* E2E tests run only against the demo adapter.
* Do not delete or weaken a test to make CI pass. If a test is wrong, explain why in the PR.

## Git and PR workflow

* One task from `docs/PLAN.md` per PR. Keep PRs small and reviewable.
* Branch names look like `feat/attendance-summary` or `fix/session-expiry`.
* Commits follow Conventional Commits (`feat`, `fix`, `docs`, `test`, `refactor`, `chore`, `security`).
* Fill in the PR template. List assumptions and anything you were unsure about.
* Update docs in the same PR as the code change.

## Working agreement for agents

* Do only the assigned task. Do not refactor unrelated code and do not add features that are not in the plan.
* If the task is ambiguous, state your interpretation at the top of the PR description and proceed with the safest reading.
* If you discover that `librus-api` does not return the data a task needs, do not invent data and do not write your own scraper silently. Stop, document what is missing in the PR, and wait for the maintainer.
* Never disable a lint rule, a type check, or a security setting without a written reason in the PR.

## Definition of done

* [ ] Acceptance criteria of the task in `docs/PLAN.md` are met
* [ ] `npm run check` passes locally and in CI
* [ ] New logic has tests
* [ ] No credentials or personal data in code, logs, fixtures, or screenshots
* [ ] Docs updated if behavior changed
* [ ] The PR description explains what changed and why

## Librus adapter notes

* All use of `librus-api` lives behind the `LibrusPort` interface in `apps/server/src/librus`. Nothing else imports the library.
* There are two implementations, `LibrusApiAdapter` (real) and `DemoAdapter` (synthetic data, no network).
* `librus-api` is untyped CommonJS. Wrap it with a local type declaration and validate every result with zod before it enters the domain.
* Be polite to Librus. Run requests one at a time, cache results in memory for a few minutes, and enforce a cooldown on manual refresh. Never build bulk scraping or background polling.
* Librus can change its HTML at any time. When parsing fails, throw `LibrusLayoutChangedError` and show the user a clear message. Never return partial or guessed numbers.
