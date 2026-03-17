<script lang="ts">
  import * as d3 from 'd3'
  import { onMount } from 'svelte'
  import { getDB } from './db/init'
  import { queryBipartiteData } from './db/queries'
  import type { BipartiteData, GraphNode } from './db/types'
  import { filters } from './stores/filters.svelte'

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

  const agencyColorMap: Record<string, string> = {}
  const agencyPalette = [
    '#e07c3e',
    '#4a7fd4',
    '#2d8a6e',
    '#9b59b6',
    '#d4a23a',
    '#3498db',
    '#1abc9c',
    '#e74c3c',
    '#8e6cb8',
    '#27ae60',
    '#c0392b',
    '#2980b9',
    '#f39c12',
    '#16a085',
    '#d35400',
  ]

  function getAgencyColor(agency: string): string {
    if (!agencyColorMap[agency]) {
      agencyColorMap[agency] =
        agencyPalette[Object.keys(agencyColorMap).length % agencyPalette.length]
    }
    return agencyColorMap[agency]
  }

  let container: HTMLDivElement
  let selected = $state<GraphNode | null>(null)
  let connectedAppointees = $state<GraphNode[]>([])
  let holdingValues = $state<Record<string, number>>({})
  let allData: BipartiteData | null = null
  let stats = $state({ nodes: 0, links: 0, entities: 0, appointees: 0 })
  let loading = $state(true)
  let error = $state<string | null>(null)
  let svgElement: SVGSVGElement | null = null

  // Store refs for resetting highlights from outside D3
  let nodeSelection: d3.Selection<any, any, any, any>
  let linkSelection: d3.Selection<any, any, any, any>
  let labelSelection: d3.Selection<any, any, any, any>

  function clearSelection() {
    selected = null
    connectedAppointees = []
    if (nodeSelection)
      nodeSelection.attr('fill-opacity', (d: any) => (d.type === 'entity' ? 0.85 : 0.7))
    if (linkSelection)
      linkSelection.attr('stroke', '#333').attr('stroke-opacity', 0.12).attr('stroke-width', 0.5)
    if (labelSelection) labelSelection.attr('opacity', 1)
  }

  async function loadData(): Promise<BipartiteData> {
    const db = await getDB()
    return queryBipartiteData(db)
  }

  function isNodeVisible(d: any): boolean {
    const f = filters
    if (f.search) {
      const q = f.search.toLowerCase()
      if (!d.name.toLowerCase().includes(q)) return false
    }
    if (d.type === 'entity') {
      if (f.categories.length > 0 && !f.categories.includes(d.category || 'other')) return false
      if (f.valueMin != null && (d.total_value || 0) < f.valueMin) return false
      if (f.valueMax != null && (d.total_value || 0) > f.valueMax) return false
    }
    if (d.type === 'appointee') {
      if (f.agencies.length > 0 && !f.agencies.includes(d.agency || '')) return false
    }
    return true
  }

  function applyFilters() {
    if (!allData || !nodeSelection || !linkSelection) return

    clearSelection()

    // First pass: which nodes pass the direct filter criteria
    const directVisible = new Set<string>()
    allData.nodes.forEach((n) => {
      if (isNodeVisible(n)) directVisible.add(n.id)
    })

    // Second pass: only keep nodes that still have at least one visible connection
    // An appointee is visible only if it connects to a visible entity (and vice versa)
    const connectedToVisible = new Set<string>()
    allData.links.forEach((l: any) => {
      const sid = l.source.id ?? l.source
      const tid = l.target.id ?? l.target
      if (directVisible.has(sid) && directVisible.has(tid)) {
        connectedToVisible.add(sid)
        connectedToVisible.add(tid)
      }
    })

    const visibleIds = connectedToVisible

    // Update node visibility
    nodeSelection
      .attr('fill-opacity', (d: any) =>
        visibleIds.has(d.id) ? (d.type === 'entity' ? 0.85 : 0.7) : 0.04,
      )
      .attr('pointer-events', (d: any) => (visibleIds.has(d.id) ? 'all' : 'none'))

    // Update link visibility — visible only if both endpoints visible
    linkSelection
      .attr('stroke-opacity', (l: any) =>
        visibleIds.has(l.source.id) && visibleIds.has(l.target.id) ? 0.12 : 0.0,
      )
      .attr('pointer-events', (l: any) =>
        visibleIds.has(l.source.id) && visibleIds.has(l.target.id) ? 'all' : 'none',
      )

    // Update labels
    if (labelSelection) {
      labelSelection.attr('opacity', (d: any) => (visibleIds.has(d.id) ? 1 : 0))
    }

    // Update stats to reflect visible counts
    const visibleNodes = allData.nodes.filter((n) => visibleIds.has(n.id))
    const visibleLinks = allData.links.filter(
      (l: any) => visibleIds.has(l.source.id ?? l.source) && visibleIds.has(l.target.id ?? l.target),
    )
    stats = {
      nodes: visibleNodes.length,
      links: visibleLinks.length,
      entities: visibleNodes.filter((n) => n.type === 'entity').length,
      appointees: visibleNodes.filter((n) => n.type === 'appointee').length,
    }
  }

  function renderGraph(data: BipartiteData) {
    allData = data

    stats = {
      nodes: data.nodes.length,
      links: data.links.length,
      entities: data.nodes.filter((n) => n.type === 'entity').length,
      appointees: data.nodes.filter((n) => n.type === 'appointee').length,
    }

    // Clear previous render
    if (svgElement) {
      d3.select(svgElement).remove()
      svgElement = null
    }
    d3.select(container).selectAll('.tooltip').remove()

    const width = container.clientWidth
    const height = Math.max(700, window.innerHeight - 200)

    const svg = d3.select(container).append('svg').attr('width', width).attr('height', height)
    svgElement = svg.node()!

    const g = svg.append('g')

    const valueExtent = d3.extent(
      data.nodes.filter((n) => n.type === 'entity'),
      (n: any) => n.total_value || 0,
    ) as [number, number]
    const entityRadiusScale = d3
      .scaleSqrt()
      .domain([0, valueExtent[1] || 1])
      .range([6, 24])

    // Appointee diamond scale based on net worth
    const nwExtent = d3.extent(
      data.nodes.filter((n) => n.type === 'appointee'),
      (n: any) => n.net_worth_low || 0,
    ) as [number, number]
    const appointeeSizeScale = d3
      .scaleSqrt()
      .domain([0, nwExtent[1] || 1])
      .range([4, 14])

    function nodeRadius(d: any): number {
      return d.type === 'entity'
        ? entityRadiusScale(d.total_value || 0)
        : appointeeSizeScale(d.net_worth_low || 0)
    }

    // Pre-position nodes near center so they don't fly in from (0,0)
    for (const n of data.nodes as any[]) {
      n.x = width / 2 + (Math.random() - 0.5) * width * 0.3
      n.y = height / 2 + (Math.random() - 0.5) * height * 0.3
    }

    const simulation = d3
      .forceSimulation(data.nodes as any)
      .alpha(0.5)
      .alphaMin(0.005)
      .alphaDecay(0.04)
      .velocityDecay(0.65)
      .force(
        'link',
        d3
          .forceLink(data.links as any)
          .id((d: any) => d.id)
          .distance(60)
          .strength(0.15),
      )
      .force(
        'charge',
        d3
          .forceManyBody()
          .strength((d: any) => -nodeRadius(d) * 8)
          .distanceMax(350),
      )
      .force('x', d3.forceX(width / 2).strength(0.01))
      .force('y', d3.forceY(height / 2).strength(0.01))
      .force(
        'collision',
        d3.forceCollide().radius((d: any) => nodeRadius(d) + 6).strength(0.8).iterations(2),
      )

    const link = g
      .append('g')
      .selectAll('line')
      .data(data.links)
      .join('line')
      .attr('stroke', '#333')
      .attr('stroke-opacity', 0.12)
      .attr('stroke-width', 0.5)
    linkSelection = link

    const nodeGroup = g.append('g')

    const entityNodes = nodeGroup
      .selectAll('circle')
      .data(data.nodes.filter((n) => n.type === 'entity'))
      .join('circle')
      .attr('r', (d: any) => entityRadiusScale(d.total_value || 0))
      .attr('fill', (d: any) => categoryColors[d.category || 'other'] || '#737373')
      .attr('fill-opacity', 0.85)
      .attr('stroke', 'none')
      .attr('cursor', 'pointer')
      .call(drag(simulation) as any)

    const appointeeNodes = nodeGroup
      .selectAll('rect')
      .data(data.nodes.filter((n) => n.type === 'appointee'))
      .join('rect')
      .attr('width', (d: any) => appointeeSizeScale(d.net_worth_low || 0))
      .attr('height', (d: any) => appointeeSizeScale(d.net_worth_low || 0))
      .attr('x', (d: any) => -appointeeSizeScale(d.net_worth_low || 0) / 2)
      .attr('y', (d: any) => -appointeeSizeScale(d.net_worth_low || 0) / 2)
      .attr('rx', (d: any) => appointeeSizeScale(d.net_worth_low || 0) * 0.25)
      .attr('fill', (d: any) => getAgencyColor(d.agency || 'Unknown'))
      .attr('fill-opacity', 0.7)
      .attr('stroke', 'none')
      .attr('cursor', 'pointer')
      .call(drag(simulation) as any)

    const node = nodeGroup.selectAll<SVGElement, GraphNode>('circle, rect')
    nodeSelection = node

    const entityLabel = g
      .append('g')
      .selectAll('text')
      .data(data.nodes.filter((n) => n.type === 'entity' && (n.count || 0) >= 20))
      .join('text')
      .text((d: any) => {
        const name = d.name.length > 25 ? d.name.slice(0, 25) + '…' : d.name
        return name
      })
      .attr('font-size', 7)
      .attr('font-family', 'JetBrains Mono, monospace')
      .attr('fill', '#888')
      .attr('text-anchor', 'middle')
      .attr('dy', -10)
      .attr('pointer-events', 'none')
    labelSelection = entityLabel

    const tooltip = d3.select(container).append('div').attr('class', 'tooltip').style('opacity', 0)

    node
      .on('mouseover', function (event: MouseEvent, d: any) {
        const lines: string[] = []
        if (d.type === 'entity') {
          lines.push(`<strong>${d.name}</strong>`)
          lines.push(
            `${d.category?.replace('_', ' ') || 'entity'} · ${d.count || 0} appointees · ${formatMoney(d.total_value)}`,
          )
        } else {
          lines.push(`<strong>${d.name}</strong>`)
          if (d.title) lines.push(d.title)
          if (d.agency) lines.push(d.agency)
          if (d.net_worth_low) lines.push(formatMoney(d.net_worth_low))
        }
        const [mx, my] = d3.pointer(event, container)
        tooltip
          .html(lines.join('<br>'))
          .style('left', mx + 12 + 'px')
          .style('top', my - 10 + 'px')
          .style('opacity', 1)
      })
      .on('mousemove', function (event: MouseEvent) {
        const [mx, my] = d3.pointer(event, container)
        tooltip.style('left', mx + 12 + 'px').style('top', my - 10 + 'px')
      })
      .on('mouseout', function () {
        tooltip.style('opacity', 0)
      })

    node.on('click', function (_event: MouseEvent, d: any) {
      _event.stopPropagation()
      selected = d
      tooltip.style('opacity', 0)
      const connected = new Set<string>()
      const hv: Record<string, number> = {}
      data.links.forEach((l: any) => {
        if (l.source.id === d.id) {
          connected.add(l.target.id)
          hv[l.target.id] = l.value || 0
        }
        if (l.target.id === d.id) {
          connected.add(l.source.id)
          hv[l.source.id] = l.value || 0
        }
      })
      holdingValues = hv

      if (d.type === 'entity') {
        connectedAppointees = data.nodes.filter(
          (n) => connected.has(n.id) && n.type === 'appointee',
        )
      } else {
        connectedAppointees = data.nodes.filter((n) => connected.has(n.id))
      }

      node.attr('fill-opacity', (n: any) => (n.id === d.id || connected.has(n.id) ? 1 : 0.08))
      link
        .attr('stroke', (l: any) =>
          l.source.id === d.id || l.target.id === d.id ? '#d4a23a' : '#333',
        )
        .attr('stroke-opacity', (l: any) =>
          l.source.id === d.id || l.target.id === d.id ? 0.6 : 0.03,
        )
        .attr('stroke-width', (l: any) =>
          l.source.id === d.id || l.target.id === d.id ? 1.5 : 0.5,
        )
      entityLabel.attr('opacity', (n: any) => (n.id === d.id || connected.has(n.id) ? 1 : 0.1))
    })

    svg.on('click', function (event: MouseEvent) {
      if (event.target === svg.node()) {
        clearSelection()
      }
    })

    simulation.on('tick', () => {
      link
        .attr('x1', (d: any) => d.source.x)
        .attr('y1', (d: any) => d.source.y)
        .attr('x2', (d: any) => d.target.x)
        .attr('y2', (d: any) => d.target.y)
      entityNodes.attr('cx', (d: any) => d.x).attr('cy', (d: any) => d.y)
      appointeeNodes.attr('transform', (d: any) => `translate(${d.x},${d.y}) rotate(45)`)
      entityLabel.attr('x', (d: any) => d.x).attr('y', (d: any) => d.y)
    })

    svg.call(
      d3
        .zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.3, 5])
        .on('zoom', (event) => {
          g.attr('transform', event.transform)
        }),
    )
  }

  onMount(async () => {
    try {
      const data = await loadData()
      loading = false
      renderGraph(data)
    } catch (e) {
      loading = false
      error = e instanceof Error ? e.message : String(e)
    }
  })

  // Toggle node/link visibility when filters change (no re-query)
  let mounted = false
  $effect(() => {
    // Read all filter fields to establish reactive dependencies
    void [
      filters.agencies.length,
      filters.categories.length,
      filters.valueMin,
      filters.valueMax,
      filters.search,
      filters.dateRange[0],
      filters.dateRange[1],
    ]
    if (!mounted) {
      mounted = true
      return
    }
    applyFilters()
  })

  function drag(sim: d3.Simulation<any, any>) {
    return d3
      .drag()
      .on('start', (event: any) => {
        if (!event.active) sim.alphaTarget(0.05).restart()
        event.subject.fx = event.subject.x
        event.subject.fy = event.subject.y
      })
      .on('drag', (event: any) => {
        event.subject.fx = event.x
        event.subject.fy = event.y
      })
      .on('end', (event: any) => {
        if (!event.active) sim.alphaTarget(0)
        event.subject.fx = null
        event.subject.fy = null
      })
  }

  function formatMoney(v: number | null | undefined): string {
    if (!v) return '—'
    if (v >= 1e9) return `$${(v / 1e9).toFixed(1)}B`
    if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`
    if (v >= 1e3) return `$${(v / 1e3).toFixed(0)}K`
    return `$${v}`
  }
</script>

<div class="relative h-[calc(100vh-200px)]">
  {#if loading}
    <div class="absolute inset-0 flex items-center justify-center">
      <p class="font-mono text-[11px] text-neutral-600">Loading DuckDB…</p>
    </div>
  {:else if error}
    <div class="absolute inset-0 flex items-center justify-center">
      <p class="font-mono text-[11px] text-red-400">{error}</p>
    </div>
  {:else}
    <!-- Stats bar -->
    <div class="absolute top-4 left-6 z-10 font-mono text-[10px] text-neutral-600 flex gap-6">
      <span><span class="text-gold-400">{stats.appointees}</span> appointees</span>
      <span><span class="text-neutral-400">{stats.entities}</span> shared entities</span>
      <span>{stats.links.toLocaleString()} connections</span>
    </div>

    <!-- Category legend -->
    <div class="absolute bottom-4 left-6 z-10 flex flex-wrap gap-3 font-mono text-[9px]">
      {#each Object.entries(categoryColors) as [cat, color]}
        <span class="flex items-center gap-1.5">
          <span class="w-2 h-2 rounded-full inline-block" style="background: {color}"></span>
          <span class="text-neutral-500">{cat.replace('_', ' ')}</span>
        </span>
      {/each}
      <span class="text-neutral-700 ml-2">click a node to inspect</span>
    </div>
  {/if}

  <div bind:this={container} class="w-full h-full"></div>

  <!-- Detail sidebar (overlay) -->
  {#if selected}
    <aside
      class="absolute top-0 right-0 h-full border-l border-neutral-800 bg-ink-900/95 backdrop-blur-sm overflow-y-auto p-5 z-20"
      style="width: clamp(240px, 320px, 30vw)"
    >
      <button
        class="absolute top-3 right-3 text-neutral-600 hover:text-neutral-400 font-mono text-xs"
        onclick={() => clearSelection()}
      >
        ESC
      </button>

      {#if selected.type === 'entity'}
        <div class="mb-1">
          <span
            class="inline-block px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-wider rounded"
            style="background: {categoryColors[
              selected.category || 'other'
            ]}22; color: {categoryColors[selected.category || 'other']}"
          >
            {selected.category?.replace('_', ' ') || 'entity'}
          </span>
        </div>
        <h3 class="font-serif text-xl text-neutral-100 leading-tight mb-1">{selected.name}</h3>
        <p class="font-mono text-[11px] text-neutral-500 mb-1">
          Shared by <span class="text-gold-400">{selected.count}</span> appointees
        </p>
        <p class="font-mono text-[11px] text-neutral-500 mb-4">
          Aggregate value: <span class="text-gold-400">{formatMoney(selected.total_value)}</span>
        </p>

        <h4 class="font-mono text-[10px] text-neutral-600 uppercase tracking-wider mb-2">
          Appointees
        </h4>
        <div class="space-y-2">
          {#each connectedAppointees.toSorted((a, b) => (holdingValues[b.id] || 0) - (holdingValues[a.id] || 0)) as a}
            <div
              class="border-l-2 pl-5 py-1 -ml-5"
              style="border-color: {getAgencyColor(a.agency || 'Unknown')}"
            >
              <p class="font-sans text-sm text-neutral-200">{a.name}</p>
              <p class="font-mono text-[10px] text-neutral-500">{a.title}</p>
              <p class="font-mono text-[10px] text-neutral-600">
                {a.agency} &middot;
                <span class="text-gold-400">{formatMoney(holdingValues[a.id])}</span>
              </p>
            </div>
          {/each}
        </div>
      {:else}
        <h3 class="font-serif text-xl text-neutral-100 leading-tight mb-1">{selected.name}</h3>
        <p class="font-mono text-[11px] text-neutral-500">{selected.title}</p>
        <p class="font-mono text-[11px] text-neutral-600 mb-1">{selected.agency}</p>
        <p class="font-mono text-[11px] text-gold-400 mb-4">
          {formatMoney(selected.net_worth_low)}
        </p>

        <h4 class="font-mono text-[10px] text-neutral-600 uppercase tracking-wider mb-2">
          Shared Holdings
        </h4>
        <div class="space-y-1.5">
          {#each connectedAppointees as entity}
            <div class="flex items-start gap-2">
              <span
                class="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0"
                style="background: {categoryColors[entity.category || 'other']}"
              ></span>
              <div>
                <p class="font-sans text-xs text-neutral-300">{entity.name}</p>
                {#if holdingValues[entity.id]}
                  <p class="font-mono text-[9px] text-gold-400">{formatMoney(holdingValues[entity.id])}</p>
                {/if}
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </aside>
  {/if}
</div>
