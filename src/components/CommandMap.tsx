import React, {useEffect, useMemo, useRef, useState} from 'react';
import {AdvancedMarker, Map as GoogleMap, useMap} from '@vis.gl/react-google-maps';
import {Activity, GitCommitHorizontal, Layers, MapPin, ShieldPlus} from 'lucide-react';
import {
  ActiveRegion,
  FloodZone,
  LatLngLiteral,
  RescueRouteInfo,
  RunoffFlowEdge,
  StagingSite,
} from '../types/flood';
import {resolveRegionBoundaryPath} from '../utils/boundary';

interface CommandMapProps {
  activeRegion: ActiveRegion;
  zones: FloodZone[];
  flowEdges: RunoffFlowEdge[];
  selectedZoneId: string | null;
  suggestedZoneId: string | null;
  stagingSites: StagingSite[];
  selectedStagingId: string | null;
  routeInfo: RescueRouteInfo | null;
  onSelectZone: (zone: FloodZone) => void;
  onSelectStagingSite: (site: StagingSite) => void;
}

const MapOverlaysController: React.FC<{
  activeRegion: ActiveRegion;
  zones: FloodZone[];
  boundaryPath: LatLngLiteral[];
  showBoundary: boolean;
  flowEdges: RunoffFlowEdge[];
  showFlowVectors: boolean;
  routeInfo: RescueRouteInfo | null;
  selectedZone: FloodZone | null;
}> = ({
  activeRegion,
  zones,
  boundaryPath,
  showBoundary,
  flowEdges,
  showFlowVectors,
  routeInfo,
  selectedZone,
}) => {
  const map = useMap();
  const boundaryPolygonRef = useRef<google.maps.Polygon | null>(null);
  const flowPolylinesRef = useRef<google.maps.Polyline[]>([]);
  const routePolylinesRef = useRef<google.maps.Polyline[]>([]);
  const lastRegionKeyRef = useRef<string>('');

  // Fit map camera when activeRegion or zone set changes significantly
  useEffect(() => {
    if (!map) return;
    const regionKey = `${activeRegion.name}::${zones.length}`;
    if (lastRegionKeyRef.current === regionKey) return;
    lastRegionKeyRef.current = regionKey;

    if (boundaryPath.length >= 3 || zones.length > 0) {
      const bounds = new google.maps.LatLngBounds();
      boundaryPath.forEach((pt) => bounds.extend(pt));
      zones.forEach((z) => bounds.extend({lat: z.lat, lng: z.lng}));
      map.fitBounds(bounds, {top: 56, right: 48, bottom: 92, left: 48});
    } else if (activeRegion.viewport) {
      map.fitBounds(activeRegion.viewport);
    } else {
      map.panTo(activeRegion.center);
      map.setZoom(12);
    }
  }, [map, activeRegion, zones, boundaryPath]);

  // Smoothly pan to selected zone when clicked without an active route override
  useEffect(() => {
    if (!map || !selectedZone || routeInfo) return;
    map.panTo({lat: selectedZone.lat, lng: selectedZone.lng});
  }, [map, selectedZone, routeInfo]);

  // Draw Selected Region Boundary Perimeter Line
  useEffect(() => {
    if (boundaryPolygonRef.current) {
      boundaryPolygonRef.current.setMap(null);
      boundaryPolygonRef.current = null;
    }

    if (!map || !showBoundary || boundaryPath.length < 3) return;

    const polygon = new google.maps.Polygon({
      paths: boundaryPath,
      strokeColor: '#0369A1',
      strokeOpacity: 0.92,
      strokeWeight: 3,
      fillColor: '#0EA5E9',
      fillOpacity: 0.06,
      clickable: false,
      zIndex: 2,
      map,
    });

    boundaryPolygonRef.current = polygon;
    return () => {
      polygon.setMap(null);
      boundaryPolygonRef.current = null;
    };
  }, [map, boundaryPath, showBoundary]);

  // Draw Hydrological Runoff Flow Vectors (higher-elevation -> lower-elevation)
  useEffect(() => {
    flowPolylinesRef.current.forEach((p) => p.setMap(null));
    flowPolylinesRef.current = [];

    if (!map || !showFlowVectors || flowEdges.length === 0) return;

    const created: google.maps.Polyline[] = [];
    for (const edge of flowEdges) {
      const isHighlight =
        selectedZone &&
        (edge.fromZoneId === selectedZone.id || edge.toZoneId === selectedZone.id);

      const strokeColor = edge.isActiveSurge ? '#D97706' : '#0284C7';
      const strokeOpacity = edge.isActiveSurge ? 0.9 : isHighlight ? 0.85 : 0.45;

      const line = new google.maps.Polyline({
        path: [edge.fromCoords, edge.toCoords],
        geodesic: true,
        strokeColor,
        strokeOpacity,
        strokeWeight: edge.isActiveSurge ? 2.8 : isHighlight ? 2.4 : 1.75,
        zIndex: edge.isActiveSurge ? 20 : 5,
        icons: [
          {
            icon: {
              path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
              scale: edge.isActiveSurge ? 3.5 : 2.6,
              fillColor: strokeColor,
              fillOpacity: edge.isActiveSurge ? 0.95 : 0.78,
              strokeWeight: 0,
            },
            offset: '55%',
          },
        ],
        map,
      });
      created.push(line);
    }

    flowPolylinesRef.current = created;
    return () => {
      created.forEach((p) => p.setMap(null));
      flowPolylinesRef.current = [];
    };
  }, [map, flowEdges, showFlowVectors, selectedZone]);

  // Draw Traffic-Aware Rescue Dispatch Route using Route.createPolylines()
  useEffect(() => {
    routePolylinesRef.current.forEach((p) => p.setMap(null));
    routePolylinesRef.current = [];

    if (!map || !routeInfo?.routeObject) return;

    const polylines = routeInfo.routeObject.createPolylines();
    polylines.forEach((p) => {
      p.setOptions({
        strokeColor: '#0369A1',
        strokeOpacity: 0.95,
        strokeWeight: 5.5,
        zIndex: 60,
      });
      p.setMap(map);
    });
    routePolylinesRef.current = polylines;

    if (routeInfo.routeObject.viewport) {
      map.fitBounds(routeInfo.routeObject.viewport, {
        top: 64,
        right: 64,
        bottom: 88,
        left: 64,
      });
    }

    return () => {
      polylines.forEach((p) => p.setMap(null));
      routePolylinesRef.current = [];
    };
  }, [map, routeInfo]);

  return null;
};

