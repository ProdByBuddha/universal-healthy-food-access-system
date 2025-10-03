// dataFetchers.js - Universal Data Fetching Module
// Works for any city worldwide

import axios from 'axios';

const OVERPASS_API = 'https://overpass-api.de/api/interpreter';
const NOMINATIM_API = 'https://nominatim.openstreetmap.org';

// ==================== CITY BOUNDARY & GEOCODING ====================

/**
 * Geocode city name to coordinates and boundary
 */
export async function geocodeCity(cityName) {
  try {
    const response = await axios.get(`${NOMINATIM_API}/search`, {
      params: {
        q: cityName,
        format: 'json',
        limit: 1,
        polygon_geojson: 1
      },
      headers: {
        'User-Agent': 'HealthyFoodAccessSystem/1.0'
      }
    });

    if (response.data.length === 0) {
      throw new Error('City not found');
    }

    const city = response.data[0];
    return {
      name: city.display_name.split(',')[0],
      lat: parseFloat(city.lat),
      lng: parseFloat(city.lon),
      boundingBox: city.boundingbox.map(Number), // [south, north, west, east]
      boundary: city.geojson,
      osmId: city.osm_id,
      osmType: city.osm_type
    };
  } catch (error) {
    console.error('Geocoding error:', error);
    throw error;
  }
}

/**
 * Get detailed city boundary from OSM
 */
export async function fetchCityBoundary(osmId, osmType) {
  const query = `
    [out:json][timeout:25];
    ${osmType}(${osmId});
    out geom;
  `;

  try {
    const response = await axios.post(OVERPASS_API, query, {
      headers: { 'Content-Type': 'text/plain' }
    });
    return response.data;
  } catch (error) {
    console.error('Boundary fetch error:', error);
    throw error;
  }
}

// ==================== FOOD OUTLETS (OPENSTREETMAP) ====================

/**
 * Fetch all food outlets within bounding box
 * Returns classified outlets (healthy vs unhealthy)
 */
export async function fetchFoodOutlets(bbox) {
  // bbox format: [south, north, west, east] or [minLat, maxLat, minLng, maxLng]
  const [south, north, west, east] = bbox;

  const query = `
    [out:json][timeout:60];
    (
      // Healthy primary outlets
      node["shop"="supermarket"](${south},${west},${north},${east});
      way["shop"="supermarket"](${south},${west},${north},${east});
      node["shop"="greengrocer"](${south},${west},${north},${east});
      node["amenity"="marketplace"](${south},${west},${north},${east});
      node["shop"="farm"](${south},${west},${north},${east});
      node["shop"="health_food"](${south},${west},${north},${east});
      
      // Secondary healthy outlets
      node["shop"="grocery"](${south},${west},${north},${east});
      node["shop"="convenience"](${south},${west},${north},${east});
      way["shop"="convenience"](${south},${west},${north},${east});
      node["shop"="butcher"](${south},${west},${north},${east});
      node["shop"="fishmonger"](${south},${west},${north},${east});
      
      // Unhealthy (for contrast)
      node["amenity"="fast_food"](${south},${west},${north},${east});
      way["amenity"="fast_food"](${south},${west},${north},${east});
    );
    out center;
  `;

  try {
    const response = await axios.post(OVERPASS_API, query, {
      headers: { 'Content-Type': 'text/plain' }
    });

    const outlets = response.data.elements.map(element => {
      const lat = element.lat || element.center?.lat;
      const lng = element.lon || element.center?.lon;
      
      return {
        id: element.id,
        name: element.tags?.name || 'Unnamed',
        lat,
        lng,
        type: classifyOutlet(element.tags),
        rawType: element.tags?.shop || element.tags?.amenity,
        tags: element.tags,
        classification: getOutletClassification(element.tags)
      };
    }).filter(outlet => outlet.lat && outlet.lng); // Remove invalid coords

    return outlets;
  } catch (error) {
    console.error('Food outlets fetch error:', error);
    throw error;
  }
}

/**
 * Classify outlet as healthy, mixed, or unhealthy
 */
