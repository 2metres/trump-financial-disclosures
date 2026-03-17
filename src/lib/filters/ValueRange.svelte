<script lang="ts">
  import { filters } from '../stores/filters.svelte'

  function parseValue(raw: string): number | null {
    const trimmed = raw.trim()
    if (trimmed === '' || trimmed === '-') return null
    // Support shorthand: 1M, 500K, 2.5B
    const match = trimmed.match(/^([0-9.]+)\s*([kmb]?)$/i)
    if (!match) return null
    const num = parseFloat(match[1])
    if (isNaN(num)) return null
    const suffix = match[2].toLowerCase()
    if (suffix === 'k') return num * 1_000
    if (suffix === 'm') return num * 1_000_000
    if (suffix === 'b') return num * 1_000_000_000
    return num
  }

  function formatDisplay(v: number | null): string {
    if (v === null) return ''
    if (v >= 1e9) return `${(v / 1e9).toFixed(1)}B`
    if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`
    if (v >= 1e3) return `${(v / 1e3).toFixed(0)}K`
    return String(v)
  }

  let minRaw = $state(formatDisplay(filters.valueMin))
  let maxRaw = $state(formatDisplay(filters.valueMax))

  function handleMinBlur() {
    const parsed = parseValue(minRaw)
    filters.valueMin = parsed
    minRaw = formatDisplay(parsed)
  }

  function handleMaxBlur() {
    const parsed = parseValue(maxRaw)
    filters.valueMax = parsed
    maxRaw = formatDisplay(parsed)
  }

  // Sync if reset externally
  $effect(() => {
    const newMin = formatDisplay(filters.valueMin)
    if (newMin !== minRaw && filters.valueMin === null) minRaw = ''
  })
  $effect(() => {
    const newMax = formatDisplay(filters.valueMax)
    if (newMax !== maxRaw && filters.valueMax === null) maxRaw = ''
  })

  const inputClass =
    'w-20 px-2 py-1.5 bg-transparent border border-neutral-800 rounded text-neutral-300 font-mono text-[10px] placeholder-neutral-700 focus:outline-none focus:border-neutral-600 transition-colors text-right'
</script>

<div class="flex items-center gap-1.5">
  <span class="font-mono text-[9px] text-neutral-600 uppercase tracking-wide">value</span>
  <input
    type="text"
    bind:value={minRaw}
    onblur={handleMinBlur}
    onkeydown={(e) => e.key === 'Enter' && handleMinBlur()}
    placeholder="min"
    class={inputClass}
  />
  <span class="font-mono text-[9px] text-neutral-700">—</span>
  <input
    type="text"
    bind:value={maxRaw}
    onblur={handleMaxBlur}
    onkeydown={(e) => e.key === 'Enter' && handleMaxBlur()}
    placeholder="max"
    class={inputClass}
  />
</div>
