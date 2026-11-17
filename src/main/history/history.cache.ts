import type { BlameRange, FileAtCommit, FileHistoryEntry } from '@shared/history.types'
import { pullKey, type PullRef } from '@shared/pull.types'
import type { Octokit } from '@octokit/rest'
import { MemoCache } from '../common/memo.cache'
import { fetchBlame, fetchCommitFilePatch, fetchFileHistory } from './history.service'

const keyOf = (at: FileAtCommit) => `${at.repo}@${at.sha}:${at.path}`

/** Blame, file history and commit patches, kept per commit sha since they never change for one. */
export class HistoryCache {
  readonly #blame = new MemoCache<BlameRange[]>(100)
  readonly #history = new MemoCache<FileHistoryEntry[]>(100)
  readonly #patches = new MemoCache<string | null>(300)
  readonly #octokit: () => Promise<Octokit>

  constructor(octokit: () => Promise<Octokit>) {
    this.#octokit = octokit
  }

  blame(at: FileAtCommit) {
    return this.#blame.get(keyOf(at), async () => fetchBlame(await this.#octokit(), at))
  }

  fileHistory(pull: PullRef, at: FileAtCommit) {
    return this.#history.get(`${pullKey(pull)} ${keyOf(at)}`, async () => fetchFileHistory(await this.#octokit(), pull, at))
  }

  commitFilePatch(at: FileAtCommit) {
    return this.#patches.get(keyOf(at), async () => fetchCommitFilePatch(await this.#octokit(), at))
  }
}
