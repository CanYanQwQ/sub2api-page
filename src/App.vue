<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import {
  Activity, ArrowDown, ArrowRight, ArrowUpRight, BookOpen, Braces, Check,
  ChevronDown, ChevronRight, CircleHelp, Code2, Command, Copy,
  FileCode2, FileText, Globe2, Grid2X2, House, KeyRound,
  Layers, LayoutDashboard, ListFilter, LoaderCircle, LockKeyhole, LogIn,
  Megaphone, Menu, Monitor, Moon, Radio,
  Search, Server, Sun, Terminal, Wallet, X, Zap,
} from '@lucide/vue'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Modal from './components/Modal.vue'
import ProviderMark from './components/ProviderMark.vue'
import { PROVIDERS } from './config'
import { useSite } from './useSite'
import { createSnippet, tokenizeCode, type CodeLanguage } from './snippets'

gsap.registerPlugin(ScrollTrigger)
const { settings, catalog, restricted, loading, failed, enabled, official, apiEndpoint, refresh } = useSite()
const root = ref<HTMLElement>()
const sidebar = ref<HTMLElement>()
const menuButton = ref<HTMLButtonElement>()
const mobileOpen = ref(false)
const collapsed = ref(stored('lanchao-sidebar') === 'true')
const mobile = ref(window.matchMedia('(max-width: 1050px)').matches)
const logoFailed = ref(false)
const language = ref<CodeLanguage>('Node.js')
const codeExpanded = ref(false)
const languages: CodeLanguage[] = ['Node.js', 'Python', 'cURL']
const guideStep = ref(0)
const searchOpen = ref(false)
const announcementOpen = ref(false)
const manualCopyOpen = ref(false)
const manualCopyText = ref('')
const searchQuery = ref('')
const toast = ref('')
const toastError = ref(false)
let toastTimer: ReturnType<typeof setTimeout> | undefined
let animations: gsap.MatchMedia | undefined
let cleanup: (() => void) | undefined
type Theme = 'light' | 'dark' | 'system'
const theme = ref<Theme>('system')
const themeOptions = [
  { value: 'light' as const, label: '浅色模式', icon: Sun },
  { value: 'dark' as const, label: '深色模式', icon: Moon },
  { value: 'system' as const, label: '跟随系统', icon: Monitor },
]

function stored(key: string) { try { return localStorage.getItem(key) } catch { return null } }
function persist(key: string, value: string) { try { localStorage.setItem(key, value) } catch { /* 存储被禁用不影响使用 */ } }
const activeHash = ref('#overview')
const canModels = computed(() => enabled('model_plaza_enabled'))
const backendOnly = computed(() => settings.value.flags.backend_mode_enabled === true)
const featuredModel = computed(() => catalog.value?.models.find(model => model.platform === 'openai' && !/image|audio|tts|whisper/i.test(model.name))?.name ?? 'YOUR_MODEL_ID')
const code = computed(() => createSnippet(language.value, apiEndpoint.value, featuredModel.value))
const tokens = computed(() => tokenizeCode(code.value))
const filename = computed(() => ({ 'Node.js': 'hello-lanchao.js', Python: 'hello_lanchao.py', cURL: 'request.sh' })[language.value])
const providerList = computed(() => {
  const order = ['openai', 'anthropic', 'gemini', 'deepseek', 'grok']
  return [...(catalog.value?.platforms ?? [])].sort((a, b) => {
    const index = (id: string) => order.includes(id) ? order.indexOf(id) : 20
    return index(a.id) - index(b.id)
  })
})

