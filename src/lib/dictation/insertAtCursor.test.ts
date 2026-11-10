import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { registerDictationDraftSink } from './dictationDraftSink'
import {
  captureActiveDictationInsertTarget,
  captureDictationInsertTarget,
  ensureDictationInsertFocusTracking,
  insertDictationTextAtCursor,
  insertDictationTextIntoLocalDom,
} from './insertAtCursor'

describe('insertDictationTextAtCursor', () => {
  beforeEach(() => {
    ensureDictationInsertFocusTracking()
    document.body.innerHTML = ''
  })

  afterEach(() => {
    document.body.innerHTML = ''
    vi.unstubAllGlobals()
  })

  it('inserts into a focused text input at the caret', async () => {
    const input = document.createElement('input')
    input.value = 'hello world'
    document.body.appendChild(input)
    input.focus()
    input.setSelectionRange(6, 6)
    captureDictationInsertTarget()

    const result = await insertDictationTextAtCursor('there')
    expect(result.ok).toBe(true)
    expect(result.method).toBe('dom')
    expect(input.value).toBe('hello thereworld')
  })

  it('inserts via staleDomTarget after dictation chrome steals focus', async () => {
    const input = document.createElement('input')
    input.value = ''
    document.body.appendChild(input)
    input.focus()
    captureDictationInsertTarget()

    const chrome = document.createElement('button')
    chrome.type = 'button'
    chrome.setAttribute('data-veenna-dictation-ui', '')
    document.body.appendChild(chrome)
    chrome.focus()
    expect(document.activeElement).toBe(chrome)

    const result = await insertDictationTextAtCursor('dictated text', {
      staleDomTarget: captureActiveDictationInsertTarget(),
    })
    expect(result.ok).toBe(true)
    expect(input.value).toBe('dictated text')
  })

  it('replaces the current selection in a textarea', async () => {
    const area = document.createElement('textarea')
    area.value = 'one two three'
    document.body.appendChild(area)
    area.focus()
    area.setSelectionRange(4, 7)
    captureDictationInsertTarget()

    const result = await insertDictationTextAtCursor('2')
    expect(result.ok).toBe(true)
    expect(area.value).toBe('one 2 three')
  })

  it('does not insert into a field after focus has left it', async () => {
    const area = document.createElement('textarea')
    area.value = ''
    document.body.appendChild(area)
    area.focus()
    captureDictationInsertTarget()

    const button = document.createElement('button')
    button.type = 'button'
    document.body.appendChild(button)
    button.focus()

    expect(insertDictationTextIntoLocalDom('from hud')).toBe(false)
    expect(area.value).toBe('')
  })

  it('inserts into the focused field, not a previously registered composer sink', async () => {
    let composerDraft = ''
    const composer = document.createElement('textarea')
    document.body.appendChild(composer)
    const unregister = registerDictationDraftSink({
      isTarget: (el) => el === composer,
      getBaseText: () => composerDraft,
      insert: (text) => {
        composerDraft = text
        composer.value = text
        return true
      },
    })

    composer.focus()
    captureDictationInsertTarget()

    const search = document.createElement('input')
    search.value = ''
    document.body.appendChild(search)
    search.focus()
    captureDictationInsertTarget()

    expect(insertDictationTextIntoLocalDom('notes query')).toBe(true)
    expect(search.value).toBe('notes query')
    expect(composerDraft).toBe('')
    expect(composer.value).toBe('')
    unregister()
  })

  it('does not insert into a previously focused composer after leaving every input', async () => {
    let composerDraft = ''
    const composer = document.createElement('textarea')
    document.body.appendChild(composer)
    const unregister = registerDictationDraftSink({
      isTarget: (el) => el === composer,
      getBaseText: () => composerDraft,
      insert: (text) => {
        composerDraft = text
        composer.value = text
        return true
      },
    })

    composer.focus()
    captureDictationInsertTarget()

    const button = document.createElement('button')
    button.type = 'button'
    document.body.appendChild(button)
    button.focus()

    expect(insertDictationTextIntoLocalDom('notes query')).toBe(false)
    expect(composerDraft).toBe('')
    expect(composer.value).toBe('')
    unregister()
  })
})
