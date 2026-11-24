import type { UnseenUpdate } from '@shared/whats-new.types.ts'
import { useMemo } from 'react'
import { EmptyState } from '../common/empty-state.component.tsx'
import { MascotLoading } from '../common/mascot-loading.component.tsx'
import { Screen, ScreenBody, ScreenHeader } from '../common/screen.component.tsx'
import { listNewVersions } from './release-range.util.ts'
import { ReleaseSection } from './release-section.component.tsx'
import { useReleaseNotes } from './use-release-notes.hook.ts'

const NO_VERSIONS: ReadonlySet<string> = new Set()

/** What the header says: that Revio was updated, when this opened for that. */
function describeUpdate(update: UnseenUpdate | undefined) {
  if (!update) {
    return 'What each release brought'
  }
  if (update.previous === null) {
    return 'Revio was updated'
  }
  return `Revio was updated from ${update.previous}`
}

/** What each release brought, newest first; those new since the `update` it opened for are marked. */
export function WhatsNew({ update, onDone }: { update?: UnseenUpdate | undefined; onDone: () => void }) {
  const { releases, error, load } = useReleaseNotes()
  const newVersions = useMemo(() => {
    if (!(update && releases)) {
      return NO_VERSIONS
    }
    return listNewVersions(releases, update.previous)
  }, [update, releases])
  return (
    <Screen
      header={
        <ScreenHeader
          title="What’s new"
          subtitle={describeUpdate(update)}
          actions={
            <button type="button" className="btn btn-primary" onClick={onDone}>
              Go to the inbox
            </button>
          }
        />
      }
    >
      {!(releases || error) && <MascotLoading label="Loading the release notes…" />}
      {Boolean(releases || error) && (
        <ScreenBody narrow={true}>
          {error !== null && (
            <EmptyState
              title="Could not load the release notes"
              action={
                <button type="button" className="btn" onClick={load}>
                  Try again
                </button>
              }
            >
              {error}
            </EmptyState>
          )}
          <div className="selectable space-y-4">
            {releases?.map((notes) => (
              <ReleaseSection key={notes.version} notes={notes} isNew={newVersions.has(notes.version)} />
            ))}
          </div>
        </ScreenBody>
      )}
    </Screen>
  )
}
