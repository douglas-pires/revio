import type { Emoji } from '@shared/emoji.types.ts'

/** The code points in the address of a picture GitHub has for a Unicode emoji, like `unicode/1f1fa-1f1f8.png`. */
const UNICODE_PICTURE = /\/unicode\/(?<codes>[0-9a-f-]+)\.png/u
const HEX = 16
/** Two of these together are a flag. */
const REGIONAL_INDICATOR = /^\p{Regional_Indicator}$/u
const DRAWN_AS_EMOJI = /^\p{Emoji_Presentation}$/u
/** After a character that is drawn as text by default (❤), asks for the emoji. */
const EMOJI_VARIATION = '️'

function readCharacters(imageUrl: string): string[] {
  const codes = UNICODE_PICTURE.exec(imageUrl)?.groups?.codes
  return codes?.split('-').map((code) => String.fromCodePoint(Number.parseInt(code, HEX))) ?? []
}

/**
 * What to write for an emoji. GitHub's addresses leave out the joiners of emojis made of several characters, so only
 * single characters and flags can be rebuilt; for the rest GitHub turns `:name:` into the picture.
 */
function readText(name: string, imageUrl: string): string {
  const characters = readCharacters(imageUrl)
  const [first] = characters
  if (characters.length === 1 && first) {
    if (DRAWN_AS_EMOJI.test(first)) {
      return first
    }
    return first + EMOJI_VARIATION
  }
  if (characters.length > 1 && characters.every((character) => REGIONAL_INDICATOR.test(character))) {
    return characters.join('')
  }
  return `:${name}:`
}

/** GitHub's emojis from its list of pictures by name. */
export function parseEmojis(pictures: Readonly<Record<string, string>>): Emoji[] {
  return Object.entries(pictures).map(([name, imageUrl]) => ({ name, text: readText(name, imageUrl), imageUrl }))
}
