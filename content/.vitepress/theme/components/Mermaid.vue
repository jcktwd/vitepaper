<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useData } from 'vitepress'

const props = defineProps<{
  code: string
}>()

const { isDark } = useData()
const svgHtml = ref('')
const errorMsg = ref('')

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

onMounted(() => {
  void renderDiagram()
})

watch(isDark, () => {
  void renderDiagram()
})
</script>

<template>
  <div class="mermaid">
    <div v-if="svgHtml" v-html="svgHtml" class="w-full flex justify-center" />
    <pre v-else-if="errorMsg" class="text-xs text-red-500">{{ errorMsg }}</pre>
    <div v-else class="text-xs text-muted-foreground italic py-4">Rendering diagram...</div>
  </div>
</template>
