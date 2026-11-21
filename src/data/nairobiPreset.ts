export interface PresetZoneSeed {
  id: string;
  name: string;
  corridor: string;
  lat: number;
  lng: number;
  customWeight: number;
  baselineElevationM: number;
}

export const NAIROBI_REGION_CENTER = {lat: -1.286389, lng: 36.817223};

// Approximate Nairobi City County & catchment operational boundary polygon
export const NAIROBI_COUNTY_BOUNDARY: Array<{lat: number; lng: number}> = [
  {lat: -1.258, lng: 36.716},
  {lat: -1.236, lng: 36.738},
  {lat: -1.216, lng: 36.774},
  {lat: -1.202, lng: 36.816},
  {lat: -1.186, lng: 36.862},
  {lat: -1.178, lng: 36.915},
  {lat: -1.196, lng: 36.956},
  {lat: -1.232, lng: 37.016},
  {lat: -1.262, lng: 37.058},
  {lat: -1.298, lng: 37.052},
  {lat: -1.334, lng: 37.018},
  {lat: -1.362, lng: 36.972},
  {lat: -1.384, lng: 36.925},
  {lat: -1.404, lng: 36.874},
  {lat: -1.422, lng: 36.815},
  {lat: -1.416, lng: 36.742},
  {lat: -1.382, lng: 36.694},
  {lat: -1.338, lng: 36.674},
  {lat: -1.296, lng: 36.688},
  {lat: -1.258, lng: 36.716},
];

