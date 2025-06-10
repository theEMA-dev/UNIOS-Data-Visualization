class MapOverlays {
    constructor() {
        this.eurostatAPI = new EurostatAPI();
        this.worldBankAPI = new WorldBankAPI();
        this.overlayData = {};
        this.activeOverlay = null;
        this.svg = null;
        this.countries = null;
        this.colors = {
            gdp: '#00a7e1',      // Teal
            inflation: '#fb7272', // Red  
            population: '#14cbb7' // Cyan
        };
        this.init();
    }

    init() {
        // Wait for map to be loaded
        this.waitForMap();
        this.createOverlayControls();
    }

    waitForMap() {
        const checkMap = () => {
            this.svg = d3.select('#map-container svg');
            this.countries = window.countries;
            
            if (this.svg.node() && this.countries) {
                this.setupOverlays();
            } else {
                setTimeout(checkMap, 100);
            }
        };
        checkMap();
    }

    createOverlayControls() {
        // Get all filter buttons
        const gdpButton = document.getElementById('filter-gdp');
        const inflationButton = document.getElementById('filter-inflation');
        const populationButton = document.getElementById('filter-population');
        const noneButton = document.getElementById('filter-none');
        
        // Store all buttons for easy access
        this.filterButtons = [gdpButton, inflationButton, populationButton, noneButton];
        
        // Add event listeners to buttons
        if (gdpButton) {
            gdpButton.addEventListener('click', () => this.handleButtonClick('gdp', gdpButton));
        }
        
        if (inflationButton) {
            inflationButton.addEventListener('click', () => this.handleButtonClick('inflation', inflationButton));
        }
        
        if (populationButton) {
            populationButton.addEventListener('click', () => this.handleButtonClick('population', populationButton));
        }
        
        if (noneButton) {
            noneButton.addEventListener('click', () => this.handleButtonClick('none', noneButton));
        }
    }
    
    handleButtonClick(overlayType, clickedButton) {
        // Remove active class from all buttons
        this.filterButtons.forEach(button => {
            if (button) {
                button.classList.remove('active');
            }
        });
        
        // Add active class to clicked button
        clickedButton.classList.add('active');
        
        // Toggle the overlay
        this.toggleOverlay(overlayType);
    }

    setupOverlays() {
        // Add overlay group to SVG - insert after country paths but before labels
        const g = this.svg.select('g');
        
        // Find the position to insert overlay group
        // We want overlays to be after country paths but before labels
        const countryLabels = g.selectAll('.country-label');
        
        if (countryLabels.size() > 0) {
            // Insert overlay group before the first label
            const firstLabel = countryLabels.node();
            this.overlayGroup = g.insert('g', function() { return firstLabel; })
                .attr('class', 'overlay-group');
        } else {
            // Fallback: append at the end
            this.overlayGroup = g.append('g')
                .attr('class', 'overlay-group');
        }
    }

    async toggleOverlay(overlayType) {
        if (overlayType === 'none') {
            this.clearOverlay();
            this.activeOverlay = null;
            return;
        }

        if (overlayType === this.activeOverlay) {
            return; // Already active
        }

        // Load data if not cached
        if (!this.overlayData[overlayType]) {
            await this.loadOverlayData(overlayType);
        }

        this.clearOverlay();
        this.renderOverlay(overlayType);
        this.activeOverlay = overlayType;
    }

    async loadOverlayData(overlayType) {
        console.log(`Loading ${overlayType} data...`);
        
        let data = {};
        
        // Try Eurostat batch first
        try {
            const eurostatCodes = this.countries.features
                .map(country => this.eurostatAPI.getCountryCode(country))
                .filter(code => code);
            
            console.log('Eurostat codes:', eurostatCodes);
            
            if (eurostatCodes.length > 0) {
                const eurostatData = await this.getBatchDataByType(this.eurostatAPI, eurostatCodes, overlayType);
                console.log('Eurostat data:', eurostatData);
                
                // Map back to original country codes
                this.countries.features.forEach(country => {
                    const eurostatCode = this.eurostatAPI.getCountryCode(country);
                    if (eurostatCode && eurostatData[eurostatCode] && eurostatData[eurostatCode].latest) {
                        data[country.properties.id] = eurostatData[eurostatCode].latest;
                        console.log(`Mapped ${country.properties.id} = ${eurostatData[eurostatCode].latest}`);
                    }
                });
            }
        } catch (error) {
            console.warn('Eurostat batch failed:', error);
        }

        // Try World Bank batch for remaining countries
        try {
            const remainingCountries = this.countries.features.filter(country => 
                !data[country.properties.id]
            );
            
            console.log('Remaining countries for World Bank:', remainingCountries.map(c => c.properties.name));
            
            const worldBankCodes = remainingCountries
                .map(country => this.worldBankAPI.getCountryCode(country))
                .filter(code => code);
            
            console.log('World Bank country codes:', worldBankCodes);
            
            if (worldBankCodes.length > 0) {
                const worldBankData = await this.getBatchDataByType(this.worldBankAPI, worldBankCodes, overlayType);
                console.log('World Bank data:', worldBankData);
                
                // Map back to original country codes
                remainingCountries.forEach(country => {
                    const worldBankCode = this.worldBankAPI.getCountryCode(country);
                    if (worldBankCode && worldBankData[worldBankCode] && worldBankData[worldBankCode].latest) {
                        data[country.properties.id] = worldBankData[worldBankCode].latest;
                        console.log(`World Bank mapped ${country.properties.id} = ${worldBankData[worldBankCode].latest}`);
                    }
                });
            }
        } catch (error) {
            console.warn('World Bank batch failed:', error);
        }

        this.overlayData[overlayType] = data;
        console.log(`Final ${overlayType} data:`, data);
        console.log(`${overlayType} data loaded for ${Object.keys(data).length} countries`);
        
        if (Object.keys(data).length === 0) {
            throw new Error(`No data available for ${overlayType}`);
        }
    }

    async getBatchDataByType(api, countryCodes, overlayType) {
        switch (overlayType) {
            case 'gdp':
                return await api.getBatchGDP(countryCodes);
            case 'inflation':
                return await api.getBatchInflation(countryCodes);
            case 'population':
                return await api.getBatchPopulation(countryCodes);
            default:
                throw new Error(`Unknown overlay type: ${overlayType}`);
        }
    }

    renderOverlay(overlayType) {
        console.log(`Rendering ${overlayType} overlay...`);
        console.log('Overlay group:', this.overlayGroup);
        
        const data = this.overlayData[overlayType];
        if (!data || Object.keys(data).length === 0) {
            console.warn(`No data available for ${overlayType} overlay`);
            return;
        }

        // Calculate min/max for relative scaling
        const values = Object.values(data).filter(v => v !== null && !isNaN(v));
        const min = Math.min(...values);
        const max = Math.max(...values);
        const range = max - min;
        
        console.log(`Value range: ${min} - ${max}`);

        // Create overlay paths
        this.overlayGroup.selectAll('.overlay-path').remove();
        
        const paths = this.overlayGroup.selectAll('.overlay-path')
            .data(this.countries.features)
            .enter()
            .append('path')
            .attr('class', 'overlay-path')
            .attr('d', d3.geoPath().projection(window.projection))
            .style('fill', this.colors[overlayType])
            .style('opacity', d => {
                const value = data[d.properties.id];
                if (value === undefined || value === null || isNaN(value)) {
                    return 0;
                }
                // Scale opacity from 0.1 to 0.8 based on relative value
                const normalizedValue = range > 0 ? (value - min) / range : 0;
                const opacity = 0.1 + (normalizedValue * 0.7);
                console.log(`${d.properties.id}: value=${value}, opacity=${opacity}`);
                return opacity;
            })
            .style('pointer-events', 'none');
            
        console.log(`Created ${paths.size()} overlay paths`);
    }

    clearOverlay() {
        if (this.overlayGroup) {
            this.overlayGroup.selectAll('.overlay-path').remove();
        }
    }
}

// Export for module usage
window.MapOverlays = MapOverlays;
