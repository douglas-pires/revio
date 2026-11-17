<img src="build/icon.png" alt="" width="96" align="left">

# Revio

A desktop app for doing code reviews faster: a review inbox with alerts, your own review guides per repo/folder,
a GitHub-style diff with draft comments, and a Claude briefing that tells you what a PR does, where to look and what to skip.

Electron 45 · TypeScript 7 · React 19 · Tailwind 4 · electron-vite.

## Run

```bash
npm install
npm run dev        # dev app; reloads the window and restarts on main-process changes (--watch)
npm run typecheck  # tsc 7 (native) for main, renderer and tests
npm test           # Vitest: diff parsing, alerts, stacks, guidelines, caching, Claude context
npm run dist       # build a .dmg into dist/
```

**GitHub:** Revio uses, in order: a token pasted in **Settings → GitHub** (checked with GitHub, then stored encrypted
via the macOS keychain), `GITHUB_TOKEN` (or `GH_TOKEN`) in the project's `.env` when running from source, then
`GH_TOKEN` / `GITHUB_TOKEN` from the environment, then `gh auth token`. Settings shows which one is in use, the
account and its scopes. Team names on team review requests need `read:org`; Settings warns when the token lacks it.

**Claude:** "Auto" uses an Anthropic API key if one is set (Settings or `ANTHROPIC_API_KEY`), otherwise your local
Claude Code login via `claude -p` with structured JSON output. Default model: `claude-opus-5-5`.

## Tests

Specs sit next to the code they cover (`inbox-query.util.ts` → `inbox-query.util.spec.ts`); shared fixtures and the
Electron mock live in `test/`. They cover the logic that is easy to get subtly wrong: diff parsing and split pairing,
comment anchors, review/stale/mention alert rules, team vs direct requests, stack detection (against a fake GitHub
GraphQL), guideline scoping, search qualifiers, thread and mention triage, token lookup order, caches, state pruning,
and how the Claude prompt fits diffs into its budget. Electron and GitHub are mocked; nothing hits the network.
React components are not tested yet.

## Performance notes

- The inbox is the only screen in the startup bundle (~235 KB minified); the PR page, guides and settings load on first use.
- Syntax highlighting runs in a Web Worker (`src/renderer/src/highlight/highlight.worker.ts`); grammars load per language.
- A file's diff body renders only near the visible area (`use-near-viewport.hook.ts`), with a same-height placeholder elsewhere.
  Bodies with a selection or a focused comment box never unmount.
- Hovering an inbox row for 150 ms prefetches the PR; a copy up to 2 minutes old opens instantly and refreshes in the background.
- Stack detection is cached for 15 minutes while the inbox's PRs and branches are unchanged.
- Per-PR local state (drafts, viewed, chats, briefings) untouched for 45 days is pruned on startup.

## How it fits together

Code is grouped by domain. File names are kebab-case `<name>.<role>.ts`, NestJS style:

| Role | Holds |
| --- | --- |
| `.service` | Talks to GitHub, Claude, disk or the OS for one domain |
| `.util` | Pure logic, no I/O; the most tested part |
| `.client` / `.cache` / `.poller` / `.watcher` | The GitHub client; time-limited caches; scheduled refreshes |
| `.controller` / `.window` | The IPC API handlers; the app window (main process) |
| `.types` / `.contract` | Shared types per domain; the renderer ↔ main API |
| `.view` / `.component` / `.hook` / `.worker` | Screens; React components; React hooks; Web Workers (renderer) |
| `.spec` | Tests, beside the file they cover |

