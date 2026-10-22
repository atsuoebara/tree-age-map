import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const WORLD_ADM0_URL = "https://runnersrings.com/runners-rings-world-adm0.geojson";
const PAGE_SIZE = 1000; // Auth user list page size; run RPC pages are 500.

type RunRow = { source: string | null; name: string | null; distance_km: number | null };
type OriginRow = RunRow & { lat: number | null; lng: number | null };
type IndexedRing = { coordinates: number[][]; edgesByLatitude: Map<number, number[]> };
type IndexedPolygon = { outer: IndexedRing; holes: IndexedRing[]; bbox: number[] };
type Country = { iso3: string; nameJa: string; nameEn: string; polygons: IndexedPolygon[]; bbox: number[] };

// Exact ray casting, but inspect only edges spanning the point's latitude.
// This changes the search cost, not the ADM0 boundary coordinates.
function indexRing(coordinates: number[][]): IndexedRing {
  const edgesByLatitude = new Map<number, number[]>();
  for (let i = 0, j = coordinates.length - 1; i < coordinates.length; j = i++) {
    const yi = coordinates[i][1], yj = coordinates[j][1];
    if (!Number.isFinite(yi) || !Number.isFinite(yj) || yi === yj) continue;
    const start = Math.max(-90, Math.floor(Math.min(yi, yj)));
    const end = Math.min(90, Math.floor(Math.max(yi, yj)));
    for (let bucket = start; bucket <= end; bucket++) {
      let edges = edgesByLatitude.get(bucket);
      if (!edges) { edges = []; edgesByLatitude.set(bucket, edges); }
      edges.push(i);
    }
  }
  return { coordinates, edgesByLatitude };
}
function polygonBounds(rings: number[][][]): number[] {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const point of rings[0] || []) {
    minX = Math.min(minX, point[0]); maxX = Math.max(maxX, point[0]);
    minY = Math.min(minY, point[1]); maxY = Math.max(maxY, point[1]);
  }
  return [minX, minY, maxX, maxY];
}
let worldPromise: Promise<Country[]> | null = null;

function loadWorld(): Promise<Country[]> {
  if (worldPromise) return worldPromise;
  worldPromise = (async () => {
    const response = await fetch(WORLD_ADM0_URL);
    if (!response.ok) throw new Error(`ADM0 HTTP ${response.status}`);
    const world = await response.json();
    if (!Array.isArray(world?.features)) throw new Error("Invalid ADM0 data");
    const prepared: Country[] = [];
    for (const feature of world.features) {
      const iso3 = String(feature?.properties?.iso3_standard || feature?.properties?.iso3 || "").toUpperCase();
      // ADM0 also contains non-country features marked -99. Do not merge them.
      if (!/^[A-Z]{3}$/.test(iso3)) continue;
      const geometry = feature?.geometry;
      const polygons = geometry?.type === "Polygon" ? [geometry.coordinates]
        : geometry?.type === "MultiPolygon" ? geometry.coordinates : [];
      if (!polygons.length) continue;
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const polygon of polygons) for (const ring of polygon) for (const point of ring) {
        const x = Number(point[0]), y = Number(point[1]);
        if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
        minX = Math.min(minX, x); maxX = Math.max(maxX, x);
        minY = Math.min(minY, y); maxY = Math.max(maxY, y);
      }
      if (!Number.isFinite(minX)) continue;
      prepared.push({
        iso3,
        nameJa: String(feature.properties.name_ja || feature.properties.name || iso3),
        nameEn: String(feature.properties.name_en || feature.properties.name || iso3),
        polygons: polygons.filter((polygon: number[][][]) => polygon.length && polygon[0].length)
          .map((polygon: number[][][]) => ({
            outer: indexRing(polygon[0]),
            holes: polygon.slice(1).map(indexRing),
            bbox: polygonBounds(polygon),
          })),
        bbox: [minX, minY, maxX, maxY],
      });
    }
    if (!prepared.length) throw new Error("ADM0 contains no countries");
    return prepared;
  })().catch((error) => { worldPromise = null; throw error; });
  return worldPromise;
}

function pointInRing(x: number, y: number, ring: IndexedRing): boolean {
  let inside = false;
  const coordinates = ring.coordinates;
  const edges = ring.edgesByLatitude.get(Math.floor(y)) || [];
  for (const i of edges) {
    const j = i === 0 ? coordinates.length - 1 : i - 1;
    const [xi, yi] = coordinates[i], [xj, yj] = coordinates[j];
    if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) inside = !inside;
  }
  return inside;
}
function countryForPoint(lat: number, lng: number, countries: Country[]): Country | null {
  for (const country of countries) {
    const [minX, minY, maxX, maxY] = country.bbox;
    if (lng < minX || lng > maxX || lat < minY || lat > maxY) continue;
    for (const polygon of country.polygons) {
      const [px0, py0, px1, py1] = polygon.bbox;
      if (lng < px0 || lng > px1 || lat < py0 || lat > py1) continue;
      if (!pointInRing(lng, lat, polygon.outer)) continue;
      if (!polygon.holes.some(ring => pointInRing(lng, lat, ring))) return country;
    }
  }
  return null;
}

