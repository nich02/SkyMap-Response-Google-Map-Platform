import React, {useState} from 'react';
import {
  ArrowLeft,
  ArrowUpRight,
  Check,
  CloudRain,
  Copy,
  Loader2,
  Mountain,
  Navigation,
  ShieldPlus,
  Waves,
} from 'lucide-react';
import {
  FloodZone,
  RescueRouteInfo,
  RunoffFlowEdge,
  StagingSite,
} from '../types/flood';
import {formatDispatchBrief} from '../utils/riskEngine';
import {ZoneHydrologyMiniChart} from './HydrologyCharts';

interface RescueActionDrawerProps {
  zone: FloodZone;
  isSuggestedZone?: boolean;
  regionName: string;
  averageElevationMeters: number | null;
  peakRegionQpf: number;
  upstreamSources: RunoffFlowEdge[];
  stagingSites: StagingSite[];
  selectedStagingId: string | null;
  routeInfo: RescueRouteInfo | null;
  isLoadingStaging: boolean;
  isLoadingRoute: boolean;
  stagingError: string | null;
  routeError: string | null;
  onClose: () => void;
  onSelectStagingSite: (site: StagingSite) => void;
  onTriggerZoneSurge?: (zoneId: string) => void;
}

export const RescueActionDrawer: React.FC<RescueActionDrawerProps> = ({
  zone,
  isSuggestedZone = false,
  regionName,
  averageElevationMeters,
  peakRegionQpf,
  upstreamSources,
  stagingSites,
  selectedStagingId,
  routeInfo,
  isLoadingStaging,
  isLoadingRoute,
  stagingError,
  routeError,
  onClose,
  onSelectStagingSite,
  onTriggerZoneSurge,
}) => {
  const [copied, setCopied] = useState(false);

  const selectedSite = stagingSites.find((s) => s.id === selectedStagingId) ?? null;

  const riskBadge =
    zone.riskLevel === 'IMMEDIATE_RESCUE'
      ? {
          label: 'Immediate Rescue',
          cls: 'text-red-800 bg-red-50 border-red-300',
        }
      : zone.riskLevel === 'PRE_STAGE'
        ? {
            label: 'Pre-Stage Teams',
            cls: 'text-amber-900 bg-amber-50 border-amber-300',
          }
        : {
            label: 'Normal Monitoring',
            cls: 'text-emerald-800 bg-emerald-50 border-emerald-300',
          };

  const handleCopyBrief = async () => {
    const brief = formatDispatchBrief({
      zone,
      regionName,
      selectedStagingSite: selectedSite,
      routeInfo,
      upstreamSources,
    });
    try {
      await navigator.clipboard.writeText(brief);
      setCopied(true);
      setTimeout(() => setCopied(false), 2400);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = brief;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2400);
    }
  };

  return (
    <div className="flex flex-col h-full min-h-0 bg-[#F8FBFF]">
      {/* Drawer Header */}
      <div className="px-4 py-3 bg-white border-b border-sky-200 flex items-center justify-between gap-3 shrink-0">
        <button
          type="button"
          onClick={onClose}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-sky-800 hover:text-sky-950 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>All Triage Zones</span>
        </button>

        <span className={`text-xs font-bold px-2.5 py-1 rounded-md border ${riskBadge.cls}`}>
          {riskBadge.label}
        </span>
      </div>

      {/* Scrollable Inspection Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* Zone Title & Coordinates */}
        <div>
          {isSuggestedZone && (
            <div className="mb-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#DCFCE7] border border-emerald-400 text-xs font-bold text-[#064E3B]">
              Suggested Priority Dispatch Zone
            </div>
          )}

          <div className="flex items-start justify-between gap-3">
            <div>
              <h2
                className={`font-display text-xl font-bold leading-snug ${
                  isSuggestedZone
                    ? 'inline-block bg-[#BBF7D0] text-[#064E3B] px-2.5 py-0.5 rounded-lg border border-emerald-400'
                    : 'text-slate-900'
                }`}
              >
                {zone.name}
              </h2>
              <div className="text-xs sm:text-sm text-slate-600 mt-1 flex flex-wrap items-center gap-1.5">
                <span>{zone.corridor} Corridor</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono">
                  {zone.lat.toFixed(4)}, {zone.lng.toFixed(4)}
                </span>
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className="text-xs text-slate-500">Risk Score</div>
              <div className="font-mono text-2xl font-bold text-slate-900">{zone.riskScore}</div>
            </div>
          </div>

          {zone.weather.isSimulated && onTriggerZoneSurge && (
            <button
              type="button"
              onClick={() => onTriggerZoneSurge(zone.id)}
              className="mt-3 w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 transition-colors cursor-pointer"
            >
              <CloudRain className="w-4 h-4 text-amber-600" />
              <span>Simulate Cloudburst Surge on {zone.name}</span>
            </button>
          )}
        </div>

        {/* Embedded Hydrological Mini Chart */}
        <ZoneHydrologyMiniChart
          zone={zone}
          averageElevationMeters={averageElevationMeters}
          peakRegionQpf={peakRegionQpf}
        />

        {/* Weather & Forecast Section */}
        <section className="pt-4 border-t border-sky-200">
          <div className="flex items-center justify-between mb-2.5">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
              <CloudRain className="w-4 h-4 text-sky-600" />
              <span>Precipitation &amp; Forecast</span>
            </h3>
            <span className="font-mono text-xs text-slate-500">
              Weather API {zone.weather.isSimulated ? '(Storm Sim)' : '(Live)'}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 bg-white border border-sky-200 rounded-xl p-3.5">
            <div>
              <div className="text-xs text-slate-500">Current QPF</div>
              <div className="font-mono text-base font-bold text-slate-900 mt-0.5">
                {zone.weather.currentQpfMm.toFixed(1)} mm
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-500">24h Forecast QPF</div>
              <div className="font-mono text-base font-bold text-sky-700 mt-0.5">
                {zone.weather.forecast24hQpfMm.toFixed(1)} mm
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-500">Rain Probability</div>
              <div className="font-mono text-sm font-semibold text-slate-900 mt-0.5">
                {zone.weather.probabilityPercent}%
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-500">Precipitation Type</div>
              <div className="font-mono text-xs font-bold text-slate-800 mt-1">
                {zone.weather.precipitationType}
              </div>
            </div>
          </div>
        </section>

        {/* Elevation & Terrain Vulnerability */}
        <section className="pt-4 border-t border-sky-200">
          <div className="flex items-center justify-between mb-2.5">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
              <Mountain className="w-4 h-4 text-sky-600" />
              <span>Elevation &amp; Runoff Topology</span>
            </h3>
            <span className="font-mono text-xs text-slate-500">Elevation API</span>
          </div>

          <div className="grid grid-cols-3 gap-2.5 bg-white border border-sky-200 rounded-xl p-3.5">
            <div>
              <div className="text-xs text-slate-500">Ground Elev</div>
              <div className="font-mono text-sm font-bold text-slate-900 mt-0.5">
                {zone.elevationMeters !== null ? `${zone.elevationMeters} m` : 'N/A'}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-500">Terrain Mult</div>
              <div className="font-mono text-sm font-bold text-slate-900 mt-0.5">
                {zone.terrainVulnerability.toFixed(2)}×
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-500">Zone Weight</div>
              <div className="font-mono text-sm font-bold text-slate-900 mt-0.5">
                {zone.customWeight.toFixed(2)}×
              </div>
            </div>
          </div>

          {upstreamSources.length > 0 && (
            <div className="mt-3 space-y-1.5">
              <div className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <Waves className="w-4 h-4 text-amber-600" />
                <span>Upstream Runoff Feeding This Basin:</span>
              </div>
              {upstreamSources.map((edge) => (
                <div
                  key={edge.id}
                  className="flex items-center justify-between text-xs px-3 py-2 rounded-lg bg-white border border-sky-200"
                >
                  <span className="font-semibold text-slate-800 truncate">
                    {edge.fromZoneName}
                  </span>
                  <span
                    className={`font-mono shrink-0 ${
                      edge.isActiveSurge ? 'text-amber-700 font-bold' : 'text-slate-600'
                    }`}
                  >
                    -{edge.elevationDropMeters}m drop · {edge.distanceKm} km
                    {edge.isActiveSurge ? ' · SURGE' : ''}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* High-Elevation Rescue Staging Sites & Live Route */}
        <section className="pt-4 border-t border-sky-200">
          <div className="flex items-center justify-between mb-2.5">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
              <ShieldPlus className="w-4 h-4 text-sky-600" />
              <span>High-Ground Staging &amp; Route</span>
            </h3>
            <span className="font-mono text-xs text-slate-500">Places · Routes</span>
          </div>

          {isLoadingRoute ? (
            <div className="mb-3 p-3 rounded-xl bg-white border border-sky-200 flex items-center gap-2 text-sm text-sky-800">
              <Loader2 className="w-4 h-4 animate-spin shrink-0 text-sky-600" />
              <span>Computing traffic-aware dispatch route...</span>
            </div>
          ) : routeError ? (
            <div className="mb-3 p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs sm:text-sm text-amber-900">
              {routeError}
            </div>
          ) : routeInfo ? (
            <div className="mb-3 p-3.5 rounded-xl bg-sky-100/80 border border-sky-300 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-xs text-sky-800 font-semibold flex items-center gap-1">
                  <Navigation className="w-3.5 h-3.5" />
                  <span>Active Traffic-Aware Route</span>
                </div>
                <div className="text-sm font-bold text-slate-900 truncate mt-0.5">
                  {routeInfo.stagingSiteName} → {zone.name}
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="font-mono text-base font-bold text-sky-900">
                  {Math.max(1, Math.round(routeInfo.durationMillis / 60000))} min
                </div>
                <div className="font-mono text-xs text-slate-700">
                  {(routeInfo.durationMillis > 0 ? routeInfo.distanceMeters / 1000 : 0).toFixed(1)}{' '}
                  km
                </div>
              </div>
            </div>
          ) : null}

          {isLoadingStaging ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-14 rounded-xl bg-sky-100 animate-pulse border border-sky-200"
                />
              ))}
            </div>
          ) : stagingError ? (
            <div className="p-3 rounded-xl bg-white border border-sky-200 text-sm text-slate-600">
              {stagingError}
            </div>
          ) : stagingSites.length === 0 ? (
            <div className="p-3 rounded-xl bg-white border border-sky-200 text-sm text-slate-600">
              No hospitals, schools, stadiums, or community centers found within 6.5 km.
            </div>
          ) : (
            <div className="space-y-2">
              {stagingSites.map((site) => {
                const isSelected = site.id === selectedStagingId;
                return (
                  <button
                    key={site.id}
                    type="button"
                    onClick={() => onSelectStagingSite(site)}
                    className={`w-full text-left p-3 rounded-xl border transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-sky-100/70 border-sky-500'
                        : 'bg-white border-sky-200 hover:border-sky-400'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-slate-900 truncate">
                          {site.name}
                        </div>
                        <div className="text-xs text-slate-600 truncate mt-0.5">
                          {site.type.replace('_', ' ')} · {site.address}
                        </div>
                      </div>
                      <ArrowUpRight
                        className={`w-4 h-4 shrink-0 mt-0.5 ${
                          isSelected ? 'text-sky-700' : 'text-slate-400'
                        }`}
                      />
                    </div>
                    <div className="mt-1.5 flex items-center gap-3 font-mono text-xs">
                      <span className="text-slate-700">
                        {(site.distanceMetersDirect / 1000).toFixed(1)} km direct
                      </span>
                      {site.elevationMeters !== null && (
                        <span
                          className={
                            (site.elevationAdvantageMeters ?? 0) > 0
                              ? 'text-emerald-700 font-semibold'
                              : 'text-slate-600'
                          }
                        >
                          {site.elevationMeters}m
                          {site.elevationAdvantageMeters !== null
                            ? ` (${site.elevationAdvantageMeters >= 0 ? '+' : ''}${site.elevationAdvantageMeters}m)`
                            : ''}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {/* Footer CTA: Copy Emergency Dispatch Brief */}
      <div className="p-4 border-t border-sky-200 bg-white shrink-0 space-y-2">
        <button
          type="button"
          onClick={() => void handleCopyBrief()}
          className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold bg-sky-600 hover:bg-sky-700 text-white transition-colors cursor-pointer"
        >
          {copied ? (
            <>
              <Check className="w-4 h-4" />
              <span>Copied Dispatch Brief for WhatsApp / SMS</span>
            </>
          ) : (
            <>
              <Copy className="w-4 h-4" />
              <span>Copy Emergency Dispatch Brief</span>
            </>
          )}
        </button>
        <p className="text-xs text-slate-500 text-center">
          Decision-support telemetry. Verify field access &amp; local authority directives prior to deployment.
        </p>
      </div>
    </div>
  );
};
