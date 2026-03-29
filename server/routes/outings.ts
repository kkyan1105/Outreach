import { Router } from "express";
import { supabase } from "../lib/supabase";
import { triggerAutoMatch } from "../lib/auto-match";

const router = Router();

// GET /api/outings/available?volunteer_id=xxx
// Returns unclaimed outings (volunteer_id IS NULL, status = "pending") that match
// a volunteer's availability and max_passengers.
router.get("/available", async (req, res) => {
  const { volunteer_id } = req.query;

  if (!volunteer_id) {
    return res.status(400).json({ data: null, error: "volunteer_id is required" });
  }

  // Fetch volunteer details
  const { data: volunteer, error: volErr } = await supabase
    .from("volunteers")
    .select("*")
    .eq("id", volunteer_id as string)
    .single();

  if (volErr || !volunteer) {
    return res.status(404).json({ data: null, error: "Volunteer not found" });
  }

  // Fetch all unclaimed pending outings
  const { data: outings, error: outErr } = await supabase
    .from("outings")
    .select("*")
    .is("volunteer_id", null)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (outErr) return res.status(500).json({ data: null, error: outErr.message });

  // Build set of volunteer availability day names
  // availability is stored as strings like "monday_morning", "tuesday_afternoon", etc.
  const availDays = new Set<string>();
  for (const slot of (volunteer as any).availability || []) {
    const day = slot.split("_")[0]; // e.g. "monday"
    availDays.add(day);
  }

  const dayNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

  // Filter outings by volunteer availability + capacity
  const matching = (outings || []).filter((outing: any) => {
    // Check day-of-week matches volunteer availability
    if (outing.scheduled_date) {
      const outingDate = new Date(outing.scheduled_date + "T00:00:00");
      const dayName = dayNames[outingDate.getDay()];
      if (!availDays.has(dayName)) return false;
    }

    // Check number of seniors <= max_passengers
    const numSeniors = (outing.request_ids || []).length;
    if (numSeniors > ((volunteer as any).max_passengers || 4)) return false;

    return true;
  });

  // Enrich with senior details
  const enriched = await Promise.all(
    matching.map(async (outing: any) => {
      const { data: requests } = await supabase
        .from("outing_requests")
        .select("*")
        .in("id", outing.request_ids || []);

      const seniorIds = (requests || []).map((r: any) => r.senior_id);
      const { data: seniors } = await supabase
        .from("seniors")
        .select("*")
        .in("id", seniorIds);

      const requestMap = new Map((requests || []).map((r: any) => [r.senior_id, r]));
      const safeSeniors = (seniors || []).map((s: any) => {
        const req = requestMap.get(s.id);
        return {
          ...s,
          name: s.name.split(" ")[0],
          phone: undefined,
          password_hash: undefined,
          emergency_contact: undefined,
          preferred_time_start: req?.preferred_time_start || null,
          preferred_time_end: req?.preferred_time_end || null,
          destination_name: req?.destination_name || "",
        };
      });

      return { ...outing, volunteer: null, seniors: safeSeniors };
    })
  );

  res.json({ data: enriched, error: null });
});

