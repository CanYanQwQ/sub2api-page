export interface SiteSettings {
  name: string
  subtitle: string
  logo: string
  apiBase: string
  docUrl: string
  contact: string
  version: string
  endpoints: { name: string; url: string; description: string }[]
  flags: Record<string, boolean>
}

export interface Catalog {
  groupCount: number
  modelCount: number
  platforms: { id: string; count: number; models: string[] }[]
  models: { name: string; platform: string }[]
}

export interface SiteData {
  origin: string
  settings: SiteSettings | null
  catalog: Catalog | null
  settingsStatus: 'live' | 'unavailable'
  catalogStatus: 'live' | 'unavailable' | 'restricted'
  fetchedAt: string
}
