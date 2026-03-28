import { Router } from "express";
import { supabase } from "../lib/supabase";

const router = Router();

// GET /api/outings
router.get("/", async (req, res) => {
  const { volunteer_id } = req.query;

  let query = supabase
    .from("outings")
    .select("*")
    .order("created_at", { ascending: false });

  if (volunteer_id) query = query.eq("volunteer_id", volunteer_id as string);

  const { data: outings, error } = await query;

  if (error) return res.status(500).json({ data: null, error: error.message });

  // Enrich with senior and volunteer details
  const enriched = await Promise.all(
    (outings || []).map(async (outing) => {
      const { data: volunteer } = await supabase
        .from("volunteers")
        .select("*")
        .eq("id", outing.volunteer_id)
        .single();

      const { data: requests } = await supabase
        .from("outing_requests")
        .select("senior_id")
        .in("id", outing.request_ids);

      const seniorIds = (requests || []).map((r: { senior_id: string }) => r.senior_id);
      const { data: seniors } = await supabase
        .from("seniors")
        .select("*")
        .in("id", seniorIds);

      return { ...outing, volunteer, seniors: seniors || [] };
    })
  );

  res.json({ data: enriched, error: null });
});

// PATCH /api/outings/:id
router.patch("/:id", async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!status || !["confirmed", "cancelled"].includes(status)) {
    return res.status(400).json({ data: null, error: "Status must be 'confirmed' or 'cancelled'" });
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
