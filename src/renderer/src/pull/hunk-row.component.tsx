export function HunkRow({ text, span }: { text: string; span: number }) {
  return (
    <tr className="bg-hunk text-muted">
      <td colSpan={span} className="px-3 py-0.5 select-text">
        {text}
      </td>
    </tr>
  )
}
