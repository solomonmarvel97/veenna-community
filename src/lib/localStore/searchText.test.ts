import { describe, expect, it } from 'vitest'
import { searchTextForVoiceCapture } from '@/lib/localStore/searchText'

describe('searchTextForVoiceCapture', () => {
  it('is the trimmed text', () => {
    expect(searchTextForVoiceCapture({ text: '  hello world ' })).toBe('hello world')
    expect(searchTextForVoiceCapture({})).toBe('')
  })
})
