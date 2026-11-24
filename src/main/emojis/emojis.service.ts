import type { Emoji } from '@shared/emoji.types.ts'
import { MemoCache } from '../common/memo.cache.ts'
import { getGithubClient } from '../github/github.client.ts'
import { parseEmojis } from './emojis.util.ts'

const ONLY_LIST = 'github'
const emojis = new MemoCache<Emoji[]>(1)

/** GitHub's emojis, asked for once while Revio runs. */
export function listEmojis(): Promise<Emoji[]> {
  return emojis.get(ONLY_LIST, async () => {
    const octokit = await getGithubClient()
    const { data } = await octokit.emojis.get()
    return parseEmojis(data)
  })
}
