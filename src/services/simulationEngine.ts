import {
  FloodZone,
  PrecipitationType,
  PublicWeatherAlert,
  WeatherConditionsData,
} from '../types/flood';
import {haversineDistanceKm} from '../utils/riskEngine';

/**
 * Generates spatially coherent storm-cell rainfall across a region's zones.
 * Places primary convective storm cells over higher-elevation catchment ridges
 * and select low-lying basins to demonstrate realistic flash flood & upstream domino dynamics.
 */
export function generateStormSimulationForZones(
  zones: Array<{
    id: string;
    name: string;
    lat: number;
    lng: number;
    elevationMeters: number | null;
    customWeight: number;
  }>,
  stormIntensity: 'MODERATE' | 'SEVERE' = 'SEVERE'
): Record<string, WeatherConditionsData> {
  if (zones.length === 0) return {};

  const elevations = zones
    .map((z) => z.elevationMeters)
    .filter((e): e is number => typeof e === 'number');
  const avgElev =
    elevations.length > 0
      ? elevations.reduce((a, b) => a + b, 0) / elevations.length
      : 100;

  // Pick 2 storm epicenters:
  // 1) Highest elevation zone (upstream catchment cloudburst)
  // 2) A vulnerable low-lying zone (urban basin downpour)
  const sortedByElevDesc = [...zones].sort(
    (a, b) => (b.elevationMeters ?? avgElev) - (a.elevationMeters ?? avgElev)
  );
  const sortedByElevAsc = [...zones].sort(
    (a, b) => (a.elevationMeters ?? avgElev) - (b.elevationMeters ?? avgElev)
  );

  const highlandEpicenter = sortedByElevDesc[0];
  const basinEpicenter =
    sortedByElevAsc.find((z) => z.id !== highlandEpicenter.id) ?? sortedByElevAsc[0];

  const intensityMultiplier = stormIntensity === 'SEVERE' ? 1.0 : 0.62;
  const result: Record<string, WeatherConditionsData> = {};

  for (let i = 0; i < zones.length; i++) {
    const z = zones[i];
    const distHighland = haversineDistanceKm(
      {lat: z.lat, lng: z.lng},
      {lat: highlandEpicenter.lat, lng: highlandEpicenter.lng}
    );
    const distBasin = haversineDistanceKm(
      {lat: z.lat, lng: z.lng},
      {lat: basinEpicenter.lat, lng: basinEpicenter.lng}
    );

    // Deterministic pseudo-random micro-variance from zone name so values feel organic
    const hash = z.name.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
    const micro = ((hash % 17) - 8) / 10; // -0.8 to +0.8

    const cell1Factor = Math.exp(-(distHighland * distHighland) / 36);
    const cell2Factor = Math.exp(-(distBasin * distBasin) / 28);
    const stormFactor = Math.max(cell1Factor, cell2Factor * 0.92);

    const elev = z.elevationMeters ?? avgElev;
    const isHighland = elev >= avgElev + 20;

    let currentQpfMm = Math.max(
      0,
      Number(((stormFactor * 24 + (isHighland ? 3.5 : 1.5) + micro * 2) * intensityMultiplier).toFixed(1))
    );
    let probabilityPercent = Math.round(
      Math.min(98, Math.max(18, (35 + stormFactor * 60 + micro * 4) * (stormIntensity === 'SEVERE' ? 1 : 0.85)))
    );

    // Keep some zones calm/normal so triage distribution is realistic (Green / Amber / Red)
    if (stormFactor < 0.18 && hash % 3 !== 0) {
      currentQpfMm = Number((Math.max(0, 1.2 + micro)).toFixed(1));
      probabilityPercent = Math.min(45, Math.max(15, 28 + (hash % 15)));
    }

    const forecast24hQpfMm = Number(
      Math.max(currentQpfMm * 1.45, currentQpfMm + 6.5 + stormFactor * 18).toFixed(1)
    );

    let precipitationType: PrecipitationType = 'NONE';
    if (currentQpfMm >= 13 || (isHighland && currentQpfMm >= 10.5)) {
      precipitationType = 'HEAVY_RAIN';
    } else if (currentQpfMm >= 4.5) {
      precipitationType = 'RAIN';
    } else if (currentQpfMm >= 0.8) {
      precipitationType = 'LIGHT_RAIN';
    }

    result[z.id] = {
      probabilityPercent,
      precipitationType,
      currentQpfMm,
      forecast24hQpfMm,
      forecastMaxProbabilityPercent: Math.min(99, probabilityPercent + 8),
      temperatureC: Number((18.5 - (isHighland ? 1.4 : 0) + micro).toFixed(1)),
      humidityPercent: Math.min(98, Math.round(68 + stormFactor * 27)),
      conditionText:
        precipitationType === 'HEAVY_RAIN'
          ? 'Heavy convective downpour'
          : precipitationType === 'RAIN'
            ? 'Steady rainfall'
            : precipitationType === 'LIGHT_RAIN'
              ? 'Light intermittent showers'
              : 'Overcast cloud deck',
      isSimulated: true,
    };
  }

  return result;
}

export function generateSimulatedAlert(regionName: string, zones: FloodZone[]): PublicWeatherAlert[] {
  const immediateCount = zones.filter((z) => z.riskLevel === 'IMMEDIATE_RESCUE').length;
  if (immediateCount === 0) return [];

  const topZones = zones
    .slice(0, 3)
    .map((z) => z.name)
    .join(', ');

  return [
    {
      alertId: `sim-flash-flood-${Date.now()}`,
      title: `Flash Flood & Urban Runoff Advisory — ${regionName}`,
      eventType: 'FLASH_FLOOD',
      severity: 'SEVERE',
      urgency: 'IMMEDIATE',
      areaName: topZones,
      description: `Simulated meteorological advisory for ${regionName}: Intensive convective rainfall over elevated catchment zones is generating rapid surface runoff toward low-lying basins (${topZones}).`,
      instruction: [
        'Pre-stage swift-water rescue teams at elevated staging facilities.',
        'Monitor low-lying drainage corridors for 1–3 hour surge cresting.',
      ],
      dataSource: {
        publisher: 'FloodWatch Storm Simulation Engine',
        name: 'Simulated Meteorological Authority (Training Mode)',
        authorityUri: 'https://public.wmo.int/',
      },
      isSimulated: true,
    },
  ];
}
