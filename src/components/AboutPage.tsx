import React from 'react';
import {
  Activity,
  Bot,
  CloudRain,
  Compass,
  ExternalLink,
  Layers,
  MapPin,
  Navigation,
  ShieldAlert,
  TrendingUp,
} from 'lucide-react';

interface AboutPageProps {
  onNavigateToMap: () => void;
  onNavigateToCharts: () => void;
  onOpenCopilot: () => void;
}

export const AboutPage: React.FC<AboutPageProps> = ({
  onNavigateToMap,
  onNavigateToCharts,
  onOpenCopilot,
}) => {
  return (
    <div className="flex-1 overflow-y-auto bg-[#EFF6FF] text-slate-900">
      <div className="max-w-5xl mx-auto px-6 py-8 space-y-10">
        {/* Hero Overview */}
        <section className="bg-white border border-sky-200 rounded-2xl p-6 sm:p-8 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center gap-5">
            <img
              src="/src/assets/images/skymap_response_logo_1795262577811.jpg"
              alt="SkyMap Response Logo"
              referrerPolicy="no-referrer"
              className="w-16 h-16 rounded-xl object-cover border border-sky-200 shrink-0 bg-sky-50"
            />
            <div className="space-y-2">
              <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
                SkyMap Response
              </h1>
              <p className="text-base text-slate-700 leading-relaxed max-w-3xl">
                SkyMap Response is a dynamic, AI-driven{' '}
                <strong className="font-semibold text-sky-900">
                  Flood Risk and Response Information System
                </strong>{' '}
                built on the <strong className="font-semibold text-sky-900">Google Maps Platform</strong>.
                It helps emergency dispatchers discover vulnerable neighborhoods in any city or
                catchment basin, model elevation-driven runoff cascades, track live and forecasted
                rainfall, compute traffic-aware rescue routes from high-ground staging facilities,
                and collaborate with an AI Command Copilot.
              </p>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={onNavigateToMap}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold bg-sky-600 hover:bg-sky-700 text-white transition-colors cursor-pointer"
            >
              <MapPin className="w-4 h-4" />
              <span>Open Command Map</span>
            </button>
            <button
              type="button"
              onClick={onNavigateToCharts}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold bg-sky-100 hover:bg-sky-200 text-sky-900 border border-sky-300 transition-colors cursor-pointer"
            >
              <TrendingUp className="w-4 h-4" />
              <span>View Hydrology Charts</span>
            </button>
            <button
              type="button"
              onClick={onOpenCopilot}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold bg-white hover:bg-sky-50 text-sky-900 border border-sky-300 transition-colors cursor-pointer"
            >
              <Bot className="w-4 h-4 text-sky-600" />
              <span>Launch Command Copilot</span>
            </button>
          </div>
        </section>

        {/* Rainfall & Flood Alert Classification Levels */}
        <section className="space-y-4">
          <div>
            <h2 className="font-display text-xl font-bold text-slate-900">
              Rainfall &amp; Flood Alert Classification Levels
            </h2>
            <p className="text-sm sm:text-base text-slate-600 mt-1">
              Each monitored zone is scored continuously using the hydrological risk formula:{' '}
              <span className="font-mono text-sm font-semibold text-sky-900 bg-sky-100 px-2 py-0.5 rounded">
                (Rain Probability % × Effective QPF mm) × Terrain Vulnerability × Zone Weight
              </span>
              . Zones at lower ground elevations relative to the regional mean automatically receive
              higher terrain vulnerability multipliers.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white border border-red-200 rounded-xl p-5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-2 text-base font-bold text-red-700">
                  <span className="w-3 h-3 rounded-full bg-red-600" />
                  Immediate Rescue
                </span>
                <span className="font-mono text-xs font-semibold text-red-700 bg-red-50 px-2 py-0.5 rounded border border-red-200">
                  Score ≥ 1200
                </span>
              </div>
              <p className="text-sm text-slate-700 leading-relaxed">
                Triggered when a zone experiences <span className="font-mono font-medium">HEAVY_RAIN</span>{' '}
                with current rainfall volume <strong className="font-semibold">≥ 14.0 mm</strong> or a
                combined Risk Score of <strong className="font-semibold">1200+</strong>. Indicates active
                flash-flooding or severe inundation risk requiring immediate swift-water dispatch.
              </p>
            </div>

            <div className="bg-white border border-amber-200 rounded-xl p-5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-2 text-base font-bold text-amber-800">
                  <span className="w-3 h-3 rounded-full bg-amber-500" />
                  Pre-Stage Team
                </span>
                <span className="font-mono text-xs font-semibold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                  Score 420 – 1199
                </span>
              </div>
              <p className="text-sm text-slate-700 leading-relaxed">
                Triggered by steady-to-heavy rainfall (<strong className="font-semibold">4.5 – 13.9 mm</strong>{' '}
                current QPF), a 24-hour forecast QPF <strong className="font-semibold">≥ 18.0 mm</strong>, or
                active upstream runoff surges. Rescue teams and sandbags should be pre-staged nearby.
              </p>
            </div>

            <div className="bg-white border border-emerald-200 rounded-xl p-5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-2 text-base font-bold text-emerald-800">
                  <span className="w-3 h-3 rounded-full bg-emerald-500" />
                  Normal
                </span>
                <span className="font-mono text-xs font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  Score &lt; 420
                </span>
              </div>
              <p className="text-sm text-slate-700 leading-relaxed">
                Clear skies or light intermittent showers (<strong className="font-semibold">&lt; 4.5 mm</strong>{' '}
                current QPF) with stable drainage capacity. Routine monitoring remains active for any
                upstream catchment changes.
              </p>
            </div>
          </div>

          <div className="bg-emerald-50 border border-emerald-300 rounded-xl p-4 flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
            <div className="text-sm text-emerald-950 leading-relaxed">
              <strong className="font-semibold">Suggested Dispatch Zone Highlight (Light Green):</strong>{' '}
              The single highest-priority zone requiring immediate response is automatically highlighted
              in <span className="bg-emerald-200 text-emerald-950 font-semibold px-1.5 py-0.5 rounded">light green</span>{' '}
              across the Command Map, Triage List, and Hydrology Charts so dispatchers can immediately
              identify where to deploy first.
            </div>
          </div>
        </section>

        {/* Explanation of All Tabs & Controls */}
        <section className="space-y-4">
          <h2 className="font-display text-xl font-bold text-slate-900">
            App Tabs &amp; System Modules Explained
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white border border-sky-200 rounded-xl p-5 space-y-2">
              <div className="flex items-center gap-2 text-base font-bold text-sky-900">
                <Compass className="w-5 h-5 text-sky-600" />
                <span>1. Command Map &amp; Triage Tab</span>
              </div>
              <p className="text-sm text-slate-700 leading-relaxed">
                Displays the interactive Google Map with color-coded hazard markers, directional
                elevation runoff flow arrows linking highland catchments to low-lying basins, and the
                live Triage Sidebar sorted by Flood Risk Score. Clicking any zone opens the Rescue
                Action Drawer with high-ground staging sites (hospitals, schools, stadiums, community
                centers), traffic-aware rescue routes, and a one-click WhatsApp/SMS Dispatch Brief.
              </p>
            </div>

            <div className="bg-white border border-sky-200 rounded-xl p-5 space-y-2">
              <div className="flex items-center gap-2 text-base font-bold text-sky-900">
                <Activity className="w-5 h-5 text-sky-600" />
                <span>2. Hydrology Charts Tab</span>
              </div>
              <p className="text-sm text-slate-700 leading-relaxed">
                Visualizes regional hydrological patterns: Current vs. 24-Hour Forecast QPF (mm) for the
                top risk zones, an Elevation (m) vs. Risk Score scatter profile showing basin
                vulnerability relative to regional mean elevation, and a Corridor Exposure breakdown.
              </p>
            </div>

            <div className="bg-white border border-sky-200 rounded-xl p-5 space-y-2">
              <div className="flex items-center gap-2 text-base font-bold text-sky-900">
                <Bot className="w-5 h-5 text-sky-600" />
                <span>3. Command Copilot (AI Chat Sidebar)</span>
              </div>
              <p className="text-sm text-slate-700 leading-relaxed">
                An AI operations assistant connected directly to the live telemetry state of all
                monitored zones. Ask plain-English questions about sandbag prioritization, backup
                evacuation routes when major arteries flood, or draft bilingual English and Kiswahili
                SMS warnings for community leaders.
              </p>
            </div>

            <div className="bg-white border border-sky-200 rounded-xl p-5 space-y-2">
              <div className="flex items-center gap-2 text-base font-bold text-sky-900">
                <Layers className="w-5 h-5 text-sky-600" />
                <span>4. Top Bar Data &amp; Simulation Tools</span>
              </div>
              <p className="text-sm text-slate-700 leading-relaxed">
                Use <strong>Region Search</strong> to auto-discover sub-zones in any city globally,{' '}
                <strong>Nairobi 39 Preset</strong> to load all 39 Nairobi flood corridors,{' '}
                <strong>Upload CSV</strong> to geocode custom neighborhood lists (cached locally for 30
                days), and the <strong>Live API / Storm Sim</strong> switch to toggle real-time Google
                Weather API data against stress-test convective storm cells.
              </p>
            </div>
          </div>
        </section>

        {/* How to Navigate the App */}
        <section className="bg-white border border-sky-200 rounded-2xl p-6 sm:p-8 space-y-4">
          <h2 className="font-display text-xl font-bold text-slate-900 flex items-center gap-2">
            <Navigation className="w-5 h-5 text-sky-600" />
            <span>How to Navigate &amp; Operate SkyMap Response</span>
          </h2>

          <ol className="space-y-3 text-sm sm:text-base text-slate-700">
            <li className="flex gap-3">
              <span className="font-mono font-bold text-sky-700 shrink-0">01.</span>
              <span>
                <strong>Select a Region:</strong> Search any city or catchment (e.g.,{' '}
                <em>Nairobi, Juja, Mombasa</em>) in the top search bar, click{' '}
                <strong>Nairobi 39 Preset</strong>, or upload a custom CSV of neighborhood names and
                vulnerability weights.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="font-mono font-bold text-sky-700 shrink-0">02.</span>
              <span>
                <strong>Choose Weather Mode:</strong> Use <strong>Live API</strong> for real-time
                Google Weather conditions, 24h forecasts, and public alerts, or switch to{' '}
                <strong>Storm Sim</strong> to test heavy convective rainfall and upstream surge scenarios.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="font-mono font-bold text-sky-700 shrink-0">03.</span>
              <span>
                <strong>Spot Priority &amp; Upstream Surges:</strong> Review the{' '}
                <span className="bg-emerald-100 text-emerald-900 font-semibold px-1.5 py-0.5 rounded">
                  light-green Suggested Dispatch Zone
                </span>{' '}
                and any amber <strong>Upstream Surge Domino Alerts</strong> warning of 1–3 hour
                downstream runoff crests.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="font-mono font-bold text-sky-700 shrink-0">04.</span>
              <span>
                <strong>Route &amp; Dispatch:</strong> Click any zone on the map or triage list to
                discover nearby high-ground staging facilities, inspect the traffic-aware route &amp; ETA,
                and copy a ready-to-send WhatsApp/SMS dispatch brief.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="font-mono font-bold text-sky-700 shrink-0">05.</span>
              <span>
                <strong>Analyze &amp; Ask AI:</strong> Switch to <strong>Hydrology Charts</strong> for
                elevation/QPF correlations or open <strong>Command Copilot</strong> to ask tactical
                planning and bilingual communication questions.
              </span>
            </li>
          </ol>
        </section>

        {/* Author Signature Footer */}
        <footer className="bg-sky-100/80 border border-sky-200 rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <CloudRain className="w-6 h-6 text-sky-700 shrink-0" />
            <div>
              <div className="font-display text-base font-bold text-slate-900">
                Nicholas Musau: GDE Google Earth Engine *
              </div>
              <div className="text-sm text-slate-700 font-medium">
                Sustainable Finance &amp; Climate Risk Portfolio Analyst
              </div>
            </div>
          </div>

          <a
            href="https://www.linkedin.com/in/nicholas-musau/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-white hover:bg-sky-50 text-sky-800 border border-sky-300 transition-colors whitespace-nowrap shrink-0"
          >
            <span>LinkedIn Profile</span>
            <ExternalLink className="w-4 h-4" />
          </a>
        </footer>
      </div>
    </div>
  );
};
