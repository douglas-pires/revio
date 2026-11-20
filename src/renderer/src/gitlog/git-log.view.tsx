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
  const log = useGitLog()
  return (
    <div className="flex h-full min-h-0 flex-col">
      <ScreenHeader
        title="Git log"
        subtitle={log.repos?.find((r) => r.repo === log.repo)?.path}
        actions={
          <>
            <select
              className="input w-auto max-w-72 py-1 text-[12px]"
              aria-label="Repository"
              value={log.repo}
              onChange={(e) => log.setRepo(e.target.value)}
            >
              {log.repos?.map((r) => (
                <option key={r.repo} value={r.repo}>
                  {r.repo}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="btn"
              onClick={log.reload}
              disabled={log.loading}
              title="Read the log again"
            >
              ⟳
            </button>
          </>
        }
      />
      {Boolean(log.error) && <ErrorBanner className="m-3">{log.error}</ErrorBanner>}
      {log.repos !== null && log.repos.length === 0 && (
        <div className="p-8 text-center text-muted">
          No local clones found. Add the folders that hold your repositories under Settings → Editor.
        </div>
      )}
      {Boolean(log.repo) && (
        <div className="flex min-h-0 flex-1">
          <BranchPanel
            branches={log.branches}
            picked={log.filters.branch}
            onPick={(branch) => log.setFilters({ ...log.filters, branch })}
          />
          <CommitList
            commits={log.commits}
            branches={log.branches}
            filters={log.filters}
            onFilters={log.setFilters}
            ci={log.ci}
            selected={log.commit.selected}
            onSelect={log.commit.setSelected}
            loading={log.loading}
            more={log.more}
            onLoadMore={log.loadMore}
          />
          <CommitDetailPanel
            repo={log.repo}
            hash={log.commit.selected}
            detail={log.commit.detail}
            ci={log.ci[log.commit.selected ?? '']}
            error={log.commit.error}
          />
        </div>
      )}
    </div>
  )
}
