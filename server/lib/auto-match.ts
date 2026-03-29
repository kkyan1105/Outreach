import { supabase } from "./supabase";
import { groupRequests } from "./grouping";

let isRunning = false;

/**
 * Auto-trigger matching logic — groups seniors into outings WITHOUT assigning volunteers.
 * Uses Compatibility Graph + Bron-Kerbosch algorithm (no LLM).
 * Volunteers claim outings later via the available outings endpoint.
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
      .select("*, seniors(id, name, lat, lng)")
      .eq("status", "pending");

    if (reqErr) {
      console.error("[auto-match] Failed to fetch requests:", reqErr.message);
      return;
    }
    if (!requests || requests.length < 2) {
      console.log("[auto-match] Less than 2 pending requests — skipping.");
      return;
    }

    // 2. Build request nodes for the grouping algorithm
    const nodes = requests.map((r: any) => ({
      id: r.id,
      senior_id: r.senior_id,
      destination_type: r.destination_type,
      destination_name: r.destination_name || "",
      preferred_date: r.preferred_date,
      preferred_time_start: r.preferred_time_start || "00:00",
      preferred_time_end: r.preferred_time_end || "23:59",
      lat: r.seniors?.lat || 0,
      lng: r.seniors?.lng || 0,
    }));

    // 3. Run grouping algorithm (DBSCAN + Compatibility Graph + Bron-Kerbosch)
    const groups = groupRequests(nodes);

    if (groups.length === 0) {
      console.log("[auto-match] No valid groups found.");
      return;
    }

    // 4. Create outing records (with null volunteer_id)
    let created = 0;
    for (const group of groups) {
      // Re-check that all requests are still pending
      const { data: freshReqs } = await supabase
        .from("outing_requests")
        .select("id, status")
        .in("id", group.request_ids);
      const stillPending = (freshReqs || []).filter((r: any) => r.status === "pending").map((r: any) => r.id);
      if (stillPending.length < 2) {
        console.log("[auto-match] Not enough pending requests in group — skipping.");
        continue;
      }

      // Check for duplicate: existing pending outing with same senior_ids
      const sortedSeniorIds = [...group.senior_ids].sort();
      const { data: existingOutings } = await supabase
        .from("outings")
        .select("id, request_ids")
        .eq("status", "pending")
        .eq("destination_type", group.destination_type);

      let isDuplicate = false;
      if (existingOutings) {
        for (const existing of existingOutings) {
          const { data: existingReqs } = await supabase
            .from("outing_requests")
            .select("senior_id")
            .in("id", existing.request_ids || []);
          const existingSeniorIds = (existingReqs || []).map((r: any) => r.senior_id).sort();
          if (JSON.stringify(existingSeniorIds) === JSON.stringify(sortedSeniorIds)) {
            isDuplicate = true;
            break;
          }
        }
      }
      if (isDuplicate) {
        console.log("[auto-match] Duplicate group detected — skipping.");
        continue;
      }

      const { error: outErr } = await supabase
        .from("outings")
        .insert({
          volunteer_id: null,
          request_ids: stillPending,
          scheduled_date: group.preferred_date,
          scheduled_time: group.suggested_time,
          destination_type: group.destination_type,
          route_info: {
            reasoning: group.reasoning,
            suggested_destination: group.suggested_destination,
            algorithm: "DBSCAN + Compatibility Graph + Bron-Kerbosch",
          },
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

    console.log(`[auto-match] Created ${created} outings from ${groups.length} groups.`);
  } catch (e) {
    console.error("[auto-match] Unexpected error:", (e as Error).message);
  } finally {
    isRunning = false;
  }
}
