<script lang="ts">
  import BipartiteGraph from './lib/BipartiteGraph.svelte'
  import FilterBar from './lib/FilterBar.svelte'
</script>

<div class="min-h-screen flex flex-col">
  <!-- Header -->
  <header class="border-b border-neutral-800 px-6 py-5">
    <div class="max-w-[1600px] mx-auto">
      <p class="font-mono text-[11px] tracking-[0.2em] uppercase text-gold-400 mb-1">
        Investigation
      </p>
      <h1 class="font-serif text-4xl md:text-5xl text-neutral-100 leading-[1.1] tracking-tight">
        Follow the Money
      </h1>
      <p class="font-sans text-neutral-500 mt-2 text-sm max-w-2xl">
        Financial disclosures from 1,581 Trump administration appointees reveal shared holdings,
        overlapping interests, and potential conflicts across 62 federal agencies.
      </p>
    </div>
  </header>

  <!-- Filter Bar -->
  <FilterBar />

  <!-- View -->
  <main class="flex-1 relative">
    <BipartiteGraph />
  </main>

  <!-- Footer -->
  <footer class="border-t border-neutral-800 px-6 py-4">
    <div class="max-w-[1600px] mx-auto flex justify-between items-center">
      <p class="font-mono text-[10px] text-neutral-600">
        Data: ProPublica Trump Team Financial Disclosures &middot; OGE Forms 278e/278-T
      </p>
      <p class="font-mono text-[10px] text-neutral-700">
        143,330 disclosure entries &middot; 62 agencies
      </p>
    </div>
  </footer>
</div>
