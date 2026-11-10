import type { Component } from 'vue'
import { PhCheckSquare, PhHouse, PhMicrophone } from '@phosphor-icons/vue'
import type { NavIconTileColor } from '@/lib/navIconTile'
import { ROUTES } from '@/router/paths'

/** A row in the sidebar. */
export type ProductNavItem = {
  path: string
  label: string
  icon: Component
  iconTile: NavIconTileColor
}

export const productNavHomeItem: ProductNavItem = {
  path: ROUTES.home,
  label: 'Home',
  icon: PhHouse,
  iconTile: 'blue',
}

/** The Dictation hub; its Insights page sits beside it in the top tab bar. */
export const productNavDictationItem: ProductNavItem = {
  path: ROUTES.dictation,
  label: 'Dictation',
  icon: PhMicrophone,
  iconTile: 'red',
}

/** The local Todo list. */
export const productNavTodoItem: ProductNavItem = {
  path: ROUTES.todos,
  label: 'Todo',
  icon: PhCheckSquare,
  iconTile: 'green',
}
