import { describe, expect, it } from 'vitest'
import {
  buildLocalSttPrompt,
  isShortFormatClip,
  isVerbatimStylePrompt,
  resolveSttLanguage,
  SHORT_FORMAT_CLIP_CHARS,
  shouldApplyStyleRewrite,
} from './voiceDictationHelpers'

describe('voiceDictationHelpers', () => {
  it('treats verbatim and original as fidelity-first styles', () => {
    expect(isVerbatimStylePrompt('verbatim')).toBe(true)
    expect(isVerbatimStylePrompt('original')).toBe(true)
    expect(isVerbatimStylePrompt('')).toBe(true)
    expect(isVerbatimStylePrompt('polish')).toBe(false)
    expect(isVerbatimStylePrompt('professional')).toBe(false)
  })

  it('applies style rewrite only for non-verbatim styles or transforms', () => {
    expect(shouldApplyStyleRewrite({ stylePrompt: 'verbatim', transformId: null })).toBe(false)
    expect(shouldApplyStyleRewrite({ stylePrompt: 'polish', transformId: null })).toBe(true)
    expect(shouldApplyStyleRewrite({ stylePrompt: 'bullets', transformId: null })).toBe(true)
    expect(
      shouldApplyStyleRewrite({
        stylePrompt: 'verbatim',
        transformId: 'transform-id',
      }),
    ).toBe(true)
    expect(
      shouldApplyStyleRewrite({
        stylePrompt: 'Make this more formal',
        transformId: null,
      }),
    ).toBe(true)
  })

  it('treats empty prompts as verbatim for fidelity helpers', () => {
    expect(isVerbatimStylePrompt('')).toBe(true)
    expect(isVerbatimStylePrompt(null)).toBe(true)
    expect(isVerbatimStylePrompt('professional')).toBe(false)
  })

  it('omits known generation style keys from local stt prompt', () => {
    const prompt = buildLocalSttPrompt({
      stylePrompt: 'bullets',
      dictionaryEntries: [{ term: 'Maggi' }],
    })
    expect(prompt).toContain('Maggi')
    expect(prompt).not.toContain('bullets')
  })

  it('falls back to english for stt language', () => {
    expect(resolveSttLanguage(null)).toBe('en')
    expect(resolveSttLanguage('fr')).toBe('fr')
  })

  it('builds local stt prompt from corrected spellings only', () => {
    const prompt = buildLocalSttPrompt({
      stylePrompt: 'polish',
      dictionaryEntries: [
        { term: 'Acme', pronunciationHint: 'ack me' },
        { term: 'Jenny', replacement: 'AI assistant' },
        { term: 'Vienna', replacement: 'Veenna', pronunciationHint: 'Veenna' },
      ],
    })
    expect(prompt).toContain('Acme')
    expect(prompt).toContain('ack me')
    expect(prompt).toContain('AI assistant')
    expect(prompt).toContain('Veenna')
    expect(prompt).not.toContain('means')
    expect(prompt).not.toContain('Jenny')
    expect(prompt).not.toContain('Vienna')
    expect(prompt).not.toContain('polish')
  })

  it('cuts the stt prompt on an entry boundary', () => {
    const prompt = buildLocalSttPrompt({
      dictionaryEntries: [{ term: 'Veenna' }, { term: 'Langfuse' }, { term: 'OpenRouter' }],
    })
    // Full budget still fits these three; verify join shape and no mid-word cut.
    expect(prompt).toBe('Veenna, Langfuse, OpenRouter')
  })

  it('classifies short format clips for non-stream transport', () => {
    expect(SHORT_FORMAT_CLIP_CHARS).toBe(280)
    expect(isShortFormatClip('short')).toBe(true)
    expect(isShortFormatClip('a'.repeat(280))).toBe(true)
    expect(isShortFormatClip('a'.repeat(281))).toBe(false)
  })
})
