import tailwindcssAnimate from 'tailwindcss-animate'

/**
 * The veenna tokens are plain CSS colours (hex, rgba, color-mix), so Tailwind cannot add
 * opacity to them on its own and silently drops classes like `bg-veenna-row/40`.
 * Mixing with transparent gives every one of them a working `/NN`.
 */
function withAlpha(colors) {
  return Object.fromEntries(
    Object.entries(colors).map(([name, value]) => [
      name,
      `color-mix(in srgb, ${value} calc(<alpha-value> * 100%), transparent)`,
    ]),
  )
}

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: [
    './index.html',
    './src/**/*.{vue,js,ts}',
    './packages/notes-app/src/**/*.{vue,js,ts}',
    './packages/app-kit/src/**/*.{vue,js,ts}',
    './packages/app-template/src/**/*.{vue,js,ts}',
    './packages/desk-app/src/**/*.{vue,js,ts}',
    './packages/tldraw-app/src/**/*.{vue,js,ts}',
  ],
  theme: {
    extend: {
      transitionDuration: {
        'motion-fast': 'var(--motion-duration-fast, 150ms)',
        'motion-normal': 'var(--motion-duration-normal, 200ms)',
      },
      transitionTimingFunction: {
        'motion-standard': 'var(--motion-ease-standard, cubic-bezier(0.2, 0, 0, 1))',
      },
      // The type scale: one source of truth, copied to frontend, admin, design-system and web.
      // Use these names, never an arbitrary text-[Npx]. Docs: frontend/src/design-system/tokens/typography.ts
      fontSize: {
        micro: ['10px', '14px'], // badges, counts
        label: ['11px', '16px'], // overlines, tags, section labels
        caption: ['12px', '16px'], // controls, hints, timestamps
        'body-sm': ['13px', '18px'], // dense reading text
        body: ['14px', '20px'], // default reading text, inputs, rows
        'title-sm': ['16px', '24px'], // pane titles
        title: ['18px', '28px'], // modal titles
        'page-title': ['20px', '28px'], // page titles
        display: ['24px', '32px'], // greetings, onboarding and sign-in headings
        stat: ['30px', '36px'], // big numbers in stat tiles
        hero: ['48px', '1'], // gauges, hero numbers
      },
      letterSpacing: {
        overline: '0.06em', // uppercase labels
      },
      borderRadius: {
        // ChatGPT-style soft scale. Buttons, tabs and chips use rounded-full.
        sm: 'calc(var(--radius) - 8px)',
        md: 'calc(var(--radius) - 4px)',
        lg: 'var(--radius)',
        xl: 'calc(var(--radius) + 4px)',
        '2xl': 'calc(var(--radius) + 8px)',
        '3xl': 'calc(var(--radius) + 16px)',
      },
      colors: {
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        veenna: withAlpha({
          bg: 'var(--veenna-bg)',
          surface: 'var(--veenna-surface)',
          panel: 'var(--veenna-panel)',
          accent: 'var(--veenna-accent)',
          'accent-fg': 'var(--veenna-accent-fg)',
          'accent-soft': 'var(--veenna-accent-soft)',
          border: 'var(--veenna-border)',
          'focus-line': 'var(--veenna-focus-line)',
          'select-line': 'var(--veenna-select-line)',
          divider: 'var(--veenna-divider)',
          muted: 'var(--veenna-muted)',
          secondary: 'var(--veenna-secondary)',
          icon: 'var(--veenna-icon)',
          'icon-muted': 'var(--veenna-icon-muted)',
          ring: 'var(--veenna-ring)',
          'ring-hover': 'var(--veenna-ring-hover)',
          star: 'var(--veenna-star)',
          'star-active': 'var(--veenna-star-active)',
          row: 'var(--veenna-row)',
          'row-hover': 'var(--veenna-row-hover)',
          fg: 'var(--veenna-fg)',
          'search-bg': 'var(--veenna-search-bg)',
          'search-border': 'var(--veenna-search-border)',
          frame: 'var(--veenna-frame)',
          'frame-border': 'var(--veenna-frame-border)',
          sidebar: 'var(--veenna-sidebar)',
          'sidebar-border': 'var(--veenna-sidebar-border)',
          'sidebar-row-hover': 'var(--veenna-sidebar-row-hover)',
          'nav-card': 'var(--veenna-nav-card)',
          card: 'var(--veenna-card)',
          overlay: 'var(--veenna-overlay)',
          'focus-subtle': 'var(--veenna-focus-subtle)',
          'tab-active-bg': 'var(--veenna-tab-active-bg)',
          'tab-active-fg': 'var(--veenna-tab-active-fg)',
          'heatmap-accent': 'var(--veenna-heatmap-accent)',
          scrollbar: 'var(--veenna-scrollbar)',
        }),
      },
      boxShadow: {
        'veenna-sm': 'var(--veenna-shadow-sm)',
        'veenna-search': 'var(--veenna-shadow-search)',
        'veenna-float': 'var(--veenna-shadow-float)',
      },
    },
  },
  plugins: [tailwindcssAnimate],
}
