class WorldBankAPI {
  constructor() {
    this.baseURL = "https://api.worldbank.org/v2";
    this.datasets = {
      gdp: "NY.GDP.MKTP.CD", // GDP (current US$)
      unemployment: "SL.UEM.TOTL.ZS", // Unemployment, total (% of labor force)
      inflation: "FP.CPI.TOTL.ZG", // Inflation, consumer prices (annual %)
      population: "SP.POP.TOTL", // Population, total
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
        throw new Error("No data available");
      }

      return this.processData(data);
    } catch (error) {
      console.error("Error fetching World Bank data:", error);
      throw error;
    }
  }

  processData(data) {
    // World Bank data is in reverse chronological order and uses years
    const historical = data
      .filter((item) => item.value !== null && item.value !== undefined)
      .map((item) => ({
        date: new Date(item.date + "-01-01"), // Convert year to date
        value: Number(item.value),
      }))
      .sort((a, b) => a.date - b.date); // Sort chronologically

    if (historical.length === 0) {
      throw new Error("No valid data available");
    }

    return {
      latest: historical[historical.length - 1].value,
      historical,
    };
  }

  async getGDP(countryCode) {
    const data = await this.fetchData(this.datasets.gdp, countryCode);
    const usdToEur = 0.92; // Rough conversion rate

    // Convert USD to EUR (millions)
    return {
      latest: (data.latest * usdToEur) / 1e6,
      historical: data.historical.map((d) => ({
        date: d.date,
        value: (d.value * usdToEur) / 1e6,
      })),
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

  // Batch fetch data for multiple countries
  async fetchBatchData(indicator, countryCodes) {
    try {
      // World Bank supports multiple countries with semicolon separator
      const url = `${this.baseURL}/country/${countryCodes.join(
        ";"
      )}/indicator/${indicator}?format=json&per_page=1000&mrnev=1`;

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const [metadata, data] = await response.json();
      if (!data || data.length === 0) {
        throw new Error("No data available");
      }

      return this.processBatchData(data, countryCodes);
    } catch (error) {
      console.error("Error fetching World Bank batch data:", error);
      throw error;
    }
  }

  processBatchData(data, countryCodes) {
    const result = {};

    // Initialize all countries
    countryCodes.forEach((code) => {
      result[code] = { latest: null, historical: [] };
    });

    // Group data by country
    data.forEach((item) => {
      if (item.value !== null && item.value !== undefined) {
        const countryCode = item.countryiso3code;
        if (result[countryCode]) {
          result[countryCode].historical.push({
            date: new Date(item.date + "-01-01"),
            value: Number(item.value),
          });
        }
      }
    });

    // Sort and set latest values
    Object.keys(result).forEach((countryCode) => {
      if (result[countryCode].historical.length > 0) {
        result[countryCode].historical.sort((a, b) => a.date - b.date);
        result[countryCode].latest =
          result[countryCode].historical[
            result[countryCode].historical.length - 1
          ].value;
      }
    });

    return result;
  }

  async getBatchGDP(countryCodes) {
    try {
      // Split into smaller batches to avoid URL length limits
      const batchSize = 20;
      const result = {};

      for (let i = 0; i < countryCodes.length; i += batchSize) {
        const batch = countryCodes.slice(i, i + batchSize);

        const url = `${this.baseURL}/country/${batch.join(
          ";"
        )}/indicator/NY.GDP.PCAP.CD?format=json&mrnev=1`;

        console.log("World Bank URL:", url);

        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const [metadata, data] = await response.json();
        if (data && data.length > 0) {
          const batchResult = this.processGDPPerCapitaData(data, batch);
          Object.assign(result, batchResult);
        }
      }

      return result;
    } catch (error) {
      console.error("Error fetching World Bank GDP per capita data:", error);
      throw error;
    }
  }

  processGDPPerCapitaData(data, countryCodes) {
    const result = {};
    const usdToEur = 0.92; // Rough conversion rate

    // Initialize all countries
    countryCodes.forEach((code) => {
      result[code] = { latest: null, historical: [] };
    });

    // Group data by country
    data.forEach((item) => {
      if (item.value !== null && item.value !== undefined) {
        const countryCode = item.countryiso3code;
        if (result[countryCode]) {
          // Convert from USD to EUR for consistency with Eurostat
          const valueInEur = item.value * usdToEur;

          result[countryCode].historical.push({
            date: new Date(item.date + "-01-01"),
            value: valueInEur,
          });

          // Set latest value directly since mrnev=1 gives us the most recent
          result[countryCode].latest = valueInEur;
        }
      }
    });

    console.log("World Bank processed data:", result);

    return result;
  }

  async getBatchUnemployment(countryCodes) {
    return this.fetchBatchData(this.datasets.unemployment, countryCodes);
  }

  async getBatchInflation(countryCodes) {
    return this.fetchBatchData(this.datasets.inflation, countryCodes);
  }

  async getBatchPopulation(countryCodes) {
    return this.fetchBatchData(this.datasets.population, countryCodes);
  }

  // Convert country codes from Eurostat format to World Bank format (ISO3)
  getCountryCode(country) {
    // World Bank uses ISO3 codes
    const iso2ToIso3 = {
      AT: "AUT", // Austria
      BE: "BEL", // Belgium
      BG: "BGR", // Bulgaria
      HR: "HRV", // Croatia
      CY: "CYP", // Cyprus
      CZ: "CZE", // Czech Republic
      DK: "DNK", // Denmark
      EE: "EST", // Estonia
      FI: "FIN", // Finland
      FR: "FRA", // France
      DE: "DEU", // Germany
      EL: "GRC", // Greece
      HU: "HUN", // Hungary
      IE: "IRL", // Ireland
      IT: "ITA", // Italy
      LV: "LVA", // Latvia
      LT: "LTU", // Lithuania
      LU: "LUX", // Luxembourg
      MT: "MLT", // Malta
      NL: "NLD", // Netherlands
      PL: "POL", // Poland
      PT: "PRT", // Portugal
      RO: "ROU", // Romania
      SK: "SVK", // Slovakia
      SI: "SVN", // Slovenia
      ES: "ESP", // Spain
      SE: "SWE", // Sweden
      GB: "GBR", // United Kingdom
      UK: "GBR", // Alternative code for UK
      NO: "NOR", // Norway
      CH: "CHE", // Switzerland
      IS: "ISL", // Iceland
      ME: "MNE", // Montenegro
      MK: "MKD", // North Macedonia
      AL: "ALB", // Albania
      RS: "SRB", // Serbia
      TR: "TUR", // Turkey
      UA: "UKR", // Ukraine
      BY: "BLR", // Belarus
      BA: "BIH", // Bosnia and Herzegovina
      MD: "MDA", // Moldova
      RU: "RUS", // Russia
      GE: "GEO", // Georgia
      AM: "ARM", // Armenia
      AZ: "AZE", // Azerbaijan
    };

    const code = country.properties.id;
    const iso3Code = iso2ToIso3[code];
    
    // Filter out territories/dependencies not supported by World Bank
    const unsupportedTerritories = ['GI', 'VA', 'SJ', 'JE', 'GG', 'AX'];
    if (unsupportedTerritories.includes(code)) {
      return null; // Return null for unsupported territories
    }
    
    return iso3Code || null;
  }
}
// Export for module usage
window.WorldBankAPI = WorldBankAPI;
