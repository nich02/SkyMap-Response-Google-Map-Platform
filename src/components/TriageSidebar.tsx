import React, {useMemo, useState} from 'react';
import {
  AlertTriangle,
  ChevronRight,
  CloudLightning,
  ExternalLink,
  Search,
  Sparkles,
  Waves,
} from 'lucide-react';
import {
  DataMode,
  FloodZone,
  PublicWeatherAlert,
  RescueRouteInfo,
  RiskLevel,
  RunoffFlowEdge,
  StagingSite,
  UpstreamSurgeWarning,
} from '../types/flood';
import {RescueActionDrawer} from './RescueActionDrawer';

interface TriageSidebarProps {
  regionName: string;
  averageElevationMeters: number | null;
  zones: FloodZone[];
  flowEdges: RunoffFlowEdge[];
  surgeWarnings: UpstreamSurgeWarning[];
  publicAlerts: PublicWeatherAlert[];
  dataMode: DataMode;
  isLoading: boolean;
  weatherStatusNotice: string | null;
  selectedZoneId: string | null;
  suggestedZoneId: string | null;
  stagingSites: StagingSite[];
  selectedStagingId: string | null;
  routeInfo: RescueRouteInfo | null;
  isLoadingStaging: boolean;
  isLoadingRoute: boolean;
  stagingError: string | null;
  routeError: string | null;
  onSelectZone: (zone: FloodZone) => void;
  onClearSelectedZone: () => void;
  onSelectStagingSite: (site: StagingSite) => void;
  onTriggerZoneSurge: (zoneId: string) => void;
  onSwitchToSimulation: () => void;
}

