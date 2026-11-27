import { CopyButton } from '../common/copy-button.component.tsx'
import { ShortcutHint } from '../shortcuts/shortcut-hint.component.tsx'

function BranchChip({ name }: { name: string }) {
  return (
    <CopyButton
      text={name}
      title={`Copy branch name ${name}`}
      className="rounded px-1 font-mono text-fg hover:bg-hover"
    >
      {name}
    </CopyButton>
  )
}

/** The PR's own branch, whose name its shortcut copies too. */
function HeadBranchChip({ name }: { name: string }) {
  return (
    <ShortcutHint action="copy-branch" description="Copy the branch name">
      <CopyButton text={name} className="rounded px-1 font-mono text-fg hover:bg-hover">
        {name}
      </CopyButton>
    </ShortcutHint>
  )
}

/** "head into base", where clicking a branch copies its name. */
export function BranchNames({ head, base }: { head: string; base: string }) {
  return (
    <>
      <HeadBranchChip name={head} /> into <BranchChip name={base} />
    </>
  )
}
