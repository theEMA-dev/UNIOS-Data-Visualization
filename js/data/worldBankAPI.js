class WorldBankAPI {
    constructor() {
        this.baseURL = 'https://api.worldbank.org/v2';
        this.datasets = {
            gdp: 'NY.GDP.MKTP.CD', // GDP (current US$)
            unemployment: 'SL.UEM.TOTL.ZS', // Unemployment, total (% of labor force)
            inflation: 'FP.CPI.TOTL.ZG', // Inflation, consumer prices (annual %)
            population: 'SP.POP.TOTL' // Population, total
        };
    }

    async fetchData(indicator, countryCode) {
        try {
            // Build URL with parameters
            const url = `${this.baseURL}/country/${countryCode}/indicator/${indicator}?format=json&per_page=100`;
            
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const [metadata, data] = await response.json();
            if (!data || data.length === 0) {
                throw new Error('No data available');
            }

            return this.processData(data);
        } catch (error) {
            console.error('Error fetching World Bank data:', error);
            throw error;
        }
    }

    processData(data) {
        // World Bank data is in reverse chronological order and uses years
        const historical = data
            .filter(item => item.value !== null && item.value !== undefined)
            .map(item => ({
                date: new Date(item.date + '-01-01'), // Convert year to date
                value: Number(item.value)
            }))
            .sort((a, b) => a.date - b.date); // Sort chronologically

        if (historical.length === 0) {
            throw new Error('No valid data available');
        }

        return {
            latest: historical[historical.length - 1].value,
            historical
        };
    }

    async getGDP(countryCode) {
        const data = await this.fetchData(this.datasets.gdp, countryCode);
        const usdToEur = 0.92; // Rough conversion rate

        // Convert USD to EUR (millions)
        return {
            latest: data.latest * usdToEur / 1e6,
            historical: data.historical.map(d => ({
                date: d.date,
                value: d.value * usdToEur / 1e6
            }))
        };
    }

    async getUnemployment(countryCode) {
        // Unemployment rate is already in percentage
        return this.fetchData(this.datasets.unemployment, countryCode);
    }

    async getInflation(countryCode) {
        // Inflation rate is already in percentage
        return this.fetchData(this.datasets.inflation, countryCode);
    }

    async getPopulation(countryCode) {
        // Population is in absolute numbers
        return this.fetchData(this.datasets.population, countryCode);
    }

    // Convert country codes from Eurostat format to World Bank format (ISO3)
    getCountryCode(country) {
        // World Bank uses ISO3 codes
        const iso2ToIso3 = {
            'AT': 'AUT', // Austria
            'BE': 'BEL', // Belgium
            'BG': 'BGR', // Bulgaria
            'HR': 'HRV', // Croatia
            'CY': 'CYP', // Cyprus
            'CZ': 'CZE', // Czech Republic
            'DK': 'DNK', // Denmark
            'EE': 'EST', // Estonia
            'FI': 'FIN', // Finland
            'FR': 'FRA', // France
            'DE': 'DEU', // Germany
            'EL': 'GRC', // Greece
            'HU': 'HUN', // Hungary
            'IE': 'IRL', // Ireland
            'IT': 'ITA', // Italy
            'LV': 'LVA', // Latvia
            'LT': 'LTU', // Lithuania
            'LU': 'LUX', // Luxembourg
            'MT': 'MLT', // Malta
            'NL': 'NLD', // Netherlands
            'PL': 'POL', // Poland
            'PT': 'PRT', // Portugal
            'RO': 'ROU', // Romania
            'SK': 'SVK', // Slovakia
            'SI': 'SVN', // Slovenia
            'ES': 'ESP', // Spain
            'SE': 'SWE', // Sweden
            'GB': 'GBR', // United Kingdom
            'UK': 'GBR', // Alternative code for UK
            'NO': 'NOR', // Norway
            'CH': 'CHE', // Switzerland
            'IS': 'ISL', // Iceland
            'ME': 'MNE', // Montenegro
            'MK': 'MKD', // North Macedonia
            'AL': 'ALB', // Albania
            'RS': 'SRB', // Serbia
            'TR': 'TUR', // Turkey
            'UA': 'UKR', // Ukraine
            'BY': 'BLR', // Belarus
            'BA': 'BIH', // Bosnia and Herzegovina
            'MD': 'MDA', // Moldova
            'RU': 'RUS'  // Russia
        };

        const code = country.properties.id;
        return iso2ToIso3[code] || code;
    }
}

// Export for module usage
window.WorldBankAPI = WorldBankAPI;
