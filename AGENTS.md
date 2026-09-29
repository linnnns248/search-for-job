# Project guidance

This repository builds a public GitHub Pages dashboard for structured job listings and, in later versions, a local collector that publishes sanitized data.

- Read `docs/requirements.md` when changing product behavior or scope.
- Read `docs/architecture.md` when changing service boundaries, data flow, or deployment.
- Read `docs/configuration.md` when changing filters, cities, salary, keywords, company-size rules, schedules, or official-site sources.
- Read `docs/privacy.md` before touching authentication, source sessions, exports, resumes, or repository data.
- Keep `docs/current-state.md` and `CHANGELOG.md` current with completed work.
- Public GitHub Pages assets must never contain credentials, browser sessions, cookies, GitHub tokens, resumes, application notes, or AI analysis results.
- Run `npm test` and `npm run build` before considering a change complete.
- Use `codex/*` branches for feature work. Keep `main` deployable and tag stable releases with semantic versions.