// GET /api/outings?volunteer_id=xxx&senior_id=xxx&status=xxx
router.get("/", async (req, res) => {
  const { volunteer_id, senior_id, status } = req.query;

  let query = supabase
    .from("outings")
    .select("*")
    .order("created_at", { ascending: false });

  if (volunteer_id) query = query.eq("volunteer_id", volunteer_id as string);
  if (status) query = query.eq("status", status as string);

  const { data: outings, error } = await query;

  if (error) return res.status(500).json({ data: null, error: error.message });

  // Enrich with senior and volunteer details
  const enriched = await Promise.all(
    (outings || []).map(async (outing: any) => {
      let volunteer = null;
      if (outing.volunteer_id) {
        const { data: vol } = await supabase
          .from("volunteers")
          .select("*")
          .eq("id", outing.volunteer_id)
          .single();
        volunteer = vol;
      }

      const { data: requests } = await supabase
        .from("outing_requests")
        .select("*")
        .in("id", outing.request_ids);

      const seniorIds = (requests || []).map((r: any) => r.senior_id);
      const { data: seniors } = await supabase
        .from("seniors")
        .select("*")
        .in("id", seniorIds);

      // Attach each senior's request time and show first name only for privacy
      const requestMap = new Map((requests || []).map((r: any) => [r.senior_id, r]));
      const safeSeniors = (seniors || []).map((s: any) => {
        const req = requestMap.get(s.id);
        return {
          ...s,
          name: s.name.split(" ")[0],
          phone: undefined,
          password_hash: undefined,
          emergency_contact: undefined,
          preferred_time_start: req?.preferred_time_start || null,
          preferred_time_end: req?.preferred_time_end || null,
          destination_name: req?.destination_name || "",
        };
      });

      return { ...outing, volunteer, seniors: safeSeniors };
    })
  );

  // If senior_id filter, only return outings that include this senior
  if (senior_id) {
    const filtered = enriched.filter((o: any) =>
      o.seniors.some((s: any) => s.id === senior_id)
    );
    return res.json({ data: filtered, error: null });
  }

  res.json({ data: enriched, error: null });
});

// POST /api/outings/manual — volunteer manually accepts a single pending request
router.post("/manual", async (req, res) => {
  const { volunteer_id, request_id } = req.body;

  if (!volunteer_id || !request_id) {
    return res.status(400).json({ data: null, error: "volunteer_id and request_id are required" });
  }

  // Fetch the request to get its details
  const { data: request, error: reqErr } = await supabase
    .from("outing_requests")
    .select("*")
    .eq("id", request_id)
    .single();

  if (reqErr || !request) {
    return res.status(404).json({ data: null, error: "Request not found" });
  }

  if (request.status !== "pending") {
    return res.status(400).json({ data: null, error: `Request is not pending (current status: ${request.status})` });
  }

  // Verify volunteer exists
  const { data: volunteer, error: volErr } = await supabase
    .from("volunteers")
    .select("id")
    .eq("id", volunteer_id)
    .single();

  if (volErr || !volunteer) {
    return res.status(404).json({ data: null, error: "Volunteer not found" });
  }

  // Create the outing — manual accept goes straight to confirmed
  const { data: outing, error: outErr } = await supabase
    .from("outings")
    .insert({
      volunteer_id,
      request_ids: [request_id],
      scheduled_date: request.preferred_date,
      scheduled_time: request.preferred_time_start || null,
      destination_type: request.destination_type,
      route_info: { manual: true },
      status: "confirmed",
    })
    .select()
    .single();

  if (outErr) return res.status(500).json({ data: null, error: outErr.message });

  // Update the request status to matched
  await supabase
    .from("outing_requests")
    .update({ status: "matched" })
    .eq("id", request_id);

  // Re-match after manual accept (request no longer pending, may affect other groups)
  triggerAutoMatch().catch((e) =>
    console.error("[outings] Auto-match after manual accept failed:", (e as Error).message)
  );

  res.json({ data: outing, error: null });
});

