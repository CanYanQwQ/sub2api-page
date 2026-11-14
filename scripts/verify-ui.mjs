import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { chromium } from 'playwright-core'

const base = process.env.TEST_URL || 'http://localhost:5173'
const chrome = process.env.CHROME_PATH || [
  join(process.env.PROGRAMFILES || '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
  join(process.env['PROGRAMFILES(X86)'] || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
  join(process.env.PROGRAMFILES || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome', '/usr/bin/chromium',
].find(path => existsSync(path))
if (!chrome) throw new Error('请用 CHROME_PATH 指定本机 Chrome / Edge 可执行文件')

const tempBase = process.platform === 'win32' ? join(process.env.LOCALAPPDATA, 'Temp', 'opencode') : tmpdir()
const profile = mkdtempSync(join(tempBase, 'lanchao-ui-'))
const browser = await chromium.launchPersistentContext(profile, {
  executablePath: chrome,
  headless: true,
  viewport: { width: 1440, height: 900 },
  args: ['--use-mock-keychain', '--password-store=basic'],
})
const page = await browser.newPage()
const checks = []
function check(label, result) { assert(result, label); checks.push(label); console.log(`PASS ${label}`) }
async function fresh() { await page.goto(base); await page.locator('.rail-provider').first().waitFor(); }
async function sidebarMotion() {
  return page.evaluate(() => new Promise(resolve => {
    const main = document.querySelector('.main-content')
    const sidebar = document.querySelector('.sidebar')
    const button = document.querySelector('.nav-toggle')
    const icon = button.querySelector('.sidebar-toggle-icon')
    const label = sidebar.querySelector('.nav-label')
    const heading = document.querySelector('.hero h1')
    const hero = document.querySelector('.hero')
    const copy = document.querySelector('.hero-copy')
    const code = document.querySelector('.hero-code')
    const paragraph = document.querySelector('.hero-description')
    const samples = []
    function measure(time = 0) {
      const rect = main.getBoundingClientRect()
      const sideRect = sidebar.getBoundingClientRect()
      const textRect = label.getBoundingClientRect()
      const itemRect = label.parentElement.getBoundingClientRect()
      const navRect = sidebar.querySelector('.sidebar-nav').getBoundingClientRect()
      return {
        time,
        animationTime: Number(sidebar.getAnimations().find(animation => animation.transitionProperty === 'width')?.currentTime ?? (time ? Number.parseFloat(getComputedStyle(sidebar).transitionDuration) * 1000 : 0)),
        x: rect.x, width: rect.width, right: rect.right,
        sidebar: sideRect.width,
        sidebarLeft: sideRect.left,
        sidebarRight: sideRect.right,
        labelX: textRect.x,
        visibleLabelWidth: Math.max(0, Math.min(textRect.right, itemRect.right, navRect.right, sideRect.right) - textRect.left),
        labelOpacity: Number(getComputedStyle(label).opacity),
        labelDisplay: getComputedStyle(label).display,
        headingSize: getComputedStyle(heading).fontSize,
        codeWidth: code.getBoundingClientRect().width,
        codeHeight: code.getBoundingClientRect().height,
        copyWidth: copy.getBoundingClientRect().width,
        paragraphWidth: paragraph.getBoundingClientRect().width,
        heroColumns: getComputedStyle(hero).gridTemplateColumns,
        heroGap: getComputedStyle(hero).columnGap,
        sidebarDuration: getComputedStyle(sidebar).transitionDuration,
        sidebarEasing: getComputedStyle(sidebar).transitionTimingFunction,
        iconY: sidebar.querySelector('.nav-item > svg').getBoundingClientRect().y,
        iconStable: button.querySelector('.sidebar-toggle-icon') === icon && getComputedStyle(icon).fill === 'none',
      }
    }
    samples.push(measure())
    button.click()
    const start = performance.now()
    function sample(now) {
      samples.push(measure(now - start))
      const moving = sidebar.getAnimations().some(animation => animation.playState === 'running')
      if ((samples.length > 3 && !moving) || now - start > 4500) resolve(samples)
      else requestAnimationFrame(sample)
    }
    requestAnimationFrame(sample)
  }))
}
const result = await (await fetch(`${base}/api/site`)).json()
try {
  await fresh()
  check('页面显示真实站名与模型目录，不再展示技术署名及版本小字', (await page.title()).includes('岚潮API') && await page.locator('.rail-provider').count() > 0 && await page.locator('.sidebar-footnote, .version, .section-kicker, .feature-number, .hero-eyebrow, .code-window-label').count() === 0 && !/由 Sub2API 提供支持|Powered by Sub2API|v0\.2\.21/.test(await page.locator('body').innerText()))
  check('全部官方入口均为 HTTPS 绝对地址并顶层跳转', await page.locator('a[href^="https://ai.zhouwanx.top"]').evaluateAll(items => items.length > 10 && items.every(item => item.target === '_top')))
  const collapse = await sidebarMotion()
  const first = collapse[0]
  const last = collapse.at(-1)
  check('侧栏收起与主内容扩宽同步完成，右侧边界不漂移', Math.abs(first.sidebar - last.sidebar - 140) < 1 && Math.abs(last.width - first.width - 140) < 1 && collapse.every(sample => Math.abs(sample.right - first.right) < 1))
  check('侧栏与内容有连续中间帧，不是直接跳到终态', collapse.filter(sample => sample.sidebar > last.sidebar + 1 && sample.sidebar < first.sidebar - 1).length >= 3 && collapse.slice(1).every((sample, index) => sample.width >= collapse[index].width - .5))
  check('图标保持同一SVG且无黑色填充，标题字号不突变', collapse.every(sample => sample.iconStable && sample.headingSize === first.headingSize))
  check('参考站式主区两等分，代码窗口适度扩展而非占满整栏', Math.abs((last.copyWidth - first.copyWidth) - 70) < 1 && Math.abs((last.codeWidth - first.codeWidth) - 61.6) < 1 && collapse.every(sample => sample.heroGap === '48px' && Math.abs(sample.codeHeight - first.codeHeight) < 1))
  check('侧栏宽度使用3秒连续缓慢过渡', first.sidebarDuration === '3s' && first.sidebarEasing === 'cubic-bezier(0.4, 0, 0.6, 1)')
  const early = collapse.reduce((best, sample) => Math.abs(sample.animationTime - 600) < Math.abs(best.animationTime - 600) ? sample : best)
  const middle = collapse.reduce((best, sample) => Math.abs(sample.animationTime - 1500) < Math.abs(best.animationTime - 1500) ? sample : best)
  const progress = sample => (first.sidebar - sample.sidebar) / (first.sidebar - last.sidebar)
  check('前600ms不瞬间收完，1.5秒仍有明显中间宽度', progress(early) > .02 && progress(early) < .3 && progress(middle) > .3 && progress(middle) < .7)
  check('整个收起过程菜单纵向位置保持不变，不在点击时跳排', collapse.every(sample => Math.abs(sample.iconY - first.iconY) < .5))
  check('左边缘固定，右边缘持续向左收拢', collapse.every(sample => Math.abs(sample.sidebarLeft - first.sidebarLeft) < .5) && collapse.slice(1).every((sample, index) => sample.sidebarRight <= collapse[index].sidebarRight + .5))
  check('文字保持不透明和固定坐标，随右侧边界逐渐裁切而非提前淡出', collapse.every(sample => sample.labelOpacity === 1 && sample.labelDisplay !== 'none' && Math.abs(sample.labelX - first.labelX) < .5) && first.visibleLabelWidth > 20 && last.visibleLabelWidth <= 1 && collapse.some(sample => sample.visibleLabelWidth > 2 && sample.visibleLabelWidth < first.visibleLabelWidth - 2))
  check('收起后的图标链接仍有可访问名称', await page.locator('.sidebar a.nav-item').evaluateAll(items => items.every(item => item.getAttribute('aria-label'))))
  const expand = await sidebarMotion()
  check('侧栏展开反向平滑恢复布局', Math.abs(expand.at(-1).sidebar - 206) < 1 && Math.abs(expand.at(-1).width - first.width) < 1 && expand.slice(1).every((sample, index) => sample.width <= expand[index].width + .5))
  const interrupted = await page.evaluate(() => new Promise(resolve => {
    const main = document.querySelector('.main-content')
    const sidebar = document.querySelector('.sidebar')
    const button = document.querySelector('.nav-toggle')
    const startWidth = main.getBoundingClientRect().width
    const started = performance.now()
    let reversed = false
    let beforeReverse = 0
    let afterReverse = 0
    button.click()
    function sample(now) {
      if (!reversed && now - started >= 110) {
        beforeReverse = main.getBoundingClientRect().width
        button.click()
        afterReverse = main.getBoundingClientRect().width
        reversed = true
      }
      if (reversed && !sidebar.getAnimations().some(animation => animation.playState === 'running')) {
        resolve({ startWidth, beforeReverse, afterReverse, finalWidth: main.getBoundingClientRect().width })
      } else requestAnimationFrame(sample)
    }
    requestAnimationFrame(sample)
  }))
  check('动画中途反向点击从当前位置继续，不闪回起点', Math.abs(interrupted.beforeReverse - interrupted.afterReverse) < 1 && Math.abs(interrupted.finalWidth - interrupted.startWidth) < 1)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const reduced = await sidebarMotion()
  check('减少动态效果时不播放宽度动画，内容直接到位', Math.abs(reduced.at(-1).sidebar - 66) < 1 && reduced.every(sample => Math.abs(sample.sidebar - 66) < 1 || Math.abs(sample.sidebar - 206) < 1))
  await sidebarMotion()
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.setViewportSize({ width: 1920, height: 1080 })
  const wide = await sidebarMotion()
  check('宽屏主区铺满，代码窗口保持最大宽度而不是无限拉长', wide.at(-1).width > 1600 && Math.abs(wide.at(-1).right - 1906) < 1 && Math.abs(wide.at(-1).codeWidth - 672) < 1 && wide.every(sample => sample.paragraphWidth <= 512))
  await page.reload()
  await page.locator('.rail-provider').first().waitFor()
  check('刷新读回侧栏折叠状态', await page.locator('.site-shell').evaluate(element => element.classList.contains('sidebar-collapsed')))
  await sidebarMotion()
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.getByRole('tab', { name: 'Python', exact: true }).click()
  check('代码语言切换 Python', (await page.locator('#hero-code-panel').textContent()).includes('from openai import OpenAI'))
  await page.getByRole('tab', { name: 'cURL', exact: true }).click()
  check('cURL 使用真实端点和 Authorization 环境变量', (await page.locator('#hero-code-panel').textContent()).includes('https://ai.zhouwanx.top/v1/chat/completions') && (await page.locator('#hero-code-panel').textContent()).includes('$LANCHAO_API_KEY'))
  await page.getByRole('tab', { name: 'Node.js', exact: true }).click()
  await page.getByRole('button', { name: '展开完整代码', exact: true }).click()
  check('展开后无需内部纵向滚动即可读到完整代码', await page.locator('.code-body').evaluate(element => element.scrollHeight <= element.clientHeight + 1))
  await page.getByRole('button', { name: '收起代码', exact: true }).click()
  await page.getByRole('button', { name: '复制 API 端点', exact: true }).click()
  await page.getByRole('status').filter({ hasText: 'API 端点已复制' }).waitFor()
  check('复制端点有可观察反馈', true)
  await page.getByRole('button', { name: '深色模式', exact: true }).click()
  await page.reload()
  await page.locator('.rail-provider').first().waitFor()
  check('主题保存后刷新读回', await page.locator('html').getAttribute('data-theme') === 'dark')
  await page.getByRole('button', { name: '浅色模式', exact: true }).click()
  await page.getByRole('button', { name: '搜索页面，快捷键 Ctrl K' }).click()
  check('搜索弹窗聚焦时只有外层1px细边框，没有内层粗描边', await page.getByRole('searchbox').evaluate(element => {
    const inputStyle = getComputedStyle(element)
    const wrapper = element.closest('.search-input-wrap')
    return document.activeElement === element && inputStyle.outlineStyle === 'none' && inputStyle.boxShadow === 'none' && getComputedStyle(wrapper).borderTopWidth === '1px' && wrapper.matches(':focus-within')
  }))
  await page.getByRole('searchbox').fill('密钥')
  check('搜索返回真实官方入口', await page.locator('.search-results a[href="https://ai.zhouwanx.top/keys"]').count() === 1)
  await page.getByRole('searchbox').fill('不存在的页面')
  check('搜索无结果有说明', await page.locator('.search-empty').isVisible())
  await page.keyboard.press('Escape')
  check('搜索关闭归还焦点', await page.getByRole('button', { name: '搜索页面，快捷键 Ctrl K' }).evaluate(element => element === document.activeElement))
  await page.locator('.header-guide').click()
  await page.getByRole('tab', { name: '03 配置应用' }).click()
  check('三步指南显示对应配置与端点', await page.locator('.guide-endpoint').isVisible())
  await page.getByRole('tab', { name: '01 创建密钥' }).click()
  check('创建密钥步骤不被后续配置抢占', !await page.locator('.guide-endpoint').count() && await page.locator('.guide-action.button').isVisible())
  await page.getByRole('button', { name: '站点公告', exact: true }).first().click()
  check('公告不伪造未读或登录状态', (await page.locator('.announcement-content').textContent()).includes('如果尚未登录') && await page.locator('.announcement-content a[target="_top"]').count() === 1)
  await page.keyboard.press('Escape')

  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('button', { name: '打开导航菜单' }).click()
  check('手机抽屉可用并有 dialog 语义', await page.locator('#site-sidebar').getAttribute('role') === 'dialog')
  await page.locator('#site-sidebar a.nav-item[href="#quickstart"]').click()
  await page.locator('.drawer-scrim').waitFor({ state: 'detached' })
  check('手机页内导航关闭抽屉且保留锚点', !await page.locator('.drawer-scrim').count() && new URL(page.url()).hash === '#quickstart')
  check('390px 页面不横向溢出', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1))

  await page.route('**/api/site', route => route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }))
  await page.goto(base)
  await page.getByText('模型目录暂时未能读取', { exact: true }).waitFor()
  check('接口失败有重试、不伪造数字', await page.locator('.directory-fallback button').isVisible() && await page.locator('.rail-provider').count() === 0)
  await page.unroute('**/api/site')
  await page.locator('.directory-fallback button').click()
  await page.locator('.rail-provider').first().waitFor()
  check('失败重试可恢复真实模型目录', true)

  const restricted = structuredClone(result)
  restricted.settings.flags.model_plaza_require_auth = true
  restricted.catalog = null
  restricted.catalogStatus = 'restricted'
  await page.route('**/api/site', route => route.fulfill({ json: restricted }))
  await page.goto(base)
  await page.getByText('前往官网查看模型目录', { exact: true }).waitFor()
  check('需认证目录引导官方而不误当网络错误', !await page.locator('.directory-fallback button').count() && await page.locator('.directory-fallback a[target="_top"]').count() === 1)
  await page.unroute('**/api/site')

  const disabled = structuredClone(result)
  for (const key of ['registration_enabled', 'model_plaza_enabled', 'payment_enabled', 'subscription_enabled', 'channel_monitor_enabled', 'available_channels_enabled']) disabled.settings.flags[key] = false
  disabled.catalog = null
  disabled.catalogStatus = 'restricted'
  await page.route('**/api/site', route => route.fulfill({ json: disabled }))
  await page.goto(base)
  await page.locator('.closing-banner a[href="https://ai.zhouwanx.top/login"]').waitFor()
  check('功能确认关闭后全部重复入口同步隐藏', await page.locator('a[href="https://ai.zhouwanx.top/register"],a[href="https://ai.zhouwanx.top/model-plaza"],a[href="https://ai.zhouwanx.top/purchase"],a[href="https://ai.zhouwanx.top/subscriptions"]').count() === 0)
  await page.unroute('**/api/site')
  await fresh()

  // 复制被禁止时必须能拿到原文，而非假装复制成功。
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: () => Promise.reject(new Error('denied')) } })
    document.execCommand = () => false
  })
  await page.getByRole('button', { name: '复制 API 端点', exact: true }).click()
  await page.locator('#manual-copy-content').waitFor()
  check('剪贴板限制时提供手动复制原文', await page.locator('#manual-copy-content').inputValue() === 'https://ai.zhouwanx.top/v1')
  await page.keyboard.press('Escape')
  await page.setViewportSize({ width: 720, height: 450 })
  await fresh()
  check('200%等效重排宽度不横向溢出', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1))

  // 浏览器200%缩放对应720×450 CSS视口、1440×900物理像素；CSS zoom不等同于浏览器缩放。
  const cdp = await browser.newCDPSession(page)
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 720, height: 450, deviceScaleFactor: 2, mobile: false })
  check('200%等效视口与像素倍率下内容重排正常', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2 && devicePixelRatio === 2))
  mkdirSync('.oil-ui/lanchao-home/shots/zoom', { recursive: true })
  await page.screenshot({ path: '.oil-ui/lanchao-home/shots/zoom/equivalent-200.png' })
  await cdp.send('Emulation.clearDeviceMetricsOverride')

  await page.setViewportSize({ width: 1440, height: 900 })
  await fresh()
  await page.locator('.hero-actions a[href="https://ai.zhouwanx.top/keys"]').click()
  await page.waitForURL(url => url.origin === 'https://ai.zhouwanx.top')
  check('独立页面点击官方入口可到达原站', new URL(page.url()).origin === 'https://ai.zhouwanx.top')
  mkdirSync('.oil-ui/lanchao-home/logs', { recursive: true })
  writeFileSync('.oil-ui/lanchao-home/logs/ui-verification.json', JSON.stringify({
    testedAt: new Date().toISOString(), checks, passed: checks.length,
    sidebarMotion: { collapse, expand, interrupted, reduced, wide },
    notVerified: ['正式域名 iframe 嵌入尚未部署验证；本地跨源 iframe 被 Chromium Local Network Access 安全策略阻止，未绕过。', '200%使用等效CSS视口与像素倍率验证，不冒称已操作浏览器菜单缩放。'],
  }, null, 2))
  console.log(`\n${checks.length} UI checks passed.`)
} finally {
  await browser.close()
  rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
}
