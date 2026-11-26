import { InnerTabs } from '../common/inner-tabs.component.tsx'
import type { OpenPull } from '../common/navigation.types.ts'
import { Screen, ScreenBody, ScreenHeader } from '../common/screen.component.tsx'
import { SegmentedControl } from '../common/segmented-control.component.tsx'
import { useStoredChoice } from '../common/use-stored-choice.hook.ts'
import { AfterMerge } from './after-merge.component.tsx'
import { DEFAULT_LEARN_PERIOD, LEARN_PERIOD_VALUES, LEARN_PERIODS } from './learn-period.util.ts'

const LEARN_TABS = [{ value: 'after-merge', label: 'After merge' }] as const

const TAB_VALUES = LEARN_TABS.map((tab) => tab.value)

/** What your past reviews can teach, by tab, over the period picked (three months at first); both are remembered. */
export function Learn({ onOpen }: { onOpen: OpenPull }) {
  const [tab, setTab] = useStoredChoice('revio.learnTab', TAB_VALUES, 'after-merge')
  const [period, setPeriod] = useStoredChoice('revio.learnPeriod', LEARN_PERIOD_VALUES, DEFAULT_LEARN_PERIOD)
  const days = Number(period)
  return (
    <Screen
      header={
        <ScreenHeader
          title="Learn"
          subtitle="From the reviews you sent on GitHub"
          actions={<SegmentedControl segments={LEARN_PERIODS} value={period} onChange={setPeriod} />}
        />
      }
    >
      <InnerTabs tabs={LEARN_TABS} value={tab} onChange={setTab} />
      <ScreenBody narrow={true}>
        {tab === 'after-merge' && <AfterMerge key={days} days={days} onOpen={onOpen} />}
      </ScreenBody>
    </Screen>
  )
}
