/**
 * Images you pasted this session, by the URL GitHub gave them. GitHub serves an upload only once a posted comment uses
 * it, so until then the preview shows the image from your clipboard (as a data URL, which the page already allows).
 */
const previews = new Map<string, string>()

function readAsDataUrl(image: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(image)
  })
}

export async function rememberPastedImage(url: string, image: Blob) {
  try {
    previews.set(url, await readAsDataUrl(image))
  } catch {
    /* without the local copy, the preview links to the image instead */
  }
}

/** The local copy of a pasted image, or the URL itself for any other image. */
export function readImageSource(url: string) {
  return previews.get(url) ?? url
}
