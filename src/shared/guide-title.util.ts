const TRAILING_SLASH = /\/$/u

/** The title a guide gets when left blank: Global, its folder, or its repository's name. */
export function buildDefaultTitle(scope: { repo: string; path: string }) {
  if (scope.repo === '*') {
    return 'Global'
  }
  if (scope.path) {
    return scope.path.replace(TRAILING_SLASH, '')
  }
  return scope.repo.split('/')[1] || 'Guide'
}
