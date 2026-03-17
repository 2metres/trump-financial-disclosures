<script lang="ts">
  import { onMount } from 'svelte'
  import * as d3 from 'd3'

  let container: HTMLDivElement
  let tooltip: HTMLDivElement

  onMount(async () => {
    const res = await fetch('/data/tree.json')
    const treeData = await res.json()

    const size = Math.min(container.clientWidth, container.clientHeight || window.innerHeight - 200)
    const radius = size / 2 - 100

    const root = d3.hierarchy(treeData)
    const treeLayout = d3.tree<any>()
      .size([2 * Math.PI, radius])
      .separation((a, b) => (a.parent === b.parent ? 1 : 2) / a.depth)
    treeLayout(root)

    // Helper: polar → cartesian
    const px = (d: any) => d.y * Math.cos(d.x - Math.PI / 2)
    const py = (d: any) => d.y * Math.sin(d.x - Math.PI / 2)

    const svgEl = d3.select(container)
      .append('svg')
      .attr('width', size)
      .attr('height', size)

    // Inner g that zoom will transform
    const g = svgEl.append('g')
      .attr('transform', `translate(${size / 2},${size / 2})`)

    // Links
    g.selectAll('.link')
      .data(root.links())
      .join('path')
      .attr('class', 'link')
      .attr('d', d3.linkRadial<any, any>()
        .angle((d: any) => d.x)
        .radius((d: any) => d.y)
      )
      .attr('fill', 'none')
      .attr('stroke', '#333')
      .attr('stroke-opacity', 0.4)
      .attr('stroke-width', 0.5)

    // Nodes
    const node = g.selectAll('.node')
      .data(root.descendants())
      .join('g')
      .attr('class', 'node')
      .attr('transform', (d: any) => `translate(${px(d)},${py(d)})`)

    node.append('circle')
      .attr('r', (d: any) => d.depth === 0 ? 6 : d.depth === 1 ? 4 : 2.5)
      .attr('fill', (d: any) => {
        if (d.depth === 0) return '#d4a23a'
        if (d.depth === 1) return '#c2342d'
        return '#555'
      })
      .attr('stroke', (d: any) => d.depth <= 1 ? '#888' : 'none')
      .attr('stroke-width', 0.5)
      .attr('cursor', 'pointer')

    node.append('text')
      .attr('dy', '0.31em')
      .attr('transform', (d: any) => {
        if (d.depth === 0) return ''
        const angleDeg = (d.x * 180) / Math.PI - 90
        const flip = d.x > Math.PI
        const offset = d.depth === 1 ? 10 : 6
        const rotate = flip ? angleDeg + 180 : angleDeg
        return `rotate(${rotate}) translate(${flip ? -offset : offset},0)`
      })
      .attr('text-anchor', (d: any) => {
        if (d.depth === 0) return 'middle'
        return d.x > Math.PI ? 'end' : 'start'
      })
      .attr('font-size', (d: any) => d.depth === 0 ? 12 : d.depth === 1 ? 9 : 7)
      .attr('font-family', (d: any) => d.depth <= 1 ? 'JetBrains Mono, monospace' : 'DM Sans, sans-serif')
      .attr('fill', (d: any) => d.depth === 0 ? '#d4a23a' : d.depth === 1 ? '#999' : '#666')
      .text((d: any) => {
        const name = d.data.name || d.data.slug || ''
        const limit = d.depth === 1 ? 30 : 25
        return name.length > limit ? name.slice(0, limit) + '…' : name
      })

    node.on('mouseover', function(event: MouseEvent, d: any) {
      const data = d.data
      let html = `<strong>${data.name || data.slug}</strong>`
      if (data.title) html += `${data.title}`
      if (data.entities && data.entities.length > 0) {
        html += `<br/><br/>Top shared holdings:<br/>${data.entities.slice(0, 5).map((e: string) => `&middot; ${e}`).join('<br/>')}`
      }
      if (data.children) html += `<br/>${data.children.length} members`
      tooltip.innerHTML = html
      tooltip.style.display = 'block'
      tooltip.style.left = `${event.pageX + 12}px`
      tooltip.style.top = `${event.pageY - 12}px`
    })
    .on('mousemove', (event: MouseEvent) => {
      tooltip.style.left = `${event.pageX + 12}px`
      tooltip.style.top = `${event.pageY - 12}px`
    })
    .on('mouseout', () => { tooltip.style.display = 'none' })

    // Zoom — transform the inner g but reset its base translation
    svgEl.call(
      d3.zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.2, 6])
        .on('zoom', (event) => {
          g.attr('transform', event.transform.translate(size / 2, size / 2).toString())
        })
    )
  })
</script>

<div class="relative">
  <div class="absolute top-4 left-6 z-10 font-mono text-[10px] text-neutral-600 flex gap-6">
    <span><span class="text-blood-500">62</span> agencies</span>
    <span>→ appointees → shared entities</span>
    <span class="text-neutral-700">Scroll to explore &middot; Zoom with mousewheel</span>
  </div>
  <div bind:this={container} class="w-full" style="height: calc(100vh - 200px);"></div>
  <div bind:this={tooltip} class="tooltip" style="display: none;"></div>
</div>
