<script lang="ts">
  import { filters } from '../stores/filters.svelte'

  let { placeholder = 'search appointees, entities…' }: { placeholder?: string } = $props()

  let localValue = $state(filters.search)
  let debounceTimer: ReturnType<typeof setTimeout>

  function handleInput(e: Event) {
    const val = (e.target as HTMLInputElement).value
    localValue = val
    clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => {
      filters.search = val
    }, 250)
  }

  // Keep local value in sync if store is reset externally
  $effect(() => {
    if (filters.search !== localValue) {
      localValue = filters.search
    }
  })
</script>

<div class="relative flex items-center">
  <svg
    class="absolute left-2 w-3 h-3 text-neutral-600 pointer-events-none"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    stroke-width="1.5"
  >
    <circle cx="6.5" cy="6.5" r="4.5" />
    <line x1="10" y1="10" x2="14" y2="14" />
  </svg>
  <input
    type="text"
    value={localValue}
    oninput={handleInput}
    {placeholder}
    class="w-full pl-7 pr-3 py-1.5 bg-transparent border border-neutral-800 rounded text-neutral-300 font-mono text-[10px] placeholder-neutral-700 focus:outline-none focus:border-neutral-600 transition-colors"
  />
</div>
