export type RiskLevel = 'NORMAL' | 'PRE_STAGE' | 'IMMEDIATE_RESCUE';

export type PrecipitationType =
  | 'NONE'
  | 'RAIN'
  | 'LIGHT_RAIN'
  | 'HEAVY_RAIN'
  | 'THUNDERSTORM'
  | 'UNKNOWN';

export type DataMode = 'SIMULATION' | 'LIVE';

export interface LatLngLiteral {
  lat: number;
  lng: number;
}

export interface WeatherConditionsData {
  probabilityPercent: number;
  precipitationType: PrecipitationType;
  currentQpfMm: number;
  forecast24hQpfMm: number;
  forecastMaxProbabilityPercent: number;
  temperatureC?: number;
  humidityPercent?: number;
  conditionText?: string;
  isSimulated: boolean;
}

export interface PublicWeatherAlert {
  alertId: string;
  title: string;
  eventType: string;
  severity: string;
  urgency: string;
  areaName: string;
  description: string;
  instruction?: string[];
  dataSource: {
    publisher: string;
    name: string;
    authorityUri: string;
  };
  isSimulated?: boolean;
}

export interface FloodZone {
  id: string;
  name: string;
  corridor: string;
  lat: number;
  lng: number;
  elevationMeters: number | null;
  terrainVulnerability: number; // Derived from elevation relative to region average
  customWeight: number; // From CSV or preset (default 1.0)
  weather: WeatherConditionsData;
  riskScore: number;
  riskLevel: RiskLevel;
  source: 'PRESET' | 'DISCOVERED' | 'CSV';
  placeId?: string;
}

export interface RunoffFlowEdge {
  id: string;
  fromZoneId: string;
  fromZoneName: string;
  toZoneId: string;
  toZoneName: string;
  fromCoords: LatLngLiteral;
  toCoords: LatLngLiteral;
  elevationDropMeters: number;
  distanceKm: number;
  isActiveSurge: boolean;
}

export interface UpstreamSurgeWarning {
  id: string;
  upstreamZoneId: string;
  upstreamZoneName: string;
  upstreamElevationMeters: number;
  upstreamQpfMm: number;
  precipitationType: PrecipitationType;
  threatenedDownstreamZones: Array<{
    zoneId: string;
    zoneName: string;
    elevationDropMeters: number;
    estimatedArrivalWindow: string;
  }>;
}

export interface StagingSite {
  id: string;
  name: string;
  type: 'hospital' | 'school' | 'stadium' | 'community_center';
  address: string;
  lat: number;
  lng: number;
  elevationMeters: number | null;
  distanceMetersDirect: number;
  elevationAdvantageMeters: number | null;
}

export interface RescueRouteInfo {
  stagingSiteId: string;
  stagingSiteName: string;
  distanceMeters: number;
  durationMillis: number;
  encodedPath: LatLngLiteral[];
  routeObject?: google.maps.routes.Route;
  warnings: string[];
}

export interface ActiveRegion {
  name: string;
  center: LatLngLiteral;
  viewport?: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
  boundaryPath?: LatLngLiteral[];
  averageElevationMeters: number | null;
}

export interface GeocodeCacheEntry {
  lat: number;
  lng: number;
  formattedAddress: string;
  cachedAt: number;
}
