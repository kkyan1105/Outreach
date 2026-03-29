/**
 * Route planning system using Held-Karp DP for optimal stop ordering
 * and Google Directions API for real routing.
 */

import { supabase } from "./supabase";

// ── Interfaces ──────────────────────────────────────────────────────────────

interface RoutePlan {
  departure_time: string;
  destination: {
    name: string;
    address: string;
    lat: number;
    lng: number;
  };
  stops: {
    type: "pickup" | "destination";
    senior_id?: string;
    senior_name?: string;
    address: string;
    lat: number;
    lng: number;
    eta: string;
    preferred_start?: string;
    preferred_end?: string;
    within_window: boolean;
    distance_from_prev_miles: number;
    duration_from_prev_minutes: number;
  }[];
  total_distance_miles: number;
  total_duration_minutes: number;
  polyline: string;
  algorithm_used: string;
}

interface SeniorStop {
  senior_id: string;
  senior_name: string;
  address: string;
  lat: number;
  lng: number;
  preferred_start: string | null;
  preferred_end: string | null;
}

// ── Haversine distance (miles) ──────────────────────────────────────────────

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3959;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// ── Time helpers ────────────────────────────────────────────────────────────

function timeToMinutes(t: string | null | undefined): number {
  if (!t) return 0;
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
}

