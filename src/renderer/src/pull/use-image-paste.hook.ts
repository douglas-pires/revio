import { buildImageMarkdown, buildUploadingMarkdown, checkPastedImage } from '@shared/pasted-image.util.ts'
import { useContext } from 'react'
import { copyText } from '../common/copy-text.service.ts'
import { readErrorMessage } from '../common/format.util.ts'
import { showNotice } from '../common/notice.service.ts'
import { rememberPastedImage } from '../common/pasted-images.store.ts'
import { MentionScopeContext } from '../mentionables/mention-scope.context.ts'

/** Tells uploads in progress apart, so each placeholder is swapped for its own image. */
let nextUploadId = 1

/** Types at the caret through the browser's own editing, so ⌘Z undoes it and React sees the change. */
function insertAtCaret(box: HTMLTextAreaElement, text: string) {
  box.focus()
  document.execCommand('insertText', false, text)
}

/** Swaps the placeholder for `text`; when the box has closed meanwhile, copies `text` so it is not lost. */
function replacePlaceholder(box: HTMLTextAreaElement, placeholder: string, text: string) {
  const at = box.isConnected ? box.value.indexOf(placeholder) : -1
  if (at === -1) {
    if (text) {
      copyText(text)
    }
    return
  }
  box.focus()
  box.setSelectionRange(at, at + placeholder.length)
  document.execCommand('insertText', false, text)
}

/** Uploads one image into the box: a placeholder at the caret while it goes, then the image's markdown. */
async function addImage(box: HTMLTextAreaElement, repo: string, file: File) {
  const problem = checkPastedImage(file.type, file.size)
  if (problem !== null) {
    showNotice(problem)
    return
  }
  const placeholder = buildUploadingMarkdown(file.name, nextUploadId++)
  insertAtCaret(box, placeholder)
  try {
    const bytes = new Uint8Array(await file.arrayBuffer())
    const url = await globalThis.revio.uploadImage(repo, { name: file.name, contentType: file.type, bytes })
    await rememberPastedImage(url, file)
    replacePlaceholder(box, placeholder, buildImageMarkdown(file.name, url))
  } catch (failure) {
    replacePlaceholder(box, placeholder, '')
    showNotice(`Could not add the image: ${readErrorMessage(failure)}`)
  }
}

/** The images among pasted or dropped files. */
function pickImages(files: FileList) {
  return [...files].filter((file) => file.type.startsWith('image/'))
}

/** Adds the images, one after another so they land in order. */
async function addImages(box: HTMLTextAreaElement, repo: string, images: readonly File[]) {
  for (const image of images) {
    await addImage(box, repo, image)
  }
}

/**
 * Pasting or dropping images into a comment box uploads them to GitHub and writes them in, as on GitHub. Only in a
 * PR, which says which repository the images belong to. `onPaste` returns whether it took the paste.
 */
export function useImagePaste() {
  const repo = useContext(MentionScopeContext)?.repo ?? null
  const take = (box: HTMLTextAreaElement, files: FileList, event: React.SyntheticEvent) => {
    const images = pickImages(files)
    if (images.length === 0) {
      return false
    }
    event.preventDefault()
    if (repo === null) {
      showNotice('Images can be added in a PR’s comment boxes')
    } else {
      addImages(box, repo, images)
    }
    return true
  }
  return {
    onPaste: (event: React.ClipboardEvent<HTMLTextAreaElement>) =>
      take(event.currentTarget, event.clipboardData.files, event),
    onDrop: (event: React.DragEvent<HTMLTextAreaElement>) => {
      take(event.currentTarget, event.dataTransfer.files, event)
    },
  }
}
