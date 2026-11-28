/** An image pasted or dropped into a comment box, to upload to GitHub. */
export interface PastedImage {
  name: string
  contentType: string
  bytes: Uint8Array
}

/** GitHub's limit for an image in a comment. */
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024

/** The image types GitHub takes in comments (SVG is left out: a pasted one is rare and may carry script). */
const IMAGE_TYPES: readonly string[] = ['image/png', 'image/jpeg', 'image/gif', 'image/webp']

const BYTES_PER_MB = 1024 * 1024

/** Why an image cannot be uploaded, or null when it can. */
export function checkPastedImage(contentType: string, size: number): string | null {
  if (!IMAGE_TYPES.includes(contentType)) {
    return 'Only PNG, JPEG, GIF and WebP images can be added'
  }
  if (size > MAX_IMAGE_BYTES) {
    return `The image is ${(size / BYTES_PER_MB).toFixed(1)} MB; GitHub takes up to 10 MB`
  }
  return null
}

/** The alt text for an image: its file name without the extension, "image" when it has none. */
function describeImage(name: string) {
  const base = name.replace(/\.[^.]+$/u, '').replace(/[[\]]/gu, '')
  return base || 'image'
}

/** Markdown for an uploaded image, as GitHub writes it. */
export function buildImageMarkdown(name: string, url: string) {
  return `![${describeImage(name)}](${url})`
}

/** What a comment box shows while the image uploads; unique, so it can be found and swapped for the image. */
export function buildUploadingMarkdown(name: string, id: number) {
  return `![Uploading ${describeImage(name)} (${id})…]()`
}
