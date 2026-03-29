import { Router } from "express";
import { supabase } from "../lib/supabase";
import { triggerAutoMatch } from "../lib/auto-match";
const router = Router();

// Haversine distance in miles
function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3959; // Earth radius in miles
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

// GET /api/requests
router.get("/", async (req, res) => {
  const { status, senior_id, destination_type, preferred_date, lat, lng, radius, sort } = req.query;

  let query = supabase
    .from("outing_requests")
    .select("*, seniors(id, lat, lng)")
    .order("created_at", { ascending: false });

  if (status) query = query.eq("status", status as string);
  if (senior_id) query = query.eq("senior_id", senior_id as string);
  if (destination_type) query = query.eq("destination_type", destination_type as string);
  if (preferred_date) query = query.eq("preferred_date", preferred_date as string);

  const { data, error } = await query;

  if (error) return res.status(500).json({ data: null, error: error.message });

  let results = data || [];

  // Distance filtering (post-query since Supabase doesn't support geo natively)
  const hasGeo = lat && lng;
  const centerLat = hasGeo ? parseFloat(lat as string) : 0;
  const centerLng = hasGeo ? parseFloat(lng as string) : 0;
  const radiusMiles = radius ? parseFloat(radius as string) : Infinity;

  if (hasGeo) {
    // Attach computed distance to each result
    results = results
      .map((r: any) => {
        const seniorLat = r.seniors?.lat || 0;
        const seniorLng = r.seniors?.lng || 0;
        const distance = haversineDistance(centerLat, centerLng, seniorLat, seniorLng);
        return { ...r, _distance: distance };
      })
      .filter((r: any) => r._distance <= radiusMiles);
  }

  // Sorting
  if (sort === "date_asc") {
    results.sort((a: any, b: any) =>
      (a.preferred_date || "").localeCompare(b.preferred_date || "")
    );
  } else if (sort === "date_desc") {
    results.sort((a: any, b: any) =>
      (b.preferred_date || "").localeCompare(a.preferred_date || "")
    );
  } else if (sort === "distance" && hasGeo) {
    results.sort((a: any, b: any) => (a._distance || 0) - (b._distance || 0));
  }

  // Strip internal _distance and nested seniors join from response
  const cleaned = results.map(({ _distance, seniors, ...rest }: any) => rest);

  res.json({ data: cleaned, error: null });
});

// POST /api/requests
router.post("/", async (req, res) => {
  const { senior_id, destination_type, destination_name, preferred_date, preferred_time_start, preferred_time_end } = req.body;

  if (!senior_id || !destination_type || !preferred_date) {
    return res.status(400).json({ data: null, error: "senior_id, destination_type, and preferred_date are required" });
  }

  const { data, error } = await supabase
    .from("outing_requests")
    .insert({
      senior_id,
      destination_type,
      destination_name: destination_name || "",
      preferred_date,
      preferred_time_start,
      preferred_time_end,
      status: "pending",
    })
    .select()
    .single();

  if (error) return res.status(500).json({ data: null, error: error.message });

  // Auto-match after new request
  triggerAutoMatch().catch((e) =>
    console.error("[requests] Auto-match failed:", (e as Error).message)
  );

  res.json({ data, error: null });
});

// PATCH /api/requests/:id — cancel a request
router.patch("/:id", async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (status !== "cancelled") {
    return res.status(400).json({ data: null, error: "Only cancellation is supported" });
  }

  // Get the request
  const { data: request, error: reqErr } = await supabase
    .from("outing_requests")
    .select("*")
    .eq("id", id)
    .single();

  if (reqErr || !request) {
    return res.status(404).json({ data: null, error: "Request not found" });
  }

  if (request.status === "cancelled") {
    return res.json({ data: request, error: null });
  }

  // If matched, find and cancel the associated outing too
  if (request.status === "matched") {
    const { data: outings } = await supabase
      .from("outings")
      .select("*")
      .contains("request_ids", [id])
      .in("status", ["pending", "confirmed"]);

    for (const outing of (outings || [])) {
      const remainingIds = (outing.request_ids || []).filter((rid: string) => rid !== id);

      if (remainingIds.length === 0) {
        // No other passengers — cancel the whole outing
        await supabase.from("outings").update({ status: "cancelled" }).eq("id", outing.id);
      } else {
        // Remove this request from the outing
        await supabase.from("outings").update({ request_ids: remainingIds }).eq("id", outing.id);
      }
    }
  }

  // Cancel the request
  const { data, error } = await supabase
    .from("outing_requests")
    .update({ status: "cancelled" })
    .eq("id", id)
    .select()
    .single();

  if (error) return res.status(500).json({ data: null, error: error.message });

  // Re-match after senior cancels (remaining seniors may need regrouping)
  triggerAutoMatch().catch((e) =>
    console.error("[requests] Auto-match after cancel failed:", (e as Error).message)
  );

  res.json({ data, error: null });
});

export default router;
