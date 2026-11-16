# Revio

A desktop app for doing code reviews faster: a review inbox with alerts, your own review guides per repo/folder,
a GitHub-style diff with draft comments, and a Claude briefing that tells you what a PR does, where to look and what to skip.

Electron 45 · TypeScript 7 · React 19 · Tailwind 4 · electron-vite.

## Run

```bash
npm install
npm run dev        # hot-reloading dev app
npm run typecheck  # tsc 7 (native) for main, renderer and tests
npm test           # Vitest: diff parsing, alerts, stacks, guidelines, caching, Claude context
npm run dist       # build a .dmg into dist/
```

**GitHub:** uses `gh auth token` automatically. To see team names on team review requests, the token needs
`read:org` (`gh auth refresh -s read:org`), or paste a token in Settings (stored encrypted via the macOS keychain).

**Claude:** "Auto" uses an Anthropic API key if one is set (Settings or `ANTHROPIC_API_KEY`), otherwise your local
Claude Code login via `claude -p` with structured JSON output. Default model: `claude-opus-5-5`.

## Tests

`test/` covers the logic that is easy to get subtly wrong: diff parsing and split pairing, comment anchors,
review/stale alert rules, stack detection (against a fake GitHub GraphQL), guideline scoping and ordering,
the PR cache, state pruning, and how the Claude prompt fits diffs into its budget. Electron and GitHub are
mocked; nothing hits the network. React components are not tested yet.

## Performance notes

- The inbox is the only screen in the startup bundle (~235 KB minified); the PR page, guides and settings load on first use.
- Syntax highlighting runs in a Web Worker (`src/renderer/src/workers/highlight.worker.ts`); grammars load per language.
- A file's diff body renders only near the visible area (`useNearViewport`), with a same-height placeholder elsewhere.
  Bodies with a selection or a focused comment box never unmount.
- Hovering an inbox row for 150 ms prefetches the PR; a copy up to 2 minutes old opens instantly and refreshes in the background.
- Stack detection is cached for 15 minutes while the inbox's PRs and branches are unchanged.
- Per-PR local state (drafts, viewed, chats, briefings) untouched for 45 days is pruned on startup.

## How it fits together

| Where | What |
| --- | --- |
| `src/main/poller.ts` | Polls GitHub every N minutes and shows notifications. Dock badge = queue size. |
| `src/main/alerts.ts` | When to alert: new/re-requested reviews and stale ones (first run records the backlog silently). No Electron, so it is unit-tested. |
| `src/main/github.ts` | GraphQL inbox search (requested + reviewed-and-still-open), PR files/comments, review submission. |
| `src/main/stacks.ts` / `stackGraph.ts` | Walks branch links on GitHub (batched GraphQL) / turns the PRs found into ordered stacks. |
| `src/main/guidelines.ts` | Guides stack: all repos → repo root → folders (only when the PR touches that folder). |
| `src/main/claude.ts` | Builds the prompt (guides + description + full diff + existing comments) and returns a typed briefing. |
| `src/main/store.ts` | JSON store in `~/Library/Application Support/Revio/revio.json` (settings, guides, drafts, viewed files, briefings); `pullState.ts` prunes PRs untouched for 45 days. |
| `src/renderer/` | Inbox, PR view (Overview with briefing / Files changed), Guides editor, Settings. |

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

## Diff tips

- Click a line number to comment; **click and drag** down the line numbers (or **shift-click**) to comment on a range.
- **± Suggest change** inserts a GitHub `suggestion` block with the selected lines.
- Drafts persist locally until you **Finish review** (Comment / Approve / Request changes), or use **✓ Approve** in the PR header.
  A chip shows your last review on the PR (e.g. *You approved · new commits since*).
- "Viewed" resets automatically when a file changes in a new push.
- **Keyboard:** `j` / `k` next / previous file, `v` toggles viewed and jumps to the next unviewed file (ignored while typing).
- **Unified / Split** toggle above the files; code is syntax highlighted (Shiki, per hunk, no WebAssembly).

## Ask Claude about a selection

Select code in the diff with the mouse (or use the **✦ Ask Claude** button in the comment box after picking lines in
the gutter). Claude gets the selected lines, the whole file at the PR head (and at the base for removed lines),
the PR description, the full diff, your guides and the briefing gist. Answers stream into a side panel; follow-ups
keep the conversation, and **Use as draft comment** turns an answer into a pending comment on those lines.
Conversations are saved per PR (header button **✦ N Claude chats**).
