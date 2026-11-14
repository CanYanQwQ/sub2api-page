// 只访问公开 API，不需要且不接受 JWT、管理员密钥或浏览器传入的 URL。
export const DEFAULT_ORIGIN = 'https://ai.zhouwanx.top'

const text = (value, max = 300) => typeof value === 'string' ? value.trim().slice(0, max) : ''

export function safeUrl(value, base = DEFAULT_ORIGIN) {
  if (typeof value !== 'string' || !value.trim()) return ''
  try {
    const url = new URL(value, base)
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : ''
  } catch {
    return ''
  }
}

export function normalizeSettings(raw, origin = DEFAULT_ORIGIN) {
  const flags = [
    'registration_enabled', 'payment_enabled', 'subscription_enabled',
    'model_plaza_enabled', 'model_plaza_require_auth', 'channel_monitor_enabled',
    'available_channels_enabled', 'backend_mode_enabled',
  ]
  const settings = {
    name: text(raw.site_name, 80) || '岚潮API',
    subtitle: text(raw.site_subtitle, 300),
    logo: '',
    apiBase: safeUrl(raw.api_base_url, origin) || origin,
    docUrl: safeUrl(raw.doc_url, origin),
    contact: text(raw.contact_info, 500),
    version: text(raw.version, 40),
    endpoints: [],
    flags: {},
  }
  const logo = raw.site_logo
  // 只接受公开品牌图片，禁用 data SVG/HTML 与可执行协议。
  if (typeof logo === 'string' && logo.length < 450_000 && /^data:image\/(?:png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(logo)) {
    settings.logo = logo
  } else {
    settings.logo = safeUrl(logo, origin)
  }
  for (const key of flags) {
    if (typeof raw[key] === 'boolean') settings.flags[key] = raw[key]
  }
  settings.endpoints = (Array.isArray(raw.custom_endpoints) ? raw.custom_endpoints : []).slice(0, 12)
    .map(item => ({ name: text(item.name, 80), url: safeUrl(item.endpoint, origin), description: text(item.description, 200) }))
    .filter(item => item.url)
  return settings
}

export function normalizeCatalog(raw) {
  const groups = Array.isArray(raw.groups) ? raw.groups : []
  const models = new Map()
  const platforms = new Map()
  for (const group of groups.slice(0, 200)) {
    for (const item of (Array.isArray(group.models) ? group.models : []).slice(0, 600)) {
      const name = text(item.name, 160)
      const platform = text(item.platform || group.platform, 60).toLowerCase()
      if (!name || !platform) continue
      const key = `${platform}:${name}`
      if (!models.has(key)) models.set(key, { name, platform })
      if (!platforms.has(platform)) platforms.set(platform, new Set())
      platforms.get(platform).add(name)
    }
  }
  return {
    groupCount: groups.length,
    modelCount: models.size,
    platforms: [...platforms].map(([id, names]) => ({ id, count: names.size, models: [...names] })),
    models: [...models.values()],
  }
}

async function getPublic(origin, path, fetcher) {
  const response = await fetcher(`${origin}${path}`, {
    headers: { Accept: 'application/json' },
    redirect: 'error',
    signal: AbortSignal.timeout(9000),
  })
  if (!response.ok) throw new Error(`public-api-${response.status}`)
  const body = await response.text()
  if (body.length > 2_000_000) throw new Error('public-api-too-large')
  const result = JSON.parse(body)
  if (result.code !== 0 || !result.data || typeof result.data !== 'object') throw new Error('invalid-public-response')
  return result.data
}

export async function loadSite(configuredOrigin, fetcher = fetch) {
  const originUrl = new URL(configuredOrigin || DEFAULT_ORIGIN)
  if (originUrl.protocol !== 'https:' || originUrl.username || originUrl.password) throw new Error('invalid-origin')
  const origin = originUrl.origin
  const [settingsResult, catalogResult] = await Promise.allSettled([
    getPublic(origin, '/api/v1/settings/public', fetcher),
    getPublic(origin, '/api/v1/model-plaza', fetcher),
  ])
  const settings = settingsResult.status === 'fulfilled' ? normalizeSettings(settingsResult.value, origin) : null
  const catalogAllowed = settings?.flags.model_plaza_enabled !== false && settings?.flags.model_plaza_require_auth !== true && settings?.flags.backend_mode_enabled !== true
  return {
    origin,
    settings,
    catalog: catalogAllowed && catalogResult.status === 'fulfilled' ? normalizeCatalog(catalogResult.value) : null,
    settingsStatus: settings ? 'live' : 'unavailable',
    catalogStatus: !catalogAllowed ? 'restricted' : catalogResult.status === 'fulfilled' ? 'live' : 'unavailable',
    fetchedAt: new Date().toISOString(),
  }
}