| Where | What |
| --- | --- |
| `src/main/index.ts` | Composition root: creates the services once and wires them together. |
| `src/main/app/` | `api.controller.ts` answers renderer calls by domain; `app.window.ts` owns the window. |
| `src/main/inbox/` | Inbox search and sorting, the poller (dock badge = queue size), direct vs team requests. A PR leaves the queue once you have reviewed it since you were asked, even if a team request remains or search lags. |
| `src/main/alerts/` | When to alert (new/re-requested, stale, mentions; first run records the backlog silently), and macOS notifications. |
| `src/main/pulls/` | PR details, thread status, reviews, replies; the PR cache; pruning of PRs untouched for 45 days. |
| `src/main/stacks/` | Walks branch links on GitHub (batched GraphQL) / turns the PRs found into ordered stacks. |
| `src/main/threads/`, `src/main/mentions/` | Unresolved review threads; PRs that mention you or your teams. |
| `src/main/github/` | The authenticated client and which token it uses. |
| `src/main/guidelines/`, `src/main/claude/` | Review guides (all repos → repo → folder); briefings and Ask Claude. |
| `src/main/store/` | JSON store in `~/Library/Application Support/Revio/revio.json`; tokens encrypted via the macOS keychain. |
| `src/renderer/src/` | One folder per screen or feature (`inbox`, `threads`, `mentions`, `pull`, `settings`, `guidelines`, `highlight`) plus `common` for shared UI and helpers. |
| `src/shared/` | Types per domain and the IPC contract, used by both processes. |

## Inbox search

The search box (press `/`) takes free text plus GitHub's qualifiers:

| Qualifier | Keeps |
| --- | --- |
| `user-review-requested:@me` | Requests addressed to you directly |
| `team-review-requested:web` (or `org/web`, `*` for any team) | Requests that reach you through a team |
| `review-requested:@me` | Every open request, hiding PRs you already reviewed |
| `repo:`, `author:`, `head:`, `base:` | One repository (owner/name or name), author, or branch |
| `is:stale`, `is:draft`, `is:stacked`, `is:approved`, `is:changes-requested` | Those states |
| `is:bot` | Threads whose last comment is from a bot (`-is:bot` hides them) |

Prefix any qualifier with `-` to exclude it. The **Requested from: All · Me · @team** buttons rewrite the query the
same way. Without the `read:org` scope GitHub hides team names, so team requests are grouped as `@team`;
`gh auth refresh -s read:org` shows the real names. The search is kept while you open a PR and come back.

## Threads

The inbox's **Threads** tab lists unresolved review threads on open PRs you are involved in (yours, or ones you
commented on), in two groups: **Waiting on your reply** (someone else spoke last) and **Waiting on others** (your
comment has no answer yet), oldest first and grouped by PR. The tab count is how many wait on you. Clicking a
thread opens the PR at that file and line; outdated threads open the file. **Reply** posts right away (⌘↵) and moves
the thread to *Waiting on others*; **Resolve** resolves it on GitHub and keeps the row with **Undo** until the next refresh. The search box filters threads too (PR,
file path, comment text, `repo:`, `author:`, `-is:bot`). It covers the 30 most recently updated PRs you are involved
in, and the last 10 comments of each thread; general PR conversation comments are not included, since only review
threads can be resolved. Threads load when the inbox opens (reused for 2 minutes) and on **Refresh**.

## Stacked PRs

The inbox has a **Queue / Stacks** switch. Revio detects stacks from branches (a PR whose base branch is another open PR's
head branch sits on top of it), walking up and down from every PR in your inbox, so stack members that were not
requested from you show up too (marked *not requested*). Stacks are listed bottom-up, which is review order. Queue rows in a stack get a
**⧉ stack 2/4** chip that jumps to the stack.

Inside a stacked PR, a stack bar under the header shows every PR in the stack (with status dots), **‹ Prev / Next ›**,
and a warning when the PR it builds on is not approved yet.

## Markdown

PR descriptions, comments, guides and Claude answers render like GitHub: inline HTML (`<details>`, `<img width>`,
`<p align>`…) sanitized with GitHub's allow-list, and ```` ```mermaid ```` blocks drawn as diagrams (loaded on demand,
follows light/dark; click a diagram to zoom, hover for **Source**). Images that need a GitHub login become links.

## Mentions

