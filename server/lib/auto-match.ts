import { supabase } from "./supabase";
import { runMatching } from "./claude";
import { preClusterRequests, findNearestVolunteer } from "./clustering";

let isRunning = false;

/**
 * Auto-trigger matching logic — same as the match route but without Express req/res.
 * Safe to call fire-and-forget; logs errors but never throws.
 * Uses a lock to prevent concurrent runs.
 */
export async function triggerAutoMatch(): Promise<void> {
  if (isRunning) {
    console.log("[auto-match] Already running — skipping.");
    return;
  }
  isRunning = true;
  try {
    // 1. Get all pending requests with senior info
    const { data: requests, error: reqErr } = await supabase
      .from("outing_requests")
      .select("*, seniors(id, name, lat, lng, interests, mobility_notes)")
      .eq("status", "pending");

    if (reqErr) {
      console.error("[auto-match] Failed to fetch requests:", reqErr.message);
      return;
    }
    if (!requests || requests.length < 2) {
      console.log("[auto-match] Less than 2 pending requests — skipping.");
      return;
    }

    // 2. Get all volunteers
    const { data: volunteers, error: volErr } = await supabase
      .from("volunteers")
      .select("*");

    if (volErr) {
      console.error("[auto-match] Failed to fetch volunteers:", volErr.message);
      return;
    }
    if (!volunteers || volunteers.length === 0) {
      console.log("[auto-match] No volunteers available — skipping.");
      return;
    }

    // 3. Filter out volunteers already assigned to a pending/confirmed outing
    const { data: activeOutings } = await supabase
      .from("outings")
      .select("volunteer_id")
      .in("status", ["pending", "confirmed"]);

    const busyVolunteerIds = new Set((activeOutings || []).map((o: any) => o.volunteer_id));
    const availableVolunteers = volunteers.filter((v: any) => !busyVolunteerIds.has(v.id));

    if (availableVolunteers.length === 0) {
      console.log("[auto-match] All volunteers are busy — skipping.");
      return;
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
    const clusterHints = preClusters.map((c) => {
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
        destination_name: r.destination_name || "",
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
    const matchResult = await runMatching(input);

    // 7. Validate AI output
    const validSeniorIds = new Set(requests.map((r: any) => r.senior_id));
    const validVolunteerIds = new Set(availableVolunteers.map((v: any) => v.id));

    const validGroups = matchResult.groups.filter((group: any) => {
      const seniorsValid = group.senior_ids.every((id: string) => validSeniorIds.has(id));
      const volunteerValid = validVolunteerIds.has(group.volunteer_id);
      return seniorsValid && volunteerValid && group.senior_ids.length > 0;
    });

    // 8. Fetch cancelled outings to avoid re-creating them
    const { data: cancelledOutings } = await supabase
      .from("outings")
      .select("volunteer_id, request_ids")
      .eq("status", "cancelled");

    const cancelledKeys = new Set(
      (cancelledOutings || []).map((o: any) =>
        `${o.volunteer_id}:${(o.request_ids || []).sort().join(",")}`
      )
    );

    // 9. Create outing records and update request statuses
    let created = 0;
    for (const group of validGroups) {
      const requestIds = requests
        .filter((r: any) => group.senior_ids.includes(r.senior_id))
        .map((r: any) => r.id);

      // Re-check that all requests are still pending (prevent duplicates)
      const { data: freshReqs } = await supabase
        .from("outing_requests")
        .select("id, status")
        .in("id", requestIds);
      const stillPending = (freshReqs || []).filter((r: any) => r.status === "pending").map((r: any) => r.id);
      if (stillPending.length === 0) {
        console.log("[auto-match] All requests in group already matched — skipping.");
        continue;
      }

      // Skip if this exact volunteer + requests combo was previously cancelled
      const comboKey = `${group.volunteer_id}:${stillPending.sort().join(",")}`;
      if (cancelledKeys.has(comboKey)) {
        console.log("[auto-match] Skipping previously cancelled group.");
        continue;
      }

      const { error: outErr } = await supabase
        .from("outings")
        .insert({
          volunteer_id: group.volunteer_id,
          request_ids: stillPending,
          scheduled_date: requests.find((r: any) => group.senior_ids.includes(r.senior_id))?.preferred_date,
          scheduled_time: group.suggested_time,
          destination_type: group.destination_type,
          route_info: { reasoning: group.reasoning, suggested_destination: group.suggested_destination || "" },
          status: "pending",
        })
        .select()
        .single();

      if (outErr) {
        console.error("[auto-match] Failed to create outing:", outErr.message);
        continue;
      }

      created++;

      await supabase
        .from("outing_requests")
        .update({ status: "matched" })
        .in("id", stillPending);
    }

    console.log(`[auto-match] Created ${created} outings from ${validGroups.length} groups.`);
  } catch (e) {
    console.error("[auto-match] Unexpected error:", (e as Error).message);
  } finally {
    isRunning = false;
  }
}
