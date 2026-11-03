# Release security checklist

Run for the v0.1.0 release candidate on 2026-11-03. All test data was synthetic
demo data; no Librus credentials or real student data were used.

| Check | Result | Evidence |
| --- | --- | --- |
| Server refuses non-loopback binding without the explicit flag | PASS | `apps/server/test/config.test.ts`; the configuration tests cover rejection and the loud-warning path. |
| Session cookie is `HttpOnly` and `SameSite=Strict` | PASS | `apps/server/test/session-cookie.test.ts`; targeted security run passed. |
| Foreign `Origin` or `Host` is rejected | PASS | `apps/server/test/security-middleware.test.ts`; targeted security run passed. |
| Repository and production build contain no credentials or real data | PASS | Repository and `apps/web/dist` search found no credential-like literals, example accounts, or real-person data. |
| Logs from login, failed login, and logout contain no password | PASS | `apps/server/test/logging.test.ts`; targeted security run passed with redaction assertions. |
| Browser requests stay on loopback | PASS | Sequential Playwright demo and production runs passed; production coverage asserts no external requests, and the app uses same-origin API requests. |
| Dependency audit is clean or explained | PASS WITH KNOWN FINDINGS | `npm audit --audit-level=high` passes with 0 high and 0 critical findings. Full audit reports 13 moderate development-dependency findings; none affect production-only dependencies. |
| `librus-api` is pinned and reviewed | NOT APPLICABLE YET | The dependency is not installed. Plan item T2.7 explicitly blocks the integration until Milestone 0.5 is complete. |

## Validation summary

- Targeted security/session tests: 5 files, 41 tests passed.
- Full `npm run check`: passed; 21 test files, 149 tests.
- `npm run test:e2e -- --project=chromium`: passed.
- `npm run test:e2e -- --project=production`: passed.
