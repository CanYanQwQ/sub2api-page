<script setup lang="ts">
import { nextTick, onUnmounted, ref, watch } from 'vue'
import { X } from '@lucide/vue'

const props = defineProps<{ open: boolean; title: string; id: string }>()
const emit = defineEmits<{ close: [] }>()
const panel = ref<HTMLElement>()
let previousFocus: HTMLElement | null = null
let previousOverflow = ''

function onKey(event: KeyboardEvent) {
  if (!props.open) return
  if (event.key === 'Escape') {
    event.preventDefault()
    emit('close')
  }
  if (event.key === 'Tab') {
    const items = panel.value?.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input, select, textarea, [tabindex="0"]')
    if (!items?.length) return
    const first = items[0]
    const last = items[items.length - 1]
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last?.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first?.focus()
    }
  }
}

watch(() => props.open, async (value) => {
  if (value) {
    previousFocus = document.activeElement as HTMLElement
    previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', onKey)
    await nextTick()
    const initial = panel.value?.querySelector<HTMLElement>('input, textarea') || panel.value?.querySelector<HTMLElement>('button')
    initial?.focus()
  } else {
    document.body.style.overflow = previousOverflow
    document.removeEventListener('keydown', onKey)
    previousFocus?.focus()
  }
})

onUnmounted(() => {
  document.removeEventListener('keydown', onKey)
  if (props.open) document.body.style.overflow = previousOverflow
})
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="open" class="modal-backdrop" @click.self="emit('close')">
        <section :id="id" ref="panel" class="modal-panel" role="dialog" aria-modal="true" :aria-labelledby="`${id}-title`">
          <header class="modal-header">
            <h2 :id="`${id}-title`">{{ title }}</h2>
            <button type="button" class="icon-button" aria-label="关闭弹窗" @click="emit('close')"><X :size="20" /></button>
          </header>
          <slot />
        </section>
      </div>
    </Transition>
  </Teleport>
</template>