The **Mentions** item in the sidebar lists PRs where someone mentioned you (`@you`) or one of your teams
(`@org/team`, needs `read:org`) in the last 14 days: in the description, a comment, a review or a review comment.
Each mention shows who, where (file and line for review comments) and the text around the mention, newest first.
**New** means unread in your GitHub notifications; the sidebar badge counts PRs with new mentions.

- Clicking a mention opens the PR (at the line for review comments) and marks its GitHub notification read, as
  github.com does. **Mark read** does only the latter. **GitHub ↗** opens the comment on GitHub, useful for
  conversation comments, which Revio's PR view does not show.
- Candidates come from both `mentions:@me` search and your notifications, because search misses some review
  comments and a notification keeps only its latest reason. Mentions in code blocks or quoted replies don't count,
  nor do your own comments.
- A desktop notification fires for each new mention (Settings → Alerts → "Notify when you or your team are
  mentioned"); the first fetch after install records existing ones silently. Mentions refresh with the inbox.
- Fine-grained tokens cannot read notifications: mentions still show, but none are marked new.

## Comments panel

On **Files changed**, the right-hand panel lists every review thread grouped by file (in file-list order), with who
started it, a preview, replies and the last replier. Open threads show by default; **Show N resolved** reveals the
rest. Your pending (draft) comments are listed at the top. Clicking an item jumps to its line. The 💬 button in the tab
bar shows the open count and hides or shows the panel (remembered). The Ask Claude panel takes its place while open.

## Diff tips

- Click a line number to comment; **click and drag** down the line numbers (or **shift-click**) to comment on a range.
- **± Suggest change** inserts a GitHub `suggestion` block with the selected lines.
- Drafts persist locally until you **Finish review** (Comment / Approve / Request changes), or use **✓ Approve** in the PR header.
  A chip shows your last review on the PR (e.g. *You approved · new commits since*).
- "Viewed" resets automatically when a file changes in a new push.
- **Keyboard:** `j` / `k` next / previous file, `v` toggles viewed and jumps to the next unviewed file (ignored while typing).
- **Unified / Split** toggle above the files; code is syntax highlighted (Shiki, per hunk, no WebAssembly).
- Click a branch name in the PR header to copy it (e.g. to `git checkout` it locally).

## Comment on a whole file

**+ File comment** in a file's header comments on the file without picking a line (it expands the file if needed).
These show under **On this file** at the top of the diff, alongside GitHub's existing file comments, and in the
comments panel as "file". They are added to your review like line comments: since GitHub's review call cannot
carry file comments, Revio creates the review pending, adds each file comment to it, then submits it, and deletes
the pending review if any step fails.

## Blame and file history (GitLens-style)

- **Blame** above the files turns on line blame: hover a line to see who last changed it, when, and the commit
  message, after the code. Click it to open the commit on GitHub. Blame is for the PR head and loads per file as you
  scroll to it.
- **History** in a file's header opens the file's last 30 commits in a side panel, with this PR's own commits marked.
  Expand one to see what it changed in that file, copy its sha or open it on GitHub.

Blame, history and commit diffs are cached per commit sha, since they never change for one.

## Reactions

Review comments show their emoji reactions. Click one to add or take back yours, or **☺+** to pick any of GitHub's
eight (👍 👎 😄 🎉 😕 ❤️ 🚀 👀). Your reaction shows right away and is sent to GitHub at once (not held for the review);
if GitHub refuses, it is rolled back with the reason.

## Ask Claude about a selection

Select code in the diff with the mouse (or use the **✦ Ask Claude** button in the comment box after picking lines in
the gutter). Claude gets the selected lines, the whole file at the PR head (and at the base for removed lines),
the PR description, the full diff, your guides and the briefing gist. Answers stream into a side panel; follow-ups
keep the conversation, and **Use as draft comment** turns an answer into a pending comment on those lines.
Conversations are saved per PR (header button **✦ N Claude chats**).
