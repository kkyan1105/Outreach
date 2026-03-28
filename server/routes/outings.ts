import { Router } from "express";
import { supabase } from "../lib/supabase";

const router = Router();

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
      const { data: volunteer } = await supabase
        .from("volunteers")
        .select("*")
        .eq("id", outing.volunteer_id)
        .single();

      const { data: requests } = await supabase
        .from("outing_requests")
        .select("senior_id")
        .in("id", outing.request_ids);

      const seniorIds = (requests || []).map((r: any) => r.senior_id);
      const { data: seniors } = await supabase
        .from("seniors")
        .select("*")
        .in("id", seniorIds);

      return { ...outing, volunteer, seniors: seniors || [] };
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

// PATCH /api/outings/:id
router.patch("/:id", async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!status || !["confirmed", "cancelled"].includes(status)) {
    return res.status(400).json({ data: null, error: "Status must be 'confirmed' or 'cancelled'" });
  }

  // If cancelling, reset associated requests back to pending
  if (status === "cancelled") {
    const { data: outing } = await supabase
      .from("outings")
      .select("request_ids")
      .eq("id", id)
      .single();

    if (outing?.request_ids) {
      await supabase
        .from("outing_requests")
        .update({ status: "pending" })
        .in("id", outing.request_ids);
    }
  }

  const { data, error } = await supabase
    .from("outings")
    .update({ status })
    .eq("id", id)
    .select()
    .single();

  if (error) return res.status(500).json({ data: null, error: error.message });
  res.json({ data, error: null });
});

export default router;
