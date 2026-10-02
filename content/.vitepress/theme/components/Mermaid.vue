<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useData } from 'vitepress'

const props = defineProps<{
  code: string
}>()

const { isDark } = useData()
const svgHtml = ref('')
const errorMsg = ref('')
const diagramRef = ref<HTMLElement | null>(null)

async function renderDiagram() {
  try {
    const mermaid = (await import('mermaid')).default
    mermaid.initialize({
      startOnLoad: false,
      theme: isDark.value ? 'dark' : 'neutral',
      securityLevel: 'loose',
    })
    const id = `mermaid-${Math.random().toString(36).slice(2, 10)}`
    const decoded = decodeURIComponent(props.code)
    const { svg } = await mermaid.render(id, decoded)
    svgHtml.value = svg
    errorMsg.value = ''
  } catch (err: any) {
    errorMsg.value = err?.message || String(err)
  }
}

function expandDiagram() {
  const svgEl = diagramRef.value?.querySelector<SVGSVGElement>('svg')
  if (svgEl) {
    window.dispatchEvent(new CustomEvent('vp:open-mermaid', { detail: svgEl }))
  }
}

onMounted(() => {
  void renderDiagram()
})

watch(isDark, () => {
  void renderDiagram()
})
</script>

<template>
  <div class="mermaid group relative" title="Click to expand diagram" @click="expandDiagram">
    <button
      v-if="svgHtml"
      type="button"
      class="vp-mermaid-expand-btn"
      aria-label="Expand diagram to fullscreen"
      title="Expand diagram"
      @click.stop="expandDiagram"
    >
      <svg viewBox="0 0 24 24" class="w-3.5 h-3.5 fill-none stroke-current" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="15 3 21 3 21 9" />
        <polyline points="9 21 3 21 3 15" />
        <line x1="21" y1="3" x2="14" y2="10" />
        <line x1="3" y1="21" x2="10" y2="14" />
      </svg>
    </button>
    <div v-if="svgHtml" ref="diagramRef" v-html="svgHtml" class="vp-mermaid-diagram w-full flex justify-center" />
    <pre v-else-if="errorMsg" class="text-xs text-red-500">{{ errorMsg }}</pre>
    <div v-else class="text-xs text-muted-foreground italic py-4">Rendering diagram...</div>
  </div>
</template>
