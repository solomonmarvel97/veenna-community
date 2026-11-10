import type { ClassValue } from 'clsx'
import { clsx } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

// Teach the merger our type-scale names so `text-label` is a font size, not a text colour.
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [
        {
          text: [
            'micro',
            'label',
            'caption',
            'body-sm',
            'body',
            'title-sm',
            'title',
            'page-title',
            'display',
            'stat',
            'hero',
          ],
        },
      ],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}


/**
 * Round up a time to the next 15-minute interval.
 * Handles AM/PM transitions correctly (e.g., 11:45am to 12:00pm).
 * @param date - The date to round up (defaults to current time)
 * @returns A new Date object rounded up to the next 15-minute interval
 */
export function roundUpToNext15Minute(date: Date = new Date()): Date {
  const result = new Date(date.getTime())
  const minutes = result.getMinutes()
  const roundedMinutes = Math.ceil(minutes / 15) * 15

  if (roundedMinutes === 60) {
    result.setHours(result.getHours() + 1)
    result.setMinutes(0)
  } else {
    result.setMinutes(roundedMinutes)
  }

  result.setSeconds(0)
  result.setMilliseconds(0)

  return result
}

/**
 * Get the current time rounded up to the next 15-minute interval as a formatted string (HH:MM).
 * @returns Time string in 24-hour format (e.g., "09:30")
 */
export function getCurrentTimeRoundedUp(): string {
  const rounded = roundUpToNext15Minute()
  const hours = String(rounded.getHours()).padStart(2, '0')
  const minutes = String(rounded.getMinutes()).padStart(2, '0')
  return `${hours}:${minutes}`
}
