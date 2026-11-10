import type { RouteRecordRaw } from 'vue-router'
import AppLayout from '@/app/AppLayout.vue'
import DictationPageSkeleton from '@/components/skeleton/DictationPageSkeleton.vue'
import InsightsPageSkeleton from '@/components/skeleton/InsightsPageSkeleton.vue'
import SettingsPageLoading from '@/components/settings/SettingsPageLoading.vue'
import { ROUTES } from '@/router/paths'
import { lazyPage } from '@/router/lazyPage'
// Home is the landing page: bundled, not lazy, so it is there in the first frame.
import HomeView from '@/views/HomeView.vue'

// Veenna Community has five screens: Home, Dictation, Todo, Insights, Settings, and the
// dictation HUD window. There is no account, so no login, chat or other pages.
const DictationHudView = () => import('@/views/DictationHudView.vue')
const SettingsView = lazyPage(() => import('@/views/SettingsView.vue'), {
  placeholder: SettingsPageLoading,
})
const InsightsView = lazyPage(() => import('@/views/InsightsView.vue'), {
  placeholder: InsightsPageSkeleton,
})
const TodosView = lazyPage(() => import('@/views/TodosView.vue'), {
  placeholder: DictationPageSkeleton,
})
const DictationView = lazyPage(() => import('@/views/DictationView.vue'), {
  placeholder: DictationPageSkeleton,
})

export const routes: RouteRecordRaw[] = [
  {
    path: '/index.html',
    redirect: ROUTES.dictation,
  },
  {
    path: ROUTES.dictationHud,
    name: 'dictation-hud',
    component: DictationHudView,
    meta: { hud: true },
  },
  {
    path: ROUTES.preferences,
    redirect: ROUTES.settings,
  },
  {
    path: '/',
    name: 'app-layout',
    component: AppLayout,
    children: [
      {
        path: '',
        name: 'home',
        component: HomeView,
      },
      {
        path: 'dictation',
        name: 'feature-dictation',
        component: DictationView,
      },
      {
        path: 'todos',
        name: 'todos',
        component: TodosView,
      },
      {
        path: 'insights',
        name: 'insights',
        component: InsightsView,
      },
      {
        path: 'settings',
        name: 'settings',
        component: SettingsView,
      },
    ],
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    redirect: ROUTES.dictation,
  },
]
