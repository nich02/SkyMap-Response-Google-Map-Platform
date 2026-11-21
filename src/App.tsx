import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  APILoadingStatus,
  APIProvider,
  useApiLoadingStatus,
  useMapsLibrary,
} from '@vis.gl/react-google-maps';
import {AlertCircle} from 'lucide-react';
import {AboutPage} from './components/AboutPage';
import {CommandCopilot} from './components/CommandCopilot';
import {CommandMap} from './components/CommandMap';
import {CsvUploadModal, ParsedCsvRow} from './components/CsvUploadModal';
import {HydrologyCharts} from './components/HydrologyCharts';
import {AppTab, TopCommandBar} from './components/TopCommandBar';
import {TriageSidebar} from './components/TriageSidebar';
import {
  NAIROBI_39_PRESET,
  NAIROBI_COUNTY_BOUNDARY,
  NAIROBI_REGION_CENTER,
} from './data/nairobiPreset';
import {
  computeRescueRoute,
  discoverSubZonesInRegion,
  fetchBatchElevations,
  fetchLiveWeatherForPoint,
  findHighElevationStagingSites,
  geocodeZoneName,
  getGoogleMapsApiKey,
} from './services/googleMapsServices';
import {
  generateSimulatedAlert,
  generateStormSimulationForZones,
} from './services/simulationEngine';
import {
  ActiveRegion,
  DataMode,
  FloodZone,
  PublicWeatherAlert,
  RescueRouteInfo,
  StagingSite,
} from './types/flood';
import {recalculateRegionMetrics} from './utils/riskEngine';
import {loadCommandState, saveCommandState} from './utils/storage';

const API_KEY = getGoogleMapsApiKey();

function buildInitialNairobiState(): {
  region: ActiveRegion;
  zones: FloodZone[];
  dataMode: DataMode;
} {
  const persisted = loadCommandState();
  if (persisted) {
    return {
      region: persisted.region,
      zones: persisted.zones,
      dataMode: persisted.dataMode,
    };
  }

  const region: ActiveRegion = {
    name: 'Nairobi, Kenya',
    center: NAIROBI_REGION_CENTER,
    boundaryPath: NAIROBI_COUNTY_BOUNDARY,
    averageElevationMeters: null,
  };

  const simWeather = generateStormSimulationForZones(
    NAIROBI_39_PRESET.map((s) => ({
      id: s.id,
      name: s.name,
      lat: s.lat,
      lng: s.lng,
      elevationMeters: s.baselineElevationM,
      customWeight: s.customWeight,
    })),
    'SEVERE'
  );

  const initialZones: FloodZone[] = NAIROBI_39_PRESET.map((seed) => ({
    id: seed.id,
    name: seed.name,
    corridor: seed.corridor,
    lat: seed.lat,
    lng: seed.lng,
    elevationMeters: seed.baselineElevationM,
    terrainVulnerability: 1.0,
    customWeight: seed.customWeight,
    weather: simWeather[seed.id],
    riskScore: 0,
    riskLevel: 'NORMAL',
    source: 'PRESET',
  }));

  const calculated = recalculateRegionMetrics(initialZones);
  return {
    region: {...region, averageElevationMeters: calculated.averageElevationMeters},
    zones: calculated.zones,
    dataMode: 'SIMULATION',
  };
}

