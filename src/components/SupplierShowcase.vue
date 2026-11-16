<script setup lang="ts">
import { computed, ref } from 'vue'
import { ArrowUpRight, Cloud, Layers, Network } from '@lucide/vue'
import { SERVICE_SUPPLIERS } from '../config'

const marks = { layers: Layers, cloud: Cloud, network: Network }
const failedLogos = ref(new Set<string>())

function supplierUrl(value?: string) {
  if (!value) return ''
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : ''
  } catch {
    return ''
  }
}

const suppliers = computed(() => SERVICE_SUPPLIERS.map(item => ({ ...item, href: supplierUrl(item.url) })))
</script>

<template>
  <section v-if="suppliers.length" id="suppliers" class="supplier-showcase reveal-section" aria-labelledby="suppliers-title">
    <div class="supplier-heading reveal-item">
      <span class="supplier-heading-line" aria-hidden="true" />
      <h2 id="suppliers-title">服务供应商</h2>
    </div>
    <ul class="supplier-list" :class="{ 'single-supplier': suppliers.length === 1 }">
      <li v-for="supplier in suppliers" :key="supplier.id" class="supplier-item reveal-item">
        <component :is="supplier.href ? 'a' : 'div'" class="supplier-identity" :class="{ 'supplier-link': supplier.href }" :href="supplier.href || undefined" :target="supplier.href ? '_blank' : undefined" :rel="supplier.href ? 'noopener noreferrer' : undefined">
          <span class="supplier-logo" aria-hidden="true">
            <img v-if="supplier.logo && !failedLogos.has(supplier.id)" :src="supplier.logo" alt="" width="48" height="48" @error="failedLogos.add(supplier.id)" />
            <component :is="marks[supplier.mark]" v-else :size="25" :stroke-width="1.7" />
          </span>
          <span class="supplier-copy"><strong>{{ supplier.name }}</strong><span>{{ supplier.description }}</span></span>
          <ArrowUpRight v-if="supplier.href" :size="17" class="supplier-arrow" aria-hidden="true" />
        </component>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.supplier-showcase { display: grid; grid-template-columns: 172px minmax(0, 1fr); align-items: center; gap: 25px; margin: 0 0 24px; padding: 25px 27px; border: 1px solid var(--accent-border); border-left: 4px solid var(--accent); border-radius: 12px; background: var(--accent-soft); }
.supplier-heading { min-width: 0; }
.supplier-heading-line { display: block; width: 28px; height: 3px; margin-bottom: 10px; border-radius: 2px; background: var(--accent); }
.supplier-heading h2 { font-size: 23px; line-height: 1.4; font-weight: 700; letter-spacing: -.6px; }
.supplier-list { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0; padding: 0; margin: 0; list-style: none; }
.supplier-list.single-supplier { grid-template-columns: minmax(0, 1fr); }
.single-supplier .supplier-identity { flex-direction: row; align-items: center; }
.supplier-item { min-width: 0; padding: 7px 21px; }
.supplier-item + .supplier-item { border-left: 1px solid var(--accent-border); }
.supplier-identity { display: flex; align-items: center; gap: 12px; min-width: 0; }
.supplier-logo { display: grid; place-items: center; width: 48px; height: 48px; flex: 0 0 48px; border: 1px solid var(--accent-border); border-radius: 12px; background: var(--surface); color: var(--accent); }
.supplier-item:first-child .supplier-logo { background: var(--accent); border-color: var(--accent); color: var(--on-accent); }
.supplier-logo img { width: 100%; height: 100%; object-fit: contain; border-radius: inherit; }
.supplier-copy { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.supplier-copy strong { color: var(--text); font-size: 19px; line-height: 1.4; font-weight: 650; overflow-wrap: anywhere; }
.supplier-copy > span { color: var(--secondary); font-size: 13px; line-height: 1.6; }
.supplier-arrow { color: var(--accent); margin-left: auto; }
.supplier-link { border-radius: 8px; transition: transform .2s; }
.supplier-link:hover { transform: translateY(-2px); }
.supplier-link:hover strong { color: var(--accent); }
@media (max-width: 1250px) {
  .supplier-showcase { grid-template-columns: 135px minmax(0, 1fr); gap: 15px; padding-inline: 21px; }
  .supplier-item { padding-inline: 13px; }
  .supplier-identity { gap: 10px; }
  .supplier-heading h2 { font-size: 21px; }
  .supplier-copy strong { font-size: 17px; }
  .supplier-logo { width: 41px; height: 41px; flex-basis: 41px; border-radius: 10px; }
}
@media (max-width: 1050px) {
  .supplier-showcase { display: block; padding: 23px; }
  .supplier-heading { margin-bottom: 20px; }
  .supplier-heading-line { width: 24px; margin-bottom: 8px; }
  .supplier-list { gap: 14px; }
  .supplier-item { padding: 0; }
  .supplier-item + .supplier-item { border: 0; }
  .supplier-identity { flex-direction: column; align-items: flex-start; gap: 11px; }
  .supplier-copy strong { font-size: 18px; }
  .supplier-copy > span { font-size: 13px; }
}
@media (max-width: 600px) {
  .supplier-showcase { padding: 21px 18px; margin-bottom: 22px; }
  .supplier-heading { display: flex; align-items: center; gap: 10px; margin-bottom: 18px; }
  .supplier-heading-line { width: 20px; margin: 0; }
  .supplier-list { grid-template-columns: 1fr; gap: 0; }
  .supplier-item { padding: 16px 0; }
  .supplier-item:first-child { padding-top: 0; }
  .supplier-item:last-child { padding-bottom: 0; }
  .supplier-item + .supplier-item { border-top: 1px solid var(--accent-border); }
  .supplier-identity { flex-direction: row; align-items: center; gap: 13px; }
  .supplier-logo { width: 46px; height: 46px; flex-basis: 46px; }
  .supplier-identity { min-height: 48px; }
  .supplier-copy > span { font-size: 14px; overflow-wrap: anywhere; }
}
</style>
