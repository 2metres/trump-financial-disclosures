<script lang="ts">
  import * as d3 from 'd3'
  import { onDestroy, onMount } from 'svelte'
  import { holdingTypeColors, holdingTypeLabels, type HoldingType } from './db/holding-types'
  import { getDB } from './db/init'
  import { queryWealthData } from './db/wealth-queries'

  let container: HTMLDivElement
  let loading = $state(true)
  let error = $state<string | null>(null)
  let breadcrumb = $state<{ name: string; node: any }[]>([])

  function formatMoney(v: number): string {
    if (v >= 1e9) return `$${(v / 1e9).toFixed(1)}B`
    if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`
    if (v >= 1e3) return `$${(v / 1e3).toFixed(0)}K`
    return `$${v.toFixed(0)}`
  }

  function getColor(d: any): string {
    let node = d
    while (node) {
      if (node.data.type && holdingTypeColors[node.data.type as HoldingType]) {
        return holdingTypeColors[node.data.type as HoldingType]
      }
      node = node.parent
    }
    return '#525252'
  }

  function displayLabel(d: any): string {
    if (d.children && d.data.type && holdingTypeLabels[d.data.type as HoldingType]) {
      return holdingTypeLabels[d.data.type as HoldingType]
    }
    return d.data.name || ''
  }

  let renderFromBreadcrumb: (node: any) => void = () => {}

  function navigateTo(index: number) {
    breadcrumb = breadcrumb.slice(0, index + 1)
    renderFromBreadcrumb(breadcrumb[index].node)
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape' && breadcrumb.length > 1) {
      navigateTo(breadcrumb.length - 2)
    }
  }

  onMount(() => window.addEventListener('keydown', handleKeydown))
  onDestroy(() => window.removeEventListener('keydown', handleKeydown))

  onMount(async () => {
    try {
      const db = await getDB()
      const data = await queryWealthData(db)
      loading = false

      const width = container.clientWidth
      const height = Math.max(600, window.innerHeight - 200)

      d3.select(container).selectAll('*').remove()

      // Custom tile function from the canonical D3 zoomable treemap.
      // Normalizes child coordinates relative to the parent, enabling
      // zoom by simply changing the x/y scale domains.
      function tile(node: any, x0: number, y0: number, x1: number, y1: number) {
        d3.treemapBinary(node, 0, 0, width, height)
        for (const child of node.children) {
          child.x0 = x0 + (child.x0 / width) * (x1 - x0)
          child.x1 = x0 + (child.x1 / width) * (x1 - x0)
          child.y0 = y0 + (child.y0 / height) * (y1 - y0)
          child.y1 = y0 + (child.y1 / height) * (y1 - y0)
        }
      }

      const hierarchy = d3
        .hierarchy(data)
        .sum((d: any) => d.value ?? 0)
        .sort((a, b) => (b.value ?? 0) - (a.value ?? 0))

      const root = d3.treemap<any>().tile(tile).size([width, height]).round(true)(hierarchy)

      const x = d3.scaleLinear().rangeRound([0, width])
      const y = d3.scaleLinear().rangeRound([0, height])

      const svg = d3
        .select(container)
        .append('svg')
        .attr('width', width)
        .attr('height', height)
        .attr('viewBox', [0.5, 0.5, width, height].join(' '))
        .style('font-family', 'ui-monospace, monospace')

      const tooltip = d3
        .select(container)
        .append('div')
        .attr('class', 'tooltip')
        .style('opacity', 0)

      function positionTooltip(mx: number, my: number) {
        const flipX = mx > width / 2
        const tipNode = tooltip.node() as HTMLElement
        const tipW = tipNode?.offsetWidth || 0
        tooltip
          .style('left', (flipX ? mx - tipW - 12 : mx + 12) + 'px')
          .style('top', my - 10 + 'px')
      }

      // Set initial domain BEFORE first render so position() computes correct coords
      x.domain([root.x0, root.x1])
      y.domain([root.y0, root.y1])

      let group = svg.append('g').call(render, root)

      breadcrumb = [{ name: 'All Agencies', node: root }]

      function render(grp: any, focus: any) {
        const node = grp
          .selectAll('g')
          .data(focus.children || [])
          .join('g')

        // Cursor + click: children with sub-children zoom in
        node
          .filter((d: any) => d.children)
          .attr('cursor', 'pointer')
          .on('click', (event: MouseEvent, d: any) => {
            event.stopPropagation()
            tooltip.style('opacity', 0)
            zoomIn(d)
          })

        // Tooltip on all nodes
        node
          .on('mouseover', (event: MouseEvent, d: any) => {
            const label = displayLabel(d)
            const lines = [`<strong>${label}</strong>`]
            if (d.value) lines.push(formatMoney(d.value))
            if (d.data.agency) lines.push(`<span style="color:#888">${d.data.agency}</span>`)
            if (d.data.type) {
              const tl = holdingTypeLabels[d.data.type as HoldingType] || d.data.type
              const tc = holdingTypeColors[d.data.type as HoldingType] || '#888'
              if (tl !== label) lines.push(`<span style="color:${tc}">${tl}</span>`)
            }
            if (d.children) lines.push(`<span style="color:#666">${d.children.length} items</span>`)
            const [mx, my] = d3.pointer(event, container)
            tooltip.html(lines.join('<br>'))
            positionTooltip(mx, my)
            tooltip.style('opacity', 1)
          })
          .on('mousemove', (event: MouseEvent) => {
            const [mx, my] = d3.pointer(event, container)
            positionTooltip(mx, my)
          })
          .on('mouseout', () => tooltip.style('opacity', 0))

        // Rect per node
        node
          .append('rect')
          .attr('id', (d: any) => {
            d.leafUid = `leaf-${Math.random().toString(36).slice(2)}`
            return d.leafUid
          })
          .attr('fill', (d: any) => {
            const c = getColor(d)
            return c === '#525252' && d.children ? '#2a2a2a' : c
          })
          .attr('fill-opacity', (d: any) => (d.children ? 0.85 : 0.75))
          .attr('stroke', '#fff')
          .attr('stroke-width', 1)

        // ClipPath per node
        node
          .append('clipPath')
          .attr('id', (d: any) => {
            d.clipUid = `clip-${Math.random().toString(36).slice(2)}`
            return d.clipUid
          })
          .append('use')
          .attr('href', (d: any) => `#${d.leafUid}`)

        // Text with clip
        node
          .append('text')
          .attr('clip-path', (d: any) => `url(#${d.clipUid})`)
          .attr('font-weight', 500)
          .attr('fill', '#fff')
          .style('pointer-events', 'none')
          .selectAll('tspan')
          .data((d: any) => {
            const label = displayLabel(d)
            const val = d.value ? formatMoney(d.value) : ''
            return val ? [label, val] : [label]
          })
          .join('tspan')
          .attr('x', 4)
          .attr(
            'y',
            (_: any, i: number, nodes: any) =>
              `${(i === nodes.length - 1) * 0.3 + 1.1 + i * 1.2}em`,
          )
          .attr('fill-opacity', (_: any, i: number, nodes: any) =>
            i === nodes.length - 1 ? 0.6 : 0.9,
          )
          .attr('font-size', (_: any, i: number, nodes: any) =>
            i === nodes.length - 1 ? '9px' : '10px',
          )
          .text((d: any) => d)

        grp.call(position, focus)
      }

      function position(grp: any, _focus: any) {
        grp
          .selectAll('g')
          .attr('transform', (d: any) => `translate(${x(d.x0)},${y(d.y0)})`)
          .select('rect')
          .attr('width', (d: any) => x(d.x1) - x(d.x0))
          .attr('height', (d: any) => y(d.y1) - y(d.y0))
      }

      function zoomIn(d: any) {
        breadcrumb = [...breadcrumb, { name: displayLabel(d), node: d }]

        const group0 = group.attr('pointer-events', 'none')
        const group1 = (group = svg.append('g').call(render, d))

        x.domain([d.x0, d.x1])
        y.domain([d.y0, d.y1])

        svg
          .transition()
          .duration(750)
          .call((t: any) => group0.transition(t).remove().call(position, d.parent))
          .call((t: any) =>
            group1
              .transition(t)
              .attrTween('opacity', () => d3.interpolate(0, 1) as any)
              .call(position, d),
          )
      }

      function zoomOut(d: any) {
        const parent = d.parent
        if (!parent) return

        breadcrumb = breadcrumb.slice(0, -1)

        const group0 = group.attr('pointer-events', 'none')
        const group1 = (group = svg.insert('g', '*').call(render, parent))

        x.domain([parent.x0, parent.x1])
        y.domain([parent.y0, parent.y1])

        svg
          .transition()
          .duration(750)
          .call((t: any) =>
            group0
              .transition(t)
              .remove()
              .attrTween('opacity', () => d3.interpolate(1, 0) as any)
              .call(position, d),
          )
          .call((t: any) => group1.transition(t).call(position, parent))
      }

      renderFromBreadcrumb = (node: any) => {
        const group0 = group.attr('pointer-events', 'none')
        const group1 = (group = svg.append('g').call(render, node))

        x.domain([node.x0, node.x1])
        y.domain([node.y0, node.y1])

        svg
          .transition()
          .duration(750)
          .call((t: any) =>
            group0
              .transition(t)
              .remove()
              .attrTween('opacity', () => d3.interpolate(1, 0) as any),
          )
          .call((t: any) =>
            group1
              .transition(t)
              .attrTween('opacity', () => d3.interpolate(0, 1) as any)
              .call(position, node),
          )
      }
    } catch (e) {
      loading = false
      error = e instanceof Error ? e.message : String(e)
    }
  })
