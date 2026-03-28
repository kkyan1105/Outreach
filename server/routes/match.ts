import { Router } from "express";
import { supabase } from "../lib/supabase";
import { runMatching } from "../lib/claude";

const router = Router();

// POST /api/match — Run AI matching on all pending requests
router.post("/", async (_req, res) => {
  // 1. Get all pending requests
  const { data: requests, error: reqErr } = await supabase
    .from("outing_requests")
    .select("*, seniors(id, name, lat, lng)")
    .eq("status", "pending");

  if (reqErr) return res.status(500).json({ data: null, error: reqErr.message });
  if (!requests || requests.length === 0) {
    return res.json({ data: { groups: [], unmatched_seniors: [], unmatched_reason: "No pending requests" }, error: null });
  }

  // 2. Get all volunteers
  const { data: volunteers, error: volErr } = await supabase
    .from("volunteers")
    .select("*");

  if (volErr) return res.status(500).json({ data: null, error: volErr.message });
  if (!volunteers || volunteers.length === 0) {
    return res.json({ data: { groups: [], unmatched_seniors: requests.map((r: any) => r.senior_id), unmatched_reason: "No volunteers available" }, error: null });
  }

  // 3. Build Claude input
  const input = {
    pending_requests: requests.map((r: any) => ({
      request_id: r.id,
      senior_id: r.senior_id,
      name: r.seniors?.name || "Unknown",
      lat: r.seniors?.lat || 0,
      lng: r.seniors?.lng || 0,
      destination_type: r.destination_type,
      preferred_date: r.preferred_date,
      time_window: `${r.preferred_time_start}-${r.preferred_time_end}`,
    })),
    available_volunteers: volunteers.map((v: any) => ({
      volunteer_id: v.id,
      name: v.name,
      lat: v.lat,
      lng: v.lng,
      max_passengers: v.max_passengers,
      availability: v.availability,
    })),
  };

  // 4. Call Claude for matching
  let matchResult;
  try {
    matchResult = await runMatching(input);
  } catch (e) {
    return res.status(500).json({ data: null, error: `AI matching failed: ${(e as Error).message}` });
  }

  // 5. Create outing records and update request statuses
  for (const group of matchResult.groups) {
    // Find request_ids for these seniors
    const requestIds = requests
      .filter((r: any) => group.senior_ids.includes(r.senior_id))
      .map((r: any) => r.id);

    // Create outing record
    await supabase.from("outings").insert({
      volunteer_id: group.volunteer_id,
      request_ids: requestIds,
      scheduled_date: requests.find((r: any) => group.senior_ids.includes(r.senior_id))?.preferred_date,
      scheduled_time: group.suggested_time,
      destination_type: group.destination_type,
      route_info: { reasoning: group.reasoning },
      status: "pending",
    });

    // Update request statuses to matched
    for (const reqId of requestIds) {
      await supabase
        .from("outing_requests")
        .update({ status: "matched" })
        .eq("id", reqId);
    }
  }

  res.json({ data: matchResult, error: null });
});

export default router;