export const NAIROBI_39_PRESET: PresetZoneSeed[] = [
  // Central Corridor
  {id: 'nbi-01', name: 'Kibera', corridor: 'Central', lat: -1.3127, lng: 36.7885, customWeight: 1.35, baselineElevationM: 1678},
  {id: 'nbi-02', name: 'Mathare Valley', corridor: 'Central', lat: -1.2617, lng: 36.8588, customWeight: 1.4, baselineElevationM: 1612},
  {id: 'nbi-03', name: 'Huruma', corridor: 'Central', lat: -1.2586, lng: 36.8748, customWeight: 1.3, baselineElevationM: 1605},
  {id: 'nbi-04', name: 'Ngara', corridor: 'Central', lat: -1.2747, lng: 36.8249, customWeight: 1.15, baselineElevationM: 1656},
  {id: 'nbi-05', name: 'Globe Cinema / Nairobi River', corridor: 'Central', lat: -1.2804, lng: 36.8213, customWeight: 1.35, baselineElevationM: 1650},
  {id: 'nbi-06', name: 'Pangani', corridor: 'Central', lat: -1.2662, lng: 36.8396, customWeight: 1.15, baselineElevationM: 1638},
  {id: 'nbi-07', name: 'Eastleigh', corridor: 'Central', lat: -1.2737, lng: 36.8529, customWeight: 1.2, baselineElevationM: 1626},
  {id: 'nbi-08', name: 'Industrial Area', corridor: 'Central', lat: -1.3055, lng: 36.8469, customWeight: 1.3, baselineElevationM: 1632},

  // South Corridor
  {id: 'nbi-09', name: 'South C', corridor: 'South', lat: -1.3189, lng: 36.8266, customWeight: 1.3, baselineElevationM: 1648},
  {id: 'nbi-10', name: 'South B', corridor: 'South', lat: -1.3114, lng: 36.8349, customWeight: 1.25, baselineElevationM: 1642},
  {id: 'nbi-11', name: 'Nairobi West', corridor: 'South', lat: -1.3067, lng: 36.8194, customWeight: 1.2, baselineElevationM: 1654},
  {id: 'nbi-12', name: 'Mukuru kwa Reuben', corridor: 'South', lat: -1.3175, lng: 36.8669, customWeight: 1.45, baselineElevationM: 1618},
  {id: 'nbi-13', name: 'Mukuru kwa Njenga', corridor: 'South', lat: -1.3193, lng: 36.8856, customWeight: 1.45, baselineElevationM: 1612},
  {id: 'nbi-14', name: 'Langata / Uhuru Gardens', corridor: 'South', lat: -1.3292, lng: 36.7915, customWeight: 1.1, baselineElevationM: 1682},
  {id: 'nbi-15', name: 'Karen / Mbagathi Ridge', corridor: 'South', lat: -1.3274, lng: 36.7135, customWeight: 0.95, baselineElevationM: 1796},
  {id: 'nbi-16', name: 'Ongata Rongai Basin', corridor: 'South', lat: -1.3939, lng: 36.7443, customWeight: 1.2, baselineElevationM: 1720},

  // East Corridor
  {id: 'nbi-17', name: 'Pipeline / Embakasi', corridor: 'East', lat: -1.3119, lng: 36.8979, customWeight: 1.35, baselineElevationM: 1624},
  {id: 'nbi-18', name: 'Donholm', corridor: 'East', lat: -1.2943, lng: 36.8861, customWeight: 1.2, baselineElevationM: 1619},
  {id: 'nbi-19', name: 'Umoja', corridor: 'East', lat: -1.2819, lng: 36.8919, customWeight: 1.15, baselineElevationM: 1614},
  {id: 'nbi-20', name: 'Kariobangi South', corridor: 'East', lat: -1.2676, lng: 36.8878, customWeight: 1.3, baselineElevationM: 1598},
  {id: 'nbi-21', name: 'Dandora', corridor: 'East', lat: -1.2535, lng: 36.8975, customWeight: 1.35, baselineElevationM: 1589},
  {id: 'nbi-22', name: 'Korogocho', corridor: 'East', lat: -1.2512, lng: 36.8879, customWeight: 1.4, baselineElevationM: 1592},
  {id: 'nbi-23', name: 'Kayole', corridor: 'East', lat: -1.2752, lng: 36.9125, customWeight: 1.25, baselineElevationM: 1596},
  {id: 'nbi-24', name: 'Utawala', corridor: 'East', lat: -1.2836, lng: 36.9609, customWeight: 1.15, baselineElevationM: 1574},
  {id: 'nbi-25', name: 'Ruai', corridor: 'East', lat: -1.2647, lng: 36.9998, customWeight: 1.35, baselineElevationM: 1524},

  // West Corridor
  {id: 'nbi-26', name: 'Westlands', corridor: 'West', lat: -1.2673, lng: 36.8111, customWeight: 1.1, baselineElevationM: 1684},
  {id: 'nbi-27', name: 'Parklands', corridor: 'West', lat: -1.2632, lng: 36.8178, customWeight: 1.1, baselineElevationM: 1672},
  {id: 'nbi-28', name: 'Kilimani', corridor: 'West', lat: -1.2896, lng: 36.7834, customWeight: 1.1, baselineElevationM: 1712},
  {id: 'nbi-29', name: 'Kileleshwa', corridor: 'West', lat: -1.2812, lng: 36.7794, customWeight: 1.2, baselineElevationM: 1698},
  {id: 'nbi-30', name: 'Lavington', corridor: 'West', lat: -1.2785, lng: 36.7662, customWeight: 1.0, baselineElevationM: 1742},
  {id: 'nbi-31', name: 'Kawangware', corridor: 'West', lat: -1.2846, lng: 36.7429, customWeight: 1.3, baselineElevationM: 1756},
  {id: 'nbi-32', name: 'Dagoretti Corner', corridor: 'West', lat: -1.3005, lng: 36.7599, customWeight: 1.15, baselineElevationM: 1758},
  {id: 'nbi-33', name: 'Kangemi', corridor: 'West', lat: -1.2649, lng: 36.7495, customWeight: 1.2, baselineElevationM: 1765},

  // North Corridor
  {id: 'nbi-34', name: 'Gigiri / Karura Catchment', corridor: 'North', lat: -1.2336, lng: 36.8058, customWeight: 0.95, baselineElevationM: 1745},
  {id: 'nbi-35', name: 'Runda', corridor: 'North', lat: -1.2194, lng: 36.8172, customWeight: 0.95, baselineElevationM: 1738},
  {id: 'nbi-36', name: 'Kasarani', corridor: 'North', lat: -1.2216, lng: 36.8975, customWeight: 1.2, baselineElevationM: 1586},
  {id: 'nbi-37', name: 'Roysambu', corridor: 'North', lat: -1.2185, lng: 36.8857, customWeight: 1.2, baselineElevationM: 1602},
  {id: 'nbi-38', name: 'Zimmerman', corridor: 'North', lat: -1.2098, lng: 36.8938, customWeight: 1.25, baselineElevationM: 1594},
  {id: 'nbi-39', name: 'Githurai 45', corridor: 'North', lat: -1.2043, lng: 36.9163, customWeight: 1.3, baselineElevationM: 1568},
];

export const SAMPLE_CSV_CONTENT = `zone_name,vulnerability_weight
Kibera Nairobi,1.35
Mathare Valley Nairobi,1.40
Ruai Nairobi,1.35
South C Nairobi,1.30
Mukuru kwa Reuben Nairobi,1.45
Kariobangi South Nairobi,1.30
Kawangware Nairobi,1.25
Kasarani Nairobi,1.20`;
