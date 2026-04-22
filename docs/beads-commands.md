# Beads Command Examples

`bd` command examples for common workflows.

## Starting Work

```
bd ready                              # List unblocked issues
bd show <id>                          # Review issue details
# After user says "승인":
bd update <id> --status=in_progress   # Transition before touching any file
```

## Completing Work

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

## Mid-Execution Discovery

Do not interrupt the current issue. Create a new issue and link it with a
`discovered-from` dependency:

```
bd create --title="Newly discovered work" --description="..." --type=task
bd dep add <new-id> <current-id>      # new-id depends on current-id
```

Then continue working on the current issue.

## Creating Epics

`bd epic status` only recognizes an epic when **children depend on the epic**
(not the other way around). Adding the dependency as `epic → child` causes
`bd epic status` to return an empty list.

```
# 1. Create the epic
bd create --title="Epic title" --description="..." --type=epic

# 2. Create child tasks
bd create --title="Task A" --description="..." --type=task
bd create --title="Task B" --description="..." --type=task

# 3. Link: child → epic (parent-child)
bd dep add <child-id> <epic-id> --type=parent-child
```

Use `--parent` to link at creation time:

```
bd create --title="Task A" --description="..." --type=task --parent=<epic-id>
```

**Direction rule:** `bd dep add A B` means "A depends on B", so for epics `A` is
the child and `B` is the epic.

## Lifecycle Commands

Adjunct commands outside the main 10-step flow.

- `bd defer <id>` — park an issue without closing it.
- `bd supersede <id>` — mark an issue as replaced by another.
- `bd stale` — surface issues that have gone quiet.
- `bd orphans` — surface issues missing expected dependency links.
- `bd lint` — check issue hygiene.
- `bd human <id>` — flag an issue as requiring a human decision.
- `bd formula list` / `bd mol pour <name>` — structured workflow templates.