const navGroups = computed(() => [
  {
    title: '探索平台',
    items: [
      { label: '首页概览', icon: House, href: '#overview', local: true, show: true },
      { label: '模型广场', icon: Grid2X2, href: official('models'), local: false, show: canModels.value },
      { label: '接入指南', icon: BookOpen, href: '#quickstart', local: true, show: true },
    ],
  },
  {
    title: '我的工作台',
    items: [
      { label: '控制台', icon: LayoutDashboard, href: official('dashboard'), local: false, show: !backendOnly.value },
      { label: 'API 密钥', icon: KeyRound, href: official('keys'), local: false, show: !backendOnly.value },
      { label: '请求日志', icon: FileText, href: official('usage'), local: false, show: !backendOnly.value },
      { label: '在线充值', icon: Wallet, href: official('purchase'), local: false, show: enabled('payment_enabled') },
      { label: '我的订阅', icon: Layers, href: official('subscriptions'), local: false, show: enabled('subscription_enabled') },
    ],
  },
  {
    title: '支持与服务',
    items: [
      { label: '渠道监控', icon: Activity, href: official('monitor'), local: false, show: enabled('channel_monitor_enabled') },
      { label: '可用渠道', icon: Server, href: official('channels'), local: false, show: enabled('available_channels_enabled') },
      { label: '密钥用量查询', icon: ListFilter, href: official('keyUsage'), local: false, show: true },
      { label: '常见问题', icon: CircleHelp, href: '#faq', local: true, show: true },
    ],
  },
].map(group => ({ ...group, items: group.items.filter(item => item.show) })).filter(group => group.items.length))

const searchResults = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  const items = navGroups.value.flatMap(group => group.items.map(item => ({ ...item, group: group.title })))
  return items.filter(item => !query || `${item.label} ${item.group}`.toLowerCase().includes(query))
})

const guideSteps = [
  { title: '创建一枚 API 密钥', text: '进入控制台，选择适合的分组并创建密钥。将密钥保存在自己的环境变量中，不要放进公开仓库。', action: '前往创建密钥', route: 'keys' as const, icon: KeyRound },
  { title: '找到适合的模型', text: '在模型广场查看公开模型与分组。调用时填写完整模型 ID，确保该模型属于你的密钥所绑定的分组。', action: '浏览模型广场', route: 'models' as const, icon: Grid2X2 },
  { title: '配置端点，开始构建', text: '将 API 地址和密钥填入应用。OpenAI SDK 使用下方的 /v1 地址；Claude Code 的 Base URL 使用站点根地址。', action: '查看使用记录', route: 'usage' as const, icon: Terminal },
]
const currentGuide = computed(() => guideSteps[guideStep.value]!)

function notify(message: string, error = false) {
  toast.value = message
  toastError.value = error
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { toast.value = '' }, 3200)
}

async function copy(value: string, label: string) {
  try {
    if (!navigator.clipboard?.writeText) throw new Error('clipboard-unavailable')
    await navigator.clipboard.writeText(value)
    notify(`${label}已复制`)
    return
  } catch { /* iframe 的 Clipboard 权限不可假定，继续尝试用户手势下的兼容方式 */ }
  const focus = document.activeElement as HTMLElement | null
  const area = document.createElement('textarea')
  area.value = value
  area.setAttribute('readonly', '')
  area.style.cssText = 'position:fixed;top:0;left:0;opacity:0;width:1px;height:1px;'
  document.body.append(area)
  area.select()
  let copied = false
  try { copied = document.execCommand('copy') } catch { /* 改用可选择文本 */ }
  area.remove()
  focus?.focus()
  if (copied) notify(`${label}已复制`)
  else {
    manualCopyText.value = value
    manualCopyOpen.value = true
    notify('浏览器限制了复制，请手动选择内容', true)
  }
}

function selectManual() {
  const area = document.querySelector<HTMLTextAreaElement>('#manual-copy-content')
  area?.focus()
  area?.select()
}

function selectLanguage(index: number) {
  language.value = languages[(index + languages.length) % languages.length]!
  nextTick(() => document.querySelector<HTMLButtonElement>(`#code-tab-${languages.indexOf(language.value)}`)?.focus())
}

function selectGuide(index: number) {
  guideStep.value = (index + 3) % 3
  nextTick(() => document.getElementById(`guide-tab-${guideStep.value}`)?.focus())
}

function goLocal(href: string) {
  activeHash.value = href
  mobileOpen.value = false
  searchOpen.value = false
}

function toggleSidebar() {
  if (mobile.value) mobileOpen.value = !mobileOpen.value
  else {
    collapsed.value = !collapsed.value
    persist('lanchao-sidebar', String(collapsed.value))
  }
}

function onLayoutTransitionEnd(event: TransitionEvent) {
  if (event.target === event.currentTarget && event.propertyName === 'width') {
    ScrollTrigger.refresh()
  }
}

