/**
 * Runner's Rings Rings Territory sync.
 * Japan municipality annual-distance aggregation for opted-in runners.
 * Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
 *
 * Distance attribution matches the app's existing approach:
 * each GPS segment is assigned to the municipality containing its midpoint,
 * then municipality totals are scaled to the run's stored distance_km.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const boundaryFile = path.join(root, 'runners-rings-japan-web.geojson');

function bboxGeom(g) {
  const b = [Infinity, Infinity, -Infinity, -Infinity];
  function walk(v) {
    if (!Array.isArray(v)) return;
    if (typeof v[0] === 'number' && typeof v[1] === 'number') {
      b[0] = Math.min(b[0], v[0]);
      b[1] = Math.min(b[1], v[1]);
      b[2] = Math.max(b[2], v[0]);
      b[3] = Math.max(b[3], v[1]);
      return;
    }
    for (const w of v) walk(w);
  }
  walk(g.coordinates);
  return b;
}

function ringContains(x, y, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if ((a[1] > y) !== (b[1] > y) &&
        x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}

function polygonContains(x, y, p) {
  return p.length > 0 &&
    ringContains(x, y, p[0]) &&
    !p.slice(1).some(h => ringContains(x, y, h));
}

function contains(x, y, g) {
  return g.type === 'Polygon'
    ? polygonContains(x, y, g.coordinates)
    : g.type === 'MultiPolygon' &&
      g.coordinates.some(p => polygonContains(x, y, p));
}

const cellSize = 0.5;
const cellKey = (x, y) => `${Math.floor(x / cellSize)},${Math.floor(y / cellSize)}`;

function loadMunicipalities() {
  if (!fs.existsSync(boundaryFile)) throw Error('Missing runners-rings-japan-web.geojson');
  const geo = JSON.parse(fs.readFileSync(boundaryFile, 'utf8'));
  const grid = new Map();
  let count = 0;

  for (const f of geo.features || []) {
    if (!f.geometry) continue;
    const p = f.properties || {};
    const code = String(p.N03_007 || '');
    const prefecture = String(p.N03_001 || '');
    const municipality = [p.N03_003, p.N03_004].filter(Boolean).join(' ');
    if (!code || !prefecture || !municipality) continue;

    const bbox = bboxGeom(f.geometry);
    if (!bbox.every(Number.isFinite)) continue;

    const item = {
      code,
      municipality,
      prefecture,
      geom: f.geometry,
      bbox
    };
    count++;

    for (let ix = Math.floor(bbox[0] / cellSize); ix <= Math.floor(bbox[2] / cellSize); ix++) {
      for (let iy = Math.floor(bbox[1] / cellSize); iy <= Math.floor(bbox[3] / cellSize); iy++) {
        const k = `${ix},${iy}`;
        if (!grid.has(k)) grid.set(k, []);
        grid.get(k).push(item);
      }
    }
  }

  console.log(`Loaded ${count} Japan municipality features.`);
  return grid;
}

function findMunicipality(lat, lon, grid) {
  const candidates = grid.get(cellKey(lon, lat)) || [];
  for (const f of candidates) {
    const b = f.bbox;
    if (lon < b[0] || lon > b[2] || lat < b[1] || lat > b[3]) continue;
    if (contains(lon, lat, f.geom)) return f;
  }
  return null;
}

function distanceKm(aLat, aLon, bLat, bLon) {
  const R = 6371.0088;
  const toRad = v => v * Math.PI / 180;
  const dLat = toRad(bLat - aLat);
  const dLon = toRad(bLon - aLon);
  const s1 = Math.sin(dLat / 2);
  const s2 = Math.sin(dLon / 2);
  const h = s1 * s1 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * s2 * s2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

function analyseRoute(route, targetDistanceKm, grid) {
  const cityDistances = new Map();
  let calculatedKm = 0;

  for (let i = 1; i < route.length; i++) {
    const prev = route[i - 1], current = route[i];
    if (!Array.isArray(prev) || !Array.isArray(current) ||
        prev.length < 2 || current.length < 2) continue;

    const aLat = Number(prev[0]), aLon = Number(prev[1]);
    const bLat = Number(current[0]), bLon = Number(current[1]);
    if (![aLat, aLon, bLat, bLon].every(Number.isFinite)) continue;
    if (Math.abs(aLat) > 90 || Math.abs(bLat) > 90 ||
        Math.abs(aLon) > 180 || Math.abs(bLon) > 180) continue;

    const segmentKm = distanceKm(aLat, aLon, bLat, bLon);
    if (!Number.isFinite(segmentKm) || segmentKm <= 0) continue;
    calculatedKm += segmentKm;

    const midLat = (aLat + bLat) / 2;
    const midLon = (aLon + bLon) / 2;
    const city = findMunicipality(midLat, midLon, grid);
    if (!city) continue;

    const currentRow = cityDistances.get(city.code) || {
      code: city.code,
      municipality: city.municipality,
      prefecture: city.prefecture,
      km: 0
    };
    currentRow.km += segmentKm;
    cityDistances.set(city.code, currentRow);
  }

  const target = Number(targetDistanceKm);
  if (Number.isFinite(target) && target > 0 && calculatedKm > 0) {
    const scale = target / calculatedKm;
    for (const row of cityDistances.values()) row.km *= scale;
  }

  return [...cityDistances.values()].filter(r => r.km > 0.0001);
}

if (process.argv.includes('--self-test')) {
  const sq = { type: 'Polygon', coordinates: [[[0,0],[1,0],[1,1],[0,1],[0,0]]] };
  if (!contains(.5, .5, sq) || contains(2, 2, sq)) throw Error('Geometry self-test failed');
  if (Math.abs(distanceKm(0, 0, 0, 1) - 111.195) > .2) throw Error('Distance self-test failed');
  const grid = loadMunicipalities();
  if (!grid.size) throw Error('Empty municipality grid');
  console.log('Territory geometry, distance, and boundary-file self-tests passed.');
  process.exit(0);
}

const base = process.env.SUPABASE_URL;
const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!base || !secret) throw Error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');

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
  const response = await fetch(`${base.replace(/\/$/,'')}/rest/v1/${uri}`, {
    ...init,
    headers: { ...headers, ...init.headers }
  });
  if (!response.ok) {
    throw Error(`${response.status} ${uri.split('?')[0]}: ${(await response.text()).slice(0, 500)}`);
  }
  const txt = await response.text();
  return txt ? JSON.parse(txt) : null;
}

const grid = loadMunicipalities();
let userOffset = 0;
let usersProcessed = 0;
let runsProcessed = 0;
let rowsWritten = 0;

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
        `&route=not.is.null&distance_km=gt.0&order=id&limit=50&offset=${runOffset}`
      );
      if (!runs.length) break;

      for (const run of runs) {
        if (!Array.isArray(run.route) || run.route.length < 2) continue;

        // Rebuild this run atomically enough for the scheduled trusted sync:
        // remove old municipality rows, then write the current analysis.
        await request(
          `territory_run_municipality_distance?run_id=eq.${encodeURIComponent(run.id)}`,
          { method: 'DELETE' }
        );

        const analysed = analyseRoute(run.route, run.distance_km, grid);
        const rows = analysed.map(row => ({
          user_id: user.user_id,
          run_id: run.id,
          activity_year: year,
          municipality_code: row.code,
          municipality_name: row.municipality,
          prefecture_name: row.prefecture,
          distance_km: Number(row.km.toFixed(6)),
          updated_at: new Date().toISOString()
        }));

        if (rows.length) {
          await request(
            'territory_run_municipality_distance?on_conflict=run_id,municipality_code',
            {
              method: 'POST',
              headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
              body: JSON.stringify(rows)
            }
          );
          rowsWritten += rows.length;
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
  `Rings Territory ${year}: processed ${usersProcessed} opted-in users, ` +
  `${runsProcessed} runs, upserted ${rowsWritten} run-municipality distance rows.`
);
