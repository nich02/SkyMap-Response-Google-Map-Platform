import {
  ActiveRegion,
  LatLngLiteral,
  PrecipitationType,
  PublicWeatherAlert,
  StagingSite,
  WeatherConditionsData,
} from '../types/flood';
import {haversineDistanceKm} from '../utils/riskEngine';
import {getGeocodeCache, setGeocodeCacheEntry} from '../utils/storage';

const SOLUTION_ATTRIBUTION_ID = 'gmp_mcp_codeassist_v1_aistudio';

export function getGoogleMapsApiKey(): string {
  const viteKey =
    typeof import.meta !== 'undefined' && import.meta.env
      ? (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined)
      : undefined;
  const procKey =
    typeof process !== 'undefined' && process.env ? process.env.GOOGLE_MAPS_API_KEY : undefined;
  return viteKey || procKey || '';
}

function checkQuotaAndNotify(status?: number, bodyErrorStatus?: string, errMsg?: string): void {
  const normalizedMsg = (errMsg || '').toUpperCase();
  if (
    status === 429 ||
    bodyErrorStatus === 'RESOURCE_EXHAUSTED' ||
    bodyErrorStatus === 'OVER_QUERY_LIMIT' ||
    normalizedMsg.includes('RESOURCE_EXHAUSTED') ||
    normalizedMsg.includes('OVER_QUERY_LIMIT') ||
    normalizedMsg.includes('QUOTA')
  ) {
    window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
  }
}

export interface DiscoveredZoneSeed {
  id: string;
  name: string;
  corridor: string;
  lat: number;
  lng: number;
  placeId?: string;
}

/**
 * Discovers neighborhoods / sub-zones inside a searched region using Places API (New)
 * via the official Maps JS SDK (`Place.searchByText` + `Place.searchNearby`), avoiding CORS.
 */
export async function discoverSubZonesInRegion(
  placesLib: google.maps.PlacesLibrary,
  region: ActiveRegion
): Promise<DiscoveredZoneSeed[]> {
  const discovered: DiscoveredZoneSeed[] = [];
  const seenKeys = new Set<string>();

  const addCandidate = (
    name: string,
    lat: number,
    lng: number,
    corridor: string,
    placeId?: string
  ) => {
    const cleanName = name.trim();
    if (!cleanName || cleanName.toLowerCase() === region.name.toLowerCase()) return;
    // Deduplicate by normalized name or proximity < 600m
    const norm = cleanName.toLowerCase();
    if (seenKeys.has(norm)) return;
    const tooClose = discovered.some(
      (existing) => haversineDistanceKm({lat, lng}, {lat: existing.lat, lng: existing.lng}) < 0.65
    );
    if (tooClose) return;

    seenKeys.add(norm);
    discovered.push({
      id: `disc-${discovered.length + 1}-${norm.replace(/[^a-z0-9]/g, '').slice(0, 10)}`,
      name: cleanName,
      corridor,
      lat,
      lng,
      placeId,
    });
  };

  const boundsLiteral = region.viewport
    ? {
        north: region.viewport.north,
        south: region.viewport.south,
        east: region.viewport.east,
        west: region.viewport.west,
      }
    : undefined;

  // Query 1: Neighborhoods & suburbs via Place.searchByText
  const textQueries = [
    `neighborhoods and estates in ${region.name}`,
    `suburbs and districts near ${region.name}`,
  ];

  for (const textQuery of textQueries) {
    try {
      const request: google.maps.places.SearchByTextRequest = {
        textQuery,
        fields: ['id', 'displayName', 'location', 'formattedAddress'],
        maxResultCount: 15,
        ...(boundsLiteral ? {locationBias: boundsLiteral} : {locationBias: region.center}),
      };
      const {places} = await placesLib.Place.searchByText(request);
      for (const place of places) {
        if (!place.location || !place.displayName) continue;
        const lat = place.location.lat();
        const lng = place.location.lng();
        const corridor = deriveCardinalCorridor(region.center, {lat, lng});
        addCandidate(place.displayName, lat, lng, corridor, place.id);
      }
    } catch (err) {
      checkQuotaAndNotify(undefined, undefined, String(err));
    }
  }

  // Query 2: If fewer than 8 sub-zones found, sample civic hubs / local centers via searchNearby
  if (discovered.length < 8) {
    try {
      const {places} = await placesLib.Place.searchNearby({
        fields: ['id', 'displayName', 'location', 'formattedAddress'],
        locationRestriction: {
          center: region.center,
          radius: 12000,
        },
        includedPrimaryTypes: ['locality', 'sublocality', 'neighborhood', 'local_government_office'],
        maxResultCount: 15,
      });
      for (const place of places) {
        if (!place.location || !place.displayName) continue;
        const lat = place.location.lat();
        const lng = place.location.lng();
        const corridor = deriveCardinalCorridor(region.center, {lat, lng});
        addCandidate(place.displayName, lat, lng, corridor, place.id);
      }
    } catch (err) {
      checkQuotaAndNotify(undefined, undefined, String(err));
    }
  }

  // Query 3: Directional radial probes if region is small or sparse
  if (discovered.length < 6) {
    const compassOffsets = [
      {label: 'North Sector', dLat: 0.032, dLng: 0},
      {label: 'East Sector', dLat: 0, dLng: 0.035},
      {label: 'South Sector', dLat: -0.032, dLng: 0},
      {label: 'West Sector', dLat: 0, dLng: -0.035},
      {label: 'Central Basin', dLat: 0.005, dLng: -0.005},
      {label: 'Northeast Sector', dLat: 0.024, dLng: 0.026},
    ];
    for (const probe of compassOffsets) {
      try {
        const probeCenter = {
          lat: region.center.lat + probe.dLat,
          lng: region.center.lng + probe.dLng,
        };
        const {places} = await placesLib.Place.searchNearby({
          fields: ['id', 'displayName', 'location'],
          locationRestriction: {center: probeCenter, radius: 3500},
          includedPrimaryTypes: ['school', 'bus_station', 'market', 'park'],
          maxResultCount: 2,
        });
        const top = places[0];
        if (top?.location && top.displayName) {
          addCandidate(
            `${top.displayName} (${probe.label})`,
            top.location.lat(),
            top.location.lng(),
            probe.label.split(' ')[0],
            top.id
          );
        } else {
          addCandidate(
            `${region.name.split(',')[0]} ${probe.label}`,
            probeCenter.lat,
            probeCenter.lng,
            probe.label.split(' ')[0]
          );
        }
      } catch {
        // Ignore individual probe failures
      }
    }
  }

  return discovered.slice(0, 24);
}

