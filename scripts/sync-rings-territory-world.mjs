/**
 * Runner's Rings Rings Territory international sync — Stage 1.
 *
 * Supported Territory countries are defined in COUNTRY_CONFIG.
 * Existing Japan sync is intentionally kept separate and unchanged.
 *
 * Required environment variables for live sync:
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 * Optional:
 *   TERRITORY_YEAR=2026
 *   TERRITORY_COUNTRY=KOR
 *
 * Geometry rule matches Japan Territory:
 * - assign each GPS segment to the region containing its midpoint
 * - scale attributed distances to the run's stored distance_km
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const COUNTRY_CONFIG = {
  THA: {countryCode:'THA',adminLevel:'ADM2',boundaryFile:'runners-rings-tha-adm2.geojson',regionCodeProps:['shapeID','shapeISO','GID_2','code','id'],regionNameProps:['shapeName','NAME_2','name'],parentNameProps:['NAME_1','parentName'],selfTestPoint:[13.7563, 100.5018],selfTestLabel:'Thailand',minFeatures:900},
  MYS: {countryCode:'MYS',adminLevel:'ADM2',boundaryFile:'runners-rings-mys-adm2.geojson',regionCodeProps:['shapeID','shapeISO','GID_2','code','id'],regionNameProps:['shapeName','NAME_2','name'],parentNameProps:['NAME_1','parentName'],selfTestPoint:[3.139, 101.6869],selfTestLabel:'Malaysia',minFeatures:150},
  SLB: {countryCode:'SLB',adminLevel:'ADM2',boundaryFile:'runners-rings-slb-adm2.geojson',regionCodeProps:['shapeID','shapeISO','GID_2','code','id'],regionNameProps:['shapeName','NAME_2','name'],parentNameProps:['NAME_1','parentName'],selfTestPoint:[-9.4456, 159.9729],selfTestLabel:'Solomon Islands',minFeatures:50},
  RUS: {countryCode:'RUS',adminLevel:'ADM2',boundaryFile:'runners-rings-rus-adm2.geojson',regionCodeProps:['shapeID','shapeISO','GID_2','code','id'],regionNameProps:['shapeName','NAME_2','name'],parentNameProps:['NAME_1','parentName'],selfTestPoint:[55.7558, 37.6173],selfTestLabel:'Russia',minFeatures:2300},
  KOR: {
    countryCode: 'KOR',
    adminLevel: 'ADM2',
    boundaryFile: 'runners-rings-kor-adm2.geojson',
    regionCodeProps: ['shapeID', 'shapeISO', 'GID_2', 'code', 'id'],
    regionNameProps: ['shapeName', 'NAME_2', 'name'],
    parentNameProps: ['NAME_1', 'parentName'],
    selfTestPoint: [37.5665, 126.9780],
    selfTestLabel: 'Seoul',
    minFeatures: 100
  },
  USA: {
    countryCode: 'USA',
    adminLevel: 'ADM2',
    boundaryFile: 'runners-rings-usa-adm2-simplified.geojson',
    regionCodeProps: ['shapeID', 'shapeISO', 'GID_2', 'code', 'id'],
    regionNameProps: ['shapeName', 'NAME_2', 'name'],
    parentNameProps: ['NAME_1', 'parentName'],
    selfTestPoint: [37.7749, -122.4194],
    selfTestLabel: 'San Francisco',
    minFeatures: 100
  },
  GBR: {
    countryCode: 'GBR', adminLevel: 'ADM2',
    boundaryFile: 'runners-rings-gbr-adm2-simplified.geojson',
    regionCodeProps: ['shapeID','shapeISO','GID_2','code','id'],
    regionNameProps: ['shapeName','NAME_2','name'],
    parentNameProps: ['NAME_1','parentName'],
    selfTestPoint: [51.5074,-0.1278], selfTestLabel: 'London', minFeatures: 50
  },
  AUS: {
    countryCode: 'AUS', adminLevel: 'ADM2',
    boundaryFile: 'runners-rings-aus-adm2-simplified.geojson',
    regionCodeProps: ['shapeID','shapeISO','GID_2','code','id'],
    regionNameProps: ['shapeName','NAME_2','name'],
    parentNameProps: ['NAME_1','parentName'],
    selfTestPoint: [-33.8688,151.2093], selfTestLabel: 'Sydney', minFeatures: 50
  },
  CAN: {
    countryCode: 'CAN', adminLevel: 'ADM2',
    boundaryFile: 'runners-rings-can-adm2.geojson',
    regionCodeProps: ['shapeID','shapeISO','GID_2','code','id'],
    regionNameProps: ['shapeName','NAME_2','name'],
    parentNameProps: ['NAME_1','parentName'],
    selfTestPoint: [43.6532,-79.3832], selfTestLabel: 'Toronto', minFeatures: 50
  },
  FRA: {
    countryCode: 'FRA', adminLevel: 'ADM2',
    boundaryFile: 'runners-rings-fra-adm2-simplified.geojson',
    regionCodeProps: ['shapeID','shapeISO','GID_2','code','id'],
    regionNameProps: ['shapeName','NAME_2','name'],
    parentNameProps: ['NAME_1','parentName'],
    selfTestPoint: [48.8566,2.3522], selfTestLabel: 'Paris', minFeatures: 50
  },
  DEU: {
    countryCode: 'DEU', adminLevel: 'ADM2',
    boundaryFile: 'runners-rings-deu-adm2-simplified.geojson',
    regionCodeProps: ['shapeID','shapeISO','GID_2','code','id'],
    regionNameProps: ['shapeName','NAME_2','name'],
    parentNameProps: ['NAME_1','parentName'],
    selfTestPoint: [52.5200,13.4050], selfTestLabel: 'Berlin', minFeatures: 20
  },
  NZL: {
    countryCode: 'NZL', adminLevel: 'ADM2',
    boundaryFile: 'runners-rings-nzl-adm2-simplified.geojson',
    regionCodeProps: ['shapeID','shapeISO','GID_2','code','id'],
    regionNameProps: ['shapeName','NAME_2','name'],
    parentNameProps: ['NAME_1','parentName'],
    selfTestPoint: [-36.8485,174.7633], selfTestLabel: 'Auckland', minFeatures: 20
  }
};

function firstProperty(properties, names) {
  for (const name of names) {
    const value = properties?.[name];
    if (value != null && String(value).trim()) return String(value).trim();
  }
  return '';
}

function bboxGeom(geometry) {
  const bbox = [Infinity, Infinity, -Infinity, -Infinity];
  function walk(value) {
    if (!Array.isArray(value)) return;
    if (typeof value[0] === 'number' && typeof value[1] === 'number') {
      bbox[0] = Math.min(bbox[0], value[0]);
      bbox[1] = Math.min(bbox[1], value[1]);
      bbox[2] = Math.max(bbox[2], value[0]);
      bbox[3] = Math.max(bbox[3], value[1]);
      return;
    }
    for (const child of value) walk(child);
  }
  walk(geometry.coordinates);
  return bbox;
}

function ringContains(x, y, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i];
    const b = ring[j];
    if (
      (a[1] > y) !== (b[1] > y) &&
      x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]
    ) {
      inside = !inside;
    }
  }
  return inside;
}

function polygonContains(x, y, polygon) {
  return polygon.length > 0 &&
    ringContains(x, y, polygon[0]) &&
    !polygon.slice(1).some(hole => ringContains(x, y, hole));
}

function contains(x, y, geometry) {
  if (!geometry) return false;
  if (geometry.type === 'Polygon') {
    return polygonContains(x, y, geometry.coordinates);
  }
  if (geometry.type === 'MultiPolygon') {
    return geometry.coordinates.some(polygon => polygonContains(x, y, polygon));
  }
  return false;
}

function distanceKm(aLat, aLon, bLat, bLon) {
  const R = 6371.0088;
  const toRad = value => value * Math.PI / 180;
  const dLat = toRad(bLat - aLat);
  const dLon = toRad(bLon - aLon);
  const s1 = Math.sin(dLat / 2);
  const s2 = Math.sin(dLon / 2);
  const h = s1 * s1 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * s2 * s2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

const cellSize = 0.5;
const cellKey = (lon, lat) => `${Math.floor(lon / cellSize)},${Math.floor(lat / cellSize)}`;

function loadRegionGrid(config) {
  const boundaryPath = path.join(root, config.boundaryFile);
  if (!fs.existsSync(boundaryPath)) {
    throw Error(`Missing ${config.boundaryFile}`);
  }

  const geojson = JSON.parse(fs.readFileSync(boundaryPath, 'utf8'));
  const grid = new Map();
  let loaded = 0;

  for (const feature of geojson.features || []) {
    if (!feature?.geometry) continue;
    const properties = feature.properties || {};
    const regionCode = firstProperty(properties, config.regionCodeProps);
    const regionName = firstProperty(properties, config.regionNameProps);
    const parentRegionName = firstProperty(properties, config.parentNameProps);
    if (!regionCode || !regionName) continue;

    const bbox = bboxGeom(feature.geometry);
    if (!bbox.every(Number.isFinite)) continue;

    const item = {
      regionCode,
      regionName,
      parentRegionName,
      geometry: feature.geometry,
      bbox
    };
    loaded++;

    for (let ix = Math.floor(bbox[0] / cellSize); ix <= Math.floor(bbox[2] / cellSize); ix++) {
      for (let iy = Math.floor(bbox[1] / cellSize); iy <= Math.floor(bbox[3] / cellSize); iy++) {
        const key = `${ix},${iy}`;
        if (!grid.has(key)) grid.set(key, []);
        grid.get(key).push(item);
      }
    }
  }

  console.log(`Loaded ${loaded} ${config.countryCode} ${config.adminLevel} features.`);
  return { grid, loaded };
}

function findRegion(lat, lon, grid) {
  const candidates = grid.get(cellKey(lon, lat)) || [];
  for (const item of candidates) {
    const bbox = item.bbox;
    if (lon < bbox[0] || lon > bbox[2] || lat < bbox[1] || lat > bbox[3]) continue;
    if (contains(lon, lat, item.geometry)) return item;
  }
  return null;
}

function analyseRoute(route, targetDistanceKm, grid) {
  const regionDistances = new Map();
  let calculatedKm = 0;

  for (let i = 1; i < route.length; i++) {
    const previous = route[i - 1];
    const current = route[i];
    if (!Array.isArray(previous) || !Array.isArray(current) ||
        previous.length < 2 || current.length < 2) continue;

    const aLat = Number(previous[0]);
    const aLon = Number(previous[1]);
    const bLat = Number(current[0]);
    const bLon = Number(current[1]);
    if (![aLat, aLon, bLat, bLon].every(Number.isFinite)) continue;
    if (Math.abs(aLat) > 90 || Math.abs(bLat) > 90 ||
        Math.abs(aLon) > 180 || Math.abs(bLon) > 180) continue;

    const segmentKm = distanceKm(aLat, aLon, bLat, bLon);
    if (!Number.isFinite(segmentKm) || segmentKm <= 0) continue;
    calculatedKm += segmentKm;

    const midLat = (aLat + bLat) / 2;
    const midLon = (aLon + bLon) / 2;
    const region = findRegion(midLat, midLon, grid);
    if (!region) continue;

    const row = regionDistances.get(region.regionCode) || {
      regionCode: region.regionCode,
      regionName: region.regionName,
      parentRegionName: region.parentRegionName,
      km: 0
    };
    row.km += segmentKm;
    regionDistances.set(region.regionCode, row);
  }

  const target = Number(targetDistanceKm);
  if (Number.isFinite(target) && target > 0 && calculatedKm > 0) {
    const scale = target / calculatedKm;
    for (const row of regionDistances.values()) row.km *= scale;
  }

  return [...regionDistances.values()].filter(row => row.km > 0.0001);
}

const requestedCountry = String(process.env.TERRITORY_COUNTRY || 'KOR').toUpperCase();
const config = COUNTRY_CONFIG[requestedCountry];
if (!config) {
  throw Error(`Unsupported TERRITORY_COUNTRY: ${requestedCountry}. Supported pilot countries: ${Object.keys(COUNTRY_CONFIG).join(', ')}.`);
}

const { grid, loaded } = loadRegionGrid(config);

if (process.argv.includes('--self-test')) {
  const square = {
    type: 'Polygon',
    coordinates: [[[0,0],[1,0],[1,1],[0,1],[0,0]]]
  };
  if (!contains(0.5, 0.5, square) || contains(2, 2, square)) {
    throw Error('Geometry self-test failed');
  }
  if (Math.abs(distanceKm(0, 0, 0, 1) - 111.195) > 0.2) {
    throw Error('Distance self-test failed');
  }
  const minFeatures = Number(config.minFeatures || 1);
  if (loaded < minFeatures) {
    throw Error(`Boundary self-test failed: only ${loaded} features loaded; expected at least ${minFeatures}.`);
  }

  // A known coordinate must resolve inside the selected country's ADM2 boundary.
  const [testLat, testLon] = config.selfTestPoint || [];
  const resolved = Number.isFinite(testLat) && Number.isFinite(testLon)
    ? findRegion(testLat, testLon, grid)
    : null;

  if (!resolved?.regionCode || !resolved?.regionName) {
    throw Error(
      `${config.countryCode} ${config.adminLevel} point-in-polygon self-test failed for ${config.selfTestLabel || 'test coordinate'}.`
    );
  }

  console.log(
    `${config.countryCode} ${config.adminLevel} self-test resolved ` +
    `${config.selfTestLabel || 'test coordinate'} to: ` +
    `${resolved.regionName} (${resolved.regionCode})`
  );
  console.log('International Territory geometry, distance, and boundary-file self-tests passed.');
  process.exit(0);
}

const base = process.env.SUPABASE_URL;
const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!base || !secret) {
  throw Error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
}

const year = Number(process.env.TERRITORY_YEAR || new Date().getUTCFullYear());
if (!Number.isInteger(year) || year < 2026 || year > 2099) {
  throw Error('TERRITORY_YEAR must be 2026-2099.');
}

const headers = {
  apikey: secret,
  Authorization: `Bearer ${secret}`,
  'Content-Type': 'application/json'
};

async function request(uri, init = {}) {
  const response = await fetch(`${base.replace(/\/$/, '')}/rest/v1/${uri}`, {
    ...init,
    headers: { ...headers, ...init.headers }
  });
  if (!response.ok) {
    const body = (await response.text()).slice(0, 700);
    throw Error(`${response.status} ${uri.split('?')[0]}: ${body}`);
  }
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

let userOffset = 0;
let usersProcessed = 0;
let runsProcessed = 0;
let rowsWritten = 0;
let runsWithCountryDistance = 0;

while (true) {
  const users = await request(
    `ranking_settings?select=user_id&join_territory=eq.true&order=user_id&limit=100&offset=${userOffset}`
  );
  if (!users.length) break;

  for (const user of users) {
    usersProcessed++;
    let runOffset = 0;

    while (true) {
      const runs = await request(
        `runs?select=id,activity_date,route,distance_km` +
        `&user_id=eq.${encodeURIComponent(user.user_id)}` +
        `&activity_date=gte.${year}-01-01&activity_date=lt.${year + 1}-01-01` +
        `&deleted_at=is.null&route=not.is.null&distance_km=gt.0&order=id&limit=50&offset=${runOffset}`
      );
      if (!runs.length) break;

      for (const run of runs) {
        if (!Array.isArray(run.route) || run.route.length < 2) continue;

        // Rebuild only this country's rows for the run. Japan data is untouched.
        await request(
          `territory_run_region_distance?run_id=eq.${encodeURIComponent(run.id)}` +
          `&country_code=eq.${encodeURIComponent(config.countryCode)}` +
          `&admin_level=eq.${encodeURIComponent(config.adminLevel)}`,
          { method: 'DELETE' }
        );

        const analysed = analyseRoute(run.route, run.distance_km, grid);
        const rows = analysed.map(row => ({
          user_id: user.user_id,
          run_id: run.id,
          activity_year: year,
          country_code: config.countryCode,
          admin_level: config.adminLevel,
          region_code: row.regionCode,
          region_name: row.regionName,
          parent_region_name: row.parentRegionName || null,
          distance_km: Number(row.km.toFixed(6)),
          updated_at: new Date().toISOString()
        }));

        if (rows.length) {
          await request(
            'territory_run_region_distance?on_conflict=run_id,country_code,admin_level,region_code',
            {
              method: 'POST',
              headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
              body: JSON.stringify(rows)
            }
          );
          rowsWritten += rows.length;
          runsWithCountryDistance++;
        }

        runsProcessed++;
      }

      runOffset += runs.length;
      if (runs.length < 50) break;
    }
  }

  userOffset += users.length;
  if (users.length < 100) break;
}

console.log(
  `Rings Territory ${config.countryCode} ${config.adminLevel} ${year}: ` +
  `processed ${usersProcessed} opted-in users, ${runsProcessed} runs, ` +
  `${runsWithCountryDistance} runs had in-country distance, ` +
  `upserted ${rowsWritten} region-distance rows.`
);