function drawerKey(event: KeyboardEvent) {
  if (!mobileOpen.value) return
  if (event.key === 'Escape') mobileOpen.value = false
  if (event.key === 'Tab') {
    const list = sidebar.value?.querySelectorAll<HTMLElement>('a[href], button:not([disabled])')
    if (!list?.length) return
    const first = list[0]!
    const last = list[list.length - 1]!
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
  }
}

watch(mobileOpen, async (open) => {
  document.body.classList.toggle('drawer-open', open)
  if (open) {
    await nextTick()
    sidebar.value?.querySelector<HTMLElement>('button, a')?.focus()
  } else if (mobile.value) menuButton.value?.focus()
})
watch(() => settings.value.logo, () => { logoFailed.value = false })

onMounted(() => {
  const savedTheme = stored('lanchao-theme')
  if (savedTheme === 'light' || savedTheme === 'dark' || savedTheme === 'system') theme.value = savedTheme
  const system = window.matchMedia('(prefers-color-scheme: dark)')
  const smallScreen = window.matchMedia('(max-width: 1050px)')
  const applyTheme = () => {
    document.documentElement.dataset.theme = theme.value === 'system' ? system.matches ? 'dark' : 'light' : theme.value
    persist('lanchao-theme', theme.value)
  }
  const applySize = () => { mobile.value = smallScreen.matches; if (!mobile.value) mobileOpen.value = false }
  applyTheme()
  applySize()
  system.addEventListener('change', applyTheme)
  smallScreen.addEventListener('change', applySize)
  const unwatch = watch(theme, applyTheme)
  const keyboard = (event: KeyboardEvent) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); searchOpen.value = !searchOpen.value }
    drawerKey(event)
  }
  document.addEventListener('keydown', keyboard)
  cleanup = () => {
    unwatch()
    system.removeEventListener('change', applyTheme)
    smallScreen.removeEventListener('change', applySize)
    document.removeEventListener('keydown', keyboard)
  }
  void refresh()

  animations = gsap.matchMedia()
  animations.add('(prefers-reduced-motion: no-preference)', () => {
    gsap.from('.hero-copy > *', { opacity: 0, y: 14, duration: 0.42, stagger: 0.055, ease: 'power2.out', clearProps: 'all' })
    gsap.from('.code-window', { opacity: 0, y: 18, duration: 0.55, ease: 'power2.out', clearProps: 'all' })
    gsap.utils.toArray<HTMLElement>('.reveal-section').forEach(section => {
      gsap.from(section.querySelectorAll('.reveal-item'), {
        scrollTrigger: { trigger: section, start: 'top 94%', once: true },
        y: 18, opacity: 0, duration: 0.45, stagger: 0.06, ease: 'power2.out', clearProps: 'all',
      })
    })
    gsap.fromTo('.scroll-statement span', { color: 'var(--muted)' }, {
      color: 'var(--accent)', stagger: 0.35,
      scrollTrigger: { trigger: '.scroll-statement', start: 'top 92%', end: 'bottom 50%', scrub: true },
    })
  }, root.value)
})

onUnmounted(() => {
  cleanup?.()
  animations?.revert()
  if (toastTimer) clearTimeout(toastTimer)
  document.body.classList.remove('drawer-open')
})
</script>

