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

    // Simple batch fetch using the SDG API format
    async fetchBatchGDP() {
        try {
            const url = 'https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/sdg_08_10?format=JSON&lang=en&lastTimePeriod=1';
            
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            return this.processSDGData(data);
        } catch (error) {
            console.error('Error fetching Eurostat SDG data:', error);
            throw error;
        }
    }

    processSDGData(response) {
        if (!response.value || Object.keys(response.value).length === 0) {
            throw new Error('No data available in SDG response');
        }

        const values = response.value;
        const geoIndex = response.dimension.geo.category.index;
        const geoLabels = response.dimension.geo.category.label;
        const unitIndex = response.dimension.unit ? response.dimension.unit.category.index : null;
        
        const result = {};

        if (unitIndex) {
            // GDP data with multiple units - find the unit for absolute values (not percentage change)
            const absoluteUnitKey = Object.keys(unitIndex).find(key => 
                key.includes('EUR_HAB') && !key.includes('PCH')
            );
            const absoluteUnitIndex = unitIndex[absoluteUnitKey];

            // Process each value - only take absolute GDP values
            Object.entries(values).forEach(([index, value]) => {
                if (value === null || isNaN(value)) return;

                const idx = parseInt(index);
                
                // Calculate which unit and geo this index represents
                const numGeos = Object.keys(geoIndex).length;
                const numUnits = Object.keys(unitIndex).length;
                
                const unitPos = Math.floor(idx / numGeos) % numUnits;
                const geoPos = idx % numGeos;
                
                // Only process if this is the absolute unit (not percentage change)
                if (unitPos === absoluteUnitIndex) {
                    const geoKeys = Object.keys(geoIndex);
                    if (geoPos < geoKeys.length) {
                        const geoCode = geoKeys[geoPos];
                        
                        // Skip EU aggregates and focus on countries
                        if (!geoCode.startsWith('EU') && !geoCode.startsWith('EA')) {
                            result[geoCode] = {
                                latest: value,
                                historical: [{
                                    date: new Date('2024-01-01'),
                                    value: value
                                }]
                            };
                        }
                    }
                }
            });
        } else {
            // Simple data without units (unemployment, inflation, population)
            Object.entries(values).forEach(([index, value]) => {
                if (value === null || isNaN(value)) return;

                const idx = parseInt(index);
                const geoKeys = Object.keys(geoIndex);
                
                if (idx < geoKeys.length) {
                    const geoCode = geoKeys[idx];
                    
                    // Skip EU aggregates and focus on countries
                    if (!geoCode.startsWith('EU') && !geoCode.startsWith('EA')) {
                        result[geoCode] = {
                            latest: value,
                            historical: [{
                                date: new Date('2024-01-01'),
                                value: value
                            }]
                        };
                    }
                }
            });
        }

        return result;
    }

    async getBatchGDP(countryCodes) {
        return this.fetchBatchGDP();
    }

    async fetchBatchUnemployment() {
        try {
            const url = 'https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/une_rt_m?format=JSON&lang=en&lastTimePeriod=1&s_adj=SA&age=TOTAL&unit=PC_ACT';
            
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            return this.processSDGData(data);
        } catch (error) {
            console.error('Error fetching Eurostat unemployment data:', error);
            throw error;
        }
    }

    async fetchBatchInflation() {
        try {
            const url = 'https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/tec00118?format=JSON&lang=en&lastTimePeriod=1';
            
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            return this.processSDGData(data);
        } catch (error) {
            console.error('Error fetching Eurostat inflation data:', error);
            throw error;
        }
    }

    async fetchBatchPopulation() {
        try {
            const url = 'https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/tps00001?format=JSON&lang=en&lastTimePeriod=1';
            
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            return this.processSDGData(data);
        } catch (error) {
            console.error('Error fetching Eurostat population data:', error);
            throw error;
        }
    }

    async getBatchUnemployment(countryCodes) {
        return this.fetchBatchUnemployment();
    }

    async getBatchInflation(countryCodes) {
        return this.fetchBatchInflation();
    }

    async getBatchPopulation(countryCodes) {
        return this.fetchBatchPopulation();
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
