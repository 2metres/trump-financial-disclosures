<script lang="ts">
  import { onMount } from 'svelte'
  import * as d3 from 'd3'

  let container: HTMLDivElement
  let tooltip: HTMLDivElement
  let stats = $state({ nodes: 0, links: 0 })

  const palette = [
    '#d4a23a', '#c2342d', '#2d8a6e', '#4a7fd4', '#9b59b6',
    '#e07c3e', '#3498db', '#1abc9c', '#e74c3c', '#8e6cb8',
    '#27ae60', '#c0392b', '#2980b9', '#f39c12', '#16a085',
  ]
  const agencyColors: Record<string, string> = {}

  function getColor(agency: string): string {
    if (!agencyColors[agency]) {
      agencyColors[agency] = palette[Object.keys(agencyColors).length % palette.length]
    }
    return agencyColors[agency]
  }

  onMount(async () => {
    const res = await fetch('/data/network.json')
    const data: {
      nodes: { id: string; name: string; agency: string; title: string; net_worth_low: number }[]
      links: { source: string; target: string; weight: number }[]
    } = await res.json()

    stats = { nodes: data.nodes.length, links: data.links.length }

    const width = container.clientWidth
    const height = Math.max(700, window.innerHeight - 200)

    const maxWeight = d3.max(data.links, d => d.weight) || 1
    const weightScale = d3.scaleLinear().domain([1, maxWeight]).range([0.5, 4])

    const svg = d3.select(container)
      .append('svg')
      .attr('width', width)
      .attr('height', height)

    const simulation = d3.forceSimulation(data.nodes as any)
      .force('link', d3.forceLink(data.links as any).id((d: any) => d.id).distance(100).strength((d: any) => d.weight / maxWeight * 0.3))
      .force('charge', d3.forceManyBody().strength(-80))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(20))

    const link = svg.append('g')
      .selectAll('line')
      .data(data.links)
      .join('line')
      .attr('stroke', '#444')
      .attr('stroke-opacity', 0.3)
      .attr('stroke-width', (d: any) => weightScale(d.weight))

    const node = svg.append('g')
      .selectAll('circle')
      .data(data.nodes)
      .join('circle')
      .attr('r', 6)
      .attr('fill', (d: any) => getColor(d.agency))
      .attr('cursor', 'pointer')
      .call(drag(simulation) as any)

    const label = svg.append('g')
      .selectAll('text')
      .data(data.nodes)
      .join('text')
      .text((d: any) => d.name.split(' ').pop())
      .attr('font-size', 8)
      .attr('font-family', 'JetBrains Mono, monospace')
      .attr('fill', '#666')
      .attr('dx', 10)
      .attr('dy', 3)

    node.on('mouseover', function(event: MouseEvent, d: any) {
      d3.select(this).transition().duration(150).attr('r', 10).attr('stroke', '#d4a23a').attr('stroke-width', 2)

      const connected = new Set<string>()
      const weights: Record<string, number> = {}
      data.links.forEach((l: any) => {
        if (l.source.id === d.id) { connected.add(l.target.id); weights[l.target.id] = l.weight }
        if (l.target.id === d.id) { connected.add(l.source.id); weights[l.source.id] = l.weight }
      })

      link.attr('stroke', (l: any) => (l.source.id === d.id || l.target.id === d.id) ? '#d4a23a' : '#333')
        .attr('stroke-opacity', (l: any) => (l.source.id === d.id || l.target.id === d.id) ? 0.8 : 0.05)
      node.attr('opacity', (n: any) => (n.id === d.id || connected.has(n.id)) ? 1 : 0.1)
      label.attr('opacity', (n: any) => (n.id === d.id || connected.has(n.id)) ? 1 : 0.1)

      const connList = Array.from(connected).map(id => {
        const n = data.nodes.find((n: any) => n.id === id)
        return `${n?.name} (${weights[id]} shared)`
      }).slice(0, 8).join('<br/>')

      tooltip.innerHTML = `<strong>${d.name}</strong>${d.title}<br/>${d.agency}<br/><br/>${connList}`
      tooltip.style.display = 'block'
      tooltip.style.left = `${event.pageX + 12}px`
      tooltip.style.top = `${event.pageY - 12}px`
    })
    .on('mousemove', (event: MouseEvent) => {
      tooltip.style.left = `${event.pageX + 12}px`
      tooltip.style.top = `${event.pageY - 12}px`
    })
    .on('mouseout', function() {
      d3.select(this).transition().duration(300).attr('r', 6).attr('stroke', 'none')
      link.attr('stroke', '#444').attr('stroke-opacity', 0.3)
      node.attr('opacity', 1)
      label.attr('opacity', 1)
      tooltip.style.display = 'none'
    })

    simulation.on('tick', () => {
      link.attr('x1', (d: any) => d.source.x).attr('y1', (d: any) => d.source.y)
        .attr('x2', (d: any) => d.target.x).attr('y2', (d: any) => d.target.y)
      node.attr('cx', (d: any) => d.x).attr('cy', (d: any) => d.y)
      label.attr('x', (d: any) => d.x).attr('y', (d: any) => d.y)
    })

    svg.call(d3.zoom<SVGSVGElement, unknown>().scaleExtent([0.3, 5]).on('zoom', (event) => {
      svg.selectAll('g').attr('transform', event.transform)
    }))
  })

  function drag(simulation: d3.Simulation<any, any>) {
    return d3.drag()
      .on('start', (event: any) => { if (!event.active) simulation.alphaTarget(0.3).restart(); event.subject.fx = event.subject.x; event.subject.fy = event.subject.y })
      .on('drag', (event: any) => { event.subject.fx = event.x; event.subject.fy = event.y })
      .on('end', (event: any) => { if (!event.active) simulation.alphaTarget(0); event.subject.fx = null; event.subject.fy = null })
  }
</script>

<div class="relative">
  <div class="absolute top-4 left-6 z-10 font-mono text-[10px] text-neutral-600 flex gap-6">
    <span><span class="text-gold-400">{stats.nodes}</span> appointees</span>
    <span>{stats.links} connections weighted by shared holdings</span>
  </div>
  <div bind:this={container} class="w-full"></div>
  <div bind:this={tooltip} class="tooltip" style="display: none;"></div>
</div>