<template>
  <div ref="root" class="site-shell page-layout" :class="{ 'sidebar-collapsed': collapsed && !mobile, 'mobile-nav-open': mobileOpen }">
    <a class="skip-link" href="#main-content">跳到主要内容</a>

    <header class="topbar">
      <div class="topbar-left">
        <button ref="menuButton" type="button" class="icon-button nav-toggle" :aria-label="mobile ? '打开导航菜单' : collapsed ? '展开侧边栏' : '折叠侧边栏'" aria-controls="site-sidebar" :aria-expanded="mobile ? mobileOpen : !collapsed" @click="toggleSidebar">
          <Menu v-if="mobile" :size="20" />
          <svg v-else class="sidebar-toggle-icon" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <path d="M9 3v18" />
            <path class="sidebar-toggle-arrow" d="m16 9-3 3 3 3" />
          </svg>
        </button>
        <a class="brand" href="#overview" @click="goLocal('#overview')">
          <img v-if="!logoFailed" :src="settings.logo || '/brand.webp'" :alt="`${settings.name} Logo`" width="36" height="36" @error="logoFailed = true" />
          <Layers v-else :size="30" class="brand-fallback" />
          <span>{{ settings.name }}</span>
        </a>
        <span class="topbar-divider" />
        <button type="button" class="announcement-button" @click="announcementOpen = true"><Megaphone :size="15" /><span>站点公告</span></button>
      </div>
      <div class="topbar-right">
        <button type="button" class="search-trigger" aria-label="搜索页面，快捷键 Ctrl K" @click="searchOpen = true"><Search :size="16" /><span>搜索页面或功能...</span><kbd>⌘ K</kbd></button>
        <div class="theme-switch" role="group" aria-label="颜色模式">
          <button v-for="option in themeOptions" :key="option.value" type="button" :aria-label="option.label" :title="option.label" :aria-pressed="theme === option.value" :class="{ selected: theme === option.value }" @click="theme = option.value"><component :is="option.icon" :size="15" /></button>
        </div>
        <a class="header-guide" :href="settings.docUrl || '#quickstart'" :target="settings.docUrl ? '_top' : undefined" rel="noreferrer" @click="!settings.docUrl && goLocal('#quickstart')"><BookOpen :size="16" />接入文档</a>
        <a :href="official('login')" target="_top" rel="noreferrer" class="header-login"><LogIn :size="16" /><span>登录</span></a>
        <a v-if="enabled('registration_enabled')" :href="official('register')" target="_top" rel="noreferrer" class="button button-small button-dark">注册账户<ArrowUpRight :size="14" /></a>
      </div>
    </header>

    <Transition name="drawer-overlay"><div v-if="mobileOpen" class="drawer-scrim" aria-hidden="true" @click="mobileOpen = false" /></Transition>
    <aside id="site-sidebar" ref="sidebar" class="sidebar" :inert="mobile && !mobileOpen ? true : undefined" :role="mobile && mobileOpen ? 'dialog' : undefined" :aria-modal="mobile && mobileOpen ? true : undefined" aria-label="站点导航" @transitionend="onLayoutTransitionEnd">
      <div class="drawer-heading"><span>探索 {{ settings.name }}</span><button type="button" class="icon-button" aria-label="关闭导航菜单" @click="mobileOpen = false"><X :size="20" /></button></div>
      <nav class="sidebar-nav">
        <div v-for="group in navGroups" :key="group.title" class="nav-group">
          <p class="nav-group-title" :aria-hidden="collapsed && !mobile ? true : undefined">{{ group.title }}</p>
          <a v-for="item in group.items" :key="item.label" :href="item.href" :target="item.local ? undefined : '_top'" rel="noreferrer" class="nav-item" :class="{ active: item.local && activeHash === item.href }" :title="collapsed && !mobile ? item.label : undefined" :aria-label="item.label" :aria-current="item.local && activeHash === item.href ? 'location' : undefined" @click="item.local ? goLocal(item.href) : mobileOpen = false">
            <component :is="item.icon" :size="18" :stroke-width="1.65" /><span class="nav-label" :aria-hidden="collapsed && !mobile ? true : undefined">{{ item.label }}</span><ArrowUpRight v-if="!item.local" :size="12" class="nav-external" />
          </a>
        </div>
        <button type="button" class="nav-item mobile-announcement" @click="mobileOpen = false; announcementOpen = true"><Megaphone :size="18" :stroke-width="1.65" /><span>站点公告</span></button>
      </nav>
      <div class="sidebar-bottom">
        <a href="#quickstart" class="sidebar-tip" aria-label="快速接入指南" :title="collapsed && !mobile ? '快速接入指南' : undefined" @click="goLocal('#quickstart')"><span class="tip-icon"><Code2 :size="19" /></span><strong>从第一行代码开始</strong><ArrowUpRight :size="16" /></a>
      </div>
    </aside>

    <main id="main-content" class="main-content">
      <section id="overview" class="hero" aria-labelledby="hero-title">
        <div class="hero-copy">
          <h1 id="hero-title">让每一个想法，<br /><span>接入 AI 的可能。</span></h1>
          <p class="hero-description">一个入口，连接多种 AI 模型。<br class="desktop-break" />用你熟悉的 API 和 SDK，把复杂留给网关，<br class="desktop-break" />把时间留给真正重要的创造。</p>
          <div class="hero-actions">
            <a class="button button-primary" :href="official(backendOnly ? 'login' : 'keys')" target="_top" rel="noreferrer"><Terminal :size="18" />获取 API 密钥<ArrowUpRight :size="17" /></a>
            <a v-if="canModels" class="button button-secondary" :href="official('models')" target="_top" rel="noreferrer">浏览模型广场<ArrowUpRight :size="16" /></a>
          </div>
          <div class="protocol-tags" aria-label="接入特性"><span><Braces :size="15" />RESTful API</span><span><LockKeyhole :size="14" />HTTPS 加密</span><span><FileCode2 :size="15" />JSON Output</span></div>
        </div>

        <div class="hero-code">
          <div class="code-window" :class="{ 'is-expanded': codeExpanded }">
            <div class="code-window-header"><div class="window-dots" aria-hidden="true"><i /><i /><i /></div><span>{{ filename }}</span></div>
            <div class="code-toolbar">
              <div class="code-tabs" role="tablist" aria-label="代码语言">
                <div class="code-tab-indicator" :style="{ transform: `translateX(${languages.indexOf(language) * 100}%)` }" aria-hidden="true" />
                <button v-for="(item, index) in languages" :id="`code-tab-${index}`" :key="item" type="button" role="tab" :aria-selected="language === item" aria-controls="hero-code-panel" :tabindex="language === item ? 0 : -1" :class="{ selected: language === item }" @click="language = item" @keydown.right.prevent="selectLanguage(index + 1)" @keydown.left.prevent="selectLanguage(index - 1)">{{ item }}</button>
              </div>
              <button type="button" class="code-copy" aria-label="复制接入代码" @click="copy(code, '接入代码')"><Copy :size="14" /><span>复制</span></button>
            </div>
            <div id="hero-code-panel" class="code-body" role="tabpanel" :aria-labelledby="`code-tab-${languages.indexOf(language)}`" tabindex="0"><pre><code><span v-for="(token, index) in tokens" :key="index" :class="`token-${token.kind}`">{{ token.text }}</span></code></pre></div>
            <div class="code-window-footer"><button type="button" class="code-expand-button" aria-controls="hero-code-panel" :aria-expanded="codeExpanded" @click="codeExpanded = !codeExpanded">{{ codeExpanded ? '收起代码' : '展开完整代码' }}<ChevronDown :size="12" :class="{ rotated: codeExpanded }" /></button></div>
          </div>
          <div class="endpoint-strip"><span class="endpoint-icon"><Globe2 :size="17" /></span><div><code>{{ apiEndpoint }}</code></div><button type="button" class="icon-button" aria-label="复制 API 端点" @click="copy(apiEndpoint, 'API 端点')"><Copy :size="16" /></button></div>
        </div>
      </section>

      <section v-if="canModels" class="model-rail" aria-label="公开模型目录摘要" :aria-busy="loading">
        <div class="model-rail-label"><span>让好模型，为你所用</span></div>
        <div v-if="loading && !catalog" class="rail-providers loading-providers" aria-label="正在读取模型目录"><span v-for="i in 5" :key="i" class="skeleton" /></div>
        <div v-else-if="catalog && providerList.length" class="rail-providers">
          <a v-for="provider in providerList.slice(0, 5)" :key="provider.id" :href="official('models')" target="_top" rel="noreferrer" class="rail-provider"><ProviderMark :platform="provider.id" :size="23" /><span>{{ PROVIDERS[provider.id]?.label || provider.id }}</span><small>{{ provider.count }} 模型</small></a>
        </div>
        <div v-else class="directory-fallback"><span>{{ restricted ? '前往官网查看模型目录' : catalog ? '公开目录暂未收录模型' : '模型目录暂时未能读取' }}</span><a v-if="restricted" :href="official('models')" target="_top" rel="noreferrer">前往模型广场<ArrowUpRight :size="14" /></a><button v-else-if="!catalog" type="button" :disabled="loading" @click="refresh">重新读取<LoaderCircle v-if="loading" :size="14" class="spin" /><ArrowRight v-else :size="14" /></button></div>
      </section>

      <section id="capabilities" class="capabilities reveal-section">
        <div class="section-heading reveal-item"><div><h2>接入简单，使用更自在。</h2></div></div>
        <div class="capability-grid">
          <article class="capability-card reveal-item"><div class="capability-top"><span class="feature-icon"><Braces :size="23" /></span></div><h3>熟悉的协议，更少的改动</h3><p>支持 OpenAI、Anthropic 与 Gemini 接入方式。用现有 SDK 和客户端，延续已经顺手的开发流程。</p><div class="feature-detail"><code>/v1/chat/completions</code><code>/v1/messages</code></div><a href="#quickstart" @click="goLocal('#quickstart')">查看接入方式<ArrowRight :size="16" /></a></article>
          <article class="capability-card reveal-item"><div class="capability-top"><span class="feature-icon"><Activity :size="23" /></span></div><h3>每一份用量，都有迹可循</h3><p>在控制台查看请求记录、Token 消耗与费用明细。分组与订阅各有入口，让使用情况更清晰。</p><div class="feature-detail tool-labels"><span>请求记录</span><span>Token 用量</span><span>费用明细</span></div><a :href="official('usage')" target="_top" rel="noreferrer">查看请求记录<ArrowUpRight :size="16" /></a></article>
          <article class="capability-card reveal-item"><div class="capability-top"><span class="feature-icon"><Terminal :size="23" /></span></div><h3>在你的工作流里，直接开工</h3><p>连接 Claude Code、Codex 或自己的应用。配置相应的端点、密钥与模型，把精力放回创造。</p><div class="feature-detail tool-labels"><span><Terminal :size="13" />Claude Code</span><span><Code2 :size="13" />Codex</span><span><Command :size="13" />SDK</span></div><a :href="official('keys')" target="_top" rel="noreferrer">管理 API 密钥<ArrowUpRight :size="16" /></a></article>
        </div>
      </section>

      <section v-if="canModels && catalog && providerList.length" id="models" class="models-section reveal-section">
        <div class="section-heading reveal-item"><div><h2>熟悉的模型，统一的入口。</h2></div><a class="text-link" :href="official('models')" target="_top" rel="noreferrer">探索模型广场<ArrowUpRight :size="16" /></a></div>
        <div class="model-preview-grid">
          <a v-for="provider in providerList.slice(0, 3)" :key="provider.id" :href="official('models')" target="_top" rel="noreferrer" class="model-preview reveal-item"><div class="model-preview-header"><ProviderMark :platform="provider.id" :size="28" /><span>{{ PROVIDERS[provider.id]?.name || provider.id }}<strong>{{ PROVIDERS[provider.id]?.label || provider.id }}</strong></span><ArrowUpRight :size="17" /></div><p>{{ PROVIDERS[provider.id]?.description || '在模型广场查看完整模型与分组。' }}</p><div class="model-ids"><code v-for="model in provider.models.slice(0, 2)" :key="model">{{ model }}</code></div><div class="model-preview-bottom"><span>公开目录收录 {{ provider.count }} 款</span><span>查看详情<ChevronRight :size="13" /></span></div></a>
        </div>
        <p class="catalog-note"><Layers :size="13" />当前公开目录共 {{ catalog.modelCount }} 款模型、{{ catalog.groupCount }} 个分组。可调用范围与价格以密钥分组及模型广场为准。</p>
      </section>

      <section id="quickstart" class="quickstart reveal-section" aria-labelledby="quickstart-title">
        <div class="quickstart-intro reveal-item"><h2 id="quickstart-title">下一步，<br />让想法开始运行。</h2><p>不必重新学习一套接口。<br />准备好密钥和模型，就从你熟悉的工具开始。</p><a class="text-link" :href="settings.docUrl || '#faq'" :target="settings.docUrl ? '_top' : undefined" rel="noreferrer">{{ settings.docUrl ? '阅读完整文档' : '查看接入常见问题' }}<ArrowUpRight :size="15" /></a></div>
        <div class="quickstart-workspace reveal-item">
          <div class="step-tabs" role="tablist" aria-label="快速接入步骤"><button v-for="(step, index) in guideSteps" :id="`guide-tab-${index}`" :key="step.title" type="button" role="tab" :aria-selected="guideStep === index" aria-controls="guide-panel" :tabindex="guideStep === index ? 0 : -1" :class="{ active: guideStep === index }" @click="guideStep = index" @keydown.right.prevent="selectGuide(index + 1)" @keydown.left.prevent="selectGuide(index - 1)"><span>0{{ index + 1 }}</span>{{ ['创建密钥', '选择模型', '配置应用'][index] }}</button></div>
          <div id="guide-panel" class="guide-panel" role="tabpanel" :aria-labelledby="`guide-tab-${guideStep}`">
            <div class="guide-title"><component :is="currentGuide.icon" :size="21" /><h3>{{ currentGuide.title }}</h3></div>
            <p>{{ currentGuide.text }}</p>
            <div v-if="guideStep === 0" class="guide-checklist"><span><Check :size="14" />在官网完成登录</span><span><Check :size="14" />选择分组，创建密钥</span></div>
            <div v-else-if="guideStep === 1" class="guide-model-hint"><span>调用时使用完整 MODEL ID</span><code>{{ featuredModel }}</code></div>
            <div v-else class="guide-endpoint"><span>OpenAI SDK · BASE URL</span><div><code>{{ apiEndpoint }}</code><button type="button" class="icon-button" aria-label="复制接入地址" @click="copy(apiEndpoint, '接入地址')"><Copy :size="16" /></button></div></div>
            <a v-if="guideStep !== 1 || canModels" class="guide-action button button-primary" :href="official(currentGuide.route)" target="_top" rel="noreferrer">{{ currentGuide.action }}<ArrowUpRight :size="15" /></a><span v-else class="guide-unavailable">模型广场当前未开放，请在控制台确认分组模型。</span>
          </div>
          <div class="guide-footer"><a href="#overview" @click="goLocal('#overview')">查看接入代码<ArrowRight :size="13" /></a></div>
        </div>
      </section>

      <p class="scroll-statement" aria-label="一个端点，让想法变成作品。"><span>一个端点。</span><span>让想法，</span><span>变成作品。</span><ArrowDown :size="24" /></p>

      <section id="faq" class="faq-section reveal-section" aria-labelledby="faq-title">
        <div class="faq-intro reveal-item"><h2 id="faq-title">开始之前，<br />你可能想了解。</h2><p>关于账户、接口和模型的几个问题。</p><a v-if="settings.contact" class="text-link" :href="official('dashboard')" target="_top" rel="noreferrer">联系支持<ArrowUpRight :size="15" /></a></div>
        <div class="faq-list reveal-item">
          <details><summary>如何获取 API 密钥？<ChevronDown :size="17" /></summary><div><p>进入官方「API 密钥」页面创建密钥，未登录时官网会先引导登录。请为密钥选择适合的分组，并在服务端环境变量中保存，不要提交到公开仓库。</p><a :href="official('keys')" target="_top" rel="noreferrer">前往 API 密钥<ArrowUpRight :size="14" /></a></div></details>
          <details><summary>不同工具的 Base URL 应该怎么填写？<ChevronDown :size="17" /></summary><div><p>OpenAI SDK 一般填写 <code>{{ apiEndpoint }}</code>。Claude Code 的 <code>ANTHROPIC_BASE_URL</code> 填写 <code>{{ settings.apiBase }}</code>；各客户端对路径的要求不同，请勿重复拼接 <code>/v1</code>，也不要将本首页域名当作 API 地址。</p></div></details>
          <details><summary>可以调用哪些模型，如何查看价格？<ChevronDown :size="17" /></summary><div><p>首页仅展示公开模型目录，不代表每个账户均可调用全部模型。实际可调用范围取决于密钥绑定的分组；价格还可能受分组倍率、时段和上下文阶梯影响，请在官方页面确认。</p><a v-if="canModels" :href="official('models')" target="_top" rel="noreferrer">查看模型与价格<ArrowUpRight :size="14" /></a></div></details>
          <details><summary>在哪里查看充值、订阅和请求记录？<ChevronDown :size="17" /></summary><div><p>这些功能都在原有控制台中处理，账户与数据保持不变。通过本页侧栏可直达已开放的功能；没有登录时，官网会先引导完成登录。</p><a :href="official('dashboard')" target="_top" rel="noreferrer">进入控制台<ArrowUpRight :size="14" /></a></div></details>
        </div>
      </section>

      <section class="closing-banner"><div class="closing-icon"><Zap :size="24" /></div><div><h2>好想法，值得一个简单的开始。</h2><p>用熟悉的方式接入，把下一步交给创造。</p></div><a class="button button-dark" :href="official(enabled('registration_enabled') ? 'register' : 'login')" target="_top" rel="noreferrer">{{ enabled('registration_enabled') ? '创建你的账户' : '前往登录' }}<ArrowRight :size="17" /></a></section>

      <footer class="footer"><div class="footer-top"><a class="brand footer-brand" href="#overview" @click="goLocal('#overview')"><img :src="logoFailed ? '/brand.webp' : settings.logo || '/brand.webp'" alt="" width="29" height="29" /><span>{{ settings.name }}</span></a><div class="footer-links"><a href="#quickstart" @click="goLocal('#quickstart')">接入指南</a><a v-if="canModels" :href="official('models')" target="_top" rel="noreferrer">模型广场</a><a :href="official('dashboard')" target="_top" rel="noreferrer">控制台<ArrowUpRight :size="13" /></a></div></div><div class="footer-bottom"><span>© {{ new Date().getFullYear() }} {{ settings.name }}</span><span v-if="failed && !loading" class="sync-warning"><Radio :size="12" />部分公开信息暂未同步<button type="button" @click="refresh">重试</button></span></div></footer>
    </main>

    <Modal id="search-dialog" :open="searchOpen" title="搜索页面与功能" @close="searchOpen = false">
      <div class="search-input-wrap"><Search :size="19" /><input v-model="searchQuery" aria-label="搜索页面与功能" placeholder="输入模型、密钥、日志..." type="search" /></div>
      <div class="search-results"><a v-for="result in searchResults" :key="result.label" :href="result.href" :target="result.local ? undefined : '_top'" rel="noreferrer" @click="result.local ? goLocal(result.href) : searchOpen = false"><component :is="result.icon" :size="19" /><span>{{ result.label }}<small>{{ result.group }}</small></span><ArrowUpRight v-if="!result.local" :size="16" /><ArrowRight v-else :size="16" /></a><div v-if="!searchResults.length" class="search-empty"><Search :size="26" /><p>没有找到相关页面</p><span>试试「模型」「密钥」或「用量」。</span></div></div>
    </Modal>

    <Modal id="announcement-dialog" :open="announcementOpen" title="站点公告" @close="announcementOpen = false"><div class="announcement-content"><span class="announcement-symbol"><Megaphone :size="29" /></span><h3>站点动态，在控制台与你同步。</h3><p>公告请前往官方控制台查看。<br />如果尚未登录，官网会引导你完成登录。</p><a class="button button-primary" :href="official('dashboard')" target="_top" rel="noreferrer">前往控制台<ArrowUpRight :size="16" /></a><p v-if="settings.contact" class="contact-text">{{ settings.contact }}</p></div></Modal>

    <Modal id="manual-copy-dialog" :open="manualCopyOpen" title="手动复制内容" @close="manualCopyOpen = false"><p class="manual-copy-description">当前浏览器限制了剪贴板访问。请全选下方内容，再使用系统的复制操作。</p><textarea id="manual-copy-content" class="manual-copy-content" readonly :value="manualCopyText" aria-label="待复制的内容" /><div class="manual-copy-actions"><button type="button" class="button button-primary" @click="selectManual">全选内容</button><button type="button" class="button button-secondary" @click="manualCopyOpen = false">关闭</button></div></Modal>

    <Transition name="toast"><div v-if="toast" class="toast-message" :class="{ error: toastError }" role="status"><CircleHelp v-if="toastError" :size="18" /><Check v-else :size="18" />{{ toast }}</div></Transition>
  </div>
</template>