function classifyOutlet(tags) {
  const shop = tags?.shop;
  const amenity = tags?.amenity;

  // Healthy primary
  if (['supermarket', 'greengrocer', 'farm', 'health_food'].includes(shop)) {
    return 'healthy_primary';
  }
  if (amenity === 'marketplace') return 'healthy_primary';

  // Unhealthy
  if (amenity === 'fast_food') return 'unhealthy';
  if (shop === 'alcohol') return 'unhealthy';

  // Mixed (needs validation)
  if (['grocery', 'convenience', 'butcher', 'fishmonger'].includes(shop)) {
    return 'mixed';
  }

  return 'unknown';
}

/**
 * Get detailed classification
 */
function getOutletClassification(tags) {
  const type = classifyOutlet(tags);
  
  const classifications = {
    healthy_primary: {
      label: 'Healthy Food Source',
      color: '#0d5e3a',
      score: 1.0
    },
    mixed: {
      label: 'Mixed Selection',
      color: '#fbbf24',
      score: 0.5
    },
    unhealthy: {
      label: 'Unhealthy',
      color: '#dc2626',
      score: 0.0
    },
    unknown: {
      label: 'Unknown',
      color: '#6b7280',
      score: 0.3
    }
  };

  return classifications[type] || classifications.unknown;
}

// ==================== NASA EARTHDATA ====================

/**
 * Fetch NASA population density (SEDAC GPWv4)
 * Note: This requires NASA Earthdata authentication
 */
export async function fetchNASAPopulation(bbox) {
  // Placeholder - actual implementation requires NASA Earthdata token
  // For hackathon, you can use cached data or estimate
  
  console.warn('NASA Population fetch requires Earthdata authentication');
  
  // Return mock structure for development
  return {
    source: 'SEDAC_GPWv4',
    bbox,
    data: [], // Grid of population density values
    resolution: '1km',
    timestamp: new Date().toISOString()
  };
}

/**
 * Fetch NASA NDVI (vegetation index) for urban farming site selection
 */
export async function fetchNASANDVI(bbox, startDate, endDate) {
  // Placeholder - requires NASA Earthdata token
  
  console.warn('NASA NDVI fetch requires Earthdata authentication');
  
  return {
    source: 'MODIS_MOD13Q1',
    bbox,
    dateRange: { start: startDate, end: endDate },
    data: [], // Grid of NDVI values (0-1)
    resolution: '250m'
  };
}

/**
 * Fetch NASA Land Surface Temperature (heat exposure)
 */
export async function fetchNASALST(bbox, startDate, endDate) {
  // Placeholder - requires NASA Earthdata token
  
  console.warn('NASA LST fetch requires Earthdata authentication');
  
  return {
    source: 'MODIS_MOD11A2',
    bbox,
    dateRange: { start: startDate, end: endDate },
    data: [], // Grid of temperature values (Kelvin)
    resolution: '1km'
  };
}

/**
 * Fetch NASA POWER solar/climate data (for urban farming)
 */
export async function fetchNASAPower(lat, lng, startDate, endDate) {
  const baseUrl = 'https://power.larc.nasa.gov/api/temporal/daily/point';
  
  try {
    const response = await axios.get(baseUrl, {
      params: {
        parameters: 'ALLSKY_SFC_SW_DWN,T2M,PRECTOTCORR', // Solar, temp, precip
        community: 'AG',
        longitude: lng,
        latitude: lat,
        start: startDate.replace(/-/g, ''),
        end: endDate.replace(/-/g, ''),
        format: 'JSON'
      }
    });

    const parameters = response.data.properties.parameter;
    
    return {
      source: 'NASA_POWER',
      location: { lat, lng },
      data: {
        ALLSKY_SFC_SW_DWN: {
          mean: parameters.ALLSKY_SFC_SW_DWN ? 
            Object.values(parameters.ALLSKY_SFC_SW_DWN).reduce((sum, val) => sum + val, 0) / Object.keys(parameters.ALLSKY_SFC_SW_DWN).length : 0
        },
        T2M: {
          mean: parameters.T2M ? 
            Object.values(parameters.T2M).reduce((sum, val) => sum + val, 0) / Object.keys(parameters.T2M).length : 0
        },
        PRECTOTCORR: {
          mean: parameters.PRECTOTCORR ? 
            Object.values(parameters.PRECTOTCORR).reduce((sum, val) => sum + val, 0) / Object.keys(parameters.PRECTOTCORR).length : 0
        }
      },
      units: {
        ALLSKY_SFC_SW_DWN: 'kW-hr/m^2/day',
        T2M: 'Celsius',
        PRECTOTCORR: 'mm/day'
      }
    };
  } catch (error) {
    console.error('NASA POWER fetch error:', error);
    throw error;
  }
}

