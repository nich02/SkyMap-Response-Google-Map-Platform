import {
  FloodZone,
  LatLngLiteral,
  RiskLevel,
  RunoffFlowEdge,
  UpstreamSurgeWarning,
} from '../types/flood';

export function haversineDistanceKm(a: LatLngLiteral, b: LatLngLiteral): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const c =
    sinDLat * sinDLat +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      sinDLng *
      sinDLng;
  return R * 2 * Math.atan2(Math.sqrt(c), Math.sqrt(1 - c));
}

/**
 * Computes terrain vulnerability relative to region's average elevation.
 * Lower-elevation zones relative to regional mean receive higher flood risk multipliers.
 */
export function computeTerrainVulnerability(
  elevationMeters: number | null,
  averageElevationMeters: number | null
): number {
  if (elevationMeters === null || averageElevationMeters === null) {
    return 1.0;
  }

  const delta = averageElevationMeters - elevationMeters; // positive if zone is lower than average
  // Scale smoothly between 0.75 (high ridge) and 1.85 (deep basin)
  const rawMultiplier = 1.0 + delta / 110;
  return Number(Math.max(0.75, Math.min(1.85, rawMultiplier)).toFixed(2));
}

/**
 * Flood Risk Score formula:
 * (probability.percent * qpf_mm) * terrain_vulnerability
 * Incorporates customWeight when provided (defaults to 1.0) and blends forecasted QPF if current QPF is low.
 */
export function calculateFloodRiskScore(zone: {
  weather: {
    probabilityPercent: number;
    currentQpfMm: number;
    forecast24hQpfMm: number;
    precipitationType: string;
  };
  terrainVulnerability: number;
  customWeight: number;
}): {score: number; level: RiskLevel} {
  const effectiveQpf =
    zone.weather.currentQpfMm > 0
      ? zone.weather.currentQpfMm
      : zone.weather.forecast24hQpfMm * 0.45;

  const baseScore =
    zone.weather.probabilityPercent * effectiveQpf * zone.terrainVulnerability * zone.customWeight;

  // Normalize / preserve exact scale: e.g. 85% * 18mm * 1.4 = 2142
  const score = Math.round(baseScore);

  let level: RiskLevel = 'NORMAL';
  if (
    score >= 1200 ||
    (zone.weather.precipitationType === 'HEAVY_RAIN' && zone.weather.currentQpfMm >= 14)
  ) {
    level = 'IMMEDIATE_RESCUE';
  } else if (score >= 420 || zone.weather.forecast24hQpfMm >= 18) {
    level = 'PRE_STAGE';
  }

  return {score, level};
}

export function recalculateRegionMetrics(zones: FloodZone[]): {
  zones: FloodZone[];
  averageElevationMeters: number | null;
  flowEdges: RunoffFlowEdge[];
  surgeWarnings: UpstreamSurgeWarning[];
} {
  const elevations = zones
    .map((z) => z.elevationMeters)
    .filter((e): e is number => typeof e === 'number' && !Number.isNaN(e));

  const averageElevationMeters =
    elevations.length > 0
      ? Number((elevations.reduce((sum, val) => sum + val, 0) / elevations.length).toFixed(1))
      : null;

  const enriched = zones.map((zone) => {
    const terrainVulnerability = computeTerrainVulnerability(
      zone.elevationMeters,
      averageElevationMeters
    );
    const {score, level} = calculateFloodRiskScore({
      weather: zone.weather,
      terrainVulnerability,
      customWeight: zone.customWeight,
    });
    return {
      ...zone,
      terrainVulnerability,
      riskScore: score,
      riskLevel: level,
    };
  });

  // Sort zones descending by flood risk score
  const sortedZones = [...enriched].sort((a, b) => b.riskScore - a.riskScore);

  // Build runoff flow edges: connect higher-elevation zones to nearby lower-elevation zones
  const flowEdges: RunoffFlowEdge[] = [];
  for (const upstream of sortedZones) {
    if (upstream.elevationMeters === null) continue;
    // Find up to 2 closest significantly lower-elevation downstream zones
    const downstreamCandidates = sortedZones
      .filter((candidate) => {
        if (candidate.id === upstream.id || candidate.elevationMeters === null) return false;
        const drop = upstream.elevationMeters! - candidate.elevationMeters;
        if (drop < 18) return false;
        const dist = haversineDistanceKm(
          {lat: upstream.lat, lng: upstream.lng},
          {lat: candidate.lat, lng: candidate.lng}
        );
        return dist <= 16;
      })
      .map((candidate) => ({
        candidate,
        drop: upstream.elevationMeters! - candidate.elevationMeters!,
        dist: haversineDistanceKm(
          {lat: upstream.lat, lng: upstream.lng},
          {lat: candidate.lat, lng: candidate.lng}
        ),
      }))
      .sort((a, b) => a.dist - b.dist)
      .slice(0, 2);

    const isUpstreamHeavy =
      upstream.weather.precipitationType === 'HEAVY_RAIN' ||
      upstream.weather.precipitationType === 'THUNDERSTORM' ||
      upstream.weather.currentQpfMm >= 12;

    for (const item of downstreamCandidates) {
      flowEdges.push({
        id: `${upstream.id}->${item.candidate.id}`,
        fromZoneId: upstream.id,
        fromZoneName: upstream.name,
        toZoneId: item.candidate.id,
        toZoneName: item.candidate.name,
        fromCoords: {lat: upstream.lat, lng: upstream.lng},
        toCoords: {lat: item.candidate.lat, lng: item.candidate.lng},
        elevationDropMeters: Math.round(item.drop),
        distanceKm: Number(item.dist.toFixed(1)),
        isActiveSurge: isUpstreamHeavy,
      });
    }
  }

  // Generate Upstream Surge Warnings when high-elevation zones experience heavy rain
  const surgeWarnings: UpstreamSurgeWarning[] = [];
  if (averageElevationMeters !== null) {
    const highZonesWithHeavyRain = sortedZones.filter(
      (z) =>
        z.elevationMeters !== null &&
        z.elevationMeters >= averageElevationMeters &&
        (z.weather.precipitationType === 'HEAVY_RAIN' ||
          z.weather.precipitationType === 'THUNDERSTORM' ||
          z.weather.currentQpfMm >= 12)
    );

    for (const up of highZonesWithHeavyRain) {
      const linkedDownstream = flowEdges
        .filter((e) => e.fromZoneId === up.id)
        .map((e) => ({
          zoneId: e.toZoneId,
          zoneName: e.toZoneName,
          elevationDropMeters: e.elevationDropMeters,
          estimatedArrivalWindow:
            e.distanceKm < 5 ? '1 – 1.5 hrs' : e.distanceKm < 10 ? '1.5 – 2.5 hrs' : '2 – 3 hrs',
        }));

      if (linkedDownstream.length > 0) {
        surgeWarnings.push({
          id: `surge-${up.id}`,
          upstreamZoneId: up.id,
          upstreamZoneName: up.name,
          upstreamElevationMeters: Math.round(up.elevationMeters!),
          upstreamQpfMm: up.weather.currentQpfMm,
          precipitationType: up.weather.precipitationType,
          threatenedDownstreamZones: linkedDownstream,
        });
      }
    }
  }

  return {
    zones: sortedZones,
    averageElevationMeters,
    flowEdges,
    surgeWarnings,
  };
}