function deriveCardinalCorridor(origin: LatLngLiteral, target: LatLngLiteral): string {
  const dLat = target.lat - origin.lat;
  const dLng = target.lng - origin.lng;
  if (Math.abs(dLat) < 0.015 && Math.abs(dLng) < 0.015) return 'Central';
  if (Math.abs(dLat) >= Math.abs(dLng)) {
    return dLat >= 0 ? 'North' : 'South';
  }
  return dLng >= 0 ? 'East' : 'West';
}

/**
 * Geocodes a CSV zone name using the Geocoding REST API with 30-day localStorage cache,
 * falling back to Places API (New) `Place.searchByText` if needed.
 */
export async function geocodeZoneName(
  zoneName: string,
  regionBias: ActiveRegion,
  apiKey: string,
  placesLib: google.maps.PlacesLibrary | null
): Promise<{lat: number; lng: number; formattedAddress: string; fromCache: boolean} | null> {
  const query = zoneName.trim();
  const cacheKey = `${query}::${regionBias.name}`.toLowerCase();
  const cache = getGeocodeCache();
  if (cache[cacheKey]) {
    return {
      lat: cache[cacheKey].lat,
      lng: cache[cacheKey].lng,
      formattedAddress: cache[cacheKey].formattedAddress,
      fromCache: true,
    };
  }

  const fullQuery = query.includes(',') ? query : `${query}, ${regionBias.name}`;

  // 1. Try Geocoding REST API (simple GET request without custom headers to avoid preflight)
  if (apiKey) {
    try {
      const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
      url.searchParams.set('address', fullQuery);
      url.searchParams.set('key', apiKey);
      if (regionBias.viewport) {
        url.searchParams.set(
          'bounds',
          `${regionBias.viewport.south},${regionBias.viewport.west}|${regionBias.viewport.north},${regionBias.viewport.east}`
        );
      }
      const res = await fetch(url.toString());
      checkQuotaAndNotify(res.status);
      if (res.ok) {
        const data = (await res.json()) as {
          status: string;
          results?: Array<{
            formatted_address: string;
            geometry?: {location?: {lat: number; lng: number}};
          }>;
        };
        if (data.status === 'OVER_QUERY_LIMIT') {
          checkQuotaAndNotify(429, 'OVER_QUERY_LIMIT');
        }
        if (data.status === 'OK' && data.results?.[0]?.geometry?.location) {
          const loc = data.results[0].geometry.location;
          const formattedAddress = data.results[0].formatted_address || fullQuery;
          setGeocodeCacheEntry(cacheKey, {
            lat: loc.lat,
            lng: loc.lng,
            formattedAddress,
          });
          return {lat: loc.lat, lng: loc.lng, formattedAddress, fromCache: false};
        }
      }
    } catch {
      // Fallback to Places JS SDK below
    }
  }

  // 2. Fallback via official Maps JS SDK Places API (New)
  if (placesLib) {
    try {
      const {places} = await placesLib.Place.searchByText({
        textQuery: fullQuery,
        fields: ['location', 'formattedAddress', 'displayName'],
        maxResultCount: 1,
        locationBias: regionBias.center,
      });
      const first = places[0];
      if (first?.location) {
        const lat = first.location.lat();
        const lng = first.location.lng();
        const formattedAddress = first.formattedAddress || first.displayName || fullQuery;
        setGeocodeCacheEntry(cacheKey, {lat, lng, formattedAddress});
        return {lat, lng, formattedAddress, fromCache: false};
      }
    } catch (err) {
      checkQuotaAndNotify(undefined, undefined, String(err));
    }
  }

  return null;
}