</script>

<div class="relative h-[calc(100vh-200px)]">
  {#if loading}
    <div class="absolute inset-0 flex items-center justify-center">
      <p class="font-mono text-[11px] text-neutral-600">Loading wealth data…</p>
    </div>
  {:else if error}
    <div class="absolute inset-0 flex items-center justify-center">
      <p class="font-mono text-[11px] text-red-400">{error}</p>
    </div>
  {:else}
    <!-- Breadcrumb -->
    <div
      class="border-b border-neutral-800 px-6 py-2.5 bg-ink-900/80 backdrop-blur-sm relative z-30"
    >
      <div class="max-w-8xl mx-auto flex items-center gap-1 font-mono text-[11px]">
        {#each breadcrumb as crumb, i}
          {#if i > 0}
            <span class="text-neutral-600">›</span>
          {/if}
          {#if i < breadcrumb.length - 1}
            <button
              class="text-neutral-500 hover:text-gold-400 transition-colors"
              onclick={() => navigateTo(i)}
            >
              {crumb.name}
            </button>
          {:else}
            <span class="text-gold-400">{crumb.name}</span>
          {/if}
        {/each}
      </div>
    </div>
  {/if}

  <div bind:this={container} class="w-full h-full"></div>
</div>

<style>
  :global(.tooltip) {
    position: absolute;
    background: rgba(10, 10, 10, 0.92);
    border: 1px solid #333;
    border-radius: 4px;
    padding: 6px 8px;
    font-family: ui-monospace, monospace;
    font-size: 11px;
    color: #e5e5e5;
    pointer-events: none;
    max-width: 300px;
    white-space: normal;
    word-wrap: break-word;
    line-height: 1.5;
    transition: opacity 0.1s;
    z-index: 50;
  }
</style>
