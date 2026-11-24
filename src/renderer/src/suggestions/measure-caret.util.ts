/** Styles that decide where text wraps in a text box. */
const COPIED_STYLES = [
  'boxSizing',
  'width',
  'paddingTop',
  'paddingRight',
  'paddingBottom',
  'paddingLeft',
  'borderTopWidth',
  'borderRightWidth',
  'borderBottomWidth',
  'borderLeftWidth',
  'fontFamily',
  'fontSize',
  'fontWeight',
  'letterSpacing',
  'lineHeight',
  'tabSize',
] as const

/** A hidden copy of the box's text up to `index`, laid out alike, ending in a marker. */
function createCopy(box: HTMLTextAreaElement, index: number) {
  const copy = document.createElement('div')
  const styles = getComputedStyle(box)
  for (const name of COPIED_STYLES) {
    copy.style[name] = styles[name]
  }
  Object.assign(copy.style, {
    position: 'fixed',
    visibility: 'hidden',
    whiteSpace: 'pre-wrap',
    overflowWrap: 'break-word',
  })
  const marker = document.createElement('span')
  marker.textContent = '​'
  copy.append(box.value.slice(0, index), marker)
  return { copy, marker }
}

/** Where the character at `index` of a text box is on screen: its left, and the top and bottom of its line. */
export function measureCaret(box: HTMLTextAreaElement, index: number) {
  const { copy, marker } = createCopy(box, index)
  document.body.append(copy)
  const { left, top } = box.getBoundingClientRect()
  const lineTop = top + marker.offsetTop - box.scrollTop
  const position = { left: left + marker.offsetLeft, top: lineTop, bottom: lineTop + marker.offsetHeight }
  copy.remove()
  return position
}
