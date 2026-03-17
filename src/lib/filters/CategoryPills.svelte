<script lang="ts">
  import { filters, toggleCategory } from '../stores/filters.svelte'

  const categoryColors: Record<string, string> = {
    political: '#c2342d',
    policy: '#e07c3e',
    crypto: '#22d3ee',
    finance: '#a78bfa',
    pharma: '#4ade80',
    tech: '#3b82f6',
    defense: '#ef4444',
    energy: '#d4a23a',
    telecom: '#f472b6',
    consumer: '#fb923c',
    government: '#6ee7b7',
    real_assets: '#a3a3a3',
    other: '#525252',
  }

  const categories = Object.keys(categoryColors)
</script>

<div class="flex flex-wrap gap-1.5">
  {#each categories as cat}
    {@const color = categoryColors[cat]}
    {@const active = filters.categories.includes(cat)}
    <button
      onclick={() => toggleCategory(cat)}
      class="flex items-center gap-1 px-1.5 py-0.5 rounded font-mono text-[9px] uppercase tracking-wide border transition-all"
      style="
        border-color: {active ? color : 'transparent'};
        background: {active ? color + '22' : 'transparent'};
        color: {active ? color : 'var(--color-neutral-600)'};
      "
      title={cat.replace('_', ' ')}
    >
      <span
        class="w-1.5 h-1.5 rounded-full flex-shrink-0"
        style="background: {color}; opacity: {active ? 1 : 0.4}"
      ></span>
      {cat.replace('_', ' ')}
    </button>
  {/each}
</div>