export const TriageSidebar: React.FC<TriageSidebarProps> = ({
  regionName,
  averageElevationMeters,
  zones,
  flowEdges,
  surgeWarnings,
  publicAlerts,
  dataMode,
  isLoading,
  weatherStatusNotice,
  selectedZoneId,
  suggestedZoneId,
  stagingSites,
  selectedStagingId,
  routeInfo,
  isLoadingStaging,
  isLoadingRoute,
  stagingError,
  routeError,
  onSelectZone,
  onClearSelectedZone,
  onSelectStagingSite,
  onTriggerZoneSurge,
  onSwitchToSimulation,
}) => {
  const [riskFilter, setRiskFilter] = useState<'ALL' | RiskLevel>('ALL');
  const [searchFilter, setSearchFilter] = useState('');

  const selectedZone = useMemo(
    () => zones.find((z) => z.id === selectedZoneId) ?? null,
    [zones, selectedZoneId]
  );

  const suggestedZone = useMemo(
    () => zones.find((z) => z.id === suggestedZoneId) ?? zones[0] ?? null,
    [zones, suggestedZoneId]
  );

  const counts = useMemo(() => {
    let immediate = 0;
    let preStage = 0;
    let normal = 0;
    let peakQpf = 0;
    for (const z of zones) {
      if (z.riskLevel === 'IMMEDIATE_RESCUE') immediate++;
      else if (z.riskLevel === 'PRE_STAGE') preStage++;
      else normal++;
      if (z.weather.currentQpfMm > peakQpf) peakQpf = z.weather.currentQpfMm;
    }
    return {immediate, preStage, normal, peakQpf};
  }, [zones]);

  const filteredZones = useMemo(() => {
    const q = searchFilter.trim().toLowerCase();
    return zones.filter((z) => {
      if (riskFilter !== 'ALL' && z.riskLevel !== riskFilter) return false;
      if (q && !z.name.toLowerCase().includes(q) && !z.corridor.toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
  }, [zones, riskFilter, searchFilter]);

  if (selectedZone) {
    const upstreamSources = flowEdges.filter((e) => e.toZoneId === selectedZone.id);
    return (
      <aside className="w-full lg:w-[360px] xl:w-[420px] shrink-0 border-t lg:border-t-0 lg:border-l border-sky-200 bg-[#F8FBFF] flex flex-col h-full min-h-0">
        <RescueActionDrawer
          zone={selectedZone}
          isSuggestedZone={selectedZone.id === suggestedZoneId}
          regionName={regionName}
          averageElevationMeters={averageElevationMeters}
          peakRegionQpf={counts.peakQpf}
          upstreamSources={upstreamSources}
          stagingSites={stagingSites}
          selectedStagingId={selectedStagingId}
          routeInfo={routeInfo}
          isLoadingStaging={isLoadingStaging}
          isLoadingRoute={isLoadingRoute}
          stagingError={stagingError}
          routeError={routeError}
          onClose={onClearSelectedZone}
          onSelectStagingSite={onSelectStagingSite}
          onTriggerZoneSurge={dataMode === 'SIMULATION' ? onTriggerZoneSurge : undefined}
        />
      </aside>
    );
  }

  return (
    <aside className="w-full lg:w-[360px] xl:w-[420px] shrink-0 border-t lg:border-t-0 lg:border-l border-sky-200 bg-[#F8FBFF] flex flex-col h-full min-h-0">
      {/* Suggested Dispatch Priority Card (Light Green Identification) */}
      {suggestedZone && !isLoading && (
        <div className="px-4 py-3 bg-[#ECFDF5] border-b border-emerald-300 shrink-0">
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-900">
              <Sparkles className="w-4 h-4 text-emerald-600" />
              <span>Suggested Dispatch Zone</span>
            </span>
            <span className="font-mono text-xs font-bold text-emerald-900">
              Score {suggestedZone.riskScore}
            </span>
          </div>
          <button
            type="button"
            onClick={() => onSelectZone(suggestedZone)}
            className="mt-1.5 w-full flex items-center justify-between gap-2 text-left rounded-lg px-3 py-2 bg-[#BBF7D0] hover:bg-[#86EFAC] border border-emerald-400 text-[#064E3B] transition-colors cursor-pointer"
          >
            <div className="min-w-0">
              <div className="text-base font-bold truncate">{suggestedZone.name}</div>
              <div className="text-xs font-medium text-emerald-900 mt-0.5">
                {suggestedZone.corridor} Corridor · {suggestedZone.weather.currentQpfMm.toFixed(1)}mm ·{' '}
                {suggestedZone.elevationMeters !== null ? `${suggestedZone.elevationMeters}m` : '--'}
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-emerald-900 shrink-0" />
          </button>
        </div>
      )}

      {/* Upstream Domino Surge Warning Banner */}
      {surgeWarnings.length > 0 && (
        <div className="px-4 py-3 bg-amber-50 border-b border-amber-200 shrink-0">
          <div className="flex items-start gap-2.5">
            <Waves className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
              <div className="text-xs font-bold text-amber-900">
                Upstream Surge Domino Alert ({surgeWarnings.length})
              </div>
              <p className="text-xs text-amber-900/90 mt-0.5 leading-relaxed">
                Highland catchment{' '}
                <strong className="font-bold text-slate-950">
                  {surgeWarnings[0].upstreamZoneName}
                </strong>{' '}
                ({surgeWarnings[0].upstreamElevationMeters}m ·{' '}
                {surgeWarnings[0].upstreamQpfMm.toFixed(1)}mm) drains within 1–3 hrs toward:
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {surgeWarnings.slice(0, 2).flatMap((w) =>
                  w.threatenedDownstreamZones.map((dz) => {
                    const target = zones.find((z) => z.id === dz.zoneId);
                    return (
                      <button
                        key={`${w.id}-${dz.zoneId}`}
                        type="button"
                        onClick={() => target && onSelectZone(target)}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-100 hover:bg-amber-200 border border-amber-300 text-xs font-semibold text-amber-950 transition-colors cursor-pointer"
                      >
                        <span>{dz.zoneName}</span>
                        <span className="font-mono text-amber-800">
                          (-{dz.elevationDropMeters}m)
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Official / Simulated Weather Alerts Strip */}
      {publicAlerts.length > 0 && (
        <div className="px-4 py-2.5 bg-red-50 border-b border-red-200 shrink-0">
          {publicAlerts.slice(0, 1).map((alert) => (
            <div key={alert.alertId} className="flex items-start gap-2">
              <CloudLightning className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <div className="min-w-0 flex-1 text-xs">
                <div className="font-bold text-red-900 truncate">{alert.title}</div>
                <div className="text-xs text-red-800 mt-0.5">
                  Source:{' '}
                  <a
                    href={alert.dataSource.authorityUri}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline font-semibold hover:text-red-950 inline-flex items-center gap-0.5"
                  >
                    <span>{alert.dataSource.name}</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Weather API Notice */}
      {weatherStatusNotice && (
        <div className="px-4 py-2 bg-sky-100/70 border-b border-sky-200 flex items-center justify-between gap-2 text-xs text-slate-800 shrink-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span className="truncate">{weatherStatusNotice}</span>
          </div>
          {dataMode === 'LIVE' && (
            <button
              type="button"
              onClick={onSwitchToSimulation}
              className="text-sky-700 hover:text-sky-900 font-bold whitespace-nowrap shrink-0 cursor-pointer"
            >
              Switch to Storm Sim
            </button>
          )}
        </div>
      )}

      {/* Triage Summary Telemetry Strip */}
      <div className="grid grid-cols-3 border-b border-sky-200 bg-white shrink-0">
        <div className="px-3.5 py-2.5 border-r border-sky-100">
          <div className="text-xs font-medium text-slate-600">Immediate Rescue</div>
          <div className="font-mono text-xl font-bold text-red-600 mt-0.5">{counts.immediate}</div>
        </div>
        <div className="px-3.5 py-2.5 border-r border-sky-100">
          <div className="text-xs font-medium text-slate-600">Pre-Stage Teams</div>
          <div className="font-mono text-xl font-bold text-amber-600 mt-0.5">{counts.preStage}</div>
        </div>
        <div className="px-3.5 py-2.5">
          <div className="text-xs font-medium text-slate-600">Mean Elev / Peak</div>
          <div className="font-mono text-sm font-bold text-sky-950 mt-1">
            {averageElevationMeters !== null ? `${Math.round(averageElevationMeters)}m` : '--'} ·{' '}
            {counts.peakQpf.toFixed(1)}mm
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="px-4 py-2.5 border-b border-sky-200 bg-white space-y-2 shrink-0">
        <div className="flex items-center gap-1 p-0.5 bg-sky-50 border border-sky-200 rounded-lg">
          {(
            [
              {id: 'ALL', label: `All (${zones.length})`},
              {id: 'IMMEDIATE_RESCUE', label: `Rescue (${counts.immediate})`},
              {id: 'PRE_STAGE', label: `Pre-Stage (${counts.preStage})`},
              {id: 'NORMAL', label: `Normal (${counts.normal})`},
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setRiskFilter(tab.id)}
              className={`flex-1 py-1.5 px-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                riskFilter === tab.id
                  ? 'bg-sky-600 text-white'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative flex items-center">
          <Search className="w-4 h-4 text-sky-600 absolute left-2.5 pointer-events-none" />
          <input
            type="text"
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            placeholder="Filter triage list by zone or corridor..."
            className="w-full bg-[#F0F7FF] border border-sky-200 focus:border-sky-500 rounded-lg pl-8 pr-3 py-1.5 text-sm text-slate-900 placeholder:text-slate-500 focus:outline-none"
          />
        </div>
      </div>

      {/* Live Triage List */}
      <div className="flex-1 overflow-y-auto divide-y divide-sky-100">
        {isLoading ? (
          <div className="p-4 space-y-3">
            {[1, 2, 3, 4, 5, 6].map((idx) => (
              <div
                key={idx}
                className="h-16 rounded-lg bg-sky-100/70 animate-pulse border border-sky-200"
              />
            ))}
          </div>
        ) : filteredZones.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            No zones match the current triage filter.
          </div>
        ) : (
          filteredZones.map((zone) => {
            const isSuggested = zone.id === suggestedZoneId;
            const statusText =
              zone.riskLevel === 'IMMEDIATE_RESCUE'
                ? {label: 'IMMEDIATE RESCUE', cls: 'text-red-700'}
                : zone.riskLevel === 'PRE_STAGE'
                  ? {label: 'PRE-STAGE', cls: 'text-amber-700'}
                  : {label: 'NORMAL', cls: 'text-emerald-700'};

            return (
              <button
                key={zone.id}
                type="button"
                onClick={() => onSelectZone(zone)}
                className={`w-full text-left px-4 py-3 transition-colors flex items-center justify-between gap-3 cursor-pointer group ${
                  isSuggested
                    ? 'bg-[#DCFCE7] hover:bg-[#BBF7D0]/85 border-b border-emerald-300'
                    : 'bg-white hover:bg-sky-50'
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`text-sm sm:text-base font-bold truncate ${
                        isSuggested
                          ? 'bg-[#BBF7D0] text-[#064E3B] px-2 py-0.5 rounded-md border border-emerald-400'
                          : 'text-slate-900'
                      }`}
                    >
                      {zone.name}
                    </span>
                    <span className="text-xs font-medium text-slate-600 shrink-0">
                      {zone.corridor}
                    </span>
                  </div>

                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs font-mono text-slate-600">
                    <span className={`font-bold ${statusText.cls}`}>{statusText.label}</span>
                    <span aria-hidden="true">·</span>
                    <span>
                      {zone.elevationMeters !== null ? `${zone.elevationMeters}m` : '--'} (
                      {zone.terrainVulnerability.toFixed(2)}×)
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>
                      {zone.weather.currentQpfMm.toFixed(1)}mm ({zone.weather.probabilityPercent}%)
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <div className="text-right">
                    <div className="font-mono text-base font-bold text-slate-900">
                      {zone.riskScore}
                    </div>
                    <div className="text-xs text-slate-500">Risk</div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-sky-600 transition-colors" />
                </div>
              </button>
            );
          })
        )}
      </div>

      {/* Author Attribution Footer */}
      <div className="px-4 py-2.5 bg-sky-100/70 border-t border-sky-200 text-xs text-slate-700 flex items-center justify-between gap-2 shrink-0">
        <div className="min-w-0">
          <div className="font-bold text-slate-900 truncate">
            Nicholas Musau: GDE Google Earth Engine *
          </div>
          <div className="text-xs text-slate-600 truncate">
            Sustainable Finance &amp; Climate Risk Portfolio Analyst
          </div>
        </div>
        <a
          href="https://www.linkedin.com/in/nicholas-musau/"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 font-semibold text-sky-700 hover:text-sky-900 underline shrink-0"
        >
          <span>LinkedIn</span>
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    </aside>
  );
};
