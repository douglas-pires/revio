import { describe, expect, it } from 'vitest'
import { splitMentions } from './mention-syntax.util.ts'

const listMentions = (text: string) =>
  splitMentions(text)
    .filter((piece) => piece.mention)
    .map((piece) => piece.text)

describe('splitMentions', () => {
  it('finds people and teams', () => {
    expect(listMentions('@ana can you look? cc @acme/web-team, (@bo-2)')).toEqual(['@ana', '@acme/web-team', '@bo-2'])
  })

  it('leaves out emails, code and a lone "@"', () => {
    expect(listMentions('ana@acme.com @ `@Injectable()`')).toEqual([])
    expect(listMentions('```ts\n@Module()\n```\n@ana')).toEqual(['@ana'])
    expect(listMentions('```ts\n@Module() still typing')).toEqual([])
  })

  it('keeps every character, so the pieces lie exactly over the text', () => {
    const text = 'Hi @ana,\n  see `@x` and @bo\n'
    expect(
      splitMentions(text)
        .map((piece) => piece.text)
        .join(''),
    ).toBe(text)
  })
})
