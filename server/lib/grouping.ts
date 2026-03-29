/**
 * Senior Outing Grouping Algorithm
 *
 * Pipeline:
 * 1. DBSCAN — geographic pre-clustering (already in clustering.ts)
 * 2. Compatibility Graph — build edges between compatible requests
 * 3. Bron-Kerbosch — find maximum cliques as optimal groups
 * 4. Greedy Clique Cover — assign all requests to groups
 */

// ── Types ─────────────────────────────────────────────────────────────────

interface RequestNode {
  id: string;           // request ID
  senior_id: string;
  destination_type: string;
  destination_name: string; // "Any", specific name, or "A; B" multi-select
  preferred_date: string;   // "YYYY-MM-DD"
  preferred_time_start: string; // "HH:MM" or "HH:MM:SS"
  preferred_time_end: string;
  lat: number;
  lng: number;
}

interface GroupResult {
  senior_ids: string[];
  request_ids: string[];
  destination_type: string;
  suggested_destination: string;
  suggested_time: string; // earliest overlapping start time
  preferred_date: string;
  reasoning: string;
}

// ── Haversine Distance (miles) ────────────────────────────────────────────

function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3959;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Time Window Helpers ───────────────────────────────────────────────────

function timeToMinutes(t: string): number {
  const [h, m] = (t || "00:00").split(":").map(Number);
  return h * 60 + (m || 0);
}

function minutesToTime(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Returns overlap in minutes, or 0 if no overlap */
function timeOverlap(a: RequestNode, b: RequestNode): number {
  const aStart = timeToMinutes(a.preferred_time_start);
  const aEnd = timeToMinutes(a.preferred_time_end);
  const bStart = timeToMinutes(b.preferred_time_start);
  const bEnd = timeToMinutes(b.preferred_time_end);
  const overlapStart = Math.max(aStart, bStart);
  const overlapEnd = Math.min(aEnd, bEnd);
  return Math.max(0, overlapEnd - overlapStart);
}

/** Returns the overlapping time window start for a set of requests */
function groupOverlapStart(nodes: RequestNode[]): number {
  let latest = 0;
  for (const n of nodes) latest = Math.max(latest, timeToMinutes(n.preferred_time_start));
  return latest;
}

// ── Destination Compatibility ─────────────────────────────────────────────

/** Parse "A; B; C" into a set of names, or "Any" */
function parseDestNames(name: string): Set<string> | "any" {
  if (!name || name.toLowerCase() === "any") return "any";
  // Handle both ";" (places) and "," (pharmacy chains) separators
  const parts = name.split(/[;,]/).map(s => s.trim().toLowerCase()).filter(Boolean);
  return new Set(parts);
}

/** Check if two destination_names are compatible */
function destinationsCompatible(a: string, b: string): boolean {
  const pa = parseDestNames(a);
  const pb = parseDestNames(b);
  if (pa === "any" || pb === "any") return true;
  // Check for intersection
  for (const name of pa) {
    if (pb.has(name)) return true;
  }
  return false;
}

/** Find the shared destination name between two compatible requests */
function sharedDestination(a: string, b: string): string {
  const pa = parseDestNames(a);
  const pb = parseDestNames(b);
  if (pa === "any" && pb === "any") return "Any";
  if (pa === "any") return b;
  if (pb === "any") return a;
  for (const name of pa) {
    if (pb.has(name)) return name;
  }
  return a; // fallback
}

// ── Compatibility Graph ───────────────────────────────────────────────────

/**
 * Build adjacency list: two requests are compatible if they share:
 * 1. Same destination_type
 * 2. Same preferred_date
 * 3. Compatible destination_name
 * 4. Time overlap >= 60 minutes
 * 5. Haversine distance <= maxDistMiles
 */
function buildCompatibilityGraph(
  nodes: RequestNode[],
  maxDistMiles: number = 5,
  minOverlapMinutes: number = 60
): Map<number, Set<number>> {
  const adj = new Map<number, Set<number>>();
  for (let i = 0; i < nodes.length; i++) adj.set(i, new Set());

  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i], b = nodes[j];

      // Same destination type
      if (a.destination_type !== b.destination_type) continue;

      // Same date
      if (a.preferred_date !== b.preferred_date) continue;

      // Compatible destination names
      if (!destinationsCompatible(a.destination_name, b.destination_name)) continue;

      // Time overlap >= threshold
      if (timeOverlap(a, b) < minOverlapMinutes) continue;

      // Geographic proximity
      if (haversine(a.lat, a.lng, b.lat, b.lng) > maxDistMiles) continue;

      // Compatible — add edge
      adj.get(i)!.add(j);
      adj.get(j)!.add(i);
    }
  }

  return adj;
}

// ── Bron-Kerbosch Algorithm (with pivoting) ───────────────────────────────

/**
 * Bron-Kerbosch algorithm with pivoting to find all maximal cliques.
 * Returns cliques sorted by size (largest first).
 *
 * Time complexity: O(3^(n/3)) worst case
 * Practical for n < 50 which covers our use case
 */