/**
 * Fetches ground elevation in meters for a batch of coordinates using the official
 * Maps JS SDK `ElevationService.getElevationForLocations` (single batch up to 100 points).
 */
export async function fetchBatchElevations(
  elevationLib: google.maps.ElevationLibrary,
  coordinates: LatLngLiteral[]
): Promise<(number | null)[]> {
  if (coordinates.length === 0) return [];
  const elevator = new elevationLib.ElevationService();
  const results: (number | null)[] = new Array(coordinates.length).fill(null);

  const CHUNK_SIZE = 100;
  for (let i = 0; i < coordinates.length; i += CHUNK_SIZE) {
    const chunk = coordinates.slice(i, i + CHUNK_SIZE);
    try {
      const response = await elevator.getElevationForLocations({
        locations: chunk,
      });
      response.results.forEach((res, idx) => {
        results[i + idx] = typeof res.elevation === 'number' ? Math.round(res.elevation) : null;
      });
    } catch (err) {
      checkQuotaAndNotify(undefined, undefined, String(err));
    }
  }

  return results;
}

function normalizePrecipType(raw?: string): PrecipitationType {
  if (!raw) return 'NONE';
  const upper = raw.toUpperCase();
  if (upper === 'HEAVY_RAIN') return 'HEAVY_RAIN';
  if (upper === 'LIGHT_RAIN') return 'LIGHT_RAIN';
  if (upper === 'RAIN') return 'RAIN';
  if (upper === 'THUNDERSTORM') return 'THUNDERSTORM';
  if (upper === 'NONE' || upper === 'PRECIPITATION_TYPE_UNSPECIFIED') return 'NONE';
  return 'RAIN';
}

export interface LiveWeatherFetchResult {
  weather: WeatherConditionsData;
  alerts: PublicWeatherAlert[];
}

/**
 * Fetches current conditions, 24h daily forecast, and public severe weather alerts
 * from the Google Maps Platform Weather API (`weather.googleapis.com`).
 */
