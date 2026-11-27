import { useContext } from 'react'
import { ExplanationsContext } from './use-explanations.hook.ts'

/** What the button says: explain, explaining, or show / hide the explanation written before (kept short for the header). */
function describeButton(hasRecord: boolean, running: boolean, shown: boolean) {
  if (running) {
    return 'Explaining…'
  }
  if (!hasRecord) {
    return '✦ Explain'
  }
  if (shown) {
    return '✦ Hide'
  }
  return '✦ Show'
}

/** In a file's header: "new to you" when you have not reviewed this code before, and the button to explain it. */
export function ExplainButton({ path }: { path: string }) {
  const explanations = useContext(ExplanationsContext)
  if (!explanations) {
    return null
  }
  const hasRecord = path in explanations.records
  const running = path in explanations.progress
  const shown = explanations.shown.has(path)
  return (
    <>
      {explanations.unfamiliar.has(path) && (
        <span
          className="chip shrink-0 bg-accent/10 whitespace-nowrap text-accent"
          title="New to you: you have not commented on code in this folder before"
        >
          new
        </span>
      )}
      <button
        type="button"
        className="btn btn-ghost shrink-0 py-0 text-[12px] whitespace-nowrap text-accent"
        disabled={running}
        title="Claude explains what this code is for, how it works and what it is connected to, before you judge the change"
        onClick={() => {
          if (hasRecord) {
            explanations.toggle(path)
          } else {
            explanations.explain(path)
          }
        }}
      >
        {describeButton(hasRecord, running, shown)}
      </button>
    </>
  )
}
