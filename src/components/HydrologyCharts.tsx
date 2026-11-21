import React, {useMemo, useState} from 'react';
import {Activity, CloudRain, Layers, Mountain} from 'lucide-react';
import {FloodZone} from '../types/flood';

interface HydrologyChartsProps {
  regionName: string;
  averageElevationMeters: number | null;
  zones: FloodZone[];
  suggestedZoneId: string | null;
  onSelectZoneForDispatch: (zone: FloodZone) => void;
}

export const ZoneHydrologyMiniChart: React.FC<{
  zone: FloodZone;
  averageElevationMeters: number | null;
  peakRegionQpf: number;
}> = ({zone, averageElevationMeters, peakRegionQpf}) => {
  const maxQpf = Math.max(25, peakRegionQpf, zone.weather.forecast24hQpfMm, zone.weather.currentQpfMm);
  const currentPct = Math.min(100, (zone.weather.currentQpfMm / maxQpf) * 100);
  const forecastPct = Math.min(100, (zone.weather.forecast24hQpfMm / maxQpf) * 100);

  const elevDiff =
    zone.elevationMeters !== null && averageElevationMeters !== null
      ? Math.round(zone.elevationMeters - averageElevationMeters)
      : null;

  return (
    <div className="bg-sky-50/70 border border-sky-200 rounded-xl p-3.5 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-800">Hydrological Profile</span>
        <span className="font-mono text-xs text-sky-800">
          Max Ref: {maxQpf.toFixed(0)} mm
        </span>
      </div>

      <div className="space-y-2">
        <div>
          <div className="flex justify-between text-xs text-slate-700 mb-1">
            <span>Current QPF</span>
            <span className="font-mono font-semibold">{zone.weather.currentQpfMm.toFixed(1)} mm</span>
          </div>
          <div className="h-2.5 w-full bg-sky-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-sky-600 rounded-full transition-all duration-200"
              style={{width: `${currentPct}%`}}
            />
          </div>
        </div>

        <div>
          <div className="flex justify-between text-xs text-slate-700 mb-1">
            <span>24h Forecast QPF</span>
            <span className="font-mono font-semibold">
              {zone.weather.forecast24hQpfMm.toFixed(1)} mm
            </span>
          </div>
          <div className="h-2.5 w-full bg-sky-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-indigo-500 rounded-full transition-all duration-200"
              style={{width: `${forecastPct}%`}}
            />
          </div>
        </div>
      </div>

      {elevDiff !== null && (
        <div className="pt-2 border-t border-sky-200/80 flex items-center justify-between text-xs text-slate-700">
          <span>Relative to Basin Mean Elev</span>
          <span
            className={`font-mono font-semibold ${
              elevDiff < 0 ? 'text-red-700' : 'text-emerald-700'
            }`}
          >
            {elevDiff >= 0 ? `+${elevDiff} m (Ridge)` : `${elevDiff} m (Low Basin)`}
          </span>
        </div>
      )}
    </div>
  );
};

