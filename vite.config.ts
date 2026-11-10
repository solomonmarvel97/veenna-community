import path from 'node:path'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { iconPacks } from './scripts/icon-packs-plugin.mjs'

const require = createRequire(import.meta.url)
const { VEENNA_APP_CSP, VEENNA_APP_CSP_DEV, cspForMetaElement } =
  require('./electron/config/csp.cjs') as {
    VEENNA_APP_CSP: string
    VEENNA_APP_CSP_DEV: string
    cspForMetaElement: (policy: string) => string
  }

function readAppVersion(): string {
  try {
    const raw = fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8')
    const parsed = JSON.parse(raw) as { version?: string }
    return parsed.version || '0.1.0'
  } catch {
    return '0.1.0'
  }
}

const srcDir = path.resolve(__dirname, 'src')

/**
 * `@/x` resolves to src/x.<ext>, or to src/x/index.<ext>. A folder's index wins over a file
 * of the same name in another case (case-insensitive disks: Skeleton.vue next to skeleton/).
 */
function srcAlias() {
  return {
    name: 'community-src-alias',
    enforce: 'pre' as const,
    resolveId(source: string) {
      if (!source.startsWith('@/')) return null
      const queryAt = source.indexOf('?')
      const query = queryAt === -1 ? '' : source.slice(queryAt)
      const bare = queryAt === -1 ? source : source.slice(0, queryAt)
      const base = path.join(srcDir, bare.slice(2))
      if (fs.existsSync(base) && fs.statSync(base).isFile()) return base + query
      if (fs.existsSync(base) && fs.statSync(base).isDirectory()) {
        for (const index of ['index.ts', 'index.vue']) {
          const candidate = path.join(base, index)
          if (fs.existsSync(candidate)) return candidate + query
        }
      }
      for (const ext of ['.ts', '.vue', '.js', '.json']) {
        if (fs.existsSync(base + ext)) return base + ext + query
      }
      return null
    },
  }
}

function contentSecurityPolicyPlugin(isDev: boolean) {
  return {
    name: 'community-content-security-policy',
    configureServer(server: import('vite').ViteDevServer) {
      server.middlewares.use((_req, res, next) => {
        res.setHeader('Content-Security-Policy', VEENNA_APP_CSP_DEV)
        next()
      })
    },
    transformIndexHtml(html: string) {
      const policy = cspForMetaElement(isDev ? VEENNA_APP_CSP_DEV : VEENNA_APP_CSP)
      const tag = `<meta http-equiv="Content-Security-Policy" content="${policy}" />`
      return html.replace('<meta charset="UTF-8" />', `<meta charset="UTF-8" />\n    ${tag}`)
    },
  }
}

export default defineConfig({
  // Absolute base: the HUD window loads at a nested path.
  base: '/',
  plugins: [vue(), iconPacks(), srcAlias(), contentSecurityPolicyPlugin(process.env.NODE_ENV !== 'production')],
  define: {
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(readAppVersion()),
    'import.meta.env.VITE_APP_NAME': JSON.stringify('Veenna Community'),
  },
  server: {
    port: 3021,
    strictPort: true,
    // electron-builder writes here; watching it reloads dev with stale packaged HTML.
    watch: { ignored: ['**/release/**'] },
  },
  worker: {
    format: 'es',
    plugins: () => [srcAlias()],
  },
  build: {
    outDir: 'dist',
  },
  // Harper-style WASM finds its files next to its own module; pre-bundling would move them.
  optimizeDeps: { exclude: ['harper.js'] },
})
