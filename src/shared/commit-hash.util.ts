const HASH_PREFIX = /^[0-9a-f]{7,40}$/iu

/** Whether search text could be a commit hash (or the start of one, seven characters or more). */
export function looksLikeHash(text: string): boolean {
  return HASH_PREFIX.test(text.trim())
}
