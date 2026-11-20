import { ErrorBanner } from '../common/error-banner.component.tsx'
import { ScreenHeader } from '../common/screen.component.tsx'
import { BranchPanel } from './branch-panel.component.tsx'
import { CommitDetailPanel } from './commit-detail.component.tsx'
import { CommitList } from './commit-list.component.tsx'
import { useGitLog } from './use-git-log.hook.ts'

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
        actions={
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
        }
      />
      {Boolean(gitLog.error) && <ErrorBanner className="m-3">{gitLog.error}</ErrorBanner>}
      {gitLog.repos !== null && gitLog.repos.length === 0 && (
        <div className="p-8 text-center text-muted">
          No local clones found. Add the folders that hold your repositories under Settings → Editor.
        </div>
      )}
      {Boolean(gitLog.repo) && (
        <div className="flex min-h-0 flex-1">
          <BranchPanel
            branches={gitLog.branches}
            picked={gitLog.filters.branch}
            onPick={(branch) => gitLog.setFilters({ ...gitLog.filters, branch })}
          />
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
          <CommitDetailPanel
            repo={gitLog.repo}
            hash={gitLog.commit.selected}
            detail={gitLog.commit.detail}
            ci={gitLog.ci[gitLog.commit.selected ?? '']}
            error={gitLog.commit.error}
          />
        </div>
      )}
    </div>
  )
}
