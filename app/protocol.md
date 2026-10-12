# beads-ui WebSocket Protocol (v2.0.0)

Note (2025-10-26)

- The server no longer implements legacy read RPCs `list-issues` and
  `epic-status`. Clients must use the push-only protocol described in
  `docs/protocol/issues-push-v2.md` (subscribe-list with per-subscription events
  snapshot/upsert/delete). The shapes below are retained for historical
  reference of v1.

This document defines the JSON messages exchanged between the browser client and
the local server.

- Transport: single WebSocket connection
- Encoding: JSON text frames
- Correlation: all request/response pairs share the same `id`

## Envelope Shapes

- RequestEnvelope: `{ id: string, type: string, payload?: any }`
- ReplyEnvelope:
  `{ id: string, ok: boolean, type: string, payload?: any, error?: { code: string, message: string, details?: any } }`

Server may send unsolicited events (e.g., subscription
`snapshot`/`upsert`/`delete`) using the ReplyEnvelope shape with `ok: true` and
a generated `id`.

## Message Types

- Removed in v2: `list-issues` (use subscriptions + push stores)
- `update-status` payload:
  `{ id: string, status: 'open'|'in_progress'|'closed', force?: boolean }`
  (`force: true` closes despite bd's close policy — open children or a live
  blocker — mirroring `bd update --force`; only honored for `closed`)
- `edit-text` payload:
  `{ id: string, field: 'title'|'description'|'acceptance'|'notes'|'design', value: string }`
- `update-priority` payload: `{ id: string, priority: 0|1|2|3|4 }`
- `create-issue` payload:
  `{ title: string, type?: 'bug'|'feature'|'task'|'epic'|'chore'|'decision'|'spike'|'story'|'milestone', priority?: 0|1|2|3|4, description?: string }`
- `list-ready` payload: `{}`
- Removed in v2: `subscribe-updates` and the `issues-changed` event. All list
  and detail updates flow via per-subscription push envelopes
  (`snapshot`/`upsert`/`delete`).
- `dep-add` payload: `{ a: string, b: string, view_id?: string }` where `a`
  depends on `b` (i.e., `a` is blocked by `b`). Reply payload is the updated
  issue for `view_id` (or `a` when omitted).
- `dep-remove` payload: `{ a: string, b: string, view_id?: string }` removing
  the `a` depends on `b` link. Reply payload is the updated issue for `view_id`
  (or `a`).

## Mapping to `bd` CLI

- Removed in v2: `list-issues` → use subscriptions and push
  (`docs/protocol/issues-push-v2.md`)
- `update-status` → `bd update <id> --status <status>` (plus `--force` when
  `force: true` and status is `closed`)
- `edit-text` → `bd update <id> --title <t>` or `--description <d>` or
  `--acceptance-criteria <a>` or `--design <z>`; `notes` maps to
  `--notes <n> --force` (the UI editor is a sighted edit) and an empty value to
  `--clear-notes` (`--notes ""` on bd ≤ 1.3.1)
- `update-priority` → `bd update <id> --priority <n>`
- `create-issue` → `bd create "title" -t <type> -p <prio> -d "desc"`
- `list-ready` → `bd ready --json`

## Errors

Errors follow the shape `{ code, message, details? }`. Common codes:

- `bad_request` – malformed payload or unknown type
- `not_found` – entity not found (e.g., issue id)
- `close_blocked` – bd refused the close (open children / live blocker);
  `message` carries bd's guidance, retry with `force: true` to override
- `bd_error` – underlying `bd` command failed
