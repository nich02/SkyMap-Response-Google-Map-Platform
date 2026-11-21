import React, {useEffect, useRef, useState} from 'react';
import {useMapsLibrary} from '@vis.gl/react-google-maps';
import {
  Activity,
  Bot,
  CloudRain,
  Compass,
  Info,
  Loader2,
  Map as MapIcon,
  MapPin,
  Radio,
  Search,
  Upload,
} from 'lucide-react';
import {ActiveRegion, DataMode} from '../types/flood';

export type AppTab = 'map' | 'charts' | 'about';

interface TopCommandBarProps {
  activeTab: AppTab;
  onChangeTab: (tab: AppTab) => void;
  activeRegion: ActiveRegion;
  dataMode: DataMode;
  isDiscovering: boolean;
  isCopilotOpen: boolean;
  onToggleCopilot: () => void;
  onSelectSearchedRegion: (place: google.maps.places.Place) => void;
  onLoadNairobiPreset: () => void;
  onOpenCsvModal: () => void;
  onToggleDataMode: (mode: DataMode) => void;
}

export const TopCommandBar: React.FC<TopCommandBarProps> = ({
  activeTab,
  onChangeTab,
  activeRegion,
  dataMode,
  isDiscovering,
  isCopilotOpen,
  onToggleCopilot,
  onSelectSearchedRegion,
  onLoadNairobiPreset,
  onOpenCsvModal,
  onToggleDataMode,
}) => {
  const placesLib = useMapsLibrary('places');
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<google.maps.places.AutocompleteSuggestion[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [logoError, setLogoError] = useState(false);
  const sessionTokenRef = useRef<google.maps.places.AutocompleteSessionToken | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  useEffect(() => {
    if (!placesLib || query.trim().length < 2) {
      setSuggestions([]);
      setIsSearching(false);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        if (!sessionTokenRef.current) {
          sessionTokenRef.current = new placesLib.AutocompleteSessionToken();
        }
        setIsSearching(true);
        const res = await placesLib.AutocompleteSuggestion.fetchAutocompleteSuggestions({
          input: query.trim(),
          includedPrimaryTypes: [
            'locality',
            'administrative_area_level_1',
            'administrative_area_level_2',
            'sublocality',
          ],
          sessionToken: sessionTokenRef.current,
        });
        setSuggestions(res.suggestions ?? []);
        setDropdownOpen(true);
      } catch (err) {
        const msg = String(err).toUpperCase();
        if (
          msg.includes('OVER_QUERY_LIMIT') ||
          msg.includes('QUOTA') ||
          msg.includes('RESOURCE_EXHAUSTED')
        ) {
          window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
        }
        setSuggestions([]);
      } finally {
        setIsSearching(false);
      }
    }, 240);

    return () => clearTimeout(timer);
  }, [placesLib, query]);

  const handleSelectSuggestion = async (
    suggestion: google.maps.places.AutocompleteSuggestion
  ) => {
    if (!suggestion.placePrediction) return;
    try {
      setIsSearching(true);
      const place = suggestion.placePrediction.toPlace();
      await place.fetchFields({
        fields: ['displayName', 'formattedAddress', 'location', 'viewport'],
      });
      setQuery('');
      setSuggestions([]);
      setDropdownOpen(false);
      sessionTokenRef.current = null;
      onSelectSearchedRegion(place);
    } catch (err) {
      const msg = String(err).toUpperCase();
      if (msg.includes('OVER_QUERY_LIMIT') || msg.includes('QUOTA')) {
        window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
      }
    } finally {
      setIsSearching(false);
    }
  };

  const navItems: Array<{id: AppTab; label: string; icon: React.ReactNode}> = [
    {id: 'map', label: 'Command Map', icon: <MapIcon className="w-4 h-4" />},
    {id: 'charts', label: 'Hydrology Charts', icon: <Activity className="w-4 h-4" />},
    {id: 'about', label: 'About', icon: <Info className="w-4 h-4" />},
  ];

  return (
    <header className="w-full bg-gradient-to-r from-[#0369A1] via-[#0284C7] to-[#0369A1] border-b border-sky-800 px-4 lg:px-6 py-3 flex flex-col gap-2.5 z-30 shrink-0 shadow-sm">
      {/* Row 1: Brand + Navigation Tabs + Copilot Toggle */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0 shrink-0">
          {!logoError ? (
            <img
              src="/src/assets/images/skymap_response_logo_1795262577811.jpg"
              alt="SkyMap Response Logo"
              referrerPolicy="no-referrer"
              onError={() => setLogoError(true)}
              className="w-10 h-10 rounded-xl object-cover border border-sky-300/60 shrink-0 bg-white shadow-xs"
            />
          ) : (
            <div className="w-10 h-10 rounded-xl bg-white text-sky-700 flex items-center justify-center shrink-0">
              <CloudRain className="w-5 h-5" />
            </div>
          )}

          <div className="min-w-0">
            <div className="font-display text-lg sm:text-xl font-bold tracking-tight text-white whitespace-nowrap leading-tight">
              SkyMap Response
            </div>
            <div className="hidden sm:flex items-center gap-1.5 text-xs font-medium text-sky-100 truncate max-w-[240px]">
              <MapPin className="w-3.5 h-3.5 text-emerald-200 shrink-0" />
              <span className="truncate">{activeRegion.name}</span>
            </div>
          </div>
        </div>

        {/* Navigation Menu Bar */}
        <nav
          aria-label="Primary sections"
          className="flex items-center gap-1 bg-sky-950/30 border border-sky-300/30 p-1 rounded-xl"
        >
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onChangeTab(item.id)}
                className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-sm font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  isActive
                    ? 'bg-[#DCFCE7] text-[#064E3B] shadow-xs'
                    : 'text-sky-50 hover:text-white hover:bg-white/15'
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Copilot Toggle Button */}
        <button
          type="button"
          onClick={onToggleCopilot}
          aria-pressed={isCopilotOpen}
          className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-sm font-semibold border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
            isCopilotOpen
              ? 'bg-[#DCFCE7] text-[#064E3B] border-emerald-300 shadow-xs'
              : 'bg-white/15 hover:bg-white/25 text-white border-sky-200/40'
          }`}
        >
          <Bot className="w-4 h-4" />
          <span>Command Copilot</span>
        </button>
      </div>

      {/* Row 2: Region Search + Data Controls */}
      <div className="flex flex-wrap lg:flex-nowrap items-center justify-between gap-3">
        {/* Region Autocomplete Search */}
        <div ref={containerRef} className="relative flex-1 min-w-[240px] max-w-xl">
          <div className="relative flex items-center">
            <Search className="w-4 h-4 text-sky-700 absolute left-3 pointer-events-none" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => {
                if (suggestions.length > 0) setDropdownOpen(true);
              }}
              placeholder="Search any city or basin (e.g. Juja, Mombasa, Nairobi)..."
              aria-label="Search city or region"
              className="w-full bg-white border border-sky-200 focus:border-sky-400 rounded-xl pl-9 pr-9 py-2 text-sm text-slate-900 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-white/40 transition-colors shadow-2xs"
            />
            {(isSearching || isDiscovering) && (
              <Loader2 className="w-4 h-4 text-sky-600 animate-spin absolute right-3" />
            )}
          </div>

          {dropdownOpen && suggestions.length > 0 && (
            <ul
              role="listbox"
              className="absolute left-0 right-0 mt-1.5 bg-white border border-sky-200 rounded-xl shadow-xl overflow-hidden z-50 max-h-72 overflow-y-auto"
            >
              <li className="px-3.5 py-2 text-xs font-semibold text-sky-900 bg-sky-50 border-b border-sky-100 flex items-center justify-between">
                <span>Select Region for Auto-Discovery</span>
                <span className="font-mono text-xs text-sky-700">Places API (New)</span>
              </li>
              {suggestions.map((item, idx) => (
                <li key={item.placePrediction?.placeId || idx}>
                  <button
                    type="button"
                    onClick={() => void handleSelectSuggestion(item)}
                    className="w-full text-left px-3.5 py-2.5 hover:bg-sky-50 transition-colors flex items-start gap-2.5 border-b border-sky-100 last:border-b-0 cursor-pointer"
                  >
                    <MapPin className="w-4 h-4 text-sky-600 mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-slate-900 truncate">
                        {item.placePrediction?.mainText?.text || item.placePrediction?.text.text}
                      </div>
                      {item.placePrediction?.secondaryText?.text && (
                        <div className="text-xs text-slate-600 truncate">
                          {item.placePrediction.secondaryText.text}
                        </div>
                      )}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Tactical Action Controls */}
        <div className="flex items-center gap-2.5 shrink-0 flex-wrap sm:flex-nowrap">
          <button
            type="button"
            onClick={onLoadNairobiPreset}
            disabled={isDiscovering}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-semibold bg-white hover:bg-sky-50 text-sky-950 border border-sky-200 transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50 shadow-2xs"
          >
            <Compass className="w-4 h-4 text-sky-600" />
            <span>Nairobi 39 Preset</span>
          </button>

          <button
            type="button"
            onClick={onOpenCsvModal}
            disabled={isDiscovering}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-semibold bg-white hover:bg-sky-50 text-sky-950 border border-sky-200 transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50 shadow-2xs"
          >
            <Upload className="w-4 h-4 text-sky-700" />
            <span>Upload CSV</span>
          </button>

          <div
            role="group"
            aria-label="Weather Data Source"
            className="flex items-center p-0.5 bg-sky-950/30 border border-sky-300/35 rounded-xl shrink-0"
          >
            <button
              type="button"
              onClick={() => onToggleDataMode('LIVE')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                dataMode === 'LIVE'
                  ? 'bg-emerald-500 text-white shadow-2xs'
                  : 'text-sky-100 hover:text-white'
              }`}
            >
              <Radio className="w-4 h-4" />
              <span>Live API</span>
            </button>
            <button
              type="button"
              onClick={() => onToggleDataMode('SIMULATION')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                dataMode === 'SIMULATION'
                  ? 'bg-white text-sky-900 shadow-2xs'
                  : 'text-sky-100 hover:text-white'
              }`}
            >
              <CloudRain className="w-4 h-4" />
              <span>Storm Sim</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
