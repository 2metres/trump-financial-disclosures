<script lang="ts">
  import CategoryPills from './filters/CategoryPills.svelte'
  import { isFiltersActive, resetFilters } from './stores/filters.svelte'

  let active = $derived(isFiltersActive())
</script>

<div class="border-b border-neutral-800 px-6 py-2.5 bg-ink-900/80 backdrop-blur-sm relative z-30">
  <div class="max-w-8xl mx-auto flex flex-wrap items-center gap-3">
    <!-- Category pills -->
    <div class="flex-1 min-w-0">
      <CategoryPills />
    </div>

    <!-- Clear button — only when filters are active -->
    {#if active}
      <button
        onclick={resetFilters}
        class="shrink-0 px-2 py-1 font-mono text-[9px] uppercase tracking-wider text-neutral-500 border border-neutral-800 rounded hover:border-neutral-600 hover:text-neutral-300 transition-colors"
      >
        clear
      </button>
    {/if}
  </div>
</div>