// POST /api/outings/batch — volunteer creates a ride from multiple pending requests
router.post("/batch", async (req, res) => {
  const { volunteer_id, request_ids } = req.body;

  if (!volunteer_id || !request_ids || !Array.isArray(request_ids) || request_ids.length === 0) {
    return res.status(400).json({ data: null, error: "volunteer_id and request_ids (array) are required" });
  }

  // Verify volunteer
  const { data: volunteer, error: volErr } = await supabase
    .from("volunteers")
    .select("id")
    .eq("id", volunteer_id)
    .single();
  if (volErr || !volunteer) {
    return res.status(404).json({ data: null, error: "Volunteer not found" });
  }

  // Fetch all requests and verify they're pending
  const { data: requests, error: reqErr } = await supabase
    .from("outing_requests")
    .select("*")
    .in("id", request_ids);
  if (reqErr || !requests) {
    return res.status(500).json({ data: null, error: "Could not fetch requests" });
  }

  const nonPending = requests.filter((r: any) => r.status !== "pending");
  if (nonPending.length > 0) {
    return res.status(400).json({ data: null, error: `${nonPending.length} request(s) are not pending` });
  }

  // All must have same destination_type
  const types = new Set(requests.map((r: any) => r.destination_type));
  if (types.size > 1) {
    return res.status(400).json({ data: null, error: "All requests must have the same destination type" });
  }

  // Must have overlapping time window
  const overlap = findOverlap(requests);
  if (!overlap) {
    return res.status(400).json({ data: null, error: "No overlapping time window between selected requests" });
  }

  const first = requests[0];
  const { data: outing, error: outErr } = await supabase
    .from("outings")
    .insert({
      volunteer_id,
      request_ids,
      scheduled_date: first.preferred_date,
      scheduled_time: overlap.start,
      destination_type: first.destination_type,
      route_info: { manual: true, batch: true },
      status: "confirmed",
    })
    .select()
    .single();

  if (outErr) return res.status(500).json({ data: null, error: outErr.message });

  // Mark all requests as matched
  await supabase
    .from("outing_requests")
    .update({ status: "matched" })
    .in("id", request_ids);

  triggerAutoMatch().catch((e) =>
    console.error("[outings] Auto-match after batch failed:", (e as Error).message)
  );

  res.json({ data: outing, error: null });
});

// Helper: parse time string "HH:MM:SS" or "HH:MM" to minutes
function timeToMinutes(t: string): number {
  const [h, m] = (t || "00:00").split(":").map(Number);
  return h * 60 + m;
}

// Helper: find overlapping time window across all requests
function findOverlap(requests: any[]): { start: string; end: string } | null {
  let latestStart = 0;
  let earliestEnd = 24 * 60;
  for (const r of requests) {
    latestStart = Math.max(latestStart, timeToMinutes(r.preferred_time_start));
    earliestEnd = Math.min(earliestEnd, timeToMinutes(r.preferred_time_end));
  }
  if (latestStart >= earliestEnd) return null;
  const startH = Math.floor(latestStart / 60);
  const startM = latestStart % 60;
  const endH = Math.floor(earliestEnd / 60);
  const endM = earliestEnd % 60;
  return {
    start: `${String(startH).padStart(2, "0")}:${String(startM).padStart(2, "0")}`,
    end: `${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}`,
  };
}

// POST /api/outings/:id/add — add pending request(s) to an existing outing
router.post("/:id/add", async (req, res) => {
  const { id } = req.params;
  const { request_ids } = req.body;
  const ids = Array.isArray(request_ids) ? request_ids : request_ids ? [request_ids] : [];

  if (ids.length === 0) {
    return res.status(400).json({ data: null, error: "request_ids required" });
  }

  const { data: outing, error: outErr } = await supabase
    .from("outings")
    .select("*")
    .eq("id", id)
    .single();
  if (outErr || !outing) return res.status(404).json({ data: null, error: "Outing not found" });
  if (outing.status === "cancelled" || outing.status === "completed") {
    return res.status(400).json({ data: null, error: "Cannot add to a cancelled or completed outing" });
  }

  // Fetch the new requests
  const { data: newReqs } = await supabase.from("outing_requests").select("*").in("id", ids);
  if (!newReqs || newReqs.length === 0) {
    return res.status(404).json({ data: null, error: "Requests not found" });
  }

  // Check all are pending
  const nonPending = newReqs.filter((r: any) => r.status !== "pending");
  if (nonPending.length > 0) {
    return res.status(400).json({ data: null, error: `${nonPending.length} request(s) not pending` });
  }

  // Check destination_type matches
  const wrongType = newReqs.filter((r: any) => r.destination_type !== outing.destination_type);
  if (wrongType.length > 0) {
    return res.status(400).json({ data: null, error: `Destination type must be "${outing.destination_type}"` });
  }

  // Fetch existing requests in the outing to check time overlap
  const { data: existingReqs } = await supabase.from("outing_requests").select("*").in("id", outing.request_ids);
  const allReqs = [...(existingReqs || []), ...newReqs];

  const overlap = findOverlap(allReqs);
  if (!overlap) {
    return res.status(400).json({ data: null, error: "No overlapping time window between passengers" });
  }

  const updatedIds = [...(outing.request_ids || []), ...ids];
  const { data: updated, error: updateErr } = await supabase
    .from("outings")
    .update({ request_ids: updatedIds, scheduled_time: overlap.start })
    .eq("id", id)
    .select()
    .single();
  if (updateErr) return res.status(500).json({ data: null, error: updateErr.message });

  await supabase.from("outing_requests").update({ status: "matched" }).in("id", ids);

  triggerAutoMatch().catch((e) =>
    console.error("[outings] Auto-match after add-to-ride failed:", (e as Error).message)
  );

  res.json({ data: updated, error: null });
});

