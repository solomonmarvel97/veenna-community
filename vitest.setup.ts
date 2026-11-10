import { beforeEach, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { createPinia, setActivePinia } from 'pinia'

// The effects are React canvases/WebGL; jsdom has neither. Tests keep the
// slot content (so wrapped buttons and cards still render) and skip the effect.
vi.mock('@/components/fx/FxReact', () => ({
  default: defineComponent({
    name: 'FxReactStub',
    inheritAttrs: false,
    setup:
      (_, { attrs, slots }) =>
      () =>
        h('div', attrs, slots.default?.()),
  }),
}))
vi.mock('@/components/fx/FxLiquid', () => ({
  default: defineComponent({
    name: 'FxLiquidStub',
    inheritAttrs: false,
    setup:
      (_, { attrs }) =>
      () =>
        h('div', attrs),
  }),
}))

const store = new Map<string, string>()

const localStorageMock = {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => {
    store.set(key, value)
  },
  removeItem: (key: string) => {
    store.delete(key)
  },
  clear: () => {
    store.clear()
  },
  key: (index: number) => Array.from(store.keys())[index] ?? null,
  get length() {
    return store.size
  },
}

vi.stubGlobal('localStorage', localStorageMock)

// FxOrb reads the theme store, so any component that shows a spinner needs an
// active Pinia even when the test never installs one itself.
beforeEach(() => {
  store.clear()
  setActivePinia(createPinia())
})