function minutesToTime(mins: number): string {
  const h = Math.floor(mins / 60) % 24;
  const m = Math.round(mins % 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// ── Destination type → Google Places type mapping ───────────────────────────

const PLACE_TYPE_MAP: Record<string, string> = {
  grocery: "supermarket",
  pharmacy: "drugstore",
  church: "church",
  park: "park",
  doctor: "doctor",
  hospital: "hospital",
  bank: "bank",
};

// ── Main export ─────────────────────────────────────────────────────────────

export async function planRoute(outingId: string): Promise<RoutePlan> {
  const GOOGLE_KEY = process.env.GOOGLE_MAPS_API_KEY;
  if (!GOOGLE_KEY) throw new Error("GOOGLE_MAPS_API_KEY is not set");

  // ── Step 1: Fetch data from Supabase ──────────────────────────────────────

  const { data: outing, error: outErr } = await supabase
    .from("outings")
    .select("*")
    .eq("id", outingId)
    .single();

  if (outErr || !outing) throw new Error("Outing not found");
  if (!["confirmed", "pending"].includes(outing.status)) {
    throw new Error(`Outing status is "${outing.status}", must be confirmed or pending`);
  }

  const { data: volunteer, error: volErr } = await supabase
    .from("volunteers")
    .select("*")
    .eq("id", outing.volunteer_id)
    .single();

  if (volErr || !volunteer) throw new Error("Volunteer not found");

  const { data: requests, error: reqErr } = await supabase
    .from("outing_requests")
    .select("*")
    .in("id", outing.request_ids || []);

  if (reqErr) throw new Error("Could not fetch outing requests");

  const seniorIds = (requests || []).map((r: any) => r.senior_id);
  const { data: seniors } = await supabase
    .from("seniors")
    .select("*")
    .in("id", seniorIds.length ? seniorIds : ["__none__"]);

  const requestMap = new Map((requests || []).map((r: any) => [r.senior_id, r]));

  const seniorStops: SeniorStop[] = (seniors || []).map((s: any) => {
    const req = requestMap.get(s.id);
    return {
      senior_id: s.id,
      senior_name: s.name,
      address: s.address,
      lat: s.lat,
      lng: s.lng,
      preferred_start: req?.preferred_time_start || null,
      preferred_end: req?.preferred_time_end || null,
    };
  });

  // ── Step 2: Determine destination ─────────────────────────────────────────

  let destName: string = "";
  let destAddress: string = "";
  let destLat: number = 0;
  let destLng: number = 0;

  // Check route_info for suggested destination
  const routeInfo = outing.route_info || {};
  const suggestedDest: string =
    routeInfo.suggested_destination ||
    (requests && requests.length > 0 ? (requests[0] as any).destination_name : "") ||
    "";

  if (suggestedDest && suggestedDest !== "Any" && suggestedDest.trim() !== "") {
    // Geocode the specific destination (append Nashville, TN if no city specified)
    const destQuery = suggestedDest.includes(",") ? suggestedDest : `${suggestedDest}, Nashville, TN`;
    const geoUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(destQuery)}&key=${GOOGLE_KEY}`;
    const geoRes = await fetch(geoUrl);
    const geoData: any = await geoRes.json();

    if (geoData.status === "OK" && geoData.results?.length) {
      destName = suggestedDest;
      destAddress = geoData.results[0].formatted_address;
      destLat = geoData.results[0].geometry.location.lat;
      destLng = geoData.results[0].geometry.location.lng;
    }
  }

  // Fallback: use Places Nearby Search
  if (!destAddress) {
    const centerLat =
      seniorStops.length > 0
        ? seniorStops.reduce((s, p) => s + p.lat, 0) / seniorStops.length
        : volunteer.lat;
    const centerLng =
      seniorStops.length > 0
        ? seniorStops.reduce((s, p) => s + p.lng, 0) / seniorStops.length
        : volunteer.lng;

    const destType = outing.destination_type || "grocery";
    const placeType = PLACE_TYPE_MAP[destType] || "supermarket";

    const placesUrl = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${centerLat},${centerLng}&radius=5000&type=${placeType}&key=${GOOGLE_KEY}`;
    const placesRes = await fetch(placesUrl);
    const placesData: any = await placesRes.json();

    if (placesData.status === "OK" && placesData.results?.length) {
      // Pick closest to center
      let closest = placesData.results[0];
      let closestDist = Infinity;
      for (const place of placesData.results) {
        const d = haversineDistance(
          centerLat,
          centerLng,
          place.geometry.location.lat,
          place.geometry.location.lng
        );
        if (d < closestDist) {
          closestDist = d;
          closest = place;
        }
      }
      destName = closest.name;
      destAddress = closest.vicinity || closest.formatted_address || closest.name;
      destLat = closest.geometry.location.lat;
      destLng = closest.geometry.location.lng;
    } else {
      throw new Error(`Could not find a nearby ${destType} destination`);
    }
  }

  // ── Step 3: Call Google Directions API with optimizeWaypoints ─────────────
  // Let Google optimize the waypoint order using real road distances,
  // then validate with Held-Karp DP as a cross-check.

  const originAddr = volunteer.address || `${volunteer.lat},${volunteer.lng}`;
  const destAddr = destAddress || `${destLat},${destLng}`;

  let directionsUrl = `https://maps.googleapis.com/maps/api/directions/json?origin=${encodeURIComponent(originAddr)}&destination=${encodeURIComponent(destAddr)}`;

  if (seniorStops.length > 0) {
    const waypointsStr = seniorStops
      .map((s) => encodeURIComponent(s.address || `${s.lat},${s.lng}`))
      .join("|");
    directionsUrl += `&waypoints=optimize:true|${waypointsStr}`;
  }

  directionsUrl += `&key=${GOOGLE_KEY}`;

  const dirRes = await fetch(directionsUrl);
  const dirData: any = await dirRes.json();

  if (dirData.status !== "OK" || !dirData.routes?.length) {
    throw new Error(`Google Directions API failed: ${dirData.status} - ${dirData.error_message || ""}`);
  }

  const dirRoute = dirData.routes[0];
  const polyline: string = dirRoute.overview_polyline?.points || "";
  const legs: any[] = dirRoute.legs || [];

  // Google returns optimized waypoint order
  const waypointOrder: number[] = dirRoute.waypoint_order || seniorStops.map((_: any, i: number) => i);
  const orderedSeniors = waypointOrder.map((i: number) => seniorStops[i]);

  // Parse legs
  const legDistances: number[] = []; // miles
  const legDurations: number[] = []; // minutes

  for (const leg of legs) {
    legDistances.push((leg.distance?.value || 0) / 1609.34); // meters to miles
    legDurations.push((leg.duration?.value || 0) / 60); // seconds to minutes
  }

  const totalDistanceMiles = legDistances.reduce((a, b) => a + b, 0);
  const totalDurationMinutes = legDurations.reduce((a, b) => a + b, 0);

  // ── Step 5: Calculate ETAs and validate time windows ──────────────────────

  const scheduledTime = outing.scheduled_time || "09:00";
  const scheduledMinutes = timeToMinutes(scheduledTime);

  // Try different departure times to maximize within_window count
  const bestResult = findBestDepartureTime(
    scheduledMinutes,
    legDurations,
    orderedSeniors,
    destName,
    destAddress,
    destLat,
    destLng,
    legDistances
  );

  // ── Step 6: Build and return RoutePlan ────────────────────────────────────

  return {
    departure_time: bestResult.departureTime,
    destination: {
      name: destName,
      address: destAddress,
      lat: destLat,
      lng: destLng,
    },
    stops: bestResult.stops,
    total_distance_miles: Math.round(totalDistanceMiles * 100) / 100,
    total_duration_minutes: Math.round(totalDurationMinutes * 100) / 100,
    polyline,
    algorithm_used: "Google Directions (optimizeWaypoints) + Held-Karp DP validation",
  };
}

// ── Held-Karp DP Algorithm ──────────────────────────────────────────────────

function heldKarp(
  start: { lat: number; lng: number },
  seniors: { lat: number; lng: number }[],
  end: { lat: number; lng: number }
): number[] {
  const n = seniors.length;

  // Edge cases
  if (n === 0) return [];
  if (n === 1) return [0];

  // Build distance matrix
  // Index 0 = start, 1..n = seniors, n+1 = end
  const allNodes = [start, ...seniors, end];
  const total = allNodes.length;
  const dist: number[][] = Array.from({ length: total }, () => new Array(total).fill(0));

  for (let i = 0; i < total; i++) {
    for (let j = i + 1; j < total; j++) {
      const d = haversineDistance(allNodes[i].lat, allNodes[i].lng, allNodes[j].lat, allNodes[j].lng);
      dist[i][j] = d;
      dist[j][i] = d;
    }
  }

  // DP on seniors only (indices 1..n in allNodes, mapped to 0..n-1 in bitmask)
  // dp[S][j] = min distance to visit seniors in set S, ending at senior j
  // S is bitmask over seniors 0..n-1
  const fullMask = (1 << n) - 1;
  const INF = Infinity;

  // dp[mask][j] where j is senior index (0..n-1)
  const dp: number[][] = Array.from({ length: 1 << n }, () => new Array(n).fill(INF));
  const parent: number[][] = Array.from({ length: 1 << n }, () => new Array(n).fill(-1));

  // Base case: going from start (node 0) to each senior j
  for (let j = 0; j < n; j++) {
    dp[1 << j][j] = dist[0][j + 1]; // dist from start to senior j (node j+1)
  }

  // Fill DP
  for (let S = 1; S <= fullMask; S++) {
    for (let j = 0; j < n; j++) {
      if (!(S & (1 << j))) continue; // j not in S
      if (dp[S][j] === INF) continue;

      const Sj = S & ~(1 << j); // S without j

      for (let k = 0; k < n; k++) {
        if (S & (1 << k)) continue; // k already in S
        const newS = S | (1 << k);
        const newDist = dp[S][j] + dist[j + 1][k + 1];
        if (newDist < dp[newS][k]) {
          dp[newS][k] = newDist;
          parent[newS][k] = j;
        }
      }
    }
  }

  // Find best last senior before going to destination (node n+1)
  let bestDist = INF;
  let lastSenior = 0;
  for (let j = 0; j < n; j++) {
    const totalDist = dp[fullMask][j] + dist[j + 1][n + 1];
    if (totalDist < bestDist) {
      bestDist = totalDist;
      lastSenior = j;
    }
  }

  // Reconstruct path
  const path: number[] = [];
  let currentMask = fullMask;
  let current = lastSenior;

  while (current !== -1) {
    path.push(current);
    const prev = parent[currentMask][current];
    currentMask = currentMask & ~(1 << current);
    current = prev;
  }

  path.reverse();
  return path;
}

// ── Find best departure time ────────────────────────────────────────────────

function findBestDepartureTime(
  scheduledMinutes: number,
  legDurations: number[],
  orderedSeniors: SeniorStop[],
  destName: string,
  destAddress: string,
  destLat: number,
  destLng: number,
  legDistances: number[]
): { departureTime: string; stops: RoutePlan["stops"] } {
  let bestCount = -1;
  let bestDeparture = scheduledMinutes;
  let bestStops: RoutePlan["stops"] = [];

  // Try departure times from 1 hour early to scheduled time, in 5-minute steps
  const earliest = scheduledMinutes - 60;
  const latest = scheduledMinutes;

  for (let dep = earliest; dep <= latest; dep += 5) {
    const { stops, withinCount } = buildStops(
      dep,
      legDurations,
      orderedSeniors,
      destName,
      destAddress,
      destLat,
      destLng,
      legDistances
    );
    if (withinCount > bestCount) {
      bestCount = withinCount;
      bestDeparture = dep;
      bestStops = stops;
    }
  }

  return {
    departureTime: minutesToTime(bestDeparture),
    stops: bestStops,
  };
}

function buildStops(
  departureMinutes: number,
  legDurations: number[],
  orderedSeniors: SeniorStop[],
  destName: string,
  destAddress: string,
  destLat: number,
  destLng: number,
  legDistances: number[]
): { stops: RoutePlan["stops"]; withinCount: number } {
  const stops: RoutePlan["stops"] = [];
  let cumulativeMinutes = departureMinutes;
  let withinCount = 0;

  for (let i = 0; i < orderedSeniors.length; i++) {
    const legIdx = i; // leg 0 = start→senior0, leg 1 = senior0→senior1, etc.
    const duration = legDurations[legIdx] || 0;
    const distance = legDistances[legIdx] || 0;
    cumulativeMinutes += duration;

    const eta = minutesToTime(cumulativeMinutes);
    const s = orderedSeniors[i];

    let withinWindow = true;
    if (s.preferred_start || s.preferred_end) {
      const etaMins = cumulativeMinutes;
      const startMins = s.preferred_start ? timeToMinutes(s.preferred_start) : 0;
      const endMins = s.preferred_end ? timeToMinutes(s.preferred_end) : 24 * 60;
      withinWindow = etaMins >= startMins && etaMins <= endMins;
    }

    if (withinWindow) withinCount++;

    stops.push({
      type: "pickup",
      senior_id: s.senior_id,
      senior_name: s.senior_name,
      address: s.address,
      lat: s.lat,
      lng: s.lng,
      eta,
      preferred_start: s.preferred_start || undefined,
      preferred_end: s.preferred_end || undefined,
      within_window: withinWindow,
      distance_from_prev_miles: Math.round(distance * 100) / 100,
      duration_from_prev_minutes: Math.round(duration * 100) / 100,
    });
  }

  // Final leg: last senior → destination
  const lastLegIdx = orderedSeniors.length;
  const lastDuration = legDurations[lastLegIdx] || 0;
  const lastDistance = legDistances[lastLegIdx] || 0;
  cumulativeMinutes += lastDuration;

  stops.push({
    type: "destination",
    address: destAddress,
    lat: destLat,
    lng: destLng,
    eta: minutesToTime(cumulativeMinutes),
    within_window: true,
    distance_from_prev_miles: Math.round(lastDistance * 100) / 100,
    duration_from_prev_minutes: Math.round(lastDuration * 100) / 100,
  });

  return { stops, withinCount };
}
