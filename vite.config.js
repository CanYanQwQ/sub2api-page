import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import { loadSite } from './server/site.js'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [
      vue(),
      {
        name: 'public-site-api',
        configureServer(server) {
          server.middlewares.use('/api/site', async (req, res) => {
            if (req.method !== 'GET') {
              res.writeHead(405, { Allow: 'GET' })
              return res.end()
            }
            try {
              const data = await loadSite(env.SUB2API_ORIGIN)
              res.setHeader('Content-Type', 'application/json; charset=utf-8')
              res.setHeader('Cache-Control', 'no-store')
              res.end(JSON.stringify(data))
            } catch {
              res.writeHead(502, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify({ error: '公开信息暂时不可用' }))
            }
          })
        },
      },
    ],
    server: { port: 5173, strictPort: true },
  }
})
