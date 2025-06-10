class ChartUtils {
    constructor() {
        this.colors = {
            gdp: 'var(--teal-500)',
            inflation: 'var(--red-500)',
            unemployment: 'var(--pink-500)',
            population: 'var(--green-500)',
            axis: 'var(--text-300)',
            grid: 'var(--border-100)',
            text: 'var(--text-100)',
            background: 'var(--background-400)'
        };

        this.margins = {
            top: 20,
            right: 0,
            bottom: 10,
            left: 30
        };

        this.transition = {
            duration: 750,
            ease: d3.easeCubicInOut
        };
    }

    createLinearChart(container, data, options = {}) {
        const width = container.clientWidth;
        const height = container.clientHeight || 200;
        const chartWidth = width - this.margins.left - this.margins.right;
        const chartHeight = height - this.margins.top - this.margins.bottom;

        // Clear previous content
        container.innerHTML = '';

        // Create SVG
        const svg = d3.select(container)
            .append('svg')
            .attr('width', width)
            .attr('height', height)
            .append('g')
            .attr('transform', `translate(${this.margins.left},${this.margins.top})`);

        // Add clipping path
        svg.append('defs')
            .append('clipPath')
            .attr('id', 'chart-area')
            .append('rect')
            .attr('width', chartWidth)
            .attr('height', chartHeight);

        // Create scales
        const xScale = d3.scaleTime()
            .domain(d3.extent(data, d => d.date))
            .range([0, chartWidth]);

        const yScale = d3.scaleLinear()
            .domain([
                d3.min(data, d => d.value) * 0.95,
                d3.max(data, d => d.value) * 1.05
            ])
            .range([chartHeight, 0]);

        // Create grid
        this.createGrid(svg, xScale, yScale, chartWidth, chartHeight);

        // Create line
        const line = d3.line()
            .x(d => xScale(d.date))
            .y(d => yScale(d.value))
            .curve(d3.curveMonotoneX);

        // Create chart group with clipping
        const chartGroup = svg.append('g')
            .attr('clip-path', 'url(#chart-area)');

        // Add the line path with animation
        const path = chartGroup.append('path')
            .datum(data)
            .attr('class', 'line')
            .attr('fill', 'none')
            .attr('stroke', options.color || this.colors.gdp)
            .attr('stroke-width', 2)
            .attr('d', line);

        // Animate line drawing
        const length = path.node().getTotalLength();
        path.attr('stroke-dasharray', `${length} ${length}`)
            .attr('stroke-dashoffset', length)
            .transition()
            .duration(this.transition.duration)
            .ease(this.transition.ease)
            .attr('stroke-dashoffset', 0);

        // Create axes
        this.createAxes(svg, xScale, yScale, chartWidth, chartHeight, options);

        // Add hover effects
        this.createHoverEffects(svg, data, xScale, yScale, chartWidth, chartHeight, options);

        return svg;
    }

    createAxes(svg, xScale, yScale, chartWidth, chartHeight, options) {
        // Create X axis
        const xAxis = d3.axisBottom(xScale)
            .ticks(5)
            .tickSize(0);

        svg.append('g')
            .attr('class', 'x-axis')
            .attr('transform', `translate(0,${chartHeight})`)
            .call(xAxis)
            .call(g => g.select('.domain').attr('stroke', this.colors.axis))
            .call(g => g.selectAll('text')
                .attr('fill', this.colors.text)
                .style('font-family', 'Geist Mono')
                .style('font-size', '10px'));

        // Create Y axis
        const formatY = options.formatValue || (d => d.toLocaleString('en-US'));
        const yAxis = d3.axisLeft(yScale)
            .ticks(5)
            .tickSize(0)
            .tickFormat(formatY);

        svg.append('g')
            .attr('class', 'y-axis')
            .call(yAxis)
            .call(g => g.select('.domain').attr('stroke', this.colors.axis))
            .call(g => g.selectAll('text')
                .attr('fill', this.colors.text)
                .style('font-family', 'Geist Mono')
                .style('font-size', '10px'));
    }

    createGrid(svg, xScale, yScale, chartWidth, chartHeight) {
        // Add horizontal grid lines
        svg.append('g')
            .attr('class', 'grid')
            .selectAll('line')
            .data(yScale.ticks(5))
            .enter()
            .append('line')
            .attr('x1', 0)
            .attr('x2', chartWidth)
            .attr('y1', d => yScale(d))
            .attr('y2', d => yScale(d))
            .attr('stroke', this.colors.grid)
            .attr('stroke-opacity', 0.1);
    }

    createHoverEffects(svg, data, xScale, yScale, chartWidth, chartHeight, options) {
        const hoverGroup = svg.append('g')
            .attr('class', 'hover-group')
            .style('pointer-events', 'none');

        // Create hover line
        const hoverLine = hoverGroup.append('line')
            .attr('class', 'hover-line')
            .attr('y1', 0)
            .attr('y2', chartHeight)
            .style('stroke', this.colors.text)
            .style('stroke-width', 1)
            .style('stroke-dasharray', '3,3')
            .style('opacity', 0);

        // Create hover background for value
        const hoverBg = hoverGroup.append('rect')
            .attr('class', 'hover-bg')
            .attr('rx', 4)
            .attr('ry', 4)
            .style('fill', this.colors.background)
            .style('opacity', 0);

        // Create hover value
        const hoverValue = hoverGroup.append('text')
            .attr('class', 'hover-value')
            .attr('text-anchor', 'middle')
            .style('font-family', 'Geist Mono')
            .style('font-size', '12px')
            .style('fill', this.colors.text)
            .style('opacity', 0);

        // Create transparent hover area
        svg.append('rect')
            .attr('class', 'hover-area')
            .attr('width', chartWidth)
            .attr('height', chartHeight)
            .style('fill', 'none')
            .style('pointer-events', 'all')
            .on('mousemove', function(event) {
                const [x] = d3.pointer(event);
                const xDate = xScale.invert(x);
                const bisect = d3.bisector(d => d.date).left;
                const index = bisect(data, xDate);
                
                if (index > 0 && index < data.length) {
                    const d0 = data[index - 1];
                    const d1 = data[index];
                    const d = xDate - d0.date > d1.date - xDate ? d1 : d0;
                    const value = options.formatValue ? options.formatValue(d.value) : d.value.toLocaleString('en-US');
                    const xPos = xScale(d.date);
                    const yPos = yScale(d.value);

                    hoverLine
                        .attr('x1', xPos)
                        .attr('x2', xPos)
                        .style('opacity', 1);

                    hoverValue
                        .attr('x', xPos)
                        .attr('y', yPos - 15)
                        .text(value)
                        .style('opacity', 1);
                        
                    // Update background
                    const bbox = hoverValue.node().getBBox();
                    hoverBg
                        .attr('x', bbox.x - 6)
                        .attr('y', bbox.y - 4)
                        .attr('width', bbox.width + 12)
                        .attr('height', bbox.height + 8)
                        .style('opacity', 1);
                }
            })
            .on('mouseleave', () => {
                hoverLine.style('opacity', 0);
                hoverValue.style('opacity', 0);
                hoverBg.style('opacity', 0);
            });
    }
}

// Export for module usage
window.ChartUtils = ChartUtils;