// ==================== UNIVERSAL DATA AGGREGATOR ====================

/**
 * Fetch all data for a city in one call
 * This is the main function to use
 */
export async function fetchAllCityData(cityData, options = {}) {
  const {
    includeFoodOutlets = true,
    includePopulation = false, // Requires auth
    includeNDVI = false,       // Requires auth
    includeLST = false,        // Requires auth
    includePower = true        // No auth required
  } = options;

  console.log(`Fetching data for ${cityData.name}...`);

  const results = {
    city: cityData,
    timestamp: new Date().toISOString(),
    data: {}
  };

  try {
    // Always fetch food outlets
    if (includeFoodOutlets) {
      console.log('Fetching food outlets from OpenStreetMap...');
      results.data.foodOutlets = await fetchFoodOutlets(cityData.boundingBox);
      console.log(`✓ Found ${results.data.foodOutlets.length} food outlets`);
    }

    // NASA Power data (no auth needed)
    if (includePower) {
      console.log('Fetching NASA POWER solar/climate data...');
      const today = new Date();
      const lastYear = new Date(today);
      lastYear.setFullYear(today.getFullYear() - 1);
      
      try {
        results.data.power = await fetchNASAPower(
          cityData.lat,
          cityData.lng,
          lastYear.toISOString().split('T')[0],
          today.toISOString().split('T')[0]
        );
        console.log('✓ NASA POWER data retrieved');
      } catch (error) {
        console.warn('⚠ NASA POWER fetch failed, continuing without it');
        results.data.power = null;
      }
    }

    // Optional NASA data (requires authentication)
    if (includePopulation) {
      results.data.population = await fetchNASAPopulation(cityData.boundingBox);
    }
    if (includeNDVI) {
      results.data.ndvi = await fetchNASANDVI(cityData.boundingBox, '2024-01-01', '2024-12-31');
    }
    if (includeLST) {
      results.data.lst = await fetchNASALST(cityData.boundingBox, '2024-06-01', '2024-08-31');
    }

    console.log('✓ All data fetched successfully');
    return results;

  } catch (error) {
    console.error('Error fetching city data:', error);
    throw error;
  }
}

// ==================== HELPER FUNCTIONS ====================

/**
 * Calculate bounding box from GeoJSON geometry
 */
export function calculateBBox(geometry) {
  const coordinates = geometry.coordinates;
  let allCoords = [];

  function flattenCoords(coords) {
    if (Array.isArray(coords[0])) {
      coords.forEach(flattenCoords);
    } else {
      allCoords.push(coords);
    }
  }

  flattenCoords(coordinates);

  const lngs = allCoords.map(c => c[0]);
  const lats = allCoords.map(c => c[1]);

  return [
    Math.min(...lats),  // south
    Math.max(...lats),  // north
    Math.min(...lngs),  // west
    Math.max(...lngs)   // east
  ];
}

/**
 * Validate bounding box
 */
export function validateBBox(bbox) {
  const [south, north, west, east] = bbox;
  
  if (south >= north) throw new Error('Invalid bbox: south >= north');
  if (west >= east) throw new Error('Invalid bbox: west >= east');
  if (south < -90 || north > 90) throw new Error('Invalid latitude range');
  if (west < -180 || east > 180) throw new Error('Invalid longitude range');
  
  return true;
}

// ==================== EXPORT ====================

const dataFetchers = {
  geocodeCity,
  fetchCityBoundary,
  fetchFoodOutlets,
  fetchNASAPopulation,
  fetchNASANDVI,
  fetchNASALST,
  fetchNASAPower,
  fetchAllCityData,
  calculateBBox,
  validateBBox
};

export default dataFetchers;
