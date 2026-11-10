/**
 * Ticking todos in select mode. A plain click flips one row; a shift-click
 * sets every row from the last one clicked through this one to the state the
 * clicked row is taking.
 */
export function nextTaskSelection(
  selected: ReadonlySet<string>,
  orderedIds: readonly string[],
  id: string,
  opts: { anchorId?: string | null; range?: boolean } = {},
): Set<string> {
  const next = new Set(selected)
  const checking = !selected.has(id)
  const from = opts.range && opts.anchorId ? orderedIds.indexOf(opts.anchorId) : -1
  const to = orderedIds.indexOf(id)
  if (from < 0 || to < 0) {
    if (checking) next.add(id)
    else next.delete(id)
    return next
  }
  const [start, end] = from < to ? [from, to] : [to, from]
  for (const rowId of orderedIds.slice(start, end + 1)) {
    if (checking) next.add(rowId)
    else next.delete(rowId)
  }
  return next
}

/** The confirm-dialog title for deleting this many todos. */
export function bulkDeleteTitle(count: number, completedOnly = false): string {
  const noun = count === 1 ? 'todo' : 'todos'
  return completedOnly ? `Delete ${count} completed ${noun}?` : `Delete ${count} ${noun}?`
}