export const CommandMap: React.FC<CommandMapProps> = ({
  activeRegion,
  zones,
  flowEdges,
  selectedZoneId,
  suggestedZoneId,
  stagingSites,
  selectedStagingId,
  routeInfo,
  onSelectZone,
  onSelectStagingSite,
}) => {
  const [hoveredZoneId, setHoveredZoneId] = useState<string | null>(null);
  const [showFlowVectors, setShowFlowVectors] = useState(true);
  const [showBoundary, setShowBoundary] = useState(true);

  const selectedZone = zones.find((z) => z.id === selectedZoneId) ?? null;
  const boundaryPath = useMemo(
    () => resolveRegionBoundaryPath(activeRegion, zones),
    [activeRegion, zones]
  );

  // Sort markers by latitude descending so southern markers render cleanly in front
  const sortedForDepth = [...zones].sort((a, b) => b.lat - a.lat);

  return (
    <div className="flex-1 h-full min-h-[380px] p-3 lg:p-4 bg-[#EFF6FF] flex">
      <div className="relative flex-1 h-full rounded-2xl border border-sky-200 bg-white shadow-sm overflow-hidden">
        <GoogleMap
          defaultCenter={activeRegion.center}
          defaultZoom={12}
          mapId="DEMO_MAP_ID"
          colorScheme="LIGHT"
          gestureHandling="greedy"
          mapTypeControl={false}
          streetViewControl={false}
          fullscreenControl={true}
          internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
          style={{width: '100%', height: '100%'}}
        >
          <MapOverlaysController
            activeRegion={activeRegion}
            zones={zones}
            boundaryPath={boundaryPath}
            showBoundary={showBoundary}
            flowEdges={flowEdges}
            showFlowVectors={showFlowVectors}
            routeInfo={routeInfo}
            selectedZone={selectedZone}
          />

          {sortedForDepth.map((zone, idx) => {
            const isSelected = zone.id === selectedZoneId;
            const isHovered = zone.id === hoveredZoneId;
            const isSuggested = zone.id === suggestedZoneId;
            const zIndex = isSelected ? 1050 : isSuggested ? 980 : isHovered ? 900 : idx + 10;

            const colorClasses =
              zone.riskLevel === 'IMMEDIATE_RESCUE'
                ? {
                    core: 'bg-red-600 border-white',
                    ring: 'bg-red-500/40',
                  }
                : zone.riskLevel === 'PRE_STAGE'
                  ? {
                      core: 'bg-amber-500 border-white',
                      ring: 'bg-amber-400/35',
                    }
                  : {
                      core: 'bg-emerald-600 border-white',
                      ring: '',
                    };

            return (
              <AdvancedMarker
                key={zone.id}
                position={{lat: zone.lat, lng: zone.lng}}
                zIndex={zIndex}
                title={`${zone.name} — Score ${zone.riskScore}${isSuggested ? ' (Suggested Dispatch)' : ''}`}
                onClick={() => onSelectZone(zone)}
              >
                <div
                  onMouseEnter={() => setHoveredZoneId(zone.id)}
                  onMouseLeave={() => setHoveredZoneId(null)}
                  className="relative flex items-center justify-center cursor-pointer group"
                >
                  {zone.riskLevel === 'IMMEDIATE_RESCUE' && (
                    <span
                      className={`absolute w-8 h-8 rounded-full flood-pulse-ring pointer-events-none ${colorClasses.ring}`}
                    />
                  )}

                  {isSuggested && (
                    <span className="absolute w-7 h-7 rounded-full bg-[#BBF7D0]/90 border-2 border-[#22C55E] pointer-events-none shadow-md" />
                  )}

                  <span
                    className={`relative block rounded-full border-2 transition-transform duration-150 shadow-md ${colorClasses.core} ${
                      isSelected
                        ? 'w-5 h-5 ring-2 ring-sky-600 scale-115'
                        : isSuggested
                          ? 'w-4.5 h-4.5 scale-110'
                          : isHovered
                            ? 'w-4 h-4 scale-110'
                            : 'w-3.5 h-3.5'
                    }`}
                  />

                  {isSuggested && !isHovered && !isSelected && (
                    <div className="absolute bottom-full mb-2.5 left-1/2 -translate-x-1/2 px-2.5 py-1 rounded-lg bg-[#DCFCE7] border border-[#4ADE80] text-[#064E3B] shadow-md whitespace-nowrap pointer-events-none z-50">
                      <div className="text-xs font-bold leading-tight">
                        Suggested: {zone.name}
                      </div>
                    </div>
                  )}

                  {(isSelected || isHovered) && (
                    <div
                      className={`absolute bottom-full mb-2.5 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-lg shadow-xl whitespace-nowrap pointer-events-none z-50 border ${
                        isSuggested
                          ? 'bg-[#DCFCE7] border-[#4ADE80] text-[#064E3B]'
                          : 'bg-white/95 border-sky-300 text-slate-900'
                      }`}
                    >
                      <div className="text-xs font-bold leading-tight">
                        {zone.name}
                        {isSuggested ? ' · Suggested Dispatch' : ''}
                      </div>
                      <div
                        className={`text-xs font-mono flex items-center gap-1.5 mt-0.5 ${
                          isSuggested ? 'text-[#065F46]' : 'text-slate-600'
                        }`}
                      >
                        <span>Score {zone.riskScore}</span>
                        <span aria-hidden="true">·</span>
                        <span>
                          {zone.elevationMeters !== null ? `${zone.elevationMeters}m` : 'Elev --'}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{zone.weather.currentQpfMm.toFixed(1)}mm</span>
                      </div>
                    </div>
                  )}
                </div>
              </AdvancedMarker>
            );
          })}

          {/* High-Elevation Rescue Staging Site Markers */}
          {stagingSites.map((site) => {
            const isActive = site.id === selectedStagingId;
            const shortCode =
              site.type === 'hospital'
                ? 'H'
                : site.type === 'school'
                  ? 'S'
                  : site.type === 'stadium'
                    ? 'ST'
                    : 'C';

            return (
              <AdvancedMarker
                key={site.id}
                position={{lat: site.lat, lng: site.lng}}
                zIndex={isActive ? 1100 : 850}
                title={`Staging: ${site.name}`}
                onClick={() => onSelectStagingSite(site)}
              >
                <div className="relative flex flex-col items-center cursor-pointer">
                  <div
                    className={`px-2 py-0.5 rounded-md font-mono text-xs font-bold border shadow-md flex items-center gap-1 transition-transform ${
                      isActive
                        ? 'bg-sky-600 text-white border-white scale-110'
                        : 'bg-white text-sky-800 border-sky-500 hover:scale-105'
                    }`}
                  >
                    <ShieldPlus className="w-3.5 h-3.5" />
                    <span>{shortCode}</span>
                  </div>
                </div>
              </AdvancedMarker>
            );
          })}
        </GoogleMap>

        {/* Top-Left Map Controls Overlay */}
        <div className="absolute top-3 left-3 flex flex-wrap items-center gap-2 z-10">
          <button
            type="button"
            onClick={() => setShowBoundary((v) => !v)}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold border shadow-sm backdrop-blur-md transition-colors cursor-pointer ${
              showBoundary
                ? 'bg-white/95 border-sky-500 text-sky-900'
                : 'bg-white/85 border-sky-200 text-slate-600 hover:text-slate-900'
            }`}
          >
            <MapPin className="w-4 h-4 text-sky-700" />
            <span>Region Boundary</span>
          </button>

          <button
            type="button"
            onClick={() => setShowFlowVectors((v) => !v)}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold border shadow-sm backdrop-blur-md transition-colors cursor-pointer ${
              showFlowVectors
                ? 'bg-white/95 border-sky-400 text-sky-900'
                : 'bg-white/85 border-sky-200 text-slate-600 hover:text-slate-900'
            }`}
          >
            <GitCommitHorizontal className="w-4 h-4 text-sky-600" />
            <span>Runoff Flow Vectors ({flowEdges.length})</span>
          </button>
        </div>

        {/* Bottom-Left Tactical Legend & API Attribution Bar */}
        <div className="absolute bottom-3 left-3 max-w-[calc(100%-24px)] bg-white/95 backdrop-blur-md border border-sky-200 rounded-xl px-4 py-2.5 z-10 shadow-lg">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs font-medium text-slate-800">
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-[#DCFCE7] border border-[#4ADE80] text-[#064E3B] font-semibold">
              <span className="w-2.5 h-2.5 rounded-full bg-[#22C55E] border border-white" />
              <span>Suggested Dispatch</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-red-600 border border-white" />
              <span>Immediate Rescue</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 border border-white" />
              <span>Pre-Stage Teams</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 border border-white" />
              <span>Normal</span>
            </span>
            <span className="inline-flex items-center gap-1.5 text-sky-900 font-semibold">
              <span className="w-3.5 h-0.5 bg-[#0369A1] inline-block" />
              <span>Region Boundary</span>
            </span>
            <span className="inline-flex items-center gap-1.5 text-sky-800">
              <Activity className="w-3.5 h-3.5 text-sky-600" />
              <span>Runoff Vector</span>
            </span>
            <span className="inline-flex items-center gap-1.5 text-sky-800">
              <ShieldPlus className="w-3.5 h-3.5 text-sky-600" />
              <span>High-Ground Staging</span>
            </span>
          </div>

          <div className="mt-1.5 pt-1.5 border-t border-sky-100 flex flex-wrap items-center gap-2 text-xs font-mono text-slate-600">
            <Layers className="w-3.5 h-3.5 text-sky-600" />
            <span>Google Maps Platform:</span>
            <span>Maps JS</span>
            <span aria-hidden="true">·</span>
            <span>Places (New)</span>
            <span aria-hidden="true">·</span>
            <span>Elevation</span>
            <span aria-hidden="true">·</span>
            <span>Weather</span>
            <span aria-hidden="true">·</span>
            <span>Routes</span>
          </div>
        </div>
      </div>
    </div>
  );
};