// Read only a bounded page of GPS routes in each database query.
async function collectRunPages(supabase: any): Promise<OriginRow[]> {
  const rows: OriginRow[] = [];
  let cursor: string | null = null;
  let expected: number | null = null;
  for (let page = 0; page < 10000; page++) {
    const { data, error } = await supabase.rpc("get_import_share_origin_page", {
      p_after_id: cursor, p_limit: 500,
    });
    if (error) throw new Error(`Run page ${page + 1}: ${error.code || ""} ${error.message || error}`);
    if (!data || !Array.isArray(data.rows)) throw new Error("Invalid run page response");
    if (page === 0) {
      expected = Number(data.total_rows);
      if (data.total_rows == null || !Number.isSafeInteger(expected) || expected < 0) throw new Error("Run count unavailable");
    }
    if (!data.rows.length) {
      if (rows.length !== expected) throw new Error("Run count changed or data was truncated; retry");
      return rows;
    }
    for (const row of data.rows) {
      if (typeof row.run_id !== "string" || (cursor !== null && row.run_id <= cursor)) throw new Error("Invalid pagination cursor");
      cursor = row.run_id;
      rows.push(row);
    }
    if (expected !== null && rows.length > expected) throw new Error("Run count changed; retry");
  }
  throw new Error("Aggregation exceeded page limit");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) throw new Error("Supabase environment variables are missing");
    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const [origins, countries, registeredUsers] = await Promise.all([
      collectRunPages(supabase),
      loadWorld(),
      (async () => {
        let count = 0;
        for (let page = 1; ; page++) {
          const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: PAGE_SIZE });
          if (error) throw error;
          const users = data?.users ?? [];
          count += users.length;
          if (users.length < PAGE_SIZE) return count;
        }
      })(),
    ]);
    const counts = { strava: 0, intervals: 0, coros: 0, garmin: 0, file: 0 };
    let totalDistanceKm = 0;
    for (const row of origins) {
      const source = String(row.source ?? "").trim().toLowerCase();
      const name = String(row.name ?? "").trim().toLowerCase();
      const distance = Number(row.distance_km);
      if (Number.isFinite(distance) && distance > 0) totalDistanceKm += distance;
      if (source === "strava") counts.strava++;
      else if (source === "garmin") counts.garmin++;
      else if (source === "intervals" || source === "intervals.icu") counts.intervals++;
      else if (source === "coros" || name.startsWith("coros-")) counts.coros++;
      else if (["fit", "tcx", "local", "github", "archive", "gpx", "file"].includes(source)) counts.file++;
    }
    // Include direct Garmin imports (including Connect IQ) in the run-count denominator.
    const total = counts.strava + counts.intervals + counts.coros + counts.garmin + counts.file;
    const percentages = Object.fromEntries(Object.entries(counts)
      .map(([source, count]) => [source, total > 0 ? Math.round(count / total * 1000) / 10 : 0]));
    const countryDistance: Record<string, number> = {};
    let validOrigins = 0, matchedOrigins = 0, unmatchedDistanceKm = 0;
    const countryCache = new Map<string, Country | null>();
    for (const row of origins) {
      if (row.lat == null || row.lng == null || row.distance_km == null) continue;
      const lat = Number(row.lat), lng = Number(row.lng), distance = Number(row.distance_km);
      if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180 || !Number.isFinite(distance) || distance <= 0) continue;
      validOrigins++;
      const key = `${lat},${lng}`;
      if (!countryCache.has(key)) countryCache.set(key, countryForPoint(lat, lng, countries));
      const country = countryCache.get(key);
      if (!country) { unmatchedDistanceKm += distance; continue; }
      matchedOrigins++;
      countryDistance[country.iso3] = (countryDistance[country.iso3] || 0) + distance;
    }
    const countryMeta = Object.fromEntries(countries.map(country => [country.iso3, { ja: country.nameJa, en: country.nameEn }]));
    return new Response(JSON.stringify({
      ...percentages, total, registeredUsers, totalDistanceKm, countryDistance, countryMeta,
      countryDistanceMethod: "run_start_point",
      countryDistanceStats: {
        fetchedOrigins: origins.length,
        validOrigins,
        matchedOrigins,
        unmatchedOrigins: validOrigins - matchedOrigins,
        invalidOrigins: origins.length - validOrigins,
        unmatchedDistanceKm,
      },
    }), { headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "public, max-age=300" } });
  } catch (error) {
    console.error("import-share error:", error);
    return new Response(JSON.stringify({ error: "Failed to calculate import share." }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  }
});

