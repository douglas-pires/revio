import type { Branch, Branches } from '@shared/git-log.types.ts'
import { useState } from 'react'
import { joinClassNames } from '../common/format.util.ts'
import { type BranchFolder, buildBranchTree, filterBranches, readLeafName } from './branch-tree.util.ts'
import { ConfirmAction } from './confirm-action.component.tsx'

/** Indent per folder level. */
const INDENT_PX = 12
/** Space before the first level. */
const BASE_PAD_PX = 8

const indentByDepth = (depth: number) => ({ paddingLeft: depth * INDENT_PX + BASE_PAD_PX })

/** ★ marks the branch checked out, ⎇ the others. */
function pickBranchIcon(current: boolean) {
  if (current) {
    return '★'
  }
  return '⎇'
}

function pickFolderArrow(open: boolean) {
  if (open) {
    return '▾'
  }
  return '▸'
}

function TrackCounts({ branch }: { branch: Branch }) {
  if (!(branch.ahead || branch.behind)) {
    return null
  }
  return (
    <span className="shrink-0 font-mono text-[10.5px] text-accent" title="Commits ahead of / behind its upstream">
      {branch.behind > 0 && `↓${branch.behind}`}
      {branch.ahead > 0 && ` ↑${branch.ahead}`}
    </span>
  )
}

function BranchRow(props: { branch: Branch; label: string; depth: number; active: boolean; onPick: () => void }) {
  return (
    <button
      type="button"
      // biome-ignore lint/style/noInlineStyles: the indent follows the folder depth.
      style={indentByDepth(props.depth)}
      className={joinClassNames(
        'flex w-full items-center gap-1.5 rounded py-0.5 pr-2 text-left text-[12px]',
        props.active && 'bg-accent/15 text-fg',
        !props.active && 'text-muted hover:bg-hover hover:text-fg',
      )}
      title={props.branch.name}
      onClick={props.onPick}
    >
      <span className={joinClassNames('shrink-0', props.branch.current && 'text-warn')}>
        {pickBranchIcon(props.branch.current)}
      </span>
      <span className="min-w-0 flex-1 truncate">{props.label}</span>
      <TrackCounts branch={props.branch} />
    </button>
  )
}

/** A folder and everything in it; folders start open. */
function Folder(props: { folder: BranchFolder; depth: number; picked: string; onPick: (branch: string) => void }) {
  const [open, setOpen] = useState(true)
  return (
    <>
      {props.folder.name !== '' && (
        <button
          type="button"
          // biome-ignore lint/style/noInlineStyles: the indent follows the folder depth.
          style={indentByDepth(props.depth)}
          className="flex w-full items-center gap-1.5 rounded py-0.5 text-left text-[12px] text-muted hover:bg-hover"
          onClick={() => setOpen(!open)}
        >
          <span className="w-2.5 shrink-0">{pickFolderArrow(open)}</span>
          <span className="truncate">{props.folder.name}</span>
        </button>
      )}
      {Boolean(open) &&
        props.folder.folders.map((folder) => (
          <Folder
            key={folder.path}
            folder={folder}
            depth={props.depth + 1}
            picked={props.picked}
            onPick={props.onPick}
          />
        ))}
      {Boolean(open) &&
        props.folder.branches.map((branch) => (
          <BranchRow
            key={branch.name}
            branch={branch}
            label={readLeafName(branch.name)}
            depth={props.depth + 1}
            active={branch.name === props.picked}
            onPick={() => props.onPick(branch.name)}
          />
        ))}
    </>
  )
}

function Section(props: { title: string; branches: Branch[]; picked: string; onPick: (branch: string) => void }) {
  if (props.branches.length === 0) {
    return null
  }
  return (
    <div className="mb-2">
      <div className="px-2 pt-1 pb-0.5 text-[11px] font-semibold text-muted">{props.title}</div>
      <Folder folder={buildBranchTree(props.branches)} depth={-1} picked={props.picked} onPick={props.onPick} />
    </div>
  )
}

/** Left pane: HEAD, local and remote branches as folders. Picking one shows its log; picking it again shows all. */
/** Under the branches: check out the branch picked, unless it is already checked out. */
function CheckoutPicked(props: { picked: string; head: string | null; onCheckout: (branch: string) => Promise<void> }) {
  if (!props.picked || props.picked === props.head) {
    return null
  }
  return (
    <div className="border-t border-line p-2">
      <ConfirmAction
        label={`Check out ${props.picked}`}
        question={`Switch your local clone to ${props.picked}? Git refuses if your uncommitted changes would be lost.`}
        onConfirm={() => props.onCheckout(props.picked)}
      />
    </div>
  )
}

export function BranchPanel(props: {
  branches: Branches | null
  picked: string
  onPick: (branch: string) => void
  onCheckout: (branch: string) => Promise<void>
}) {
  const [query, setQuery] = useState('')
  const matchingBranches = filterBranches(props.branches?.branches ?? [], query)
  // Picking the branch already shown goes back to every branch.
  const toggleBranch = (branch: string) => {
    if (branch === props.picked) {
      props.onPick('')
    } else {
      props.onPick(branch)
    }
  }
  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-line bg-panel">
      <div className="p-2">
        <input
          type="search"
          className="input py-1 text-[12px]"
          placeholder="Branch"
          aria-label="Filter branches"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-1 pb-2">
        <button
          type="button"
          className={joinClassNames(
            'w-full rounded px-2 py-0.5 text-left text-[12px]',
            props.picked === '' && 'bg-accent/15 text-fg',
            props.picked !== '' && 'text-muted hover:bg-hover hover:text-fg',
          )}
          onClick={() => props.onPick('')}
        >
          All branches
        </button>
        {Boolean(props.branches?.head) && (
          <button
            type="button"
            className="w-full truncate rounded px-2 py-0.5 text-left text-[12px] text-muted hover:bg-hover hover:text-fg"
            onClick={() => toggleBranch(props.branches?.head ?? '')}
          >
            HEAD (Current branch)
          </button>
        )}
        <Section
          title="Local"
          branches={matchingBranches.filter((branch) => branch.kind === 'local')}
          picked={props.picked}
          onPick={toggleBranch}
        />
        <Section
          title="Remote"
          branches={matchingBranches.filter((branch) => branch.kind === 'remote')}
          picked={props.picked}
          onPick={toggleBranch}
        />
      </div>
      <CheckoutPicked picked={props.picked} head={props.branches?.head ?? null} onCheckout={props.onCheckout} />
    </aside>
  )
}
