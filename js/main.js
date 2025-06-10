// Function to get container dimensions
function getContainerDimensions() {
    const container = document.getElementById('map-container');
    return {
        width: container.clientWidth,
        height: container.clientHeight
    };
}

// Function to identify small countries
function isSmallCountry(d) {
    const area = d3.geoArea(d);
    return area < 0.0007; // Fine-tuned threshold for small territories
}

// Function to calculate font size based on country area
function getCountryFontSize(d) {
    const area = d3.geoArea(d);
    return Math.max(6, Math.min(12, 6 + area * 1000));
}

// Function to get largest polygon bounds
function getLargestPolygonBounds(d) {
    if (d.geometry.type === 'MultiPolygon') {
        let maxArea = 0;
        let largestBounds = null;
        
        d.geometry.coordinates.forEach(polygon => {
            const feature = {
                type: "Feature",
                geometry: {
                    type: "Polygon",
                    coordinates: polygon
                }
            };
            const bounds = pathGenerator.bounds(feature);
            const area = Math.abs(d3.polygonArea(polygon[0]));
            
            if (area > maxArea) {
                maxArea = area;
                largestBounds = bounds;
            }
        });
        
        return largestBounds;
    }
    
    return pathGenerator.bounds(d);
}

// Function to handle country selection
function selectCountry(d) {
    // Reset any previously selected country
    g.selectAll('.country').classed('selected', false);
    g.selectAll('.country').classed('hover', false);
    
    // Highlight selected country
    d3.select(event.target).classed('selected', true);

    // Dispatch country selection event
    window.dispatchEvent(new CustomEvent('countrySelect', {
        detail: { country: d }
    }));

    // Get bounds for zooming
    const bounds = getLargestPolygonBounds(d);
    const dx = bounds[1][0] - bounds[0][0];
    const dy = bounds[1][1] - bounds[0][1];
    const x = (bounds[0][0] + bounds[1][0]) / 2;
    const y = (bounds[0][1] + bounds[1][1]) / 2;

    // Get container dimensions
    const { width, height } = getContainerDimensions();
    
    // Calculate appropriate scale with padding
    const scale = Math.min(6, Math.max(1, 0.9 * Math.min(width / dx, height / dy)));
    const translate = [width / 2 - scale * x, height / 2 - scale * y];

    // Apply the zoom transition
    svg.transition()
        .duration(750)
        .call(zoom.transform, 
            d3.zoomIdentity
                .translate(translate[0], translate[1])
                .scale(scale)
        );
}

// Function to calculate label position
function getLabelPosition(d) {
    if (d.geometry.type === 'MultiPolygon') {
        let maxArea = 0;
        let largestPolygon = d.geometry.coordinates[0];
        
        d.geometry.coordinates.forEach(polygon => {
            const area = Math.abs(d3.polygonArea(polygon[0]));
            if (area > maxArea) {
                maxArea = area;
                largestPolygon = polygon;
            }
        });
        
        const centroid = d3.polygonCentroid(largestPolygon[0]);
        return projection(centroid);
    }
    
    return pathGenerator.centroid(d);
}

// Create zoom behavior
const zoom = d3.zoom()
    .scaleExtent([0.5, 8])
    .on('zoom', (event) => {
        g.attr('transform', event.transform);
        // Scale text labels inversely to maintain consistent size
        g.selectAll('.country-label')
            .each(function(d) {
                const baseSize = getCountryFontSize(d);
                d3.select(this).style('font-size', `${baseSize / event.transform.k}px`);
            });
    });

// Function to reset zoom and hide panels
function resetZoom() {
    // Reset map transform
    svg.transition()
        .duration(750)
        .call(zoom.transform, d3.zoomIdentity);
    
    // Reset country selection
    g.selectAll('.country').classed('selected', false);
    
    // Dispatch custom event to hide panels
    window.dispatchEvent(new CustomEvent('resetView'));
}

// Function to update map dimensions and projection
function updateMap(countries) {
    const { width, height } = getContainerDimensions();
    
    svg.attr('width', width)
       .attr('height', height);
    
    const scale = Math.min(width, height) * 0.9;
    projection
        .center([20, 52])
        .scale(scale)
        .translate([width / 2, height / 2]);
    
    g.selectAll('path')
        .attr('d', pathGenerator);
    
    g.selectAll('.country-label')
        .attr('x', d => getLabelPosition(d)[0])
        .attr('y', d => getLabelPosition(d)[1])
        .style('font-size', d => `${getCountryFontSize(d)}px`);
}

// Create SVG container with background click handler
const svg = d3.select('#map-container')
    .append('svg')
    .call(zoom)
    .on('click', (event) => {
        if (event.target.tagName === 'svg') {
            resetZoom();
        }
    });

const g = svg.append('g');
const projection = d3.geoMercator();
const pathGenerator = d3.geoPath().projection(projection);

// Add resize handler
window.addEventListener('resize', () => {
    if (window.countries) {
        updateMap(window.countries);
    }
});

// Load and display the map
d3.json('data/maps/europe-countries.json').then(data => {
    const countries = topojson.feature(data, data.objects.europeUltra);
    window.countries = countries;
    
    updateMap(countries);
    
    // Create tooltip
    const tooltip = d3.select('#map-container')
        .append('div')
        .attr('class', 'tooltip')
        .style('opacity', 0);

    // Draw countries
    g.selectAll('path')
        .data(countries.features)
        .enter()
        .append('path')
        .attr('class', 'country')
        .attr('d', pathGenerator)
        .on('click', (event, d) => {
            event.stopPropagation();
            selectCountry(d);
        })
        .on('mouseover', (event, d) => {
            const path = d3.select(event.target);
            if (!path.classed('selected')) {
                path.classed('hover', true);
            }
            if (isSmallCountry(d)) {
                tooltip.transition()
                    .duration(200)
                    .style('opacity', 1);
                tooltip.html(d.properties.name)
                    .style('left', (event.pageX + 10) + 'px')
                    .style('top', (event.pageY - 25) + 'px');
            }
        })
        .on('mouseout', (event) => {
            const path = d3.select(event.target);
            if (!path.classed('selected')) {
                path.classed('hover', false);
            }
            tooltip.transition()
                .duration(500)
                .style('opacity', 0);
        });

    // Add country labels
    g.selectAll('.country-label')
        .data(countries.features.filter(d => !isSmallCountry(d)))
        .enter()
        .append('text')
        .attr('class', 'country-label')
        .attr('x', d => getLabelPosition(d)[0])
        .attr('y', d => getLabelPosition(d)[1])
        .style('text-anchor', 'middle')
        .style('alignment-baseline', 'middle')
        .style('font-size', d => `${getCountryFontSize(d)}px`)
        .each(function(d) {
            const words = d.properties.name.split(' ');
            if (words.length > 1) {
                const text = d3.select(this);
                text.text('');
                const lineHeight = 1.2;
                const totalHeight = (words.length - 1) * lineHeight;
                words.forEach((word, i) => {
                    text.append('tspan')
                        .attr('x', getLabelPosition(d)[0])
                        .attr('dy', i === 0 ? `-${totalHeight/2}em` : `${lineHeight}em`)
                        .text(word);
                });
            } else {
                d3.select(this).text(d.properties.name);
            }
        });
}).catch(error => {
    console.error('Error loading the map data:', error);
});
