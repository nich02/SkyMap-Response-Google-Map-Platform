# Return the elevation of a set of latitude/longitude coordinates.

## Overview

The Elevation service in the Maps JavaScript API provides elevation data for
locations on the surface of the earth, including depth locations on the ocean
floor (which return negative values). If Google does not possess exact elevation
measurements at the precise location requested, the service interpolates and
returns an averaged value using the four nearest locations.

Using the `ElevationService` class, you can query elevation data in two ways:

1.  **Discrete Locations (`getElevationForLocations`)**: Query elevation for one
    or more specific `LatLng` coordinates.
2.  **Sampled Paths (`getElevationAlongPath`)**: Query equidistantly sampled
    elevation data along an ordered path of two or more connected vertices.

--------------------------------------------------------------------------------

## Prerequisites

Before using the `ElevationService` in your application, you must enable the
**Elevation API** in your Google Cloud project alongside the **Maps JavaScript
API**:

1.  Go to the
    [Google Cloud Console](https://console.cloud.google.com/project/_/apiui/apis/enabled?utm_source=Docs_EnabledAPIsView).
2.  Select the project you set up for the Maps JavaScript API.
3.  Check the list of enabled APIs on the **Dashboard** for **Elevation API**.
4.  If it is not listed, click **ENABLE API** (or select **Library** from the
    left menu), search for **Elevation API**, and click **ENABLE**.

--------------------------------------------------------------------------------

## Implementation Workflow

### 1. Load Required Libraries

Use `google.maps.importLibrary()` to asynchronously load the `elevation` library
(and `maps` if rendering a map or `InfoWindow`).

```javascript
const [{ Map, InfoWindow }, { ElevationService }] = await Promise.all([
  google.maps.importLibrary('maps'),
  google.maps.importLibrary('elevation'),
]);
```

### 2. Instantiate the ElevationService

Create an instance of `ElevationService` to communicate with the Google Maps API
Elevation Service.

```javascript
const elevator = new ElevationService();
```

### 3. Construct and Execute the Request

Choose the appropriate method depending on whether you are querying individual
coordinates or sampling along a continuous path. Both methods return a `Promise`
(or accept a callback function).

#### Option A: Discrete Locations (`getElevationForLocations`)

Pass a `LocationElevationRequest` object containing a `locations` array of
`LatLng` or `LatLngLiteral` objects:

```javascript
const response = await elevator.getElevationForLocations({
  locations: [{ lat: 63.333, lng: -150.5 }],
});
```

*Note: Passing multiple coordinates in a single request may return data of lower
resolution (coarser accuracy) than querying a single coordinate independently.*

#### Option B: Sampled Paths (`getElevationAlongPath`)

Pass a `PathElevationRequest` object containing:

-   `path`: An array of two or more ordered `LatLng` or `LatLngLiteral` vertices
    defining the route.
-   `samples`: The number of equidistant sample points along the path (inclusive
    of endpoints) for which to return elevation data.

```javascript
const response = await elevator.getElevationAlongPath({
  path: [
    { lat: 36.579, lng: -118.292 },
    { lat: 36.24, lng: -116.832 },
  ],
  samples: 256,
});
```

### 4. Process the Response and Handle Errors

The service returns an array of `ElevationResult` objects and an
`ElevationStatus` code.

#### `ElevationResult` Properties:

-   `elevation` (`number`): The elevation of the location in meters.
-   `location` (`google.maps.LatLng`): The position for which elevation data was
    computed (for path requests, this represents each sampled point along the
    path).
-   `resolution` (`number`, optional): The maximum distance (in meters) between
    data points from which the elevation was interpolated. Missing if the
    resolution is unknown.

#### `ElevationStatus` Codes:

-   `OK`: The service request was successful.
-   `INVALID_REQUEST`: The service request was malformed.
-   `OVER_QUERY_LIMIT`: The requestor has exceeded quota.
-   `REQUEST_DENIED`: The service did not complete the request, likely due to an
    invalid parameter or disabled API.
-   `UNKNOWN_ERROR`: An unknown error occurred.

--------------------------------------------------------------------------------

## Code Examples

### Example 1: Querying Elevation at a Clicked Map Location (Web Component)

This example uses the `<gmp-map>` web component and queries the elevation for
any point clicked on the map using `getElevationForLocations()`.

#### HTML

```html
<gmp-map
  center="63.333,-150.5"
  zoom="8"
  map-id="DEMO_MAP_ID"
  internal-usage-attribution-ids="gmp_git_agentskills_v1"
  style="height: 400px; width: 100%;"
></gmp-map>
```

#### TypeScript / JavaScript

```typescript
async function init(): Promise<void> {
  const [{ InfoWindow }, { ElevationService }] = await Promise.all([
    google.maps.importLibrary('maps') as Promise<google.maps.MapsLibrary>,
    google.maps.importLibrary('elevation') as Promise<google.maps.ElevationLibrary>,
  ]);

  const mapElement = document.querySelector('gmp-map') as google.maps.MapElement;
  const innerMap = mapElement.innerMap;

  const elevator = new ElevationService();
  const infowindow = new InfoWindow();

  infowindow.open(innerMap);

  // Add a listener for the click event. Display the elevation for the LatLng of
  // the click inside the infowindow.
  innerMap.addListener('click', (event: google.maps.MapMouseEvent) => {
    if (event.latLng) {
      displayLocationElevation(event.latLng, elevator, infowindow, innerMap);
    }
  });
}

function displayLocationElevation(
  location: google.maps.LatLng,
  elevator: google.maps.ElevationService,
  infowindow: google.maps.InfoWindow,
  map: google.maps.Map
) {
  // Format numeric values to two decimal places
  const formatter = new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 2,
  });

  // Initiate the location request
  elevator
    .getElevationForLocations({
      locations: [location],
    })
    .then(({ results }) => {
      if (results[0]) {
        const { elevation, location: resultLocation } = results[0];
        infowindow.setPosition(resultLocation);
        infowindow.setContent(
          `The elevation at ${String(resultLocation)} <br>is ${formatter.format(elevation)} meters.`
        );
      } else {
        infowindow.setPosition(location);
        infowindow.setContent('No results found');
      }

      infowindow.open(map);
    })
    .catch((e: unknown) => {
      infowindow.setPosition(location);
      infowindow.setContent(
        `Elevation service failed due to: ${String(e)}`
      );
      infowindow.open(map);
    });
}

void init();
```

--------------------------------------------------------------------------------

### Example 2: Sampling Elevation Along a Path with Google Visualization API

This example draws a polyline from Mt. Whitney to Badwater, Death Valley,
requests 256 elevation samples along the path using `getElevationAlongPath()`,
and plots the elevation profile using the Google Visualization API.

Source reference:
[samples/elevation-paths/index.ts](https://github.com/googlemaps/js-samples/blob/HEAD/samples/elevation-paths/index.ts?utm_campaign=gmp_git_agentskills_v1)

#### HTML

```html
<div id="map" style="height: 400px; width: 100%;"></div>
<div id="elevation_chart" style="height: 150px; width: 100%;"></div>
```

#### TypeScript

```typescript
// Load the Visualization API and the columnchart package.
// @ts-ignore
google.load("visualization", "1", { packages: ["columnchart"] });

function initMap(): void {
  // The following path marks a path from Mt. Whitney, the highest point in the
  // continental United States to Badwater, Death Valley, the lowest point.
  const path: google.maps.LatLngLiteral[] = [
    { lat: 36.579, lng: -118.292 }, // Mt. Whitney
    { lat: 36.606, lng: -118.0638 }, // Lone Pine
    { lat: 36.433, lng: -117.951 }, // Owens Lake
    { lat: 36.588, lng: -116.943 }, // Beatty Junction
    { lat: 36.34, lng: -117.468 }, // Panama Mint Springs
    { lat: 36.24, lng: -116.832 }, // Badwater, Death Valley
  ];

  const map = new google.maps.Map(
    document.getElementById("map") as HTMLElement,
    {
      zoom: 8,
      center: path[1],
      mapTypeId: "terrain",
      internalUsageAttributionIds: ["gmp_git_agentskills_v1"],
    }
  );

  // Create an ElevationService.
  const elevator = new google.maps.ElevationService();

  // Draw the path, using the Visualization API and the Elevation service.
  displayPathElevation(path, elevator, map);
}

function displayPathElevation(
  path: google.maps.LatLngLiteral[],
  elevator: google.maps.ElevationService,
  map: google.maps.Map
) {
  // Display a polyline of the elevation path.
  new google.maps.Polyline({
    path: path,
    strokeColor: "#0000CC",
    strokeOpacity: 0.4,
    map: map,
  });

  // Create a PathElevationRequest object using this array.
  // Ask for 256 samples along that path.
  elevator
    .getElevationAlongPath({
      path: path,
      samples: 256,
    })
    .then(plotElevation)
    .catch((e) => {
      const chartDiv = document.getElementById(
        "elevation_chart"
      ) as HTMLElement;

      // Show the error code inside the chartDiv.
      chartDiv.innerHTML = "Cannot show elevation: request failed because " + e;
    });
}

// Takes an array of ElevationResult objects, draws the path on the map
// and plots the elevation profile on a Visualization API ColumnChart.
function plotElevation({ results }: google.maps.PathElevationResponse) {
  const chartDiv = document.getElementById("elevation_chart") as HTMLElement;

  // Create a new chart in the elevation_chart DIV.
  const chart = new google.visualization.ColumnChart(chartDiv);

  // Extract the data from which to populate the chart.
  // Because the samples are equidistant, the 'Sample'
  // column here does double duty as distance along the X axis.
  const data = new google.visualization.DataTable();

  data.addColumn("string", "Sample");
  data.addColumn("number", "Elevation");

  for (let i = 0; i < results.length; i++) {
    data.addRow(["", results[i].elevation]);
  }

  // Draw the chart using the data within its DIV.
  chart.draw(data, {
    height: 150,
    legend: "none",
    // @ts-ignore
    titleY: "Elevation (m)",
  });
}

declare global {
  interface Window {
    initMap: () => void;
  }
}
window.initMap = initMap;
```

--------------------------------------------------------------------------------

## Reference Links

-   [Maps JavaScript API Reference: Elevation](https://developers.google.com/maps/documentation/javascript/reference/elevation)
-   [Elevation API Usage and Billing](https://developers.google.com/maps/documentation/elevation/usage-and-billing)
-   [Elevation API Policies](https://developers.google.com/maps/documentation/elevation/policies)
-   [Sample: Simple Elevation](https://github.com/googlemaps/js-samples/blob/HEAD/samples/elevation-simple/index.ts?utm_campaign=gmp_git_agentskills_v1)
-   [Sample: Showing Elevation Along a Path](https://github.com/googlemaps/js-samples/blob/HEAD/samples/elevation-paths/index.ts?utm_campaign=gmp_git_agentskills_v1)
