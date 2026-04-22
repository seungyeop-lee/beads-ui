<!-- >>> beads-starter >>> -->

# bd Initial Setup (Fresh Clone)

This project uses **bd (beads)** for all issue tracking, configured in
**shared-server** mode (local; no remote). Run this one-time setup after cloning
the repo.

## Check for bd

```
command -v bd && bd version
```

If `bd` is already installed, skip to the **Initialize** step below.

## Install bd

The beads team recommends Homebrew. Pick one:

**Homebrew (macOS / Linux, recommended)**

```
brew install beads
```

**npm (Node.js users)**

```
npm install -g @beads/bd
```

**Install script (other platforms / no package manager)**

```
curl -sSL https://raw.githubusercontent.com/steveyegge/beads/main/scripts/install.sh | bash
```

For Windows, Arch AUR, `go install`, or building from source, see the
[beads installation guide](https://github.com/steveyegge/beads/blob/main/docs/INSTALLING.md).

## Initialize

Run once from the repository root:

```
bd init --shared-server --prefix bdui --skip-agents --skip-hooks
bd config set no-git-ops true
bd config set export.git-add false
bd config unset sync.remote
```

## Verify

```
bd ready --json
```

## Expected warnings

The following warnings are normal for this preset (local-only shared-server,
`--skip-hooks`). Do not act on them.

From `bd init`:

- `Server host defaulted to 127.0.0.1` — correct for single-machine use.
- `Setup incomplete. No dolt database found` — clears on the next `bd` command
  (the server creates the database lazily).

From `bd doctor`:

- `Git Hooks: No recommended git hooks installed` — intentional
  (`--skip-hooks`).
- `Phantom Databases: beads_global` — cosmetic, see beads GH#2051.
- `Dolt Status` / `Dolt Locks: Uncommitted changes` — pending `bd config` writes
  auto-commit on the next `bd` command.
- `Git Working Tree: Uncommitted changes` — files injected by beads-starter
  (`AGENTS.md`, `CLAUDE.md`, `.gitignore`, `docs/…`). Commit them separately
  from bd work.
- `Claude Plugin: beads plugin not installed` /
  `Claude Integration: Not configured` — not part of this preset.

## Do not run `bd doctor --fix`

`bd init` suggests `bd doctor --fix`. Do not run it under this preset — it can
re-apply changes this preset intentionally skipped (e.g., installing git hooks).
Interpret warnings individually against the `Expected warnings` list above;
anything outside that list should be surfaced to the user, not auto-fixed.

## Flag notes

- `--shared-server` — use the shared Dolt server at `~/.beads/shared-server/`;
  all bd projects on this machine share one server process (faster than the
  default engine, and convenient for git worktree workflows).
- `--prefix bdui` — issues are named `bdui-<hash>`.
- `--skip-agents` — do not regenerate `AGENTS.md` (this repo already ships one
  via beads-starter).
- `--skip-hooks` — do not install bd's git hooks.
- `no-git-ops: true` — suppress bd's automatic Dolt push.
- `export.git-add: false` — suppress automatic `git add` of
  `.beads/issues.jsonl`.
- `unset sync.remote` — remove the default Dolt remote URL set by `bd init` (we
  run local-only).

## After setup

Follow the workflow in [`../AGENTS.md`](../AGENTS.md).

<!-- <<< beads-starter <<< -->