export function formatDispatchBrief(params: {
  zone: FloodZone;
  regionName: string;
  selectedStagingSite?: {
    name: string;
    address: string;
    elevationMeters: number | null;
    elevationAdvantageMeters: number | null;
  } | null;
  routeInfo?: {
    distanceMeters: number;
    durationMillis: number;
  } | null;
  upstreamSources: RunoffFlowEdge[];
}): string {
  const {zone, regionName, selectedStagingSite, routeInfo, upstreamSources} = params;
  const riskLabel =
    zone.riskLevel === 'IMMEDIATE_RESCUE'
      ? 'IMMEDIATE RESCUE'
      : zone.riskLevel === 'PRE_STAGE'
        ? 'PRE-STAGE TEAMS'
        : 'NORMAL MONITORING';

  const lines: string[] = [
    `FLOODWATCH COMMAND DISPATCH BRIEF`,
    `Priority: ${riskLabel} (Score: ${zone.riskScore})`,
    `Zone: ${zone.name} (${zone.corridor} · ${regionName})`,
    `Coords: ${zone.lat.toFixed(5)}, ${zone.lng.toFixed(5)}`,
    `Elevation: ${zone.elevationMeters !== null ? `${Math.round(zone.elevationMeters)}m` : 'N/A'} | Terrain Mult: ${zone.terrainVulnerability.toFixed(2)}x`,
    `Rainfall: ${zone.weather.currentQpfMm.toFixed(1)}mm current / ${zone.weather.forecast24hQpfMm.toFixed(1)}mm 24h forecast (${zone.weather.probabilityPercent}% ${zone.weather.precipitationType})`,
  ];

  if (upstreamSources.length > 0) {
    const activeUpstream = upstreamSources.filter((u) => u.isActiveSurge);
    if (activeUpstream.length > 0) {
      lines.push(
        `UPSTREAM SURGE ALERT: Active runoff from ${activeUpstream.map((u) => `${u.fromZoneName} (-${u.elevationDropMeters}m)`).join(', ')} — surge expected within 1-3h.`
      );
    }
  }

  if (selectedStagingSite) {
    lines.push(
      `Staging Point: ${selectedStagingSite.name}${selectedStagingSite.elevationAdvantageMeters !== null ? ` (+${Math.round(selectedStagingSite.elevationAdvantageMeters)}m higher ground)` : ''}`
    );
    if (routeInfo) {
      const km = (routeInfo.distanceMeters / 1000).toFixed(1);
      const mins = Math.max(1, Math.round(routeInfo.durationMillis / 60000));
      lines.push(`Traffic-Aware Route: ${km} km | Est. ETA ${mins} mins`);
    }
  }

  lines.push(`Map Pin: https://maps.google.com/?q=${zone.lat},${zone.lng}`);
  return lines.join('\n');
}