// PATCH /api/outings/:id
router.patch("/:id", async (req, res) => {
  const { id } = req.params;
  const { status, volunteer_id } = req.body;

  if (!status || !["confirmed", "cancelled"].includes(status)) {
    return res.status(400).json({ data: null, error: "Status must be 'confirmed' or 'cancelled'" });
  }

  // Fetch the current outing
  const { data: outing, error: fetchErr } = await supabase
    .from("outings")
    .select("*")
    .eq("id", id)
    .single();

  if (fetchErr || !outing) {
    return res.status(404).json({ data: null, error: "Outing not found" });
  }

  // ACCEPT: volunteer claims an unclaimed outing
  if (status === "confirmed") {
    if (!volunteer_id) {
      return res.status(400).json({ data: null, error: "volunteer_id is required to confirm an outing" });
    }

    // First come first served: only allow if outing has no volunteer yet
    if (outing.volunteer_id && outing.volunteer_id !== volunteer_id) {
      return res.status(409).json({ data: null, error: "This outing has already been claimed by another volunteer" });
    }

    const { data: updated, error: updateErr } = await supabase
      .from("outings")
      .update({ status: "confirmed", volunteer_id })
      .eq("id", id)
      .select()
      .single();

    if (updateErr) return res.status(500).json({ data: null, error: updateErr.message });

    // Re-match: other groups may need recalculation since seniors in this group are no longer available
    triggerAutoMatch().catch((e) =>
      console.error("[outings] Auto-match after accept failed:", (e as Error).message)
    );

    return res.json({ data: updated, error: null });
  }

  // CANCEL: volunteer releases the outing back to unclaimed
  if (status === "cancelled") {
    // If this outing has a volunteer (confirmed outing being cancelled by volunteer),
    // unclaim it instead of fully cancelling — set volunteer_id to null and status back to pending
    if (outing.volunteer_id && outing.status === "confirmed") {
      const { data: updated, error: updateErr } = await supabase
        .from("outings")
        .update({ status: "pending", volunteer_id: null })
        .eq("id", id)
        .select()
        .single();

      if (updateErr) return res.status(500).json({ data: null, error: updateErr.message });
      // Requests stay as "matched" since the group is still valid, just needs a new volunteer
      // Re-match in case new groups can be formed
      triggerAutoMatch().catch((e) =>
        console.error("[outings] Auto-match after unclaim failed:", (e as Error).message)
      );
      return res.json({ data: updated, error: null });
    }

    // If it's an unclaimed pending outing being cancelled (admin action), fully cancel it
    // and reset requests back to pending
    if (outing.request_ids) {
      await supabase
        .from("outing_requests")
        .update({ status: "pending" })
        .in("id", outing.request_ids);
    }

    const { data: updated, error: updateErr } = await supabase
      .from("outings")
      .update({ status: "cancelled" })
      .eq("id", id)
      .select()
      .single();

    if (updateErr) return res.status(500).json({ data: null, error: updateErr.message });

    // Re-match after cancel (requests went back to pending)
    triggerAutoMatch().catch((e) =>
      console.error("[outings] Auto-match after cancel failed:", (e as Error).message)
    );

    return res.json({ data: updated, error: null });
  }
});

export default router;
