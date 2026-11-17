import { CopyButton } from '../common/copy-button.component'

/** "head into base", where clicking a branch copies its name. */
export function BranchNames({ head, base }: { head: string; base: string }) {
  return (
    <>
      <BranchChip name={head} /> into <BranchChip name={base} />
    </>
  )
}

function BranchChip({ name }: { name: string }) {
  return (
    <CopyButton text={name} title={`Copy branch name ${name}`} className="rounded px-1 font-mono text-fg hover:bg-hover">
      {name}
    </CopyButton>
  )
}
