import { loadSite } from '../server/site.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }
  try {
    const result = await loadSite(process.env.SUB2API_ORIGIN)
    // 仅缓存无认证的公开内容，不转发访问者 cookie 或 Authorization。
    res.setHeader('Cache-Control', result.settings ? 'public, max-age=0, s-maxage=60' : 'no-store')
    res.setHeader('X-Content-Type-Options', 'nosniff')
    return res.status(200).json(result)
  } catch {
    res.setHeader('Cache-Control', 'no-store')
    return res.status(502).json({ error: '公开信息暂时不可用' })
  }
}
