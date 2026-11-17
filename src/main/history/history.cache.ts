import type { BlameRange, CommitFile, CommitRef, FileAtCommit, FileHistoryEntry, PullCommit } from '@shared/history.types'
import { patchOfFile } from '@shared/history.util'
import { pullKey, type PullRef } from '@shared/pull.types'
import type { Octokit } from '@octokit/rest'
import { MemoCache } from '../common/memo.cache'
import { fetchBlame, fetchCommitFiles, fetchFileHistory, fetchPullCommits } from './history.service'

const keyOf = (at: FileAtCommit) => `${at.repo}@${at.sha}:${at.path}`

/** Blame, file history, commit files and PR commits, kept per commit sha since they never change for one. */
export class HistoryCache {
  readonly #blame = new MemoCache<BlameRange[]>(100)
  readonly #history = new MemoCache<FileHistoryEntry[]>(100)
  readonly #commitFiles = new MemoCache<CommitFile[]>(100)
  readonly #pullCommits = new MemoCache<PullCommit[]>(50)
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

  commitFiles(at: CommitRef) {
    return this.#commitFiles.get(`${at.repo}@${at.sha}`, async () => fetchCommitFiles(await this.#octokit(), at))
  }

  async commitFilePatch(at: FileAtCommit) {
    return patchOfFile(await this.commitFiles(at), at.path)
  }

  /** Keyed by head sha: a new push lists again. */
  pullCommits(pull: PullRef, headSha: string) {
    return this.#pullCommits.get(`${pullKey(pull)}@${headSha}`, async () => fetchPullCommits(await this.#octokit(), pull))
  }
}
