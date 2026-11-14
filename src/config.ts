import type { SiteSettings } from './types'

// 官方页面的地址必须是父站的绝对 URL，不能按 cc.zhouwanx.top 的当前域名拼接。
export const SUB2API_ORIGIN = 'https://ai.zhouwanx.top'
export const OFFICIAL_ROUTES = {
  login: '/login',
  register: '/register',
  models: '/model-plaza',
  dashboard: '/dashboard',
  keys: '/keys',
  usage: '/usage',
  purchase: '/purchase',
  subscriptions: '/subscriptions',
  monitor: '/monitor',
  channels: '/available-channels',
  keyUsage: '/key-usage',
} as const

// 名称、Logo 与端点回退取自 0.2.21 站点的真实公开配置；不内置模型数或报价。
export const FALLBACK_SETTINGS: SiteSettings = {
  name: '岚潮API',
  subtitle: '欢迎使用岚潮API',
  logo: '/brand.webp',
  apiBase: SUB2API_ORIGIN,
  docUrl: '',
  contact: '',
  version: '',
  endpoints: [{ name: '香港端点', url: `${SUB2API_ORIGIN}/v1`, description: '适合国内使用' }],
  flags: {},
}

export const PROVIDERS: Record<string, { name: string; label: string; description: string; symbol: string }> = {
  openai: { name: 'OpenAI', label: 'GPT', description: '从对话到代码，把想法变成作品。', symbol: 'openai' },
  anthropic: { name: 'Anthropic', label: 'Claude', description: '长文理解与编程，融入日常工作流。', symbol: 'claude' },
  gemini: { name: 'Google', label: 'Gemini', description: '探索多模态模型的更多使用方式。', symbol: 'gemini' },
  deepseek: { name: 'DeepSeek', label: 'DeepSeek', description: '中文创作、推理与开发的另一种选择。', symbol: 'deepseek' },
  grok: { name: 'xAI', label: 'Grok', description: '用统一接口，探索不同模型的能力。', symbol: 'grok' },
}
