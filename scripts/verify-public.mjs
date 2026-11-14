import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { loadSite, normalizeCatalog, normalizeSettings, safeUrl, DEFAULT_ORIGIN } from '../server/site.js'

// 小型接入检查，不发送模型调用、不登录、不修改任何远端数据。
let passed = 0
function check(label, action) { action(); passed++; console.log(`PASS ${label}`) }

check('URL 清洗禁止可执行协议与 URL 内嵌密码', () => {
  assert.equal(safeUrl('javascript:alert(1)'), '')
  assert.equal(safeUrl('https://user:password@example.com'), '')
  assert.equal(safeUrl('http://example.com'), '')
  assert.equal(safeUrl('/logo.png'), `${DEFAULT_ORIGIN}/logo.png`)
})

check('只保留公开品牌字段与布尔功能开关', () => {
  const settings = normalizeSettings({ site_name: '  岚潮API  ', registration_enabled: false, payment_enabled: 'true', site_logo: 'data:image/svg+xml;base64,abc', admin_key: 'must-not-pass', home_content: 'must-not-pass', custom_endpoints: [{ name: '香港', endpoint: `${DEFAULT_ORIGIN}/v1` }] })
  assert.equal(settings.name, '岚潮API')
  assert.equal(settings.logo, '')
  assert.equal(settings.flags.registration_enabled, false)
  assert.equal(settings.flags.payment_enabled, undefined)
  assert.equal(settings.admin_key, undefined)
  assert.equal(settings.home_content, undefined)
  assert.equal(settings.endpoints.length, 1)
})

check('目录按平台与模型 ID 去重，不计算报价', () => {
  const result = normalizeCatalog({ groups: [{ platform: 'openai', models: [{ name: 'model-a', pricing: { input_price: 999 } }, { name: 'model-a' }] }, { platform: 'anthropic', models: [{ name: 'model-b' }] }] })
  assert.equal(result.groupCount, 2)
  assert.equal(result.modelCount, 2)
  assert.equal(result.platforms[0].count, 1)
  assert.equal(result.models[0].pricing, undefined)
})

const response = value => new Response(JSON.stringify({ code: 0, data: value }), { status: 200 })
const rawCatalog = { groups: [{ platform: 'openai', models: [{ name: 'model-a' }] }] }
const calls = []
const noCredentials = async (url, options) => {
  calls.push({ url, options })
  return response(url.endsWith('/settings/public') ? { site_name: '岚潮API', model_plaza_enabled: true } : rawCatalog)
}
await loadSite(undefined, noCredentials)
check('仅固定读取两个公开端点且不发送凭据', () => {
  assert.deepEqual(calls.map(call => new URL(call.url).pathname).sort(), ['/api/v1/model-plaza', '/api/v1/settings/public'])
  assert.deepEqual(Object.keys(calls[0].options.headers), ['Accept'])
  assert.equal(calls[0].options.redirect, 'error')
})

for (const flags of [{ model_plaza_enabled: false }, { model_plaza_require_auth: true }, { backend_mode_enabled: true }]) {
  const result = await loadSite(undefined, async url => response(url.endsWith('/settings/public') ? flags : rawCatalog))
  check(`目录受限时不泄露返回内容 ${JSON.stringify(flags)}`, () => {
    assert.equal(result.catalog, null)
    assert.equal(result.catalogStatus, 'restricted')
  })
}

const unavailable = await loadSite(undefined, async () => { throw new Error('network unavailable') })
check('接口失败不是零模型或虚假成功', () => {
  assert.equal(unavailable.settingsStatus, 'unavailable')
  assert.equal(unavailable.catalogStatus, 'unavailable')
  assert.equal(unavailable.catalog, null)
  assert.equal(unavailable.settings, null)
})

const modelFailure = await loadSite(undefined, async url => url.endsWith('/settings/public') ? response({ site_name: '岚潮API' }) : new Response('', { status: 503 }))
check('目录单独失败保留真实品牌', () => {
  assert.equal(modelFailure.settingsStatus, 'live')
  assert.equal(modelFailure.settings.name, '岚潮API')
  assert.equal(modelFailure.catalogStatus, 'unavailable')
})

const vercel = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url), 'utf8'))
check('生产 iframe 白名单明确，不设置冲突的 X-Frame-Options', () => {
  const headers = vercel.headers[0].headers
  assert(headers.find(item => item.key === 'Content-Security-Policy').value.includes(`frame-ancestors 'self' ${DEFAULT_ORIGIN}`))
  assert.equal(headers.some(item => item.key.toLowerCase() === 'x-frame-options'), false)
})

const site = await loadSite()
check('真实站点公开配置与目录可达', () => {
  assert.equal(site.settingsStatus, 'live')
  assert.equal(site.settings.name, '岚潮API')
  assert.equal(site.catalogStatus, 'live')
  assert(site.catalog.modelCount > 0)
})
console.log(`\n${passed} checks passed. Live site: ${site.settings.name}, Sub2API ${site.settings.version}, ${site.catalog.modelCount} models / ${site.catalog.groupCount} groups.`)
