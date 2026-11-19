/** Splits "owner/name" into its parts. Throws on anything else. */
export function splitRepo(repo: string) {
  const [owner, name] = repo.split('/')
  if (!(owner && name)) {
    throw new Error(`Bad repo: ${repo}`)
  }
  return { owner, repo: name }
}
