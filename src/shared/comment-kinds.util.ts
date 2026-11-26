/** What a review comment can be about. */
export const COMMENT_KINDS = [
  'correctness',
  'error-handling',
  'tests',
  'security',
  'performance',
  'design',
  'naming',
  'readability',
  'style',
  'docs',
  'question',
  'praise',
] as const

export type CommentKind = (typeof COMMENT_KINDS)[number]

/** How each kind reads on screen. */
export const COMMENT_KIND_LABELS: Record<CommentKind, string> = {
  correctness: 'Logic and correctness',
  'error-handling': 'Error handling',
  tests: 'Tests',
  security: 'Security',
  performance: 'Performance',
  design: 'Design and structure',
  naming: 'Naming',
  readability: 'Readability',
  style: 'Style and formatting',
  docs: 'Docs and comments',
  question: 'Questions',
  praise: 'Praise',
}

/** Kinds worth noticing when you seldom comment on them: what code does, not how a comment is phrased. */
export const CHECKED_KINDS: readonly CommentKind[] = [
  'correctness',
  'error-handling',
  'tests',
  'security',
  'performance',
  'design',
  'naming',
  'readability',
]
