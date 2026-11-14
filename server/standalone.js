import { createServer } from 'node:http'
import { loadSite } from './site.js'

const port = Number(process.env.PORT || 8787)
let cached
let pending

async function currentSite() {
  if (cached && Date.now() - cached.at < 60_000) return cached.data
  pending ??= loadSite(process.env.SUB2API_ORIGIN).then(data => {
    if (data.settings) cached = { at: Date.now(), data }
    return data
  }).finally(() => { pending = undefined })
  return pending
}

createServer(async (req, res) => {
  const path = new URL(req.url || '/', 'http://127.0.0.1').pathname
  if (path !== '/api/site') { res.writeHead(404); return res.end() }
  if (req.method !== 'GET') { res.writeHead(405, { Allow: 'GET' }); return res.end() }
  try {
    const result = await currentSite()
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' })
    res.end(JSON.stringify(result))
  } catch {
    res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
    res.end(JSON.stringify({ error: '公开信息暂时不可用' }))
  }
}).listen(port, '127.0.0.1', () => console.log(`Read-only public adapter: http://127.0.0.1:${port}/api/site`))