export async function fetchLiveWeatherForPoint(
  lat: number,
  lng: number,
  apiKey: string,
  includeForecastAndAlerts = true
): Promise<LiveWeatherFetchResult> {
  if (!apiKey) {
    throw new Error('Missing Google Maps API key.');
  }

  const headers = {
    'X-Goog-Maps-Solution-ID': SOLUTION_ATTRIBUTION_ID,
  };

  // 1. Current Conditions
  const currentUrl = new URL('https://weather.googleapis.com/v1/currentConditions:lookup');
  currentUrl.searchParams.set('key', apiKey);
  currentUrl.searchParams.set('location.latitude', String(lat));
  currentUrl.searchParams.set('location.longitude', String(lng));

  const currentRes = await fetch(currentUrl.toString(), {method: 'GET', headers});
  if (!currentRes.ok) {
    let errStatus: string | undefined;
    try {
      const errJson = (await currentRes.json()) as {error?: {status?: string; message?: string}};
      errStatus = errJson?.error?.status;
      checkQuotaAndNotify(currentRes.status, errStatus, errJson?.error?.message);
    } catch {
      checkQuotaAndNotify(currentRes.status);
    }
    throw new Error(`Weather currentConditions error (${currentRes.status})`);
  }

  const currentData = (await currentRes.json()) as {
    temperature?: {degrees?: number};
    relativeHumidity?: number;
    weatherCondition?: {description?: {text?: string}; type?: string};
    precipitation?: {
      probability?: {percent?: number; type?: string};
      qpf?: {quantity?: number};
    };
  };

  const probabilityPercent = currentData.precipitation?.probability?.percent ?? 0;
  const precipitationType = normalizePrecipType(currentData.precipitation?.probability?.type);
  const currentQpfMm = Number((currentData.precipitation?.qpf?.quantity ?? 0).toFixed(2));

  let forecast24hQpfMm = currentQpfMm;
  let forecastMaxProbabilityPercent = probabilityPercent;
  const alerts: PublicWeatherAlert[] = [];

  if (includeForecastAndAlerts) {
    // 2. Daily Forecast (next 24h / day 1)
    try {
      const forecastUrl = new URL('https://weather.googleapis.com/v1/forecast/days:lookup');
      forecastUrl.searchParams.set('key', apiKey);
      forecastUrl.searchParams.set('location.latitude', String(lat));
      forecastUrl.searchParams.set('location.longitude', String(lng));
      forecastUrl.searchParams.set('days', '2');

      const forecastRes = await fetch(forecastUrl.toString(), {method: 'GET', headers});
      checkQuotaAndNotify(forecastRes.status);
      if (forecastRes.ok) {
        const fData = (await forecastRes.json()) as {
          forecastDays?: Array<{
            daytimeForecast?: {
              precipitation?: {probability?: {percent?: number}; qpf?: {quantity?: number}};
            };
            nighttimeForecast?: {
              precipitation?: {probability?: {percent?: number}; qpf?: {quantity?: number}};
            };
          }>;
        };
        const day0 = fData.forecastDays?.[0];
        if (day0) {
          const dayQpf = day0.daytimeForecast?.precipitation?.qpf?.quantity ?? 0;
          const nightQpf = day0.nighttimeForecast?.precipitation?.qpf?.quantity ?? 0;
          forecast24hQpfMm = Number((dayQpf + nightQpf).toFixed(2));
          const dayProb = day0.daytimeForecast?.precipitation?.probability?.percent ?? 0;
          const nightProb = day0.nighttimeForecast?.precipitation?.probability?.percent ?? 0;
          forecastMaxProbabilityPercent = Math.max(probabilityPercent, dayProb, nightProb);
        }
      }
    } catch {
      // Non-fatal if forecast fails
    }

    // 3. Public Severe Weather Alerts
    try {
      const alertsUrl = new URL('https://weather.googleapis.com/v1/publicAlerts:lookup');
      alertsUrl.searchParams.set('key', apiKey);
      alertsUrl.searchParams.set('location.latitude', String(lat));
      alertsUrl.searchParams.set('location.longitude', String(lng));
      alertsUrl.searchParams.set('languageCode', 'en');

      const alertsRes = await fetch(alertsUrl.toString(), {method: 'GET', headers});
      checkQuotaAndNotify(alertsRes.status);
      if (alertsRes.ok) {
        const aData = (await alertsRes.json()) as {
          weatherAlerts?: Array<{
            alertId: string;
            alertTitle?: {text?: string};
            eventType?: string;
            severity?: string;
            urgency?: string;
            areaName?: string;
            description?: string;
            instruction?: string[];
            dataSource?: {publisher?: string; name?: string; authorityUri?: string};
          }>;
        };
        if (Array.isArray(aData.weatherAlerts)) {
          for (const rawAlert of aData.weatherAlerts) {
            alerts.push({
              alertId: rawAlert.alertId,
              title: rawAlert.alertTitle?.text || rawAlert.eventType || 'Severe Weather Alert',
              eventType: rawAlert.eventType || 'WEATHER_ALERT',
              severity: rawAlert.severity || 'MODERATE',
              urgency: rawAlert.urgency || 'EXPECTED',
              areaName: rawAlert.areaName || 'Regional Advisory Zone',
              description: rawAlert.description || '',
              instruction: rawAlert.instruction,
              dataSource: {
                publisher: rawAlert.dataSource?.publisher || 'National Weather Authority',
                name: rawAlert.dataSource?.name || 'Meteorological Agency',
                authorityUri: rawAlert.dataSource?.authorityUri || 'https://public.wmo.int/',
              },
              isSimulated: false,
            });
          }
        }
      }
    } catch {
      // Non-fatal if publicAlerts fails
    }
  }

  return {
    weather: {
      probabilityPercent,
      precipitationType,
      currentQpfMm,
      forecast24hQpfMm,
      forecastMaxProbabilityPercent,
      temperatureC: currentData.temperature?.degrees,
      humidityPercent: currentData.relativeHumidity,
      conditionText: currentData.weatherCondition?.description?.text || 'Live observation',
      isSimulated: false,
    },
    alerts,
  };
}

