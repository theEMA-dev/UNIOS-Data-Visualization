class EurostatAPI {
    constructor() {
        this.baseURL = 'https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data';
        this.datasets = {
            gdp: 'nama_10_gdp', // GDP and main components
            unemployment: 'une_rt_m', // Monthly unemployment rate
            inflation: 'prc_hicp_manr', // HICP monthly annual rate
            population: 'demo_pjan' // Population on January 1st
        };
    }

    async fetchData(dataset, params = {}) {
        try {
            // Build query parameters
            const queryParams = new URLSearchParams({
                ...params,
                format: 'json',
                lang: 'en'
            });

            const response = await fetch(`${this.baseURL}/${dataset}?${queryParams}`);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            return this.processData(data);
        } catch (error) {
            console.error('Error fetching Eurostat data:', error);
            throw error;
        }
    }

    async getGDP(countryCode) {
        const params = {
            na_item: 'B1GQ', // Total GDP
            unit: 'CP_MEUR', // Current prices, million euro
            geo: countryCode
        };
        return this.fetchData(this.datasets.gdp, params);
    }

    async getUnemployment(countryCode) {
        const params = {
            age: 'TOTAL',
            unit: 'PC_ACT', // Percentage of active population
            s_adj: 'SA', // Seasonally adjusted
            geo: countryCode
        };
        return this.fetchData(this.datasets.unemployment, params);
    }

    async getInflation(countryCode) {
        const params = {
            geo: countryCode,
            coicop: 'CP00', // All items HICP
        };
        return this.fetchData(this.datasets.inflation, params);
    }

    async getPopulation(countryCode) {
        const params = {
            sex: 'T', // Total
            age: 'TOTAL',
            geo: countryCode
        };
        return this.fetchData(this.datasets.population, params);
    }

    processData(response) {
        // Check if there's actual data in the response
        if (!response.value || Object.keys(response.value).length === 0) {
            throw new Error('No data available in response');
        }

        const dimension = response.dimension;
        const values = response.value;
        const timeIndex = dimension.time.category.index;
        const data = [];

        // Check if we have values that aren't in the "positions-with-no-data" list
        const noDataPositions = response.extension?.['positions-with-no-data']?.time || [];
        const hasValidData = Object.values(values).some(v => v !== null && !isNaN(v));

        if (!hasValidData) {
            throw new Error('No valid data available');
        }

        Object.entries(timeIndex).forEach(([time, index]) => {
            // Skip if this position is marked as having no data
            if (noDataPositions.includes(index)) {
                return;
            }

            const value = values[index];
            if (value !== null && !isNaN(value)) {
                data.push({
                    date: new Date(time),
                    value: value
                });
            }
        });

        if (data.length === 0) {
            throw new Error('No valid data points found');
        }

        // Sort by date
        data.sort((a, b) => a.date - b.date);

        return {
            latest: data[data.length - 1].value,
            historical: data
        };
    }

    // Special case mappings for countries where Eurostat uses different codes
    getCountryCode(country) {
        const specialCases = {
            'Greece': 'EL', // Eurostat uses EL instead of GR
            'United Kingdom': 'UK' // Eurostat uses UK instead of GB
        };

        return specialCases[country.properties.name] || country.properties.id;
    }
}

// Export for module usage
window.EurostatAPI = EurostatAPI;
