/**
 * Geographic clustering using DBSCAN algorithm
 * Pre-groups seniors by proximity before sending to AI for final matching
 */

interface Point {
  id: string;
  lat: number;
  lng: number;
  [key: string]: any;
}

// Haversine distance in miles
function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3959; // Earth radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * DBSCAN clustering algorithm
 */
export function dbscan(points: Point[], eps: number = 3, minPts: number = 2): { clusters: string[][]; noise: string[] } {
  const visited = new Set<string>();
  const clustered = new Set<string>();
  const clusters: string[][] = [];
  const noise: string[] = [];

  function regionQuery(point: Point): Point[] {
    return points.filter(p =>
      p.id !== point.id &&
      haversineDistance(point.lat, point.lng, p.lat, p.lng) <= eps
    );
  }

  function expandCluster(point: Point, neighbors: Point[], cluster: string[]) {
    cluster.push(point.id);
    clustered.add(point.id);

    const queue = [...neighbors];
    while (queue.length > 0) {
      const neighbor = queue.shift()!;

      if (!visited.has(neighbor.id)) {
        visited.add(neighbor.id);
        const neighborNeighbors = regionQuery(neighbor);
        if (neighborNeighbors.length >= minPts - 1) {
          queue.push(...neighborNeighbors.filter(n => !visited.has(n.id)));
        }
      }

      if (!clustered.has(neighbor.id)) {
        cluster.push(neighbor.id);
        clustered.add(neighbor.id);
      }
    }
  }

  for (const point of points) {
    if (visited.has(point.id)) continue;
    visited.add(point.id);

    const neighbors = regionQuery(point);
    if (neighbors.length < minPts - 1) {
      noise.push(point.id);
    } else {
      const cluster: string[] = [];
      expandCluster(point, neighbors, cluster);
      clusters.push(cluster);
    }
  }

  return { clusters, noise };
}

/**
 * Groups requests by destination_type first, then clusters geographically
 */
export function preClusterRequests(
  requests: { senior_id: string; lat: number; lng: number; destination_type: string; [key: string]: any }[],
  maxDistanceMiles: number = 5
): { destination_type: string; cluster: string[]; center: { lat: number; lng: number } }[] {
  const byDestination: Record<string, typeof requests> = {};
  for (const req of requests) {
    if (!byDestination[req.destination_type]) {
      byDestination[req.destination_type] = [];
    }
    byDestination[req.destination_type].push(req);
  }

  const result: { destination_type: string; cluster: string[]; center: { lat: number; lng: number } }[] = [];

  for (const [destType, reqs] of Object.entries(byDestination)) {
    const points: Point[] = reqs.map(r => ({
      id: r.senior_id,
      lat: r.lat,
      lng: r.lng,
    }));

    if (points.length === 1) {
      result.push({
        destination_type: destType,
        cluster: [points[0].id],
        center: { lat: points[0].lat, lng: points[0].lng },
      });
      continue;
    }

    const { clusters, noise } = dbscan(points, maxDistanceMiles, 1);

    for (const cluster of clusters) {
      const clusterPoints = points.filter(p => cluster.includes(p.id));
      const centerLat = clusterPoints.reduce((s, p) => s + p.lat, 0) / clusterPoints.length;
      const centerLng = clusterPoints.reduce((s, p) => s + p.lng, 0) / clusterPoints.length;

      result.push({
        destination_type: destType,
        cluster,
        center: { lat: centerLat, lng: centerLng },
      });
    }

    for (const id of noise) {
      const p = points.find(pt => pt.id === id)!;
      result.push({
        destination_type: destType,
        cluster: [id],
        center: { lat: p.lat, lng: p.lng },
      });
    }
  }

  return result;
}

/**
 * Find the nearest volunteer to a cluster center
 */
export function findNearestVolunteer(
  center: { lat: number; lng: number },
  volunteers: { volunteer_id: string; lat: number; lng: number }[],
  excludeIds: Set<string> = new Set()
): { volunteer_id: string; distance: number } | null {
  let nearest: { volunteer_id: string; distance: number } | null = null;

  for (const v of volunteers) {
    if (excludeIds.has(v.volunteer_id)) continue;
    const dist = haversineDistance(center.lat, center.lng, v.lat, v.lng);
    if (!nearest || dist < nearest.distance) {
      nearest = { volunteer_id: v.volunteer_id, distance: dist };
    }
  }

  return nearest;
}
