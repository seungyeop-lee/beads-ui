# Agents

## Project Overview

This project is a UI layer for the `bd` (Beads) CLI tool — it consumes `bd` via
CLI (`child_process.spawn`) and renders its output as a user interface.

`bd` is an external dependency outside this project's control. Do **not** assume
`bd` can be modified to add fields, flags, or output format changes. All
limitations (missing dependency types in JSON output, fixed command interfaces,
etc.) must be accepted and worked around on the UI side. When `bd`'s output is
insufficient (e.g., `bd show --json` omits dependency type), compensate in the
server/adaptation layer or accept the limitation — never block on upstream
changes.

## Coding Standards

See [`docs/coding-standards.md`](docs/coding-standards.md) for naming, JSDoc,
module, and unit-test conventions.

## Pre-Handoff Validation

Validation is enforced by lefthook (`lefthook.yml`) — the source of truth. Hooks
install automatically via `pnpm install`; run `pnpm exec lefthook install` once
after a fresh clone if they are missing.

After changing UI sources under `app/`, run `pnpm build` to regenerate
`app/main.bundle.js` — `pnpm all` does **not** build.

## Release

`pnpm version <level>` drives the whole release through lifecycle hooks:
`preversion` runs the full gate (`pnpm all`), `version` regenerates `CHANGES.md`
from commits, and `postversion` pushes the release commit and tag
(`git push --follow-tags`) before running `pnpm publish`.

The npm account enforces 2FA for writes, and `pnpm publish` cannot supply the
OTP, so it fails with a misleading `404 Not found` **after** the push has
already succeeded. That 404 does not mean the release failed — finish with:

```sh
npm publish --otp=<fresh 6-digit code>
```

- OTP codes expire in ~30s; use a fresh code.
- Pick the level from commits since the last tag: any `feat` → minor, `fix`-only
  → patch, breaking change → major.
- Registry propagation takes a few minutes, so `npm view` still showing the old
  version right after publish is not a failure. Do not re-publish.
