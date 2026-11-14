<script setup lang="ts">
import { Asterisk, BrainCircuit, Command, Orbit, Sparkles, Waves } from '@lucide/vue'
defineProps<{ platform: string; size?: number }>()
const symbols = { openai: Command, anthropic: Asterisk, gemini: Sparkles, deepseek: Waves, grok: Orbit }
</script>

<template>
  <span class="provider-mark" :class="`provider-${platform}`" aria-hidden="true">
    <component :is="symbols[platform as keyof typeof symbols] || BrainCircuit" :size="size || 24" :stroke-width="1.7" />
  </span>
</template>
