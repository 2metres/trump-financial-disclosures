<script lang="ts">
  import { onMount } from 'svelte'
  import * as d3 from 'd3'

  interface GraphNode {
    id: string; type: string; name: string; agency?: string;
    title?: string; net_worth_low?: number; count?: number; category?: string;
    total_value?: number;
    x?: number; y?: number; fx?: number | null; fy?: number | null;
  }
  interface GraphLink { source: any; target: any }

  const categoryColors: Record<string, string> = {
    political: '#c2342d',
    policy: '#e07c3e',
    crypto: '#22d3ee',
    finance: '#a78bfa',
    pharma: '#4ade80',
    tech: '#3b82f6',
    energy: '#d4a23a',
    telecom: '#f472b6',
    consumer: '#fb923c',
    government: '#6ee7b7',
    real_assets: '#a3a3a3',
    other: '#525252',
  }

  const agencyColorMap: Record<string, string> = {}
  const agencyPalette = [
    '#e07c3e', '#4a7fd4', '#2d8a6e', '#9b59b6', '#d4a23a',
    '#3498db', '#1abc9c', '#e74c3c', '#8e6cb8', '#27ae60',
    '#c0392b', '#2980b9', '#f39c12', '#16a085', '#d35400',
  ]

  function getAgencyColor(agency: string): string {
    if (!agencyColorMap[agency]) {
      agencyColorMap[agency] = agencyPalette[Object.keys(agencyColorMap).length % agencyPalette.length]
    }
    return agencyColorMap[agency]
  }

  let container: HTMLDivElement
  let selected = $state<GraphNode | null>(null)
  let connectedAppointees = $state<GraphNode[]>([])
  let allData: { nodes: GraphNode[]; links: GraphLink[] } | null = null
  let stats = $state({ nodes: 0, links: 0, entities: 0, appointees: 0 })

  // Store refs for resetting highlights from outside D3
  let nodeSelection: d3.Selection<any, any, any, any>
  let linkSelection: d3.Selection<any, any, any, any>
  let labelSelection: d3.Selection<any, any, any, any>

  function clearSelection() {
    selected = null
    connectedAppointees = []
    if (nodeSelection) nodeSelection.attr('fill-opacity', (d: any) => d.type === 'entity' ? 0.85 : 0.7)
    if (linkSelection) linkSelection.attr('stroke', '#333').attr('stroke-opacity', 0.12).attr('stroke-width', 0.5)
    if (labelSelection) labelSelection.attr('opacity', 1)
  }

  onMount(async () => {
    const res = await fetch('/data/bipartite.json')
    const data: { nodes: GraphNode[]; links: GraphLink[] } = await res.json()
    allData = data

    stats = {
      nodes: data.nodes.length,
      links: data.links.length,
      entities: data.nodes.filter(n => n.type === 'entity').length,
      appointees: data.nodes.filter(n => n.type === 'appointee').length,
    }

    const width = container.clientWidth
    const height = Math.max(700, window.innerHeight - 200)

    const svg = d3.select(container)
      .append('svg')
      .attr('width', width)
      .attr('height', height)

    const g = svg.append('g')

    // Value-based radius scale for entity nodes
    const valueExtent = d3.extent(data.nodes.filter(n => n.type === 'entity'), (n: any) => n.total_value || 0) as [number, number]
    const radiusScale = d3.scaleSqrt().domain([0, valueExtent[1]]).range([4, 24])

    const simulation = d3.forceSimulation(data.nodes as any)
      .force('link', d3.forceLink(data.links as any).id((d: any) => d.id).distance(60).strength(0.15))
      .force('charge', d3.forceManyBody().strength((d: any) => d.type === 'entity' ? -50 : -10))
      .force('x', d3.forceX(width / 2).strength(0.04))
      .force('y', d3.forceY(height / 2).strength(0.04))
      .force('collision', d3.forceCollide().radius((d: any) => d.type === 'entity' ? radiusScale(d.total_value || 0) + 2 : 4))

    const link = g.append('g')
      .selectAll('line')
      .data(data.links)
      .join('line')
      .attr('stroke', '#333')
      .attr('stroke-opacity', 0.12)
      .attr('stroke-width', 0.5)
    linkSelection = link

    const nodeGroup = g.append('g')

    // Entity nodes: circles sized by total dollar value
    const entityNodes = nodeGroup.selectAll('circle')
      .data(data.nodes.filter(n => n.type === 'entity'))
      .join('circle')
      .attr('r', (d: any) => radiusScale(d.total_value || 0))
      .attr('fill', (d: any) => categoryColors[d.category || 'other'] || '#737373')
      .attr('fill-opacity', 0.85)
      .attr('stroke', 'none')
      .attr('cursor', 'pointer')
      .call(drag(simulation) as any)

    // Appointee nodes: squircle-diamonds (rounded rect rotated 45°)
    const appointeeNodes = nodeGroup.selectAll('rect')
      .data(data.nodes.filter(n => n.type === 'appointee'))
      .join('rect')
      .attr('width', 6).attr('height', 6)
      .attr('x', -3).attr('y', -3)
      .attr('rx', 1.5)
      .attr('fill', (d: any) => getAgencyColor(d.agency || 'Unknown'))
      .attr('fill-opacity', 0.7)
      .attr('stroke', 'none')
      .attr('cursor', 'pointer')
      .call(drag(simulation) as any)

    // Combined selection for shared event handling
    const node = nodeGroup.selectAll<SVGElement, GraphNode>('circle, rect')
    nodeSelection = node

    // Entity labels for large nodes
    const entityLabel = g.append('g')
      .selectAll('text')
      .data(data.nodes.filter(n => n.type === 'entity' && (n.count || 0) >= 20))
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

    // Hover tooltip
    const tooltip = d3.select(container)
      .append('div')
      .attr('class', 'tooltip')
      .style('opacity', 0)

    node.on('mouseover', function(event: MouseEvent, d: any) {
      const lines: string[] = []
      if (d.type === 'entity') {
        lines.push(`<strong>${d.name}</strong>`)
        lines.push(`${d.category?.replace('_', ' ') || 'entity'} · ${d.count || 0} appointees · ${formatMoney(d.total_value)}`)
      } else {
        lines.push(`<strong>${d.name}</strong>`)
        if (d.title) lines.push(d.title)
        if (d.agency) lines.push(d.agency)
        if (d.net_worth_low) lines.push(formatMoney(d.net_worth_low))
      }
      const [mx, my] = d3.pointer(event, container)
      tooltip.html(lines.join('<br>'))
        .style('left', (mx + 12) + 'px')
        .style('top', (my - 10) + 'px')
        .style('opacity', 1)
    })
    .on('mousemove', function(event: MouseEvent) {
      const [mx, my] = d3.pointer(event, container)
      tooltip
        .style('left', (mx + 12) + 'px')
        .style('top', (my - 10) + 'px')
    })
    .on('mouseout', function() {
      tooltip.style('opacity', 0)
    })

    // Click to select
    node.on('click', function(_event: MouseEvent, d: any) {
      _event.stopPropagation()
      selected = d
      tooltip.style('opacity', 0)
      // Find connected nodes
      const connected = new Set<string>()
      data.links.forEach((l: any) => {
        if (l.source.id === d.id) connected.add(l.target.id)
        if (l.target.id === d.id) connected.add(l.source.id)
      })

      if (d.type === 'entity') {
        connectedAppointees = data.nodes.filter(n => connected.has(n.id) && n.type === 'appointee')
      } else {
        connectedAppointees = data.nodes.filter(n => connected.has(n.id))
      }

      // Highlight
      node.attr('fill-opacity', (n: any) => (n.id === d.id || connected.has(n.id)) ? 1 : 0.08)
      link
        .attr('stroke', (l: any) => (l.source.id === d.id || l.target.id === d.id) ? '#d4a23a' : '#333')
        .attr('stroke-opacity', (l: any) => (l.source.id === d.id || l.target.id === d.id) ? 0.6 : 0.03)
        .attr('stroke-width', (l: any) => (l.source.id === d.id || l.target.id === d.id) ? 1.5 : 0.5)
      entityLabel.attr('opacity', (n: any) => (n.id === d.id || connected.has(n.id)) ? 1 : 0.1)
    })

    // Click background to deselect
    svg.on('click', function(event: MouseEvent) {
      if (event.target === svg.node()) {
        clearSelection()
      }
    })

    simulation.on('tick', () => {
      link
        .attr('x1', (d: any) => d.source.x).attr('y1', (d: any) => d.source.y)
        .attr('x2', (d: any) => d.target.x).attr('y2', (d: any) => d.target.y)
      entityNodes.attr('cx', (d: any) => d.x).attr('cy', (d: any) => d.y)
      appointeeNodes.attr('transform', (d: any) => `translate(${d.x},${d.y}) rotate(45)`)
      entityLabel.attr('x', (d: any) => d.x).attr('y', (d: any) => d.y)
    })

    svg.call(d3.zoom<SVGSVGElement, unknown>().scaleExtent([0.3, 5]).on('zoom', (event) => {
      g.attr('transform', event.transform)
    }))
  })

  function drag(simulation: d3.Simulation<any, any>) {
    return d3.drag()
      .on('start', (event: any) => { if (!event.active) simulation.alphaTarget(0.3).restart(); event.subject.fx = event.subject.x; event.subject.fy = event.subject.y })
      .on('drag', (event: any) => { event.subject.fx = event.x; event.subject.fy = event.y })
      .on('end', (event: any) => { if (!event.active) simulation.alphaTarget(0); event.subject.fx = null; event.subject.fy = null })
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

  <div bind:this={container} class="w-full h-full"></div>

  <!-- Detail sidebar (overlay) -->
  {#if selected}
    <aside class="absolute top-0 right-0 h-full border-l border-neutral-800 bg-ink-900/95 backdrop-blur-sm overflow-y-auto p-5 z-20" style="width: clamp(240px, 320px, 30vw)">
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
            style="background: {categoryColors[selected.category || 'other']}22; color: {categoryColors[selected.category || 'other']}"
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

        <h4 class="font-mono text-[10px] text-neutral-600 uppercase tracking-wider mb-2">Appointees</h4>
        <div class="space-y-2">
          {#each connectedAppointees.toSorted((a, b) => (b.net_worth_low || 0) - (a.net_worth_low || 0)) as a}
            <div class="border-l-2 pl-3 py-1" style="border-color: {getAgencyColor(a.agency || 'Unknown')}">
              <p class="font-sans text-sm text-neutral-200">{a.name}</p>
              <p class="font-mono text-[10px] text-neutral-500">{a.title}</p>
              <p class="font-mono text-[10px] text-neutral-600">{a.agency} &middot; {formatMoney(a.net_worth_low)}</p>
            </div>
          {/each}
        </div>

      {:else}
        <h3 class="font-serif text-xl text-neutral-100 leading-tight mb-1">{selected.name}</h3>
        <p class="font-mono text-[11px] text-neutral-500">{selected.title}</p>
        <p class="font-mono text-[11px] text-neutral-600 mb-1">{selected.agency}</p>
        <p class="font-mono text-[11px] text-gold-400 mb-4">{formatMoney(selected.net_worth_low)}</p>

        <h4 class="font-mono text-[10px] text-neutral-600 uppercase tracking-wider mb-2">Shared Holdings</h4>
        <div class="space-y-1.5">
          {#each connectedAppointees as entity}
            <div class="flex items-start gap-2">
              <span
                class="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0"
                style="background: {categoryColors[entity.category || 'other']}"
              ></span>
              <div>
                <p class="font-sans text-xs text-neutral-300">{entity.name}</p>
                {#if entity.count}
                  <p class="font-mono text-[9px] text-neutral-600">{entity.count} appointees</p>
                {/if}
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </aside>
  {/if}
</div>

