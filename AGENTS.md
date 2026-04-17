# Agents

## Beads (bd) — Work Tracking

Use MCP `beads` (bd) as our dependency‑aware issue tracker. The `bd` command
reference is injected by the SessionStart hook; this file defines
project-specific conventions.

### Operating Mode

This repository uses beads in **local-only mode**:

- No Dolt remote is configured. Do **not** run `bd dolt pull` or `bd dolt push`.
  The SessionStart hook's "Session Close Protocol" mentions `bd dolt pull`, but
  it does not apply here.
- Issue data such as `.beads/issues.jsonl` is excluded via `.gitignore` and is
  not shared through git. Only minimal markers (e.g., `.beads/metadata.json`)
  are tracked.
- beads therefore functions solely as a single-machine, single-developer task
  queue and cross-session memory.

Update this section if a Dolt remote is added later.

### Issue Types

- `bug` - Something broken that needs fixing
- `feature` - New functionality
- `task` - Work item (tests, docs, refactoring)
- `epic` - Large feature composed of multiple issues
- `chore` - Maintenance work (dependencies, tooling)

### Priorities

- `0` - Critical (security, data loss, broken builds)
- `1` - High (major features, important bugs)
- `2` - Medium (nice-to-have features, minor bugs)
- `3` - Low (polish, optimization)
- `4` - Backlog (future ideas)

### Dependency Types

- `blocks` - Hard dependency (issue X blocks issue Y)
- `related` - Soft relationship (issues are connected)
- `parent-child` - Epic/subtask relationship
- `discovered-from` - Track issues discovered during work

Only `blocks` dependencies affect the ready work queue.

### Issue Content

- Write all narrative fields (title, description, notes, design) in **Korean**.
  Identifiers, commands, file paths, and code snippets stay in their original
  form.
- Structure every issue description so that **WHAT** and **METHOD** are
  explicit:
  - **WHAT** — the target problem or outcome this issue addresses (why it
    exists, what must change).
  - **METHOD** — the agreed approach for resolving it (how the change will be
    made). Record only the approach here; implementation detail belongs in
    `notes` after the work is done (step 7).
- Use clear section headings (e.g., `## 무엇을 (WHAT)`, `## 어떻게 (METHOD)`) so
  both elements are unambiguously locatable.

### Agent Workflow

Every task that modifies files follows the 9 steps below. This applies even when
the user explicitly requests a simple documentation edit — no exceptions.

1. **Register the issue.** Before any file change, ensure a beads issue exists.
   If not, create one with a concise title, purpose, and the agreed approach
   only in the description (implementation detail is recorded later in step 7).
   If an issue already exists (`bd ready`, user pointer), confirm it covers the
   intended scope. Then request user direction.
2. **Await user direction.** Do not start work until the user signals `승인`.
   The user may approve multiple pre-registered issues at once.
3. **Transition to `in_progress`.** Immediately before touching any file, run
   `bd update <id> --status=in_progress`.
4. **Execute the work.**
5. **Report and request confirmation.** Summarize what changed.
6. **Branch on the user's response.**
   - `완료` → go to step 7.
   - Anything else → treat as feedback; return to step 4. Status stays
     `in_progress`.
7. **Update notes.** Record decisions, their reasoning, and points where
   feedback changed direction via `bd update <id> --notes="..."`. Skip anything
   already visible in the diff or commit message.
8. **Close the issue** with `bd close <id>`.
9. **Commit.** Stage only files belonging to this issue and commit. Never run
   `git push`; the user owns remote publication.

Work discovered mid-execution creates a new issue with a
`discovered-from:<parent-id>` dependency — continue the parent, do not switch.

### Session Signals

Only these literal keywords carry workflow meaning:

- **`승인`** — approval to proceed (step 1 → 3). Covers one or more
  pre-registered issues.
- **`완료`** — confirmation that the step 5 report is accepted (step 6 → 7).

Any other response during step 6 is treated as feedback and loops back to
step 4.

### Concurrency

Only **one** issue may be `in_progress` per session. Multiple issues can be
approved together, but execute them sequentially.

### Task Tracking

Use beads exclusively. Do **not** use `TodoWrite`, `TaskCreate`, or ad-hoc
markdown files for task tracking.

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

- Use **ECMAScript modules**.
- Use `PascalCase` for **classes** and **interfaces**.
- Use `camelCase` for **functions** and **methods**.
- Use `lower_snake_case` for **variables and parameters**.
  - Use `camelCase` for variables referencing functions or callable objects.
  - Use `PascalCase` only for class constructors or imported class symbols.
- Use `UPPER_SNAKE_CASE` for **constants**.
- Use `kebab-case` for **file and directory names**.
- Use `.js` files for all runtime code with JSDoc type annotations (TypeScript
  mode).
- Use `.ts` files **only** for interface and type definitions. These files must
  not contain runtime code or side effects.
- Place a JSDoc type import block at the top of each file when needed:
  ```js
  /**
   * @import { X, Y, Z } from './file.js'
   */
  ```
  Omit this block if the symbol is already defined within the file.
- Add JSDoc to all functions and methods:
  - Declare all parameters with `@param`.
  - Add `@returns` only when the return type is **not self-evident** from the
    code (e.g., complex conditionals, unions, or context-dependent types). Omit
    it when the return value is **clear and unambiguous** from the function body
    or signature.
- If a local variable’s type may change, or is initialized as an empty
  collection (`{}`, `[]`, `new Set()`, `new Map()`), add a `@type` JSDoc
  annotation to specify the intended type. This applies to both `let` and
  `const` when inference is ambiguous.
- Use braces for all control flow statements, even single-line bodies.
- Use optional chaining (`?.`, `??`, etc.) only when a value is **intentionally
  nullable**. Prefer explicit type narrowing to guarantee value safety.

## Unit Testing Standards

- Write short, focused test functions asserting **one specific behavior** each.
- Name tests using **active verbs** that describe behavior, e.g.
  `returns correct value`, `throws on invalid input`, `emits event`,
  `calls handler`. Avoid starting names with “should …”.
- Follow the structure: **setup → execution → assertion**, separating each block
  with a blank line for readability.

  ```js
  const store = createStore();

  const result = store.addItem('x');

  expect(result).toEqual('x');
  ```

- Do not modify implementation code to make tests pass; adjust the test or fix
  the underlying issue instead.

## Pre‑Handoff Validation

Validation is enforced structurally by lefthook (`lefthook.yml`); running the
checks manually is no longer required.

- **pre-commit** runs `prettier --write` and `eslint --fix` on staged files and
  re-stages the fixed output (`stage_fixed: true`).
- **pre-push** runs `pnpm all` (`lint → tsc → test → prettier:check`), matching
  the CI pipeline.

Hooks install automatically when `pnpm install` runs lefthook's postinstall
script (enabled via `pnpm.onlyBuiltDependencies` in `package.json`). If hooks
are missing after a fresh clone, run `pnpm exec lefthook install` once.
