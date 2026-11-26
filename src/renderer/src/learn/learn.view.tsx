import { InnerTabs } from '../common/inner-tabs.component.tsx'
import type { OpenPull } from '../common/navigation.types.ts'
import { Screen, ScreenBody, ScreenHeader } from '../common/screen.component.tsx'
import { useStoredChoice } from '../common/use-stored-choice.hook.ts'
import { AfterMerge } from './after-merge.component.tsx'
import { OtherReviewers } from './other-reviewers.component.tsx'

const LEARN_TABS = [
  { value: 'after-merge', label: 'After merge' },
  { value: 'other-reviewers', label: 'Other reviewers' },
] as const

const TAB_VALUES = LEARN_TABS.map((tab) => tab.value)

/** What your past reviews can teach, by tab; the last one open is remembered. */
export function Learn({ onOpen }: { onOpen: OpenPull }) {
  const [tab, setTab] = useStoredChoice('revio.learnTab', TAB_VALUES, 'after-merge')
  return (
    <Screen header={<ScreenHeader title="Learn" subtitle="From the reviews you sent in the last year" />}>
      <InnerTabs tabs={LEARN_TABS} value={tab} onChange={setTab} />
      <ScreenBody narrow={true}>
        {tab === 'after-merge' && <AfterMerge onOpen={onOpen} />}
        {tab === 'other-reviewers' && <OtherReviewers onOpen={onOpen} />}
      </ScreenBody>
    </Screen>
  )
}
