






export type ActiveView =
  | {
      kind: 'smart'
      view: 'gmail-starred' | 'tasks'
    }
  | { kind: 'list'; listId: string }
