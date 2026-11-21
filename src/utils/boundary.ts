import {NAIROBI_COUNTY_BOUNDARY} from '../data/nairobiPreset';
import {ActiveRegion, FloodZone, LatLngLiteral} from '../types/flood';

/**
 * Computes a 2D convex hull using Andrew's monotone chain algorithm
 * and pads each vertex outward slightly from the centroid so zone markers
 * sit comfortably inside the selected region boundary line.
 */
function buildPaddedConvexHull(points: LatLngLiteral[], padDegrees = 0.016): LatLngLiteral[] {
  if (points.length === 0) return [];
  if (points.length === 1) {
    const p = points[0];
    return [
      {lat: p.lat + padDegrees, lng: p.lng - padDegrees},
      {lat: p.lat + padDegrees, lng: p.lng + padDegrees},
      {lat: p.lat - padDegrees, lng: p.lng + padDegrees},
      {lat: p.lat - padDegrees, lng: p.lng - padDegrees},
    ];
  }
  if (points.length === 2) {
    const lats = points.map((p) => p.lat);
    const lngs = points.map((p) => p.lng);
    return [
      {lat: Math.max(...lats) + padDegrees, lng: Math.min(...lngs) - padDegrees},
      {lat: Math.max(...lats) + padDegrees, lng: Math.max(...lngs) + padDegrees},
      {lat: Math.min(...lats) - padDegrees, lng: Math.max(...lngs) + padDegrees},
      {lat: Math.min(...lats) - padDegrees, lng: Math.min(...lngs) - padDegrees},
    ];
  }

  const sorted = [...points].sort((a, b) => (a.lng !== b.lng ? a.lng - b.lng : a.lat - b.lat));
  const cross = (o: LatLngLiteral, a: LatLngLiteral, b: LatLngLiteral) =>
    (a.lng - o.lng) * (b.lat - o.lat) - (a.lat - o.lat) * (b.lng - o.lng);

  const lower: LatLngLiteral[] = [];
  for (const p of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) {
      lower.pop();
    }
    lower.push(p);
  }

  const upper: LatLngLiteral[] = [];
  for (let i = sorted.length - 1; i >= 0; i--) {
    const p = sorted[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) {
      upper.pop();
    }
    upper.push(p);
  }

  upper.pop();
  lower.pop();
  const hull = lower.concat(upper);
  if (hull.length < 3) return points;

  const centroid = hull.reduce(
    (acc, p) => ({lat: acc.lat + p.lat / hull.length, lng: acc.lng + p.lng / hull.length}),
    {lat: 0, lng: 0}
  );

  return hull.map((p) => {
    const dLat = p.lat - centroid.lat;
    const dLng = p.lng - centroid.lng;
    const dist = Math.hypot(dLat, dLng) || 1;
    return {
      lat: Number((p.lat + (dLat / dist) * padDegrees).toFixed(5)),
      lng: Number((p.lng + (dLng / dist) * padDegrees).toFixed(5)),
    };
  });
}

/**
 * Resolves the geographic boundary polygon path for the currently active region.
 * Uses the Nairobi City County boundary for Nairobi, or derives a clean perimeter
 * from the searched region's viewport / discovered zones.
 */
export function resolveRegionBoundaryPath(
  region: ActiveRegion,
  zones: FloodZone[]
): LatLngLiteral[] {
  if (region.boundaryPath && region.boundaryPath.length >= 3) {
    return region.boundaryPath;
  }

  if (region.name.toLowerCase().includes('nairobi')) {
    return NAIROBI_COUNTY_BOUNDARY;
  }

  if (zones.length >= 3) {
    return buildPaddedConvexHull(zones.map((z) => ({lat: z.lat, lng: z.lng})));
  }

  if (region.viewport) {
    const {north, south, east, west} = region.viewport;
    return [
      {lat: north, lng: west},
      {lat: north, lng: east},
      {lat: south, lng: east},
      {lat: south, lng: west},
    ];
  }

  return buildPaddedConvexHull([region.center], 0.04);
}