/**
 * Finds nearest rescue staging sites (`hospital`, `school`, `stadium`, `community_center`)
 * around a flooded zone using Places API (New), then resolves their ground elevations via
 * ElevationService to prioritize high-ground evacuation staging points.
 */
export async function findHighElevationStagingSites(
  placesLib: google.maps.PlacesLibrary,
  elevationLib: google.maps.ElevationLibrary | null,
  zone: {lat: number; lng: number; elevationMeters: number | null}
): Promise<StagingSite[]> {
  const {places} = await placesLib.Place.searchNearby({
    fields: ['id', 'displayName', 'location', 'formattedAddress', 'primaryType'],
    locationRestriction: {
      center: {lat: zone.lat, lng: zone.lng},
      radius: 6500,
    },
    includedPrimaryTypes: ['hospital', 'school', 'stadium', 'community_center'],
    maxResultCount: 10,
    rankPreference: placesLib.SearchNearbyRankPreference.DISTANCE,
  });

  const rawSites = places
    .filter((p) => p.location && p.displayName)
    .map((p) => {
      const lat = p.location!.lat();
      const lng = p.location!.lng();
      const pType = (p.primaryType || 'community_center') as StagingSite['type'];
      const validType: StagingSite['type'] =
        pType === 'hospital' || pType === 'school' || pType === 'stadium'
          ? pType
          : 'community_center';
      return {
        id: p.id,
        name: p.displayName!,
        type: validType,
        address: p.formattedAddress || 'Nearby verified staging facility',
        lat,
        lng,
        distanceMetersDirect: Math.round(
          haversineDistanceKm({lat: zone.lat, lng: zone.lng}, {lat, lng}) * 1000
        ),
      };
    });

  if (rawSites.length === 0) return [];

  let elevations: (number | null)[] = new Array(rawSites.length).fill(null);
  if (elevationLib) {
    elevations = await fetchBatchElevations(
      elevationLib,
      rawSites.map((s) => ({lat: s.lat, lng: s.lng}))
    );
  }

  const enriched: StagingSite[] = rawSites.map((site, idx) => {
    const elev = elevations[idx];
    const adv =
      elev !== null && zone.elevationMeters !== null
        ? Math.round(elev - zone.elevationMeters)
        : null;
    return {
      ...site,
      elevationMeters: elev,
      elevationAdvantageMeters: adv,
    };
  });

  // Sort to prioritize higher-elevation sites first, then shorter distance
  return enriched
    .sort((a, b) => {
      const aHigh = (a.elevationAdvantageMeters ?? 0) > 0 ? 1 : 0;
      const bHigh = (b.elevationAdvantageMeters ?? 0) > 0 ? 1 : 0;
      if (aHigh !== bHigh) return bHigh - aHigh;
      if (aHigh === 1 && bHigh === 1) {
        // Both are higher ground; pick closest with meaningful elevation
        return a.distanceMetersDirect - b.distanceMetersDirect;
      }
      return a.distanceMetersDirect - b.distanceMetersDirect;
    })
    .slice(0, 5);
}

/**
 * Computes a traffic-aware rescue dispatch route using the modern Maps JS SDK
 * `Route.computeRoutes` (Routes API) without CORS issues.
 */
export async function computeRescueRoute(
  routesLib: google.maps.RoutesLibrary,
  origin: LatLngLiteral,
  destination: LatLngLiteral
): Promise<{
  route: google.maps.routes.Route;
  distanceMeters: number;
  durationMillis: number;
  warnings: string[];
}> {
  const request: google.maps.routes.ComputeRoutesRequest = {
    origin,
    destination,
    travelMode: routesLib.TravelMode.DRIVING,
    routingPreference: routesLib.RoutingPreference.TRAFFIC_AWARE,
    extraComputations: ['TRAFFIC_ON_POLYLINE'],
    fields: ['path', 'distanceMeters', 'durationMillis', 'viewport', 'speedPaths', 'warnings'],
    internalUsageAttributionIds: [SOLUTION_ATTRIBUTION_ID],
  };

  try {
    const response = await routesLib.Route.computeRoutes(request);
    const primary = response.routes?.[0];
    if (!primary) {
      throw new Error('No drivable rescue route found between staging site and flood zone.');
    }
    return {
      route: primary,
      distanceMeters: primary.distanceMeters ?? 0,
      durationMillis: primary.durationMillis ?? 0,
      warnings: primary.warnings ?? [],
    };
  } catch (err) {
    checkQuotaAndNotify(undefined, undefined, String(err));
    throw err;
  }
}
