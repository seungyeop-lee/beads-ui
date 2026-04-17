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
    after the work is done (step 7).

### Agent Workflow

Every file-modifying task, including trivial doc edits, follows these 9 steps:

1. **Register** — ensure a beads issue exists (create if needed, or confirm an
   existing one covers the scope).
2. **Await `승인`** — do not start until the user approves. Multiple
   pre-registered issues may be approved together.
3. **In progress** — `bd update <id> --status=in_progress` immediately before
   touching any file.
4. **Execute.**
5. **Report** — summarize changes and request confirmation. If the description
   contains a verification section (e.g., `## 검증`), execute every item and
   include the outcomes (evidence) here or in Notes (step 7); never announce
   `완료` while any verification item is still outstanding.
6. **Branch on response** — `완료` → step 7. Anything else is feedback; return
   to step 4 (status stays `in_progress`).
7. **Notes** — `bd update <id> --notes="..."` for decisions, rationale, and
   feedback-driven changes. Skip anything already in the diff or commit.
8. **Close** — `bd close <id>`.
9. **Commit** — stage only files for this issue and commit. Never run
   `git push`.

Session signals: only `승인` (step 1 → 3) and `완료` (step 6 → 7) carry workflow
meaning.

Work discovered mid-execution creates a new issue with a
`discovered-from:<parent-id>` dependency — continue the parent, do not switch.

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
