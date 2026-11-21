import {ActiveRegion, DataMode, FloodZone, GeocodeCacheEntry} from '../types/flood';

const GEOCODE_CACHE_KEY = 'floodwatch_geocode_cache_v1';
const STATE_CACHE_KEY = 'floodwatch_command_state_v1';
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export function getGeocodeCache(): Record<string, GeocodeCacheEntry> {
  try {
    const raw = localStorage.getItem(GEOCODE_CACHE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, GeocodeCacheEntry>;
    const now = Date.now();
    const valid: Record<string, GeocodeCacheEntry> = {};
    let pruned = false;

    for (const [key, entry] of Object.entries(parsed)) {
      if (entry && typeof entry.cachedAt === 'number' && now - entry.cachedAt <= THIRTY_DAYS_MS) {
        valid[key] = entry;
      } else {
        pruned = true;
      }
    }

    if (pruned) {
      localStorage.setItem(GEOCODE_CACHE_KEY, JSON.stringify(valid));
    }

    return valid;
  } catch {
    return {};
  }
}

export function setGeocodeCacheEntry(queryKey: string, entry: Omit<GeocodeCacheEntry, 'cachedAt'>): void {
  try {
    const cache = getGeocodeCache();
    cache[queryKey.trim().toLowerCase()] = {
      ...entry,
      cachedAt: Date.now(),
    };
    localStorage.setItem(GEOCODE_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Ignore storage quota errors
  }
}

export interface PersistedCommandState {
  region: ActiveRegion;
  zones: FloodZone[];
  dataMode: DataMode;
  savedAt: number;
}

export function loadCommandState(): PersistedCommandState | null {
  try {
    const raw = localStorage.getItem(STATE_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedCommandState;
    if (!parsed?.region || !Array.isArray(parsed?.zones) || parsed.zones.length === 0) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveCommandState(state: Omit<PersistedCommandState, 'savedAt'>): void {
  try {
    const payload: PersistedCommandState = {
      ...state,
      savedAt: Date.now(),
    };
    localStorage.setItem(STATE_CACHE_KEY, JSON.stringify(payload));
  } catch {
    // Ignore storage quota errors
  }
}
