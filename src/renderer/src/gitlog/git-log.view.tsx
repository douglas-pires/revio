import { useState } from 'react'
import { ErrorBanner } from '../common/error-banner.component.tsx'
import { ScreenHeader } from '../common/screen.component.tsx'
import { BranchPanel } from './branch-panel.component.tsx'
import { CommitDetailPanel } from './commit-detail.component.tsx'
import { CommitFileDiff } from './commit-file-diff.component.tsx'
import { CommitList } from './commit-list.component.tsx'
import { useGitLog } from './use-git-log.hook.ts'

type GitLogState = ReturnType<typeof useGitLog>

/** A file opened in one commit; it counts as open only while that commit stays picked. */
interface OpenedFile {
  hash: string | null
  path: string | null
}

/** The open file's path, or null once another commit is picked. */
function readOpenPath(opened: OpenedFile, selectedHash: string | null) {
  if (opened.hash !== selectedHash) {
    return null
  }
  return opened.path
}

/** The file whose diff is open; picking another commit closes it. */
function useOpenFile(selectedHash: string | null) {
  const [opened, setOpened] = useState<OpenedFile>({ hash: null, path: null })
  const openFile = (path: string | null) => setOpened({ hash: selectedHash, path })
  return [readOpenPath(opened, selectedHash), openFile] as const
}

/** The repository picker and the reload button in the header. */
function RepoActions({ gitLog }: { gitLog: GitLogState }) {
  return (
    <>
      <select
        className="input w-auto max-w-72 py-1 text-[12px]"
        aria-label="Repository"
        value={gitLog.repo}
        onChange={(event) => gitLog.setRepo(event.target.value)}
      >
        {gitLog.repos?.map((localRepo) => (
          <option key={localRepo.repo} value={localRepo.repo}>
            {localRepo.repo}
          </option>
        ))}
      </select>
      <button
        type="button"
        className="btn"
        onClick={gitLog.reload}
        disabled={gitLog.loading}
        title="Read the log again"
      >
        ⟳
      </button>
    </>
  )
}

/** The middle pane: the open file's diff, else the log itself. */
function MiddlePane(props: { gitLog: GitLogState; openFile: string | null; onCloseFile: () => void }) {
  const { gitLog } = props
  if (props.openFile !== null && gitLog.commit.selected !== null) {
    return (
      <CommitFileDiff
        repo={gitLog.repo}
        hash={gitLog.commit.selected}
        path={props.openFile}
        onClose={props.onCloseFile}
      />
    )
  }
  return (
    <CommitList
      commits={gitLog.commits}
      branches={gitLog.branches}
      filters={gitLog.filters}
      onFilters={gitLog.setFilters}
      ci={gitLog.ci}
      selected={gitLog.commit.selected}
      onSelect={gitLog.commit.setSelected}
      loading={gitLog.loading}
      more={gitLog.more}
      onLoadMore={gitLog.loadMore}
    />
  )
}

/** Branches, the log (or a file's diff) and the picked commit, side by side. Checkout and cherry-pick reload the log. */
function GitLogPanes({ gitLog }: { gitLog: GitLogState }) {
  const [openFile, setOpenFile] = useOpenFile(gitLog.commit.selected)
  return (
    <div className="flex min-h-0 flex-1">
      <BranchPanel
        branches={gitLog.branches}
        picked={gitLog.filters.branch}
        onPick={(branch) => gitLog.setFilters({ ...gitLog.filters, branch })}
        onCheckout={async (branch) => {
          await globalThis.revio.checkoutBranch(gitLog.repo, branch)
          gitLog.reload()
        }}
      />
      <MiddlePane gitLog={gitLog} openFile={openFile} onCloseFile={() => setOpenFile(null)} />
      <CommitDetailPanel
        repo={gitLog.repo}
        hash={gitLog.commit.selected}
        detail={gitLog.commit.detail}
        ci={gitLog.ci[gitLog.commit.selected ?? '']}
        error={gitLog.commit.error}
        openFile={openFile}
        onOpenFile={setOpenFile}
        head={gitLog.branches?.head ?? null}
        onCherryPick={async (hash) => {
          await globalThis.revio.cherryPick(gitLog.repo, hash)
          gitLog.reload()
        }}
      />
    </div>
  )
}

/**
 * The git log of a repository you have cloned, laid out like an IDE's: branches on the left, the commit graph
 * with filters in the middle, the picked commit's files and message on the right. CI results come from GitHub.
 */
export function GitLog() {
  const gitLog = useGitLog()
  return (
    <div className="flex h-full min-h-0 flex-col">
      <ScreenHeader
        title="Git log"
        subtitle={gitLog.repos?.find((localRepo) => localRepo.repo === gitLog.repo)?.path}
        actions={<RepoActions gitLog={gitLog} />}
      />
      {Boolean(gitLog.error) && <ErrorBanner className="m-3">{gitLog.error}</ErrorBanner>}
      {gitLog.repos !== null && gitLog.repos.length === 0 && (
        <div className="p-8 text-center text-muted">
          No local clones found. Add the folders that hold your repositories under Settings → Editor.
        </div>
      )}
      {Boolean(gitLog.repo) && <GitLogPanes gitLog={gitLog} />}
    </div>
  )
}