export const HydrologyCharts: React.FC<HydrologyChartsProps> = ({
  regionName,
  averageElevationMeters,
  zones,
  suggestedZoneId,
  onSelectZoneForDispatch,
}) => {
  const [hoveredScatterZone, setHoveredScatterZone] = useState<FloodZone | null>(null);

  const top10Zones = useMemo(() => zones.slice(0, 10), [zones]);

  const maxQpfScale = useMemo(() => {
    const maxVal = Math.max(
      20,
      ...top10Zones.map((z) => Math.max(z.weather.currentQpfMm, z.weather.forecast24hQpfMm))
    );
    return Math.ceil(maxVal / 10) * 10;
  }, [top10Zones]);

  const scatterMetrics = useMemo(() => {
    const withElev = zones.filter((z) => z.elevationMeters !== null);
    if (withElev.length === 0) return null;

    const minElev = Math.min(...withElev.map((z) => z.elevationMeters!));
    const maxElev = Math.max(...withElev.map((z) => z.elevationMeters!));
    const elevSpan = Math.max(20, maxElev - minElev);
    const maxRisk = Math.max(1500, ...withElev.map((z) => z.riskScore));

    return {withElev, minElev, maxElev, elevSpan, maxRisk};
  }, [zones]);

  const corridorStats = useMemo(() => {
    const groups: Record<
      string,
      {
        corridor: string;
        count: number;
        immediate: number;
        preStage: number;
        normal: number;
        avgQpf: number;
        avgForecast: number;
        avgElev: number | null;
      }
    > = {};

    const elevTotals: Record<string, {sum: number; count: number}> = {};

    for (const z of zones) {
      const key = z.corridor || 'General';
      if (!groups[key]) {
        groups[key] = {
          corridor: key,
          count: 0,
          immediate: 0,
          preStage: 0,
          normal: 0,
          avgQpf: 0,
          avgForecast: 0,
          avgElev: null,
        };
        elevTotals[key] = {sum: 0, count: 0};
      }
      const g = groups[key];
      g.count++;
      if (z.riskLevel === 'IMMEDIATE_RESCUE') g.immediate++;
      else if (z.riskLevel === 'PRE_STAGE') g.preStage++;
      else g.normal++;
      g.avgQpf += z.weather.currentQpfMm;
      g.avgForecast += z.weather.forecast24hQpfMm;
      if (z.elevationMeters !== null) {
        elevTotals[key].sum += z.elevationMeters;
        elevTotals[key].count++;
      }
    }

    return Object.values(groups)
      .map((g) => ({
        ...g,
        avgQpf: Number((g.avgQpf / g.count).toFixed(1)),
        avgForecast: Number((g.avgForecast / g.count).toFixed(1)),
        avgElev:
          elevTotals[g.corridor].count > 0
            ? Math.round(elevTotals[g.corridor].sum / elevTotals[g.corridor].count)
            : null,
      }))
      .sort((a, b) => b.avgForecast - a.avgForecast);
  }, [zones]);

  return (
    <div className="flex-1 overflow-y-auto bg-[#EFF6FF] text-slate-900">
      <div className="max-w-6xl mx-auto px-6 py-7 space-y-7">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-sky-200 pb-4">
          <div>
            <h1 className="font-display text-2xl font-bold text-slate-900">
              Hydrological Analytics — {regionName}
            </h1>
            <p className="text-sm sm:text-base text-slate-600 mt-1">
              Precipitation load, 24-hour QPF projections, and terrain elevation risk correlation across{' '}
              <span className="font-mono font-semibold text-sky-900">{zones.length}</span> monitored zones.
            </p>
          </div>
          <div className="flex items-center gap-3 text-sm font-mono text-slate-700 bg-white border border-sky-200 rounded-lg px-3.5 py-2 shrink-0">
            <span>Basin Mean Elev:</span>
            <strong className="text-sky-900">
              {averageElevationMeters !== null ? `${Math.round(averageElevationMeters)} m` : '--'}
            </strong>
          </div>
        </div>

        {/* Row 1: Current vs 24h Forecast QPF & Elevation vs Risk Scatter */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* Chart 1: Top 10 QPF Comparison */}
          <section className="bg-white border border-sky-200 rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <CloudRain className="w-5 h-5 text-sky-600" />
                <h2 className="font-display text-lg font-bold text-slate-900">
                  Current vs. 24h Forecast QPF (Top 10 Zones)
                </h2>
              </div>
              <div className="flex items-center gap-3 text-xs font-medium text-slate-600 shrink-0">
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-xs bg-sky-600" />
                  Current
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-xs bg-indigo-400" />
                  24h Forecast
                </span>
              </div>
            </div>

            <div className="space-y-3">
              {top10Zones.map((zone) => {
                const isSuggested = zone.id === suggestedZoneId;
                const currWidth = Math.min(100, (zone.weather.currentQpfMm / maxQpfScale) * 100);
                const foreWidth = Math.min(100, (zone.weather.forecast24hQpfMm / maxQpfScale) * 100);

                return (
                  <button
                    key={zone.id}
                    type="button"
                    onClick={() => onSelectZoneForDispatch(zone)}
                    className="w-full text-left group cursor-pointer rounded-lg p-1.5 -mx-1.5 hover:bg-sky-50 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2 text-sm mb-1">
                      <span
                        className={`font-semibold truncate px-1.5 py-0.5 rounded ${
                          isSuggested
                            ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                            : 'text-slate-800 group-hover:text-sky-800'
                        }`}
                      >
                        {zone.name}
                        {isSuggested ? ' · Suggested Dispatch' : ''}
                      </span>
                      <span className="font-mono text-xs text-slate-600 shrink-0">
                        {zone.weather.currentQpfMm.toFixed(1)} / {zone.weather.forecast24hQpfMm.toFixed(1)} mm
                      </span>
                    </div>

                    <div className="space-y-1">
                      <div className="h-2 bg-sky-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-sky-600 rounded-full"
                          style={{width: `${currWidth}%`}}
                        />
                      </div>
                      <div className="h-2 bg-indigo-50 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-indigo-400 rounded-full"
                          style={{width: `${foreWidth}%`}}
                        />
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Chart 2: Elevation vs Risk Score Correlation */}
          <section className="bg-white border border-sky-200 rounded-2xl p-5 shadow-xs flex flex-col justify-between space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Mountain className="w-5 h-5 text-sky-600" />
                <h2 className="font-display text-lg font-bold text-slate-900">
                  Terrain Elevation vs. Flood Risk Score
                </h2>
              </div>
              <span className="text-xs font-mono text-slate-500">Click point to inspect</span>
            </div>

            {scatterMetrics ? (
              <div className="relative">
                <svg
                  viewBox="0 0 560 300"
                  className="w-full h-auto bg-sky-50/50 border border-sky-100 rounded-xl"
                  role="img"
                  aria-label="Scatter plot comparing ground elevation to flood risk score"
                >
                  {/* Horizontal Grid Lines */}
                  {[0.25, 0.5, 0.75].map((ratio) => {
                    const y = 260 - ratio * 220;
                    const labelVal = Math.round(scatterMetrics.maxRisk * ratio);
                    return (
                      <g key={ratio}>
                        <line x1={55} y1={y} x2={535} y2={y} stroke="#BAE6FD" strokeDasharray="3 3" />
                        <text x={48} y={y + 4} textAnchor="end" fontSize="11" fill="#475569" fontFamily="JetBrains Mono">
                          {labelVal}
                        </text>
                      </g>
                    );
                  })}

                  {/* Axes */}
                  <line x1={55} y1={260} x2={535} y2={260} stroke="#7DD3FC" strokeWidth="1.5" />
                  <line x1={55} y1={30} x2={55} y2={260} stroke="#7DD3FC" strokeWidth="1.5" />

                  {/* Mean Elevation Vertical Marker */}
                  {averageElevationMeters !== null && (
                    <g>
                      {(() => {
                        const meanX =
                          65 +
                          ((averageElevationMeters - scatterMetrics.minElev) /
                            scatterMetrics.elevSpan) *
                            455;
                        return (
                          <>
                            <line
                              x1={meanX}
                              y1={30}
                              x2={meanX}
                              y2={260}
                              stroke="#0284C7"
                              strokeDasharray="4 4"
                              strokeWidth="1.5"
                            />
                            <text
                              x={meanX}
                              y={22}
                              textAnchor="middle"
                              fontSize="11"
                              fill="#0369A1"
                              fontWeight="600"
                            >
                              Mean {Math.round(averageElevationMeters)}m
                            </text>
                          </>
                        );
                      })()}
                    </g>
                  )}

                  {/* Data Points */}
                  {scatterMetrics.withElev.map((z) => {
                    const cx =
                      65 + ((z.elevationMeters! - scatterMetrics.minElev) / scatterMetrics.elevSpan) * 455;
                    const cy = 260 - Math.min(1, z.riskScore / scatterMetrics.maxRisk) * 220;
                    const isSuggested = z.id === suggestedZoneId;
                    const fill =
                      z.riskLevel === 'IMMEDIATE_RESCUE'
                        ? '#DC2626'
                        : z.riskLevel === 'PRE_STAGE'
                          ? '#D97706'
                          : '#059669';

                    return (
                      <g
                        key={z.id}
                        className="cursor-pointer"
                        onMouseEnter={() => setHoveredScatterZone(z)}
                        onMouseLeave={() => setHoveredScatterZone(null)}
                        onClick={() => onSelectZoneForDispatch(z)}
                      >
                        {isSuggested && (
                          <circle
                            cx={cx}
                            cy={cy}
                            r={12}
                            fill="#BBF7D0"
                            stroke="#16A34A"
                            strokeWidth="2"
                          />
                        )}
                        <circle
                          cx={cx}
                          cy={cy}
                          r={isSuggested ? 6.5 : 5.5}
                          fill={fill}
                          stroke="#FFFFFF"
                          strokeWidth="1.5"
                        />
                      </g>
                    );
                  })}

                  {/* X-Axis Labels */}
                  <text x={65} y={282} textAnchor="start" fontSize="11" fill="#475569" fontFamily="JetBrains Mono">
                    {Math.round(scatterMetrics.minElev)}m (Low Basin)
                  </text>
                  <text x={525} y={282} textAnchor="end" fontSize="11" fill="#475569" fontFamily="JetBrains Mono">
                    {Math.round(scatterMetrics.maxElev)}m (High Ridge)
                  </text>
                </svg>

                <div className="mt-3 min-h-[28px] flex items-center justify-between text-xs sm:text-sm text-slate-700 bg-sky-50 border border-sky-200 rounded-lg px-3 py-1.5">
                  {hoveredScatterZone ? (
                    <>
                      <span className="font-semibold text-slate-900">{hoveredScatterZone.name}</span>
                      <span className="font-mono text-sky-900">
                        {hoveredScatterZone.elevationMeters}m · Risk {hoveredScatterZone.riskScore} ·{' '}
                        {hoveredScatterZone.weather.currentQpfMm.toFixed(1)}mm
                      </span>
                    </>
                  ) : (
                    <span className="text-slate-500">
                      Hover or click any point to inspect elevation-vs-risk metrics. Light-green ring marks Suggested Dispatch Zone.
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <div className="p-8 text-center text-sm text-slate-500">
                Elevation data is loading for this region.
              </div>
            )}
          </section>
        </div>

        {/* Row 2: Corridor Hydrological Breakdown */}
        <section className="bg-white border border-sky-200 rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-sky-600" />
            <h2 className="font-display text-lg font-bold text-slate-900">
              Corridor Hydrological Exposure Summary
            </h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-sky-200 text-xs font-semibold text-slate-600">
                  <th className="py-2.5 pr-4">Corridor / Sector</th>
                  <th className="py-2.5 px-4 text-right">Zones</th>
                  <th className="py-2.5 px-4 text-right">Mean Elev</th>
                  <th className="py-2.5 px-4 text-right">Avg Current QPF</th>
                  <th className="py-2.5 px-4 text-right">Avg 24h QPF</th>
                  <th className="py-2.5 pl-4">Risk Breakdown</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sky-100 text-sm">
                {corridorStats.map((row) => (
                  <tr key={row.corridor} className="hover:bg-sky-50/70">
                    <td className="py-3 pr-4 font-semibold text-slate-900">{row.corridor}</td>
                    <td className="py-3 px-4 text-right font-mono">{row.count}</td>
                    <td className="py-3 px-4 text-right font-mono">
                      {row.avgElev !== null ? `${row.avgElev} m` : '--'}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-sky-800">
                      {row.avgQpf.toFixed(1)} mm
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-semibold text-indigo-700">
                      {row.avgForecast.toFixed(1)} mm
                    </td>
                    <td className="py-3 pl-4">
                      <div className="flex items-center gap-3 font-mono text-xs">
                        <span className="text-red-700 font-semibold">{row.immediate} Rescue</span>
                        <span className="text-amber-700 font-semibold">{row.preStage} Pre-Stage</span>
                        <span className="text-emerald-700">{row.normal} Normal</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-500 pt-1">
            <Activity className="w-4 h-4 text-sky-600" />
            <span>
              All charts dynamically update when switching regions, uploading custom CSVs, or toggling Live API vs. Storm Simulation.
            </span>
          </div>
        </section>
      </div>
    </div>
  );
};