function bronKerbosch(adj: Map<number, Set<number>>, n: number): number[][] {
  const cliques: number[][] = [];

  function bk(R: Set<number>, P: Set<number>, X: Set<number>) {
    if (P.size === 0 && X.size === 0) {
      if (R.size >= 2) {
        cliques.push([...R]);
      }
      return;
    }

    // Choose pivot: vertex in P ∪ X with most neighbors in P
    let pivot = -1;
    let maxNeighbors = -1;
    for (const u of [...P, ...X]) {
      const count = [...P].filter(v => adj.get(u)?.has(v)).length;
      if (count > maxNeighbors) {
        maxNeighbors = count;
        pivot = u;
      }
    }

    // Iterate over P \ N(pivot)
    const pivotNeighbors = adj.get(pivot) || new Set();
    const candidates = [...P].filter(v => !pivotNeighbors.has(v));

    for (const v of candidates) {
      const vNeighbors = adj.get(v) || new Set();
      const newR = new Set(R); newR.add(v);
      const newP = new Set([...P].filter(u => vNeighbors.has(u)));
      const newX = new Set([...X].filter(u => vNeighbors.has(u)));

      bk(newR, newP, newX);

      P.delete(v);
      X.add(v);
    }
  }

  const allVertices = new Set<number>();
  for (let i = 0; i < n; i++) allVertices.add(i);

  bk(new Set(), allVertices, new Set());

  // Sort by size descending
  cliques.sort((a, b) => b.length - a.length);

  return cliques;
}

// ── Greedy Clique Cover ───────────────────────────────────────────────────

/**
 * Greedy Maximum Clique Cover:
 * 1. Find all maximal cliques via Bron-Kerbosch
 * 2. Greedily select the largest clique
 * 3. Remove those nodes
 * 4. Repeat until no clique of size >= 2 remains
 */
function greedyCliqueCover(
  adj: Map<number, Set<number>>,
  n: number
): number[][] {
  const allCliques = bronKerbosch(adj, n);
  const assigned = new Set<number>();
  const groups: number[][] = [];

  for (const clique of allCliques) {
    // Filter out already-assigned nodes
    const available = clique.filter(v => !assigned.has(v));
    if (available.length < 2) continue;

    groups.push(available);
    for (const v of available) assigned.add(v);
  }

  return groups;
}

// ── Destination Suggestion ────────────────────────────────────────────────

/** Find the best shared destination for a group — preserves original case */
function suggestDestination(nodes: RequestNode[]): string {
  // Collect all specific destination names (original case)
  const allNames: string[] = [];
  for (const n of nodes) {
    if (!n.destination_name || n.destination_name.toLowerCase() === "any") continue;
    const parts = n.destination_name.split(/[;,]/).map(s => s.trim()).filter(Boolean);
    allNames.push(...parts);
  }

  if (allNames.length === 0) return "Any";

  // Count frequency (case-insensitive) — most common wins, return original case
  const freq = new Map<string, number>();
  for (const name of allNames) freq.set(name, (freq.get(name) || 0) + 1);

  let best = allNames[0];
  let bestCount = 0;
  for (const [name, count] of freq) {
    if (count > bestCount) { best = name; bestCount = count; }
  }

  return best;
}

// ── Main Grouping Function ────────────────────────────────────────────────

/**
 * Groups pending requests into outings using:
 * 1. Bucket by destination_type + date
 * 2. Build Compatibility Graph within each bucket
 * 3. Bron-Kerbosch to find maximal cliques
 * 4. Greedy Clique Cover to assign groups
 *
 * Returns GroupResult[] ready to insert into outings table.
 */
export function groupRequests(requests: RequestNode[]): GroupResult[] {
  if (requests.length < 2) return [];

  // Bucket by destination_type + date
  const buckets = new Map<string, RequestNode[]>();
  for (const r of requests) {
    const key = `${r.destination_type}|${r.preferred_date}`;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(r);
  }

  const results: GroupResult[] = [];

  for (const [bucketKey, nodes] of buckets) {
    if (nodes.length < 2) continue;

    // Build compatibility graph
    const adj = buildCompatibilityGraph(nodes);

    // Find groups via Greedy Clique Cover
    const groups = greedyCliqueCover(adj, nodes.length);

    for (const group of groups) {
      const groupNodes = group.map(i => nodes[i]);
      const overlapStart = groupOverlapStart(groupNodes);
      const dest = suggestDestination(groupNodes);

      results.push({
        senior_ids: groupNodes.map(n => n.senior_id),
        request_ids: groupNodes.map(n => n.id),
        destination_type: groupNodes[0].destination_type,
        suggested_destination: dest,
        suggested_time: minutesToTime(overlapStart),
        preferred_date: groupNodes[0].preferred_date,
        reasoning: `${groupNodes.length} seniors grouped by ${groupNodes[0].destination_type} on ${groupNodes[0].preferred_date} — Compatibility Graph + Bron-Kerbosch clique detection`,
      });
    }
  }

  return results;
}
