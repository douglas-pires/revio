import { Mascot } from '../common/mascot.component.tsx'

/**
 * Shown in the code panel while a PR loads: the mascot looking around with its magnifying glass, and what is loading.
 * It takes the panel's place without moving anything around it.
 */
export function CodeLoading({ label }: { label: string }) {
  return (
    <div
      data-code-loading={true}
      role="status"
      className="flex min-h-0 flex-1 flex-col items-center justify-center p-8"
    >
      <Mascot className="size-36" />
      <p className="mt-2 text-[12.5px] text-muted">{label}</p>
    </div>
  )
}
