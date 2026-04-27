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
