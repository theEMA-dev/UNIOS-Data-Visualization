class EconomicsModule {
    constructor() {
        this.panelLeft = null;
        this.panelRight = null;
        this.currentCountry = null;
        this.chartUtils = new ChartUtils();
        this.eurostatAPI = new EurostatAPI();
        this.worldBankAPI = new WorldBankAPI();
        this.dataSource = 'Eurostat'; // Track which API we're using
        this.init();
    }

    init() {
        // Create panels
        this.createPanels();
        
        // Listen for country selection without interfering with zoom
        window.addEventListener('countrySelect', (e) => {
            requestAnimationFrame(() => {
                this.currentCountry = e.detail.country;
                this.updatePanels(e.detail.country);
            });
        });

        // Listen for view reset
        window.addEventListener('resetView', () => {
            this.hidePanels();
        });
    }

    createPanels() {
        // Create left panel for GDP and general info
        this.panelLeft = document.createElement('div');
        this.panelLeft.className = 'data-panel panel-left';
        this.panelLeft.innerHTML = `
            <div class="panel-content">
                <div class="panel-header">
                    <h2 class="country-name"></h2>
                    <div class="key-metrics"></div>
                </div>
                <div class="chart-container gdp-chart">
                    <h3>GDP Trends</h3>
                    <div class="chart"></div>
                </div>
                <div class="chart-container inflation-chart">
                    <h3>Inflation Rate</h3>
                    <div class="chart"></div>
                </div>
            </div>
        `;

        // Create right panel for employment and population
        this.panelRight = document.createElement('div');
        this.panelRight.className = 'data-panel panel-right';
        this.panelRight.innerHTML = `
            <div class="panel-content">
                <div class="chart-container employment-chart">
                    <h3>Unemployment Rate</h3>
                    <div class="chart"></div>
                </div>
                <div class="chart-container population-chart">
                    <h3>Population Growth</h3>
                    <div class="chart"></div>
                </div>
                <div class="data-source">Data from Eurostat</div>
            </div>
        `;

        document.body.appendChild(this.panelLeft);
        document.body.appendChild(this.panelRight);
    }

    formatGDP(value) {
        if (value >= 1e6) {
            return `€${Math.round(value / 1e6)}T`;
        }
        return `€${Math.round(value / 1e3)}B`;
    }

    formatPopulation(value) {
        if (value >= 1e9) {
            return `${Math.round(value / 1e9)}B`;
        }
        return `${Math.round(value / 1e6)}M`;
    }

    async updatePanels(country) {
        // Show loading state
        this.showLoading();

        try {
            let data = null;
            let eurostatError = null;
            this.dataSource = 'Eurostat';
            
            // Try Eurostat first
            try {
                const countryCode = this.eurostatAPI.getCountryCode(country);
                if (!countryCode) {
                    throw new Error('Country not supported by Eurostat');
                }

                data = await Promise.all([
                    this.eurostatAPI.getGDP(countryCode),
                    this.eurostatAPI.getUnemployment(countryCode),
                    this.eurostatAPI.getInflation(countryCode),
                    this.eurostatAPI.getPopulation(countryCode)
                ]);
            } catch (error) {
                eurostatError = error;
                console.log('Eurostat API failed:', error);
            }

            // If Eurostat fails or returns no data, try World Bank
            if (!data) {
                console.log('Falling back to World Bank API...');
                this.dataSource = 'World Bank';
                
                const countryCode = this.worldBankAPI.getCountryCode(country);
                if (!countryCode) {
                    throw new Error('Country code not found for World Bank API');
                }

                try {
                    data = await Promise.all([
                        this.worldBankAPI.getGDP(countryCode),
                        this.worldBankAPI.getUnemployment(countryCode),
                        this.worldBankAPI.getInflation(countryCode),
                        this.worldBankAPI.getPopulation(countryCode)
                    ]);
                } catch (worldBankError) {
                    console.error('World Bank API failed:', worldBankError);
                    // If both APIs fail, throw the Eurostat error as primary
                    throw eurostatError || worldBankError;
                }
            }

            if (!data) {
                throw new Error('Failed to fetch data from both Eurostat and World Bank');
            }

            const [gdp, unemployment, inflation, population] = data;
            
            // Update country name and key metrics
            this.updateHeader(country.properties.name, {
                gdp,
                unemployment,
                inflation,
                population
            });

            // Create/update charts
            this.createGDPChart(gdp);
            this.createInflationChart(inflation);
            this.createEmploymentChart(unemployment);
            this.createPopulationChart(population);

            // Show panels with animation
            this.showPanels();
        } catch (error) {
            console.error('Error updating panels:', error);
            const errorMessage = error.message || 'Failed to load data';
            this.panelLeft.querySelector('.key-metrics').innerHTML = `
                <div class="error-message">${errorMessage}</div>
            `;
            this.showError();
        }
    }

    showLoading() {
        this.panelLeft.classList.add('loading');
        this.panelRight.classList.add('loading');
    }

    showError() {
        this.panelLeft.classList.add('error');
        this.panelRight.classList.add('error');
    }

    showPanels() {
        this.panelLeft.classList.remove('loading', 'error');
        this.panelRight.classList.remove('loading', 'error');
        this.panelLeft.classList.add('visible');
        this.panelRight.classList.add('visible');
    }

    hidePanels() {
        this.panelLeft.classList.remove('visible');
        this.panelRight.classList.remove('visible');
    }

    updateHeader(countryName, data) {
        const header = this.panelLeft.querySelector('.panel-header');
        header.querySelector('.country-name').textContent = countryName;
        
        // Update key metrics and show data source
        const metrics = header.querySelector('.key-metrics');
        const dataSource = this.panelRight.querySelector('.data-source');
        dataSource.textContent = `Data from ${this.dataSource}`;
        metrics.innerHTML = `
            <div class="metric">
                <span class="label">GDP</span>
                <span class="value">${this.formatGDP(data.gdp.latest)}</span>
            </div>
            <div class="metric">
                <span class="label">Population</span>
                <span class="value">${this.formatPopulation(data.population.latest)}</span>
            </div>
            <div class="metric">
                <span class="label">Unemployment</span>
                <span class="value">${data.unemployment.latest.toFixed(2)}%</span>
            </div>
        `;
    }

    createGDPChart(data) {
        const container = this.panelLeft.querySelector('.gdp-chart .chart');
        if (!data.historical || !data.historical.length) {
            container.innerHTML = '<div class="no-data">No historical GDP data available</div>';
            return;
        }

        this.chartUtils.createLinearChart(container, data.historical, {
            color: this.chartUtils.colors.gdp,
            formatValue: value => this.formatGDP(value)
        });
    }

    createInflationChart(data) {
        const container = this.panelLeft.querySelector('.inflation-chart .chart');
        if (!data.historical || !data.historical.length) {
            container.innerHTML = '<div class="no-data">No historical inflation data available</div>';
            return;
        }

        this.chartUtils.createLinearChart(container, data.historical, {
            color: this.chartUtils.colors.inflation,
            formatValue: value => `${value.toFixed(2)}%`
        });
    }

    createEmploymentChart(data) {
        const container = this.panelRight.querySelector('.employment-chart .chart');
        if (!data.historical || !data.historical.length) {
            container.innerHTML = '<div class="no-data">No historical unemployment data available</div>';
            return;
        }

        this.chartUtils.createLinearChart(container, data.historical, {
            color: this.chartUtils.colors.unemployment,
            formatValue: value => `${value.toFixed(2)}%`
        });
    }

    createPopulationChart(data) {
        const container = this.panelRight.querySelector('.population-chart .chart');
        if (!data.historical || !data.historical.length) {
            container.innerHTML = '<div class="no-data">No historical population data available</div>';
            return;
        }

        this.chartUtils.createLinearChart(container, data.historical, {
            color: this.chartUtils.colors.population,
            formatValue: value => this.formatPopulation(value)
        });
    }

    cleanup() {
        // Remove panels when switching modules
        this.panelLeft.remove();
        this.panelRight.remove();
    }
}

// Export for module usage
window.EconomicsModule = EconomicsModule;
