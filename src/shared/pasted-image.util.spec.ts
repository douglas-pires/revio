import { describe, expect, it } from 'vitest'
import { buildImageMarkdown, buildUploadingMarkdown, checkPastedImage, MAX_IMAGE_BYTES } from './pasted-image.util.ts'

describe('checkPastedImage', () => {
  it('takes images GitHub shows, up to 10 MB', () => {
    expect(checkPastedImage('image/png', 2000)).toBeNull()
    expect(checkPastedImage('image/webp', MAX_IMAGE_BYTES)).toBeNull()
  })

  it('says why other files cannot be added', () => {
    expect(checkPastedImage('image/svg+xml', 10)).toMatch(/PNG, JPEG, GIF and WebP/u)
    expect(checkPastedImage('application/pdf', 10)).toMatch(/PNG/u)
    expect(checkPastedImage('image/png', MAX_IMAGE_BYTES + 1)).toMatch(/10\.0 MB; GitHub takes up to 10 MB/u)
  })
})

describe('image markdown', () => {
  it('names the image after its file', () => {
    expect(buildImageMarkdown('Screen Shot.png', 'https://github.com/user-attachments/assets/1')).toBe(
      '![Screen Shot](https://github.com/user-attachments/assets/1)',
    )
    expect(buildImageMarkdown('.png', 'u')).toBe('![image](u)')
    expect(buildImageMarkdown('a]b.png', 'u')).toBe('![ab](u)')
  })

  it('marks each upload in progress apart from the others', () => {
    expect(buildUploadingMarkdown('image.png', 2)).toBe('![Uploading image (2)…]()')
  })
})
