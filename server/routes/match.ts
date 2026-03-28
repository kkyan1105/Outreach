import { Router } from "express";
import { supabase } from "../lib/supabase";
import { runMatching } from "../lib/claude";
import { preClusterRequests, findNearestVolunteer } from "../lib/clustering";

const router = Router();

// POST /api/match — Run AI matching on all pending requests
router.post("/", async (_req, res) => {
  try {
    // 1. Get all pending requests with senior info
    const { data: requests, error: reqErr } = await supabase
      .from("outing_requests")
      .select("*, seniors(id, name, lat, lng, interests, mobility_notes)")
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
      return res.json({
        data: {
          groups: [],
          unmatched_seniors: requests.map((r: any) => r.senior_id),
          unmatched_reason: "No volunteers available",
        },
        error: null,
      });
    }

    // 3. Filter out volunteers already assigned to a pending/confirmed outing
    const { data: activeOutings } = await supabase
      .from("outings")
      .select("volunteer_id")
      .in("status", ["pending", "confirmed"]);

    const busyVolunteerIds = new Set((activeOutings || []).map((o: any) => o.volunteer_id));
    const availableVolunteers = volunteers.filter((v: any) => !busyVolunteerIds.has(v.id));

    if (availableVolunteers.length === 0) {
      return res.json({
        data: {
          groups: [],
          unmatched_seniors: requests.map((r: any) => r.senior_id),
          unmatched_reason: "All volunteers are currently assigned to outings",
        },
        error: null,
      });
    }

    // 4. DBSCAN pre-clustering by destination + geography
    const clusterInput = requests.map((r: any) => ({
      senior_id: r.senior_id,
      lat: r.seniors?.lat || 0,
      lng: r.seniors?.lng || 0,
      destination_type: r.destination_type,
    }));
    const preClusters = preClusterRequests(clusterInput, 5);

    // Find nearest volunteer for each cluster
    const volunteerPoints = availableVolunteers.map((v: any) => ({
      volunteer_id: v.id,
      lat: v.lat,
      lng: v.lng,
    }));
    const assignedVolunteers = new Set<string>();
    const clusterHints = preClusters.map(c => {
      const nearest = findNearestVolunteer(c.center, volunteerPoints, assignedVolunteers);
      if (nearest) assignedVolunteers.add(nearest.volunteer_id);
      return {
        ...c,
        suggested_volunteer_id: nearest?.volunteer_id || null,
        volunteer_distance_miles: nearest?.distance ? Math.round(nearest.distance * 10) / 10 : null,
      };
    });

    // 5. Build AI input with clustering hints
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
        mobility_notes: r.seniors?.mobility_notes || "",
      })),
      available_volunteers: availableVolunteers.map((v: any) => ({
        volunteer_id: v.id,
        name: v.name,
        lat: v.lat,
        lng: v.lng,
        max_passengers: v.max_passengers,
        availability: v.availability,
        vehicle_type: v.vehicle_type,
      })),
      cluster_hints: clusterHints,
    };

    // 6. Call AI for matching
    let matchResult;
    try {
      matchResult = await runMatching(input);
    } catch (e) {
      return res.status(500).json({ data: null, error: `AI matching failed: ${(e as Error).message}` });
    }

    // 7. Validate AI output — filter out groups with invalid IDs
    const validSeniorIds = new Set(requests.map((r: any) => r.senior_id));
    const validVolunteerIds = new Set(availableVolunteers.map((v: any) => v.id));

    const validGroups = matchResult.groups.filter((group: any) => {
      const seniorsValid = group.senior_ids.every((id: string) => validSeniorIds.has(id));
      const volunteerValid = validVolunteerIds.has(group.volunteer_id);
      return seniorsValid && volunteerValid && group.senior_ids.length > 0;
    });

    // 8. Create outing records and update request statuses
    const createdOutings = [];
    for (const group of validGroups) {
      const requestIds = requests
        .filter((r: any) => group.senior_ids.includes(r.senior_id))
        .map((r: any) => r.id);

      const { data: outing, error: outErr } = await supabase
        .from("outings")
        .insert({
          volunteer_id: group.volunteer_id,
          request_ids: requestIds,
          scheduled_date: requests.find((r: any) => group.senior_ids.includes(r.senior_id))?.preferred_date,
          scheduled_time: group.suggested_time,
          destination_type: group.destination_type,
          route_info: { reasoning: group.reasoning },
          status: "pending",
        })
        .select()
        .single();

      if (outErr) {
        console.error("Failed to create outing:", outErr.message);
        continue;
      }

      createdOutings.push(outing);

      await supabase
        .from("outing_requests")
        .update({ status: "matched" })
        .in("id", requestIds);
    }

    res.json({
      data: {
        ...matchResult,
        groups: validGroups,
        outings_created: createdOutings.length,
      },
      error: null,
    });
  } catch (e) {
    console.error("Match endpoint error:", e);
    res.status(500).json({ data: null, error: `Unexpected error: ${(e as Error).message}` });
  }
});

export default router;
