/** ~2,750 words ≈ one college essay. */
const WORDS_PER_ESSAY = 2750
const WORDS_PER_CHAPTER = 5000
const WORDS_PER_NOVEL = 80000

/** A plain description of the pace, bands taken from typical speaking rates (no population ranking). */
export function wpmPaceLabel(wpm: number): string {
  if (wpm <= 0) return 'Shows after a few minutes of dictation'
  if (wpm >= 190) return 'Rapid-fire'
  if (wpm >= 150) return 'Brisk'
  if (wpm >= 110) return 'Conversational'
  return 'Relaxed'
}

export function wordsMilestone(totalWords: number): string {
  if (totalWords <= 0) return 'Your first dictation unlocks milestones here.'
  if (totalWords < 200) return "You're warming up - keep going."
  if (totalWords < WORDS_PER_ESSAY) {
    const left = WORDS_PER_ESSAY - totalWords
    return `About ${left.toLocaleString()} words to a college essay.`
  }
  const essays = Math.floor(totalWords / WORDS_PER_ESSAY)
  if (essays === 1) return "You've written 1 college essay!"
  if (totalWords < WORDS_PER_CHAPTER * 2) {
    return `You've written ${essays} college essays!`
  }
  const chapters = Math.floor(totalWords / WORDS_PER_CHAPTER)
  if (chapters < 8) return `That's roughly ${chapters} book chapters.`
  const novels = Math.floor(totalWords / WORDS_PER_NOVEL)
  if (novels >= 1) {
    return novels === 1
      ? "You've dictated a novel's worth of words."
      : `You've dictated ${novels} novels' worth of words.`
  }
  return `You've written ${essays} college essays!`
}

export function formatCompactCount(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (value >= 10_000) return `${Math.round(value / 1000)}K`
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`
  return value.toLocaleString()
}

export function formatGrowthBadge(pct: number): string | null {
  if (!Number.isFinite(pct) || pct === 0) return null
  const abs = Math.abs(pct)
  const label = abs >= 1000 ? `${(abs / 1000).toFixed(1)}K%` : `${Math.round(abs)}%`
  return pct > 0 ? `↗ ${label} this month` : `↘ ${label} this month`
}

export type UsageCategoryId = 'ai' | 'other' | 'documents' | 'personal' | 'work' | 'email'

export const USAGE_CATEGORY_META: Record<UsageCategoryId, { label: string; countLabel: string }> = {
  ai: { label: 'AI prompts', countLabel: 'AI prompts' },
  other: { label: 'Other tasks', countLabel: 'other tasks' },
  documents: { label: 'Documents', countLabel: 'documents' },
  personal: { label: 'Personal messages', countLabel: 'personal msgs' },
  work: { label: 'Work messages', countLabel: 'work msgs' },
  email: { label: 'Emails', countLabel: 'emails' },
}
