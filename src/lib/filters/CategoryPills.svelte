<script lang="ts">
  import { filters, toggleCategory } from '../stores/filters.svelte'

  const categoryColors: Record<string, string> = {
    political: '#e03e3e',
    policy: '#d97706',
    crypto: '#06b6d4',
    finance: '#8b5cf6',
    pharma: '#10b981',
    tech: '#3b82f6',
    defense: '#f43f5e',
    fossil: '#92400e',
    mining: '#ca8a04',
    energy: '#22c55e',
    industrial: '#64748b',
    telecom: '#ec4899',
    consumer: '#f97316',
    government: '#14b8a6',
    real_assets: '#a8a29e',
    other: '#525252',
  }

  const categories = Object.keys(categoryColors)

  let open = $state(false)
  let search = $state('')
  let inputEl: HTMLInputElement

  let filtered = $derived(
    search
      ? categories.filter((c) => c.replace('_', ' ').includes(search.toLowerCase()))
      : categories,
  )

  function toggle(cat: string) {
    toggleCategory(cat)
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      open = false
      search = ''
    }
  }

  function handleClickOutside(e: MouseEvent) {
    const target = e.target as HTMLElement
    if (!target.closest('.category-filter')) {
      open = false
      search = ''
    }
  }
</script>

<svelte:window onclick={handleClickOutside} />

<div class="category-filter flex items-center gap-2" onclick={(e) => e.stopPropagation()}>
  <!-- Trigger button -->
  <div class="relative">
    <button
      onclick={() => { open = !open; if (open) requestAnimationFrame(() => inputEl?.focus()) }}
      class="flex items-center gap-1.5 px-2 py-1 rounded font-mono text-[10px] border border-neutral-800 hover:border-neutral-600 transition-colors text-neutral-500"
    >
      <!-- Filter icon (three lines) -->
      <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" shape-rendering="geometricPrecision">
        <path d="M3 6h18M6 12h12M9 18h6" />
      </svg>
      <span>Category</span>
      <svg class="w-3 h-3 text-neutral-600 ml-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" shape-rendering="geometricPrecision">
        <path d="M19 9l-7 7-7-7" />
      </svg>
    </button>

    <!-- Dropdown -->
    {#if open}
      <div
        class="absolute top-full left-0 mt-1 w-56 bg-neutral-900 border border-neutral-800 rounded-md shadow-xl z-50 overflow-hidden"
      >
        <!-- Search input -->
        <div class="p-1.5 border-b border-neutral-800">
          <input
            bind:this={inputEl}
            bind:value={search}
            onkeydown={handleKeydown}
            placeholder="Filter categories…"
            class="w-full bg-transparent font-mono text-[10px] text-neutral-300 placeholder-neutral-600 outline-none px-1.5 py-1"
          />
        </div>

        <!-- Options list -->
        <div class="max-h-64 overflow-y-auto py-1">
          {#each filtered as cat}
            {@const color = categoryColors[cat]}
            {@const active = filters.categories.includes(cat)}
            <button
              onclick={() => toggle(cat)}
              class="w-full flex items-center gap-2 px-3 py-1.5 text-left hover:bg-neutral-800/60 transition-colors"
            >
              <span
                class="w-2 h-2 rounded-full shrink-0"
                style="background: {color}"
              ></span>
              <span
                class="font-mono text-[10px] capitalize flex-1"
                style="color: {active ? 'var(--color-neutral-200)' : 'var(--color-neutral-500)'}"
              >
                {cat.replace('_', ' ')}
              </span>
              <span
                class="w-3.5 h-3.5 rounded-sm border flex items-center justify-center shrink-0"
                style="border-color: var(--color-neutral-600); background: {active ? 'var(--color-neutral-600)' : 'transparent'}"
              >
                {#if active}
                  <svg class="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="var(--color-neutral-900)" stroke-width="3">
                    <path d="M5 13l4 4L19 7" />
                  </svg>
                {/if}
              </span>
            </button>
          {/each}

          {#if filtered.length === 0}
            <p class="px-3 py-2 font-mono text-[9px] text-neutral-600">No matches</p>
          {/if}
        </div>
      </div>
    {/if}
  </div>

  <!-- Active category chips -->
  {#each filters.categories as cat}
    {@const color = categoryColors[cat]}
    <span
      class="flex items-center gap-1.5 px-2 py-1 rounded font-mono text-[10px] capitalize border border-neutral-700 bg-neutral-800/50"
    >
      <span class="w-1.5 h-1.5 rounded-full shrink-0" style="background: {color}"></span>
      <span class="text-neutral-300">{cat.replace('_', ' ')}</span>
      <button
        onclick={() => toggle(cat)}
        class="ml-0.5 text-neutral-500 hover:text-neutral-300 transition-colors leading-none"
      >
        <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </button>
    </span>
  {/each}
</div>
