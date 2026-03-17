<script lang="ts">
  import { filters, resetFilters, isFiltersActive } from './stores/filters.svelte'
  import SearchInput from './filters/SearchInput.svelte'
  import CategoryPills from './filters/CategoryPills.svelte'
  import ValueRange from './filters/ValueRange.svelte'

  let active = $derived(isFiltersActive())
</script>

<div class="border-b border-neutral-800 px-6 py-2.5 bg-ink-900/80 backdrop-blur-sm">
  <div class="max-w-[1600px] mx-auto flex flex-wrap items-center gap-3">
    <!-- Search -->
    <div class="w-48 flex-shrink-0">
      <SearchInput />
    </div>

    <!-- Divider -->
    <span class="w-px h-5 bg-neutral-800 flex-shrink-0"></span>

    <!-- Category pills -->
    <div class="flex-1 min-w-0">
      <CategoryPills />
    </div>

    <!-- Divider -->
    <span class="w-px h-5 bg-neutral-800 flex-shrink-0"></span>

    <!-- Value range -->
    <div class="flex-shrink-0">
      <ValueRange />
    </div>

    <!-- Clear button — only when filters are active -->
    {#if active}
      <button
        onclick={resetFilters}
        class="flex-shrink-0 px-2 py-1 font-mono text-[9px] uppercase tracking-wider text-neutral-500 border border-neutral-800 rounded hover:border-neutral-600 hover:text-neutral-300 transition-colors"
      >
        clear
      </button>
    {/if}
  </div>
</div>