const SkyMapWorkspace: React.FC = () => {
  const apiStatus = useApiLoadingStatus();
  const placesLib = useMapsLibrary('places');
  const elevationLib = useMapsLibrary('elevation');
  const routesLib = useMapsLibrary('routes');

  const initial = useMemo(() => buildInitialNairobiState(), []);
  const [activeTab, setActiveTab] = useState<AppTab>('map');
  const [isCopilotOpen, setIsCopilotOpen] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 1280 : false
  );

  const [activeRegion, setActiveRegion] = useState<ActiveRegion>(initial.region);
  const [rawZones, setRawZones] = useState<FloodZone[]>(initial.zones);
  const [dataMode, setDataMode] = useState<DataMode>(initial.dataMode);
  const [liveAlerts, setLiveAlerts] = useState<PublicWeatherAlert[]>([]);
  const [weatherStatusNotice, setWeatherStatusNotice] = useState<string | null>(null);
  const [isDiscovering, setIsDiscovering] = useState(false);

  // Selection, staging sites, and route state
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [stagingSites, setStagingSites] = useState<StagingSite[]>([]);
  const [selectedStagingId, setSelectedStagingId] = useState<string | null>(null);
  const [routeInfo, setRouteInfo] = useState<RescueRouteInfo | null>(null);
  const [isLoadingStaging, setIsLoadingStaging] = useState(false);
  const [isLoadingRoute, setIsLoadingRoute] = useState(false);
  const [stagingError, setStagingError] = useState<string | null>(null);
  const [routeError, setRouteError] = useState<string | null>(null);

  // CSV Modal state
  const [csvModalOpen, setCsvModalOpen] = useState(false);
  const [csvProcessing, setCsvProcessing] = useState(false);
  const [csvProgress, setCsvProgress] = useState<string | null>(null);
  const [csvError, setCsvError] = useState<string | null>(null);

  const elevationVerifiedRegionRef = useRef<string>('');

  // Derived hydrological triage, flow vectors, and upstream domino warnings
  const derived = useMemo(() => recalculateRegionMetrics(rawZones), [rawZones]);
  const suggestedZone = derived.zones[0] ?? null;
  const suggestedZoneId = suggestedZone?.id ?? null;

  const selectedZone = useMemo(
    () => derived.zones.find((z) => z.id === selectedZoneId) ?? null,
    [derived.zones, selectedZoneId]
  );

  const effectiveRegion = useMemo<ActiveRegion>(
    () => ({
      ...activeRegion,
      averageElevationMeters: derived.averageElevationMeters,
    }),
    [activeRegion, derived.averageElevationMeters]
  );

  const publicAlerts = useMemo(() => {
    if (dataMode === 'SIMULATION') {
      return generateSimulatedAlert(activeRegion.name, derived.zones);
    }
    return liveAlerts;
  }, [dataMode, activeRegion.name, derived.zones, liveAlerts]);

  // Persist active state in localStorage
  useEffect(() => {
    saveCommandState({
      region: effectiveRegion,
      zones: derived.zones,
      dataMode,
    });
  }, [effectiveRegion, derived.zones, dataMode]);

  // Hydrate exact ground elevations from Elevation API once library loads
  useEffect(() => {
    if (!elevationLib || rawZones.length === 0) return;
    const regionSignature = `${activeRegion.name}::${rawZones.map((z) => z.id).join(',')}`;
    if (elevationVerifiedRegionRef.current === regionSignature) return;
    elevationVerifiedRegionRef.current = regionSignature;

    let cancelled = false;
    void fetchBatchElevations(
      elevationLib,
      rawZones.map((z) => ({lat: z.lat, lng: z.lng}))
    ).then((elevations) => {
      if (cancelled) return;
      const hasAny = elevations.some((e) => e !== null);
      if (!hasAny) return;

      setRawZones((prev) =>
        prev.map((z, idx) => ({
          ...z,
          elevationMeters: elevations[idx] ?? z.elevationMeters,
        }))
      );
    });

    return () => {
      cancelled = true;
    };
  }, [elevationLib, activeRegion.name, rawZones]);

  const applyWeatherForZones = useCallback(
    async (zonesToUpdate: FloodZone[], mode: DataMode, regionLabel: string) => {
      if (mode === 'SIMULATION') {
        const simMap = generateStormSimulationForZones(zonesToUpdate, 'SEVERE');
        setWeatherStatusNotice(
          `Storm Simulation Mode active for ${regionLabel} — synthetic convective cells applied.`
        );
        setLiveAlerts([]);
        return zonesToUpdate.map((z) => ({
          ...z,
          weather: simMap[z.id] ?? z.weather,
        }));
      }

      if (!API_KEY) {
        setWeatherStatusNotice('Missing API key for Live Weather API. Using Storm Simulation.');
        return zonesToUpdate;
      }

      setWeatherStatusNotice('Fetching live conditions, 24h forecast & public alerts...');
      const updated = [...zonesToUpdate];
      const collectedAlerts: PublicWeatherAlert[] = [];
      const seenAlertIds = new Set<string>();
      let successCount = 0;

      const CONCURRENCY = 6;
      for (let i = 0; i < updated.length; i += CONCURRENCY) {
        const batch = updated.slice(i, i + CONCURRENCY);
        const results = await Promise.allSettled(
          batch.map((z, batchIdx) =>
            fetchLiveWeatherForPoint(z.lat, z.lng, API_KEY, i + batchIdx < 3)
          )
        );

        results.forEach((res, batchIdx) => {
          if (res.status === 'fulfilled') {
            successCount++;
            updated[i + batchIdx] = {
              ...updated[i + batchIdx],
              weather: res.value.weather,
            };
            for (const al of res.value.alerts) {
              if (!seenAlertIds.has(al.alertId)) {
                seenAlertIds.add(al.alertId);
                collectedAlerts.push(al);
              }
            }
          }
        });
      }

      if (successCount === 0) {
        setWeatherStatusNotice(
          'Live Weather API unavailable on this key or region — switch to Storm Sim to test flood dispatch.'
        );
        return zonesToUpdate;
      }

      setLiveAlerts(collectedAlerts);
      const maxQpf = Math.max(...updated.map((z) => z.weather.currentQpfMm), 0);
      if (maxQpf === 0) {
        setWeatherStatusNotice(
          `Live Weather API active (${successCount}/${updated.length} stations): dry/clear conditions right now.`
        );
      } else {
        setWeatherStatusNotice(null);
      }

      return updated;
    },
    []
  );

  // Toggle Live API vs Storm Simulation
  const handleToggleDataMode = useCallback(
    async (nextMode: DataMode) => {
      if (nextMode === dataMode) return;
      setDataMode(nextMode);
      setIsDiscovering(true);
      try {
        const nextZones = await applyWeatherForZones(rawZones, nextMode, activeRegion.name);
        setRawZones(nextZones);
      } finally {
        setIsDiscovering(false);
      }
    },
    [dataMode, rawZones, activeRegion.name, applyWeatherForZones]
  );

  // Load Nairobi 39 Flood Zones Preset
  const handleLoadNairobiPreset = useCallback(async () => {
    setSelectedZoneId(null);
    setStagingSites([]);
    setSelectedStagingId(null);
    setRouteInfo(null);
    setIsDiscovering(true);
    setActiveTab('map');

    const region: ActiveRegion = {
      name: 'Nairobi, Kenya',
      center: NAIROBI_REGION_CENTER,
      boundaryPath: NAIROBI_COUNTY_BOUNDARY,
      averageElevationMeters: null,
    };

    try {
      let elevations: (number | null)[] = NAIROBI_39_PRESET.map((s) => s.baselineElevationM);
      if (elevationLib) {
        const fetched = await fetchBatchElevations(
          elevationLib,
          NAIROBI_39_PRESET.map((s) => ({lat: s.lat, lng: s.lng}))
        );
        elevations = fetched.map((val, idx) => val ?? NAIROBI_39_PRESET[idx].baselineElevationM);
      }

      const seedZones: FloodZone[] = NAIROBI_39_PRESET.map((seed, idx) => ({
        id: seed.id,
        name: seed.name,
        corridor: seed.corridor,
        lat: seed.lat,
        lng: seed.lng,
        elevationMeters: elevations[idx],
        terrainVulnerability: 1.0,
        customWeight: seed.customWeight,
        weather: {
          probabilityPercent: 0,
          precipitationType: 'NONE',
          currentQpfMm: 0,
          forecast24hQpfMm: 0,
          forecastMaxProbabilityPercent: 0,
          isSimulated: dataMode === 'SIMULATION',
        },
        riskScore: 0,
        riskLevel: 'NORMAL',
        source: 'PRESET',
      }));

      const withWeather = await applyWeatherForZones(seedZones, dataMode, region.name);
      elevationVerifiedRegionRef.current = `${region.name}::${withWeather.map((z) => z.id).join(',')}`;
      setActiveRegion(region);
      setRawZones(withWeather);
    } finally {
      setIsDiscovering(false);
    }
  }, [elevationLib, dataMode, applyWeatherForZones]);

  // Region Search Autocomplete Selection -> Instant Zoom & Sub-Zone Discovery
  const handleSelectSearchedRegion = useCallback(
    async (place: google.maps.places.Place) => {
      if (!placesLib || !place.location) return;
      setSelectedZoneId(null);
      setStagingSites([]);
      setSelectedStagingId(null);
      setRouteInfo(null);
      setIsDiscovering(true);
      setActiveTab('map');

      const center = {lat: place.location.lat(), lng: place.location.lng()};
      const vp = place.viewport
        ? {
            north: place.viewport.getNorthEast().lat(),
            east: place.viewport.getNorthEast().lng(),
            south: place.viewport.getSouthWest().lat(),
            west: place.viewport.getSouthWest().lng(),
          }
        : undefined;

      const regionName = place.formattedAddress || place.displayName || 'Selected Region';
      const newRegion: ActiveRegion = {
        name: regionName,
        center,
        viewport: vp,
        averageElevationMeters: null,
      };

      try {
        const discovered = await discoverSubZonesInRegion(placesLib, newRegion);
        const seeds =
          discovered.length > 0
            ? discovered
            : [
                {
                  id: 'center-zone',
                  name: place.displayName || regionName,
                  corridor: 'Central',
                  lat: center.lat,
                  lng: center.lng,
                  placeId: place.id,
                },
              ];

        const elevations = elevationLib
          ? await fetchBatchElevations(
              elevationLib,
              seeds.map((s) => ({lat: s.lat, lng: s.lng}))
            )
          : new Array(seeds.length).fill(null);

        const builtZones: FloodZone[] = seeds.map((s, idx) => ({
          id: s.id,
          name: s.name,
          corridor: s.corridor,
          lat: s.lat,
          lng: s.lng,
          elevationMeters: elevations[idx],
          terrainVulnerability: 1.0,
          customWeight: 1.0,
          weather: {
            probabilityPercent: 0,
            precipitationType: 'NONE',
            currentQpfMm: 0,
            forecast24hQpfMm: 0,
            forecastMaxProbabilityPercent: 0,
            isSimulated: dataMode === 'SIMULATION',
          },
          riskScore: 0,
          riskLevel: 'NORMAL',
          source: 'DISCOVERED',
          placeId: s.placeId,
        }));

        const withWeather = await applyWeatherForZones(builtZones, dataMode, regionName);
        elevationVerifiedRegionRef.current = `${regionName}::${withWeather.map((z) => z.id).join(',')}`;
        setActiveRegion(newRegion);
        setRawZones(withWeather);
      } finally {
        setIsDiscovering(false);
      }
    },
    [placesLib, elevationLib, dataMode, applyWeatherForZones]
  );

  // Import Custom CSV (`zone_name, vulnerability_weight`) via Geocoding API + 30-day cache
  const handleImportCsvRows = useCallback(
    async (rows: ParsedCsvRow[]) => {
      setCsvProcessing(true);
      setCsvError(null);
      setCsvProgress(`Geocoding 0 / ${rows.length} zones...`);

      try {
        const geocodedSeeds: Array<{
          id: string;
          name: string;
          lat: number;
          lng: number;
          customWeight: number;
        }> = [];
        let cacheHits = 0;

        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          setCsvProgress(`Geocoding ${i + 1} / ${rows.length}: ${row.zoneName}...`);
          const geo = await geocodeZoneName(row.zoneName, activeRegion, API_KEY, placesLib);
          if (geo) {
            if (geo.fromCache) cacheHits++;
            geocodedSeeds.push({
              id: `csv-${i + 1}-${row.zoneName.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 10)}`,
              name: row.zoneName,
              lat: geo.lat,
              lng: geo.lng,
              customWeight: row.vulnerabilityWeight,
            });
          }
        }

        if (geocodedSeeds.length === 0) {
          setCsvError('Could not geocode any zone names. Try including city/country names.');
          return;
        }

        setCsvProgress(
          `Fetching elevation for ${geocodedSeeds.length} zones (${cacheHits} from cache)...`
        );
        const elevations = elevationLib
          ? await fetchBatchElevations(
              elevationLib,
              geocodedSeeds.map((s) => ({lat: s.lat, lng: s.lng}))
            )
          : new Array(geocodedSeeds.length).fill(null);

        const built: FloodZone[] = geocodedSeeds.map((s, idx) => ({
          id: s.id,
          name: s.name,
          corridor: 'Custom CSV',
          lat: s.lat,
          lng: s.lng,
          elevationMeters: elevations[idx],
          terrainVulnerability: 1.0,
          customWeight: s.customWeight,
          weather: {
            probabilityPercent: 0,
            precipitationType: 'NONE',
            currentQpfMm: 0,
            forecast24hQpfMm: 0,
            forecastMaxProbabilityPercent: 0,
            isSimulated: dataMode === 'SIMULATION',
          },
          riskScore: 0,
          riskLevel: 'NORMAL',
          source: 'CSV',
        }));

        const avgLat = built.reduce((a, b) => a + b.lat, 0) / built.length;
        const avgLng = built.reduce((a, b) => a + b.lng, 0) / built.length;
        const nextRegion: ActiveRegion = {
          name: `Custom CSV (${built.length} zones)`,
          center: {lat: avgLat, lng: avgLng},
          averageElevationMeters: null,
        };

        const withWeather = await applyWeatherForZones(built, dataMode, nextRegion.name);
        elevationVerifiedRegionRef.current = `${nextRegion.name}::${withWeather.map((z) => z.id).join(',')}`;
        setSelectedZoneId(null);
        setStagingSites([]);
        setSelectedStagingId(null);
        setRouteInfo(null);
        setActiveRegion(nextRegion);
        setRawZones(withWeather);
        setCsvModalOpen(false);
        setActiveTab('map');
      } catch (err) {
        setCsvError(err instanceof Error ? err.message : 'Failed to process CSV zones.');
      } finally {
        setCsvProcessing(false);
        setCsvProgress(null);
      }
    },
    [activeRegion, placesLib, elevationLib, dataMode, applyWeatherForZones]
  );

  // Route Calculation Helper
  const calculateRouteFromStaging = useCallback(
    async (site: StagingSite, zone: {lat: number; lng: number}) => {
      setSelectedStagingId(site.id);
      if (!routesLib) {
        setRouteError('Routes library is still loading.');
        return;
      }

      setIsLoadingRoute(true);
      setRouteError(null);
      setRouteInfo(null);

      try {
        const res = await computeRescueRoute(
          routesLib,
          {lat: site.lat, lng: site.lng},
          {lat: zone.lat, lng: zone.lng}
        );
        setRouteInfo({
          stagingSiteId: site.id,
          stagingSiteName: site.name,
          distanceMeters: res.distanceMeters,
          durationMillis: res.durationMillis,
          encodedPath: [],
          routeObject: res.route,
          warnings: res.warnings,
        });
      } catch (err) {
        setRouteError(
          err instanceof Error
            ? err.message
            : 'Unable to load route data. Please check your network or API quota.'
        );
      } finally {
        setIsLoadingRoute(false);
      }
    },
    [routesLib]
  );

  // Zone Selection -> Find High-Elevation Rescue Staging Sites & Compute Traffic-Aware Route
  const handleSelectZone = useCallback(
    async (zone: FloodZone) => {
      setActiveTab('map');
      setSelectedZoneId(zone.id);
      setStagingSites([]);
      setSelectedStagingId(null);
      setRouteInfo(null);
      setStagingError(null);
      setRouteError(null);

      if (!placesLib) {
        setStagingError('Places library is still initializing.');
        return;
      }

      setIsLoadingStaging(true);
      try {
        const sites = await findHighElevationStagingSites(placesLib, elevationLib, zone);
        setStagingSites(sites);
        if (sites.length > 0) {
          await calculateRouteFromStaging(sites[0], zone);
        }
      } catch (err) {
        setStagingError(
          err instanceof Error ? err.message : 'Failed to locate nearby high-ground staging sites.'
        );
      } finally {
        setIsLoadingStaging(false);
      }
    },
    [placesLib, elevationLib, calculateRouteFromStaging]
  );

  const handleSelectStagingSite = useCallback(
    (site: StagingSite) => {
      const zone = derived.zones.find((z) => z.id === selectedZoneId);
      if (!zone) return;
      void calculateRouteFromStaging(site, zone);
    },
    [derived.zones, selectedZoneId, calculateRouteFromStaging]
  );

  const handleClearSelectedZone = useCallback(() => {
    setSelectedZoneId(null);
    setStagingSites([]);
    setSelectedStagingId(null);
    setRouteInfo(null);
    setStagingError(null);
    setRouteError(null);
  }, []);

  const handleTriggerZoneSurge = useCallback((zoneId: string) => {
    setRawZones((prev) =>
      prev.map((z) =>
        z.id === zoneId
          ? {
              ...z,
              weather: {
                ...z.weather,
                probabilityPercent: 96,
                precipitationType: 'HEAVY_RAIN',
                currentQpfMm: 26.4,
                forecast24hQpfMm: Math.max(z.weather.forecast24hQpfMm, 44.0),
                conditionText: 'Simulated cloudburst surge cell',
                isSimulated: true,
              },
            }
          : z
      )
    );
  }, []);

  if (apiStatus === APILoadingStatus.AUTH_FAILURE || apiStatus === APILoadingStatus.FAILED) {
    return (
      <div className="flex-1 flex items-center justify-center p-6 bg-[#EFF6FF]">
        <div className="max-w-md w-full bg-white border border-red-200 rounded-2xl p-6 text-center space-y-3 shadow-sm">
          <AlertCircle className="w-8 h-8 text-red-600 mx-auto" />
          <h2 className="font-display text-xl font-bold text-slate-900">
            Unable to Load Google Maps Platform
          </h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            Please verify your Google Maps Platform API key configuration and enabled APIs (Maps
            JavaScript, Places New, Elevation, Routes, Geocoding).
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-[#EFF6FF]">
      <TopCommandBar
        activeTab={activeTab}
        onChangeTab={setActiveTab}
        activeRegion={effectiveRegion}
        dataMode={dataMode}
        isDiscovering={isDiscovering}
        isCopilotOpen={isCopilotOpen}
        onToggleCopilot={() => setIsCopilotOpen((open) => !open)}
        onSelectSearchedRegion={handleSelectSearchedRegion}
        onLoadNairobiPreset={() => void handleLoadNairobiPreset()}
        onOpenCsvModal={() => setCsvModalOpen(true)}
        onToggleDataMode={(mode) => void handleToggleDataMode(mode)}
      />

      <main className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-hidden">
        {activeTab === 'map' && (
          <div className="flex-1 min-w-0 min-h-0 flex flex-col lg:flex-row overflow-hidden">
            <CommandMap
              activeRegion={effectiveRegion}
              zones={derived.zones}
              flowEdges={derived.flowEdges}
              selectedZoneId={selectedZoneId}
              suggestedZoneId={suggestedZoneId}
              stagingSites={stagingSites}
              selectedStagingId={selectedStagingId}
              routeInfo={routeInfo}
              onSelectZone={(z) => void handleSelectZone(z)}
              onSelectStagingSite={handleSelectStagingSite}
            />

            <TriageSidebar
              regionName={effectiveRegion.name}
              averageElevationMeters={derived.averageElevationMeters}
              zones={derived.zones}
              flowEdges={derived.flowEdges}
              surgeWarnings={derived.surgeWarnings}
              publicAlerts={publicAlerts}
              dataMode={dataMode}
              isLoading={isDiscovering}
              weatherStatusNotice={weatherStatusNotice}
              selectedZoneId={selectedZoneId}
              suggestedZoneId={suggestedZoneId}
              stagingSites={stagingSites}
              selectedStagingId={selectedStagingId}
              routeInfo={routeInfo}
              isLoadingStaging={isLoadingStaging}
              isLoadingRoute={isLoadingRoute}
              stagingError={stagingError}
              routeError={routeError}
              onSelectZone={(z) => void handleSelectZone(z)}
              onClearSelectedZone={handleClearSelectedZone}
              onSelectStagingSite={handleSelectStagingSite}
              onTriggerZoneSurge={handleTriggerZoneSurge}
              onSwitchToSimulation={() => void handleToggleDataMode('SIMULATION')}
            />
          </div>
        )}

        {activeTab === 'charts' && (
          <HydrologyCharts
            regionName={effectiveRegion.name}
            averageElevationMeters={derived.averageElevationMeters}
            zones={derived.zones}
            suggestedZoneId={suggestedZoneId}
            onSelectZoneForDispatch={(zone) => void handleSelectZone(zone)}
          />
        )}

        {activeTab === 'about' && (
          <AboutPage
            onNavigateToMap={() => setActiveTab('map')}
            onNavigateToCharts={() => setActiveTab('charts')}
            onOpenCopilot={() => setIsCopilotOpen(true)}
          />
        )}

        <CommandCopilot
          isOpen={isCopilotOpen}
          activeRegion={effectiveRegion}
          dataMode={dataMode}
          zones={derived.zones}
          suggestedZone={suggestedZone}
          surgeWarnings={derived.surgeWarnings}
          publicAlerts={publicAlerts}
          selectedZone={selectedZone}
          stagingSites={stagingSites}
          routeInfo={routeInfo}
          onClose={() => setIsCopilotOpen(false)}
        />
      </main>

      <CsvUploadModal
        isOpen={csvModalOpen}
        regionName={effectiveRegion.name}
        isProcessing={csvProcessing}
        progressText={csvProgress}
        errorText={csvError}
        onClose={() => !csvProcessing && setCsvModalOpen(false)}
        onImportRows={handleImportCsvRows}
      />
    </div>
  );
};

export default function App() {
  const [quotaExceeded, setQuotaExceeded] = useState(false);

  useEffect(() => {
    const handler = () => setQuotaExceeded(true);
    window.addEventListener('gmp-quota-exceeded', handler);
    return () => window.removeEventListener('gmp-quota-exceeded', handler);
  }, []);

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-[#EFF6FF] text-slate-900">
      {quotaExceeded && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-2.5 text-xs md:text-sm text-center sticky top-0 z-50 shadow-sm shrink-0">
          <span>
            Google Maps Platform quota reached. If you are the app owner, visit{' '}
            <a
              href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-semibold text-amber-950 hover:text-amber-800"
            >
              maps developer site
            </a>{' '}
            for instructions to update your account.
          </span>
        </div>
      )}

      {!API_KEY ? (
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white border border-sky-200 rounded-2xl p-6 text-center space-y-2 shadow-sm">
            <h1 className="font-display text-xl font-bold text-slate-900">SkyMap Response</h1>
            <p className="text-sm text-slate-600">
              Google Maps Platform API key is not configured. Set{' '}
              <code className="font-mono text-sky-800">VITE_GOOGLE_MAPS_API_KEY</code> in your
              environment to launch the tactical map.
            </p>
          </div>
        </div>
      ) : (
        <APIProvider
          apiKey={API_KEY}
          libraries={['places', 'marker', 'routes', 'elevation', 'geometry', 'core']}
          language="en"
        >
          <SkyMapWorkspace />
        </APIProvider>
      )}
    </div>
  );
}
