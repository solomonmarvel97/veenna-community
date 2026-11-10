type SearchEntityType =
  | 'task'
  | 'list'
  | 'list_group'
  | 'note'
  | 'sticky'
  | 'voice_capture'
  | 'dictionary'
  | 'snippet'
  | 'style'
  | 'transform'
  | 'attachment'
  /** Agent skills live in the local store; not in the default search filter. */
  | 'skill'
  | 'jenny_session'
  | 'jenny_message'
  | 'loop'



type UniversalSearchStatus = 'active' | 'completed' | 'all'

type UniversalSearchScope = 'personal' | 'organisation' | 'team' | 'all'

interface UniversalSearchRoute {
  path: string
  query?: Record<string, string>
}

interface UniversalSearchHit {
  id: string
  type: SearchEntityType
  title: string
  subtitle?: string
  snippet?: string
  matchedFields: string[]
  score: number
  updatedAt: string
  route: UniversalSearchRoute
  meta: Record<string, unknown>
}

export interface UniversalSearchGroup {
  type: SearchEntityType
  label: string
  total: number
  hits: UniversalSearchHit[]
  hasMore: boolean
}

interface UniversalSearchFilters {
  types: SearchEntityType[]
  status: UniversalSearchStatus
  scope: UniversalSearchScope
  listId?: string
  groupId?: string
  dateFrom?: string
  dateTo?: string
  importance?: boolean
  due?: 'today' | 'overdue' | 'week'
  source?: string
}


