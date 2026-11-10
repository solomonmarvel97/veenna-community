// The Veenna Community API. Three read-only routes, no database, no accounts, no cookies.
// It never receives dictation: there is no route that accepts a request body.
import { createServer } from 'node:http'
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

/** Loads the built, signed files once. Returns a function that answers a request. */
export function createHandler(distDir = path.join(root, 'dist', 'v1')) {
  const files = new Map()
  for (const name of ['models.json', 'latest.json']) {
    const file = path.join(distDir, name)
    if (existsSync(file)) files.set(`/v1/${name}`, readFileSync(file))
  }

  return (req, res) => {
    const url = new URL(req.url || '/', 'http://localhost')
    const method = req.method || 'GET'
    if (method !== 'GET' && method !== 'HEAD') {
      res.writeHead(405, { allow: 'GET, HEAD' }).end()
      return
    }
    if (url.pathname === '/v1/health') {
      res.writeHead(204, { 'cache-control': 'no-store' }).end()
      return
    }
    const body = files.get(url.pathname)
    if (!body) {
      res.writeHead(404, { 'cache-control': 'no-store' }).end()
      return
    }
    res.writeHead(200, {
      'content-type': 'application/json; charset=utf-8',
      'content-length': body.length,
      'cache-control': 'public, max-age=300',
    })
    res.end(method === 'HEAD' ? undefined : body)
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 8787)
  createServer(createHandler()).listen(port, () => console.log(`veenna-community-api on :${port}`))
}
