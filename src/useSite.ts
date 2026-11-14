import { computed, onUnmounted, ref } from 'vue'
import { FALLBACK_SETTINGS, OFFICIAL_ROUTES, SUB2API_ORIGIN } from './config'
import type { SiteData } from './types'

export function useSite() {
  const data = ref<SiteData | null>(null)
  const loading = ref(true)
  const failed = ref(false)
  let controller: AbortController | undefined

  const settings = computed(() => data.value?.settings ?? FALLBACK_SETTINGS)
  const catalog = computed(() => data.value?.catalog ?? null)
  const restricted = computed(() => data.value?.catalogStatus === 'restricted')
  const origin = computed(() => {
    try {
      const value = new URL(data.value?.origin ?? SUB2API_ORIGIN)
      return value.protocol === 'https:' ? value.origin : SUB2API_ORIGIN
    } catch {
      return SUB2API_ORIGIN
    }
  })

  const official = (route: keyof typeof OFFICIAL_ROUTES) => new URL(OFFICIAL_ROUTES[route], origin.value).href
  const enabled = (flag: string) => settings.value.flags.backend_mode_enabled !== true && settings.value.flags[flag] !== false
  const apiEndpoint = computed(() => {
    const base = settings.value.apiBase.replace(/\/+$/, '')
    return /\/v1$/.test(base) ? base : `${base}/v1`
  })

  async function refresh() {
    controller?.abort()
    const current = new AbortController()
    controller = current
    loading.value = true
    failed.value = false
    try {
      const response = await fetch('/api/site', { signal: AbortSignal.any([current.signal, AbortSignal.timeout(12_000)]), credentials: 'omit' })
      if (!response.ok) throw new Error('site-api-failed')
      const result = await response.json() as SiteData
      if (!result || !['live', 'unavailable'].includes(result.settingsStatus) || !['live', 'unavailable', 'restricted'].includes(result.catalogStatus)) {
        throw new Error('invalid-site-response')
      }
      data.value = result
      failed.value = result.settingsStatus === 'unavailable' || result.catalogStatus === 'unavailable'
      if (result.settings?.name) document.title = `${result.settings.name} · 让模型接入，更进一步`
      if (result.settings?.logo) {
        const icon = document.querySelector<HTMLLinkElement>('link[rel="icon"]')
        if (icon) icon.href = result.settings.logo
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
      failed.value = true
    } finally {
      if (controller === current) loading.value = false
    }
  }

  onUnmounted(() => controller?.abort())

  return { data, loading, failed, settings, catalog, restricted, enabled, official, apiEndpoint, refresh }
}
