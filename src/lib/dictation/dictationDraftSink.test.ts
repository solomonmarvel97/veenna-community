import { describe, expect, it } from 'vitest'
import {
  insertIntoActiveDictationDraft,
  markDictationDraftSinkActive,
  registerDictationDraftSink,
} from './dictationDraftSink'

describe('dictationDraftSink', () => {
  it('inserts only when the given element belongs to the sink', () => {
    let draft = 'hello'
    const field = document.createElement('textarea')
    const sink = {
      isTarget: (el: Element | null) => el === field,
      getBaseText: () => draft,
      insert: (text: string) => {
        draft = `${draft} ${text}`
        return true
      },
    }
    const unregister = registerDictationDraftSink(sink)
    markDictationDraftSinkActive(sink)

    expect(insertIntoActiveDictationDraft('there')).toBe(false)
    expect(draft).toBe('hello')

    expect(insertIntoActiveDictationDraft('there', field)).toBe(true)
    expect(draft).toBe('hello there')
    unregister()
  })
})
