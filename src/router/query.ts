import type { LocationQuery } from 'vue-router'
import { QUERY, normalizeSettingsTab, type SettingsTab } from '@/router/paths'

/** A query value as a non-empty string (the first one, if repeated), or null. */
export function queryString(value: unknown): string | null {
  if (typeof value === 'string' && value.length) return value
  if (Array.isArray(value) && typeof value[0] === 'string' && value[0].length) return value[0]
  return null
}

/** The settings tab an address names; anything unknown opens General. */
export function parseSettingsTabQuery(query: LocationQuery): SettingsTab {
  const tab = queryString(query[QUERY.tab])
  return (tab && normalizeSettingsTab(tab)) || 'general'
}
