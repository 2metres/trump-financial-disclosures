<script lang="ts">
  type View = 'bipartite' | 'wealthmap'

  let { activeView = $bindable() }: { activeView: View } = $props()

  const views: { id: View; label: string; description: string }[] = [
    { id: 'bipartite', label: 'Holdings Network', description: 'Who holds what' },
    { id: 'wealthmap', label: 'Wealth Map', description: 'Total wealth composition' },
  ]
</script>

<nav class="border-b border-neutral-800 bg-ink-900/50 backdrop-blur-sm sticky top-0 z-50">
  <div class="max-w-[1600px] mx-auto px-6 flex gap-0">
    {#each views as view}
      <button
        class="group relative px-5 py-3 transition-colors"
        class:text-gold-400={activeView === view.id}
        class:text-neutral-500={activeView !== view.id}
        onclick={() => activeView = view.id}
      >
        <span class="font-mono text-xs tracking-wide uppercase block">{view.label}</span>
        <span class="font-sans text-[10px] text-neutral-600 block mt-0.5 group-hover:text-neutral-500 transition-colors">
          {view.description}
        </span>
        {#if activeView === view.id}
          <div class="absolute bottom-0 left-2 right-2 h-px bg-gold-400"></div>
        {/if}
      </button>
    {/each}
  </div>
</nav>
