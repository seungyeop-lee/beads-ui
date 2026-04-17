# Agents

## Beads (bd) — Work Tracking

Use MCP `beads` (bd) as our dependency-aware issue tracker. The `bd` command
reference (issue types, priorities, dependency types, etc.) is injected by the
SessionStart hook; this file defines only project-specific conventions.

### Operating Mode

Local-only: no Dolt remote. Do **not** run `bd dolt pull`/`bd dolt push` (the
SessionStart hook's "Session Close Protocol" does not apply here).
`.beads/issues.jsonl` is gitignored; only minimal markers (e.g.,
`.beads/metadata.json`) are tracked. Update this section if a Dolt remote is
added later.

Track all tasks via beads. Do **not** use `TodoWrite`, `TaskCreate`, or ad-hoc
markdown files.

### Issue Content

- Write all narrative fields (title, description, notes, design) in **Korean**.
  Identifiers, commands, file paths, and code snippets stay in their original
  form.
- Every description must expose both **WHAT** and **METHOD** under clear
  headings (e.g., `## 무엇을 (WHAT)`, `## 어떻게 (METHOD)`).
  - **WHAT** — the target problem/outcome (why this issue exists, what must
    change).
  - **METHOD** — the agreed approach. Implementation detail belongs in `notes`
    after the work is done (step 9).

### Agent Workflow

Every file-modifying task, including trivial doc edits, follows these 10 steps:

1. **Register** — ensure a beads issue exists (create if needed, or confirm an
   existing one covers the scope).
2. **Await `승인`** — do not start until the user approves. Multiple
   pre-registered issues may be approved together.
3. **In progress** — `bd update <id> --status=in_progress` immediately before
   touching any file.
4. **Execute.**
5. **Report** — summarize changes and request confirmation. If the description
   contains a verification section (e.g., `## 검증`), execute every item and
   include the outcomes (evidence) here or in Notes (step 9); never announce
   `완료` while any verification item is still outstanding.
6. **Branch on response** — `완료` → step 7. Anything else is feedback; return
   to step 4 (status stays `in_progress`).
7. **Commit** — stage only files for this issue and commit. Never run
   `git push`.
8. **Comment** — add an issue comment with the actual commit hash and commit
   message for the commit from step 7.
9. **Notes** — use `bd update <id> --notes="..."` only for durable context such
   as decisions, verification outcomes, or feedback-driven rationale that is not
   already captured in the diff, commit, or comment.
10. **Close** — `bd close <id>`.

Session signals: only `승인` (step 1 → 3) and `완료` (step 6 → 7) carry workflow
meaning.

Work discovered mid-execution creates a new issue with a
`discovered-from:<parent-id>` dependency — continue the parent, do not switch.

### Workflow Examples

This section shows command sequences used repeatedly in this project. The
generic `bd` command reference is provided by the SessionStart hook and is not
duplicated here.

#### Starting Work

```
bd ready                              # List unblocked issues
bd show <id>                          # Review issue details
# After user says "승인":
bd update <id> --status=in_progress   # Transition before touching any file
```

#### Completing Work

```
# 1. Stage only files belonging to this issue
git add <file1> <file2>

# 2. Commit
git commit -m "feat(scope): ..."

# 3. Record commit on the issue
bd comments add <id> "commit: $(git rev-parse --short HEAD) feat(scope): ..."

# 4. Notes — only for durable context not already in diff/commit/comment
bd update <id> --notes="..."

# 5. Close
bd close <id>
```

`--notes` is reserved for decision rationale, verification outcomes, or
feedback-driven reasoning that is not already captured in the diff, commit, or
comment.

#### Mid-Execution Discovery

Do not interrupt the current issue. Create a new issue and link it with a
`discovered-from` dependency:

```
bd create --title="Newly discovered work" --description="..." --type=task
bd dep add <new-id> <current-id>      # new-id depends on current-id
```

Then continue working on the current issue.

### Concurrency

Only **one** issue may be `in_progress` per session. Multiple issues can be
approved together, but execute them sequentially.

### Setup Exceptions

If a one-time setup prerequisite is missing (e.g., `issue_prefix` not
configured), ask the user before configuring it, then resume the normal flow.

### Commit Rules

- Stage only files belonging to the closed issue; report any unrelated
  working-tree changes to the user instead of sweeping them in.
- Follow the existing commit message convention: `chore:`, `feat(scope):`,
  `fix:`, etc.
- Never run `git push`.
- Never update `CHANGES.md`.
- Never bypass git hooks (`--no-verify`, `LEFTHOOK=0`, or any equivalent
  flag/env). If a hook fails, fix the underlying issue and retry.

## Coding Standards

See [`docs/coding-standards.md`](docs/coding-standards.md) for naming, JSDoc,
module, and unit-test conventions.

## Pre-Handoff Validation

Validation is enforced by lefthook (`lefthook.yml`) — the source of truth. Hooks
install automatically via `pnpm install`; run `pnpm exec lefthook install` once
after a fresh clone if they are missing.

After changing UI sources under `app/`, run `pnpm build` to regenerate
`app/main.bundle.js` — `pnpm all` does **not** build.
