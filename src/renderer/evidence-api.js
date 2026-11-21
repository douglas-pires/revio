// Stand-in for the preload API with made-up data, for evidence screenshots only. Never committed.
;(() => {
  const now = Date.now()
  const hoursAgo = (hours) => new Date(now - hours * 3_600_000).toISOString()
  const avatar = (seed) => 'data:image/svg+xml;utf8,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><rect width="40" height="40" rx="20" fill="' + seed + '"/></svg>')
  const people = { dana: avatar('#7c8cff'), ana: avatar('#3fb950'), bo: avatar('#d29922'), cy: avatar('#f778ba'), ci: avatar('#8b949e') }
  const summary = (number, title, extra = {}) => ({
    id: 'PR_' + number, number, title, url: 'https://github.com/acme/web/pull/' + number, repo: 'acme/web',
    author: 'dana', authorAvatar: people.dana, isDraft: false, createdAt: hoursAgo(40), updatedAt: hoursAgo(number % 9 + 1),
    requestedAt: null, viaTeam: null, yourLastReviewAt: null, additions: 120 + number, deletions: 30, changedFiles: 6,
    headRef: 'dana/feature-' + number, baseRef: 'main', reviewDecision: 'REVIEW_REQUIRED', defaultBranch: 'main',
    stale: false, waitingHours: 5, ...extra,
  })
  const stackPr = (number, title, depth, extra = {}) => ({
    pr: { id: 'PR_' + number, number, title, url: '', repo: 'acme/web', author: 'dana', authorAvatar: people.dana,
      headRef: 'dana/stack-' + number, baseRef: depth === 0 ? 'main' : 'dana/stack-' + (number - 1), isDraft: false,
      reviewDecision: 'REVIEW_REQUIRED', inbox: null, stale: false, ...extra }, depth })
  const stack = { id: 'stack-checkout', repo: 'acme/web', base: 'main', nodes: [
    stackPr(210, 'refactor(checkout): split the cart reducer', 0, { reviewDecision: 'APPROVED' }),
    stackPr(211, 'feat(checkout): save the cart between visits', 1),
    stackPr(212, 'feat(checkout): show delivery dates in the cart', 2),
  ] }
  const authored = [
    summary(205, 'fix(search): keep filters when paging', { reviewDecision: 'CHANGES_REQUESTED' }),
    summary(207, 'feat(profile): upload an avatar from the camera', { reviewDecision: 'APPROVED' }),
    summary(211, 'feat(checkout): save the cart between visits'),
    summary(212, 'feat(checkout): show delivery dates in the cart'),
    summary(214, 'chore(deps): bump the date library', { isDraft: true }),
  ]
  const requested = [summary(198, 'feat(orders): export orders as CSV', { author: 'ana', authorAvatar: people.ana, requestedAt: hoursAgo(5) })]
  const comment = (id, author, body, createdAt, extra = {}) => ({
    id, nodeId: 'C_' + id, inReplyTo: undefined, path: 'src/cart/delivery.ts', line: 12, startLine: null, side: 'RIGHT', body,
    author, authorAvatar: people[author], createdAt, url: 'https://github.com/acme/web/pull/212#discussion_r' + id,
    outdated: false, subjectType: 'line', reactions: [], ...extra })
  const patch = [
    '@@ -1,8 +1,14 @@',
    " import { addDays, formatDate } from './dates'",
    " import type { CartItem } from './cart.types'",
    ' ',
    '-export function deliveryLabel(item: CartItem) {',
    "-  return item.inStock ? 'Ships today' : 'Back soon'",
    '+/** When an item arrives, from its warehouse lead time. */',
    '+export function describeDelivery(item: CartItem, today: Date) {',
    '+  if (!item.inStock) {',
    "+    return 'Back soon'",
    '+  }',
    '+  const arrival = addDays(today, item.leadDays)',
    "+  return 'Arrives ' + formatDate(arrival)",
    ' }',
  ].join('\n')
  const detail = {
    fetchedAt: new Date().toISOString(), repo: 'acme/web', number: 212, title: 'feat(checkout): show delivery dates in the cart',
    body: 'Shows when each item arrives, from its warehouse lead time.', url: 'https://github.com/acme/web/pull/212',
    author: 'dana', authorAvatar: people.dana, headRef: 'dana/stack-212', baseRef: 'dana/stack-211', headSha: 'a1b2c3d',
    baseSha: 'f9e8d7c', viewer: 'dana', myReview: null, lastReviewedAt: hoursAgo(6), isDraft: false, additions: 9, deletions: 2,
    commitCount: 3,
    files: [{ path: 'src/cart/delivery.ts', sha: 's1', status: 'modified', additions: 9, deletions: 2, patch }],
    comments: [
      comment(501, 'dana', 'Should a missing lead time fall back to the slowest warehouse instead of today?', hoursAgo(9)),
      comment(502, 'bo', 'Good catch: it now falls back to 7 days, see the second commit.', hoursAgo(2), { inReplyTo: 501 }),
      comment(503, 'ana', 'Nit: `describeDelivery` reads better than `deliveryLabel` here.', hoursAgo(8), { line: 7 }),
      comment(504, 'dana', 'Agreed, renamed.', hoursAgo(7), { line: 7, inReplyTo: 503 }),
    ],
    conversation: [
      { id: 'comment-1', kind: 'comment', author: 'ci', authorAvatar: people.ci, body: '✅ Preview deployed: [open the preview](https://preview.acme.dev/212)', url: '', createdAt: hoursAgo(10) },
      { id: 'review-2', kind: 'review', author: 'cy', authorAvatar: people.cy, body: 'Looks good overall; one question on the fallback before I approve.', url: '', createdAt: hoursAgo(3) },
    ],
    threads: [{ id: 'T1', rootCommentId: 501, resolved: false }, { id: 'T2', rootCommentId: 503, resolved: true }],
  }
  const handlers = {
    getInbox: async () => ({ viewer: 'dana', requested, reviewed: [], authored, stacks: [stack], fetchedAt: new Date().toISOString() }),
    getPull: async () => detail,
    getLocalState: async () => ({ drafts: [], viewed: {}, briefing: {
      headSha: 'a1b2c3d', createdAt: new Date(now - 1_800_000).toISOString(), backend: 'api', model: 'claude-opus-5-5',
      omittedFiles: [],
      briefing: {
        gist: 'Replaces the in-stock label with a delivery date computed from each warehouse lead time.',
        intent: 'Show customers when their order arrives before they pay.', risk: 'low',
        focus: [{ path: 'src/cart/delivery.ts', lines: '5-12', reason: 'The date maths and the out-of-stock path.', priority: 'high' }],
        ignore: [], concerns: [], guidelineChecks: [],
        questions: [
          'What should the cart show when a warehouse has no lead time configured?',
          'Do delivery dates need to skip public holidays?',
        ],
      },
    } }),
    getStack: async () => stack,
    getStackComments: async () => [
      { repo: 'acme/web', number: 210, yourThreads: 3, awaitingYou: 0 },
      { repo: 'acme/web', number: 211, yourThreads: 2, awaitingYou: 1 },
      { repo: 'acme/web', number: 212, yourThreads: 1, awaitingYou: 1 },
    ],
    getMentions: async () => ({ viewer: 'dana', mentions: [], windowDays: 14, fetchedAt: new Date().toISOString() }),
    getThreads: async () => ({ threads: [], fetchedAt: new Date().toISOString() }),
    getSettings: async () => ({ pollIntervalMinutes: 3, staleAfterHours: 24, staleRepeatHours: 24, includeTeamRequests: true,
      notifyOnRequest: true, notifyOnReRequest: true, notifyOnStale: true, notifyOnMention: true, ignoreDrafts: true,
      claudeBackend: 'auto', claudeModel: 'claude-opus-5-5', editor: '', openInEditorShortcut: 'Cmd+O', codeFolders: ['~/code'],
      syncViaIcloud: false, hasGithubToken: true, hasAnthropicKey: false }),
    githubAuthStatus: async () => ({ source: 'settings', login: 'dana', scopes: ['repo', 'read:org'], canSeeTeams: true }),
    getSyncStatus: async () => ({ state: 'off', lastSyncedAt: null, message: null }),
    getUpdateStatus: async () => ({ current: '0.2.0', latest: '0.2.0', available: false, releaseUrl: null }),
    listEditors: async () => [{ id: 'cursor', name: 'Cursor' }],
    resolveGuidelines: async () => [], listGuidelines: async () => [], knownRepos: async () => ['acme/web'],
    getBlame: async () => [], getPullCommits: async () => [],
    onEvent: () => () => {},
  }
  globalThis.revio = new Proxy(handlers, { get: (target, name) => target[name] ?? (async () => null) })
})()
