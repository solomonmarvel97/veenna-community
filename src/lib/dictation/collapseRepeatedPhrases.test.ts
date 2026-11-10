import { describe, expect, it } from 'vitest'
import { collapseRepeatedPhrases, dedupeRepeatedSentences } from './collapseRepeatedPhrases'

describe('dedupeRepeatedSentences', () => {
  it('drops a sentence said twice', () => {
    expect(dedupeRepeatedSentences('Hello there. Hello there. How are you?')).toBe(
      'Hello there. How are you?',
    )
  })

  it('treats "all right" and "alright" as the same', () => {
    expect(dedupeRepeatedSentences('All right. Alright.')).toBe('All right.')
  })

  it('leaves a single sentence alone and tidies whitespace', () => {
    expect(dedupeRepeatedSentences('  one   two\nthree ')).toBe('one two three')
    expect(dedupeRepeatedSentences('')).toBe('')
  })
})

describe('collapseRepeatedPhrases', () => {
  it('collapses a run of words repeated back to back', () => {
    const text = 'we should go to the market we should go to the market and buy bread'
    expect(collapseRepeatedPhrases(text)).toBe('we should go to the market and buy bread')
  })

  it('leaves short text alone', () => {
    expect(collapseRepeatedPhrases('a b a b')).toBe('a b a b')
  })
})
