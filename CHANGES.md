# Changes

## 0.16.0

- [`88e5ed5`](https://github.com/seungyeop-lee/beads-ui/commit/88e5ed5d18eb6dea75c59a320d899d1f4103de91)
  chore: move pnpm settings to pnpm-workspace.yaml
    >
    > pnpm 11 no longer reads the "pnpm" field in package.json and warned on
    > every command. Move the build-script allowlist to pnpm-workspace.yaml
    > using the new allowBuilds format (lefthook allowed, esbuild denied — it
    > ships platform binaries via optionalDependencies).
    >
- [`d9de748`](https://github.com/seungyeop-lee/beads-ui/commit/d9de74810e95e66542e5e46ff25d6a55a302a786)
  fix: drop postpack cleanup that breaks pnpm 11 pack/publish
    >
    > pnpm 11 stats the packed files after running postpack to print the
    > tarball report. The postpack `rm` deleted the freshly built bundle
    > first, so `pnpm pack` and `pnpm publish` exited non-zero even though
    > the tarball itself was valid — breaking install:global and the
    > postversion publish step.
    >
    > The bundle files are gitignored, so leaving them in the working tree
    > is harmless and prepack rebuilds them on every pack anyway.
    >
- [`045dcbf`](https://github.com/seungyeop-lee/beads-ui/commit/045dcbfa367488400a855c285f6cc0effb26f14e)
  fix(server): restore issue comments with bd 1.x
    >
    > Recent bd releases dropped the `comments` array from `bd show --json`
    > (only `comment_count` remains), so detail pushes carried no comments and
    > the detail view always showed "No comments yet". The client-side
    > get-comments fallback never fired because the detail store snapshot is
    > not available when the view loads.
    >
    > Compensate in the adaptation layer: when fetching an issue-detail
    > subscription, fetch comments via `bd comments <id> --json` and attach
    > them to the pushed item. Skip the extra call when `comment_count` is 0
    > or comments are already inline (older bd).
    >
    > Also replace the removed `bd comment --author` flag with the global
    > `--actor` flag so adding comments from the UI works again.
    >
- [`f727a00`](https://github.com/seungyeop-lee/beads-ui/commit/f727a002eb17557ad5f0c56628e0eb19a7787263)
  chore: add codegraph and MCP server configuration
- [`4204073`](https://github.com/seungyeop-lee/beads-ui/commit/42040737759f90d26b8d123df4d59794e038f37e)
  chore: bump pnpm to 11.5.2

_Released by [seungyeop-lee](https://github.com/seungyeop-lee) on 2026-06-05._

## 0.15.0

- [`cedbc9f`](https://github.com/seungyeop-lee/beads-ui/commit/cedbc9f27a37094457493524677752ccea3cf191)
  fix(views): widen issue ID columns
- [`56211b2`](https://github.com/seungyeop-lee/beads-ui/commit/56211b2180739201233fac01ed3c483d3532273b)
  chore(app): add favicon
- [`df5cb63`](https://github.com/seungyeop-lee/beads-ui/commit/df5cb63a041c93079b18480f4f418c5138e62936)
  chore: bump pnpm to 10.33.2
- [`b0d61ff`](https://github.com/seungyeop-lee/beads-ui/commit/b0d61ffe05a6645171c8f44e9fe6637d442c1d25)
  chore(beads): remove beads-starter workflow and setup docs

_Released by [seungyeop-lee](https://github.com/seungyeop-lee) on 2026-05-06._

## 0.14.1

- [`5bcfc72`](https://github.com/seungyeop-lee/beads-ui/commit/5bcfc72e719397b4c7748c961cc548645660397c)
  chore(beads): adopt beads-starter preset, drop duplicate workflow docs
- [`45c5d16`](https://github.com/seungyeop-lee/beads-ui/commit/45c5d163fcd9a59cea4733e8b85ac7a35615cdb6)
  fix(views/list): group by status so closed always sorts by closed_at desc
    >
    > Previously `cmpClosedDesc` only applied when the status filter was exactly
    > `[closed]`. With any other combination (e.g. Open + In progress + Closed,
    > or no filter) the whole list fell back to priority+created_at asc, placing
    > the oldest-closed item on top of the closed group.
    >
    > Split filtered items by status and sort each group independently:
    > open/in_progress by cmpPriorityThenCreated, closed by cmpClosedDesc, then
    > concat open → in_progress → closed. The `ready` filter is exclusive and
    > contains no closed items, so it keeps the single-sort path.
    >
    > Refs: bdui-9vz
    >

_Released by [seungyeop-lee](https://github.com/seungyeop-lee) on 2026-04-22._

## 0.14.0

- [`988ba65`](https://github.com/seungyeop-lee/beads-ui/commit/988ba6551446316b9ca831fe3811fc4c6a8bfd21)
  chore: add install:global and uninstall:global scripts, ignore .tgz
    >
    > - Add install:global script to pack and globally install via pnpm
    > - Add uninstall:global script to remove global package
    > - Ignore root-level *.tgz files from pnpm pack output
    >
- [`015f528`](https://github.com/seungyeop-lee/beads-ui/commit/015f52822675c2a73721b4ecb3238699ce63acdf)
  chore(docs): drop BEADS INTEGRATION block and relocate essential refs
    >
    > - Remove the auto-generated BEADS INTEGRATION section from AGENTS.md; its
    >   Workflow/Auto-Sync/Session Completion content duplicated or conflicted
    >   with the project-specific sections already above it.
    > - Merge Issue type and Priority metadata conventions into Issue Content.
    > - Move lifecycle/hygiene commands (defer, supersede, stale, orphans, lint,
    >   human, formula list, mol pour) into docs/beads-commands.md as a new
    >   Lifecycle Commands section.
    >
- [`15685c3`](https://github.com/seungyeop-lee/beads-ui/commit/15685c3d89c4dea026d104293aeb3c30914b683a)
  chore(beads): consolidate .beads/ gitignore and add fresh-clone setup guide
    >
    > - Untrack .beads/metadata.json (per-clone project_id UUID) and
    >   .beads/.gitignore (keep bd-related rules in one place)
    > - Track empty .beads/.gitkeep as "bd project" marker
    > - Replace individual-file ignores with `.beads/` + `!.beads/.gitkeep`
    >   in root .gitignore
    > - Add docs/bd-setup.md documenting the shared-server bd init sequence
    > - Update AGENTS.md Operating Mode to reference the new setup doc
    >
- [`4ec8833`](https://github.com/seungyeop-lee/beads-ui/commit/4ec88338d4050ffbd2f47837246632ef95a5ea0e)
  docs(agents): add Shell Safety subsection for bd narrative argument quoting
    >
    > Wrap bd narrative arguments (--description, --notes, --reason, comment
    > bodies, etc.) in single quotes by default so backtick-wrapped Korean text
    > is not silently dropped by the shell's command substitution. Heredoc is
    > documented as the fallback path when the content itself contains a single
    > quote.
    >
- [`542faf8`](https://github.com/seungyeop-lee/beads-ui/commit/542faf8b862b8f50d6e1a1770649e3792baa2088)
  docs(agents): split notes prefix and add conditional method alternatives
    >
    > Step 9 notes now distinguish `피드백으로 추가:` (scope added, METHOD intact)
    > from `결정 변경:` (METHOD revised); the latter also requires updating the
    > issue's `### 고려한 대안`. Issue Content gains a conditional
    > `### 고려한 대안` subsection that is added only when concrete alternatives
    > were compared, the user rejected an approach, or the step 6 feedback loop
    > changed METHOD itself.
    >
- [`25269f9`](https://github.com/seungyeop-lee/beads-ui/commit/25269f91d628e80ba426d49ceda493d1425c0a74)
  Revert "fix(header): simplify top-left brand area"
    >
    > This reverts commit 1243029ac2d321f63c0c1371a8e46e87006c6f50.
    >
- [`5a4c27e`](https://github.com/seungyeop-lee/beads-ui/commit/5a4c27e65994b8f67682864cea74978e10039aa6)
  chore(beads): expand .gitignore for runtime artifacts and add Dolt config to metadata
- [`bffc6e7`](https://github.com/seungyeop-lee/beads-ui/commit/bffc6e774cb70ba62d5ef533c33b3ac17d6b552f)
  docs(agents): require notes entry for feedback-added scope
    >
    > Extend workflow step 9 to make notes mandatory when step 6 feedback
    > expands the work beyond the original METHOD, with a short format
    > example recording the feedback item and its commit hash.
    >
- [`89dc5bb`](https://github.com/seungyeop-lee/beads-ui/commit/89dc5bb8664ca5a2d315ee991037235d158c035f)
  docs(agents): inline canonical bd syntax in workflow steps 8/10
    >
    > Add `bd comments add <id> "<text>"` with positional-text warning to step 8
    > and `bd close <id> --reason="..."` to step 10 so the correct syntax is
    > visible at the decision point rather than via indirect link.
    >
- [`f00330c`](https://github.com/seungyeop-lee/beads-ui/commit/f00330c404fed39d9817cc4c6c443cabe247c4d6)
  docs(agents): restructure AGENTS.md and extract command examples
    >
    > Move workflow command examples to docs/beads-commands.md and
    > reorganize AGENTS.md with project overview, dot graph workflow,
    > and beads integration section.
    >
- [`e6abdfc`](https://github.com/seungyeop-lee/beads-ui/commit/e6abdfc3236a81ce61c528d1e91c15a7b4fe718c)
  chore: add public access publishConfig to package.json

_Released by [seungyeop-lee](https://github.com/seungyeop-lee) on 2026-04-22._

## 0.13.0

- [`15d2d69`](https://github.com/seungyeop-lee/beads-ui/commit/15d2d69ac5e7ea458302b04f719b1bc7c064f93b)
  docs(agents): add epic creation workflow with dependency direction rule
- [`7e8bc7a`](https://github.com/seungyeop-lee/beads-ui/commit/7e8bc7a571f1083ec393e2cef01f1d66cec0f5c7)
  fix(detail): confirm dependency removals in dialogs
- [`41b3a99`](https://github.com/seungyeop-lee/beads-ui/commit/41b3a99dac90c236b6d05a9e0195fa79848c4338)
  fix(list): make ready a radio-like status filter
    >
    > Ready is a derived concept (open + no blockers) that conflicts with
    > other statuses. Selecting ready now clears other status checkboxes and
    > disables them; selecting another status clears ready.
    >
- [`8b55ee7`](https://github.com/seungyeop-lee/beads-ui/commit/8b55ee77110a7408eb8156bbc2ca7b96658dc311)
  docs(agents): add project-specific workflow examples
- [`f56c6ce`](https://github.com/seungyeop-lee/beads-ui/commit/f56c6ce0f5519420538b129b6dd227f241a88a2f)
  fix(subscriptions): add _board_column to JSDoc type definitions
    >
    > tsc reported TS2339 on line 130 because @param and module-level
    > itemsById type annotations did not include the _board_column property.
    >
- [`1243029`](https://github.com/seungyeop-lee/beads-ui/commit/1243029ac2d321f63c0c1371a8e46e87006c6f50)
  fix(header): simplify top-left brand area
    >
    > Keep the header brand to the workspace name only and rebalance spacing so the top navigation still aligns naturally.
    >
- [`ccd94a8`](https://github.com/seungyeop-lee/beads-ui/commit/ccd94a89c45f55e2e97c9a40fc82df56e7519eb4)
  feat(board): unify four column subscriptions into single board-issues subscription
    >
    > Replace four separate WebSocket subscriptions (ready, blocked, in_progress,
    > closed) with one board-issues subscription that fetches all columns in
    > parallel on the server and tags each issue with _board_column. The client
    > splits the unified snapshot into columns, eliminating sequential column
    > loading on initial board entry.
    >
- [`16af938`](https://github.com/seungyeop-lee/beads-ui/commit/16af938f616ef948ae19d0328a4c80f1118a78fc)
  chore: document beads completion workflow
- [`b278047`](https://github.com/seungyeop-lee/beads-ui/commit/b27804734a918cae837b6a2fdde159e290cb3a98)
  fix(issues): widen status column for in-progress label
- [`18d2170`](https://github.com/seungyeop-lee/beads-ui/commit/18d2170ed5fb39d7407b90b12eae841a037e8a52)
  fix(state): restore status filter dedupe semantics
- [`d1785d5`](https://github.com/seungyeop-lee/beads-ui/commit/d1785d5e8eede9a8a3c03978bd1aadfa3794a89c)
  feat(epics): sort by status rank then priority
- [`0f85a44`](https://github.com/seungyeop-lee/beads-ui/commit/0f85a445df79eeccef4a0f88c324d21bfec124ff)
  feat(epics): split epic header click targets into toggle bar and title
- [`95fcc47`](https://github.com/seungyeop-lee/beads-ui/commit/95fcc4783c7d995b4e9286c5fe8e7c09ddd22803)
  feat(detail): show created/updated/closed timestamps in properties
- [`f998c8a`](https://github.com/seungyeop-lee/beads-ui/commit/f998c8afe72f0bc0f36dc3445045ed883120e88c)
  feat(issues): default status filter to open+in_progress instead of all
- [`888717f`](https://github.com/seungyeop-lee/beads-ui/commit/888717f6a1e35cccb0925f07e18684a08d3d41aa)
  fix(styles): widen .md heading top/bottom asymmetry
    >
    > Raise `.md` h1~h6 top margins (20/20/18/16/12) while keeping bottom
    > margins small (6/6/6/4/4) so headings group with the following body
    > content in issue detail markdown blocks.
    >
    > Move the `.md { ... }` block to the end of styles.css so its heading
    > rules win source-order against same-specificity selectors like
    > `.detail-main h2 { margin: 0 0 32px }`, which otherwise overrode the
    > new margins inside the issue detail view.
    >
- [`0af4af0`](https://github.com/seungyeop-lee/beads-ui/commit/0af4af00abb2a8e30162d934b21d9a3c060d3193)
  fix(issues): include closed in multi-status filter via filtered-issues
    >
    > Route the Issues tab's status filter through a new `filtered-issues`
    > subscription that passes a CSV `--status` to `bd list`, so combinations
    > like Any, Closed+Open, or In progress+Closed no longer drop closed
    > items. Keeps `ready-issues`, `in-progress-issues`, and `closed-issues`
    > as single-selection fast paths.
    >
- [`623a7c9`](https://github.com/seungyeop-lee/beads-ui/commit/623a7c9196b2d5d4e9db8431c48ef92a9773924e)
  chore: document pnpm build need and verification-section policy
    >
    > Pre-Handoff Validation 에 UI 소스 변경 후 `pnpm build` 재생성 필요
    > 문구를 추가하고, Agent Workflow step 5 에 이슈의 `## 검증` 섹션을
    > 모두 수행하고 증거를 Report/Notes 에 남기지 않는 한 `완료` 로
    > 보고하지 않는다는 지침을 명시.
    >
- [`635f8f7`](https://github.com/seungyeop-lee/beads-ui/commit/635f8f7c6a96cbf20505b02c55f46ef5b40ba2ef)
  feat(issues): open detail on title click; edit via pencil icon
    >
    > Title 셀 클릭이 인라인 편집으로 빠지던 동작을 제거하고 행 클릭과
    > 동일하게 상세 뷰로 이동하도록 변경. 편집은 셀 우측 펜 아이콘
    > 버튼으로 분리하여 명확한 트리거로 재배치. hover/포커스 스타일을
    > 서로 다른 시각 언어로 분리해 외곽선 중첩을 피함.
    >
- [`41184d8`](https://github.com/seungyeop-lee/beads-ui/commit/41184d804fec158a7ca27561c87005b22478a3a6)
  chore: slim AGENTS.md and extract coding standards
    >
    > AGENTS.md가 199줄로 커져 bd CLI 일반 지식과 코딩 표준이 프로젝트 고유
    > 규약과 섞여 있었다. 권장안에 따라 중복·장황함을 제거하고 코딩 표준을
    > docs/coding-standards.md로 분리해 AGENTS.md를 88줄로 축약했다.
    >
- [`7096d86`](https://github.com/seungyeop-lee/beads-ui/commit/7096d86a5dea71e9bce40e888e5d87535d5b6373)
  chore: document local-only beads operating mode
    >
    > Add an Operating Mode section clarifying that this repo has no Dolt
    > remote, so bd dolt pull/push must not be run despite the SessionStart
    > hook's Session Close Protocol.
    >
- [`9ad044b`](https://github.com/seungyeop-lee/beads-ui/commit/9ad044b1ad0c499293fa48a69d7560d17e83cb28)
  fix: prevent long issue ID from overflowing into Type column
    >
    > Apply overflow: hidden and text-overflow: ellipsis on button.id-copy
    > so truncated IDs stay within the 100px ID column in fixed-layout tables.
    >
- [`94841dd`](https://github.com/seungyeop-lee/beads-ui/commit/94841ddd445c137db031f445144bd9195759c457)
  chore: add .idea to .gitignore
- [`ff4db5e`](https://github.com/seungyeop-lee/beads-ui/commit/ff4db5e6b19d3c843b9d0c9ef7c93166fdd41b10)
  chore: enforce validation via lefthook pre-commit/pre-push
    >
    > - Add lefthook devDep and pnpm.onlyBuiltDependencies entry so hooks
    >   install automatically on pnpm install.
    > - lefthook.yml runs prettier --write (+ stage_fixed) on staged
    >   js/ts/json/md/yml/yaml/css/html and eslint --fix on staged js
    >   in pre-commit; pre-push delegates to pnpm all.
    > - Rewrite AGENTS.md Pre-Handoff Validation section to describe the
    >   structural enforcement, ban hook bypass flags in Commit Rules, and
    >   note automatic hook installation in README.
    >
- [`f7e07a8`](https://github.com/seungyeop-lee/beads-ui/commit/f7e07a8287fbfdfa740351fe8dba282b23085ee0)
  style: fix prettier formatting in AGENTS.md
- [`d645c19`](https://github.com/seungyeop-lee/beads-ui/commit/d645c19312ed23e75d43504241473df1c784d4d8)
  chore(ci): add feature/** branches to trigger filters
- [`0ff6fb7`](https://github.com/seungyeop-lee/beads-ui/commit/0ff6fb74b42f81e81055bf729ad65340927e7dc5)
  chore(ci): bump GitHub Actions v4 to v6
- [`3c1732b`](https://github.com/seungyeop-lee/beads-ui/commit/3c1732b73426aa7d3a5ff04b83dc410c4d6f6373)
  chore: require Korean beads issues with explicit WHAT/METHOD
    >
    > Add an Issue Content section to AGENTS.md mandating Korean for narrative
    > fields and requiring every issue description to spell out WHAT and METHOD.
    >
- [`83550c5`](https://github.com/seungyeop-lee/beads-ui/commit/83550c5a3116f7947107201537fdd6f625428aa6)
  chore: add CLAUDE.md importing AGENTS.md
- [`9bc4c05`](https://github.com/seungyeop-lee/beads-ui/commit/9bc4c056590677dee6909bb74d237e582d665a16)
  chore: switch package manager from npm to pnpm
    >
    > - package.json: script calls and publish use pnpm, add packageManager field
    > - .github/workflows/ci.yml: adopt pnpm/action-setup and pnpm cache
    > - README.md: developer workflow uses pnpm; user install keeps npm with pnpm alternative noted
    > - AGENTS.md: Pre-Handoff Validation commands use pnpm
    > - .prettierignore: ignore pnpm-lock.yaml
    > - replace package-lock.json with pnpm-lock.yaml
    >
- [`c4994cb`](https://github.com/seungyeop-lee/beads-ui/commit/c4994cb2985f752b14f7b3f5bd7561a5e5d6cd98)
  chore: revise AGENTS.md with 9-step agent workflow
- [`9e76153`](https://github.com/seungyeop-lee/beads-ui/commit/9e76153d970f4bb6aa4b8c2dd373120056507178)
  chore: rebrand as @seungyeop-lee/beads-ui fork
    >
    > - Update package name, author, homepage, and repo URL
    > - Add fork attribution in README and LICENSE
    > - Remove .beads/issues.jsonl from tracking
    >

_Released by [seungyeop-lee](https://github.com/seungyeop-lee) on 2026-04-17._

## 0.12.0

- [`8559d4a`](https://github.com/mantoni/beads-ui/commit/8559d4af699555b9943914a2e790965c9e4d8da7)
  feat(cli): auto-increment port when default is in use (#73) (Leon Letto)
- [`527e9a5`](https://github.com/mantoni/beads-ui/commit/527e9a59a01e1b93c1488cb1e2ed26ae346b358c)
  feat(cli): preserve workspaces across bdui restart (#72) (Leon Letto)
- [`5996b39`](https://github.com/mantoni/beads-ui/commit/5996b39499bcf0e460133c27a7ee20b30c677ab5)
  chore: add dev-docs to .prettierignore (Leon Letto)
- [`08f1439`](https://github.com/mantoni/beads-ui/commit/08f1439d13fc5b534de13e1ea94af4407174d76f)
  style: fix prettier formatting in daemon and test files (Leon Letto)
- [`4a0c791`](https://github.com/mantoni/beads-ui/commit/4a0c791300f12e47faae74e8237f823857be7dd9)
  fix: resolve TS18048 type error in restart test (Leon Letto)
- [`c973d86`](https://github.com/mantoni/beads-ui/commit/c973d8693c6cfa3a5f8ad0905134465903e527a2)
  feat(cli): preserve listening port across bdui restart (Leon Letto)

_Released by [Maximilian Antoni](https://github.com/mantoni) on 2026-04-02._

## 0.11.3

- [`47261a7`](https://github.com/mantoni/beads-ui/commit/47261a7a95d5a17b480ae56c4a10b5eeb49d1007)
  feat: show close reason in issue detail view (#63) (Tom Preece)

_Released by [Maximilian Antoni](https://github.com/mantoni) on 2026-03-18._

## 0.11.2

- [`929a15d`](https://github.com/mantoni/beads-ui/commit/929a15da79ead6819044e50580093e3cbe87758b)
  Fix beads setup
- [`b354aa6`](https://github.com/mantoni/beads-ui/commit/b354aa63a7d04abe50b0da74c5c0e62077f44b69)
  fix: apply --port/--host overrides before workspace registration (Ryan Peterson)

_Released by [Maximilian Antoni](https://github.com/mantoni) on 2026-03-11._

## 0.11.1

- [`0fc2df7`](https://github.com/mantoni/beads-ui/commit/0fc2df7cbaeb6f0500900ce2bf87e6b3fa8e8ac0)
  style: fix prettier formatting in list-adapters test (Leon Letto)
- [`e00ddfc`](https://github.com/mantoni/beads-ui/commit/e00ddfc9b9d421dc31b7d7703f4bfbc9790546f8)
  fix: add --tree=false to bd list calls for bd 0.59.0 compat (Leon Letto)

_Released by [Maximilian Antoni](https://github.com/mantoni) on 2026-03-07._

## 0.11.0

- [`fc00b87`](https://github.com/mantoni/beads-ui/commit/fc00b87cfd1b6600a9b9088a9f62c2f6e8fc919e)
  fix(ui): harden daemon restart workspace registration (Leon Letto)
- [`2ea0dd0`](https://github.com/mantoni/beads-ui/commit/2ea0dd08eb71625fa3ae51e64ea6501b4d058154)
  perf(ui): reduce list latency by default sandbox bd calls (Leon Letto)

_Released by [Maximilian Antoni](https://github.com/mantoni) on 2026-03-05._

## 0.10.1

- [`62017f7`](https://github.com/mantoni/beads-ui/commit/62017f74fadb439c7270160ac03866d3554f36a3)
  fix: clipboard copy fallback for non-secure contexts (Rodrigo Blasi)

_Released by [Maximilian Antoni](https://github.com/mantoni) on 2026-03-02._

## 0.10.0

- [`998f256`](https://github.com/mantoni/beads-ui/commit/998f2562b3ad3203c9dd1f627d44b1c2d5ef03a4)
  Do not wrap issue IDs
- [`e3c3345`](https://github.com/mantoni/beads-ui/commit/e3c3345db41cd874db8e33ec79c904cc314e6bf8)
  Improve workspace resolution and fallback db
- [`6de4652`](https://github.com/mantoni/beads-ui/commit/6de4652c336f77c8d8ec9cc13f5a47e9ba1b3857)
  Avoid concurrent DB access to work around dolt panic
- [`011fe9e`](https://github.com/mantoni/beads-ui/commit/011fe9e3dfaa475f744b69ff6b44c3cc23283ad1)
  Support dolt backend
- [`63ed3c3`](https://github.com/mantoni/beads-ui/commit/63ed3c3f3f98aa2c6d621537887d98701289dac6)
  Update beads
- [`cd0a4c5`](https://github.com/mantoni/beads-ui/commit/cd0a4c59fcfe2c9a655ed2079a2a059a242906c5)
  docs: highlight multi-workspace feature in README (#47) (Pablo LION)

_Released by [Maximilian Antoni](https://github.com/mantoni) on 2026-02-25._

## 0.9.3

- [`2e04bc1`](https://github.com/mantoni/beads-ui/commit/2e04bc1eeb5c43e6934d858cd017d80f745a38bb)
  Add -v/—version flag to CLI (#46) (Brent Traut)

_Released by [Maximilian Antoni](https://github.com/mantoni) on 2026-01-23._

## 0.9.2

- [`ffa376c`](https://github.com/mantoni/beads-ui/commit/ffa376cab432b0e321232e8bc0de2caca20a6b17)
  Filter tombstone epics in list adapter (#44) (Brent Traut)

_Released by [Maximilian Antoni](https://github.com/mantoni) on 2026-01-22._

## 0.9.1

- [`bd6f412`](https://github.com/mantoni/beads-ui/commit/bd6f412570a6cb774a683106f9b6efa6ee0e318b)
  Add dependency/dependent counts to issues list view (#35) (Enan Srivastava)
- [`c6391d1`](https://github.com/mantoni/beads-ui/commit/c6391d1b4ea98ae06ea5bc0c251da57123370ef4)
  Fix stuck loading indicator during view switching (#28) (Ofer Shaal)

_Released by [Maximilian Antoni](https://github.com/mantoni) on 2026-01-05._

## 0.9.0

- [`21fdde2`](https://github.com/mantoni/beads-ui/commit/21fdde230713a58001974db29caf288deeedb371)
  Fix eslint warnings
- [`5fa7fea`](https://github.com/mantoni/beads-ui/commit/5fa7fead5359aa8f01d4e12a9432464af7276e33)
  Remove accidental bundle commit
- [`56819d3`](https://github.com/mantoni/beads-ui/commit/56819d321b35a77da690cf028672825752b45544)
  Add drag and drop to boards view (#30) (Brendan O'Leary)
- [`1c52c6f`](https://github.com/mantoni/beads-ui/commit/1c52c6f2a30b7d37439f291b1a3b1d4c26510396)
  Feature/filter toggles v2 (#20) (Frederic Haddad)
- [`b4c7ae6`](https://github.com/mantoni/beads-ui/commit/b4c7ae62fd93d7bbaee936e0f8b659beb774122d)
  fix: add windowsHide to prevent console flash on Windows (#29) (Titusz)
- [`63a269e`](https://github.com/mantoni/beads-ui/commit/63a269ec1f580728bc8977d00b150d69bc1ce535)
  feat: add multi-project workspace switching (#24) (Ofer Shaal)

_Released by [Maximilian Antoni](https://github.com/mantoni) on 2026-01-02._

## 0.8.1

- [`59715e8`](https://github.com/mantoni/beads-ui/commit/59715e8eb7834e6fb6ee8f63f2257da33831d705)
  Fix DB watch loop firing every second

_Released by [Maximilian Antoni](https://github.com/mantoni) on 2025-12-30._

## 0.8.0

- [`2cfcd2d`](https://github.com/mantoni/beads-ui/commit/2cfcd2d4d4aa670b67f7798ecf7dfebaf5d2383c)
  Feature/delete issue from detail (#15) (Frederic Haddad)

_Released by [Maximilian Antoni](https://github.com/mantoni) on 2025-12-22._

## 0.7.0

- [`255845f`](https://github.com/mantoni/beads-ui/commit/255845fd49a1e830dd56404d4d49d71c4f3bd18f)
  feat: add comments to issue detail view (Frederic Haddad)
    >
    > - Add get-comments and add-comment WebSocket handlers
    > - Display comments with author and timestamp in detail view
    > - Add comment input form with Ctrl+Enter submit
    > - Auto-fill author from git config user.name
    > - Fetch comments when loading issue details
    >
    > 🤖 Generated with [Claude Code](https://claude.com/claude-code)
    >
    > Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
    >
- [`a296e98`](https://github.com/mantoni/beads-ui/commit/a296e98dadb59d989cf2acac15666c0d38c635d6)
  Add CHANGES.md to prettier ignore

_Released by [Maximilian Antoni](https://github.com/mantoni) on 2025-12-19._

## 0.6.0

- [`2e25941`](https://github.com/mantoni/beads-ui/commit/2e259418ab24367468daa4449833550f1e9cb297)
  feat(cli): add --host and --port options (cc-vps)
    >
    > Add CLI options to configure the server bind address and port,
    > making it easier to expose the UI on different network interfaces
    > or run multiple instances on different ports.
    >
    > - Add --host <addr> option (default: 127.0.0.1)
    > - Add --port <num> option (default: 3000)
    > - Support HOST and PORT environment variables
    > - Parse --host/--port in server/index.js for dev workflow
    > - Add test coverage for new options
    >
    > Co-authored-by: Christian Catalan <crcatala@gmail.com>
    >
- [`6327f77`](https://github.com/mantoni/beads-ui/commit/6327f779f7b6ad7d274a37168320442bf013b4e0)
  Fix GitHub action commands

_Released by [Maximilian Antoni](https://github.com/mantoni) on 2025-12-17._

## 0.5.0

- [`76964c1`](https://github.com/mantoni/beads-ui/commit/76964c1daf133dded6b8f335cfe9d3184ac96a18)
  Show badge with number of cards per column
- [`155316c`](https://github.com/mantoni/beads-ui/commit/155316c975a93edc806379e769b538c213ee5ed8)
  Add loading indicator
- [`80a837a`](https://github.com/mantoni/beads-ui/commit/80a837a0ef9702fbb7cbbf168526a5a5e3e80d54)
  Show fatal errors in UI
- [`06e8fd9`](https://github.com/mantoni/beads-ui/commit/06e8fd9293b226c88d8b395c7bc28b9c7f4c9610)
  Beads metadata
- [`233c70a`](https://github.com/mantoni/beads-ui/commit/233c70aa9b6ed6e2d7fef487c7b241ffe721cecd)
  npm audit
- [`37b3476`](https://github.com/mantoni/beads-ui/commit/37b3476bc7a0061484de913bee00f285a073ea24)
  Upgrade marked
- [`a1362c9`](https://github.com/mantoni/beads-ui/commit/a1362c97fc770cb18764305453b18f71830bdbef)
  Update express and types
- [`8efc40d`](https://github.com/mantoni/beads-ui/commit/8efc40dadc051a826c64474a1254641294337a81)
  Update vitest, jsdom and esbuild
- [`89cac0f`](https://github.com/mantoni/beads-ui/commit/89cac0ff438a7f1d8b790f339064f2b49ef8ab13)
  Update eslint and plugins
- [`0d7e33e`](https://github.com/mantoni/beads-ui/commit/0d7e33e55259d11c39820c1576db74b7fec26b5e)
  Update prettier and format files
- [`356a201`](https://github.com/mantoni/beads-ui/commit/356a201af8cfce75d82a7f942b5d04698400715c)
  Rename npm scripts for prettier and tsc
- [`31b25d4`](https://github.com/mantoni/beads-ui/commit/31b25d42d23e60c4b30b29281c392179104bf813)
  Upgrade @trivago/prettier-plugin-sort-imports

_Released by [Maximilian Antoni](https://github.com/mantoni) on 2025-12-08._

## 0.4.4

- [`d0f8d1d`](https://github.com/mantoni/beads-ui/commit/d0f8d1d088eda78da14d35ac4fd898cbeb68b534)
  Make labels a separate section in the sidebar
- [`c44fd34`](https://github.com/mantoni/beads-ui/commit/c44fd3484ade8ef7ea56eb608d11bb07ebbf665b)
  Fix flaky board test due to time-sensitive closed filter (Nikolai
  Prokoschenko)

_Released by [Maximilian Antoni](https://github.com/mantoni) on 2025-11-13._

## 0.4.3

- [`4a5b4cd`](https://github.com/mantoni/beads-ui/commit/4a5b4cda8b22437eac2636c0a5556d0b52897f5f)
  Add author (ignore in changes)
- [`a34855e`](https://github.com/mantoni/beads-ui/commit/a34855ea26304554df2056ac6ed5224db25d795a)
  Ignore tsconfig.tsbuildinfo
- [`a7ebbc1`](https://github.com/mantoni/beads-ui/commit/a7ebbc1ba8538107f0ec106638115c4d78c48711)
  Add logging instead of ignoring issues
- [`54c9488`](https://github.com/mantoni/beads-ui/commit/54c94885c28a9bbdaaa60de6eaf8b91eac567bec)
  Mention `npm link` for development
- [`a137db0`](https://github.com/mantoni/beads-ui/commit/a137db02386457b7277f9566b5f6fc0079581bf7)
  Display beads issue ID as is
- [`ee343ee`](https://github.com/mantoni/beads-ui/commit/ee343ee39cc5ef9c7d7ec7df0a4f2b2f0e4b51ba)
  Remove try-catch around localStorage access
- [`619a107`](https://github.com/mantoni/beads-ui/commit/619a107948b47bcfa6c7102ca0e90f3d575ac3a8)
  Upgrade vitest to v4
- [`caed1b5`](https://github.com/mantoni/beads-ui/commit/caed1b5005645c2cf566ac3c3eddc4b5b73a4f74)
  Use vitest restoreMocks config
- [`0a28b5b`](https://github.com/mantoni/beads-ui/commit/0a28b5bf5cc278a6775a051c712ff560dfab2b81)
  Fix: Use BEADS_DB env var instead of --db flag (Nikolai Prokoschenko)

_Released by [Maximilian Antoni](https://github.com/mantoni) on 2025-11-01._

## 0.4.2

- [`66e31ff`](https://github.com/mantoni/beads-ui/commit/66e31ff0e053f3691657ce1175fd9b02155ca699)
  Fix pre-bundled app: Check for bundle instead of NODE_ENV

_Released by [Maximilian Antoni](https://github.com/mantoni) on 2025-10-29._

## 0.4.1

- [`03d3477`](https://github.com/mantoni/beads-ui/commit/03d34774cd35bf03d142d2869633327cbe4902bd)
  Fix missing protocol.js in bundle

_Released by [Maximilian Antoni](https://github.com/mantoni) on 2025-10-29._

## 0.4.0

- [`20a787c`](https://github.com/mantoni/beads-ui/commit/20a787c248225b4959b18b703894daf483f380b6)
  Refine and apply coding standards
- [`aedc73f`](https://github.com/mantoni/beads-ui/commit/aedc73f0c494dd391fcc9ec7ecbf19b01b37e69a)
  Invert CLI option from no_open to open
- [`03a2a4f`](https://github.com/mantoni/beads-ui/commit/03a2a4f0ddb93df717e9f12b0c4600be12b390b5)
  Add debug-based logging across codebase
- [`eed2d5c`](https://github.com/mantoni/beads-ui/commit/eed2d5c71c45131023d1ec047a9f84e84d057fdb)
  Pre-bundle frontend for npm package
- [`d07f743`](https://github.com/mantoni/beads-ui/commit/d07f7437c67bfdbded470c6ccea556a78b3452b3)
  Remove obsolete BDUI_NO_OPEN
- [`1c1a003`](https://github.com/mantoni/beads-ui/commit/1c1a0035fd069d030430d56713e64fbaf0224db8)
  Improve project description

_Released by [Maximilian Antoni](https://github.com/mantoni) on 2025-10-28._

## 0.3.1

- [`3912ae5`](https://github.com/mantoni/beads-ui/commit/3912ae552b1cc97e61fbaaa0815ca77675c542e4)
  Status filter intermittently not applied on Issues screen
- [`a160484`](https://github.com/mantoni/beads-ui/commit/a16048479d1d7d61ed4ad4e53365a5736eb053af)
  Upgrade eslint-plugin-jsdoc and switch config

_Released by [Maximilian Antoni](https://github.com/mantoni) on 2025-10-27._

## 0.3.0

- 🍏 Rewrite data-exchange layer to push-only updates via WebSocket.
- 🐛 Heaps of bug fixes.

## 0.2.0

- 🍏 Add "Blocked" column to board
- 🍏 Support `design` in issue details
- 🍏 Add filter to closed column and improve sorting
- 🍏 Unblock issue description editing
- 🍏 CLI: require --open to launch browser, also on restart
- 🍏 Up/down/left/right keyboard navigation on board
- 🍏 Up/down keyboard navigation on issues list
- 🍏 CLI: require --open to launch browser
- 🍏 Make issue notes editable
- 🍏 Show toast on disconnect/reconnect
- 🍏 Support creating a new issue via "New" dialog
- 🍏 Copy issue IDs to clipboard
- 🍏 Open issue details in dialog
- 🐛 Remove --limit 10 when fetching closed issues
- ✨ Events: coalesce issues-changed to avoid redundant full refresh
- ✨ Update issues
- ✨ Align callback function naming
- 📚 Improve README
- 📚 Add package description, homepage and repo

## 0.1.2

- 📦 Specify files to package

## 0.1.1

- 📚 Make screenshot src absolute and add license

## 0.1.0

- 🥇 Initial release
