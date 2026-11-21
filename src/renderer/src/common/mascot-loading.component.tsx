import { Mascot } from './mascot.component.tsx'

/**
 * Shown while a screen or a PR's code loads: the mascot looking around with its magnifying glass, and what is loading.
 * It fills the space it is given without moving anything around it.
 */
export function MascotLoading({ label }: { label: string }) {
  return (
    <div role="status" className="flex h-full min-h-0 flex-1 flex-col items-center justify-center p-8">
      <Mascot className="size-36" />
      <p className="mt-2 text-[12.5px] text-muted">{label}</p>
    </div>
  )
}
