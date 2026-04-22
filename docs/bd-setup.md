# bd Initial Setup (Fresh Clone)

This project uses **bd (beads)** for all issue tracking, configured in **shared
Dolt server** mode. Run this one-time setup after cloning the repo.

## Install bd

```
curl -sSL https://raw.githubusercontent.com/steveyegge/beads/main/scripts/install.sh | bash
```

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

## Flag notes

- `--shared-server` — use the shared Dolt server at `~/.beads/shared-server/`;
  all bd projects on this machine share one server process.
- `--prefix bdui` — issues are named `bdui-<hash>`.
- `--skip-agents` — do not regenerate `AGENTS.md` (this repo already ships one).
- `--skip-hooks` — do not install bd's git hooks (this repo uses lefthook).
- `no-git-ops: true` — suppress bd's automatic Dolt push.
- `export.git-add: false` — suppress automatic `git add` of
  `.beads/issues.jsonl`.
- `unset sync.remote` — remove the broken Dolt remote URL that `bd init` sets by
  default.

## After setup

Follow the workflow in [`../AGENTS.md`](../AGENTS.md#agent-workflow).
