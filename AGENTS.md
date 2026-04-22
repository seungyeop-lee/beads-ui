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

<!-- >>> beads-starter >>> -->

## Beads Workflow

This section defines project-specific beads workflow conventions. For command
examples, see
[`docs/beads-starter/beads-commands.md`](docs/beads-starter/beads-commands.md).

### Initialization

Before any workflow step below, verify `.beads/` exists at the repository root.
If it does not, the repo has not been initialized yet — follow
[`docs/beads-starter/bd-setup.md`](docs/beads-starter/bd-setup.md) end-to-end
(install bd, run `bd init` with this project's flags, apply the `bd config`
follow-ups), then resume.

### Agent Workflow

Every file-modifying task, including trivial doc edits, follows these 10 steps:

```dot
digraph agent_workflow {
    rankdir=TB;
    node [shape=box, style=filled, fillcolor="#f8f8f8"];
    edge [color="#333333"];

    register  [label="1. Register\nEnsure issue exists"];
    await     [label="2. Await approval\nWait for user"];
    progress  [label="3. In Progress\nbd update --status=in_progress"];
    execute   [label="4. Execute\nModify files"];
    report    [label="5. Report\nSummarize, request review"];
    branch    [label="6. Branch" shape=diamond fillcolor="#ffe0b2"];
    commit    [label="7. Commit\nStage only issue files"];
    comment   [label="8. Comment\nbd comments add"];
    notes     [label="9. Notes (if needed)\nbd update --notes"];
    close     [label="10. Close\nbd close"];

    register -> await;
    await -> progress [label="approved"];
    progress -> execute;
    execute -> report;
    report -> branch;
    branch -> commit [label="done"];
    branch -> execute [label="feedback" style=dashed];
    commit -> comment;
    comment -> notes;
    notes -> close;

    discovery [label="mid-execution discovery\ncreate issue + dep" shape=note fillcolor="#e1f5fe"];
    execute -> discovery [style=dotted];
    discovery -> execute [label="continue parent" style=dotted];
}
```

1. **Register** — ensure a beads issue exists (create if needed, or confirm an
   existing one covers the scope).
2. **Await approval** — do not start until the user approves. Multiple
   pre-registered issues may be approved together.
3. **In progress** — `bd update <id> --status=in_progress` immediately before
   touching any file.
4. **Execute.**
5. **Report** — summarize changes and request confirmation. If the description
   contains a verification section (e.g., `## Verification`), execute every item
   and include the outcomes; never announce `done` while any verification item
   is still outstanding.
6. **Branch on response** — `done` → step 7. Anything else is feedback; return
   to step 4 (status stays `in_progress`).
7. **Commit** — stage only files for this issue and commit. Never run
   `git push`.
8. **Comment** — `bd comments add <id> "<text>"` (positional text, **not**
   `--message` flag); include the actual commit hash and commit message for the
   commit from step 7.
9. **Notes** — use `bd update <id> --notes="..."` for durable context not
   already captured in the diff, commit, or comment. **Required when step 6
   feedback modified the recorded decision**, using the matching prefix so the
   two cases stay separable later:
   - `Added via feedback: <item>. Commit: <hash>` — scope was added while METHOD
     itself stayed intact.
   - `Decision changed: <details>. Commit: <hash>` — METHOD itself was revised
     (decision reversal). Also update the issue's `### Alternatives Considered`
     from step 1.
10. **Close** — `bd close <id> --reason="..."`.

**Session signals:** only `approved` (step 1→3) and `done` (step 6→7) carry
workflow meaning.

### Operating Mode

Local-only shared-server (no Dolt remote). Do **not** run `bd dolt pull` /
`bd dolt push`. The entire `.beads/` directory is gitignored.

### Issue Content

- Every description must expose both **WHAT** and **METHOD** under clear
  headings (e.g., `## WHAT`, `## METHOD`).
  - **WHAT** — the target problem/outcome (why this issue exists, what must
    change).
  - **METHOD** — the agreed approach. Implementation detail belongs in `notes`
    after the work is done (step 9).
- Add an `### Alternatives Considered` subsection under METHOD **only when** one
  of the following triggers fired:
  - Two or more concrete implementations were actually compared during
    discussion.
  - The user rejected one approach and directed another.
  - The step 6 feedback loop changed METHOD itself (preserve the prior METHOD
    alongside the new one).

  Do not create the subsection just to fill in alternatives that would be
  rejected by common sense — the absence of the subsection itself signals "no
  alternatives were discussed."

- **Self-contained** — the description must let an executor who has not seen the
  conversation start work without asking follow-up questions. Record every
  constraint agreed in discussion (chosen approach, rejected options, scope
  boundaries) in METHOD. Do not rely on session memory.
- **Out of Scope** — when the boundary is non-trivial, add an `### Out of Scope`
  subsection under METHOD listing what this issue explicitly does not cover
  (related components deferred, files not to touch, features excluded).
- **Verification required for file-modifying issues** — add a `## Verification`
  section with concrete, checkable criteria (files that must exist or not exist,
  behaviors that must hold). Step 5 of the Agent Workflow executes every item,
  so the section must be unambiguous.
- **Pre-creation self-check** — before `bd create`, re-read the description and
  confirm a reader without conversation context could proceed. If any agreed
  constraint is missing, or if unresolved choices would change implementation,
  revise (or ask the user) before creating.

- **Issue type** — `bug` (broken behavior) / `feature` (new functionality) /
  `task` (work item: tests, docs, refactor) / `epic` (large feature with
  subtasks) / `chore` (maintenance).
- **Priority** — `0` critical / `1` high / `2` medium (default) / `3` low / `4`
  backlog.

### Concurrency

Only **one** issue may be `in_progress` per session. Multiple issues can be
approved together, but execute them sequentially.

### Commit Rules

- Stage only files belonging to the closed issue; report any unrelated
  working-tree changes to the user instead of sweeping them in.
- Follow the existing commit message convention: `chore:`, `feat(scope):`,
  `fix:`, etc.
- Never run `git push`.
- Never bypass git hooks (`--no-verify` or any equivalent flag/env). If a hook
  fails, fix the underlying issue and retry.

### Shell Safety

When invoking `bd` with narrative arguments (`--description`, `--notes`,
`--reason`, `bd comments add` body, etc.), **wrap the value in single quotes**
by default:

```bash
bd close bdui-42 --reason='Commit abc1234: applied `Decision changed` convention'
```

Rationale: inside double quotes, the shell still expands `` ` ``, `$`, and `!`.
Backtick-wrapped text such as `` `Added via feedback:` `` is then treated as
command substitution and silently truncated from the stored value.

Switch to a heredoc form **only when** the content itself contains a single
quote:

```bash
bd close bdui-42 --reason="$(cat <<'EOF'
Use this form only when the body contains a single quote.
EOF
)"
```

### Setup Exceptions

If a one-time setup prerequisite is missing (e.g., `issue_prefix` not
configured), ask the user before configuring it, then resume the normal flow.

<!-- <<< beads-starter <<< -->
